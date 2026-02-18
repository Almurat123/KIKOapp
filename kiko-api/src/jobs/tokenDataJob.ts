/**
 * Token Data Refresh Job
 * Runs periodically to fetch and store trending tokens for multiple chains
 * 
 * Supported chains: Ethereum, Base, BSC, Arbitrum
 * Uses GeckoTerminal (free) as primary source, DexScreener as fallback
 */

import cron from 'node-cron';

import { getTrendingTokensPremium } from '../services/dexscreener.js';
import {
  saveTrendingTokens,
  getLastUpdateTime,
  getTrendingTokens as getStoredTrendingTokens,
  saveTrendingTokenCreator,
  saveTokenLaunchpadProfile
} from '../repositories/tokenRepository.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { validateTrendingTokenForListing } from '../services/trendingValidation.js';
import { detectLaunchpadToken } from '../services/ai/launchpadDetector.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import pLimit from 'p-limit';
import { acquireLock, releaseLock, set as setRedisCache, get as getRedisCache, incrBy as incrCacheBy, del as delCacheKey } from '../cache/cacheClient.js';

import { getNativeTokenPriceUsd } from '../services/onChainPriceService.js';
import { computeLaunchpadMultiple } from '../services/launchpadMultipleService.js';
import prisma from '../db/prisma.js';

/**
 * Supported chains configuration
 * PRIMARY: High-volume chains refreshed every 5 minutes
 * SECONDARY: Low-volume chains refreshed every 4 hours
 */
const PRIMARY_CHAINS = [
  { id: 'eth', name: 'Ethereum', geckoNetwork: 'eth' },
  { id: 'solana', name: 'Solana', geckoNetwork: 'solana' },
  { id: 'base', name: 'Base', geckoNetwork: 'base' },
  { id: 'bsc', name: 'BSC', geckoNetwork: 'bsc' },
];

const SECONDARY_CHAINS = [
  { id: 'arbitrum', name: 'Arbitrum', geckoNetwork: 'arbitrum' },
  { id: 'optimism', name: 'Optimism', geckoNetwork: 'optimism' },
  { id: 'polygon', name: 'Polygon', geckoNetwork: 'polygon_pos' },
];

const SUPPORTED_CHAINS = [...PRIMARY_CHAINS, ...SECONDARY_CHAINS];

// Refresh intervals
const PRIMARY_REFRESH_INTERVAL_MINUTES = 5;    // Main chains: every 5 minutes
const SECONDARY_REFRESH_INTERVAL_HOURS = 4;    // Secondary chains: every 4 hours

// Delay between chains (串行执行，避免并发)
const PRIMARY_CHAIN_DELAY_MS = 30000;   // 30 seconds between primary chains
const SECONDARY_CHAIN_DELAY_MS = 60000; // 60 seconds between secondary chains

// Number of tokens to fetch per chain
const TOKENS_PER_CHAIN = 100;
const LAUNCHPAD_DETECT_CONCURRENCY = Math.max(
  1,
  Number(process.env.LAUNCHPAD_DETECT_CONCURRENCY || '2')
);
const LAUNCH_MULTIPLE_ENRICH_ENABLED = true;
const LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN = Math.max(
  16,
  Number(process.env.LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN || '48')
);
const BASE_DOPPLER_VERIFY_BUDGET_PER_RUN = Math.max(
  8,
  Number(process.env.BASE_DOPPLER_VERIFY_BUDGET_PER_RUN || '24')
);
const BASE_DOPPLER_VERIFY_CONCURRENCY = Math.max(
  1,
  Number(process.env.BASE_DOPPLER_VERIFY_CONCURRENCY || '2')
);
const TOKEN_META_CACHE_TTL_SECONDS = Math.max(
  60 * 60,
  Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`)
);
const LAUNCHPAD_CLEAR_FAIL_THRESHOLD = Math.max(
  2,
  Number(process.env.LAUNCHPAD_CLEAR_FAIL_THRESHOLD || '3')
);
const LAUNCHPAD_CLEAR_FAIL_TTL_SECONDS = Math.max(
  5 * 60,
  Number(process.env.LAUNCHPAD_CLEAR_FAIL_TTL_SECONDS || `${30 * 60}`)
);

const LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN = Math.max(
  4,
  Number(process.env.LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN || '12')
);
const LAUNCHPAD_CREATOR_DISCOVERY_BUDGET_PER_RUN = Math.max(
  2,
  Number(process.env.LAUNCHPAD_CREATOR_DISCOVERY_BUDGET_PER_RUN || '6')
);

function resolveChainId(chainId: string): number | null {
  if (chainId === 'eth') return 1;
  if (chainId === 'base') return 8453;
  if (chainId === 'bsc') return 56;
  if (chainId === 'arbitrum') return 42161;
  if (chainId === 'optimism') return 10;
  if (chainId === 'polygon') return 137;
  return null;
}

function pickVerifyTargets<T>(rows: T[], budget: number): T[] {
  if (rows.length <= budget) return rows;
  const windowSizeMs = 5 * 60 * 1000; // rotate with refresh cadence
  const cursor = Math.floor(Date.now() / windowSizeMs);
  const start = (cursor * budget) % rows.length;
  const end = start + budget;
  if (end <= rows.length) return rows.slice(start, end);
  return [...rows.slice(start), ...rows.slice(0, end - rows.length)];
}

function detectBySuffix(chainId: string, address: string): string | null {
  const lower = address.toLowerCase();
  if (chainId === 'base' && lower.endsWith('b07')) return 'clanker';
  if (chainId === 'bsc' && (lower.endsWith('4444') || lower.endsWith('ffff'))) return 'four.meme';
  if (chainId === 'bsc' && (lower.endsWith('8888') || lower.endsWith('7777'))) return 'flap';
  if (chainId === 'solana' && lower.endsWith('pump')) return 'pump.fun';
  if (chainId === 'solana' && lower.endsWith('bonk')) return 'bonk.fun';
  return null;
}

function normalizeLaunchpadProvider(provider?: string | null): string | null {
  if (!provider) return null;
  if (provider === 'pumpfun') return 'pump.fun';
  if (provider === 'pumpswap') return 'pump.swap';
  if (provider === 'bonkfun') return 'bonk.fun';
  if (provider === 'fourmeme') return 'four.meme';
  if (provider === 'doppler finance' || provider === 'dopplerfinance') return 'doppler';
  return provider;
}

function sanitizeCreatorForLaunchpad(token: { launchpad?: string | null; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string }): void {
  if (String(token.launchpad || '').toLowerCase() !== 'flap') return;
  delete token.creatorAddress;
  delete token.creatorUrl;
  delete token.creatorLabel;
}

function initialPoolCacheKey(chainId: string, address: string) {
  return `token:initial_pool:v2:${chainId}:${address.toLowerCase()}`;
}

function initialPoolLegacyCacheKey(chainId: string, address: string) {
  return `initial_pool:${chainId}:${address.toLowerCase()}`;
}

function tokenMetaCacheKey(chainId: string, address: string) {
  return `token:meta:v2:${chainId}:${address.toLowerCase()}`;
}

function tokenMetaLegacyCacheKey(chainId: string, address: string) {
  return `token:meta:v1:${chainId}:${address.toLowerCase()}`;
}

function tokenMetaCompatV2Key(chainId: string, address: string) {
  return `token_meta_v2:${chainId}:${address.toLowerCase()}`;
}

function tokenMetaCompatV1Key(chainId: string, address: string) {
  return `token_meta:${chainId}:${address.toLowerCase()}`;
}

function launchpadClearFailKey(chainId: string, address: string) {
  return `launchpad:clear_fail:v1:${chainId}:${address.toLowerCase()}`;
}

function nativeUsdMissCacheKey(chainId: string | number, date: string) {
  return `native_usd_miss:${chainId}:${date}`;
}

async function fetchJson<T = any>(
  options: {
    url: string;
    headers?: Record<string, string>;
    method?: string;
    body?: any;
    timeout?: number;
  }
): Promise<T> {
  const { url, headers, method = 'GET', body, timeout = 10000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`fetchJson failed: ${resp.status} ${resp.statusText} URL=${url}`);
    }
    const data = await resp.json();
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}


type EnrichedTokenMeta = {
  creatorAddress?: string;
  creatorUrl?: string;
  creatorLabel?: string;
  launchMultiple?: number;
  updatedAt?: number;
};

const historicalNativeUsdByDate = new Map<string, number>();
const missingHistoricalNativeUsdUntil = new Map<string, number>();
const NATIVE_USD_MISS_TTL_SECONDS = Math.max(
  30 * 60,
  Number(process.env.NATIVE_USD_MISS_TTL_SECONDS || `${6 * 60 * 60}`)
);
function getCoinbaseSymbolByChainId(chainId: number): string | null {
  if (chainId === 56) return 'BNB';
  if (chainId === 137) return 'MATIC';
  if (chainId === 900) return 'SOL';
  if ([1, 10, 8453, 42161].includes(chainId)) return 'ETH';
  return null;
}

function toUtcDate(tsSec: number): string {
  const d = new Date(Math.max(0, tsSec) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getNativeUsdOnDate(chainId: number, tsSec?: number): Promise<number | null> {
  if (!Number.isFinite(Number(tsSec)) || Number(tsSec) <= 0) {
    const spot = await getNativeTokenPriceUsd(chainId);
    return Number.isFinite(spot) && spot > 0 ? spot : null;
  }

  const symbol = getCoinbaseSymbolByChainId(chainId);
  if (!symbol) {
    const spot = await getNativeTokenPriceUsd(chainId);
    return Number.isFinite(spot) && spot > 0 ? spot : null;
  }

  const date = toUtcDate(Number(tsSec));
  const key = `${chainId}:${date}`;
  const now = Date.now();
  const missingUntil = missingHistoricalNativeUsdUntil.get(key) || 0;
  if (missingUntil > now) return null;
  try {
    const rawMiss = await getRedisCache(nativeUsdMissCacheKey(chainId, date));
    const redisUntil = Number(rawMiss || 0);
    if (Number.isFinite(redisUntil) && redisUntil > now) {
      missingHistoricalNativeUsdUntil.set(key, redisUntil);
      return null;
    }
  } catch {
    // ignore cache read errors
  }

  const cached = historicalNativeUsdByDate.get(key);
  if (Number.isFinite(cached || NaN) && (cached || 0) > 0) return Number(cached);

  try {
    const url = `https://api.coinbase.com/v2/prices/${symbol}-USD/spot?date=${date}`;
    const data = await fetchJson<any>({
      url,
      headers: { Accept: 'application/json', 'User-Agent': 'KiKo/1.0' },
    });
    const px = Number(data?.data?.amount || 0);
    if (Number.isFinite(px) && px > 0) {
      historicalNativeUsdByDate.set(key, px);
      missingHistoricalNativeUsdUntil.delete(key);
      try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), '0', 1); } catch { }
      return px;
    }
    // Unexpected non-error empty price: avoid hammering the same date repeatedly.
    const until = now + NATIVE_USD_MISS_TTL_SECONDS * 1000;
    missingHistoricalNativeUsdUntil.set(key, until);
    try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), String(until), NATIVE_USD_MISS_TTL_SECONDS); } catch { }
  } catch {
    // Failed historical fetch: cache miss for a while to avoid repeated 404/rate-not-found storms.
    const until = now + NATIVE_USD_MISS_TTL_SECONDS * 1000;
    missingHistoricalNativeUsdUntil.set(key, until);
    try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), String(until), NATIVE_USD_MISS_TTL_SECONDS); } catch { }
  }

  // Only use spot as fallback when the requested date is recent (within 48h).
  // For older dates, spot price can be wildly different and would corrupt baselines.
  const ageSec = Math.abs(Date.now() / 1000 - Number(tsSec));
  if (ageSec <= 48 * 3600) {
    const spot = await getNativeTokenPriceUsd(chainId);
    if (Number.isFinite(spot) && spot > 0) {
      historicalNativeUsdByDate.set(key, spot);
      missingHistoricalNativeUsdUntil.delete(key);
      try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), '0', 1); } catch { }
      return spot;
    }
  } else {
    console.warn(`[getNativeUsdOnDate] Coinbase historical price unavailable for ${symbol} on ${date}, age=${(ageSec / 3600).toFixed(0)}h — skipping spot fallback to avoid baseline corruption`);
  }
  return null;
}



