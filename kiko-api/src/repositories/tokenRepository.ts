/**
 * Token Data Repository
 * Handles database operations for trending tokens
 */

import { pool } from '../db/connection.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { TokenSearchResult } from '../services/geckoTerminal.js';

export interface TrendingToken extends TokenSearchResult {
  chain: string;
  rank: number;
}

/**
 * Save trending tokens to database and cache
 */
export async function saveTrendingTokens(chain: string, tokens: TokenSearchResult[]): Promise<void> {
  try {
    // Delete old data for this chain
    await pool.query('DELETE FROM trending_tokens WHERE chain = $1', [chain]);

    // Insert new tokens with rank
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Convert poolCreatedAt to proper Date format
      let poolCreatedAt: Date | null = null;
      if (token.poolCreatedAt) {
        // Could be milliseconds timestamp, seconds timestamp, or ISO string
        if (typeof token.poolCreatedAt === 'number') {
          // If it's a very large number, assume milliseconds
          poolCreatedAt = token.poolCreatedAt > 1e12
            ? new Date(token.poolCreatedAt)
            : new Date(token.poolCreatedAt * 1000);
        } else if (typeof token.poolCreatedAt === 'string') {
          poolCreatedAt = new Date(token.poolCreatedAt);
        }
        // Validate the date is reasonable (not in year 50000+)
        if (poolCreatedAt && (poolCreatedAt.getFullYear() > 2100 || poolCreatedAt.getFullYear() < 2000)) {
          poolCreatedAt = null;
        }
      }

      await pool.query(
        `INSERT INTO trending_tokens 
         (chain, address, name, symbol, network, image_url, pool_created_at, price, price_change_5m, price_change_1h, 
          price_change_6h, price_change_24h, volume_24h, txns_24h, buys_24h, sells_24h, liquidity, fdv, rank, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
         ON CONFLICT (chain, address) 
         DO UPDATE SET 
           name = EXCLUDED.name,
           symbol = EXCLUDED.symbol,
           network = EXCLUDED.network,
           image_url = EXCLUDED.image_url,
           pool_created_at = EXCLUDED.pool_created_at,
           price = EXCLUDED.price,
           price_change_5m = EXCLUDED.price_change_5m,
           price_change_1h = EXCLUDED.price_change_1h,
           price_change_6h = EXCLUDED.price_change_6h,
           price_change_24h = EXCLUDED.price_change_24h,
           volume_24h = EXCLUDED.volume_24h,
           txns_24h = EXCLUDED.txns_24h,
           buys_24h = EXCLUDED.buys_24h,
           sells_24h = EXCLUDED.sells_24h,
           liquidity = EXCLUDED.liquidity,
           fdv = EXCLUDED.fdv,
           rank = EXCLUDED.rank,
           updated_at = NOW()`,
        [
          chain,
          token.address,
          token.name,
          token.symbol,
          token.network,
          token.imageUrl,
          poolCreatedAt,
          token.price,
          token.priceChange5m,
          token.priceChange1h,
          token.priceChange6h,
          token.priceChange24h,
          token.volume24h,
          token.txns24h,
          token.buys24h,
          token.sells24h,
          token.liquidity,
          token.fdv,
          i + 1, // rank (1-based)
        ]
      );
    }


    // Update memory cache (instant access for subsequent requests)
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
    memoryCache.set(cacheKey, tokens, CACHE_TTL.TRENDING_TOKENS);

    console.log(`Saved ${tokens.length} trending tokens for ${chain} to database and memory cache`);
  } catch (error) {
    console.error('Error saving trending tokens:', error);
    throw error;
  }
}

/**
 * Get trending tokens from cache or database
 * Returns TokenSearchResult[] (without chain and rank) for API compatibility
 */
export async function getTrendingTokens(chain: string = 'eth', limit: number = 50): Promise<TokenSearchResult[]> {
  try {
    // Check memory cache first (instant)
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
    const cached = memoryCache.get<TokenSearchResult[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached.slice(0, limit);
    }

    console.log(`[TokenRepo] Memory cache miss for ${chain}, loading from PostgreSQL...`);

    // Fallback to database
    const result = await pool.query(
      `SELECT address, name, symbol, network, image_url, pool_created_at, price, price_change_5m, price_change_1h,
              price_change_6h, price_change_24h, volume_24h, txns_24h, buys_24h, sells_24h, liquidity, fdv
       FROM trending_tokens
       WHERE chain = $1
       ORDER BY rank ASC
       LIMIT $2`,
      [chain, limit]
    );

    console.log(`[Repository] Found ${result.rows.length} tokens in database`);

    const tokens: TokenSearchResult[] = result.rows.map((row) => ({
      address: row.address,
      name: row.name,
      symbol: row.symbol,
      network: row.network,
      imageUrl: row.image_url || undefined,
      poolCreatedAt: row.pool_created_at ? row.pool_created_at.toISOString() : undefined,
      price: row.price ? parseFloat(row.price) : undefined,
      priceChange5m: row.price_change_5m ? parseFloat(row.price_change_5m) : undefined,
      priceChange1h: row.price_change_1h ? parseFloat(row.price_change_1h) : undefined,
      priceChange6h: row.price_change_6h ? parseFloat(row.price_change_6h) : undefined,
      priceChange24h: row.price_change_24h ? parseFloat(row.price_change_24h) : undefined,
      volume24h: row.volume_24h ? parseFloat(row.volume_24h) : undefined,
      txns24h: row.txns_24h || 0,
      buys24h: row.buys_24h || 0,
      sells24h: row.sells_24h || 0,
      liquidity: row.liquidity ? parseFloat(row.liquidity) : undefined,
      fdv: row.fdv ? parseFloat(row.fdv) : undefined,
    }));

    // Cache the result
    if (tokens.length > 0) {
      memoryCache.set(cacheKey, tokens, CACHE_TTL.TRENDING_TOKENS);
      console.log(`[TokenRepo] Loaded ${tokens.length} tokens into memory cache for ${chain}`);
    } else {
      console.warn(`[TokenRepo] No tokens found in database for chain: ${chain}`);
    }

    return tokens;
  } catch (error) {
    console.error('Error getting trending tokens:', error);
    // Check if it's a table doesn't exist error
    if (error instanceof Error && error.message.includes('does not exist')) {
      console.error('Database table "trending_tokens" does not exist. Please run migrations.');
    }
    return [];
  }
}


/**
 * Get last update time for trending tokens on a specific chain
 */
export async function getLastUpdateTime(chain: string): Promise<Date | null> {
  try {
    const result = await pool.query('SELECT updated_at FROM trending_tokens WHERE chain = $1 ORDER BY updated_at DESC LIMIT 1', [chain]);
    return result.rows[0]?.updated_at ? new Date(result.rows[0].updated_at) : null;
  } catch (error) {
    console.error('[TokenRepo] Error getting last update time:', error);
    return null;
  }
}
