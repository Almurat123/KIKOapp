/**
 * Token Data Refresh Job
 * Runs periodically to fetch and store trending tokens for multiple chains
 * 
 * Supported chains: Ethereum, Base, BSC, Arbitrum
 * Uses GeckoTerminal (free) as primary source, DexScreener as fallback
 */

import cron from 'node-cron';
import { getTrendingTokens } from '../services/geckoTerminal.js';
import { getTrendingTokensPremium, getCandlestickData as getDexCandlestickData, getTokenPairsByAddress } from '../services/dexscreener.js';
import { saveTrendingTokens, getLastUpdateTime, getTrendingTokens as getStoredTrendingTokens } from '../repositories/tokenRepository.js';
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
import { getEvmLogs } from '../config/unifiedScanService.js';

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
const LAUNCHPAD_DETECT_CONCURRENCY = 6;
const LAUNCH_MULTIPLE_ENRICH_ENABLED = true;
const LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN = Math.max(
  48,
  Number(process.env.LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN || '80')
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
  30 * 60,
  Number(process.env.BASELINE_EXTERNAL_RETRY_TTL_SECONDS || `${6 * 60 * 60}`)
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

function normalizeLaunchpad(provider?: string | null): string | null {
  if (!provider) return null;
  if (provider === 'pumpfun') return 'pump.fun';
  if (provider === 'bonkfun') return 'bonk.fun';
  if (provider === 'fourmeme') return 'four.meme';
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

type ExternalBaselineResult = {
  price: number;
  source: string;
};

type BaselinePoolCandidate = {
  poolAddress: string;
  poolCreatedAt?: string;
  liquidityUsd?: number;
};

const geckoCandleBackoffByChain = new Map<string, number>();
let geckoNextCandleAtMs = 0;
const poolCandidatesCache = new Map<string, { items: BaselinePoolCandidate[]; expiresAt: number }>();
const historicalNativeUsdByDate = new Map<string, number>();
const RPC_LOG_MAX_BLOCK_RANGE = Math.max(
  200,
  Number(process.env.RPC_LOG_MAX_BLOCK_RANGE || '500')
);
const OLD_TOKEN_SCAN_MIN_DAYS = Math.max(
  7,
  Number(process.env.OLD_TOKEN_SCAN_MIN_DAYS || '30')
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
const SOL_RPC_MIN_QUOTE_USD = Math.max(
  1,
  Number(process.env.SOL_RPC_MIN_QUOTE_USD || '25')
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
      return px;
    }
  } catch {
    // fallback below
  }

  const spot = await getNativeTokenPriceUsd(chainId);
  if (Number.isFinite(spot) && spot > 0) {
    historicalNativeUsdByDate.set(key, spot);
    return spot;
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
  return `token:meta:v1:${chainId}:${address.toLowerCase()}`;
}

function tokenBaselineCacheKey(chainId: string, address: string): string {
  return `token:baseline:v1:${chainId}:${address.toLowerCase()}`;
}

function tokenBaselineRetryKey(chainId: string, address: string): string {
  return `token:baseline:retry:v1:${chainId}:${address.toLowerCase()}`;
}

function geckoCandleBackoffKey(chainId: string): string {
  return `token:meta:candle_backoff:v1:${chainId}`;
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
    const raw = await getRedisCache(tokenMetaCacheKey(chainId, address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EnrichedTokenMeta;
    if (!parsed || typeof parsed !== 'object') return null;
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
  try {
    const raw = await getRedisCache(tokenBaselineCacheKey(chainId, address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenBaselineMeta;
    const baselinePrice = Number(parsed?.baselinePrice || 0);
    const firstSeenAt = Number(parsed?.firstSeenAt || 0);
    const baselineSource = typeof parsed?.baselineSource === 'string' ? parsed.baselineSource : undefined;
    if (!Number.isFinite(baselinePrice) || baselinePrice <= 0 || !Number.isFinite(firstSeenAt) || firstSeenAt <= 0) {
      return null;
    }
    return { baselinePrice, firstSeenAt, baselineSource };
  } catch {
    return null;
  }
}

async function writeTokenBaselineCache(
  chainId: string,
  address: string,
  baselinePrice: number,
  baselineSource: string = 'unknown'
): Promise<void> {
  if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) return;
  try {
    await setRedisCache(
      tokenBaselineCacheKey(chainId, address),
      JSON.stringify({ baselinePrice, firstSeenAt: Date.now(), baselineSource }),
      TOKEN_BASELINE_CACHE_TTL_SECONDS
    );
  } catch {
    // ignore cache write errors
  }
}

function isTrustedBaselineSource(source?: string): boolean {
  return source === 'gecko_launch_window'
    || source === 'dex_candles'
    || source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize'
    || source === 'solana_public_rpc'
    || source === 'derived_change_proxy'
    || source === 'first_seen_fallback';
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

async function writeBaselineRetryCooldown(chainId: string, address: string): Promise<void> {
  try {
    const until = Date.now() + BASELINE_EXTERNAL_RETRY_TTL_SECONDS * 1000;
    await setRedisCache(
      tokenBaselineRetryKey(chainId, address),
      JSON.stringify({ until }),
      BASELINE_EXTERNAL_RETRY_TTL_SECONDS
    );
  } catch {
    // ignore
  }
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

  const key = cacheKeyForPoolCandidates(chainId, tokenAddress);
  const cached = poolCandidatesCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const unique = new Map<string, BaselinePoolCandidate>();

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
    // best-effort only
  }

  const items = Array.from(unique.values())
    .sort((a, b) => {
      const aCreated = a.poolCreatedAt ? Date.parse(a.poolCreatedAt) : Number.POSITIVE_INFINITY;
      const bCreated = b.poolCreatedAt ? Date.parse(b.poolCreatedAt) : Number.POSITIVE_INFINITY;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return Number(b.liquidityUsd || 0) - Number(a.liquidityUsd || 0);
    })
    .slice(0, 14);

  poolCandidatesCache.set(key, { items, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
  return items;
}

async function fetchExternalBaselinePrice(
  chainId: string,
  geckoNetwork: string,
  token: { address?: string; poolAddress?: string; poolCreatedAt?: string }
): Promise<ExternalBaselineResult | null> {
  const candidates = await getBaselinePoolCandidates(
    chainId,
    token.address,
    token.poolAddress,
    token.poolCreatedAt
  );
  if (candidates.length === 0) return null;

  for (const pool of candidates) {
    const result = await fetchExternalBaselinePriceForPool(chainId, geckoNetwork, token.address, pool);
    if (result && Number.isFinite(result.price) && result.price > 0) {
      return result;
    }
  }
  return null;
}

async function fetchExternalBaselinePriceForPool(
  chainId: string,
  geckoNetwork: string,
  tokenAddress: string | undefined,
  pool: BaselinePoolCandidate
): Promise<ExternalBaselineResult | null> {
  if (!pool.poolAddress) return null;
  const createdMs = pool.poolCreatedAt ? Date.parse(pool.poolCreatedAt) : NaN;
  const ageHours = Number.isFinite(createdMs) && createdMs > 0 ? (Date.now() - createdMs) / (1000 * 60 * 60) : NaN;
  const ageDays = Number.isFinite(createdMs) && createdMs > 0 ? (Date.now() - createdMs) / (1000 * 60 * 60 * 24) : NaN;
  const createdSec = Number.isFinite(createdMs) && createdMs > 0 ? Math.floor(createdMs / 1000) : 0;

  // Solana: RPC first swap is more reliable for baseline than candle windows.
  if (chainId === 'solana') {
    const solRpcBaseline = await fetchSolanaRpcBaselineUsd(tokenAddress, pool.poolAddress, pool.poolCreatedAt);
    if (typeof solRpcBaseline === 'number' && Number.isFinite(solRpcBaseline) && solRpcBaseline > 0) {
      return { price: solRpcBaseline, source: 'solana_public_rpc' };
    }
  }

  // 1) Dex candles (fast) only when candle window still covers launch period.
  {
    const timeframe: 'm5' | 'h1' | 'd1' =
      !Number.isFinite(ageHours) ? 'h1'
      : ageHours <= 12 ? 'm5'
      : ageDays <= 14 ? 'h1'
      : 'd1';
    const limit = timeframe === 'm5' ? 180 : timeframe === 'h1' ? 240 : 180;
    const timeframeSec = timeframe === 'm5' ? 5 * 60 : timeframe === 'h1' ? 60 * 60 : 24 * 60 * 60;
    const historyCoverageSec = timeframeSec * limit;
    const launchSlackSec = timeframeSec * 3;
    const hasCreatedAt = createdSec > 0;
    const allowDexCandleBaseline = hasCreatedAt && (Math.floor(Date.now() / 1000) - createdSec) <= (historyCoverageSec + launchSlackSec);
    const dexCandles = await getDexCandlestickData(chainId, pool.poolAddress, timeframe, limit);
    if (allowDexCandleBaseline && Array.isArray(dexCandles) && dexCandles.length >= 2) {
      const candles = dexCandles
        .map((c: any) => ({ time: Number(c?.time), open: Number(c?.open) }))
        .filter((c: any) => Number.isFinite(c.time) && Number.isFinite(c.open) && c.open > 0)
        .sort((a: any, b: any) => a.time - b.time);
      if (candles.length >= 2 && candles[candles.length - 1].time > candles[0].time) {
        const oldestTs = Number(candles[0].time || 0);
        if (oldestTs > 0 && hasCreatedAt && oldestTs <= (createdSec + launchSlackSec)) {
          return { price: candles[0].open, source: 'dex_candles' };
        }
      }
    }
  }

  // 2) RPC first-swap / v4 initialize baseline.
  {
    const rpcBaseline = await fetchRpcStableSwapBaselineUsd(chainId, tokenAddress, pool.poolAddress, pool.poolCreatedAt);
    if (rpcBaseline && Number.isFinite(rpcBaseline.price) && rpcBaseline.price > 0) {
      return rpcBaseline;
    }
  }

  // 3) Solana fallback from public RPC (2nd chance after generic RPC path).
  if (chainId === 'solana') {
    const solRpcBaseline = await fetchSolanaRpcBaselineUsd(tokenAddress, pool.poolAddress, pool.poolCreatedAt);
    if (typeof solRpcBaseline === 'number' && Number.isFinite(solRpcBaseline) && solRpcBaseline > 0) {
      return { price: solRpcBaseline, source: 'solana_public_rpc' };
    }
  }

  // 4) Gecko only when pool looks like a real pool address and age is within public history limits.
  if (isHexPoolId(pool.poolAddress)) {
    return null;
  }
  if (!Number.isFinite(ageDays) || ageDays > 179 || !Number.isFinite(createdMs) || createdMs <= 0) {
    return null;
  }

  const windows: Array<{ timeframe: 'minute' | 'hour'; windowSeconds: number; limit: number }> = [
    { timeframe: 'minute', windowSeconds: 12 * 3600, limit: 720 },
    { timeframe: 'hour', windowSeconds: 14 * 24 * 3600, limit: 336 },
  ];

  for (const w of windows) {
    const beforeTs = Math.floor(Math.min(Date.now() / 1000 - 60, createdSec + w.windowSeconds));
    if (beforeTs <= createdSec) continue;
    const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/pools/${pool.poolAddress}/ohlcv/${w.timeframe}?aggregate=1&before_timestamp=${beforeTs}&limit=${w.limit}`;
    try {
      await waitForGeckoCandleSlot();
      const data = await fetchJson<any>({
        url,
        headers: { Accept: 'application/json', 'User-Agent': 'KiKo/1.0' },
      });
      const list = data?.data?.attributes?.ohlcv_list;
      if (!Array.isArray(list) || list.length === 0) continue;
      const candles = list
        .map((item: any) => ({ time: Number(item?.[0]), open: Number(item?.[1]) }))
        .filter((c: any) => Number.isFinite(c.time) && Number.isFinite(c.open) && c.open > 0)
        .sort((a: any, b: any) => a.time - b.time);
      if (candles.length === 0) continue;
      const launch = candles.find((c: any) => c.time >= createdSec - 300) || candles[0];
      if (Number.isFinite(launch?.open) && launch.open > 0) {
        return { price: launch.open, source: 'gecko_launch_window' };
      }
    } catch (error) {
      if (isRateLimitError(error)) throw error;
      continue;
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
const solRpcBackoffUntilByUrl = new Map<string, number>();
let solRpcRoundRobinCursor = 0;

function getPublicRpcUrl(chainSlug: string): string | null {
  try {
    const endpoints = getRpcEndpointsWithStrategy(chainSlug, 'cheap');
    const publicEndpoint = endpoints.find((ep) => ep.type === 'public' && !!ep.url);
    return publicEndpoint?.url || null;
  } catch {
    return null;
  }
}

function getPublicRpcUrls(chainSlug: string): string[] {
  try {
    const endpoints = getRpcEndpointsWithStrategy(chainSlug, 'cheap');
    const urls = endpoints
      .filter((ep) => (ep.type === 'public' || ep.type === 'fallback') && !!ep.url)
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
  const provider = new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true });
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
const V4_INIT_TOPIC = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');

const V2_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)',
]);

const V3_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)',
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
};

function parseFirstSwapLog(
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
      if (amount0In > 0n && amount1Out > 0n) return { targetRaw: amount0In, quoteRaw: amount1Out };
      if (amount0Out > 0n && amount1In > 0n) return { targetRaw: amount0Out, quoteRaw: amount1In };
      return null;
    }

    if (amount1In > 0n && amount0Out > 0n) return { targetRaw: amount1In, quoteRaw: amount0Out };
    if (amount1Out > 0n && amount0In > 0n) return { targetRaw: amount1Out, quoteRaw: amount0In };
    return null;
  }

  if (log.topics[0] === V3_SWAP_TOPIC) {
    const parsed = V3_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return null;
    const amount0 = absBig(BigInt(parsed.args.amount0.toString()));
    const amount1 = absBig(BigInt(parsed.args.amount1.toString()));
    if (target === token0) return amount0 > 0n && amount1 > 0n ? { targetRaw: amount0, quoteRaw: amount1 } : null;
    return amount1 > 0n && amount0 > 0n ? { targetRaw: amount1, quoteRaw: amount0 } : null;
  }

  return null;
}

async function findFirstSwapData(
  provider: ethers.JsonRpcProvider,
  chainSlug: string,
  poolAddress: string,
  createdSec: number,
  target: string,
  token0: string,
  token1: string
): Promise<FirstSwapData | null> {
  const latest = await provider.getBlock('latest');
  if (!latest || !Number.isFinite(Number(latest.number)) || !Number.isFinite(Number(latest.timestamp))) return null;
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

  for (const r of ranges) {
    for (let from = r.from; from <= r.to; from += RPC_LOG_MAX_BLOCK_RANGE) {
      const to = Math.min(r.to, from + RPC_LOG_MAX_BLOCK_RANGE - 1);
      const [v2Logs, v3Logs] = await Promise.all([
        provider.getLogs({ address: poolAddress, topics: [V2_SWAP_TOPIC], fromBlock: from, toBlock: to }).catch(() => [] as ethers.Log[]),
        provider.getLogs({ address: poolAddress, topics: [V3_SWAP_TOPIC], fromBlock: from, toBlock: to }).catch(() => [] as ethers.Log[]),
      ]);

      const logs = [...v2Logs, ...v3Logs].sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        return Number(a.index) - Number(b.index);
      });
      for (const log of logs) {
        const parsed = parseFirstSwapLog(log, target, token0, token1);
        if (!parsed) continue;
        return { ...parsed, blockNumber: Number(log.blockNumber) };
      }
    }
  }

  // Old token fallback: use explorer scan APIs (Etherscan/Basescan family) only for aged pools.
  const tokenAgeDays = Math.max(0, (Date.now() / 1000 - createdSec) / 86400);
  const canUseScan = tokenAgeDays >= OLD_TOKEN_SCAN_MIN_DAYS && !!CHAIN_SLUG_TO_ID[chainSlug];
  if (!canUseScan) return null;

  try {
    const latestBlock = Number(latest.number || 0);
    if (latestBlock > 0) {
      const [scanV2Earliest, scanV3Earliest] = await Promise.all([
        getEvmLogs(CHAIN_SLUG_TO_ID[chainSlug], chainSlug, {
          address: poolAddress,
          topic0: V2_SWAP_TOPIC,
          fromBlock: 0,
          toBlock: latestBlock,
          page: 1,
          offset: 100,
          sort: 'asc',
        }).catch(() => []),
        getEvmLogs(CHAIN_SLUG_TO_ID[chainSlug], chainSlug, {
          address: poolAddress,
          topic0: V3_SWAP_TOPIC,
          fromBlock: 0,
          toBlock: latestBlock,
          page: 1,
          offset: 100,
          sort: 'asc',
        }).catch(() => []),
      ]);

      const earliestLogs = [...scanV2Earliest, ...scanV3Earliest]
        .map((l: any) => ({
          topics: l.topics,
          data: l.data,
          blockNumber: Number(l.blockNumber),
          index: Number(l.logIndex || 0),
        }))
        .sort((a: any, b: any) => {
          if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
          return Number(a.index) - Number(b.index);
        });

      for (const log of earliestLogs) {
        const parsed = parseFirstSwapLog(log as any, target, token0, token1);
        if (!parsed) continue;
        return { ...parsed, blockNumber: Number(log.blockNumber) };
      }
    }

    for (const r of ranges) {
      let bestFromScan: FirstSwapData | null = null;
      for (let to = r.to; to >= r.from; to -= 5000) {
        const from = Math.max(r.from, to - 4999);
        const [scanV2, scanV3] = await Promise.all([
          getEvmLogs(CHAIN_SLUG_TO_ID[chainSlug], chainSlug, {
            address: poolAddress,
            topic0: V2_SWAP_TOPIC,
            fromBlock: from,
            toBlock: to,
            page: 1,
            offset: 1000,
            sort: 'desc',
          }).catch(() => []),
          getEvmLogs(CHAIN_SLUG_TO_ID[chainSlug], chainSlug, {
            address: poolAddress,
            topic0: V3_SWAP_TOPIC,
            fromBlock: from,
            toBlock: to,
            page: 1,
            offset: 1000,
            sort: 'desc',
          }).catch(() => []),
        ]);

        const logs = [...scanV2, ...scanV3]
          .map((l: any) => ({
            topics: l.topics,
            data: l.data,
            blockNumber: Number(l.blockNumber),
            index: Number(l.logIndex || 0),
          }))
          .sort((a: any, b: any) => {
            if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
            return Number(a.index) - Number(b.index);
          });

        for (const log of logs) {
          const parsed = parseFirstSwapLog(log as any, target, token0, token1);
          if (!parsed) continue;
          const candidate: FirstSwapData = { ...parsed, blockNumber: Number(log.blockNumber) };
          if (!bestFromScan || candidate.blockNumber < bestFromScan.blockNumber) {
            bestFromScan = candidate;
          }
        }
      }
      if (bestFromScan) return bestFromScan;
    }
  } catch {
    // best-effort fallback only
  }

  return null;
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
    return { price: px, source: 'rpc_v4_initialize' };
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

  const firstSwap = await findFirstSwapData(
    provider,
    chainSlug,
    poolAddress,
    createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
    target,
    token0,
    token1
  );
  if (!firstSwap) return null;

  if (stablecoins.has(quoteToken)) {
    const px = quotePerToken(firstSwap.targetRaw, firstSwap.quoteRaw, targetDecimals, quoteDecimals);
    return px && Number.isFinite(px) && px > 0
      ? { price: px, source: 'rpc_stable_first_swap' }
      : null;
  }

  const wrapped = getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
  if (quoteToken !== wrapped) return null;

  const quotePerTargetNative = quotePerToken(firstSwap.targetRaw, firstSwap.quoteRaw, targetDecimals, quoteDecimals);
  if (!quotePerTargetNative) return null;
  // Reuse shared native-price cache path (onChainPriceService) instead of local hardcoded WETH/USD logic.
  const firstSwapBlock = await provider.getBlock(firstSwap.blockNumber).catch(() => null);
  const firstSwapTs = Number(firstSwapBlock?.timestamp || 0);
  const nativeUsd = await getNativeUsdOnDate(chainId, firstSwapTs);
  if (!nativeUsd || !Number.isFinite(nativeUsd) || nativeUsd <= 0) return null;
  const px = quotePerTargetNative * nativeUsd;
  if (!Number.isFinite(px) || px <= 0) return null;
  return { price: px, source: 'rpc_native_first_swap' };
}

type SolRpcTokenBalance = {
  accountIndex?: number;
  mint?: string;
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

async function callPublicSolRpc<T = any>(method: string, params: any[]): Promise<T | null> {
  const urls = getPublicRpcUrls('solana');
  if (urls.length === 0) return null;

  const now = Date.now();
  const active = urls.filter((url) => (solRpcBackoffUntilByUrl.get(url) || 0) <= now);
  const candidates = active.length > 0 ? active : urls;
  const start = solRpcRoundRobinCursor % candidates.length;
  const ordered = [...candidates.slice(start), ...candidates.slice(0, start)];

  for (let i = 0; i < ordered.length; i++) {
    const url = ordered[i];
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
        const penaltyMs = resp.status === 429 ? 60_000 : resp.status >= 500 ? 20_000 : 10_000;
        solRpcBackoffUntilByUrl.set(url, Date.now() + penaltyMs);
        continue;
      }

      const json: any = await resp.json();
      if (json?.error) {
        const msg = String(json.error?.message || '').toLowerCase();
        const code = Number(json.error?.code || 0);
        // dRPC free tier often returns this for unsupported methods.
        if (msg.includes('method is not available on freetier') || code === 35) {
          solRpcBackoffUntilByUrl.set(url, Date.now() + 6 * 60 * 60 * 1000);
          continue;
        }
        if (msg.includes('rate limit') || code === 429 || msg.includes('too many requests')) {
          solRpcBackoffUntilByUrl.set(url, Date.now() + 90_000);
          continue;
        }
        solRpcBackoffUntilByUrl.set(url, Date.now() + 15_000);
        continue;
      }

      solRpcRoundRobinCursor = (start + i + 1) % candidates.length;
      return (json?.result ?? null) as T | null;
    } catch {
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
  if (!tokenAddress || !poolAddress) return null;
  const target = tokenAddress.toLowerCase();
  const chainCfg = getChainConfig(900);
  const stableMints = new Set((chainCfg.stablecoins || []).map((x) => x.toLowerCase()));
  const wrappedNative = String(chainCfg.wrappedNativeAddress || '').toLowerCase();
  const createdSec = poolCreatedAt ? Math.floor(Date.parse(poolCreatedAt) / 1000) : 0;
  const stopBeforeSec = createdSec > 0 ? Math.max(0, createdSec - 3 * 24 * 3600) : 0;

  const signatures: any[] = [];
  let before: string | undefined;
  for (let page = 0; page < SOL_RPC_SIGNATURE_MAX_PAGES; page++) {
    const pageResult = await callPublicSolRpc<any[]>(
      'getSignaturesForAddress',
      [poolAddress, { limit: SOL_RPC_SIGNATURE_PAGE_LIMIT, before, commitment: 'confirmed' }]
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
  if (signatures.length === 0) return null;

  type SolBaselineCandidate = { ts: number; price: number };
  const candidates: SolBaselineCandidate[] = [];
  const ordered = signatures
    .filter((s: any) => typeof s?.signature === 'string')
    .sort((a: any, b: any) => Number(a?.blockTime || 0) - Number(b?.blockTime || 0));

  for (const row of ordered) {
    const sig = row.signature;
    const tx = await callPublicSolRpc<any>(
      'getTransaction',
      [sig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]
    );
    const pre = tx?.meta?.preTokenBalances as SolRpcTokenBalance[] | undefined;
    const post = tx?.meta?.postTokenBalances as SolRpcTokenBalance[] | undefined;
    if (!Array.isArray(pre) && !Array.isArray(post)) continue;

    const deltas = tokenDeltaMap(pre, post);
    const targetAbs = Math.abs(deltas.get(target) || 0);
    if (!Number.isFinite(targetAbs) || targetAbs <= 0) continue;
    if (targetAbs < SOL_RPC_MIN_TARGET_AMOUNT) continue;

    let bestStableAbs = 0;
    let bestNativeAbs = 0;
    for (const [mint, delta] of deltas.entries()) {
      const abs = Math.abs(delta);
      if (!Number.isFinite(abs) || abs <= 0 || mint === target) continue;
      if (stableMints.has(mint) && abs > bestStableAbs) bestStableAbs = abs;
      if (mint === wrappedNative && abs > bestNativeAbs) bestNativeAbs = abs;
    }

    if (bestNativeAbs <= 0) {
      const preLamports: number[] = Array.isArray(tx?.meta?.preBalances) ? tx.meta.preBalances : [];
      const postLamports: number[] = Array.isArray(tx?.meta?.postBalances) ? tx.meta.postBalances : [];
      const accountKeysRaw: any[] = Array.isArray(tx?.transaction?.message?.accountKeys)
        ? tx.transaction.message.accountKeys
        : [];
      let lamportsAbs = 0;
      for (let i = 0; i < Math.min(preLamports.length, postLamports.length); i++) {
        const keyRow = accountKeysRaw[i];
        const key = typeof keyRow === 'string'
          ? keyRow
          : typeof keyRow?.pubkey === 'string'
            ? keyRow.pubkey
            : '';
        if (!key || key.toLowerCase() === poolAddress.toLowerCase()) continue;
        const deltaLamports = Number(postLamports[i] || 0) - Number(preLamports[i] || 0);
        const abs = Math.abs(deltaLamports) / 1e9;
        if (Number.isFinite(abs) && abs > lamportsAbs) lamportsAbs = abs;
      }
      if (lamportsAbs > 0) bestNativeAbs = lamportsAbs;
    }

    let quoteUsdAbs = 0;
    if (bestStableAbs > 0) {
      quoteUsdAbs = bestStableAbs;
    } else if (bestNativeAbs > 0) {
      const ts = Number(tx?.blockTime || row?.blockTime || 0);
      const nativeUsd = await getNativeUsdOnDate(900, ts > 0 ? ts : undefined);
      if (nativeUsd && Number.isFinite(nativeUsd) && nativeUsd > 0) {
        quoteUsdAbs = bestNativeAbs * nativeUsd;
      }
    }
    if (!Number.isFinite(quoteUsdAbs) || quoteUsdAbs <= 0) continue;
    if (quoteUsdAbs < SOL_RPC_MIN_QUOTE_USD) continue;

    const p = quoteUsdAbs / targetAbs;
    if (!Number.isFinite(p) || p <= 0 || p > 1e8) continue;
    candidates.push({ ts: Number(tx?.blockTime || row?.blockTime || 0) || 0, price: p });
    if (candidates.length >= SOL_RPC_EARLIEST_CANDIDATES) break;
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.ts - b.ts || a.price - b.price);
  const picked = candidates.slice(0, Math.min(candidates.length, Math.max(3, SOL_RPC_EARLIEST_CANDIDATES)));
  const prices = picked.map((c) => c.price).sort((a, b) => a - b);
  const chosenPrice = prices[Math.floor(prices.length / 2)];
  const chosen = { ts: picked[0]?.ts || candidates[0]?.ts || 0, price: chosenPrice };
  return Number.isFinite(chosen.price) && chosen.price > 0 ? chosen.price : null;
}

async function applyBaselineMultiples(
  chainId: string,
  geckoNetwork: string,
  tokens: Array<{
    address: string;
    poolAddress?: string;
    poolCreatedAt?: string;
    price?: number;
    priceChange1h?: number;
    priceChange6h?: number;
    priceChange24h?: number;
    launchMultiple?: number;
    creatorAddress?: string;
    creatorUrl?: string;
    creatorLabel?: string;
  }>
): Promise<void> {
  // 1) Existing baseline -> direct multiple
  await Promise.all(tokens.map(async (token) => {
    try {
      const current = Number(token.price || 0);
      if (!Number.isFinite(current) || current <= 0) return;

      const baseline = await readTokenBaselineCache(chainId, token.address);
      if (!baseline || !isTrustedBaselineSource(baseline.baselineSource)) return;
      if (baseline.baselineSource === 'first_seen_fallback') return;

      const multipleRaw = current / baseline.baselinePrice;
      if (!Number.isFinite(multipleRaw) || multipleRaw <= 0) return;
      const multiple = Math.max(1, multipleRaw);
      token.launchMultiple = multiple;
      await writeTokenMetaCache(chainId, token.address, {
        creatorAddress: token.creatorAddress,
        creatorUrl: token.creatorUrl,
        creatorLabel: token.creatorLabel,
        launchMultiple: multiple
      });
    } catch {
      // best-effort only
    }
  }));

  // 2) Missing/provisional baseline -> attempt external initial price (budgeted).
  //    We treat first_seen_fallback as provisional and keep trying to upgrade it.
  const externalCandidates = (await Promise.all(tokens.map(async (t) => {
    const current = Number(t.price || 0);
    if (!Number.isFinite(current) || current <= 0) return null;
    const baseline = await readTokenBaselineCache(chainId, t.address);
    if (!baseline || !isTrustedBaselineSource(baseline.baselineSource)) {
      return { token: t, baselineSource: undefined as string | undefined };
    }
    if (baseline.baselineSource === 'first_seen_fallback') {
      return { token: t, baselineSource: baseline.baselineSource };
    }
    return null;
  }))).filter(Boolean) as Array<{ token: typeof tokens[number]; baselineSource?: string }>;

  if (externalCandidates.length === 0) return;

  const targets = pickVerifyTargets(externalCandidates, BASELINE_EXTERNAL_FETCH_BUDGET_PER_RUN);
  const limiter = pLimit(4);
  await Promise.all(targets.map((candidate) => limiter(async () => {
    const token = candidate.token;
    try {
      const hasCooldown = await readBaselineRetryCooldown(chainId, token.address);
      const isFallbackBaseline = candidate.baselineSource === 'first_seen_fallback';
      // Keep retrying first-seen fallback baselines so x1 can self-heal quickly.
      if (hasCooldown && !isFallbackBaseline) return;

      // Recheck cache in case another worker already wrote baseline.
      const cachedBaseline = await readTokenBaselineCache(chainId, token.address);
      if (
        cachedBaseline &&
        isTrustedBaselineSource(cachedBaseline.baselineSource) &&
        Number.isFinite(cachedBaseline.baselinePrice) &&
        cachedBaseline.baselinePrice > 0 &&
        cachedBaseline.baselineSource !== 'first_seen_fallback'
      ) {
        const current = Number(token.price || 0);
        if (!Number.isFinite(current) || current <= 0) return;
        const multipleRaw = current / cachedBaseline.baselinePrice;
        if (!Number.isFinite(multipleRaw) || multipleRaw <= 0) return;
        const multiple = Math.max(1, multipleRaw);
        token.launchMultiple = multiple;
        await writeTokenMetaCache(chainId, token.address, {
          creatorAddress: token.creatorAddress,
          creatorUrl: token.creatorUrl,
          creatorLabel: token.creatorLabel,
          launchMultiple: multiple
        });
        return;
      }

      const externalBaseline = await fetchExternalBaselinePrice(chainId, geckoNetwork, token);
      const current = Number(token.price || 0);
      const maybeWriteDerivedProxy = async () => {
        if (chainId !== 'solana') return false;
        if (!Number.isFinite(current) || current <= 0) return false;

        const createdMs = token.poolCreatedAt ? Date.parse(token.poolCreatedAt) : NaN;
        const ageHours = Number.isFinite(createdMs) ? Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60)) : NaN;
        const c1h = Number(token.priceChange1h || 0);
        const c6h = Number(token.priceChange6h || 0);
        const c24h = Number(token.priceChange24h || 0);

        let pct: number | null = null;
        if (Number.isFinite(ageHours) && ageHours <= 2 && Number.isFinite(c1h) && c1h > 0) pct = c1h;
        else if (Number.isFinite(ageHours) && ageHours <= 8 && Number.isFinite(c6h) && c6h > 0) pct = c6h;
        else if (Number.isFinite(c24h) && c24h > 0) pct = c24h;
        if (!Number.isFinite(pct || NaN) || (pct || 0) <= 0) return false;

        const growth = 1 + Number(pct) / 100;
        if (!Number.isFinite(growth) || growth <= 1) return false;
        const derivedBaseline = current / growth;
        if (!Number.isFinite(derivedBaseline) || derivedBaseline <= 0) return false;

        await writeTokenBaselineCache(chainId, token.address, derivedBaseline, 'derived_change_proxy');
        const multipleRaw = current / derivedBaseline;
        if (!Number.isFinite(multipleRaw) || multipleRaw <= 0) return false;
        const multiple = Math.max(1, multipleRaw);
        token.launchMultiple = multiple;
        await writeTokenMetaCache(chainId, token.address, {
          creatorAddress: token.creatorAddress,
          creatorUrl: token.creatorUrl,
          creatorLabel: token.creatorLabel,
          launchMultiple: multiple,
        });
        return true;
      };

      if (externalBaseline && Number.isFinite(externalBaseline.price) && externalBaseline.price > 0) {
        const tentativeMultiple = Number.isFinite(current) && current > 0 ? (current / externalBaseline.price) : NaN;
        if (
          chainId === 'solana' &&
          externalBaseline.source === 'solana_public_rpc' &&
          Number.isFinite(tentativeMultiple) &&
          tentativeMultiple > 0 &&
          token.poolCreatedAt
        ) {
          const createdMs = Date.parse(token.poolCreatedAt);
          const ageHours = Number.isFinite(createdMs) ? Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60)) : NaN;
          const allowedMax = Number.isFinite(ageHours)
            ? (ageHours <= 1 ? 30 : ageHours <= 6 ? 80 : ageHours <= 24 ? 250 : 2000)
            : 2000;
          if (tentativeMultiple > allowedMax) {
            // Ignore suspicious early outlier baseline (usually dust-sized first swap).
            await writeBaselineRetryCooldown(chainId, token.address);
            return;
          }
        }
        await writeTokenBaselineCache(chainId, token.address, externalBaseline.price, externalBaseline.source || 'gecko_launch_window');
        if (Number.isFinite(current) && current > 0) {
          const multipleRaw = current / externalBaseline.price;
          if (Number.isFinite(multipleRaw) && multipleRaw > 0) {
            const multiple = Math.max(1, multipleRaw);
            token.launchMultiple = multiple;
            await writeTokenMetaCache(chainId, token.address, {
              creatorAddress: token.creatorAddress,
              creatorUrl: token.creatorUrl,
              creatorLabel: token.creatorLabel,
              launchMultiple: multiple
            });
          }
        }
        return;
      }

      // Coverage fallback for Solana: derive baseline from already-fetched short-term price change.
      if (await maybeWriteDerivedProxy()) return;

      // External baseline unavailable now: set cooldown to avoid hammering.
      await writeBaselineRetryCooldown(chainId, token.address);

      // Keep displaying a stable value even when external enrichment is unavailable.
      if (
        cachedBaseline &&
        isTrustedBaselineSource(cachedBaseline.baselineSource) &&
        Number.isFinite(cachedBaseline.baselinePrice) &&
        cachedBaseline.baselinePrice > 0 &&
        cachedBaseline.baselineSource !== 'first_seen_fallback'
      ) {
        const currentFallback = Number(token.price || 0);
        if (Number.isFinite(currentFallback) && currentFallback > 0) {
          const multipleRaw = currentFallback / cachedBaseline.baselinePrice;
          if (Number.isFinite(multipleRaw) && multipleRaw > 0) {
            token.launchMultiple = Math.max(1, multipleRaw);
            await writeTokenMetaCache(chainId, token.address, {
              creatorAddress: token.creatorAddress,
              creatorUrl: token.creatorUrl,
              creatorLabel: token.creatorLabel,
              launchMultiple: token.launchMultiple
            });
          }
        }
      }
    } catch {
      // best-effort only
    }
  })));

  // 3) Coverage fallback:
  // after external attempts, any remaining token without baseline gets first-seen baseline x1.
  await Promise.all(tokens.map(async (token) => {
    try {
      if (Number.isFinite(token.launchMultiple || NaN) && (token.launchMultiple || 0) > 0) return;
      const baseline = await readTokenBaselineCache(chainId, token.address);
      if (
        baseline &&
        isTrustedBaselineSource(baseline.baselineSource) &&
        Number.isFinite(baseline.baselinePrice) &&
        baseline.baselinePrice > 0 &&
        baseline.baselineSource !== 'first_seen_fallback'
      ) {
        const current = Number(token.price || 0);
        if (!Number.isFinite(current) || current <= 0) return;
        const multipleRaw = current / baseline.baselinePrice;
        if (!Number.isFinite(multipleRaw) || multipleRaw <= 0) return;
        const multiple = Math.max(1, multipleRaw);
        token.launchMultiple = multiple;
        await writeTokenMetaCache(chainId, token.address, {
          creatorAddress: token.creatorAddress,
          creatorUrl: token.creatorUrl,
          creatorLabel: token.creatorLabel,
          launchMultiple: multiple
        });
        return;
      }

      const current = Number(token.price || 0);
      if (!Number.isFinite(current) || current <= 0) return;
      await writeTokenBaselineCache(chainId, token.address, current, 'first_seen_fallback');
    } catch {
      // best-effort only
    }
  }));
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

  // Warm from metadata cache first (keeps creator/multiple stable across DB reloads)
  await Promise.all(tokens.map(async (token) => {
    const cached = await readTokenMetaCache(chainId, token.address);
    if (!cached) return;
    if (!token.creatorAddress && cached.creatorAddress) token.creatorAddress = cached.creatorAddress;
    if (!(token as any).creatorUrl && cached.creatorUrl) (token as any).creatorUrl = cached.creatorUrl;
    if (!(token as any).creatorLabel && cached.creatorLabel) (token as any).creatorLabel = cached.creatorLabel;
    if (!Number.isFinite(token.launchMultiple || NaN) && Number.isFinite(cached.launchMultiple || NaN)) {
      token.launchMultiple = cached.launchMultiple;
    }
  }));

  // Step 1: deterministic suffix detection
  for (const token of tokens) {
    token.launchpad = detectBySuffix(chainId, token.address) || undefined;
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
        } catch {
          // best-effort creator discovery only
        }
      })));
    }
  }
}

async function enrichLaunchMultiplesForTrending(
  chainId: string,
  geckoNetwork: string,
  tokens: Array<{ address: string; launchpad?: string; poolAddress?: string; poolCreatedAt?: string; price?: number; launchMultiple?: number; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string }>
): Promise<void> {
  if (!LAUNCH_MULTIPLE_ENRICH_ENABLED) return;
  if (tokens.length === 0) return;

  // Cheapest mode: no external historical API calls.
  // Store first-seen price per token and derive multiple from current/baseline.
  if (LAUNCH_MULTIPLE_BASELINE_ONLY) {
    await applyBaselineMultiples(chainId, geckoNetwork, tokens);
    return;
  }

  const backoffUntil = await readGeckoCandleBackoff(chainId);
  if (Date.now() < backoffUntil) {
    return;
  }

  const candidates = tokens
    .filter((t) => typeof t.price === 'number' && t.price > 0 && !!t.poolAddress)
    .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));

  if (candidates.length === 0) return;

  const targets = pickVerifyTargets(candidates, LAUNCH_MULTIPLE_BUDGET_PER_RUN);
  for (const token of targets) {
    try {
      const cached = await readTokenMetaCache(chainId, token.address);
      if (cached && Number.isFinite(cached.launchMultiple || NaN)) {
        token.launchMultiple = cached.launchMultiple;
        continue;
      }
      const dynamicBackoffUntil = await readGeckoCandleBackoff(chainId);
      if (Date.now() < dynamicBackoffUntil) break;

      const now = Date.now();
      const createdMs = token.poolCreatedAt ? Date.parse(token.poolCreatedAt) : NaN;
      const ageHours = Number.isFinite(createdMs) ? Math.max(0, (now - createdMs) / (1000 * 60 * 60)) : NaN;

      let timeframe: 'm5' | 'h1' | 'h6' | 'd1' = 'h1';
      let limit = 96;
      if (Number.isFinite(ageHours) && ageHours <= 12) {
        timeframe = 'm5';
        limit = Math.min(180, Math.max(36, Math.ceil((ageHours * 60) / 5) + 12));
      } else if (Number.isFinite(ageHours) && ageHours >= 24) {
        // Prefer daily candles for older pools; first daily candle is a better launch proxy
        // than short-range hourly windows, while keeping API cost bounded.
        timeframe = 'd1';
        limit = Math.min(365, Math.max(14, Math.ceil(ageHours / 24) + 3));
      } else if (Number.isFinite(ageHours)) {
        timeframe = 'h1';
        limit = Math.min(180, Math.max(36, Math.ceil(ageHours) + 12));
      }

      await waitForGeckoCandleSlot();
      let candles = await getDexCandlestickData(chainId, token.poolAddress!, timeframe, limit);
      if ((!Array.isArray(candles) || candles.length < 2) && LAUNCH_MULTIPLE_USE_GECKO_FALLBACK) {
        candles = await getGeckoCandlestickData(geckoNetwork, token.poolAddress!, timeframe, limit);
      }
      if (!Array.isArray(candles) || candles.length === 0) continue;

      const first = candles[0];
      const last = candles[candles.length - 1];
      const open = typeof first?.open === 'number' ? first.open : Number(first?.open || 0);
      const geckoCurrent = typeof last?.close === 'number' ? last.close : Number(last?.close || 0);
      const current = Number.isFinite(geckoCurrent) && geckoCurrent > 0
        ? geckoCurrent
        : Number(token.price || 0);
      if (!Number.isFinite(open) || open <= 0 || !Number.isFinite(current) || current <= 0) continue;

      const multiple = current / open;
      if (!Number.isFinite(multiple) || multiple <= 0) continue;

      token.launchMultiple = multiple;
      await writeTokenMetaCache(chainId, token.address, {
        creatorAddress: token.creatorAddress,
        creatorUrl: token.creatorUrl,
        creatorLabel: token.creatorLabel,
        launchMultiple: multiple
      });
    } catch (error) {
      if (isRateLimitError(error)) {
        const until = Date.now() + GECKO_CANDLE_BACKOFF_MS;
        await writeGeckoCandleBackoff(chainId, until);
        break;
      }
      // keep token without multiple when upstream API is unavailable
    }
  }

  // Optional synthetic fallback:
  // use first seen price as baseline when no on-chain launch baseline is available.
  if (!LAUNCH_MULTIPLE_ALLOW_SYNTHETIC_BASELINE) {
    return;
  }

  await applyBaselineMultiples(chainId, geckoNetwork, tokens);
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
    // Launchpad enrichment: suffix first, then API verification where needed.
    await enrichLaunchpadsForTrending(
      chain.id,
      tokens as Array<{ address: string; launchpad?: string; imageUrl?: string; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; launchMultiple?: number; poolAddress?: string; poolCreatedAt?: string; price?: number }>
    );
    await enrichLaunchMultiplesForTrending(
      chain.id,
      chain.geckoNetwork,
      tokens as Array<{ address: string; poolAddress?: string; poolCreatedAt?: string; price?: number; launchMultiple?: number; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string }>
    );

    // Save to PostgreSQL database
    const savedTokens = await saveTrendingTokens(chain.id, tokens);
    const cachedTokens = savedTokens.length > 0 ? savedTokens : tokens;

    // Update memory cache for instant API access
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain.id);
    memoryCache.set(cacheKey, cachedTokens, CACHE_TTL.TRENDING_TOKENS);

    // Also update Redis cache for legacy compatibility
    const redisCacheKey = `trending:live:${chain.id}:5m`;
    await setRedisCache(redisCacheKey, JSON.stringify(cachedTokens), 600);

    logger.info(LogCode.SYS_INFO, `Saved ${cachedTokens.length} tokens for ${chain.name} to DB + cache`);

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
  const startTime = Date.now();

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
export async function refreshSingleChain(chainId: string): Promise<boolean> {
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  if (!chain) {
    logger.error(LogCode.SYS_ERROR, `Unknown chain: ${chainId}`);
    return false;
  }

  await refreshChainTokens(chain);
  return true;
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