async function readTokenMetaCache(chainId: string, address: string): Promise<EnrichedTokenMeta | null> {
  try {
    let raw = await getRedisCache(tokenMetaCacheKey(chainId, address));
    let fromLegacy = false;
    if (!raw) {
      raw = await getRedisCache(tokenMetaLegacyCacheKey(chainId, address));
      fromLegacy = !!raw;
    }
    if (!raw) {
      raw = await getRedisCache(tokenMetaCompatV2Key(chainId, address));
      fromLegacy = !!raw;
    }
    if (!raw) {
      raw = await getRedisCache(tokenMetaCompatV1Key(chainId, address));
      fromLegacy = !!raw;
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EnrichedTokenMeta & { cacheVersion?: number };
    if (!parsed || typeof parsed !== 'object') return null;
    // Ignore legacy/unversioned multiple values to avoid stale carry-over after deploy.
    const cacheVersion = Number(parsed?.cacheVersion || 0);
    if (fromLegacy || cacheVersion < 2) {
      return {
        creatorAddress: parsed.creatorAddress,
        creatorUrl: parsed.creatorUrl,
        creatorLabel: parsed.creatorLabel,
        updatedAt: parsed.updatedAt,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeTokenMetaCache(chainId: string, address: string, meta: EnrichedTokenMeta): Promise<void> {
  if (!meta.creatorAddress && !meta.creatorUrl && !meta.creatorLabel && !Number.isFinite(meta.launchMultiple || NaN)) return;
  try {
    await setRedisCache(
      tokenMetaCacheKey(chainId, address),
      JSON.stringify({
        cacheVersion: 2,
        creatorAddress: meta.creatorAddress,
        creatorUrl: meta.creatorUrl,
        creatorLabel: meta.creatorLabel,
        launchMultiple: meta.launchMultiple,
        updatedAt: Date.now(),
      }),
      TOKEN_META_CACHE_TTL_SECONDS
    );
  } catch {
    // ignore cache write errors
  }
}





async function cacheInitialPoolSnapshots(
  chainId: string,
  tokens: Array<{ address?: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string; liquidity?: number }>
): Promise<void> {
  const sourceRank = (source?: string): number => {
    if (source === 'clanker_launch_model') return 2;
    if (source === 'trending_first_seen') return 1;
    return 0;
  };

  const estimateInitialLiquidity = async (
    token: { address?: string; launchpad?: string; poolCreatedAt?: string; liquidity?: number }
  ): Promise<{ value?: number; source: string }> => {
    const current = Number(token.liquidity || 0);
    // Default fallback: keep first seen liquidity snapshot.
    let fallbackValue = Number.isFinite(current) && current > 0 ? current : undefined;

    const addressLower = String(token.address || '').toLowerCase();
    const isClankerByLaunchpad = String(token.launchpad || '').toLowerCase() === 'clanker';
    const isClankerBySuffix = chainId === 'base' && addressLower.endsWith('b07');

    // Base/Clanker heuristic: launch liquidity tends to be around 34k or 68k USD.
    if (chainId === 'base' && (isClankerByLaunchpad || isClankerBySuffix)) {
      const createdSec = token.poolCreatedAt ? Math.floor(Date.parse(token.poolCreatedAt) / 1000) : 0;
      const ts = createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000);
      let ethUsd = await getNativeUsdOnDate(8453, ts);
      if (!Number.isFinite(Number(ethUsd || 0)) || Number(ethUsd || 0) <= 0) {
        ethUsd = await getNativeTokenPriceUsd(8453);
      }
      if (Number.isFinite(Number(ethUsd || 0)) && Number(ethUsd || 0) > 0) {
        const nativeUsd = Number(ethUsd || 0);
        const c1 = 10 * nativeUsd;
        const c2 = 20 * nativeUsd;
        // Pull dynamic estimates toward known launch bands (about 34k / 68k).
        const band1 = 34000;
        const band2 = 68000;
        const normalizedC1 = Math.abs(c1 - band1) <= Math.abs(c1 - band2) ? band1 : band2;
        const normalizedC2 = Math.abs(c2 - band1) <= Math.abs(c2 - band2) ? band1 : band2;
        const target = Number.isFinite(current) && current > 0 ? current : normalizedC1;
        const chosen = Math.abs(target - normalizedC1) <= Math.abs(target - normalizedC2) ? normalizedC1 : normalizedC2;
        if (Number.isFinite(chosen) && chosen > 0) {
          return { value: chosen, source: 'clanker_launch_model' };
        }
      }
      // If ETH USD is unavailable, keep a deterministic clanker fallback.
      return { value: 34000, source: 'clanker_launch_model' };
    }

    return { value: fallbackValue, source: 'trending_first_seen' };
  };

  const limiter = pLimit(12);
  await Promise.all(tokens.map((token) => limiter(async () => {
    try {
      const address = String(token.address || '').toLowerCase();
      if (!address) return;
      const poolAddress = String(token.poolAddress || '').trim();
      const poolCreatedAt = typeof token.poolCreatedAt === 'string' ? token.poolCreatedAt : undefined;
      if (!poolAddress && !poolCreatedAt) return;

      const key = initialPoolCacheKey(chainId, address);
      let existing = await getRedisCache(key);
      if (!existing) {
        existing = await getRedisCache(initialPoolLegacyCacheKey(chainId, address));
      }
      let existingParsed: any = null;
      if (existing) {
        try { existingParsed = JSON.parse(existing); } catch { }
      }

      const estimated = await estimateInitialLiquidity(token);
      const payload = {
        initialPoolAddress: poolAddress || undefined,
        initialPoolCreatedAt: poolCreatedAt || undefined,
        initialLiquidityUsd: Number.isFinite(Number(estimated.value || 0)) && Number(estimated.value || 0) > 0
          ? Number(estimated.value || 0)
          : undefined,
        capturedAt: Date.now(),
        source: estimated.source,
      };

      if (existingParsed) {
        const oldRank = sourceRank(String(existingParsed?.source || ''));
        const newRank = sourceRank(payload.source);
        // Keep better source. For same rank, preserve older snapshot.
        if (newRank < oldRank) return;
        if (newRank === oldRank) return;
      }

      await setRedisCache(key, JSON.stringify(payload), 30 * 24 * 60 * 60);
    } catch {
      // best-effort snapshot only
    }
  })));
}

function pickCreatorAddress(detected: any): string | undefined {
  const root = detected?.data || {};
  const nested = (root && typeof root === 'object' && (root as any).data && typeof (root as any).data === 'object')
    ? (root as any).data
    : null;
  const data = nested ? { ...(root as Record<string, unknown>), ...(nested as Record<string, unknown>) } : root;
  const candidates: unknown[] = [
    data.creatorAddress,
    data.creator,
    data.creator_address,
    data.userAddress,
    data.user_address,
    data.walletAddress,
    data.sentientWalletAddress,
    data.wallet_address,
    data.account,
    data.accountAddress,
    data.account_address,
    data.msg_sender,
    data.deployer,
    data.deployerAddress,
    data.deployer_address,
    data.owner,
    data.ownerAddress,
    data.owner_address,
    data.requestor,
    data.createdBy,
    data.created_by,
    data.creatorWallet,
    data.creator_wallet,
    data.dev,
    data.devWallet,
    data.developer,
    data.teamAddress,
    data.launcher,
    data.launcherAddress,
    data.launcher_address,
    data.teamWallet,
    data.team_wallet,
    data.requestorAddress,
    data.requestorWallet,
    data.creator_wallet,
    data.creatorWalletAddress,
    data.creatorPublicKey,
    data.creator_pubkey,
    data.mint_authority,
    data.mintAuthority,
    data.updateAuthority,
    data.update_authority,
    data.devAddress,
    data.creatorProfile?.address,
    data.profile?.address,
    data.user?.address,
    data.author?.address,
  ];

  const evmLike = /0x[a-fA-F0-9]{40}/;
  const solLike = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  const isIgnored = (value: string): boolean => {
    const v = value.trim().toLowerCase();
    if (!v) return true;
    if (v === '0x0000000000000000000000000000000000000000') return true;
    if (v === '0x000000000000000000000000000000000000dead') return true;
    return false;
  };
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if ((evmLike.test(value) || solLike.test(value)) && !isIgnored(value)) return value;
  }

  // Last-resort deep scan for address-like values in nested payloads.
  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);

    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
      continue;
    }

    for (const [key, value] of Object.entries(cur as Record<string, unknown>)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        const keyHint = key.toLowerCase();
        if ((keyHint.includes('creator') || keyHint.includes('owner') || keyHint.includes('deploy') || keyHint.includes('author')) &&
          (evmLike.test(trimmed) || solLike.test(trimmed)) && !isIgnored(trimmed)) {
          return trimmed;
        }
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return undefined;
}

function pickCreatorUrl(detected: any): string | undefined {
  const root = detected?.data || {};
  const nested = (root && typeof root === 'object' && (root as any).data && typeof (root as any).data === 'object')
    ? (root as any).data
    : null;
  const data = nested ? { ...(root as Record<string, unknown>), ...(nested as Record<string, unknown>) } : root;
  const socials = data.socials || {};

  const directCandidates: unknown[] = [
    data.social_context?.messageId,
    data.social_context?.message_id,
    data.social_context?.x,
    data.social_context?.twitter,
    data.social_context?.farcaster,
    data.social_context?.website,
    data.creatorUrl,
    data.creator_url,
    data.profileUrl,
    data.profile_url,
    socials.x,
    socials.twitter,
    socials.TWITTER,
    socials.farcaster,
    socials.warpcast,
    socials.telegram,
    socials.website,
    data.twitter,
    data.twitterUrl,
    data.twitter_url,
    data.x,
    data.xUrl,
    data.website,
    data.websiteUrl,
    data.telegram,
    data.telegramUrl,
    data.telegram_url,
    data.farcasterUrl,
    data.farcaster_url,
    data.castUrl,
    data.cast_url,
    data.creatorProfile?.url,
    data.social_context?.url,
    data.social_context?.profile,
    data.social_context?.link,
    data.webUrl,
    data.twitterUrl,
    data.telegramUrl,
  ];

  const toUrl = (raw?: string): string | undefined => {
    if (!raw || typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('@')) return `https://x.com/${trimmed.slice(1)}`;
    return undefined;
  };

  const isX = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
    } catch {
      return false;
    }
  };
  const isFarcaster = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname.includes('warpcast.com') || u.hostname.includes('farcaster');
    } catch {
      return false;
    }
  };

  const normalizedUrls = directCandidates
    .map((raw) => toUrl(raw as string))
    .filter((u): u is string => !!u);

  const xUrl = normalizedUrls.find(isX);
  if (xUrl) return xUrl;
  const farcasterUrl = normalizedUrls.find(isFarcaster);
  if (farcasterUrl) return farcasterUrl;
  const websiteUrl = normalizedUrls.find((u) => !isX(u) && !isFarcaster(u));
  if (websiteUrl) return websiteUrl;

  const xHandle = data.creatorProfile?.socialAccounts?.twitter?.username
    || data.creatorProfile?.socialAccounts?.x?.username
    || data.twitter
    || data.xUsername
    || data.social_context?.x_handle
    || data.social_context?.twitter_handle;
  if (typeof xHandle === 'string' && xHandle.trim()) {
    return `https://x.com/${xHandle.replace(/^@/, '')}`;
  }

  const farcasterUsername = data.creatorProfile?.socialAccounts?.farcaster?.username
    || data.farcaster
    || data.social_context?.farcaster;
  if (typeof farcasterUsername === 'string' && farcasterUsername.trim()) {
    return `https://warpcast.com/${farcasterUsername.replace(/^@/, '')}`;
  }

  const requestorFid = Number(data.requestor_fid || data.requestorFid || 0);
  if (Number.isFinite(requestorFid) && requestorFid > 0) {
    return `https://warpcast.com/~/profiles/${requestorFid}`;
  }

  return undefined;
}

