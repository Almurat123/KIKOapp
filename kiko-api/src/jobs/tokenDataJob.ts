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
import { saveTrendingTokens, getLastUpdateTime } from '../repositories/tokenRepository.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';

/**
 * Supported chains configuration
 * Each chain has its own refresh schedule to avoid rate limiting
 */
const SUPPORTED_CHAINS = [
  { id: 'eth', name: 'Ethereum', geckoNetwork: 'eth' },
  { id: 'solana', name: 'Solana', geckoNetwork: 'solana' },
  { id: 'base', name: 'Base', geckoNetwork: 'base' },
  { id: 'bsc', name: 'BSC', geckoNetwork: 'bsc' },
  { id: 'arbitrum', name: 'Arbitrum', geckoNetwork: 'arbitrum' },
];


// Refresh interval in minutes (staggered to avoid hitting rate limits)
const REFRESH_INTERVAL_MINUTES = 5;
// Delay between chains in milliseconds (spread load)
const CHAIN_DELAY_MS = 5000; // 5 seconds between each chain (reduced from 30s)
// Number of tokens to fetch per chain
const TOKENS_PER_CHAIN = 50;

/**
 * Refresh trending tokens for a single chain
 * Tries GeckoTerminal first, falls back to DexScreener if needed
 */
import { set } from '../cache/redis.js';

/**
 * Refresh trending tokens for a single chain
 * Uses DexScreener Premium (WebSocket) as primary source for accurate trending
 */
async function refreshChainTokens(chain: typeof SUPPORTED_CHAINS[0], force = false): Promise<void> {
  try {
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

    // Use DexScreener Premium (WebSocket-based) as primary source
    // This matches the DexScreener website's trending order
    let tokens = await getTrendingTokensPremium(chain.id, 100);

    // Fallback to GeckoTerminal if DexScreener fails
    if (tokens.length < 10) {
      console.log(`[TokenJob] DexScreener returned ${tokens.length} tokens, trying GeckoTerminal fallback...`);
      const geckoTokens = await getTrendingTokens(chain.geckoNetwork, 100, '5m');
      if (geckoTokens.length > tokens.length) {
        tokens = geckoTokens;
        console.log(`[TokenJob] Using GeckoTerminal fallback: ${tokens.length} tokens`);
      }
    }

    if (tokens.length === 0) {
      console.warn(`[TokenJob] No tokens found for ${chain.name}`);
      return;
    }

    console.log(`[TokenJob] Got ${tokens.length} trending tokens for ${chain.name}`);

    // Save to PostgreSQL database
    await saveTrendingTokens(chain.id, tokens);

    // Update memory cache for instant API access
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain.id);
    memoryCache.set(cacheKey, tokens, CACHE_TTL.TRENDING_TOKENS);

    // Also update Redis cache for legacy compatibility
    const redisCacheKey = `trending:live:${chain.id}:5m`;
    await set(redisCacheKey, JSON.stringify(tokens), 600);

    console.log(`[TokenJob] Saved ${tokens.length} tokens for ${chain.name} to DB + cache`);

  } catch (error) {
    console.error(`[TokenJob] Error refreshing ${chain.name}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Refresh all chains with staggered timing
 * This spreads the API load and avoids rate limiting
 */
async function refreshAllChains(force = false): Promise<void> {
  const startTime = Date.now();

  for (let i = 0; i < SUPPORTED_CHAINS.length; i++) {
    const chain = SUPPORTED_CHAINS[i];
    await refreshChainTokens(chain, force);

    // Add delay between chains (except for the last one)
    if (i < SUPPORTED_CHAINS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CHAIN_DELAY_MS));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[TokenJob] Refreshed ${SUPPORTED_CHAINS.length} chains in ${duration}s`);
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
  // Multi-chain refresh: Every 5 minutes
  cron.schedule(`*/${REFRESH_INTERVAL_MINUTES} * * * *`, () => refreshAllChains(), {
    timezone: 'UTC',
  });

  console.log(`[TokenJob] Scheduled: Every ${REFRESH_INTERVAL_MINUTES}min (${SUPPORTED_CHAINS.map(c => c.name).join(', ')})`);

  // Run initial refresh on startup (with delay for services to be ready)
  setTimeout(() => {
    refreshAllChains();
  }, 5000); // Wait 5 seconds for services to be ready
}
