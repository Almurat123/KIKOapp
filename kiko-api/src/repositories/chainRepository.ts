/**
 * Chain Data Repository
 */

import prisma, { withRetry } from '../db/prisma.js';
import { get, set } from '../cache/redis.js';
import { ChainData } from '../services/defillama.js';

/**
 * Save chains data to database and cache
 * Only updates TVL and logo_url from DeFiLlama, preserves local metrics (volume, txns, wallets, gas)
 */
export async function saveChainsData(chains: ChainData[]): Promise<void> {
  try {
    await withRetry(async () => {
      for (const chain of chains) {
        await prisma.chainMetric.upsert({
          where: { name: chain.name },
          update: {
            tvl: chain.tvl,
            tvlChange24h: chain.tvlChange24h,
            logoUrl: chain.logoUrl,
            // Only update other fields if they have values
            volume24h: chain.volume24h ?? undefined,
            txns24h: chain.txns24h !== undefined ? BigInt(chain.txns24h) : undefined,
            activeWallets: chain.activeWallets !== undefined ? BigInt(chain.activeWallets) : undefined,
            poolsCount: chain.poolsCount ?? undefined,
            tokensCount: chain.tokensCount ?? undefined,
            gasPrice: chain.gasPrice ?? undefined,
            contracts24h: chain.contracts24h ?? undefined,
            contracts7d: chain.contracts7d ?? undefined,
          },
          create: {
            name: chain.name,
            tvl: chain.tvl,
            tvlChange24h: chain.tvlChange24h,
            logoUrl: chain.logoUrl,
            volume24h: chain.volume24h ?? null,
            txns24h: chain.txns24h !== undefined ? BigInt(chain.txns24h) : null,
            activeWallets: chain.activeWallets !== undefined ? BigInt(chain.activeWallets) : null,
            poolsCount: chain.poolsCount ?? null,
            tokensCount: chain.tokensCount ?? null,
            gasPrice: chain.gasPrice ?? null,
            contracts24h: chain.contracts24h ?? null,
            contracts7d: chain.contracts7d ?? null,
          }
        });
      }
    });

    // Save to Redis cache (24 hour TTL)
    await set('market:chains', JSON.stringify(chains), 86400);

    console.log(`Saved ${chains.length} chains to database`);
  } catch (error) {
    console.error('Error saving chains data:', error);
    throw error;
  }
}

/**
 * Get chains data from cache or database
 * Only returns chains with local data (from update-chains-metrics.sql)
 * Does NOT fetch new chains from DeFiLlama
 */
export async function getChainsData(): Promise<ChainData[]> {
  try {
    // Try Redis first
    try {
      const cached = await get('market:chains');
      if (cached) {
        const data = JSON.parse(cached);
        if (data && data.length > 0) {
          return data;
        }
      }
    } catch (redisError) {
      console.warn('[GetChainsData] Redis error, falling back to database:', redisError);
    }

    // Get chains from database (all chains with TVL or metrics)
    const result = await prisma.chainMetric.findMany({
      where: {
        OR: [
          { tvl: { gt: 0 } },
          { volume24h: { not: null } },
          { txns24h: { not: null } },
          { activeWallets: { not: null } },
          { gasPrice: { not: null } }
        ]
      },
      orderBy: { tvl: 'desc' }
    });

    if (result.length > 0) {
      const chains = result.map((row) => ({
        name: row.name,
        tvl: row.tvl ? Number(row.tvl) : 0,
        tvlChange24h: row.tvlChange24h ? Number(row.tvlChange24h) : 0,
        volume24h: row.volume24h ? Number(row.volume24h) : undefined,
        txns24h: row.txns24h ? Number(row.txns24h) : undefined,
        poolsCount: row.poolsCount ?? undefined,
        tokensCount: row.tokensCount ?? undefined,
        activeWallets: row.activeWallets ? Number(row.activeWallets) : undefined,
        gasPrice: row.gasPrice ?? undefined,
        contracts24h: row.contracts24h ?? undefined,
        contracts7d: row.contracts7d ?? undefined,
        logoUrl: row.logoUrl ?? undefined,
      }));

      // Cache the data
      await set('market:chains', JSON.stringify(chains), 86400);
      return chains;
    }

    // If no local data exists, return empty array
    // Don't fetch from DeFiLlama to avoid adding unwanted chains
    console.log('[GetChainsData] No local chain data found in database');
    return [];
  } catch (error) {
    console.error('Error getting chains data:', error);
    return [];
  }
}

/**
 * Get last update time for chain data
 */
export async function getLastUpdateTime(): Promise<Date | null> {
  try {
    const result = await prisma.chainMetric.aggregate({
      _max: {
        updatedAt: true
      }
    });
    return result._max.updatedAt || null;
  } catch (error) {
    console.error('Error getting last update time:', error);
    return null;
  }
}