function pickCreatorLabel(detected: any, creatorUrl?: string, creatorAddress?: string): string | undefined {
  const root = detected?.data || {};
  const nested = (root && typeof root === 'object' && (root as any).data && typeof (root as any).data === 'object')
    ? (root as any).data
    : null;
  const data = nested ? { ...(root as Record<string, unknown>), ...(nested as Record<string, unknown>) } : root;
  const socials = data.socials || {};

  const isDigits = (v?: string) => !!v && /^\d+$/.test(v);
  const cleanHandle = (v?: string): string | undefined => {
    if (!v || typeof v !== 'string') return undefined;
    const s = v.trim().replace(/^@/, '');
    if (!s) return undefined;
    if (/^https?:\/\//i.test(s)) return undefined;
    return s;
  };

  const xHandle = cleanHandle(
    data.creatorProfile?.socialAccounts?.twitter?.username
    || data.creatorProfile?.socialAccounts?.x?.username
    || data.twitterUsername
    || data.twitter
    || data.xUsername
    || socials.twitter
    || socials.x
    || data.social_context?.twitter
    || data.social_context?.x
    || data.social_context?.x_handle
    || data.creatorHandle
  );
  if (xHandle && !isDigits(xHandle)) {
    return `@${xHandle}`;
  }

  const farcasterHandle = cleanHandle(
    data.creatorProfile?.socialAccounts?.farcaster?.username
    || data.farcasterUsername
    || data.farcaster
    || data.social_context?.farcaster
    || data.social_context?.handle
  );
  if (farcasterHandle && !isDigits(farcasterHandle)) {
    return `@${farcasterHandle}`;
  }

  if (creatorUrl) {
    try {
      const u = new URL(creatorUrl);
      const path = u.pathname.replace(/\/+$/, '');
      const last = path.split('/').filter(Boolean).pop();
      const parts = path.split('/').filter(Boolean);
      const host = u.hostname.replace(/^www\./, '');
      const isX = host.includes('x.com') || host.includes('twitter.com');
      if (isX) {
        // x.com/{user}/status/{id} => use {user}, not status id
        const xUser = (parts[0] || '').replace(/^@/, '');
        const reserved = new Set([
          'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
          'notifications', 'settings', 'tos', 'privacy', 'status'
        ]);
        if (xUser && !reserved.has(xUser.toLowerCase())) {
          return `@${xUser.replace(/^@/, '')}`;
        }
        // For x.com/i/status/... and other reserved paths, keep platform label.
        return 'X post';
      }
      if (u.hostname.includes('warpcast.com') && path.includes('/~/profiles/')) {
        return 'Farcaster';
      }
      if (last) {
        if (u.hostname.includes('warpcast.com')) return 'Farcaster';
        return host || last;
      }
    } catch {
      // ignore malformed url
    }
  }

  const socialId = typeof data.social_context?.id === 'string' ? data.social_context.id.trim() : '';
  const fid = Number(data.requestor_fid || data.requestorFid || (isDigits(socialId) ? socialId : 0));
  if (Number.isFinite(fid) && fid > 0) {
    return 'Farcaster';
  }

  const preferred: unknown[] = [
    data.creatorLabel,
    data.creator_label,
    data.creatorProfile?.handle,
    socials.handle,
  ];
  for (const raw of preferred) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    if (isDigits(value)) continue;
    if (/^@?(i|status)$/i.test(value)) continue;
    return value.startsWith('@') ? value : `@${value}`;
  }

  return creatorAddress;
}

