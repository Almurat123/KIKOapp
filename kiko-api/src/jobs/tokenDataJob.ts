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
import { acquireLock, releaseLock, set } from '../cache/redis.js';
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
    console.log(`[TokenJob] Skipping refresh for ${chain.name} - update already in progress`);
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
      console.log(`[TokenJob] Skipping refresh for ${chain.name} - another instance holds the lock`);
      return;
    }

    const REFRESH_5M_MS = 4.5 * 60 * 1000; // 4.5 minutes

    // Smart Refresh: Check if we have fresh data in database
    if (!force) {
      const lastUpdate = await getLastUpdateTime(chain.id);
      if (lastUpdate && (Date.now() - lastUpdate.getTime()) < REFRESH_5M_MS) {
        console.log(`[TokenJob] Tokens for ${chain.name} are fresh, skipping API call`);
        return;
      }
    }

    console.log(`[TokenJob] Fetching trending tokens for ${chain.name} via DexScreener Premium...`);

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
      console.warn(`[TokenJob] No tokens found for ${chain.name}`);
      return;
    }

    console.log(`[TokenJob] Got ${tokens.length} trending tokens for ${chain.name}`);

    // Zero-cost validation: delist non-positive liquidity and obvious malformed entries
    const beforeCount = tokens.length;
    tokens = tokens.filter((t) => validateTrendingTokenForListing(chain.id, t).ok);
    const removed = beforeCount - tokens.length;
    if (removed > 0) {
      console.log(`[TokenJob] Filtered out ${removed} invalid tokens for ${chain.name}`);
    }

    // Guardrail: avoid replacing good data with a partial refresh (e.g. when rate-limited).
    const existing = await getStoredTrendingTokens(chain.id, TOKENS_PER_CHAIN);
    if (existing.length >= 70 && tokens.length < 50) {
      console.warn(`[TokenJob] New list too small (${tokens.length}) for ${chain.name}; keeping existing (${existing.length})`);
      return;
    }

    // Save to PostgreSQL database
    const savedTokens = await saveTrendingTokens(chain.id, tokens);
    const cachedTokens = savedTokens.length > 0 ? savedTokens : tokens;

    // Update memory cache for instant API access
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain.id);
    memoryCache.set(cacheKey, cachedTokens, CACHE_TTL.TRENDING_TOKENS);

    // Also update Redis cache for legacy compatibility
    const redisCacheKey = `trending:live:${chain.id}:5m`;
    await set(redisCacheKey, JSON.stringify(cachedTokens), 600);

    console.log(`[TokenJob] Saved ${cachedTokens.length} tokens for ${chain.name} to DB + cache`);

  } catch (error) {
    console.error(`[TokenJob] Error refreshing ${chain.name}:`, error instanceof Error ? error.message : error);
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
  console.log(`[TokenJob] Refreshed ${PRIMARY_CHAINS.length} primary chains in ${duration}s`);
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
  console.log(`[TokenJob] Refreshed ${SECONDARY_CHAINS.length} secondary chains in ${duration}s`);
}

/**
 * Refresh a single chain (for targeted refresh)
 */
export async function refreshSingleChain(chainId: string): Promise<boolean> {
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  if (!chain) {
    console.error(`[TokenJob] Unknown chain: ${chainId}`);
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

  console.log(`[TokenJob] Scheduled: Primary chains every ${PRIMARY_REFRESH_INTERVAL_MINUTES}min (${PRIMARY_CHAINS.map(c => c.name).join(', ')})`);
  console.log(`[TokenJob] Scheduled: Secondary chains every ${SECONDARY_REFRESH_INTERVAL_HOURS}h (${SECONDARY_CHAINS.map(c => c.name).join(', ')})`);

  // Run initial refresh on startup (with delay for services to be ready)
  setTimeout(() => {
    console.log('[TokenJob] Starting initial token refresh...');
    refreshPrimaryChains();  // Start with primary chains
    // Secondary chains will wait for their scheduled time
  }, 30000); // Wait 30 seconds for services to be ready
}
