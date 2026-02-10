import prisma, { withRetry } from '../db/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { TokenSearchResult } from '../services/geckoTerminal.js';
import { hasMeaningfulActivity } from '../services/trendingValidation.js';
import { get as getRedisCache } from '../cache/redis.js';
import { Prisma } from '@prisma/client';

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

function launchpadCacheKey(chain: string, address: string): string {
  const chainId = chain === 'base' ? 8453 : chain === 'bsc' ? 56 : chain === 'solana' ? 101 : 'any';
  return `launchpad:detected:v2:${chainId}:${address.toLowerCase()}`;
}

function pickCreatorAddressFromLaunchpadCache(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as any;
    const root = parsed?.data || {};
    const nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
      ? root.data
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
      data.msg_sender,
      data.requestorAddress,
      data.creator_wallet,
      data.creatorWalletAddress,
      data.creatorPublicKey,
      data.mintAuthority,
      data.updateAuthority,
      data.devAddress,
      data.owner,
      data.ownerAddress,
      data.deployer,
      data.deployerAddress,
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
    for (const rawValue of candidates) {
      if (typeof rawValue !== 'string') continue;
      const value = rawValue.trim();
      if ((evmLike.test(value) || solLike.test(value)) && !isIgnored(value)) return value;
    }
  } catch {
    // ignore parsing errors
  }
  return undefined;
}

function pickCreatorMetaFromLaunchpadCache(raw: string): { creatorAddress?: string; creatorUrl?: string; creatorLabel?: string } {
  let creatorAddress: string | undefined;
  let creatorUrl: string | undefined;
  let creatorLabel: string | undefined;
  try {
    const parsed = JSON.parse(raw) as any;
    const root = parsed?.data || {};
    const nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
      ? root.data
      : null;
    const data = nested ? { ...(root as Record<string, unknown>), ...(nested as Record<string, unknown>) } : root;

    creatorAddress = pickCreatorAddressFromLaunchpadCache(raw);
    const socials = data.socials || {};
    const urlCandidates: unknown[] = [
      data.creatorUrl,
      data.creator_url,
      data.profileUrl,
      data.profile_url,
      socials.x,
      socials.twitter,
      socials.TWITTER,
      socials.farcaster,
      socials.warpcast,
      data.social_context?.url,
      data.social_context?.profile,
    ];
    for (const c of urlCandidates) {
      if (typeof c !== 'string') continue;
      const v = c.trim();
      if (v.startsWith('http://') || v.startsWith('https://')) {
        creatorUrl = v;
        break;
      }
      if (v.startsWith('@')) {
        creatorUrl = `https://x.com/${v.slice(1)}`;
        break;
      }
    }
    if (!creatorUrl) {
      const requestorFid = Number(data.requestor_fid || data.requestorFid || 0);
      if (Number.isFinite(requestorFid) && requestorFid > 0) {
        creatorUrl = `https://warpcast.com/~/profiles/${requestorFid}`;
      }
    }

    const labelCandidates: unknown[] = [
      data.creatorProfile?.handle,
      data.creatorHandle,
      data.social_context?.id,
      socials.handle,
      data.twitterUsername,
      data.farcasterUsername,
    ];
    for (const c of labelCandidates) {
      if (typeof c !== 'string') continue;
      const v = c.trim();
      if (!v) continue;
      creatorLabel = v.startsWith('@') ? v : (creatorUrl?.includes('x.com') || creatorUrl?.includes('warpcast.com') ? `@${v}` : v);
      break;
    }

    const addressLike = (value?: string) => !!value && (/^0x[a-f0-9]{40}$/i.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value));
    if (creatorLabel && addressLike(creatorLabel)) creatorLabel = undefined;
  } catch {
    // ignore parsing errors
  }
  return { creatorAddress, creatorUrl, creatorLabel };
}

let trendingLaunchpadColumnCache:
  | { checkedAt: number; exists: boolean }
  | null = null;