function pickCreatorMeta(detected: any): { creatorAddress?: string; creatorUrl?: string; creatorLabel?: string } {
  const provider = typeof detected?.provider === 'string' ? detected.provider.toLowerCase() : '';
  const root = detected?.data || {};
  const nested = (root && typeof root === 'object' && (root as any).data && typeof (root as any).data === 'object')
    ? (root as any).data
    : null;
  const merged = nested ? { ...(root as Record<string, unknown>), ...(nested as Record<string, unknown>) } : root;

  // flap policy: provider does not expose reliable creator identity.
  if (provider === 'flap') {
    return {};
  }

  // four.meme strict creator policy:
  // 1) use social URL (twitter/x/messageId) first
  // 2) fallback to userAddress
  if (provider === 'fourmeme') {
    const twitterUrlRaw = [
      (merged as any)?.twitterUrl,
      (merged as any)?.twitter,
      (merged as any)?.xUrl,
      (merged as any)?.x,
      (merged as any)?.creatorUrl,
      (merged as any)?.social_context?.messageId,
      (merged as any)?.social_context?.message_id,
      (merged as any)?.social_context?.twitter,
      (merged as any)?.social_context?.x,
    ].find((v) => typeof v === 'string' && !!String(v).trim());
    const twitterUrl = typeof twitterUrlRaw === 'string' ? twitterUrlRaw.trim() : '';
    const creatorAddress = pickCreatorAddress(detected);
    if (twitterUrl) {
      let creatorLabel: string | undefined;
      try {
        const u = new URL(twitterUrl);
        if (u.hostname.includes('x.com') || u.hostname.includes('twitter.com')) {
          const user = (u.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
          const reserved = new Set([
            'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
            'notifications', 'settings', 'tos', 'privacy', 'status'
          ]);
          if (user && !reserved.has(user.toLowerCase())) {
            creatorLabel = `@${user.replace(/^@/, '')}`;
          }
        }
      } catch {
        // keep raw fallback when url is malformed
      }
      return {
        creatorAddress,
        creatorUrl: twitterUrl,
        creatorLabel: creatorLabel || 'X post'
      };
    }
    return {
      creatorAddress,
      creatorUrl: undefined,
      creatorLabel: creatorAddress
    };
  }

  // pump.fun strict creator policy:
  // 1) use creatorUrl first (twitter/telegram/etc)
  // 2) fallback to creatorAddress
  if (provider === 'pumpfun') {
    const creatorAddress = pickCreatorAddress(detected);
    const creatorUrl = pickCreatorUrl(detected);
    if (creatorUrl) {
      const labelFromUrl = pickCreatorLabel(detected, creatorUrl, creatorAddress);
      return {
        creatorAddress,
        creatorUrl,
        creatorLabel: labelFromUrl || creatorUrl
      };
    }
    return {
      creatorAddress,
      creatorUrl: undefined,
      creatorLabel: creatorAddress
    };
  }

  let creatorAddress = pickCreatorAddress(detected);
  let creatorUrl = pickCreatorUrl(detected);
  let creatorLabel = pickCreatorLabel(detected, creatorUrl, creatorAddress);

  const addressLike = (value?: string) => !!value && (/^0x[a-f0-9]{40}$/i.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value));
  if (creatorLabel && addressLike(creatorLabel)) {
    creatorLabel = undefined;
  }

  return { creatorAddress, creatorUrl, creatorLabel };
}

function isFidLabel(value?: string): boolean {
  return typeof value === 'string' && /^fid:\d+$/i.test(value.trim());
}

function isWeakCreatorLabel(value?: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  return /^fid:\d+$/i.test(v) || /^@?\d+$/.test(v) || /^@?(i|status)$/i.test(v);
}

function isXUrl(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
  } catch {
    return false;
  }
}

