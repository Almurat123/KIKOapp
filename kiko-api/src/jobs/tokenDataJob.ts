/**
 * Token Data Refresh Job
 * Runs periodically to fetch and store trending tokens for multiple chains
 * 
 * Supported chains: Ethereum, Base, BSC, Arbitrum
 * Uses GeckoTerminal (free) as primary source, DexScreener as fallback
 */

import cron from 'node-cron';
import { getTrendingTokens } from '../services/geckoTerminal.js';
import { getTrendingTokensPremium } from '../services/dexscreener.js';
import { saveTrendingTokens, getLastUpdateTime, getTrendingTokens as getStoredTrendingTokens } from '../repositories/tokenRepository.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { validateTrendingTokenForListing } from '../services/trendingValidation.js';
import { detectLaunchpadToken } from '../services/ai/launchpadDetector.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import pLimit from 'p-limit';
import { getCandlestickData as getGeckoCandlestickData } from '../services/geckoTerminal.js';
import { acquireLock, releaseLock, set as setRedisCache, get as getRedisCache } from '../cache/redis.js';

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
const LAUNCH_MULTIPLE_ENRICH_ENABLED = (process.env.LAUNCH_MULTIPLE_ENRICH_ENABLED || 'false').toLowerCase() === 'true';
const LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN = Math.max(
  48,
  Number(process.env.LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN || '80')
);
const LAUNCH_MULTIPLE_BUDGET_PER_RUN = Math.max(
  4,
  Number(process.env.LAUNCH_MULTIPLE_BUDGET_PER_RUN || '8')
);
const TOKEN_META_CACHE_TTL_SECONDS = Math.max(
  60 * 60,
  Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`)
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
  launchMultiple?: number;
  updatedAt?: number;
};

const geckoCandleBackoffByChain = new Map<string, number>();

function isRateLimitError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests');
}

function tokenMetaCacheKey(chainId: string, address: string): string {
  return `token:meta:v1:${chainId}:${address.toLowerCase()}`;
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
  if (!meta.creatorAddress && !Number.isFinite(meta.launchMultiple || NaN)) return;
  try {
    await setRedisCache(
      tokenMetaCacheKey(chainId, address),
      JSON.stringify({
        creatorAddress: meta.creatorAddress,
        launchMultiple: meta.launchMultiple,
        updatedAt: Date.now(),
      }),
      TOKEN_META_CACHE_TTL_SECONDS
    );
  } catch {
    // ignore cache write errors
  }
}

function pickCreatorAddress(detected: any): string | undefined {
  const data = detected?.data || {};
  const candidates: unknown[] = [
    data.creatorAddress,
    data.creator,
    data.userAddress,
    data.msg_sender,
    data.deployer,
    data.owner,
    data.requestor,
  ];

  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (value.length >= 20) return value;
  }
  return undefined;
}

async function enrichLaunchpadsForTrending(
  chainId: string,
  tokens: Array<{ address: string; launchpad?: string; imageUrl?: string; creatorAddress?: string; launchMultiple?: number; poolAddress?: string; poolCreatedAt?: string; price?: number }>
): Promise<void> {
  if (tokens.length === 0) return;

  // Warm from metadata cache first (keeps creator/multiple stable across DB reloads)
  await Promise.all(tokens.map(async (token) => {
    const cached = await readTokenMetaCache(chainId, token.address);
    if (!cached) return;
    if (!token.creatorAddress && cached.creatorAddress) token.creatorAddress = cached.creatorAddress;
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
    if (flapCandidates.length === 0) return;

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
        token.creatorAddress = pickCreatorAddress(detected);
        await writeTokenMetaCache(chainId, token.address, {
          creatorAddress: token.creatorAddress,
          launchMultiple: token.launchMultiple
        });
        if (!token.imageUrl && typeof (detected as any)?.data?.imageUrl === 'string') {
          token.imageUrl = (detected as any).data.imageUrl;
        }
      } catch {
        // Keep suffix classification when verification fails due to transient errors.
      }
    })));
    return;
  }

  // Step 3: API verification for Base tokens without deterministic suffix
  if (chainId !== 'base') return;

  const unresolved = tokens.filter((t) => !t.launchpad && t.address.startsWith('0x'));
  if (unresolved.length === 0) return;
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
      token.creatorAddress = pickCreatorAddress(detected);
      await writeTokenMetaCache(chainId, token.address, {
        creatorAddress: token.creatorAddress,
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

async function enrichLaunchMultiplesForTrending(
  chainId: string,
  geckoNetwork: string,
  tokens: Array<{ address: string; poolAddress?: string; poolCreatedAt?: string; price?: number; launchMultiple?: number; creatorAddress?: string }>
): Promise<void> {
  if (!LAUNCH_MULTIPLE_ENRICH_ENABLED) return;
  if (tokens.length === 0) return;
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

      let timeframe: 'm5' | 'h1' | 'h6' = 'h1';
      let limit = 96;
      if (Number.isFinite(ageHours) && ageHours <= 12) {
        timeframe = 'm5';
        limit = Math.min(180, Math.max(36, Math.ceil((ageHours * 60) / 5) + 12));
      } else if (Number.isFinite(ageHours) && ageHours > 40 * 24) {
        timeframe = 'h6';
        limit = Math.min(180, Math.max(32, Math.ceil(ageHours / 6) + 8));
      } else if (Number.isFinite(ageHours)) {
        timeframe = 'h1';
        limit = Math.min(180, Math.max(36, Math.ceil(ageHours) + 12));
      }

      const candles = await getGeckoCandlestickData(geckoNetwork, token.poolAddress!, timeframe, limit);
      if (!Array.isArray(candles) || candles.length === 0) continue;

      const first = candles[0];
      const open = typeof first?.open === 'number' ? first.open : Number(first?.open || 0);
      const current = Number(token.price || 0);
      if (!Number.isFinite(open) || open <= 0 || !Number.isFinite(current) || current <= 0) continue;

      const multiple = current / open;
      if (!Number.isFinite(multiple) || multiple <= 0) continue;

      token.launchMultiple = multiple;
      await writeTokenMetaCache(chainId, token.address, {
        creatorAddress: token.creatorAddress,
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
      tokens as Array<{ address: string; launchpad?: string; imageUrl?: string; creatorAddress?: string; launchMultiple?: number; poolAddress?: string; poolCreatedAt?: string; price?: number }>
    );
    await enrichLaunchMultiplesForTrending(
      chain.id,
      chain.geckoNetwork,
      tokens as Array<{ address: string; poolAddress?: string; poolCreatedAt?: string; price?: number; launchMultiple?: number; creatorAddress?: string }>
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
