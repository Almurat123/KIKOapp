/**
 * Chain Data Repository
 */

import { pool } from '../db/connection.js';
import { get, set } from '../cache/redis.js';
import { ChainData } from '../services/defillama.js';

/**
 * Save chains data to database and cache
 * Only updates TVL and logo_url from DeFiLlama, preserves local metrics (volume, txns, wallets, gas)
 */
export async function saveChainsData(chains: ChainData[]): Promise<void> {
  try {
    // Don't delete existing data - only update TVL and related fields
    // This preserves locally saved metrics from update-chains-metrics.sql

    for (const chain of chains) {
      await pool.query(
        `INSERT INTO chain_metrics 
         (chain_name, tvl, tvl_change_24h, volume_24h, txns_24h, 
          pools_count, tokens_count, active_wallets, gas_price, 
          new_contracts_24h, new_contracts_7d, logo_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (chain_name) 
         DO UPDATE SET 
           tvl = EXCLUDED.tvl,
           tvl_change_24h = EXCLUDED.tvl_change_24h,
           logo_url = EXCLUDED.logo_url,
           -- Only update other fields if they have values from DeFiLlama/Dune
           volume_24h = COALESCE(EXCLUDED.volume_24h, chain_metrics.volume_24h),
           txns_24h = COALESCE(EXCLUDED.txns_24h, chain_metrics.txns_24h),
           pools_count = COALESCE(EXCLUDED.pools_count, chain_metrics.pools_count),
           tokens_count = COALESCE(EXCLUDED.tokens_count, chain_metrics.tokens_count),
           active_wallets = COALESCE(EXCLUDED.active_wallets, chain_metrics.active_wallets),
           gas_price = COALESCE(EXCLUDED.gas_price, chain_metrics.gas_price),
           new_contracts_24h = COALESCE(EXCLUDED.new_contracts_24h, chain_metrics.new_contracts_24h),
           new_contracts_7d = COALESCE(EXCLUDED.new_contracts_7d, chain_metrics.new_contracts_7d),
           updated_at = NOW()`,
        [
          chain.name,
          chain.tvl,
          chain.tvlChange24h,
          chain.volume24h,
          chain.txns24h,
          chain.poolsCount,
          chain.tokensCount,
          chain.activeWallets,
          chain.gasPrice,
          chain.contracts24h,
          chain.contracts7d,
          chain.logoUrl,
        ]
      );
    }

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
    const result = await pool.query(
      `SELECT * FROM chain_metrics 
       WHERE tvl > 0 
          OR volume_24h IS NOT NULL 
          OR txns_24h IS NOT NULL 
          OR active_wallets IS NOT NULL 
          OR gas_price IS NOT NULL
       ORDER BY tvl DESC`
    );

    if (result.rows.length > 0) {
      const chains = result.rows.map((row) => ({
        name: row.chain_name,
        tvl: parseFloat(row.tvl || '0'),
        tvlChange24h: parseFloat(row.tvl_change_24h || '0'),
        volume24h: row.volume_24h ? parseFloat(row.volume_24h) : undefined,
        txns24h: row.txns_24h ? parseInt(row.txns_24h, 10) : undefined,
        poolsCount: row.pools_count,
        tokensCount: row.tokens_count,
        activeWallets: row.active_wallets ? parseInt(row.active_wallets, 10) : undefined,
        gasPrice: row.gas_price,
        contracts24h: row.new_contracts_24h ? parseInt(row.new_contracts_24h, 10) : undefined,
        contracts7d: row.new_contracts_7d ? parseInt(row.new_contracts_7d, 10) : undefined,
        logoUrl: row.logo_url,
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
    const result = await pool.query(
      `SELECT MAX(updated_at) as last_update FROM chain_metrics`
    );
    return result.rows[0]?.last_update || null;
  } catch (error) {
    console.error('Error getting last update time:', error);
    return null;
  }
}