function pickDexCreatorMetaFromToken(token: {
  socials?: Array<{ type?: string; url?: string }>;
  websites?: Array<{ url?: string; label?: string }>;
}): { creatorUrl?: string; creatorLabel?: string } {
  const socials = Array.isArray(token?.socials) ? token.socials : [];
  const websites = Array.isArray(token?.websites) ? token.websites : [];

  const firstByType = (...types: string[]): string | undefined => {
    const wanted = new Set(types.map((t) => t.toLowerCase()));
    for (const row of socials) {
      if (!row || typeof row.url !== 'string' || !row.url.trim()) continue;
      const t = String(row.type || '').toLowerCase();
      if (wanted.has(t)) return row.url.trim();
    }
    return undefined;
  };

  const parseXHandle = (url?: string): string | undefined => {
    if (!url) return undefined;
    try {
      const u = new URL(url);
      if (!(u.hostname.includes('x.com') || u.hostname.includes('twitter.com'))) return undefined;
      const user = (u.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
      const reserved = new Set([
        'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
        'notifications', 'settings', 'tos', 'privacy', 'status'
      ]);
      if (!user || reserved.has(user.toLowerCase())) return undefined;
      return `@${user.replace(/^@/, '')}`;
    } catch {
      return undefined;
    }
  };

  const parseWarpcastHandle = (url?: string): string | undefined => {
    if (!url) return undefined;
    try {
      const u = new URL(url);
      if (!u.hostname.includes('warpcast.com')) return undefined;
      const parts = u.pathname.split('/').filter(Boolean);
      if (!parts.length) return undefined;
      if (parts[0] === '~' && parts[1] === 'profiles' && parts[2]) return 'Farcaster';
      const user = parts[0];
      if (!user) return undefined;
      return `@${user.replace(/^@/, '')}`;
    } catch {
      return undefined;
    }
  };

  const xUrl = firstByType('twitter', 'x');
  if (xUrl) {
    return {
      creatorUrl: xUrl,
      creatorLabel: parseXHandle(xUrl) || xUrl
    };
  }

  const farcasterUrl = firstByType('farcaster', 'warpcast');
  if (farcasterUrl) {
    return {
      creatorUrl: farcasterUrl,
      creatorLabel: parseWarpcastHandle(farcasterUrl) || farcasterUrl
    };
  }

  const websiteUrl = firstByType('website') || websites.find((w) => typeof w?.url === 'string' && !!w.url.trim())?.url?.trim();
  if (websiteUrl) {
    return {
      creatorUrl: websiteUrl,
      creatorLabel: websiteUrl
    };
  }

  return {};
}

async function enrichLaunchpadsForTrending(
  chainId: string,
  tokens: Array<{ address: string; launchpad?: string; imageUrl?: string; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; launchMultiple?: number; poolAddress?: string; poolCreatedAt?: string; price?: number }>
): Promise<void> {
  if (tokens.length === 0) return;
  const evmChainId = resolveChainId(chainId);
  const isSolana = chainId === 'solana';

  const persistLaunchpad = async (
    token: { address: string; launchpad?: string | null; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string },
    source: string
  ) => {
    try {
      sanitizeCreatorForLaunchpad(token);
      const normalizedLaunchpad = normalizeLaunchpadProvider(token.launchpad || null);
      await saveTokenLaunchpadProfile(chainId, token.address, {
        launchpad: normalizedLaunchpad,
        creatorAddress: token.creatorAddress,
        creatorUrl: token.creatorUrl,
        creatorLabel: token.creatorLabel,
        source,
      });
      // DB-first safety: persist launchpad tag directly even when cache layer is unavailable.
      if (normalizedLaunchpad !== undefined) {
        await prisma.trendingToken.updateMany({
          where: { chain: chainId, address: token.address.toLowerCase() },
          data: { launchpad: normalizedLaunchpad || null }
        });
      }
      if (token.creatorAddress || token.creatorUrl || token.creatorLabel) {
        await saveTrendingTokenCreator(chainId, token.address, {
          creatorAddress: token.creatorAddress,
          creatorUrl: token.creatorUrl,
          creatorLabel: token.creatorLabel,
        });
      }
    } catch {
      // non-blocking persistence path
    }
  };

  // Warm from metadata cache first (keeps creator/multiple stable across DB reloads)
  await Promise.all(tokens.map(async (token) => {
    const cached = await readTokenMetaCache(chainId, token.address);
    if (!cached) return;
    if (!token.creatorAddress && cached.creatorAddress) token.creatorAddress = cached.creatorAddress;
    if (!(token as any).creatorUrl && cached.creatorUrl) (token as any).creatorUrl = cached.creatorUrl;
    if (!(token as any).creatorLabel && cached.creatorLabel) (token as any).creatorLabel = cached.creatorLabel;
    sanitizeCreatorForLaunchpad(token as any);
  }));

  // Step 1: deterministic suffix detection
  for (const token of tokens as Array<{
    address: string;
    launchpad?: string;
    websites?: Array<{ url?: string; label?: string }>;
    socials?: Array<{ type?: string; url?: string }>;
    creatorUrl?: string;
    creatorLabel?: string;
    dexId?: string;
    dex?: string;
  }>) {
    token.launchpad =
      detectBySuffix(chainId, token.address)
      || undefined;
    sanitizeCreatorForLaunchpad(token as any);
  }
  const deterministic = tokens.filter((t) => !!t.launchpad);
  if (deterministic.length > 0) {
    const persistLimiter = pLimit(10);
    await Promise.all(deterministic.map((token) => persistLimiter(async () => {
      await persistLaunchpad(token as any, 'deterministic_pattern');
    })));
  }

  // Step 2: BSC flap verification for suffix-matched candidates
  if (chainId === 'bsc') {
    const flapCandidates = tokens.filter((t) => t.launchpad === 'flap' && t.address.startsWith('0x'));
    if (flapCandidates.length > 0) {
      const verifyTargets = pickVerifyTargets(
        flapCandidates,
        Math.min(LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN, 60)
      );
      const limiter = pLimit(LAUNCHPAD_DETECT_CONCURRENCY);
      await Promise.all(verifyTargets.map((token) => limiter(async () => {
        try {
          const detected = await detectLaunchpadToken(token.address, 56, { mode: 'cheap' });
          if (!detected || detected.provider !== 'flap') {
            token.launchpad = undefined;
            return;
          }
          const creatorMeta = pickCreatorMeta(detected);
          token.creatorAddress = creatorMeta.creatorAddress;
          (token as any).creatorUrl = creatorMeta.creatorUrl;
          (token as any).creatorLabel = creatorMeta.creatorLabel;
          sanitizeCreatorForLaunchpad(token as any);
          await writeTokenMetaCache(chainId, token.address, {
            creatorAddress: token.creatorAddress,
            creatorUrl: (token as any).creatorUrl,
            creatorLabel: (token as any).creatorLabel,
            launchMultiple: token.launchMultiple
          });
          await persistLaunchpad(token as any, 'detector_flap');
          await delCacheKey(launchpadClearFailKey(chainId, token.address)).catch(() => undefined);
          if (!token.imageUrl && typeof (detected as any)?.data?.imageUrl === 'string') {
            token.imageUrl = (detected as any).data.imageUrl;
          }
        } catch {
          // Keep suffix classification when verification fails due to transient errors.
        }
      })));
    }
  }

  // Step 3: API verification for unresolved EVM tokens (rotation + budgeted).
  // DB-first enrichment: any successful detection is persisted to profile + trending rows.
  if (evmChainId) {
    const unresolved = tokens.filter((t) => !t.launchpad && t.address.startsWith('0x'));
    if (unresolved.length > 0) {
      const chainVerifyBudget = chainId === 'base'
        ? Math.min(LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN, BASE_DOPPLER_VERIFY_BUDGET_PER_RUN)
        : LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN;
      const verifyTargets = pickVerifyTargets(unresolved, chainVerifyBudget);
      if (unresolved.length > verifyTargets.length) {
        logger.info(LogCode.API_FETCH_SUCCESS, 'Launchpad verify budget applied', {
          chain: chainId,
          unresolved: unresolved.length,
          verifying: verifyTargets.length
        });
      }

      const limiter = pLimit(BASE_DOPPLER_VERIFY_CONCURRENCY);
      await Promise.all(verifyTargets.map((token) => limiter(async () => {
        try {
          const detected = await detectLaunchpadToken(token.address, evmChainId, {
            mode: 'full',
            forceRefresh: true
          });
          const normalized = normalizeLaunchpadProvider(detected?.provider || null);
          if (normalized) token.launchpad = normalized;
          const creatorMeta = pickCreatorMeta(detected);
          token.creatorAddress = creatorMeta.creatorAddress;
          (token as any).creatorUrl = creatorMeta.creatorUrl;
          (token as any).creatorLabel = creatorMeta.creatorLabel;
          await writeTokenMetaCache(chainId, token.address, {
            creatorAddress: token.creatorAddress,
            creatorUrl: (token as any).creatorUrl,
            creatorLabel: (token as any).creatorLabel,
            launchMultiple: token.launchMultiple
          });
          await persistLaunchpad(token as any, 'detector_base');
          await delCacheKey(launchpadClearFailKey(chainId, token.address)).catch(() => undefined);
          if (!token.imageUrl && typeof (detected as any)?.data?.imageUrl === 'string') {
            token.imageUrl = (detected as any).data.imageUrl;
          }
        } catch {
          // Keep unresolved token without launchpad tag
        }
      })));
    }
  }

  // Step 3b: API verification for unresolved Solana tokens.
  if (isSolana) {
    const unresolved = tokens.filter((t) => !t.launchpad && !t.address.startsWith('0x'));
    if (unresolved.length > 0) {
      const verifyTargets = pickVerifyTargets(unresolved, LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN);
      const limiter = pLimit(LAUNCHPAD_DETECT_CONCURRENCY);
      await Promise.all(verifyTargets.map((token) => limiter(async () => {
        try {
      const detected = await detectLaunchpadToken(token.address, undefined, {
        mode: 'full',
        forceRefresh: true,
        requireCreator: true
      });
          const normalized = normalizeLaunchpadProvider(detected?.provider || null);
          if (!normalized) return;
          token.launchpad = normalized;
          const creatorMeta = pickCreatorMeta(detected);
          token.creatorAddress = creatorMeta.creatorAddress;
          (token as any).creatorUrl = creatorMeta.creatorUrl;
          (token as any).creatorLabel = creatorMeta.creatorLabel;
          await writeTokenMetaCache(chainId, token.address, {
            creatorAddress: token.creatorAddress,
            creatorUrl: (token as any).creatorUrl,
            creatorLabel: (token as any).creatorLabel,
            launchMultiple: token.launchMultiple
          });
          await persistLaunchpad(token as any, 'detector_solana');
          await delCacheKey(launchpadClearFailKey(chainId, token.address)).catch(() => undefined);
          if (!token.imageUrl && typeof (detected as any)?.data?.imageUrl === 'string') {
            token.imageUrl = (detected as any).data.imageUrl;
          }
        } catch {
          // Keep unresolved token without launchpad tag
        }
      })));
    }
  }

  // Step 4: creator backfill for already-classified launchpad tokens.
  // This keeps request cost bounded while repairing "launchpad exists but creator missing".
  const chainIdNum = evmChainId;
  if (!chainIdNum && !isSolana) return;

  const backfillCandidates = tokens.filter((t) => {
    if (!t.launchpad) return false;
    const missingCreator = !t.creatorAddress && !(t as any).creatorUrl && !(t as any).creatorLabel;
    const weakCreator = isWeakCreatorLabel((t as any).creatorLabel) && !isXUrl((t as any).creatorUrl);
    if (!missingCreator && !weakCreator) return false;
    return isSolana ? !t.address.startsWith('0x') : t.address.startsWith('0x');
  });
  if (backfillCandidates.length === 0) return;

  const backfillTargets = pickVerifyTargets(
    backfillCandidates,
    Math.min(LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN, LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN)
  );
  const backfillLimiter = pLimit(Math.max(2, Math.floor(LAUNCHPAD_DETECT_CONCURRENCY / 2)));
  await Promise.all(backfillTargets.map((token) => backfillLimiter(async () => {
    try {
      const detected = await detectLaunchpadToken(token.address, chainIdNum || undefined, {
        mode: 'full',
        requireCreator: true,
        forceRefresh: false,
      });
        if (!detected) {
          const suffixLaunchpad = detectBySuffix(chainId, token.address);
          const hasCreator = !!token.creatorAddress || !!(token as any).creatorUrl || !!(token as any).creatorLabel;
          const currentLaunchpad = String(token.launchpad || '').toLowerCase();
          const isNonDeterministicLaunchpad = !!currentLaunchpad
            && !['clanker', 'four.meme', 'flap', 'pump.fun', 'bonk.fun'].includes(currentLaunchpad);
          // Clear stale non-deterministic launchpad labels when force-refresh verify misses.
          // This prevents historical false positives (e.g. stale doppler tag) from sticking forever.
          if (!suffixLaunchpad && !hasCreator && isNonDeterministicLaunchpad) {
            const failKey = launchpadClearFailKey(chainId, token.address);
            const strikes = await incrCacheBy(failKey, 1, LAUNCHPAD_CLEAR_FAIL_TTL_SECONDS).catch(() => 1);
            if (strikes >= LAUNCHPAD_CLEAR_FAIL_THRESHOLD) {
              token.launchpad = undefined;
              await persistLaunchpad({
                address: token.address,
                launchpad: null,
                creatorAddress: undefined,
                creatorUrl: undefined,
                creatorLabel: undefined,
              }, 'detector_backfill_clear');
            }
          }
          return;
        }

      if (!token.launchpad) {
        const normalized = normalizeLaunchpadProvider(detected.provider || null);
        if (normalized) token.launchpad = normalized;
      }
      const creatorMeta = pickCreatorMeta(detected);
      const currentLabel = (token as any).creatorLabel as string | undefined;
      const currentUrl = (token as any).creatorUrl as string | undefined;
      const shouldUpgradeFromWeak = isWeakCreatorLabel(currentLabel) && !isXUrl(currentUrl) && (
        isXUrl(creatorMeta.creatorUrl) || (typeof creatorMeta.creatorLabel === 'string' && creatorMeta.creatorLabel.startsWith('@'))
      );
      if (creatorMeta.creatorAddress && !token.creatorAddress) token.creatorAddress = creatorMeta.creatorAddress;
      if (creatorMeta.creatorUrl && (!(token as any).creatorUrl || shouldUpgradeFromWeak)) {
        (token as any).creatorUrl = creatorMeta.creatorUrl;
      }
      if (creatorMeta.creatorLabel && (!(token as any).creatorLabel || shouldUpgradeFromWeak)) {
        (token as any).creatorLabel = creatorMeta.creatorLabel;
      }
      const launchpadTag = String(token.launchpad || '').toLowerCase();
      const shouldUseDexCreatorFallback =
        (chainId === 'solana' && launchpadTag === 'bonk.fun') ||
        (chainId === 'bsc' && launchpadTag === 'four.meme');
      if (shouldUseDexCreatorFallback) {
        const dexFallback = pickDexCreatorMetaFromToken(token as any);
        if (dexFallback.creatorUrl && !(token as any).creatorUrl) {
          (token as any).creatorUrl = dexFallback.creatorUrl;
        }
        if (dexFallback.creatorLabel && !(token as any).creatorLabel) {
          (token as any).creatorLabel = dexFallback.creatorLabel;
        }
      }
      if (!token.imageUrl && typeof (detected as any)?.data?.imageUrl === 'string') {
        token.imageUrl = (detected as any).data.imageUrl;
      }
      await writeTokenMetaCache(chainId, token.address, {
        creatorAddress: token.creatorAddress,
        creatorUrl: (token as any).creatorUrl,
        creatorLabel: (token as any).creatorLabel,
        launchMultiple: token.launchMultiple
      });
      await persistLaunchpad(token as any, 'detector_backfill');
      await delCacheKey(launchpadClearFailKey(chainId, token.address)).catch(() => undefined);
    } catch {
      // Best-effort metadata backfill only.
    }
  })));
}

async function enrichLaunchMultiplesForTrending(
  chainId: string,
  _geckoNetwork: string,
  tokens: Array<{ address: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string; price?: number; launchMultiple?: number; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string }>
): Promise<void> {
  if (!LAUNCH_MULTIPLE_ENRICH_ENABLED) return;
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  await Promise.all(tokens.map(async (token) => {
    const multiple = computeLaunchpadMultiple(chainId, token.launchpad, token.price);
    if (!multiple) {
      delete token.launchMultiple;
      return;
    }
    token.launchMultiple = multiple;
    await writeTokenMetaCache(chainId, token.address, {
      creatorAddress: token.creatorAddress,
      creatorUrl: token.creatorUrl,
      creatorLabel: token.creatorLabel,
      launchMultiple: multiple
    });
  }));
}

const onDemandMultipleInFlight = new Map<string, Promise<void>>();

export async function enrichLaunchMultiplesOnDemand(
  chainId: string,
  tokens: Array<{ address: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string; price?: number; launchMultiple?: number; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string }>
): Promise<void> {
  if (!LAUNCH_MULTIPLE_ENRICH_ENABLED) return;
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  const key = `${chainId}:on_demand`;
  const existing = onDemandMultipleInFlight.get(key);
  if (existing) {
    await existing.catch(() => undefined);
    return;
  }

  const task = (async () => {
    await enrichLaunchMultiplesForTrending(chainId, chainId, tokens);
  })().finally(() => {
    onDemandMultipleInFlight.delete(key);
  });

  onDemandMultipleInFlight.set(key, task);
  await task;
}

// Global rate limiter to prevent API abuse
const apiRateLimiter = {
  geckoTerminal: { lastCall: 0, minInterval: 5000, backoffUntil: 0 },  // 5s minimum interval
  dexScreener: { lastCall: 0, minInterval: 2000 }                        // 2s minimum interval
};

/**
 * Check if GeckoTerminal is currently in backoff period
 */
function isGeckoBackoffActive(): boolean {
  return Date.now() < apiRateLimiter.geckoTerminal.backoffUntil;
}

/**
 * Set GeckoTerminal backoff period (called when 429 is detected)
 */
export function setGeckoBackoff(durationMs: number): void {
  apiRateLimiter.geckoTerminal.backoffUntil = Date.now() + durationMs;
}

/**
 * Refresh trending tokens for a single chain
 * Tries GeckoTerminal first, falls back to DexScreener if needed
 */
import { randomUUID } from 'node:crypto';

/**
 * Refresh trending tokens for a single chain
 * Uses DexScreener Premium (WebSocket) as primary source for accurate trending
 */
// In-memory lock to prevent concurrent refreshes for the same chain
// This prevents race conditions where multiple jobs/API calls try to delete/insert for the same chain simultaneously
const refreshLocks = new Map<string, boolean>();
let refreshPrimaryChainsInProgress = false;
let refreshPrimaryChainsStartedAt = 0;
const LAUNCHPAD_ENRICH_TIMEOUT_MS = Math.max(
  10_000,
  Number(process.env.LAUNCHPAD_ENRICH_TIMEOUT_MS || '25000')
);
const LAUNCH_MULTIPLE_ENRICH_TIMEOUT_MS = Math.max(
  20_000,
  Number(process.env.LAUNCH_MULTIPLE_ENRICH_TIMEOUT_MS || '90000')
);

async function runWithTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T | null> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<{ kind: 'timeout' }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
  });
  const result = await Promise.race([
    task.then((value) => ({ kind: 'ok' as const, value })).catch((error) => ({ kind: 'error' as const, error })),
    timeoutPromise
  ]);
  if (timeoutId) clearTimeout(timeoutId);
  if (result && (result as any).kind === 'timeout') {
    logger.warn(LogCode.API_FETCH_FAILED, `${label} timed out`, { timeoutMs });
    return null;
  }
  if (result && (result as any).kind === 'error') {
    throw (result as any).error;
  }
  return (result as any).value as T;
}

