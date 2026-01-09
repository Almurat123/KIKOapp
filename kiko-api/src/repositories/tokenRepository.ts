import prisma, { withRetry } from '../db/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { TokenSearchResult } from '../services/geckoTerminal.js';

export interface TrendingToken extends TokenSearchResult {
  chain: string;
  rank: number;
}

export async function saveTrendingTokens(chain: string, tokens: TokenSearchResult[]): Promise<void> {
  try {
    await withRetry(async () => {
      // Deduplicate tokens by address to prevent unique constraint failures
      const seenAddresses = new Set<string>();
      const uniqueTokens = tokens.filter(token => {
        if (!token.address) return false;
        const addr = token.address.toLowerCase();
        if (seenAddresses.has(addr)) return false;
        seenAddresses.add(addr);
        return true;
      });

      // Use a transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // 1. Delete old data for this chain
        await tx.trendingToken.deleteMany({
          where: { chain }
        });

        // 2. Insert new tokens with rank in bulk
        if (uniqueTokens.length > 0) {
          await tx.trendingToken.createMany({
            data: uniqueTokens.map((token, index) => ({
              chain,
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              network: token.network,
              imageUrl: token.imageUrl || null,
              price: token.price ?? null,
              priceChange5m: token.priceChange5m ?? null,
              priceChange1h: token.priceChange1h ?? null,
              priceChange6h: token.priceChange6h ?? null,
              priceChange24h: token.priceChange24h ?? null,
              volume24h: token.volume24h ?? null,
              liquidity: token.liquidity ?? null,
              fdv: token.fdv ?? null,
              rank: index + 1,
            }))
          });
        }
      });
    });

    // Update memory cache
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
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
    const cached = memoryCache.get<TokenSearchResult[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached.slice(0, limit);
    }

    const result = await prisma.trendingToken.findMany({
      where: { chain },
      orderBy: { rank: 'asc' },
      take: limit
    });

    const tokens: TokenSearchResult[] = result.map((row) => ({
      address: row.address,
      name: row.name,
      symbol: row.symbol,
      network: row.network,
      imageUrl: row.imageUrl || undefined,
      price: row.price ? Number(row.price) : undefined,
      priceChange5m: row.priceChange5m ? Number(row.priceChange5m) : undefined,
      priceChange1h: row.priceChange1h ? Number(row.priceChange1h) : undefined,
      priceChange6h: row.priceChange6h ? Number(row.priceChange6h) : undefined,
      priceChange24h: row.priceChange24h ? Number(row.priceChange24h) : undefined,
      volume24h: row.volume24h ? Number(row.volume24h) : undefined,
      liquidity: row.liquidity ? Number(row.liquidity) : undefined,
      fdv: row.fdv ? Number(row.fdv) : undefined,
    }));

    if (tokens.length > 0) {
      memoryCache.set(cacheKey, tokens, CACHE_TTL.TRENDING_TOKENS);
    }

    return tokens;
  } catch (error) {
    console.error('Error getting trending tokens:', error);
    return [];
  }
}


/**
 * Get last update time for trending tokens on a specific chain
 */
export async function getLastUpdateTime(chain: string): Promise<Date | null> {
  try {
    const result = await prisma.trendingToken.aggregate({
      where: { chain },
      _max: { updatedAt: true }
    });
    return result._max.updatedAt || null;
  } catch (error) {
    console.error('[TokenRepo] Error getting last update time:', error);
    return null;
  }
}
