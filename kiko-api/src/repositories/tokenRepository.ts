import prisma, { withRetry } from '../db/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { TokenSearchResult } from '../services/geckoTerminal.js';
import { hasMeaningfulActivity } from '../services/trendingValidation.js';
import { get as getRedisCache } from '../cache/redis.js';
import { Prisma } from '@prisma/client';

const TRENDING_SAVE_TX_MAX_WAIT_MS = Math.max(1_000, Number(process.env.TRENDING_SAVE_TX_MAX_WAIT_MS || '10000'));
const TRENDING_SAVE_TX_TIMEOUT_MS = Math.max(10_000, Number(process.env.TRENDING_SAVE_TX_TIMEOUT_MS || '30000'));
const TRENDING_SAVE_BATCH_SIZE = Math.max(25, Number(process.env.TRENDING_SAVE_BATCH_SIZE || '120'));

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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function tokenMetaCacheKey(chain: string, address: string): string {
  return `token:meta:v2:${chain}:${address.toLowerCase()}`;
}

function tokenMetaLegacyCacheKey(chain: string, address: string): string {
  return `token:meta:v1:${chain}:${address.toLowerCase()}`;
}

function initialPoolCacheKey(chain: string, address: string): string {
  return `token:initial_pool:v2:${chain}:${address.toLowerCase()}`;
}

function buildAddressVariants(addresses: string[]): string[] {
  const out = new Set<string>();
  for (const raw of addresses) {
    const v = String(raw || '').trim();
    if (!v) continue;
    out.add(v);
    out.add(v.toLowerCase());
  }
  return Array.from(out);
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

let trendingCreatorColumnCache:
  | { checkedAt: number; exists: boolean }
  | null = null;

let tokenLaunchpadProfileTableCache:
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

async function hasTrendingCreatorColumns(): Promise<boolean> {
  const now = Date.now();
  if (trendingCreatorColumnCache && now - trendingCreatorColumnCache.checkedAt < 10 * 60 * 1000) {
    return trendingCreatorColumnCache.exists;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'TrendingToken'
          AND column_name = 'creator_address'
      ) AS "exists"
    `;
    const exists = !!rows?.[0]?.exists;
    trendingCreatorColumnCache = { checkedAt: now, exists };
    return exists;
  } catch {
    // Safe default: assume missing to avoid runtime failures.
    trendingCreatorColumnCache = { checkedAt: now, exists: false };
    return false;
  }
}

async function hasTokenLaunchpadProfileTable(): Promise<boolean> {
  const now = Date.now();
  if (tokenLaunchpadProfileTableCache && now - tokenLaunchpadProfileTableCache.checkedAt < 10 * 60 * 1000) {
    return tokenLaunchpadProfileTableCache.exists;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'TokenLaunchpadProfile'
      ) AS "exists"
    `;
    const exists = !!rows?.[0]?.exists;
    tokenLaunchpadProfileTableCache = { checkedAt: now, exists };
    return exists;
  } catch {
    tokenLaunchpadProfileTableCache = { checkedAt: now, exists: false };
    return false;
  }
}

function isMissingLaunchpadColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2022') return false;
  const col = String((error.meta as any)?.column || '').toLowerCase();
  return col.includes('launchpad');
}

function isMissingCreatorColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2022') return false;
  const col = String((error.meta as any)?.column || '').toLowerCase();
  return col.includes('creator_address') || col.includes('creator_url') || col.includes('creator_label');
}

