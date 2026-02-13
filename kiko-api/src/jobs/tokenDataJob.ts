/**
 * Token Data Refresh Job
 * Runs periodically to fetch and store trending tokens for multiple chains
 * 
 * Supported chains: Ethereum, Base, BSC, Arbitrum
 * Uses GeckoTerminal (free) as primary source, DexScreener as fallback
 */

import cron from 'node-cron';
import { getTrendingTokens } from '../services/geckoTerminal.js';
import { getTrendingTokensPremium, getCandlestickData as getDexCandlestickData, getTokenPairsByAddress, getTokenDetails as getDexTokenDetails } from '../services/dexscreener.js';
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
import { getCandlestickData as getGeckoCandlestickData } from '../services/geckoTerminal.js';
import { acquireLock, releaseLock, set as setRedisCache, get as getRedisCache } from '../cache/redis.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { ethers } from 'ethers';
import { getChainConfig } from '../config/chainConfig.js';
import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';
import { getNativeTokenPriceUsd } from '../services/onChainPriceService.js';
import { computeLaunchpadMultiple } from '../services/launchpadMultipleService.js';
import prisma from '../db/prisma.js';
import { Prisma } from '@prisma/client';

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
  8,
  Number(process.env.LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN || '24')
);
const LAUNCH_MULTIPLE_BUDGET_PER_RUN = Math.max(
  4,
  Number(process.env.LAUNCH_MULTIPLE_BUDGET_PER_RUN || '8')
);
const LAUNCH_MULTIPLE_BASELINE_ONLY = String(process.env.LAUNCH_MULTIPLE_BASELINE_ONLY || 'true').toLowerCase() === 'true';
const LAUNCH_MULTIPLE_ALLOW_SYNTHETIC_BASELINE = String(process.env.LAUNCH_MULTIPLE_ALLOW_SYNTHETIC_BASELINE || 'true').toLowerCase() === 'true';
const LAUNCH_MULTIPLE_USE_GECKO_FALLBACK = String(process.env.LAUNCH_MULTIPLE_USE_GECKO_FALLBACK || 'false').toLowerCase() === 'true';
const GECKO_CANDLE_MIN_INTERVAL_MS = Math.max(
  1200,
  Number(process.env.GECKO_CANDLE_MIN_INTERVAL_MS || '2400')
);
const LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN = Math.max(
  8,
  Number(process.env.LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN || '24')
);
const LAUNCHPAD_CREATOR_DISCOVERY_BUDGET_PER_RUN = Math.max(
  6,
  Number(process.env.LAUNCHPAD_CREATOR_DISCOVERY_BUDGET_PER_RUN || '18')
);
const TOKEN_META_CACHE_TTL_SECONDS = Math.max(
  60 * 60,
  Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`)
);
const TOKEN_BASELINE_CACHE_TTL_SECONDS = Math.max(
  24 * 60 * 60,
  Number(process.env.TOKEN_BASELINE_CACHE_TTL_SECONDS || `${7 * 24 * 60 * 60}`)
);
const BASELINE_EXTERNAL_FETCH_BUDGET_PER_RUN = Math.max(
  6,
  Number(process.env.BASELINE_EXTERNAL_FETCH_BUDGET_PER_RUN || '120')
);
const BASELINE_EXTERNAL_RETRY_TTL_SECONDS = Math.max(
  2 * 60,
  Number(process.env.BASELINE_EXTERNAL_RETRY_TTL_SECONDS || `${10 * 60}`)
);
const GECKO_CANDLE_BACKOFF_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.GECKO_CANDLE_BACKOFF_MS || `${15 * 60 * 1000}`)
);

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

function detectByMetadata(
  chainId: string,
  token: {
    websites?: Array<{ url?: string; label?: string }>;
    socials?: Array<{ type?: string; url?: string }>;
    creatorUrl?: string;
    creatorLabel?: string;
    dexId?: string;
    dex?: string;
  }
): string | null {
  if (chainId !== 'base') return null;

  const hints: string[] = [];
  for (const w of token.websites || []) {
    if (w?.url) hints.push(String(w.url).toLowerCase());
    if (w?.label) hints.push(String(w.label).toLowerCase());
  }
  for (const s of token.socials || []) {
    if (s?.type) hints.push(String(s.type).toLowerCase());
    if (s?.url) hints.push(String(s.url).toLowerCase());
  }
  if (token.creatorUrl) hints.push(String(token.creatorUrl).toLowerCase());
  if (token.creatorLabel) hints.push(String(token.creatorLabel).toLowerCase());
  if (token.dexId) hints.push(String(token.dexId).toLowerCase());
  if (token.dex) hints.push(String(token.dex).toLowerCase());

  const merged = hints.join(' ');
  if (!merged) return null;

  // Doppler tokens usually expose doppler domains/labels in metadata.
  if (
    merged.includes('doppler.lol')
    || merged.includes('doppler finance')
    || merged.includes('dopplerfinance')
    || merged.includes(' doppler ')
  ) {
    return 'doppler';
  }

  return null;
}

function normalizeLaunchpad(provider?: string | null): string | null {
  if (!provider) return null;
  if (provider === 'pumpfun') return 'pump.fun';
  if (provider === 'bonkfun') return 'bonk.fun';
  if (provider === 'fourmeme') return 'four.meme';
  if (provider === 'doppler finance' || provider === 'dopplerfinance') return 'doppler';
  return provider;
}

type EnrichedTokenMeta = {
  creatorAddress?: string;
  creatorUrl?: string;
  creatorLabel?: string;
  launchMultiple?: number;
  updatedAt?: number;
};

type TokenBaselineMeta = {
  baselinePrice: number;
  firstSeenAt: number;
  baselineSource?: string;
};

type BaselineFetchFailureReason =
  | 'rpc_history_pruned'
  | 'rpc_rate_limited'
  | 'rpc_method_unavailable'
  | 'rpc_block_range_limited'
  | 'sol_rpc_rate_limited'
  | 'sol_rpc_method_unavailable'
  | 'sol_rpc_access_denied'
  | 'sol_rpc_non_json';

class BaselineFetchFailure extends Error {
  readonly reason: BaselineFetchFailureReason;
  readonly cooldownSeconds: number;

  constructor(reason: BaselineFetchFailureReason, message: string, cooldownSeconds: number) {
    super(message);
    this.reason = reason;
    this.cooldownSeconds = cooldownSeconds;
    this.name = 'BaselineFetchFailure';
  }
}

type EvmRpcProbeStats = {
  historyPruned: number;
  rateLimited: number;
  methodUnavailable: number;
  blockRangeLimited: number;
  other: number;
};

type SolRpcProbeStats = {
  rateLimited: number;
  methodUnavailable: number;
  accessDenied: number;
  nonJson: number;
  network: number;
};

type ExternalBaselineResult = {
  price: number;
  source: string;
  blockNumber?: number;
  txHash?: string;
  poolAddress?: string;
  nativeUsd?: number;
  quotedAt?: Date;
};

type BaselinePoolCandidate = {
  poolAddress: string;
  poolCreatedAt?: string;
  liquidityUsd?: number;
};
const TRUSTED_BASELINE_SOURCES = [
  'rpc_stable_first_swap',
  'rpc_native_first_swap',
  'rpc_v4_initialize',
  'solana_public_rpc',
  'bsc_token_manager_purchase'
] as const;
const multipleEnrichmentInFlight = new Map<string, Promise<void>>();

const geckoCandleBackoffByChain = new Map<string, number>();
let geckoNextCandleAtMs = 0;
const poolCandidatesCache = new Map<string, { items: BaselinePoolCandidate[]; expiresAt: number }>();
const historicalNativeUsdByDate = new Map<string, number>();
const missingHistoricalNativeUsdUntil = new Map<string, number>();
const NATIVE_USD_MISS_TTL_SECONDS = Math.max(
  30 * 60,
  Number(process.env.NATIVE_USD_MISS_TTL_SECONDS || `${6 * 60 * 60}`)
);
const RPC_LOG_MAX_BLOCK_RANGE = Math.max(
  200,
  Number(process.env.RPC_LOG_MAX_BLOCK_RANGE || '500')
);
const SOL_RPC_SIGNATURE_PAGE_LIMIT = Math.max(
  100,
  Number(process.env.SOL_RPC_SIGNATURE_PAGE_LIMIT || '250')
);
const SOL_RPC_SIGNATURE_MAX_PAGES = Math.max(
  2,
  Number(process.env.SOL_RPC_SIGNATURE_MAX_PAGES || '10')
);
const SOL_RPC_EARLIEST_CANDIDATES = Math.max(
  1,
  Number(process.env.SOL_RPC_EARLIEST_CANDIDATES || '3')
);
const SOL_RPC_MAX_SIGNATURES_TO_INSPECT = Math.max(
  20,
  Number(process.env.SOL_RPC_MAX_SIGNATURES_TO_INSPECT || '250')
);
const SOL_RPC_MIN_INTERVAL_MS = Math.max(
  150,
  Number(process.env.SOL_RPC_MIN_INTERVAL_MS || '400')
);
const SOL_RPC_MIN_QUOTE_USD = Math.max(
  0,
  Number(process.env.SOL_RPC_MIN_QUOTE_USD || '0')
);
const SOL_RPC_MIN_TARGET_AMOUNT = Math.max(
  0,
  Number(process.env.SOL_RPC_MIN_TARGET_AMOUNT || '100')
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
      try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), '0', 1); } catch {}
      return px;
    }
    // Unexpected non-error empty price: avoid hammering the same date repeatedly.
    const until = now + NATIVE_USD_MISS_TTL_SECONDS * 1000;
    missingHistoricalNativeUsdUntil.set(key, until);
    try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), String(until), NATIVE_USD_MISS_TTL_SECONDS); } catch {}
  } catch {
    // Failed historical fetch: cache miss for a while to avoid repeated 404/rate-not-found storms.
    const until = now + NATIVE_USD_MISS_TTL_SECONDS * 1000;
    missingHistoricalNativeUsdUntil.set(key, until);
    try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), String(until), NATIVE_USD_MISS_TTL_SECONDS); } catch {}
  }

  // Only use spot as fallback when the requested date is recent (within 48h).
  // For older dates, spot price can be wildly different and would corrupt baselines.
  const ageSec = Math.abs(Date.now() / 1000 - Number(tsSec));
  if (ageSec <= 48 * 3600) {
    const spot = await getNativeTokenPriceUsd(chainId);
    if (Number.isFinite(spot) && spot > 0) {
      historicalNativeUsdByDate.set(key, spot);
      missingHistoricalNativeUsdUntil.delete(key);
      try { await setRedisCache(nativeUsdMissCacheKey(chainId, date), '0', 1); } catch {}
      return spot;
    }
  } else {
    console.warn(`[getNativeUsdOnDate] Coinbase historical price unavailable for ${symbol} on ${date}, age=${(ageSec / 3600).toFixed(0)}h — skipping spot fallback to avoid baseline corruption`);
  }
  return null;
}

async function waitForGeckoCandleSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, geckoNextCandleAtMs - now);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  geckoNextCandleAtMs = Date.now() + GECKO_CANDLE_MIN_INTERVAL_MS;
}

function isRateLimitError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests');
}

function tokenMetaCacheKey(chainId: string, address: string): string {
  return `token:meta:v2:${chainId}:${address.toLowerCase()}`;
}

function tokenMetaLegacyCacheKey(chainId: string, address: string): string {
  return `token:meta:v1:${chainId}:${address.toLowerCase()}`;
}

function tokenBaselineCacheKey(chainId: string, address: string): string {
  return `token:baseline:v1:${chainId}:${address.toLowerCase()}`;
}

function tokenBaselineRetryKey(chainId: string, address: string): string {
  return `token:baseline:retry:v1:${chainId}:${address.toLowerCase()}`;
}

function initialPoolCacheKey(chainId: string, address: string): string {
  return `token:initial_pool:v2:${chainId}:${address.toLowerCase()}`;
}

function buildAddressVariants(addresses: string[]): string[] {
  const out = new Set<string>();
  for (const raw of addresses) {
    const v = String(raw || '').trim();
    if (!v) continue;
    out.add(v);
    out.add(v.toLowerCase());
  }
  return Array.from(out);
}

function geckoCandleBackoffKey(chainId: string): string {
  return `token:meta:candle_backoff:v1:${chainId}`;
}

function nativeUsdMissCacheKey(chainId: number, date: string): string {
  return `token:native_usd:miss:v1:${chainId}:${date}`;
}

async function readGeckoCandleBackoff(chainId: string): Promise<number> {
  const mem = geckoCandleBackoffByChain.get(chainId) || 0;
  if (Date.now() < mem) return mem;

  try {
    const raw = await getRedisCache(geckoCandleBackoffKey(chainId));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { until?: number };
    const until = Number(parsed?.until || 0);
    if (Number.isFinite(until) && until > Date.now()) {
      geckoCandleBackoffByChain.set(chainId, until);
      return until;
    }
  } catch {
    // ignore
  }

  return 0;
}

async function writeGeckoCandleBackoff(chainId: string, until: number): Promise<void> {
  geckoCandleBackoffByChain.set(chainId, until);
  try {
    const ttl = Math.max(60, Math.ceil((until - Date.now()) / 1000));
    await setRedisCache(geckoCandleBackoffKey(chainId), JSON.stringify({ until }), ttl);
  } catch {
    // ignore
  }
}

async function readTokenMetaCache(chainId: string, address: string): Promise<EnrichedTokenMeta | null> {
  try {
    let raw = await getRedisCache(tokenMetaCacheKey(chainId, address));
    let fromLegacy = false;
    if (!raw) {
      raw = await getRedisCache(tokenMetaLegacyCacheKey(chainId, address));
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

async function readTokenBaselineCache(chainId: string, address: string): Promise<TokenBaselineMeta | null> {
  const key = tokenBaselineCacheKey(chainId, address);
  try {
    const raw = await getRedisCache(key);
    if (raw) {
      const parsed = JSON.parse(raw) as TokenBaselineMeta;
      const baselinePrice = Number(parsed?.baselinePrice || 0);
      const firstSeenAt = Number(parsed?.firstSeenAt || 0);
      const baselineSource = typeof parsed?.baselineSource === 'string' ? parsed.baselineSource : undefined;
      if (Number.isFinite(baselinePrice) && baselinePrice > 0 && Number.isFinite(firstSeenAt) && firstSeenAt > 0) {
        return { baselinePrice, firstSeenAt, baselineSource };
      }
    }
  } catch {
    // fallback to DB below
  }

  try {
    const row = await prisma.tokenLaunchBaseline.findUnique({
      where: {
        chain_address: {
          chain: chainId,
          address: address.toLowerCase(),
        },
      },
      select: {
        baselinePrice: true,
        baselineSource: true,
        firstSeenAt: true,
      },
    });

    const baselinePrice = Number(row?.baselinePrice || 0);
    const firstSeenAt = row?.firstSeenAt ? row.firstSeenAt.getTime() : 0;
    const baselineSource = row?.baselineSource || undefined;
    if (!Number.isFinite(baselinePrice) || baselinePrice <= 0 || !Number.isFinite(firstSeenAt) || firstSeenAt <= 0) {
      return null;
    }

    // warm Redis cache from DB source of truth
    await setRedisCache(
      key,
      JSON.stringify({ baselinePrice, firstSeenAt, baselineSource }),
      TOKEN_BASELINE_CACHE_TTL_SECONDS
    );
    return { baselinePrice, firstSeenAt, baselineSource };
  } catch {
    return null;
  }
}

async function writeTokenBaselineCache(
  chainId: string,
  address: string,
  baselinePrice: number,
  baselineSource: string = 'unknown',
  meta?: {
    blockNumber?: number;
    txHash?: string;
    poolAddress?: string;
    nativeUsd?: number;
    quotedAt?: Date;
  }
): Promise<void> {
  if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) return;
  const lower = address.toLowerCase();
  const now = Date.now();
  const incomingIsDisplayTrusted = isDisplayTrustedBaselineSource(baselineSource);

  // Stabilize baseline:
  // 1) Never downgrade a display-trusted baseline to weaker sources.
  // 2) Prefer higher-confidence sources; allow same-source replacement only when
  //    prior value is likely poisoned by old parser behavior.
  try {
    const existing = await prisma.tokenLaunchBaseline.findUnique({
      where: {
        chain_address: { chain: chainId, address: lower },
      },
      select: {
        baselinePrice: true,
        baselineSource: true,
        firstSeenAt: true,
      },
    });
    const existingPrice = Number(existing?.baselinePrice || 0);
    const existingSource = String(existing?.baselineSource || '');
    const existingIsDisplayTrusted = isDisplayTrustedBaselineSource(existingSource);
    if (existingIsDisplayTrusted && !incomingIsDisplayTrusted) return;
    if (Number.isFinite(existingPrice) && existingPrice > 0) {
      const existingRank = baselineSourceRank(existingSource);
      const incomingRank = baselineSourceRank(baselineSource);
      if (incomingRank < existingRank) return;
      if (incomingRank === existingRank) {
        if (existingSource !== baselineSource) return;
        const ratio = Math.max(existingPrice / baselinePrice, baselinePrice / existingPrice);
        const canSelfHealSameSource = (
          baselineSource === 'rpc_stable_first_swap'
          || baselineSource === 'rpc_native_first_swap'
          || baselineSource === 'rpc_v4_initialize'
          || baselineSource === 'solana_public_rpc'
          || baselineSource === 'bsc_token_manager_purchase'
        );
        if (!(canSelfHealSameSource && Number.isFinite(ratio) && ratio >= 3)) {
          return;
        }
      }
    }
  } catch {
    // best-effort guard; continue with write path below
  }

  const status = isDisplayTrustedBaselineSource(baselineSource) ? 'verified' : 'pending';
  try {
    await setRedisCache(
      tokenBaselineCacheKey(chainId, lower),
      JSON.stringify({ baselinePrice, firstSeenAt: now, baselineSource }),
      TOKEN_BASELINE_CACHE_TTL_SECONDS
    );
  } catch {
    // ignore cache write errors
  }

  try {
    await prisma.tokenLaunchBaseline.upsert({
      where: {
        chain_address: {
          chain: chainId,
          address: lower,
        },
      },
      update: {
        baselinePrice,
        baselineSource,
        status,
        baselineBlockNumber: Number.isFinite(Number(meta?.blockNumber || 0)) ? BigInt(Number(meta?.blockNumber || 0)) : null,
        baselineTxHash: meta?.txHash || null,
        baselinePoolAddress: meta?.poolAddress || null,
        baselineNativeUsd: Number.isFinite(Number(meta?.nativeUsd || 0)) && Number(meta?.nativeUsd || 0) > 0 ? Number(meta?.nativeUsd || 0) : null,
        baselineQuotedAt: meta?.quotedAt || null,
        lastCheckedAt: new Date(now),
        lastError: null,
      },
      create: {
        chain: chainId,
        address: lower,
        baselinePrice,
        baselineSource,
        status,
        baselineBlockNumber: Number.isFinite(Number(meta?.blockNumber || 0)) ? BigInt(Number(meta?.blockNumber || 0)) : null,
        baselineTxHash: meta?.txHash || null,
        baselinePoolAddress: meta?.poolAddress || null,
        baselineNativeUsd: Number.isFinite(Number(meta?.nativeUsd || 0)) && Number(meta?.nativeUsd || 0) > 0 ? Number(meta?.nativeUsd || 0) : null,
        baselineQuotedAt: meta?.quotedAt || null,
        firstSeenAt: new Date(now),
        lastCheckedAt: new Date(now),
      },
    });
  } catch {
    // keep refresh resilient even when DB upsert fails
  }
}

function isTrustedBaselineSource(source?: string): boolean {
  return source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize'
    || source === 'solana_public_rpc'
    || source === 'bsc_token_manager_purchase';
}

function baselineSourceRank(source?: string): number {
  if (!source) return 0;
  if (
    source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize'
    || source === 'solana_public_rpc'
    || source === 'bsc_token_manager_purchase'
  ) return 4;
  return 0;
}

function isDisplayTrustedBaselineSource(source?: string): boolean {
  return source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize'
    || source === 'solana_public_rpc'
    || source === 'bsc_token_manager_purchase';
}

/**
 * Centralized sanity check for launch multiples.
 * Caps absurd values based on pool age to prevent wrong baseline prices
 * from producing misleading "x999999" display values.
 * Returns sanitized multiple or null if the value is too suspicious to display.
 */
function sanitizeMultiple(
  multipleRaw: number,
  poolCreatedAt?: string,
  opts?: { chainId?: string; source?: string; address?: string }
): number | null {
  if (!Number.isFinite(multipleRaw) || multipleRaw <= 0) return null;

  const createdMs = poolCreatedAt ? Date.parse(poolCreatedAt) : NaN;
  const ageHours = Number.isFinite(createdMs) && createdMs > 0
    ? Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60))
    : NaN;

  // Age-based maximum allowed multiple.
  // Even the most explosive memecoins rarely exceed these bounds legitimately.
  let allowedMax: number;
  if (!Number.isFinite(ageHours)) {
    allowedMax = 50_000; // unknown age — generous but not infinite
  } else if (ageHours <= 1) {
    allowedMax = 50;
  } else if (ageHours <= 6) {
    allowedMax = 200;
  } else if (ageHours <= 24) {
    allowedMax = 1_000;
  } else if (ageHours <= 7 * 24) {
    allowedMax = 10_000;
  } else if (ageHours <= 30 * 24) {
    allowedMax = 50_000;
  } else {
    allowedMax = 200_000;
  }

  const multiple = multipleRaw;

  if (multiple > allowedMax) {
    console.warn(
      `[LaunchMultiple] Suspicious multiple x${multiple.toFixed(1)} (max allowed x${allowedMax} for age ${Number.isFinite(ageHours) ? ageHours.toFixed(1) + 'h' : 'unknown'}) ` +
      `chain=${opts?.chainId || '?'} addr=${opts?.address?.slice(0, 10) || '?'} source=${opts?.source || '?'} — suppressed`
    );
    return null;
  }

  return multiple;
}

async function readBaselineRetryCooldown(chainId: string, address: string): Promise<boolean> {
  try {
    const raw = await getRedisCache(tokenBaselineRetryKey(chainId, address));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { until?: number };
    const until = Number(parsed?.until || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

async function writeBaselineRetryCooldown(
  chainId: string,
  address: string,
  ttlSeconds: number = BASELINE_EXTERNAL_RETRY_TTL_SECONDS
): Promise<void> {
  const safeTtl = Math.max(60, Math.floor(ttlSeconds));
  try {
    const until = Date.now() + safeTtl * 1000;
    await setRedisCache(
      tokenBaselineRetryKey(chainId, address),
      JSON.stringify({ until }),
      safeTtl
    );
  } catch {
    // ignore
  }

  try {
    const lower = address.toLowerCase();
    const until = new Date(Date.now() + safeTtl * 1000);
    await prisma.tokenLaunchBaseline.upsert({
      where: {
        chain_address: {
          chain: chainId,
          address: lower,
        },
      },
      update: {
        retryAfter: until,
        status: 'pending',
        attempts: { increment: 1 },
        lastCheckedAt: new Date(),
      },
      create: {
        chain: chainId,
        address: lower,
        status: 'pending',
        retryAfter: until,
        attempts: 1,
        firstSeenAt: new Date(),
        lastCheckedAt: new Date(),
      },
    });
  } catch {
    // ignore
  }
}

async function writeBaselineAttemptError(
  chainId: string,
  address: string,
  message: string,
  poolAddress?: string
): Promise<void> {
  try {
    const lower = address.toLowerCase();
    await prisma.tokenLaunchBaseline.upsert({
      where: {
        chain_address: {
          chain: chainId,
          address: lower,
        },
      },
      update: {
        lastError: message.slice(0, 400),
        lastCheckedAt: new Date(),
        baselinePoolAddress: poolAddress || undefined,
      },
      create: {
        chain: chainId,
        address: lower,
        status: 'pending',
        firstSeenAt: new Date(),
        lastCheckedAt: new Date(),
        lastError: message.slice(0, 400),
        baselinePoolAddress: poolAddress || undefined,
      },
    });
  } catch {
    // best-effort only
  }
}

async function ensureBaselineTrackingRows(
  chainId: string,
  tokens: Array<{ address?: string }>
): Promise<void> {
  try {
    const addresses = Array.from(new Set(tokens.map((t) => String(t.address || '').toLowerCase()).filter(Boolean)));
    if (addresses.length === 0) return;
    const existing = await prisma.tokenLaunchBaseline.findMany({
      where: {
        chain: chainId,
        address: { in: addresses },
      },
      select: { address: true },
    });
    const existingSet = new Set(existing.map((r) => r.address.toLowerCase()));
    const toCreate = addresses.filter((a) => !existingSet.has(a));
    if (toCreate.length === 0) return;
    await prisma.tokenLaunchBaseline.createMany({
      data: toCreate.map((address) => ({
        chain: chainId,
        address,
        status: 'pending',
        firstSeenAt: new Date(),
        lastCheckedAt: new Date(),
      })),
      skipDuplicates: true,
    });
  } catch {
    // non-blocking tracking path
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
      const existing = await getRedisCache(key);
      let existingParsed: any = null;
      if (existing) {
        try { existingParsed = JSON.parse(existing); } catch {}
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

function toIsoMaybe(ts?: number): string | undefined {
  if (!Number.isFinite(Number(ts)) || Number(ts) <= 0) return undefined;
  return new Date(Number(ts)).toISOString();
}

function cacheKeyForPoolCandidates(chainId: string, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

async function getBaselinePoolCandidates(
  chainId: string,
  tokenAddress?: string,
  primaryPoolAddress?: string,
  primaryPoolCreatedAt?: string
): Promise<BaselinePoolCandidate[]> {
  if (!tokenAddress) {
    return primaryPoolAddress ? [{ poolAddress: primaryPoolAddress, poolCreatedAt: primaryPoolCreatedAt }] : [];
  }

  if (!primaryPoolAddress) {
    try {
      const initialRaw = await getRedisCache(initialPoolCacheKey(chainId, tokenAddress));
      if (initialRaw) {
        const parsed = JSON.parse(initialRaw) as {
          initialPoolAddress?: string;
          initialPoolCreatedAt?: string;
        };
        if (typeof parsed?.initialPoolAddress === 'string' && parsed.initialPoolAddress.trim()) {
          primaryPoolAddress = parsed.initialPoolAddress.trim();
        }
        if (typeof parsed?.initialPoolCreatedAt === 'string' && parsed.initialPoolCreatedAt.trim()) {
          primaryPoolCreatedAt = parsed.initialPoolCreatedAt.trim();
        }
      }
    } catch {
      // best effort only
    }
  }

  const key = cacheKeyForPoolCandidates(chainId, tokenAddress);
  const cached = poolCandidatesCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const unique = new Map<string, BaselinePoolCandidate>();
  let hadDexFailure = false;

  if (primaryPoolAddress) {
    unique.set(primaryPoolAddress.toLowerCase(), {
      poolAddress: primaryPoolAddress,
      poolCreatedAt: primaryPoolCreatedAt,
    });
  }

  try {
    const pairs = await getTokenPairsByAddress(chainId, tokenAddress);
    for (const pair of pairs) {
      const poolAddress = String(pair?.pairAddress || '').trim();
      if (!poolAddress) continue;
      const lower = poolAddress.toLowerCase();
      const existing = unique.get(lower);
      const next: BaselinePoolCandidate = {
        poolAddress,
        poolCreatedAt: toIsoMaybe(pair?.pairCreatedAt),
        liquidityUsd: Number(pair?.liquidityUsd || 0) || undefined,
      };
      if (!existing) {
        unique.set(lower, next);
        continue;
      }

      // Merge metadata with preference to earlier created time and higher liquidity.
      const merged: BaselinePoolCandidate = {
        poolAddress: existing.poolAddress || next.poolAddress,
        poolCreatedAt: existing.poolCreatedAt || next.poolCreatedAt,
        liquidityUsd: Math.max(Number(existing.liquidityUsd || 0), Number(next.liquidityUsd || 0)) || undefined,
      };
      if (existing.poolCreatedAt && next.poolCreatedAt) {
        merged.poolCreatedAt = new Date(existing.poolCreatedAt).getTime() <= new Date(next.poolCreatedAt).getTime()
          ? existing.poolCreatedAt
          : next.poolCreatedAt;
      }
      unique.set(lower, merged);
    }
  } catch {
    hadDexFailure = true;
  }

  // Fallback: token-details endpoint occasionally returns pool info
  // even when pair search is rate-limited or sparse.
  if (!primaryPoolAddress && unique.size === 0) {
    try {
      const details = await getDexTokenDetails(chainId, tokenAddress);
      const poolAddress = String(details?.poolAddress || '').trim();
      if (poolAddress) {
        unique.set(poolAddress.toLowerCase(), {
          poolAddress,
          poolCreatedAt: toIsoMaybe(details?.pairCreatedAt),
        });
      }
    } catch {
      hadDexFailure = true;
    }
  }

  const items = Array.from(unique.values())
    .sort((a, b) => {
      const aCreated = a.poolCreatedAt ? Date.parse(a.poolCreatedAt) : Number.POSITIVE_INFINITY;
      const bCreated = b.poolCreatedAt ? Date.parse(b.poolCreatedAt) : Number.POSITIVE_INFINITY;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return Number(b.liquidityUsd || 0) - Number(a.liquidityUsd || 0);
    })
    .slice(0, 14);

  const ttlMs = (hadDexFailure || items.length === 0)
    ? 60 * 1000
    : 2 * 60 * 60 * 1000;
  poolCandidatesCache.set(key, { items, expiresAt: Date.now() + ttlMs });
  return items;
}

async function fetchExternalBaselinePrice(
  chainId: string,
  geckoNetwork: string,
  token: { address?: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string }
): Promise<ExternalBaselineResult | null> {
  const candidates = await getBaselinePoolCandidates(
      chainId,
      token.address,
      token.poolAddress,
      token.poolCreatedAt
  );
  if (candidates.length === 0) return null;

  let lastFailure: BaselineFetchFailure | null = null;
  for (const pool of candidates) {
    try {
      const result = await fetchExternalBaselinePriceForPool(chainId, geckoNetwork, token.address, token.launchpad, pool);
      if (result && Number.isFinite(result.price) && result.price > 0) {
        return result;
      }
    } catch (error) {
      if (error instanceof BaselineFetchFailure) {
        lastFailure = error;
        continue;
      }
      throw error;
    }
  }

  if (lastFailure) throw lastFailure;
  return null;
}

export async function probeTokenBaselineViaRpc(
  chainId: string,
  token: { address?: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string }
): Promise<ExternalBaselineResult | null> {
  const normalizedChain = String(chainId || '').toLowerCase();
  const geckoNetwork = normalizedChain === 'ethereum' ? 'eth' : normalizedChain;
  return fetchExternalBaselinePrice(normalizedChain, geckoNetwork, token);
}

async function fetchExternalBaselinePriceForPool(
  chainId: string,
  geckoNetwork: string,
  tokenAddress: string | undefined,
  launchpad: string | undefined,
  pool: BaselinePoolCandidate
): Promise<ExternalBaselineResult | null> {
  void geckoNetwork;
  if (!pool.poolAddress) return null;

  // Solana: RPC first swap is more reliable for baseline than candle windows.
  if (chainId === 'solana') {
      const solRpcBaseline = await fetchSolanaRpcBaselineUsd(tokenAddress, pool.poolAddress, pool.poolCreatedAt);
    if (typeof solRpcBaseline === 'number' && Number.isFinite(solRpcBaseline) && solRpcBaseline > 0) {
      return { price: solRpcBaseline, source: 'solana_public_rpc', poolAddress: pool.poolAddress };
    }
  }

  // 1) EVM: RPC first-swap / v4 initialize baseline only.
  if (chainId !== 'solana') {
    const rpcAttempts = Math.max(1, Number(process.env.BASELINE_EVM_RPC_ATTEMPTS || '3'));
    for (let i = 0; i < rpcAttempts; i++) {
      const rpcBaseline = await fetchRpcStableSwapBaselineUsd(chainId, tokenAddress, pool.poolAddress, pool.poolCreatedAt);
      if (rpcBaseline && Number.isFinite(rpcBaseline.price) && rpcBaseline.price > 0) {
        return rpcBaseline;
      }
    }
  }

  // 2) Solana fallback from public RPC (2nd chance).
  if (chainId === 'solana') {
    const solRpcBaseline = await fetchSolanaRpcBaselineUsd(tokenAddress, pool.poolAddress, pool.poolCreatedAt);
    if (typeof solRpcBaseline === 'number' && Number.isFinite(solRpcBaseline) && solRpcBaseline > 0) {
      return { price: solRpcBaseline, source: 'solana_public_rpc', poolAddress: pool.poolAddress };
    }
  }

  return null;
}

const CHAIN_SLUG_TO_ID: Record<string, number> = {
  eth: 1,
  base: 8453,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
};

const publicProviderCache = new Map<string, ethers.JsonRpcProvider>();
const publicRpcCursorByChain = new Map<string, number>();
const solRpcBackoffUntilByUrl = new Map<string, number>();
const solRpcLastCallByUrl = new Map<string, number>();
let solRpcRoundRobinCursor = 0;

function getPublicRpcUrl(chainSlug: string): string | null {
  const urls = getPublicRpcUrls(chainSlug);
  if (urls.length === 0) return null;
  const cursor = publicRpcCursorByChain.get(chainSlug) || 0;
  const idx = cursor % urls.length;
  publicRpcCursorByChain.set(chainSlug, (idx + 1) % urls.length);
  return urls[idx] || null;
}

function getPublicRpcUrls(chainSlug: string): string[] {
  try {
    // Safety-first default: baseline/multiple pipeline must stay on free RPC unless explicitly opted in.
    const includePremium = String(process.env.BASELINE_INCLUDE_PREMIUM_RPC || 'false').toLowerCase() === 'true';
    const endpoints = getRpcEndpointsWithStrategy(chainSlug, 'cheap');
    const urls = endpoints
      .filter((ep) => !!ep.url && (includePremium || ep.type === 'public' || ep.type === 'fallback'))
      .map((ep) => ep.url.trim())
      .filter(Boolean);
    return Array.from(new Set(urls));
  } catch {
    return [];
  }
}

function getPublicEvmProvider(chainSlug: string): ethers.JsonRpcProvider | null {
  const url = getPublicRpcUrl(chainSlug);
  if (!url) return null;
  const cacheKey = `${chainSlug}:${url}`;
  const cached = publicProviderCache.get(cacheKey);
  if (cached) return cached;
  const chainId = CHAIN_SLUG_TO_ID[chainSlug];
  const provider = new ethers.JsonRpcProvider(url, Number.isFinite(chainId) ? chainId : undefined, { staticNetwork: true });
  publicProviderCache.set(cacheKey, provider);
  return provider;
}

const PAIR_IFACE = new ethers.Interface([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
]);

const ERC20_IFACE = new ethers.Interface([
  'function decimals() view returns (uint8)',
]);

const V2_SWAP_TOPIC = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
const V3_SWAP_TOPIC = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');
const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const V4_INIT_TOPIC = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');

const V2_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)',
]);

const V3_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)',
]);
const FOURMEME_V2_IFACE = new ethers.Interface([
  'event TokenPurchase(address token,address account,uint256 price,uint256 amount,uint256 cost,uint256 fee,uint256 offers,uint256 funds)',
]);
const FOURMEME_V1_IFACE = new ethers.Interface([
  'event TokenPurchase(address token,address account,uint256 tokenAmount,uint256 etherAmount)',
]);
const ERC20_TRANSFER_IFACE = new ethers.Interface([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
]);
const V4_INIT_IFACE = new ethers.Interface([
  'event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)',
]);

const V4_POOL_MANAGER_BY_CHAIN_ID: Partial<Record<number, string>> = {
  1: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  8453: '0x498581ff718922c3f8e6a244956af099b2652b2b',
};

const V4_INIT_FROM_BLOCK_BY_CHAIN_ID: Partial<Record<number, number>> = {
  1: 21688329,
  8453: 41642655,
};
const FOURMEME_TOKEN_MANAGER_V2 = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
const FOURMEME_TOKEN_MANAGER_V1 = '0xec4549cadce5da21df6e6422d448034b5233bfbc';
const FOURMEME_PURCHASE_V2_TOPIC = ethers.id('TokenPurchase(address,address,uint256,uint256,uint256,uint256,uint256,uint256)');
const FOURMEME_PURCHASE_V1_TOPIC = ethers.id('TokenPurchase(address,address,uint256,uint256)');

function isHexPoolId(value?: string): boolean {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function pow10BigInt(exp: number): bigint {
  if (!Number.isFinite(exp) || exp < 0) return 1n;
  let out = 1n;
  for (let i = 0; i < exp; i++) out *= 10n;
  return out;
}

function priceToken1PerToken0FromSqrt(
  sqrtPriceX96: bigint,
  dec0: number,
  dec1: number
): number | null {
  if (sqrtPriceX96 <= 0n || !Number.isFinite(dec0) || !Number.isFinite(dec1)) return null;
  const q192 = 1n << 192n;
  const scale = 18;
  const numerator = sqrtPriceX96 * sqrtPriceX96 * pow10BigInt(Math.max(0, dec0) + scale);
  const denominator = q192 * pow10BigInt(Math.max(0, dec1));
  if (denominator <= 0n) return null;
  const scaled = numerator / denominator;
  const value = Number(ethers.formatUnits(scaled, scale));
  return Number.isFinite(value) && value > 0 ? value : null;
}


async function readAddressCall(provider: ethers.JsonRpcProvider, to: string, iface: ethers.Interface, fn: string): Promise<string | null> {
  try {
    const data = iface.encodeFunctionData(fn);
    const raw = await provider.call({ to, data });
    const decoded = iface.decodeFunctionResult(fn, raw);
    const addr = String(decoded?.[0] || '');
    return ethers.isAddress(addr) ? addr.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function readTokenDecimals(provider: ethers.JsonRpcProvider, token: string): Promise<number | null> {
  try {
    const data = ERC20_IFACE.encodeFunctionData('decimals');
    const raw = await provider.call({ to: token, data });
    const decoded = ERC20_IFACE.decodeFunctionResult('decimals', raw);
    const v = Number(decoded?.[0]);
    return Number.isFinite(v) && v >= 0 && v <= 30 ? v : null;
  } catch {
    return null;
  }
}

function absBig(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function quotePerToken(targetRaw: bigint, quoteRaw: bigint, targetDecimals: number, quoteDecimals: number): number | null {
  if (targetRaw <= 0n || quoteRaw <= 0n) return null;
  try {
    const target = Number(ethers.formatUnits(targetRaw, targetDecimals));
    const quote = Number(ethers.formatUnits(quoteRaw, quoteDecimals));
    if (!Number.isFinite(target) || !Number.isFinite(quote) || target <= 0 || quote <= 0) return null;
    const p = quote / target;
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

function estimateStartBlockByTime(chainSlug: string, latestBlock: number, latestTsSec: number, createdTsSec: number): number {
  const avgBlockSec: Record<string, number> = {
    eth: 12,
    base: 2,
    bsc: 3,
    arbitrum: 1,
    optimism: 2,
    polygon: 2,
  };
  const secPerBlock = avgBlockSec[chainSlug] || 3;
  const deltaSec = Math.max(0, latestTsSec - createdTsSec);
  const deltaBlocks = Math.floor(deltaSec / secPerBlock);
  return Math.max(1, latestBlock - deltaBlocks);
}

function estimateBlocksForSeconds(chainSlug: string, windowSec: number): number {
  const avgBlockSec: Record<string, number> = {
    eth: 12,
    base: 2,
    bsc: 3,
    arbitrum: 1,
    optimism: 2,
    polygon: 2,
  };
  const secPerBlock = avgBlockSec[chainSlug] || 3;
  return Math.max(100, Math.floor(windowSec / secPerBlock));
}

const timestampBlockHintCache = new Map<string, number>();

async function findBlockByTimestamp(
  provider: ethers.JsonRpcProvider,
  chainSlug: string,
  targetTsSec: number,
  latestBlock: number,
  latestTsSec: number
): Promise<number | null> {
  if (!Number.isFinite(targetTsSec) || targetTsSec <= 0 || !Number.isFinite(latestBlock) || latestBlock <= 0) {
    return null;
  }
  const key = `${chainSlug}:${toUtcDate(targetTsSec)}`;
  const cached = timestampBlockHintCache.get(key);
  if (Number.isFinite(cached || NaN) && (cached || 0) > 0) return Number(cached);

  if (targetTsSec >= latestTsSec) {
    timestampBlockHintCache.set(key, latestBlock);
    return latestBlock;
  }

  let low = 1;
  let high = latestBlock;
  let best = 1;

  for (let i = 0; i < 26 && low <= high; i++) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid).catch(() => null);
    const ts = Number(block?.timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) {
      // fallback to linear shrink on RPC hiccup
      high = mid - 1;
      continue;
    }
    if (ts <= targetTsSec) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const resolved = Math.max(1, best);
  timestampBlockHintCache.set(key, resolved);
  return resolved;
}

type FirstSwapData = {
  targetRaw: bigint;
  quoteRaw: bigint;
  blockNumber: number;
  txHash?: string;
};

const EVM_BASELINE_MIN_QUOTE_USD = Math.max(0, Number(process.env.EVM_BASELINE_MIN_QUOTE_USD || '0'));
const EVM_BASELINE_MAX_CANDIDATE_SWAPS = Math.max(5, Number(process.env.EVM_BASELINE_MAX_CANDIDATE_SWAPS || '40'));
const EVM_BASELINE_FALLBACK_MAX_SWAPS = Math.max(10, Number(process.env.EVM_BASELINE_FALLBACK_MAX_SWAPS || '50'));
const EVM_BASELINE_FALLBACK_WINDOW_SECONDS = Math.max(600, Number(process.env.EVM_BASELINE_FALLBACK_WINDOW_SECONDS || '1800'));
const BSC_RECEIPT_SCAN_MAX_BLOCKS = Math.max(3000, Number(process.env.BSC_RECEIPT_SCAN_MAX_BLOCKS || '15000'));
const BSC_RECEIPT_SCAN_MAX_TX_PER_BLOCK = Math.max(20, Number(process.env.BSC_RECEIPT_SCAN_MAX_TX_PER_BLOCK || '220'));
const BSC_RECEIPT_SCAN_CONCURRENCY = Math.max(1, Number(process.env.BSC_RECEIPT_SCAN_CONCURRENCY || '12'));

function parseFirstSwapLog(
  log: ethers.Log,
  target: string,
  token0: string,
  token1: string
): { targetRaw: bigint; quoteRaw: bigint } | null {
  // Baseline should be anchored to the first BUY of target token:
  // target out, quote in. Avoid using early sells/dust flips as launch price.
  if (log.topics[0] === V2_SWAP_TOPIC) {
    const parsed = V2_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return null;
    const amount0In = BigInt(parsed.args.amount0In.toString());
    const amount1In = BigInt(parsed.args.amount1In.toString());
    const amount0Out = BigInt(parsed.args.amount0Out.toString());
    const amount1Out = BigInt(parsed.args.amount1Out.toString());

    if (target === token0) {
      // BUY token0 => token0 out, token1 in
      if (amount0Out > 0n && amount1In > 0n) return { targetRaw: amount0Out, quoteRaw: amount1In };
      return null;
    }

    // BUY token1 => token1 out, token0 in
    if (amount1Out > 0n && amount0In > 0n) return { targetRaw: amount1Out, quoteRaw: amount0In };
    return null;
  }

  if (log.topics[0] === V3_SWAP_TOPIC) {
    const parsed = V3_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return null;
    const amount0 = BigInt(parsed.args.amount0.toString());
    const amount1 = BigInt(parsed.args.amount1.toString());
    // In Uniswap V3 event amounts are pool deltas:
    // >0 token in to pool, <0 token out from pool.
    if (target === token0) {
      if (amount0 < 0n && amount1 > 0n) return { targetRaw: absBig(amount0), quoteRaw: amount1 };
      return null;
    }
    if (amount1 < 0n && amount0 > 0n) return { targetRaw: absBig(amount1), quoteRaw: amount0 };
    return null;
  }

  return null;
}

function parseAnySwapLog(
  log: ethers.Log,
  target: string,
  token0: string,
  token1: string
): { targetRaw: bigint; quoteRaw: bigint } | null {
  if (log.topics[0] === V2_SWAP_TOPIC) {
    const parsed = V2_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return null;
    const amount0In = BigInt(parsed.args.amount0In.toString());
    const amount1In = BigInt(parsed.args.amount1In.toString());
    const amount0Out = BigInt(parsed.args.amount0Out.toString());
    const amount1Out = BigInt(parsed.args.amount1Out.toString());
    if (target === token0) {
      const targetAbs = amount0Out > 0n ? amount0Out : amount0In;
      const quoteAbs = amount0Out > 0n ? amount1In : amount1Out;
      return targetAbs > 0n && quoteAbs > 0n ? { targetRaw: targetAbs, quoteRaw: quoteAbs } : null;
    }
    const targetAbs = amount1Out > 0n ? amount1Out : amount1In;
    const quoteAbs = amount1Out > 0n ? amount0In : amount0Out;
    return targetAbs > 0n && quoteAbs > 0n ? { targetRaw: targetAbs, quoteRaw: quoteAbs } : null;
  }

  if (log.topics[0] === V3_SWAP_TOPIC) {
    const parsed = V3_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return null;
    const amount0Abs = absBig(BigInt(parsed.args.amount0.toString()));
    const amount1Abs = absBig(BigInt(parsed.args.amount1.toString()));
    if (amount0Abs <= 0n || amount1Abs <= 0n) return null;
    if (target === token0) return { targetRaw: amount0Abs, quoteRaw: amount1Abs };
    return { targetRaw: amount1Abs, quoteRaw: amount0Abs };
  }

  return null;
}

function shouldSplitLogRange(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('query returned more than')
    || msg.includes('too many results')
    || msg.includes('limit exceeded')
    || msg.includes('block range')
    || msg.includes('response size exceeded');
}

function classifyEvmRpcError(message: string): BaselineFetchFailureReason | null {
  const msg = String(message || '').toLowerCase();
  if (!msg) return null;
  if (msg.includes('history has been pruned') || msg.includes('pruned for this block')) return 'rpc_history_pruned';
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) return 'rpc_rate_limited';
  if (msg.includes('method not found') || msg.includes('method is not available') || msg.includes('unsupported method')) return 'rpc_method_unavailable';
  if (msg.includes('block range') || msg.includes('range') && msg.includes('limit exceeded') || msg.includes('exceed maximum block range')) return 'rpc_block_range_limited';
  return null;
}

function recordEvmRpcError(stats: EvmRpcProbeStats | undefined, error: unknown): void {
  if (!stats) return;
  const msg = String((error as any)?.message || error || '');
  const reason = classifyEvmRpcError(msg);
  if (reason === 'rpc_history_pruned') stats.historyPruned += 1;
  else if (reason === 'rpc_rate_limited') stats.rateLimited += 1;
  else if (reason === 'rpc_method_unavailable') stats.methodUnavailable += 1;
  else if (reason === 'rpc_block_range_limited') stats.blockRangeLimited += 1;
  else stats.other += 1;
}

async function getLogsAdaptive(
  provider: ethers.JsonRpcProvider,
  params: { address?: string; topics?: Array<string | Array<string> | null>; fromBlock: number; toBlock: number },
  minChunk: number = 40,
  stats?: EvmRpcProbeStats
): Promise<ethers.Log[]> {
  const out: ethers.Log[] = [];
  const stack: Array<{ from: number; to: number }> = [{ from: params.fromBlock, to: params.toBlock }];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.to < cur.from) continue;
    try {
      const logs = await provider.getLogs({
        address: params.address,
        topics: params.topics,
        fromBlock: cur.from,
        toBlock: cur.to,
      });
      if (Array.isArray(logs) && logs.length > 0) out.push(...logs);
    } catch (error) {
      recordEvmRpcError(stats, error);
      const span = cur.to - cur.from + 1;
      if (span > minChunk && shouldSplitLogRange(error)) {
        const mid = Math.floor((cur.from + cur.to) / 2);
        stack.push({ from: cur.from, to: mid });
        stack.push({ from: mid + 1, to: cur.to });
      }
    }
  }
  return out;
}

async function findBuySwapSamples(
  provider: ethers.JsonRpcProvider,
  chainSlug: string,
  poolAddress: string,
  createdSec: number,
  target: string,
  token0: string,
  token1: string,
  stats?: EvmRpcProbeStats
): Promise<FirstSwapData[]> {
  const latest = await provider.getBlock('latest');
  if (!latest || !Number.isFinite(Number(latest.number)) || !Number.isFinite(Number(latest.timestamp))) return [];
  const latestBlock = Number(latest.number);
  const latestTs = Number(latest.timestamp);
  const binaryStart = await findBlockByTimestamp(provider, chainSlug, createdSec, latestBlock, latestTs);
  const startBlock = binaryStart && Number.isFinite(binaryStart) && binaryStart > 0
    ? binaryStart
    : estimateStartBlockByTime(chainSlug, latestBlock, latestTs, createdSec);
  const ranges: Array<{ from: number; to: number }> = [
    { from: Math.max(1, startBlock - 2000), to: startBlock + 20000 },
    { from: Math.max(1, startBlock - 20000), to: startBlock + 150000 },
    { from: Math.max(1, startBlock - 80000), to: startBlock + 400000 },
  ];
  const out: FirstSwapData[] = [];
  const seen = new Set<string>();

  for (const r of ranges) {
    for (let from = r.from; from <= r.to; from += RPC_LOG_MAX_BLOCK_RANGE) {
      const to = Math.min(r.to, from + RPC_LOG_MAX_BLOCK_RANGE - 1);
      const [v2Logs, v3Logs] = await Promise.all([
        getLogsAdaptive(provider, { address: poolAddress, topics: [V2_SWAP_TOPIC], fromBlock: from, toBlock: to }, 40, stats),
        getLogsAdaptive(provider, { address: poolAddress, topics: [V3_SWAP_TOPIC], fromBlock: from, toBlock: to }, 40, stats),
      ]);

      const logs = [...v2Logs, ...v3Logs].sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        return Number(a.index) - Number(b.index);
      });
      for (const log of logs) {
        const parsed = parseFirstSwapLog(log, target, token0, token1);
        if (!parsed) continue;
        const key = `${log.blockNumber}:${Number(log.index)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...parsed, blockNumber: Number(log.blockNumber), txHash: (log as any).transactionHash || undefined });
        if (out.length >= EVM_BASELINE_MAX_CANDIDATE_SWAPS) {
          return out.sort((a, b) => a.blockNumber - b.blockNumber);
        }
      }
    }
  }

  if (out.length > 0) return out.sort((a, b) => a.blockNumber - b.blockNumber);

  // Last chance: use first swap in absolute terms (buy/sell agnostic).
  if (out.length === 0) {
    try {
      for (const r of ranges) {
        for (let from = r.from; from <= r.to; from += RPC_LOG_MAX_BLOCK_RANGE) {
          const to = Math.min(r.to, from + RPC_LOG_MAX_BLOCK_RANGE - 1);
          const [v2Logs, v3Logs] = await Promise.all([
            getLogsAdaptive(provider, { address: poolAddress, topics: [V2_SWAP_TOPIC], fromBlock: from, toBlock: to }, 40, stats),
            getLogsAdaptive(provider, { address: poolAddress, topics: [V3_SWAP_TOPIC], fromBlock: from, toBlock: to }, 40, stats),
          ]);
          const logs = [...v2Logs, ...v3Logs].sort((a, b) => {
            if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
            return Number(a.index) - Number(b.index);
          });
          for (const log of logs) {
            const parsed = parseAnySwapLog(log, target, token0, token1);
            if (!parsed) continue;
            const key = `${log.blockNumber}:${Number(log.index)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ ...parsed, blockNumber: Number(log.blockNumber), txHash: (log as any).transactionHash || undefined });
            if (out.length >= EVM_BASELINE_MAX_CANDIDATE_SWAPS) {
              return out.sort((a, b) => a.blockNumber - b.blockNumber);
            }
          }
        }
      }
    } catch {
      // best-effort only
    }
  }

  return out.sort((a, b) => a.blockNumber - b.blockNumber);
}

async function findBuyTransferSamples(
  provider: ethers.JsonRpcProvider,
  chainSlug: string,
  poolAddress: string,
  createdSec: number,
  targetToken: string,
  quoteToken: string,
  stats?: EvmRpcProbeStats
): Promise<FirstSwapData[]> {
  const latest = await provider.getBlock('latest').catch(() => null);
  if (!latest || !Number.isFinite(Number(latest.number)) || !Number.isFinite(Number(latest.timestamp))) return [];
  const latestBlock = Number(latest.number);
  const latestTs = Number(latest.timestamp);
  const binaryStart = await findBlockByTimestamp(provider, chainSlug, createdSec, latestBlock, latestTs);
  const startBlock = binaryStart && Number.isFinite(binaryStart) && binaryStart > 0
    ? binaryStart
    : estimateStartBlockByTime(chainSlug, latestBlock, latestTs, createdSec);

  const poolLower = poolAddress.toLowerCase();
  const poolTopic = ethers.zeroPadValue(poolAddress as `0x${string}`, 32).toLowerCase();
  const ranges: Array<{ from: number; to: number }> = [
    { from: Math.max(1, startBlock - 2000), to: startBlock + 20000 },
    { from: Math.max(1, startBlock - 20000), to: startBlock + 150000 },
    { from: Math.max(1, startBlock - 80000), to: startBlock + 400000 },
  ];
  const out: FirstSwapData[] = [];
  const seenTx = new Set<string>();

  for (const r of ranges) {
    for (let from = r.from; from <= r.to; from += RPC_LOG_MAX_BLOCK_RANGE) {
      const to = Math.min(r.to, from + RPC_LOG_MAX_BLOCK_RANGE - 1);
      const targetOutLogs = await getLogsAdaptive(
        provider,
        {
          address: targetToken,
          topics: [ERC20_TRANSFER_TOPIC, poolTopic],
          fromBlock: from,
          toBlock: to,
        },
        40,
        stats
      );

      for (const log of targetOutLogs.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        return Number(a.index) - Number(b.index);
      })) {
        const txHash = String((log as any).transactionHash || '').toLowerCase();
        if (!txHash || seenTx.has(txHash)) continue;
        seenTx.add(txHash);
        const targetRaw = BigInt(log.data || '0x0');
        if (targetRaw <= 0n) continue;

        const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
        if (!receipt || !Array.isArray(receipt.logs)) continue;

        let quoteRaw = 0n;
        for (const rl of receipt.logs as any[]) {
          if (String(rl?.address || '').toLowerCase() !== quoteToken) continue;
          if (!Array.isArray(rl?.topics) || String(rl.topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC.toLowerCase()) continue;
          try {
            const parsed = ERC20_TRANSFER_IFACE.parseLog({ topics: rl.topics, data: rl.data });
            const fromAddr = String(parsed?.args?.from || '').toLowerCase();
            const toAddr = String(parsed?.args?.to || '').toLowerCase();
            const amount = BigInt(parsed?.args?.value?.toString?.() || '0');
            if (amount <= 0n) continue;
            // Buy path: quote token flows into pool from non-pool address.
            if (toAddr === poolLower && fromAddr !== poolLower && amount > quoteRaw) {
              quoteRaw = amount;
            }
          } catch {
            continue;
          }
        }

        if (quoteRaw <= 0n) continue;
        out.push({
          targetRaw,
          quoteRaw,
          blockNumber: Number(log.blockNumber),
          txHash: String((log as any).transactionHash || undefined),
        });
        if (out.length >= EVM_BASELINE_MAX_CANDIDATE_SWAPS) {
          return out.sort((a, b) => a.blockNumber - b.blockNumber);
        }
      }
    }
  }

  return out.sort((a, b) => a.blockNumber - b.blockNumber);
}

async function findEarlyAnySwapSamples(
  provider: ethers.JsonRpcProvider,
  chainSlug: string,
  poolAddress: string,
  createdSec: number,
  target: string,
  token0: string,
  token1: string,
  stats?: EvmRpcProbeStats
): Promise<FirstSwapData[]> {
  const latest = await provider.getBlock('latest').catch(() => null);
  if (!latest || !Number.isFinite(Number(latest.number)) || !Number.isFinite(Number(latest.timestamp))) return [];
  const latestBlock = Number(latest.number);
  const latestTs = Number(latest.timestamp);
  const binaryStart = await findBlockByTimestamp(provider, chainSlug, createdSec, latestBlock, latestTs);
  const startBlock = binaryStart && Number.isFinite(binaryStart) && binaryStart > 0
    ? binaryStart
    : estimateStartBlockByTime(chainSlug, latestBlock, latestTs, createdSec);

  const windowBlocks = estimateBlocksForSeconds(chainSlug, EVM_BASELINE_FALLBACK_WINDOW_SECONDS);
  const fromBlock = Math.max(1, startBlock - 300);
  const toBlock = Math.max(fromBlock, startBlock + windowBlocks + 500);
  const out: FirstSwapData[] = [];
  const seen = new Set<string>();

  for (let from = fromBlock; from <= toBlock; from += RPC_LOG_MAX_BLOCK_RANGE) {
    const to = Math.min(toBlock, from + RPC_LOG_MAX_BLOCK_RANGE - 1);
    const [v2Logs, v3Logs] = await Promise.all([
      getLogsAdaptive(provider, { address: poolAddress, topics: [V2_SWAP_TOPIC], fromBlock: from, toBlock: to }, 40, stats),
      getLogsAdaptive(provider, { address: poolAddress, topics: [V3_SWAP_TOPIC], fromBlock: from, toBlock: to }, 40, stats),
    ]);
    const logs = [...v2Logs, ...v3Logs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return Number(a.index) - Number(b.index);
    });
    for (const log of logs) {
      const parsed = parseAnySwapLog(log, target, token0, token1);
      if (!parsed) continue;
      const key = `${log.blockNumber}:${Number(log.index)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...parsed,
        blockNumber: Number(log.blockNumber),
        txHash: (log as any).transactionHash || undefined,
      });
      if (out.length >= EVM_BASELINE_FALLBACK_MAX_SWAPS) {
        return out.sort((a, b) => a.blockNumber - b.blockNumber);
      }
    }
  }

  return out.sort((a, b) => a.blockNumber - b.blockNumber);
}

async function findBuySwapSamplesByReceipts(
  provider: ethers.JsonRpcProvider,
  chainSlug: string,
  poolAddress: string,
  createdSec: number,
  target: string,
  token0: string,
  token1: string
): Promise<FirstSwapData[]> {
  const latest = await provider.getBlock('latest').catch(() => null);
  if (!latest || !Number.isFinite(Number(latest.number)) || !Number.isFinite(Number(latest.timestamp))) return [];
  const latestBlock = Number(latest.number);
  const latestTs = Number(latest.timestamp);
  const binaryStart = await findBlockByTimestamp(provider, chainSlug, createdSec, latestBlock, latestTs);
  const startBlock = binaryStart && Number.isFinite(binaryStart) && binaryStart > 0
    ? binaryStart
    : estimateStartBlockByTime(chainSlug, latestBlock, latestTs, createdSec);

  const fromBlock = Math.max(1, startBlock - 500);
  const toBlock = Math.min(latestBlock, startBlock + BSC_RECEIPT_SCAN_MAX_BLOCKS);
  const poolLower = poolAddress.toLowerCase();
  const out: FirstSwapData[] = [];
  const seen = new Set<string>();
  const receiptLimiter = pLimit(BSC_RECEIPT_SCAN_CONCURRENCY);

  for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
    const block = await provider.getBlock(blockNumber).catch(() => null);
    const txs = Array.isArray(block?.transactions) ? block.transactions.slice(0, BSC_RECEIPT_SCAN_MAX_TX_PER_BLOCK) : [];
    if (txs.length === 0) continue;

    const receipts = await Promise.all(
      txs.map((hash) =>
        receiptLimiter(() => provider.getTransactionReceipt(String(hash)).catch(() => null))
      )
    );

    for (const receipt of receipts) {
      if (!receipt || !Array.isArray((receipt as any).logs)) continue;
      for (const rawLog of (receipt as any).logs as Array<ethers.Log>) {
        if (String((rawLog as any)?.address || '').toLowerCase() !== poolLower) continue;
        const topic0 = String((rawLog as any)?.topics?.[0] || '').toLowerCase();
        if (topic0 !== V2_SWAP_TOPIC.toLowerCase() && topic0 !== V3_SWAP_TOPIC.toLowerCase()) continue;
        const parsed = parseFirstSwapLog(rawLog, target, token0, token1) || parseAnySwapLog(rawLog, target, token0, token1);
        if (!parsed) continue;
        const key = `${Number((rawLog as any).blockNumber)}:${Number((rawLog as any).index)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          ...parsed,
          blockNumber: Number((rawLog as any).blockNumber),
          txHash: String((rawLog as any).transactionHash || (receipt as any).hash || ''),
        });
        if (out.length >= EVM_BASELINE_FALLBACK_MAX_SWAPS) {
          return out.sort((a, b) => a.blockNumber - b.blockNumber);
        }
      }
    }
  }

  return out.sort((a, b) => a.blockNumber - b.blockNumber);
}

async function fetchBscTokenManagerPurchaseBaselineUsd(
  provider: ethers.JsonRpcProvider,
  targetToken: string,
  createdSec: number
): Promise<ExternalBaselineResult | null> {
  const target = targetToken.toLowerCase();
  const decimalsMaybe = await readTokenDecimals(provider, target);
  if (!Number.isFinite(decimalsMaybe)) return null;
  const tokenDecimals = Number(decimalsMaybe);
  const nowSec = Math.floor(Date.now() / 1000);
  const anchorSec = Number.isFinite(createdSec) && createdSec > 0 ? createdSec : nowSec;
  const latest = await provider.getBlock('latest').catch(() => null);
  const latestBlock = Number(latest?.number || 0);
  const latestTs = Number(latest?.timestamp || 0);
  if (!latestBlock || !latestTs) return null;

  const startHint = await findBlockByTimestamp(provider, 'bsc', anchorSec, latestBlock, latestTs);
  const anchorBlock = startHint && Number.isFinite(startHint) && startHint > 0
    ? startHint
    : estimateStartBlockByTime('bsc', latestBlock, latestTs, anchorSec);

  const windows = [
    { before: estimateBlocksForSeconds('bsc', 12 * 60 * 60), after: estimateBlocksForSeconds('bsc', 36 * 60 * 60) },
    { before: estimateBlocksForSeconds('bsc', 3 * 24 * 60 * 60), after: estimateBlocksForSeconds('bsc', 7 * 24 * 60 * 60) },
  ];

  type Candidate = { priceUsd: number; blockNumber: number; txHash?: string; nativeUsd?: number; quotedAt?: Date };
  const candidates: Candidate[] = [];

  const managers: Array<{ address: string; topic: string; kind: 'v1' | 'v2' }> = [
    { address: FOURMEME_TOKEN_MANAGER_V2, topic: FOURMEME_PURCHASE_V2_TOPIC, kind: 'v2' },
    { address: FOURMEME_TOKEN_MANAGER_V1, topic: FOURMEME_PURCHASE_V1_TOPIC, kind: 'v1' },
  ];

  for (const w of windows) {
    const fromBound = Math.max(1, anchorBlock - w.before);
    const toBound = Math.min(latestBlock, anchorBlock + w.after);

    for (const manager of managers) {
      for (let from = fromBound; from <= toBound; from += RPC_LOG_MAX_BLOCK_RANGE) {
        const to = Math.min(toBound, from + RPC_LOG_MAX_BLOCK_RANGE - 1);
        const logs = await provider.getLogs({
          address: manager.address,
          topics: [manager.topic],
          fromBlock: from,
          toBlock: to,
        }).catch(() => [] as ethers.Log[]);

        for (const log of logs) {
          try {
            if (manager.kind === 'v2') {
              const parsed = FOURMEME_V2_IFACE.parseLog({ topics: log.topics, data: log.data });
              if (!parsed) continue;
              const eventToken = String(parsed.args.token || '').toLowerCase();
              if (eventToken !== target) continue;
              const amount = BigInt(parsed.args.amount?.toString?.() || '0');
              const cost = BigInt(parsed.args.cost?.toString?.() || '0');
              if (amount <= 0n || cost <= 0n) continue;
              const quotePerTargetNative = quotePerToken(amount, cost, tokenDecimals, 18);
              if (!quotePerTargetNative) continue;
              const blk = await provider.getBlock(Number(log.blockNumber)).catch(() => null);
              const ts = Number(blk?.timestamp || 0);
              const nativeUsd = await getNativeUsdOnDate(56, ts);
              if (!nativeUsd || !Number.isFinite(nativeUsd) || nativeUsd <= 0) continue;
              const priceUsd = quotePerTargetNative * nativeUsd;
              if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;
              candidates.push({
                priceUsd,
                blockNumber: Number(log.blockNumber),
                txHash: (log as any).transactionHash || undefined,
                nativeUsd: Number(nativeUsd),
                quotedAt: ts > 0 ? new Date(ts * 1000) : undefined,
              });
              continue;
            }

            const parsed = FOURMEME_V1_IFACE.parseLog({ topics: log.topics, data: log.data });
            if (!parsed) continue;
            const eventToken = String(parsed.args.token || '').toLowerCase();
            if (eventToken !== target) continue;
            const tokenAmount = BigInt(parsed.args.tokenAmount?.toString?.() || '0');
            const etherAmount = BigInt(parsed.args.etherAmount?.toString?.() || '0');
            if (tokenAmount <= 0n || etherAmount <= 0n) continue;
            const quotePerTargetNative = quotePerToken(tokenAmount, etherAmount, tokenDecimals, 18);
            if (!quotePerTargetNative) continue;
            const blk = await provider.getBlock(Number(log.blockNumber)).catch(() => null);
            const ts = Number(blk?.timestamp || 0);
            const nativeUsd = await getNativeUsdOnDate(56, ts);
            if (!nativeUsd || !Number.isFinite(nativeUsd) || nativeUsd <= 0) continue;
            const priceUsd = quotePerTargetNative * nativeUsd;
            if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;
            candidates.push({
              priceUsd,
              blockNumber: Number(log.blockNumber),
              txHash: (log as any).transactionHash || undefined,
              nativeUsd: Number(nativeUsd),
              quotedAt: ts > 0 ? new Date(ts * 1000) : undefined,
            });
          } catch {
            continue;
          }

          if (candidates.length >= EVM_BASELINE_FALLBACK_MAX_SWAPS) break;
        }
        if (candidates.length >= EVM_BASELINE_FALLBACK_MAX_SWAPS) break;
      }
      if (candidates.length >= EVM_BASELINE_FALLBACK_MAX_SWAPS) break;
    }
    if (candidates.length > 0) break;
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.blockNumber - b.blockNumber || a.priceUsd - b.priceUsd);
  const prices = candidates.map((c) => c.priceUsd).sort((a, b) => a - b);
  const medianPrice = prices[Math.floor(prices.length / 2)];
  const first = candidates[0];

  return {
    price: medianPrice,
    source: 'bsc_token_manager_purchase',
    blockNumber: first?.blockNumber,
    txHash: first?.txHash,
    poolAddress: FOURMEME_TOKEN_MANAGER_V2,
    nativeUsd: first?.nativeUsd,
    quotedAt: first?.quotedAt,
  };
}

async function fetchRpcStableSwapBaselineUsd(
  chainSlug: string,
  tokenAddress?: string,
  poolAddress?: string,
  poolCreatedAt?: string
): Promise<ExternalBaselineResult | null> {
  if (!tokenAddress || !poolAddress) return null;
  const chainId = CHAIN_SLUG_TO_ID[chainSlug];
  if (!chainId) return null;

  const createdSecRaw = poolCreatedAt ? Math.floor(Date.parse(poolCreatedAt) / 1000) : 0;
  const createdSec = Number.isFinite(createdSecRaw) && createdSecRaw > 0 ? createdSecRaw : 0;

  const provider = getPublicEvmProvider(chainSlug);
  if (!provider) return null;
  const rpcStats: EvmRpcProbeStats = {
    historyPruned: 0,
    rateLimited: 0,
    methodUnavailable: 0,
    blockRangeLimited: 0,
    other: 0,
  };

  // Uniswap v4 poolId path (0x + 64 hex), common on Base.
  if (!ethers.isAddress(poolAddress) && isHexPoolId(poolAddress)) {
    const poolId = String(poolAddress).toLowerCase();
    const poolManager = V4_POOL_MANAGER_BY_CHAIN_ID[chainId];
    if (!poolManager) return null;
    const topicPoolId = ethers.zeroPadValue(poolId as `0x${string}`, 32);
    const latest = await provider.getBlock('latest').catch(() => null);
    const latestBlock = Number(latest?.number || 0);
    const latestTs = Number(latest?.timestamp || 0);
    if (!latestBlock || !latestTs) return null;
    const fromGenesis = V4_INIT_FROM_BLOCK_BY_CHAIN_ID[chainId] || Math.max(1, latestBlock - 2_000_000);

    const estimatedStart = createdSec > 0
      ? Math.max(fromGenesis, latestBlock - Math.floor(Math.max(0, latestTs - createdSec) / (chainSlug === 'eth' ? 12 : 2)))
      : Math.max(fromGenesis, latestBlock - 20_000);

    const windows: Array<{ from: number; to: number }> = [
      { from: Math.max(fromGenesis, estimatedStart - 250), to: estimatedStart + 250 },
      { from: Math.max(fromGenesis, estimatedStart - 750), to: estimatedStart - 251 },
      { from: estimatedStart + 251, to: estimatedStart + 750 },
      { from: Math.max(fromGenesis, estimatedStart - 1250), to: estimatedStart - 751 },
      { from: estimatedStart + 751, to: estimatedStart + 1250 },
    ];

    let logs: ethers.Log[] = [];
    for (const w of windows) {
      if (w.to <= w.from) continue;
      const chunk = await provider.getLogs({
        address: poolManager,
        topics: [V4_INIT_TOPIC, topicPoolId],
        fromBlock: w.from,
        toBlock: w.to,
      }).catch(() => [] as ethers.Log[]);
      if (chunk.length > 0) {
        logs = chunk;
        break;
      }
    }
    if (logs.length === 0) return null;
    const initLog = logs[0];
    const parsed = V4_INIT_IFACE.parseLog({ topics: initLog.topics, data: initLog.data });
    if (!parsed) return null;

    const wrapped = getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
    const rawCurrency0 = String(parsed.args.currency0 || '').toLowerCase();
    const rawCurrency1 = String(parsed.args.currency1 || '').toLowerCase();
    const currency0 = rawCurrency0 === ethers.ZeroAddress.toLowerCase() ? wrapped : rawCurrency0;
    const currency1 = rawCurrency1 === ethers.ZeroAddress.toLowerCase() ? wrapped : rawCurrency1;
    const sqrtPriceX96 = BigInt(parsed.args.sqrtPriceX96?.toString?.() || '0');
    if (!ethers.isAddress(currency0) || !ethers.isAddress(currency1) || sqrtPriceX96 <= 0n) return null;

    const [dec0Maybe, dec1Maybe] = await Promise.all([
      readTokenDecimals(provider, currency0),
      readTokenDecimals(provider, currency1),
    ]);
    if (!Number.isFinite(dec0Maybe) || !Number.isFinite(dec1Maybe)) return null;
    const dec0 = Number(dec0Maybe);
    const dec1 = Number(dec1Maybe);
    const price1Per0 = priceToken1PerToken0FromSqrt(sqrtPriceX96, dec0, dec1);
    if (!price1Per0) return null;

    const target = tokenAddress.toLowerCase();
    if (target !== currency0 && target !== currency1) return null;
    const quoteToken = target === currency0 ? currency1 : currency0;

    const stablecoins = new Set((getChainConfig(chainId).stablecoins || []).map((x) => x.toLowerCase()));
    let quoteUsd = 0;
    if (stablecoins.has(quoteToken)) {
      quoteUsd = 1;
    } else {
      if (quoteToken !== wrapped) return null;
      const initBlock = await provider.getBlock(Number(initLog.blockNumber)).catch(() => null);
      const initTs = Number(initBlock?.timestamp || 0);
      quoteUsd = Number(await getNativeUsdOnDate(chainId, initTs) || 0);
    }
    if (!Number.isFinite(quoteUsd) || quoteUsd <= 0) return null;

    const quotePerTarget = target === currency0 ? price1Per0 : 1 / price1Per0;
    if (!Number.isFinite(quotePerTarget) || quotePerTarget <= 0) return null;
    const px = quotePerTarget * quoteUsd;
    if (!Number.isFinite(px) || px <= 0) return null;
    const initBlock = await provider.getBlock(Number(initLog.blockNumber)).catch(() => null);
    return {
      price: px,
      source: 'rpc_v4_initialize',
      blockNumber: Number(initLog.blockNumber),
      txHash: (initLog as any).transactionHash || undefined,
      poolAddress,
      nativeUsd: quoteToken === wrapped ? quoteUsd : undefined,
      quotedAt: initBlock ? new Date(Number(initBlock.timestamp || 0) * 1000) : undefined,
    };
  }

  const [token0, token1] = await Promise.all([
    readAddressCall(provider, poolAddress, PAIR_IFACE, 'token0'),
    readAddressCall(provider, poolAddress, PAIR_IFACE, 'token1'),
  ]);
  if (!token0 || !token1) return null;

  const target = tokenAddress.toLowerCase();
  if (target !== token0 && target !== token1) return null;

  const stablecoins = new Set(
    (getChainConfig(chainId).stablecoins || []).map((x) => x.toLowerCase())
  );
  const quoteToken = target === token0 ? token1 : token0;

  const [targetDecimalsMaybe, quoteDecimalsMaybe] = await Promise.all([
    readTokenDecimals(provider, target),
    readTokenDecimals(provider, quoteToken),
  ]);
  if (!Number.isFinite(targetDecimalsMaybe) || !Number.isFinite(quoteDecimalsMaybe)) return null;
  const targetDecimals = Number(targetDecimalsMaybe);
  const quoteDecimals = Number(quoteDecimalsMaybe);

  let buySwaps = await findBuySwapSamples(
    provider,
    chainSlug,
    poolAddress,
    createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
    target,
    token0,
    token1,
    rpcStats
  );
  if (!buySwaps || buySwaps.length === 0) {
    if (chainSlug === 'bsc') {
      buySwaps = await findBuySwapSamplesByReceipts(
        provider,
        chainSlug,
        poolAddress,
        createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
        target,
        token0,
        token1
      );
    }
  }
  if (!buySwaps || buySwaps.length === 0) {
    buySwaps = await findBuyTransferSamples(
      provider,
      chainSlug,
      poolAddress,
      createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
      target,
      quoteToken,
      rpcStats
    );
  }
  if (!buySwaps || buySwaps.length === 0) {
    buySwaps = await findEarlyAnySwapSamples(
      provider,
      chainSlug,
      poolAddress,
      createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
      target,
      token0,
      token1,
      rpcStats
    );
  }
  if (!buySwaps || buySwaps.length === 0) {
    if (rpcStats.historyPruned > 0) {
      throw new BaselineFetchFailure(
        'rpc_history_pruned',
        `rpc_history_pruned pool=${poolAddress} chain=${chainSlug}`,
        6 * 60 * 60
      );
    }
    if (rpcStats.rateLimited > 0) {
      throw new BaselineFetchFailure(
        'rpc_rate_limited',
        `rpc_rate_limited pool=${poolAddress} chain=${chainSlug}`,
        30 * 60
      );
    }
    if (rpcStats.methodUnavailable > 0) {
      throw new BaselineFetchFailure(
        'rpc_method_unavailable',
        `rpc_method_unavailable pool=${poolAddress} chain=${chainSlug}`,
        6 * 60 * 60
      );
    }
    if (rpcStats.blockRangeLimited > 0) {
      throw new BaselineFetchFailure(
        'rpc_block_range_limited',
        `rpc_block_range_limited pool=${poolAddress} chain=${chainSlug}`,
        2 * 60 * 60
      );
    }
    if (chainSlug === 'bsc') {
      const bscFallback = await fetchBscTokenManagerPurchaseBaselineUsd(
        provider,
        target,
        createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000) - 30 * 24 * 3600
      );
      if (bscFallback && Number.isFinite(bscFallback.price) && bscFallback.price > 0) {
        return bscFallback;
      }
    }
    return null;
  }

  if (stablecoins.has(quoteToken)) {
    const candidates = buySwaps
      .map((swap) => {
        const px = quotePerToken(swap.targetRaw, swap.quoteRaw, targetDecimals, quoteDecimals);
        const quoteAmount = Number(ethers.formatUnits(swap.quoteRaw, quoteDecimals));
        const quoteUsd = Number.isFinite(quoteAmount) ? quoteAmount : 0;
        return (px && Number.isFinite(px) && px > 0 && quoteUsd >= EVM_BASELINE_MIN_QUOTE_USD)
          ? { price: px, blockNumber: swap.blockNumber, txHash: swap.txHash }
          : null;
      })
      .filter((v) => !!v) as Array<{ price: number; blockNumber: number; txHash?: string }>;

    let picked: { price: number; blockNumber: number; txHash?: string } | null = null;
    if (candidates.length > 0) {
      const sorted = candidates.slice().sort((a, b) => a.price - b.price);
      picked = sorted[Math.floor(sorted.length / 2)] || null;
    } else {
      const fallbackPx = quotePerToken(buySwaps[0].targetRaw, buySwaps[0].quoteRaw, targetDecimals, quoteDecimals);
      if (Number.isFinite(fallbackPx || NaN) && (fallbackPx || 0) > 0) {
        picked = { price: Number(fallbackPx), blockNumber: buySwaps[0].blockNumber, txHash: buySwaps[0].txHash };
      }
    }

    if (!picked || !Number.isFinite(picked.price) || picked.price <= 0) return null;
    const pickedBlock = await provider.getBlock(picked.blockNumber).catch(() => null);
    return {
      price: picked.price,
      source: 'rpc_stable_first_swap',
      blockNumber: picked.blockNumber,
      txHash: picked.txHash,
      poolAddress,
      quotedAt: pickedBlock ? new Date(Number(pickedBlock.timestamp || 0) * 1000) : undefined,
    };
  }

  const wrapped = getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
  if (quoteToken !== wrapped) return null;

  const nativeCandidates: Array<{ price: number; blockNumber: number; txHash?: string; nativeUsd: number; quotedAt?: Date }> = [];
  for (const swap of buySwaps) {
    const quotePerTargetNative = quotePerToken(swap.targetRaw, swap.quoteRaw, targetDecimals, quoteDecimals);
    if (!quotePerTargetNative) continue;
    const block = await provider.getBlock(swap.blockNumber).catch(() => null);
    const ts = Number(block?.timestamp || 0);
    const nativeUsd = await getNativeUsdOnDate(chainId, ts);
    if (!nativeUsd || !Number.isFinite(nativeUsd) || nativeUsd <= 0) continue;
    const quoteAmountNative = Number(ethers.formatUnits(swap.quoteRaw, quoteDecimals));
    const quoteUsd = quoteAmountNative * nativeUsd;
    if (!Number.isFinite(quoteUsd) || quoteUsd < EVM_BASELINE_MIN_QUOTE_USD) continue;
    const px = quotePerTargetNative * nativeUsd;
    if (Number.isFinite(px) && px > 0) {
      nativeCandidates.push({
        price: px,
        blockNumber: swap.blockNumber,
        txHash: swap.txHash,
        nativeUsd: Number(nativeUsd),
        quotedAt: ts > 0 ? new Date(ts * 1000) : undefined,
      });
    }
  }

  let picked: { price: number; blockNumber?: number; txHash?: string; nativeUsd?: number; quotedAt?: Date } | null = null;
  if (nativeCandidates.length > 0) {
    const sorted = nativeCandidates.sort((a, b) => a.price - b.price);
    picked = sorted[Math.floor(sorted.length / 2)] || null;
  } else {
    const first = buySwaps[0];
    const quotePerTargetNative = quotePerToken(first.targetRaw, first.quoteRaw, targetDecimals, quoteDecimals);
    if (quotePerTargetNative) {
      const firstSwapBlock = await provider.getBlock(first.blockNumber).catch(() => null);
      const firstSwapTs = Number(firstSwapBlock?.timestamp || 0);
      const nativeUsd = await getNativeUsdOnDate(chainId, firstSwapTs);
      if (nativeUsd && Number.isFinite(nativeUsd) && nativeUsd > 0) {
        const px = quotePerTargetNative * nativeUsd;
        if (Number.isFinite(px) && px > 0) {
          picked = {
            price: px,
            blockNumber: first.blockNumber,
            txHash: first.txHash,
            nativeUsd: Number(nativeUsd),
            quotedAt: firstSwapTs > 0 ? new Date(firstSwapTs * 1000) : undefined,
          };
        }
      }
    }
  }

  if (!picked || !Number.isFinite(picked.price) || picked.price <= 0) return null;
  return {
    price: picked.price,
    source: 'rpc_native_first_swap',
    blockNumber: picked.blockNumber,
    txHash: picked.txHash,
    poolAddress,
    nativeUsd: picked.nativeUsd,
    quotedAt: picked.quotedAt,
  };
}

type SolRpcTokenBalance = {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: {
    uiAmount?: number | null;
    uiAmountString?: string;
    amount?: string;
    decimals?: number;
  };
};

function parseSolUiAmount(v: any): number | null {
  if (v && typeof v === 'object') {
    const uiAmount = Number((v as any).uiAmount);
    if (Number.isFinite(uiAmount)) return uiAmount;

    const uiAmountStr = Number((v as any).uiAmountString);
    if (Number.isFinite(uiAmountStr)) return uiAmountStr;

    const amountRaw = Number((v as any).amount);
    const decimals = Number((v as any).decimals);
    if (Number.isFinite(amountRaw) && Number.isFinite(decimals) && decimals >= 0 && decimals <= 18) {
      const scaled = amountRaw / Math.pow(10, decimals);
      if (Number.isFinite(scaled)) return scaled;
    }
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function tokenDeltaMap(
  pre: SolRpcTokenBalance[] | undefined,
  post: SolRpcTokenBalance[] | undefined
): Map<string, number> {
  const byKey = new Map<string, { pre?: number; post?: number; mint?: string }>();
  for (const b of pre || []) {
    if (typeof b.accountIndex !== 'number' || !b.mint) continue;
    const key = `${b.accountIndex}:${b.mint.toLowerCase()}`;
    const ui = parseSolUiAmount(b.uiTokenAmount);
    if (ui === null) continue;
    byKey.set(key, { ...(byKey.get(key) || {}), pre: ui, mint: b.mint.toLowerCase() });
  }
  for (const b of post || []) {
    if (typeof b.accountIndex !== 'number' || !b.mint) continue;
    const key = `${b.accountIndex}:${b.mint.toLowerCase()}`;
    const ui = parseSolUiAmount(b.uiTokenAmount);
    if (ui === null) continue;
    byKey.set(key, { ...(byKey.get(key) || {}), post: ui, mint: b.mint.toLowerCase() });
  }
  const deltas = new Map<string, number>();
  for (const row of byKey.values()) {
    if (!row.mint) continue;
    const preUi = Number.isFinite(row.pre || NaN) ? Number(row.pre) : 0;
    const postUi = Number.isFinite(row.post || NaN) ? Number(row.post) : 0;
    const d = postUi - preUi;
    if (!Number.isFinite(d) || d === 0) continue;
    deltas.set(row.mint, (deltas.get(row.mint) || 0) + d);
  }
  return deltas;
}

type SolOwnerTokenDelta = {
  owner: string;
  mint: string;
  delta: number;
};

function normalizeAccountKey(input: any): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (typeof input?.pubkey === 'string') return input.pubkey;
  return '';
}

function tokenDeltaRowsByOwner(
  pre: SolRpcTokenBalance[] | undefined,
  post: SolRpcTokenBalance[] | undefined,
  accountKeysRaw: any[] | undefined
): SolOwnerTokenDelta[] {
  const byKey = new Map<string, { pre?: number; post?: number; mint: string; owner: string }>();

  const resolveOwner = (b: SolRpcTokenBalance): string => {
    const explicit = String((b as any)?.owner || '').trim();
    if (explicit) return explicit;
    const idx = typeof b.accountIndex === 'number' ? b.accountIndex : -1;
    if (idx >= 0 && Array.isArray(accountKeysRaw) && idx < accountKeysRaw.length) {
      return normalizeAccountKey(accountKeysRaw[idx]);
    }
    return '';
  };

  for (const b of pre || []) {
    if (typeof b.accountIndex !== 'number' || !b.mint) continue;
    const mint = b.mint.toLowerCase();
    const key = `${b.accountIndex}:${mint}`;
    const ui = parseSolUiAmount(b.uiTokenAmount);
    if (ui === null) continue;
    const owner = resolveOwner(b);
    byKey.set(key, { ...(byKey.get(key) || { mint, owner }), pre: ui, mint, owner: owner || (byKey.get(key)?.owner || '') });
  }

  for (const b of post || []) {
    if (typeof b.accountIndex !== 'number' || !b.mint) continue;
    const mint = b.mint.toLowerCase();
    const key = `${b.accountIndex}:${mint}`;
    const ui = parseSolUiAmount(b.uiTokenAmount);
    if (ui === null) continue;
    const owner = resolveOwner(b);
    byKey.set(key, { ...(byKey.get(key) || { mint, owner }), post: ui, mint, owner: owner || (byKey.get(key)?.owner || '') });
  }

  const out: SolOwnerTokenDelta[] = [];
  for (const row of byKey.values()) {
    const preUi = Number.isFinite(row.pre || NaN) ? Number(row.pre) : 0;
    const postUi = Number.isFinite(row.post || NaN) ? Number(row.post) : 0;
    const delta = postUi - preUi;
    if (!Number.isFinite(delta) || delta === 0) continue;
    if (!row.owner) continue;
    out.push({ owner: row.owner, mint: row.mint, delta });
  }
  return out;
}

function lamportSpendByOwner(
  tx: any,
  poolAddrLower: string
): Map<string, number> {
  const preLamports: number[] = Array.isArray(tx?.meta?.preBalances) ? tx.meta.preBalances : [];
  const postLamports: number[] = Array.isArray(tx?.meta?.postBalances) ? tx.meta.postBalances : [];
  const accountKeysRaw: any[] = Array.isArray(tx?.transaction?.message?.accountKeys)
    ? tx.transaction.message.accountKeys
    : [];
  const out = new Map<string, number>();
  const feeSol = Number(tx?.meta?.fee || 0) / 1e9;

  for (let i = 0; i < Math.min(preLamports.length, postLamports.length); i++) {
    const owner = normalizeAccountKey(accountKeysRaw[i]);
    if (!owner) continue;
    if (poolAddrLower && owner.toLowerCase() === poolAddrLower) continue;
    const deltaLamports = Number(postLamports[i] || 0) - Number(preLamports[i] || 0);
    const deltaSol = deltaLamports / 1e9;
    // Spend side only: negative lamports means SOL left this owner account.
    if (!Number.isFinite(deltaSol) || deltaSol >= 0) continue;
    const spend = Math.max(0, Math.abs(deltaSol) - feeSol);
    if (!Number.isFinite(spend) || spend <= 0) continue;
    const prev = out.get(owner) || 0;
    if (spend > prev) out.set(owner, spend);
  }
  return out;
}

async function callPublicSolRpc<T = any>(
  method: string,
  params: any[],
  stats?: SolRpcProbeStats
): Promise<T | null> {
  const urls = getPublicRpcUrls('solana');
  if (urls.length === 0) return null;

  const now = Date.now();
  const active = urls.filter((url) => (solRpcBackoffUntilByUrl.get(url) || 0) <= now);
  const candidates = active.length > 0 ? active : urls;
  const start = solRpcRoundRobinCursor % candidates.length;
  const ordered = [...candidates.slice(start), ...candidates.slice(0, start)];

  for (let i = 0; i < ordered.length; i++) {
    const url = ordered[i];
    const nowCall = Date.now();
    const lastCallAt = solRpcLastCallByUrl.get(url) || 0;
    const waitMs = Math.max(0, SOL_RPC_MIN_INTERVAL_MS - (nowCall - lastCallAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    solRpcLastCallByUrl.set(url, Date.now());
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      if (!resp.ok) {
        const bodyText = await resp.text().catch(() => '');
        const bodyLower = String(bodyText || '').toLowerCase();
        if (resp.status === 429 || bodyLower.includes('rate limit') || bodyLower.includes('too many requests')) {
          if (stats) stats.rateLimited += 1;
        } else if (resp.status === 403) {
          if (stats) stats.accessDenied += 1;
        } else {
          if (stats) stats.network += 1;
        }
        const retryAfterHeader = Number(resp.headers.get('retry-after') || 0);
        const penaltyMs = resp.status === 429
          ? Math.max(120_000, Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 0)
          : resp.status >= 500 ? 20_000 : 10_000;
        solRpcBackoffUntilByUrl.set(url, Date.now() + penaltyMs);
        continue;
      }

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        if (stats) stats.nonJson += 1;
        solRpcBackoffUntilByUrl.set(url, Date.now() + 5 * 60 * 1000);
        continue;
      }
      if (json?.error) {
        const msg = String(json.error?.message || '').toLowerCase();
        const code = Number(json.error?.code || 0);
        // dRPC free tier often returns this for unsupported methods.
        if (msg.includes('method is not available on freetier') || code === 35) {
          if (stats) stats.methodUnavailable += 1;
          solRpcBackoffUntilByUrl.set(url, Date.now() + 6 * 60 * 60 * 1000);
          continue;
        }
        if (msg.includes('rate limit') || code === 429 || msg.includes('too many requests')) {
          if (stats) stats.rateLimited += 1;
          solRpcBackoffUntilByUrl.set(url, Date.now() + 5 * 60 * 1000);
          continue;
        }
        if (code === 403 || msg.includes('forbidden') || msg.includes('unauthorized')) {
          if (stats) stats.accessDenied += 1;
        } else {
          if (stats) stats.network += 1;
        }
        solRpcBackoffUntilByUrl.set(url, Date.now() + 15_000);
        continue;
      }

      solRpcRoundRobinCursor = (start + i + 1) % candidates.length;
      return (json?.result ?? null) as T | null;
    } catch {
      if (stats) stats.network += 1;
      solRpcBackoffUntilByUrl.set(url, Date.now() + 20_000);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

async function fetchSolanaRpcBaselineUsd(
  tokenAddress?: string,
  poolAddress?: string,
  poolCreatedAt?: string
): Promise<number | null> {
  if (!tokenAddress) return null;
  const target = tokenAddress.toLowerCase();
  const poolAddrLower = String(poolAddress || '').toLowerCase();
  const chainCfg = getChainConfig(900);
  const stableMints = new Set((chainCfg.stablecoins || []).map((x) => x.toLowerCase()));
  const wrappedNative = String(chainCfg.wrappedNativeAddress || '').toLowerCase();
  const createdSec = poolCreatedAt ? Math.floor(Date.parse(poolCreatedAt) / 1000) : 0;
  const stopBeforeSec = createdSec > 0 ? Math.max(0, createdSec - 3 * 24 * 3600) : 0;
  const rpcStats: SolRpcProbeStats = {
    rateLimited: 0,
    methodUnavailable: 0,
    accessDenied: 0,
    nonJson: 0,
    network: 0,
  };

  const signatures: any[] = [];
  const signatureSources = Array.from(new Set([
    String(poolAddress || '').trim(),
    String(tokenAddress || '').trim(),
  ].filter(Boolean)));
  const maxPages = Math.max(2, Math.min(SOL_RPC_SIGNATURE_MAX_PAGES, 12));
  const pageLimit = Math.max(80, Math.min(SOL_RPC_SIGNATURE_PAGE_LIMIT, 250));
  for (const sourceAddress of signatureSources) {
    let before: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const pageResult = await callPublicSolRpc<any[]>(
        'getSignaturesForAddress',
        [sourceAddress, { limit: pageLimit, before, commitment: 'confirmed' }],
        rpcStats
      );
      if (!Array.isArray(pageResult) || pageResult.length === 0) break;
      signatures.push(...pageResult);
      const last = pageResult[pageResult.length - 1];
      if (stopBeforeSec > 0 && Number(last?.blockTime || 0) > 0 && Number(last.blockTime) <= stopBeforeSec) {
        break;
      }
      before = typeof last?.signature === 'string' ? last.signature : undefined;
      if (!before) break;
    }
  }
  if (signatures.length === 0) {
    if (rpcStats.rateLimited > 0) {
      throw new BaselineFetchFailure('sol_rpc_rate_limited', `sol_rpc_rate_limited token=${tokenAddress}`, 30 * 60);
    }
    if (rpcStats.methodUnavailable > 0) {
      throw new BaselineFetchFailure('sol_rpc_method_unavailable', `sol_rpc_method_unavailable token=${tokenAddress}`, 6 * 60 * 60);
    }
    if (rpcStats.accessDenied > 0) {
      throw new BaselineFetchFailure('sol_rpc_access_denied', `sol_rpc_access_denied token=${tokenAddress}`, 6 * 60 * 60);
    }
    if (rpcStats.nonJson > 0) {
      throw new BaselineFetchFailure('sol_rpc_non_json', `sol_rpc_non_json token=${tokenAddress}`, 30 * 60);
    }
    return null;
  }

  type SolBaselineCandidate = { ts: number; price: number };
  const candidates: SolBaselineCandidate[] = [];
  const dedupSig = new Set<string>();
  const ordered = signatures
    .filter((s: any) => typeof s?.signature === 'string')
    .filter((s: any) => {
      const sig = String(s.signature);
      if (dedupSig.has(sig)) return false;
      dedupSig.add(sig);
      return true;
    })
    .sort((a: any, b: any) => Number(a?.blockTime || 0) - Number(b?.blockTime || 0))
    .slice(0, SOL_RPC_MAX_SIGNATURES_TO_INSPECT);

  for (const row of ordered) {
    const sig = row.signature;
    const tx = await callPublicSolRpc<any>(
      'getTransaction',
      [sig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
      rpcStats
    );
    const pre = tx?.meta?.preTokenBalances as SolRpcTokenBalance[] | undefined;
    const post = tx?.meta?.postTokenBalances as SolRpcTokenBalance[] | undefined;
    if (!Array.isArray(pre) && !Array.isArray(post)) continue;

    const accountKeysRaw: any[] = Array.isArray(tx?.transaction?.message?.accountKeys)
      ? tx.transaction.message.accountKeys
      : [];
    const ownerRows = tokenDeltaRowsByOwner(pre, post, accountKeysRaw);
    const deltas = tokenDeltaMap(pre, post);

    const ownerMintMap = new Map<string, Map<string, number>>();
    for (const rowDelta of ownerRows) {
      const m = ownerMintMap.get(rowDelta.owner) || new Map<string, number>();
      m.set(rowDelta.mint, (m.get(rowDelta.mint) || 0) + rowDelta.delta);
      ownerMintMap.set(rowDelta.owner, m);
    }

    const targetOwners = Array.from(ownerMintMap.entries())
      .map(([owner, mintMap]) => ({ owner, targetDelta: Number(mintMap.get(target) || 0), mintMap }))
      .filter((x) => Number.isFinite(x.targetDelta) && x.targetDelta > 0);
    if (targetOwners.length === 0) continue;

    const targetAbs = Math.max(...targetOwners.map((x) => x.targetDelta));
    if (!Number.isFinite(targetAbs) || targetAbs <= 0) continue;
    const minTargetAmountStrict = Math.max(
      1,
      Math.min(
        SOL_RPC_MIN_TARGET_AMOUNT,
        Number.isFinite(createdSec) && createdSec > 0 && (Date.now() / 1000 - createdSec) <= 2 * 24 * 3600
          ? 10
          : 25
      )
    );
    if (targetAbs < minTargetAmountStrict && targetAbs < 1) continue;

    const lamportsByOwner = lamportSpendByOwner(tx, poolAddrLower);
    let bestQuoteUsdAbs = 0;
    let bestQuoteNativeAbs = 0;
    for (const ownerRow of targetOwners) {
      let ownerStableSpend = 0;
      let ownerWrappedSpend = 0;
      for (const [mint, delta] of ownerRow.mintMap.entries()) {
        if (mint === target) continue;
        if (stableMints.has(mint)) {
          const spend = -delta;
          if (Number.isFinite(spend) && spend > ownerStableSpend) ownerStableSpend = spend;
        } else if (mint === wrappedNative) {
          const spend = -delta;
          if (Number.isFinite(spend) && spend > ownerWrappedSpend) ownerWrappedSpend = spend;
        }
      }

      if (ownerStableSpend > bestQuoteUsdAbs) bestQuoteUsdAbs = ownerStableSpend;
      if (ownerWrappedSpend > bestQuoteNativeAbs) bestQuoteNativeAbs = ownerWrappedSpend;

      if (bestQuoteUsdAbs <= 0 && bestQuoteNativeAbs <= 0) {
        const lamportSpend = Number(lamportsByOwner.get(ownerRow.owner) || 0);
        if (Number.isFinite(lamportSpend) && lamportSpend > bestQuoteNativeAbs) {
          bestQuoteNativeAbs = lamportSpend;
        }
      }
    }

    // fallback aggregate path for unusual tx layouts
    if (bestQuoteUsdAbs <= 0 && bestQuoteNativeAbs <= 0) {
      for (const [mint, delta] of deltas.entries()) {
        if (mint === target) continue;
        if (stableMints.has(mint)) {
          const spend = Math.max(0, -delta);
          if (spend > bestQuoteUsdAbs) bestQuoteUsdAbs = spend;
        } else if (mint === wrappedNative) {
          const spend = Math.max(0, -delta);
          if (spend > bestQuoteNativeAbs) bestQuoteNativeAbs = spend;
        }
      }
    }

    let quoteUsdAbs = 0;
    if (bestQuoteUsdAbs > 0) {
      quoteUsdAbs = bestQuoteUsdAbs;
    } else if (bestQuoteNativeAbs > 0) {
      const ts = Number(tx?.blockTime || row?.blockTime || 0);
      const nativeUsd = await getNativeUsdOnDate(900, ts > 0 ? ts : undefined);
      if (nativeUsd && Number.isFinite(nativeUsd) && nativeUsd > 0) {
        quoteUsdAbs = bestQuoteNativeAbs * nativeUsd;
      }
    }
    if (!Number.isFinite(quoteUsdAbs) || quoteUsdAbs <= 0) continue;
    const minQuoteUsd = Math.max(0, SOL_RPC_MIN_QUOTE_USD);
    if (quoteUsdAbs < minQuoteUsd && quoteUsdAbs < 1) continue;

    const p = quoteUsdAbs / targetAbs;
    if (!Number.isFinite(p) || p <= 0 || p > 1e6) continue;
    candidates.push({ ts: Number(tx?.blockTime || row?.blockTime || 0) || 0, price: p });
    if (candidates.length >= SOL_RPC_EARLIEST_CANDIDATES) break;
  }

  if (candidates.length === 0) {
    if (rpcStats.rateLimited > 0) {
      throw new BaselineFetchFailure('sol_rpc_rate_limited', `sol_rpc_rate_limited token=${tokenAddress}`, 30 * 60);
    }
    if (rpcStats.methodUnavailable > 0) {
      throw new BaselineFetchFailure('sol_rpc_method_unavailable', `sol_rpc_method_unavailable token=${tokenAddress}`, 6 * 60 * 60);
    }
    if (rpcStats.accessDenied > 0) {
      throw new BaselineFetchFailure('sol_rpc_access_denied', `sol_rpc_access_denied token=${tokenAddress}`, 6 * 60 * 60);
    }
    if (rpcStats.nonJson > 0) {
      throw new BaselineFetchFailure('sol_rpc_non_json', `sol_rpc_non_json token=${tokenAddress}`, 30 * 60);
    }
    return null;
  }
  candidates.sort((a, b) => a.ts - b.ts || a.price - b.price);
  const picked = candidates.slice(0, Math.min(candidates.length, Math.max(3, SOL_RPC_EARLIEST_CANDIDATES)));
  const prices = picked.map((c) => c.price).sort((a, b) => a - b);
  const chosenPrice = prices[Math.floor(prices.length / 2)];
  const chosen = { ts: picked[0]?.ts || candidates[0]?.ts || 0, price: chosenPrice };
  return Number.isFinite(chosen.price) && chosen.price > 0 ? chosen.price : null;
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

  for (const raw of directCandidates) {
    const url = toUrl(raw as string);
    if (url) return url;
  }

  const twitterUsername = data.creatorProfile?.socialAccounts?.twitter?.username
    || data.creatorProfile?.socialAccounts?.x?.username
    || data.twitter
    || data.xUsername;
  if (typeof twitterUsername === 'string' && twitterUsername.trim()) {
    return `https://x.com/${twitterUsername.replace(/^@/, '')}`;
  }

  const farcasterUsername = data.creatorProfile?.socialAccounts?.farcaster?.username
    || data.farcaster;
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

  const preferred: unknown[] = [
    data.creatorProfile?.handle,
    data.creatorHandle,
    data.social_context?.id,
    socials.handle,
    data.twitterUsername,
    data.farcasterUsername,
  ];
  for (const raw of preferred) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    if (value.startsWith('@')) return value;
    if (creatorUrl?.includes('x.com') || creatorUrl?.includes('twitter.com') || creatorUrl?.includes('warpcast.com')) {
      return `@${value}`;
    }
    return value;
  }

  if (creatorUrl) {
    try {
      const u = new URL(creatorUrl);
      const path = u.pathname.replace(/\/+$/, '');
      const last = path.split('/').filter(Boolean).pop();
      if (last) {
        if (u.hostname.includes('x.com') || u.hostname.includes('twitter.com') || u.hostname.includes('warpcast.com')) {
          return `@${last.replace(/^@/, '')}`;
        }
        return last;
      }
    } catch {
      // ignore malformed url
    }
  }

  return creatorAddress;
}

function pickCreatorMeta(detected: any): { creatorAddress?: string; creatorUrl?: string; creatorLabel?: string } {
  let creatorAddress = pickCreatorAddress(detected);
  let creatorUrl = pickCreatorUrl(detected);
  let creatorLabel = pickCreatorLabel(detected, creatorUrl, creatorAddress);

  const addressLike = (value?: string) => !!value && (/^0x[a-f0-9]{40}$/i.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value));
  if (creatorLabel && addressLike(creatorLabel)) {
    creatorLabel = undefined;
  }

  return { creatorAddress, creatorUrl, creatorLabel };
}