async function refreshChainTokens(chain: typeof SUPPORTED_CHAINS[0], force = false): Promise<void> {
  // Check if a refresh is already in progress for this chain
  if (refreshLocks.get(chain.id)) {
    logger.aggregate(LogCode.SYS_INFO, `Skipping refresh for ${chain.name} - update already in progress`);
    return;
  }

  // Acquire lock
  refreshLocks.set(chain.id, true);
  const lockKey = `lock:tokenJob:refresh:${chain.id}`;
  const lockValue = randomUUID();
  let hasDistributedLock = false;

  try {
    // Distributed lock (prevents multiple replicas from hammering external APIs)
    // TTL slightly less than cron interval.
    hasDistributedLock = await acquireLock(lockKey, 240, lockValue);
    if (!hasDistributedLock) {
      logger.aggregate(LogCode.SYS_INFO, `Skipping refresh for ${chain.name} - another instance holds the lock`);
      return;
    }

    const REFRESH_5M_MS = 4.5 * 60 * 1000; // 4.5 minutes

    // Smart Refresh: Check if we have fresh data in database
    if (!force) {
      const lastUpdate = await getLastUpdateTime(chain.id);
      if (lastUpdate && (Date.now() - lastUpdate.getTime()) < REFRESH_5M_MS) {
        logger.aggregate(LogCode.SYS_INFO, `Tokens for ${chain.name} are fresh, skipping API call`);
        return;
      }
    }

    logger.debug(LogCode.API_FETCH_SUCCESS, `Fetching trending tokens for ${chain.name} via DexScreener Premium...`);

    // Rate limiter for DexScreener
    const now = Date.now();
    const dexDelay = apiRateLimiter.dexScreener.minInterval - (now - apiRateLimiter.dexScreener.lastCall);
    if (dexDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, dexDelay));
    }
    apiRateLimiter.dexScreener.lastCall = Date.now();

    // Use DexScreener Premium (WebSocket-based) as primary source
    const disableGeckoFill = chain.id === 'base' || chain.id === 'bsc';
    let tokens = await getTrendingTokensPremium(chain.id, 100, { disableGeckoFill });

    // Note: GeckoTerminal fallback removed
    // GeckoTerminal is only used for pool price/time data, not token metadata
    // DexScreener provides more complete token data including imageUrl


    if (tokens.length === 0) {
      logger.warn(LogCode.API_FETCH_FAILED, `No tokens found for ${chain.name}`);
      return;
    }

    logger.info(LogCode.API_FETCH_SUCCESS, `Got ${tokens.length} trending tokens for ${chain.name}`);

    // Zero-cost validation: delist non-positive liquidity and obvious malformed entries
    const beforeCount = tokens.length;
    tokens = tokens.filter((t) => validateTrendingTokenForListing(chain.id, t).ok);
    const removed = beforeCount - tokens.length;
    if (removed > 0) {
      logger.info(LogCode.API_FETCH_SUCCESS, `Filtered out ${removed} invalid tokens for ${chain.name}`);
    }

    // Guardrail: avoid replacing good data with a partial refresh (e.g. when rate-limited).
    const existing = await getStoredTrendingTokens(chain.id, TOKENS_PER_CHAIN);
    if (existing.length >= 70 && tokens.length < 50) {
      logger.warn(LogCode.API_FETCH_FAILED, `New list too small (${tokens.length}) for ${chain.name}; keeping existing (${existing.length})`);
      return;
    }
    // Fast deterministic hinting before DB write (cheap, no external calls).
    for (const token of tokens as Array<{
      address: string;
      launchpad?: string;
      websites?: Array<{ url?: string; label?: string }>;
      socials?: Array<{ type?: string; url?: string }>;
      creatorUrl?: string;
      creatorLabel?: string;
      dexId?: string;
      dex?: string;
    }>) {
      if (token.launchpad) continue;
      token.launchpad =
        detectBySuffix(chain.id, token.address)
        || undefined;
    }

    // Capture initial pool snapshot once per token (address/time/liquidity-at-first-seen).
    await cacheInitialPoolSnapshots(
      chain.id,
      tokens as Array<{ address?: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string; liquidity?: number }>
    );

    // Save to PostgreSQL database (best-effort)
    let savedTokens: typeof tokens = [];
    try {
      savedTokens = await saveTrendingTokens(chain.id, tokens);
    } catch (error) {
      logger.error(LogCode.SYS_ERROR, `Failed to save trending tokens for ${chain.name}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    const cachedTokens = savedTokens.length > 0 ? savedTokens : tokens;

    // Memory cache is already updated inside saveTrendingTokens() with merged creator/launchpad data.
    // Only update cache here if saveTrendingTokens failed (savedTokens is empty).
    if (savedTokens.length === 0) {
      const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain.id);
      memoryCache.set(cacheKey, cachedTokens, CACHE_TTL.TRENDING_TOKENS);
    }

    // Also update Redis cache for legacy compatibility
    const redisCacheKey = `trending:live:${chain.id}:5m`;
    try {
      await setRedisCache(redisCacheKey, JSON.stringify(cachedTokens), 600);
    } catch (error) {
      logger.warn(LogCode.API_FETCH_FAILED, `Failed to write cache for ${chain.name}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info(LogCode.SYS_INFO, `Saved ${cachedTokens.length} tokens for ${chain.name} to DB + cache`);

    const runLaunchpadEnrichment = async (): Promise<void> => {
      const result = await runWithTimeout(
        enrichLaunchpadsForTrending(
          chain.id,
          tokens as Array<{ address: string; launchpad?: string; imageUrl?: string; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; launchMultiple?: number; poolAddress?: string; poolCreatedAt?: string; price?: number }>
        ),
        LAUNCHPAD_ENRICH_TIMEOUT_MS,
        `Launchpad enrichment for ${chain.name}`
      );
      if (result === null) return;
      await saveTrendingTokens(chain.id, tokens);
    };

    const runLaunchMultipleEnrichment = async (): Promise<void> => {
      if (!LAUNCH_MULTIPLE_ENRICH_ENABLED) return;
      const result = await runWithTimeout(
        enrichLaunchMultiplesForTrending(
          chain.id,
          chain.geckoNetwork,
          tokens as Array<{ address: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string; price?: number; launchMultiple?: number; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string }>
        ),
        LAUNCH_MULTIPLE_ENRICH_TIMEOUT_MS,
        `Launch multiple enrichment for ${chain.name}`
      );
      if (result === null) return;
      await saveTrendingTokens(chain.id, tokens);
    };

    if (force) {
      // Force refresh is used for manual repair/debug: wait for enrichments so caller sees complete data.
      try {
        await runLaunchpadEnrichment();
      } catch (error) {
        logger.warn(LogCode.API_FETCH_FAILED, `Launchpad enrichment failed for ${chain.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      try {
        await runLaunchMultipleEnrichment();
      } catch (error) {
        logger.warn(LogCode.API_FETCH_FAILED, `Launch multiple enrichment failed for ${chain.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      // Cron mode: keep refresh latency low and run enrichments in background.
      void runLaunchpadEnrichment().catch((error) => {
        logger.warn(LogCode.API_FETCH_FAILED, `Launchpad enrichment failed for ${chain.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      });
      void runLaunchMultipleEnrichment().catch((error) => {
        logger.warn(LogCode.API_FETCH_FAILED, `Launch multiple enrichment failed for ${chain.name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }

  } catch (error) {
    logger.error(LogCode.SYS_ERROR, `Error refreshing ${chain.name}`, { error: error instanceof Error ? error.message : error });
  } finally {
    if (hasDistributedLock) {
      await releaseLock(lockKey, lockValue);
    }
    // Release lock
    refreshLocks.set(chain.id, false);
  }
}

/**
 * Refresh primary chains (ETH, Solana, Base, BSC)
 * Called every 5 minutes
 */
async function refreshPrimaryChains(force = false): Promise<void> {
  if (refreshPrimaryChainsInProgress) {
    logger.warn(LogCode.SYS_INFO, 'Skipping primary chain refresh - previous run still in progress', {
      force,
      runningForSec: Math.round((Date.now() - refreshPrimaryChainsStartedAt) / 1000),
    });
    return;
  }

  refreshPrimaryChainsInProgress = true;
  refreshPrimaryChainsStartedAt = Date.now();
  const startTime = refreshPrimaryChainsStartedAt;

  try {
    for (let i = 0; i < PRIMARY_CHAINS.length; i++) {
      const chain = PRIMARY_CHAINS[i];
      await refreshChainTokens(chain, force);

      // Add delay between chains (串行执行)
      if (i < PRIMARY_CHAINS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, PRIMARY_CHAIN_DELAY_MS));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(LogCode.SYS_INFO, `Refreshed ${PRIMARY_CHAINS.length} primary chains in ${duration}s`);
  } finally {
    refreshPrimaryChainsInProgress = false;
  }
}

/**
 * Refresh secondary chains (Arbitrum, Optimism, Polygon)
 * Called every 4 hours
 */
async function refreshSecondaryChains(force = false): Promise<void> {
  const startTime = Date.now();

  for (let i = 0; i < SECONDARY_CHAINS.length; i++) {
    const chain = SECONDARY_CHAINS[i];
    await refreshChainTokens(chain, force);

    // Add delay between chains (串行执行)
    if (i < SECONDARY_CHAINS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, SECONDARY_CHAIN_DELAY_MS));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(LogCode.SYS_INFO, `Refreshed ${SECONDARY_CHAINS.length} secondary chains in ${duration}s`);
}

/**
 * Refresh a single chain (for targeted refresh)
 */
export async function refreshSingleChain(chainId: string, force = false): Promise<boolean> {
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  if (!chain) {
    logger.error(LogCode.SYS_ERROR, `Unknown chain: ${chainId}`);
    return false;
  }

  const before = await getLastUpdateTime(chain.id);
  await refreshChainTokens(chain, force);
  const after = await getLastUpdateTime(chain.id);
  if (!after) return false;
  if (!before) return true;
  return after.getTime() > before.getTime();
}

/**
 * Get list of supported chains
 */
export function getSupportedChains(): string[] {
  return SUPPORTED_CHAINS.map(c => c.id);
}

/**
 * Initialize and start cron jobs
 */
export function startTokenDataJobs(): void {
  // Primary chains: Every 5 minutes
  cron.schedule(`*/${PRIMARY_REFRESH_INTERVAL_MINUTES} * * * *`, () => refreshPrimaryChains(), {
    timezone: 'UTC',
  });

  // Secondary chains: Every 4 hours
  cron.schedule(`0 */${SECONDARY_REFRESH_INTERVAL_HOURS} * * *`, () => refreshSecondaryChains(), {
    timezone: 'UTC',
  });

  logger.info(LogCode.SYS_INFO, `Scheduled: Primary chains every ${PRIMARY_REFRESH_INTERVAL_MINUTES}min (${PRIMARY_CHAINS.map(c => c.name).join(', ')})`);
  logger.info(LogCode.SYS_INFO, `Scheduled: Secondary chains every ${SECONDARY_REFRESH_INTERVAL_HOURS}h (${SECONDARY_CHAINS.map(c => c.name).join(', ')})`);

  // Run initial refresh on startup (with delay for services to be ready)
  setTimeout(() => {
    logger.info(LogCode.SYS_INFO, 'Starting initial token refresh...');
    refreshPrimaryChains();  // Start with primary chains
    // Secondary chains will wait for their scheduled time
  }, 30000); // Wait 30 seconds for services to be ready
}