async function hasTrendingLaunchpadColumn(): Promise<boolean> {
  const now = Date.now();
  if (trendingLaunchpadColumnCache && now - trendingLaunchpadColumnCache.checkedAt < 10 * 60 * 1000) {
    return trendingLaunchpadColumnCache.exists;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'TrendingToken'
          AND column_name = 'launchpad'
      ) AS "exists"
    `;
    const exists = !!rows?.[0]?.exists;
    trendingLaunchpadColumnCache = { checkedAt: now, exists };
    return exists;
  } catch {
    // Safe default: assume missing to avoid runtime failures.
    trendingLaunchpadColumnCache = { checkedAt: now, exists: false };
    return false;
  }
}

function isMissingLaunchpadColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2022') return false;
  const col = String((error.meta as any)?.column || '').toLowerCase();
  return col.includes('launchpad');
}

export async function saveTrendingTokens(chain: string, tokens: TokenSearchResult[]): Promise<TokenSearchResult[]> {
  try {
    let mergedTokens: TokenSearchResult[] = [];
    const canWriteLaunchpad = await hasTrendingLaunchpadColumn();

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
            data: mergedTokens.map((token, index) => {
              const baseData: Record<string, unknown> = {
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
              };
              if (canWriteLaunchpad) {
                baseData.launchpad = (token as any).launchpad || null;
              }
              return baseData as any;
            }),
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
    if (isMissingLaunchpadColumnError(error)) {
      // Refresh cache and retry once without launchpad writes.
      trendingLaunchpadColumnCache = { checkedAt: Date.now(), exists: false };
      return saveTrendingTokens(chain, tokens);
    }
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

    const canReadLaunchpad = await hasTrendingLaunchpadColumn();
    const result = await prisma.trendingToken.findMany({
      where: { chain },
      orderBy: { rank: 'asc' },
      take: limit,
      select: {
        address: true,
        name: true,
        symbol: true,
        imageUrl: true,
        poolCreatedAt: true,
        price: true,
        priceChange5m: true,
        priceChange1h: true,
        priceChange6h: true,
        priceChange24h: true,
        volume24h: true,
        liquidity: true,
        fdv: true,
        ...(canReadLaunchpad ? { launchpad: true } : {}),
      },
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
      launchpad: (row as any).launchpad || undefined,
    }));

    // DB fallback for launch multiple:
    // when Redis metadata is missing/expired, use persisted baseline source-of-truth.
    try {
      const addresses = tokens.map((t) => t.address.toLowerCase());
      if (addresses.length > 0) {
        const baselines = await prisma.tokenLaunchBaseline.findMany({
          where: {
            chain,
            address: { in: addresses },
            status: { in: ['verified', 'estimated', 'fallback'] },
            baselinePrice: { not: null },
          },
          select: {
            address: true,
            baselinePrice: true,
            baselineSource: true,
          },
        });
        const baselineMap = new Map<string, { price: number; source?: string }>();
        for (const b of baselines) {
          const price = toOptionalNumber(b.baselinePrice);
          if (!Number.isFinite(price || NaN) || (price || 0) <= 0) continue;
          baselineMap.set(b.address.toLowerCase(), { price: Number(price), source: b.baselineSource || undefined });
        }

        for (const token of tokens) {
          if (Number.isFinite((token as any).launchMultiple || NaN)) continue;
          const current = toOptionalNumber(token.price);
          if (!Number.isFinite(current || NaN) || (current || 0) <= 0) continue;
          const baseline = baselineMap.get(token.address.toLowerCase());
          if (!baseline || !Number.isFinite(baseline.price) || baseline.price <= 0) continue;
          const raw = Number(current) / baseline.price;
          if (!Number.isFinite(raw) || raw <= 0) continue;
          (token as any).launchMultiple = Math.max(1, raw);
        }
      }
    } catch {
      // best-effort only
    }

    await Promise.all(tokens.map(async (token) => {
      try {
        const raw = await getRedisCache(tokenMetaCacheKey(chain, token.address));
        if (!raw) return;
        const meta = JSON.parse(raw) as { creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; launchMultiple?: number };
        if (meta?.creatorAddress && !token.creatorAddress) token.creatorAddress = meta.creatorAddress;
        if (meta?.creatorUrl && !(token as any).creatorUrl) (token as any).creatorUrl = meta.creatorUrl;
        if (meta?.creatorLabel && !(token as any).creatorLabel) (token as any).creatorLabel = meta.creatorLabel;
        if (Number.isFinite(meta?.launchMultiple || NaN) && !Number.isFinite((token as any).launchMultiple || NaN)) {
          (token as any).launchMultiple = meta.launchMultiple;
        }
      } catch {
        // ignore metadata cache parse/read errors
      }
    }));

    await Promise.all(tokens.map(async (token) => {
      if (token.creatorAddress && (token as any).creatorUrl) return;
      try {
        const raw = await getRedisCache(launchpadCacheKey(chain, token.address));
        if (!raw) return;
        const creator = pickCreatorMetaFromLaunchpadCache(raw);
        if (creator.creatorAddress && !token.creatorAddress) token.creatorAddress = creator.creatorAddress;
        if (creator.creatorUrl && !(token as any).creatorUrl) (token as any).creatorUrl = creator.creatorUrl;
        if (creator.creatorLabel && !(token as any).creatorLabel) (token as any).creatorLabel = creator.creatorLabel;
      } catch {
        // ignore launchpad cache parse/read errors
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
    if (isMissingLaunchpadColumnError(error)) {
      trendingLaunchpadColumnCache = { checkedAt: Date.now(), exists: false };
      return getTrendingTokens(chain, limit);
    }
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