async function enrichLaunchpadsForTrending(
  chainId: string,
  tokens: Array<{ address: string; launchpad?: string; imageUrl?: string; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; launchMultiple?: number; poolAddress?: string; poolCreatedAt?: string; price?: number }>
): Promise<void> {
  if (tokens.length === 0) return;

  const persistLaunchpad = async (
    token: { address: string; launchpad?: string; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string },
    source: string
  ) => {
    try {
      await saveTokenLaunchpadProfile(chainId, token.address, {
        launchpad: token.launchpad,
        creatorAddress: token.creatorAddress,
        creatorUrl: token.creatorUrl,
        creatorLabel: token.creatorLabel,
        source,
      });
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
      || detectByMetadata(chainId, token)
      || undefined;
  }
  const deterministic = tokens.filter((t) => !!t.launchpad);
  if (deterministic.length > 0) {
    const persistLimiter = pLimit(10);
    await Promise.all(deterministic.map((token) => persistLimiter(async () => {
      await persistLaunchpad(token as any, 'deterministic_suffix');
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
          await writeTokenMetaCache(chainId, token.address, {
            creatorAddress: token.creatorAddress,
            creatorUrl: (token as any).creatorUrl,
            creatorLabel: (token as any).creatorLabel,
            launchMultiple: token.launchMultiple
          });
          await persistLaunchpad(token as any, 'detector_flap');
          if (!token.imageUrl && typeof (detected as any)?.data?.imageUrl === 'string') {
            token.imageUrl = (detected as any).data.imageUrl;
          }
        } catch {
          // Keep suffix classification when verification fails due to transient errors.
        }
      })));
    }
  }

  // Step 3: API verification for Base tokens without deterministic suffix
  if (chainId === 'base') {
    const unresolved = tokens.filter((t) => !t.launchpad && t.address.startsWith('0x'));
    if (unresolved.length > 0) {
      const verifyTargets = pickVerifyTargets(unresolved, LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN);
      if (unresolved.length > verifyTargets.length) {
        logger.info(LogCode.API_FETCH_SUCCESS, 'Launchpad verify budget applied', {
          chain: chainId,
          unresolved: unresolved.length,
          verifying: verifyTargets.length
        });
      }

      const limiter = pLimit(LAUNCHPAD_DETECT_CONCURRENCY);
      await Promise.all(verifyTargets.map((token) => limiter(async () => {
        try {
          const detected = await detectLaunchpadToken(token.address, 8453, { mode: 'cheap' });
          const normalized = normalizeLaunchpad(detected?.provider || null);
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
  const chainIdNum = chainId === 'base' ? 8453 : chainId === 'bsc' ? 56 : null;
  const isSolana = chainId === 'solana';
  if (!chainIdNum && !isSolana) return;

  const backfillCandidates = tokens.filter((t) => {
    if (!t.launchpad) return false;
    const missingCreator = !t.creatorAddress && !(t as any).creatorUrl && !(t as any).creatorLabel;
    if (!missingCreator) return false;
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
        requireCreator: true
      });
      if (!detected) return;

      if (!token.launchpad) {
        const normalized = normalizeLaunchpad(detected.provider || null);
        if (normalized) token.launchpad = normalized;
      }
      if (!token.creatorAddress) {
        const creatorMeta = pickCreatorMeta(detected);
        token.creatorAddress = creatorMeta.creatorAddress;
        if (creatorMeta.creatorUrl) (token as any).creatorUrl = creatorMeta.creatorUrl;
        if (creatorMeta.creatorLabel) (token as any).creatorLabel = creatorMeta.creatorLabel;
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
    } catch {
      // Best-effort metadata backfill only.
    }
  })));

  // Step 5: proactive creator discovery for Base tokens missing creator.
  // This is budgeted and runs in job context (not request path) to keep UI stable.
  if (chainId === 'base' || chainId === 'solana') {
    const unresolvedCreator = tokens.filter((t) => {
      const missingCreator = !t.creatorAddress && !(t as any).creatorUrl && !(t as any).creatorLabel;
      if (!missingCreator) return false;
      return chainId === 'solana' ? !t.address.startsWith('0x') : t.address.startsWith('0x');
    });
    if (unresolvedCreator.length > 0) {
      const creatorTargets = pickVerifyTargets(
        unresolvedCreator,
        Math.min(LAUNCHPAD_CREATOR_DISCOVERY_BUDGET_PER_RUN, LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN)
      );
      const creatorLimiter = pLimit(2);
      await Promise.all(creatorTargets.map((token) => creatorLimiter(async () => {
        try {
          const detected = await detectLaunchpadToken(token.address, chainId === 'base' ? 8453 : undefined, {
            mode: 'full',
            requireCreator: true
          });
          if (!detected) return;
          const normalized = normalizeLaunchpad(detected?.provider || null);
          if (normalized && !token.launchpad) token.launchpad = normalized;
          const creatorMeta = pickCreatorMeta(detected);
          if (creatorMeta.creatorAddress && !token.creatorAddress) token.creatorAddress = creatorMeta.creatorAddress;
          if (creatorMeta.creatorUrl && !(token as any).creatorUrl) (token as any).creatorUrl = creatorMeta.creatorUrl;
          if (creatorMeta.creatorLabel && !(token as any).creatorLabel) (token as any).creatorLabel = creatorMeta.creatorLabel;
          if (!token.imageUrl && typeof (detected as any)?.data?.imageUrl === 'string') {
            token.imageUrl = (detected as any).data.imageUrl;
          }
          await writeTokenMetaCache(chainId, token.address, {
            creatorAddress: token.creatorAddress,
            creatorUrl: (token as any).creatorUrl,
            creatorLabel: (token as any).creatorLabel,
            launchMultiple: token.launchMultiple
          });
          await persistLaunchpad(token as any, 'detector_discovery');
        } catch {
          // best-effort creator discovery only
        }
      })));
    }
  }
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
    let tokens = await getTrendingTokensPremium(chain.id, 100);

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
        || detectByMetadata(chain.id, token)
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
