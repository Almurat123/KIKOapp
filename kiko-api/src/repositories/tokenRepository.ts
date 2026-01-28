import prisma, { withRetry } from '../db/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { TokenSearchResult } from '../services/geckoTerminal.js';

export interface TrendingToken extends TokenSearchResult {
  chain: string;
  rank: number;
}

export async function saveTrendingTokens(chain: string, tokens: TokenSearchResult[]): Promise<TokenSearchResult[]> {
  try {
    let mergedTokens: TokenSearchResult[] = [];

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

      const addressList = uniqueTokens.map(token => token.address.toLowerCase());

      mergedTokens = uniqueTokens;

      // Use a transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Preserve existing poolCreatedAt values to avoid "all new" age regressions
        const existingRows = addressList.length > 0
          ? await tx.trendingToken.findMany({
            where: {
              chain,
              address: { in: addressList },
            },
            select: {
              address: true,
              poolCreatedAt: true,
            },
          })
          : [];

        const existingPoolCreatedAt = new Map<string, Date>();
        for (const row of existingRows) {
          if (row.poolCreatedAt instanceof Date) {
            existingPoolCreatedAt.set(row.address.toLowerCase(), row.poolCreatedAt);
          }
        }

        mergedTokens = uniqueTokens.map((token) => {
          const addr = token.address.toLowerCase();
          const existing = existingPoolCreatedAt.get(addr);
          const incoming = token.poolCreatedAt ? new Date(token.poolCreatedAt) : null;
          const incomingValid = incoming instanceof Date && Number.isFinite(incoming.getTime());

          let poolCreatedAt = incomingValid ? incoming : existing || null;
          if (incomingValid && existing && incoming.getTime() > existing.getTime()) {
            // Keep earliest known creation time (pool creation shouldn't move forward)
            poolCreatedAt = existing;
          }

          return {
            ...token,
            poolCreatedAt: poolCreatedAt ? poolCreatedAt.toISOString() : undefined,
          };
        });

        // 1. Delete old data for this chain
        await tx.trendingToken.deleteMany({
          where: { chain }
        });

        // 2. Insert new tokens with rank in bulk
        if (mergedTokens.length > 0) {
          await tx.trendingToken.createMany({
            data: mergedTokens.map((token, index) => ({
              chain,
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              imageUrl: token.imageUrl || null,
              poolCreatedAt: token.poolCreatedAt ? new Date(token.poolCreatedAt) : null,

              price: token.price ?? null,
              priceChange5m: token.priceChange5m ?? null,
              priceChange1h: token.priceChange1h ?? null,
              priceChange6h: token.priceChange6h ?? null,
              priceChange24h: token.priceChange24h ?? null,
              volume24h: token.volume24h ?? null,
              liquidity: token.liquidity ?? null,
              fdv: token.fdv ?? null,
              rank: index + 1,
            })),
            skipDuplicates: true
          });
        }
      });
    });

    // Update memory cache
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
    memoryCache.set(cacheKey, mergedTokens, CACHE_TTL.TRENDING_TOKENS);

    console.log(`Saved ${mergedTokens.length} trending tokens for ${chain} to database and memory cache`);
    return mergedTokens;
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
      return cached
        .filter(t => typeof t.liquidity !== 'number' || t.liquidity > 0)
        .slice(0, limit);
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
      network: chain, // Derive from chain parameter since not stored in DB
      imageUrl: row.imageUrl || undefined,
      poolCreatedAt: (row as any).poolCreatedAt
        ? (row as any).poolCreatedAt.toISOString()
        : undefined,
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
      memoryCache.set(
        cacheKey,
        tokens.filter(t => typeof t.liquidity !== 'number' || t.liquidity > 0),
        CACHE_TTL.TRENDING_TOKENS
      );
    }

    return tokens.filter(t => typeof t.liquidity !== 'number' || t.liquidity > 0);
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