export async function saveTrendingTokenCreator(
  chain: string,
  address: string,
  creator: { creatorAddress?: string; creatorUrl?: string; creatorLabel?: string }
): Promise<void> {
  try {
    if (!creator.creatorAddress && !creator.creatorUrl && !creator.creatorLabel) return;
    const lower = address.toLowerCase();

    const canWriteProfile = await hasTokenLaunchpadProfileTable();
    if (canWriteProfile) {
      await prisma.tokenLaunchpadProfile.upsert({
        where: { chain_address: { chain, address: lower } },
        update: {
          creatorAddress: creator.creatorAddress || undefined,
          creatorUrl: creator.creatorUrl || undefined,
          creatorLabel: creator.creatorLabel || undefined,
          lastCheckedAt: new Date(),
          verifiedAt: new Date(),
          lastError: null,
        },
        create: {
          chain,
          address: lower,
          creatorAddress: creator.creatorAddress || undefined,
          creatorUrl: creator.creatorUrl || undefined,
          creatorLabel: creator.creatorLabel || undefined,
          source: 'launchpad_detector',
          verifiedAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });
    }

    const canWriteCreator = await hasTrendingCreatorColumns();
    if (!canWriteCreator) return;
    const existing = await prisma.trendingToken.findUnique({
      where: { chain_address: { chain, address: lower } },
      select: { creatorAddress: true, creatorUrl: true, creatorLabel: true },
    });
    if (!existing) return;

    const updateData: { creatorAddress?: string | null; creatorUrl?: string | null; creatorLabel?: string | null } = {};
    if (!existing.creatorAddress && creator.creatorAddress) updateData.creatorAddress = creator.creatorAddress;
    if (!existing.creatorUrl && creator.creatorUrl) updateData.creatorUrl = creator.creatorUrl;
    if (!existing.creatorLabel && creator.creatorLabel) updateData.creatorLabel = creator.creatorLabel;
    if (Object.keys(updateData).length === 0) return;

    await prisma.trendingToken.update({
      where: { chain_address: { chain, address: lower } },
      data: updateData,
    });
  } catch (error) {
    if (isMissingCreatorColumnError(error)) {
      trendingCreatorColumnCache = { checkedAt: Date.now(), exists: false };
      return;
    }
    // best-effort only
  }
}

export async function saveTokenLaunchpadProfile(
  chain: string,
  address: string,
  profile: { launchpad?: string; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; source?: string }
): Promise<void> {
  try {
    const lower = address.toLowerCase();
    const canWriteProfile = await hasTokenLaunchpadProfileTable();
    if (!canWriteProfile) return;

    await prisma.tokenLaunchpadProfile.upsert({
      where: { chain_address: { chain, address: lower } },
      update: {
        launchpad: profile.launchpad || undefined,
        creatorAddress: profile.creatorAddress || undefined,
        creatorUrl: profile.creatorUrl || undefined,
        creatorLabel: profile.creatorLabel || undefined,
        source: profile.source || 'launchpad_detector',
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
        lastError: null,
      },
      create: {
        chain,
        address: lower,
        launchpad: profile.launchpad || undefined,
        creatorAddress: profile.creatorAddress || undefined,
        creatorUrl: profile.creatorUrl || undefined,
        creatorLabel: profile.creatorLabel || undefined,
        source: profile.source || 'launchpad_detector',
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
      },
    });
  } catch {
    // best-effort profile persistence
  }
}

export async function saveTrendingTokens(chain: string, tokens: TokenSearchResult[]): Promise<TokenSearchResult[]> {
  try {
    let mergedTokens: TokenSearchResult[] = [];
    const canWriteLaunchpad = await hasTrendingLaunchpadColumn();
    const canWriteCreator = await hasTrendingCreatorColumns();

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
        // Preserve existing poolCreatedAt and creator values to avoid data loss on re-save
        const existingRows = addressList.length > 0
          ? await tx.trendingToken.findMany({
            where: {
              chain,
              address: { in: addressList },
            },
            select: {
              address: true,
              poolCreatedAt: true,
              launchpad: true,
              creatorAddress: true,
              creatorUrl: true,
              creatorLabel: true,
            },
          })
          : [];

        const existingPoolCreatedAt = new Map<string, Date>();
        const existingCreatorData = new Map<string, { launchpad?: string | null; creatorAddress?: string | null; creatorUrl?: string | null; creatorLabel?: string | null }>();
        for (const row of existingRows) {
          const addr = row.address.toLowerCase();
          if (row.poolCreatedAt instanceof Date) {
            existingPoolCreatedAt.set(addr, row.poolCreatedAt);
          }
          if (row.creatorAddress || row.creatorUrl || row.creatorLabel || row.launchpad) {
            existingCreatorData.set(addr, {
              launchpad: row.launchpad,
              creatorAddress: row.creatorAddress,
              creatorUrl: row.creatorUrl,
              creatorLabel: row.creatorLabel,
            });
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

          // Preserve previously-discovered creator/launchpad data when incoming has none
          const existingCreator = existingCreatorData.get(addr);
          const merged: any = {
            ...token,
            poolCreatedAt: poolCreatedAt ? poolCreatedAt.toISOString() : undefined,
          };
          if (existingCreator) {
            if (!merged.launchpad && existingCreator.launchpad) merged.launchpad = existingCreator.launchpad;
            if (!merged.creatorAddress && existingCreator.creatorAddress) merged.creatorAddress = existingCreator.creatorAddress;
            if (!merged.creatorUrl && existingCreator.creatorUrl) merged.creatorUrl = existingCreator.creatorUrl;
            if (!merged.creatorLabel && existingCreator.creatorLabel) merged.creatorLabel = existingCreator.creatorLabel;
          }

          return merged;
        });

        // 1. Delete old data for this chain
        await tx.trendingToken.deleteMany({
          where: { chain }
        });

        // 2. Insert new tokens with rank in bulk
        if (mergedTokens.length > 0) {
          const mappedRows = mergedTokens.map((token, index) => {
            const baseData: Record<string, unknown> = {
              chain,
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              imageUrl: token.imageUrl || null,
              poolCreatedAt: token.poolCreatedAt ? new Date(token.poolCreatedAt) : null,
              price: toOptionalNumber(token.price) ?? null,
              priceChange5m: toOptionalNumber(token.priceChange5m) ?? null,
              priceChange1h: toOptionalNumber(token.priceChange1h) ?? null,
              priceChange6h: toOptionalNumber(token.priceChange6h) ?? null,
              priceChange24h: toOptionalNumber(token.priceChange24h) ?? null,
              volume24h: toOptionalNumber(token.volume24h) ?? null,
              liquidity: toOptionalNumber(token.liquidity) ?? null,
              fdv: toOptionalNumber(token.fdv) ?? null,
              rank: index + 1,
            };
            if (canWriteLaunchpad) {
              baseData.launchpad = (token as any).launchpad || null;
            }
            if (canWriteCreator) {
              baseData.creatorAddress = (token as any).creatorAddress || null;
              baseData.creatorUrl = (token as any).creatorUrl || null;
              baseData.creatorLabel = (token as any).creatorLabel || null;
            }
            return baseData as any;
          });
          const batches = chunkArray(mappedRows, TRENDING_SAVE_BATCH_SIZE);
          for (const batch of batches) {
            await tx.trendingToken.createMany({
              data: batch,
              skipDuplicates: true
            });
          }
        }
      }, {
        maxWait: TRENDING_SAVE_TX_MAX_WAIT_MS,
        timeout: TRENDING_SAVE_TX_TIMEOUT_MS,
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
    if (isMissingCreatorColumnError(error)) {
      trendingCreatorColumnCache = { checkedAt: Date.now(), exists: false };
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
export async function getTrendingTokens(
  chain: string = 'eth',
  limit: number = 50,
  opts?: { bypassMemoryCache?: boolean; lightweight?: boolean }
): Promise<TokenSearchResult[]> {
  try {
    const cacheKey = CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
    const cached = opts?.bypassMemoryCache ? null : memoryCache.get<TokenSearchResult[]>(cacheKey);

    const canReadLaunchpad = await hasTrendingLaunchpadColumn();
    const canReadCreator = await hasTrendingCreatorColumns();
    const result = (!cached || cached.length === 0)
      ? await prisma.trendingToken.findMany({
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
        ...(canReadCreator ? { creatorAddress: true, creatorUrl: true, creatorLabel: true } : {}),
      },
    })
      : [];

    const tokens: TokenSearchResult[] = (cached && cached.length > 0)
      ? cached
        .slice(0, limit)
        .map((t) => ({ ...t }))
      : result.map((row) => ({
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
      creatorAddress: (row as any).creatorAddress || undefined,
      creatorUrl: (row as any).creatorUrl || undefined,
      creatorLabel: (row as any).creatorLabel || undefined,
    }));

    try {
      const canReadProfile = await hasTokenLaunchpadProfileTable();
      if (canReadProfile && tokens.length > 0) {
        const addresses = buildAddressVariants(tokens.map((t) => t.address));
        const profiles = await prisma.tokenLaunchpadProfile.findMany({
          where: { chain, address: { in: addresses } },
          select: {
            address: true,
            launchpad: true,
            creatorAddress: true,
            creatorUrl: true,
            creatorLabel: true,
          },
        });
        const byAddress = new Map(
          profiles.map((p) => [p.address.toLowerCase(), p])
        );
        for (const token of tokens) {
          const profile = byAddress.get(token.address.toLowerCase());
          if (!profile) continue;
          if (!token.launchpad && profile.launchpad) token.launchpad = profile.launchpad;
          if (!token.creatorAddress && profile.creatorAddress) token.creatorAddress = profile.creatorAddress;
          if (!(token as any).creatorUrl && profile.creatorUrl) (token as any).creatorUrl = profile.creatorUrl;
          if (!(token as any).creatorLabel && profile.creatorLabel) (token as any).creatorLabel = profile.creatorLabel;
        }
      }
    } catch {
      // best-effort merge only
    }

    // Launch multiple is intentionally disabled; keep backend payload stable without x-metrics.

    if (!opts?.lightweight) {
      await Promise.all(tokens.map(async (token) => {
        try {
          let raw = await getRedisCache(tokenMetaCacheKey(chain, token.address));
          let fromLegacy = false;
          if (!raw) {
            raw = await getRedisCache(tokenMetaLegacyCacheKey(chain, token.address));
            fromLegacy = !!raw;
          }
          if (!raw) return;
          const meta = JSON.parse(raw) as { creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; launchMultiple?: number; cacheVersion?: number };
          if (meta?.creatorAddress && !token.creatorAddress) token.creatorAddress = meta.creatorAddress;
          if (meta?.creatorUrl && !(token as any).creatorUrl) (token as any).creatorUrl = meta.creatorUrl;
          if (meta?.creatorLabel && !(token as any).creatorLabel) (token as any).creatorLabel = meta.creatorLabel;
          // Prefer v2 meta cache launchMultiple produced by baseline pipeline.
          // Ignore legacy cache to avoid leaking stale values.
          const multiple = Number(meta?.launchMultiple || 0);
          const cacheVersion = Number(meta?.cacheVersion || 0);
          if (!fromLegacy && cacheVersion >= 2 && Number.isFinite(multiple) && multiple > 0 && multiple <= 200_000) {
            (token as any).launchMultiple = multiple;
          }
        } catch {
          // ignore metadata cache parse/read errors
        }
      }));

      await Promise.all(tokens.map(async (token) => {
        try {
          const raw = await getRedisCache(initialPoolCacheKey(chain, token.address));
          if (!raw) return;
          const meta = JSON.parse(raw) as {
            initialPoolAddress?: string;
            initialPoolCreatedAt?: string;
            initialLiquidityUsd?: number;
            source?: string;
          };
          if (meta?.initialPoolAddress) (token as any).initialPoolAddress = meta.initialPoolAddress;
          if (meta?.initialPoolCreatedAt) (token as any).initialPoolCreatedAt = meta.initialPoolCreatedAt;
          // Reuse initial-pool snapshot as enrichment hint for on-demand baseline fill.
          if (!(token as any).poolAddress && meta?.initialPoolAddress) (token as any).poolAddress = meta.initialPoolAddress;
          if (!(token as any).poolCreatedAt && meta?.initialPoolCreatedAt) (token as any).poolCreatedAt = meta.initialPoolCreatedAt;
          if (Number.isFinite(Number(meta?.initialLiquidityUsd || 0)) && Number(meta?.initialLiquidityUsd || 0) > 0) {
            (token as any).initialLiquidityUsd = Number(meta?.initialLiquidityUsd);
          }
          if (meta?.source) (token as any).initialPoolSource = meta.source;
        } catch {
          // ignore initial-pool cache parse/read errors
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
    }

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
    if (isMissingCreatorColumnError(error)) {
      trendingCreatorColumnCache = { checkedAt: Date.now(), exists: false };
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
