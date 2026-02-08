import prisma, { withRetry } from '../db/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { TokenSearchResult } from '../services/geckoTerminal.js';
import { hasMeaningfulActivity } from '../services/trendingValidation.js';
import { get as getRedisCache } from '../cache/redis.js';

export interface TrendingToken extends TokenSearchResult {
  chain: string;
  rank: number;
}

function hasPositiveLiquidity(token: Pick<TokenSearchResult, 'liquidity'>): boolean {
  return typeof token.liquidity !== 'number' || token.liquidity > 0;
}

function shouldKeepListedToken(token: Pick<TokenSearchResult, 'liquidity' | 'volume24h' | 'txns24h'>): boolean {
  return hasPositiveLiquidity(token) && hasMeaningfulActivity(token);
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function tokenMetaCacheKey(chain: string, address: string): string {
  return `token:meta:v1:${chain}:${address.toLowerCase()}`;
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
              launchpad: (token as any).launchpad || null, // Capture launchpad if available
            })),
            skipDuplicates: true
          });
        }
      });
    });

    const listedTokens = mergedTokens.filter((t) => shouldKeepListedToken(t));

    // Update memory cache
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
    memoryCache.set(cacheKey, listedTokens, CACHE_TTL.TRENDING_TOKENS);

    console.log(`Saved ${listedTokens.length}/${mergedTokens.length} trending tokens for ${chain} to database and memory cache`);
    return listedTokens;
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
        .filter(shouldKeepListedToken)
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
      price: toOptionalNumber(row.price),
      priceChange5m: toOptionalNumber(row.priceChange5m),
      priceChange1h: toOptionalNumber(row.priceChange1h),
      priceChange6h: toOptionalNumber(row.priceChange6h),
      priceChange24h: toOptionalNumber(row.priceChange24h),
      volume24h: toOptionalNumber(row.volume24h),
      liquidity: toOptionalNumber(row.liquidity),
      fdv: toOptionalNumber(row.fdv),
      launchpad: row.launchpad || undefined,
    }));

    await Promise.all(tokens.map(async (token) => {
      try {
        const raw = await getRedisCache(tokenMetaCacheKey(chain, token.address));
        if (!raw) return;
        const meta = JSON.parse(raw) as { creatorAddress?: string; launchMultiple?: number };
        if (meta?.creatorAddress && !token.creatorAddress) token.creatorAddress = meta.creatorAddress;
        if (Number.isFinite(meta?.launchMultiple || NaN) && !Number.isFinite((token as any).launchMultiple || NaN)) {
          (token as any).launchMultiple = meta.launchMultiple;
        }
      } catch {
        // ignore metadata cache parse/read errors
      }
    }));

    const listedTokens = tokens.filter(shouldKeepListedToken);

    if (tokens.length > 0) {
      memoryCache.set(
        cacheKey,
        listedTokens,
        CACHE_TTL.TRENDING_TOKENS
      );
    }

    return listedTokens;
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
