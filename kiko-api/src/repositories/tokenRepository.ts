import prisma, { withRetry } from '../db/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { TokenSearchResult } from '../services/geckoTerminal.js';
import { hasMeaningfulActivity } from '../services/trendingValidation.js';
import { computeLaunchpadMultiple } from '../services/launchpadMultipleService.js';
import { get as getRedisCache, isRedisAvailable } from '../cache/cacheClient.js';
import { Prisma } from '@prisma/client';

const TRENDING_SAVE_TX_MAX_WAIT_MS = Math.max(1_000, Number(process.env.TRENDING_SAVE_TX_MAX_WAIT_MS || '10000'));
const TRENDING_SAVE_TX_TIMEOUT_MS = Math.max(10_000, Number(process.env.TRENDING_SAVE_TX_TIMEOUT_MS || '30000'));
const TRENDING_SAVE_BATCH_SIZE = Math.max(25, Number(process.env.TRENDING_SAVE_BATCH_SIZE || '120'));
const ENABLE_TRENDING_REDIS_METADATA = String(process.env.ENABLE_TRENDING_REDIS_METADATA || '').toLowerCase() === 'true';

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

function isFidLabel(value?: string | null): boolean {
  return typeof value === 'string' && /^fid:\d+$/i.test(value.trim());
}

function isXUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return host.includes('x.com') || host.includes('twitter.com');
  } catch {
    return false;
  }
}

function isAddressLike(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(v) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function shouldReplaceCreatorUrl(existing?: string | null, incoming?: string | null): boolean {
  if (!incoming) return false;
  if (!existing) return true;
  if (isXUrl(existing)) return false;
  if (isXUrl(incoming)) return true;
  return false;
}

function shouldReplaceCreatorLabel(existing?: string | null, incoming?: string | null): boolean {
  if (!incoming) return false;
  if (!existing) return true;
  const lowQualityExisting = /^@?(i|status)$/i.test(existing.trim());
  if (lowQualityExisting) return true;
  if (isFidLabel(existing) && !isFidLabel(incoming)) return true;
  if (isAddressLike(existing) && !isAddressLike(incoming)) return true;
  return false;
}

function normalizeCreatorPresentation(creatorUrl?: string | null, creatorLabel?: string | null): { creatorUrl?: string; creatorLabel?: string } {
  const label = typeof creatorLabel === 'string' ? creatorLabel.trim() : '';
  const isFid = /^fid:\d+$/i.test(label);
  const isAtDigits = /^@\d+$/.test(label);
  const isAddr = isAddressLike(label);
  const isLowQualityXLabel = /^@?(i|status)$/i.test(label);

  if (!creatorUrl || typeof creatorUrl !== 'string') {
    if (isFid) {
      return {
        creatorUrl: undefined,
        creatorLabel: 'Farcaster',
      };
    }
    if (isAtDigits) {
      return {
        creatorUrl: undefined,
        creatorLabel: undefined,
      };
    }
    if (isLowQualityXLabel) {
      return {
        creatorUrl: undefined,
        creatorLabel: 'X post',
      };
    }
    return {
      creatorUrl: creatorUrl || undefined,
      creatorLabel: label || undefined,
    };
  }

  try {
    const u = new URL(creatorUrl);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    const isX = host.includes('x.com') || host.includes('twitter.com');
    const isWarpcast = host.includes('warpcast.com') || host.includes('farcaster');

    if (isX) {
      const first = (parts[0] || '').replace(/^@/, '');
      const reserved = new Set(['i', 'intent', 'share', 'home', 'explore', 'search', 'messages', 'notifications', 'settings', 'tos', 'privacy', 'status']);
      const labelHandle = label.replace(/^@/, '').toLowerCase();
      const labelIsReservedHandle = !!labelHandle && reserved.has(labelHandle);
      if (first && !reserved.has(first.toLowerCase())) {
        return { creatorUrl, creatorLabel: `@${first}` };
      }
      if (!label || isFid || isAtDigits || isAddr || labelIsReservedHandle) {
        return { creatorUrl, creatorLabel: 'X post' };
      }
      return { creatorUrl, creatorLabel: label };
    }

    if (isWarpcast) {
      if (!label || isFid || isAtDigits || isAddr) {
        return { creatorUrl, creatorLabel: 'Farcaster' };
      }
      return { creatorUrl, creatorLabel: label };
    }
  } catch {
    // ignore malformed url
  }

  return {
    creatorUrl,
    creatorLabel: label || undefined,
  };
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
  const chainId = chain === 'base' ? 8453 : chain === 'bsc' ? 56 : chain === 'solana' ? 900 : 'any';
  return `launchpad:decision:v3:${chainId}:${address.toLowerCase()}`;
}

function parseLaunchpadCacheData(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as any;
    const root = parsed?.data || {};
    const nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
      ? root.data
      : null;
    return (nested ? { ...(root as Record<string, unknown>), ...(nested as Record<string, unknown>) } : root) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseLaunchpadProvider(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as any;
    const provider = typeof parsed?.provider === 'string' ? parsed.provider.trim().toLowerCase() : '';
    if (!provider) return undefined;
    return normalizeLaunchpadTag(provider);
  } catch {
    return undefined;
  }
}

async function loadLaunchpadDecisionCacheMap(chain: string, tokens: TokenSearchResult[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!Array.isArray(tokens) || tokens.length === 0) return out;

  const keysByAddress = new Map<string, string>();
  for (const token of tokens) {
    const address = String(token.address || '').toLowerCase();
    if (!address) continue;
    keysByAddress.set(address, launchpadCacheKey(chain, address));
  }
  const keyEntries = Array.from(keysByAddress.entries());
  if (keyEntries.length === 0) return out;

  if (isRedisAvailable()) {
    await Promise.all(keyEntries.map(async ([address, key]) => {
      try {
        const raw = await getRedisCache(key);
        if (raw) out.set(address, raw);
      } catch {
        // best-effort cache read
      }
    }));
    return out;
  }

  // Local-dev fallback when Redis is disabled: read all decision keys in one DB query.
  try {
    const keyList = keyEntries.map(([, key]) => key);
    const rows = await prisma.cache.findMany({
      where: {
        key: { in: keyList },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      select: { key: true, value: true }
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    for (const [address, key] of keyEntries) {
      const raw = byKey.get(key);
      if (raw) out.set(address, raw);
    }
  } catch {
    // ignore and return empty map
  }

  return out;
}

function pickCreatorAddressFromLaunchpadCache(raw: string): string | undefined {
  try {
    const data = parseLaunchpadCacheData(raw) as any;
    if (!data) return undefined;
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
      data.status?.owner,
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
    const data = parseLaunchpadCacheData(raw) as any;
    if (!data) return {};

    creatorAddress = pickCreatorAddressFromLaunchpadCache(raw);
    const socials = (data.socials || {}) as any;
    const urlCandidates: unknown[] = [
      data.creatorUrl,
      data.creator_url,
      data.profileUrl,
      data.profile_url,
      socials.website,
      socials.telegram,
      socials.discord,
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
      const digitsOnly = /^\d+$/.test(v.replace(/^@/, ''));
      const lowQuality = /^@?(i|status)$/i.test(v);
      if (digitsOnly || lowQuality) continue;
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

function pickLaunchpadFromLaunchpadCache(raw: string): string | undefined {
  return parseLaunchpadProvider(raw);
}

function sanitizeCreatorLabel(value?: string | null): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return undefined;
  if (/^fid:\d+$/i.test(v)) return undefined;
  if (/^@\d+$/.test(v)) return undefined;
  if (/^\d+$/.test(v)) return undefined;
  if (/^@?(i|status)$/i.test(v)) return undefined;
  return v;
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

const SCHEMA_EXISTS_CACHE_TTL_MS = 10 * 60 * 1000;
const SCHEMA_MISSING_CACHE_TTL_MS = 30 * 1000;

function normalizeLaunchpadTag(value?: string | null): string | undefined {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return undefined;
  if (v === 'pumpfun') return 'pump.fun';
  if (v === 'bonkfun') return 'bonk.fun';
  if (v === 'fourmeme') return 'four.meme';
  if (v === 'flaunch.gg') return 'flaunch';
  if (v === 'creator.bid') return 'creatorbid';
  if (v === 'doppler finance' || v === 'dopplerfinance') return 'doppler';
  return v;
}

function shouldCarryForwardLaunchpadTag(
  launchpad?: string | null,
  creator?: { creatorAddress?: string | null; creatorUrl?: string | null; creatorLabel?: string | null }
): boolean {
  const normalized = normalizeLaunchpadTag(launchpad);
  if (!normalized) return false;
  if (creator?.creatorAddress || creator?.creatorUrl || creator?.creatorLabel) return true;
  // Deterministic/vanity-suffix launchpads can be safely preserved.
  const deterministic = new Set(['clanker', 'four.meme', 'flap', 'pump.fun', 'bonk.fun']);
  return deterministic.has(normalized);
}

async function hasTrendingLaunchpadColumn(): Promise<boolean> {
  const now = Date.now();
  if (trendingLaunchpadColumnCache) {
    const ttl = trendingLaunchpadColumnCache.exists ? SCHEMA_EXISTS_CACHE_TTL_MS : SCHEMA_MISSING_CACHE_TTL_MS;
    if (now - trendingLaunchpadColumnCache.checkedAt < ttl) {
      return trendingLaunchpadColumnCache.exists;
    }
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
  if (trendingCreatorColumnCache) {
    const ttl = trendingCreatorColumnCache.exists ? SCHEMA_EXISTS_CACHE_TTL_MS : SCHEMA_MISSING_CACHE_TTL_MS;
    if (now - trendingCreatorColumnCache.checkedAt < ttl) {
      return trendingCreatorColumnCache.exists;
    }
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
  if (tokenLaunchpadProfileTableCache) {
    const ttl = tokenLaunchpadProfileTableCache.exists ? SCHEMA_EXISTS_CACHE_TTL_MS : SCHEMA_MISSING_CACHE_TTL_MS;
    if (now - tokenLaunchpadProfileTableCache.checkedAt < ttl) {
      return tokenLaunchpadProfileTableCache.exists;
    }
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
      // Normalize historical mixed-case duplicates to avoid split-brain profile reads.
      await prisma.tokenLaunchpadProfile.deleteMany({
        where: {
          chain,
          address: { in: [address, lower] },
          NOT: { address: lower },
        },
      });
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
    const existing = await prisma.trendingToken.findFirst({
      where: {
        chain,
        address: { in: [lower, address] },
      },
      select: { address: true, creatorAddress: true, creatorUrl: true, creatorLabel: true },
    });
    if (!existing) return;

    const updateData: { creatorAddress?: string | null; creatorUrl?: string | null; creatorLabel?: string | null } = {};
    if (!existing.creatorAddress && creator.creatorAddress) updateData.creatorAddress = creator.creatorAddress;
    if (shouldReplaceCreatorUrl(existing.creatorUrl, creator.creatorUrl)) updateData.creatorUrl = creator.creatorUrl || null;
    if (shouldReplaceCreatorLabel(existing.creatorLabel, creator.creatorLabel)) updateData.creatorLabel = creator.creatorLabel || null;
    if (Object.keys(updateData).length === 0) return;

    // Non-throwing update: row may be deleted/reinserted by refresh transaction between read and write.
    await prisma.trendingToken.updateMany({
      where: { chain, address: existing.address },
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
  profile: { launchpad?: string | null; creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; source?: string }
): Promise<void> {
  try {
    const lower = address.toLowerCase();
    const canWriteProfile = await hasTokenLaunchpadProfileTable();
    if (!canWriteProfile) return;
    // Normalize historical mixed-case duplicates to avoid stale row wins.
    await prisma.tokenLaunchpadProfile.deleteMany({
      where: {
        chain,
        address: { in: [address, lower] },
        NOT: { address: lower },
      },
    });
    const normalizedLaunchpad = profile.launchpad === null
      ? null
      : normalizeLaunchpadTag(profile.launchpad);
    const creatorLabel = sanitizeCreatorLabel(profile.creatorLabel);
    const hasCreatorMeta = !!profile.creatorAddress || !!profile.creatorUrl || !!creatorLabel;
    const source = profile.source || 'launchpad_detector';
    const isExplicitClear = normalizedLaunchpad === null && !hasCreatorMeta && source.includes('clear');

    if (!normalizedLaunchpad && !hasCreatorMeta && !isExplicitClear) {
      return;
    }
    await prisma.tokenLaunchpadProfile.upsert({
      where: { chain_address: { chain, address: lower } },
      update: {
        launchpad: normalizedLaunchpad,
        creatorAddress: profile.creatorAddress || undefined,
        creatorUrl: profile.creatorUrl || undefined,
        creatorLabel: creatorLabel || undefined,
        source,
        verifiedAt: new Date(),
        lastCheckedAt: new Date(),
        lastError: null,
      },
      create: {
        chain,
        address: lower,
        launchpad: normalizedLaunchpad,
        creatorAddress: profile.creatorAddress || undefined,
        creatorUrl: profile.creatorUrl || undefined,
        creatorLabel: creatorLabel || undefined,
        source,
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
            if (
              !merged.launchpad
              && existingCreator.launchpad
              && shouldCarryForwardLaunchpadTag(existingCreator.launchpad, existingCreator)
            ) {
              merged.launchpad = normalizeLaunchpadTag(existingCreator.launchpad);
            }
            if (!merged.creatorAddress && existingCreator.creatorAddress) merged.creatorAddress = existingCreator.creatorAddress;
            if (!merged.creatorUrl && existingCreator.creatorUrl) merged.creatorUrl = existingCreator.creatorUrl;
            if (!merged.creatorLabel && existingCreator.creatorLabel) merged.creatorLabel = existingCreator.creatorLabel;
          }

          return merged;
        });

        // 1. Delete rows no longer in latest snapshot for this chain.
        // Keep in-chain writes incremental to avoid full-chain wipe/reinsert churn.
        if (addressList.length > 0) {
          await tx.trendingToken.deleteMany({
            where: {
              chain,
              address: { notIn: addressList }
            }
          });
        } else {
          await tx.trendingToken.deleteMany({
            where: { chain }
          });
        }

        // 2. Upsert snapshot rows with stable metadata fields.
        if (mergedTokens.length > 0) {
          const mappedRows = mergedTokens.map((token, index) => {
            const baseData: Record<string, unknown> = {
              chain,
              address: token.address.toLowerCase(),
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
              baseData.launchpad = normalizeLaunchpadTag((token as any).launchpad) || null;
            }
            if (canWriteCreator) {
              baseData.creatorAddress = (token as any).creatorAddress || null;
              baseData.creatorUrl = (token as any).creatorUrl || null;
              baseData.creatorLabel = (token as any).creatorLabel || null;
            }
            return baseData as any;
          });
          const batches = chunkArray(mappedRows, Math.min(TRENDING_SAVE_BATCH_SIZE, 80));
          for (const batch of batches) {
            await Promise.all(batch.map((row) =>
              tx.trendingToken.upsert({
                where: {
                  chain_address: {
                    chain,
                    address: row.address,
                  }
                },
                update: row,
                create: row,
              })
            ));
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
    // Avoid warming memory cache with a truncated slice (e.g. first request limit=50,
    // later requests limit=100 would otherwise stay capped at 50 until next refresh).
    const fetchLimit = Math.max(limit, 120);
    const result = (!cached || cached.length === 0)
      ? await prisma.trendingToken.findMany({
      where: { chain },
      orderBy: { rank: 'asc' },
      take: fetchLimit,
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
      launchpad: normalizeLaunchpadTag((row as any).launchpad),
      creatorAddress: (row as any).creatorAddress || undefined,
      creatorUrl: (row as any).creatorUrl || undefined,
      creatorLabel: (row as any).creatorLabel || undefined,
    }));

    try {
      // Merge priority (highest last write wins by quality gate):
      // 1) DB snapshot (base row) -> 2) persisted profile -> 3) token meta cache -> 4) launchpad decision cache.
      // Weak labels never overwrite strong labels (handled by shouldReplaceCreator* guards).
      const canReadProfile = await hasTokenLaunchpadProfileTable();
      if (canReadProfile && tokens.length > 0) {
        const addresses = buildAddressVariants(tokens.map((t) => t.address));
        const profiles = await prisma.tokenLaunchpadProfile.findMany({
          where: { chain, address: { in: addresses } },
          orderBy: { updatedAt: 'desc' },
          select: {
            address: true,
            launchpad: true,
            creatorAddress: true,
            creatorUrl: true,
            creatorLabel: true,
            source: true,
            lastCheckedAt: true,
            updatedAt: true,
          },
        });
        const byAddress = new Map<string, typeof profiles[number]>();
        for (const p of profiles) {
          const key = p.address.toLowerCase();
          if (!byAddress.has(key)) byAddress.set(key, p);
        }
        const deterministicLaunchpads = new Set(['clanker', 'four.meme', 'flap', 'pump.fun', 'bonk.fun']);
        for (const token of tokens) {
          const profile = byAddress.get(token.address.toLowerCase());
          if (!profile) continue;
          const profileLaunchpad = normalizeLaunchpadTag(profile.launchpad);
          const tokenLaunchpad = normalizeLaunchpadTag((token as any).launchpad);
          const profileTs = profile.lastCheckedAt || profile.updatedAt || null;
          const profileAgeMs = profileTs ? (Date.now() - profileTs.getTime()) : Number.POSITIVE_INFINITY;
          const isProfileStale = Number.isFinite(profileAgeMs) && profileAgeMs > 24 * 60 * 60 * 1000;
          const hasProfileCreator = !!profile.creatorAddress || !!profile.creatorUrl || !!profile.creatorLabel;

          // If profile explicitly has no launchpad and no creator metadata, clear stale non-deterministic tags
          // from TrendingToken rows (e.g. historical false-positive doppler labels).
          if (!profileLaunchpad && tokenLaunchpad) {
            if (!hasProfileCreator && !deterministicLaunchpads.has(tokenLaunchpad)) {
              delete (token as any).launchpad;
            }
          }

          // Fill missing launchpad from persisted profile when TrendingToken row has no tag.
          // This unblocks capsules for tokens detected asynchronously by background verifier.
          if (!token.launchpad) {
            if (profileLaunchpad && !(isProfileStale && !hasProfileCreator)) {
              token.launchpad = profileLaunchpad as any;
            }
          }
          if (!token.creatorAddress && profile.creatorAddress) token.creatorAddress = profile.creatorAddress;
          if (shouldReplaceCreatorUrl((token as any).creatorUrl, profile.creatorUrl)) (token as any).creatorUrl = profile.creatorUrl;
          if (shouldReplaceCreatorLabel((token as any).creatorLabel, profile.creatorLabel)) (token as any).creatorLabel = profile.creatorLabel;
        }
      }
    } catch {
      // best-effort merge only
    }

    // Launch multiple from fixed launchpad start prices (non-launchpad tokens stay empty).
    for (const token of tokens) {
      const multiple = computeLaunchpadMultiple(chain, token.launchpad, token.price);
      if (multiple) {
        (token as any).launchMultiple = multiple;
      } else {
        delete (token as any).launchMultiple;
      }
    }

    if (!opts?.lightweight && ENABLE_TRENDING_REDIS_METADATA) {
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
          if (shouldReplaceCreatorUrl((token as any).creatorUrl, meta?.creatorUrl)) (token as any).creatorUrl = meta?.creatorUrl;
          if (shouldReplaceCreatorLabel((token as any).creatorLabel, meta?.creatorLabel)) (token as any).creatorLabel = meta?.creatorLabel;
          // Preserve fixed-launchpad multiple as source of truth; only backfill if absent.
          if (!Number.isFinite(Number((token as any).launchMultiple || 0))) {
            const multiple = Number(meta?.launchMultiple || 0);
            const cacheVersion = Number(meta?.cacheVersion || 0);
            if (!fromLegacy && cacheVersion >= 2 && Number.isFinite(multiple) && multiple > 0 && multiple <= 200_000) {
              (token as any).launchMultiple = multiple;
            }
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
          if (!(token as any).launchpad) {
            const cachedLaunchpad = pickLaunchpadFromLaunchpadCache(raw);
            if (cachedLaunchpad) (token as any).launchpad = cachedLaunchpad as any;
          }
          const creator = pickCreatorMetaFromLaunchpadCache(raw);
          if (creator.creatorAddress && !token.creatorAddress) token.creatorAddress = creator.creatorAddress;
          if (shouldReplaceCreatorUrl((token as any).creatorUrl, creator.creatorUrl)) (token as any).creatorUrl = creator.creatorUrl;
          if (shouldReplaceCreatorLabel((token as any).creatorLabel, creator.creatorLabel)) (token as any).creatorLabel = creator.creatorLabel;
        } catch {
          // ignore launchpad cache parse/read errors
        }
      }));
    }

    // Launchpad decision cache is part of core display.
    // It must run for lightweight responses too (e.g. /trending/live),
    // otherwise launchpad capsules can disappear even when decision cache exists.
    if (opts?.lightweight || !ENABLE_TRENDING_REDIS_METADATA) {
      const rawByAddress = await loadLaunchpadDecisionCacheMap(chain, tokens);
      for (const token of tokens) {
        try {
          const raw = rawByAddress.get(String(token.address || '').toLowerCase());
          if (!raw) continue;
          if (!(token as any).launchpad) {
            const cachedLaunchpad = pickLaunchpadFromLaunchpadCache(raw);
            if (cachedLaunchpad) (token as any).launchpad = cachedLaunchpad as any;
          }
          const creator = pickCreatorMetaFromLaunchpadCache(raw);
          if (creator.creatorAddress && !token.creatorAddress) token.creatorAddress = creator.creatorAddress;
          if (shouldReplaceCreatorUrl((token as any).creatorUrl, creator.creatorUrl)) (token as any).creatorUrl = creator.creatorUrl;
          if (shouldReplaceCreatorLabel((token as any).creatorLabel, creator.creatorLabel)) (token as any).creatorLabel = creator.creatorLabel;
        } catch {
          // ignore launchpad cache parse/read errors
        }
      }
    }

    const listedTokens = tokens.filter(shouldKeepListedToken);

    for (const token of listedTokens) {
      const normalized = normalizeCreatorPresentation((token as any).creatorUrl, (token as any).creatorLabel);
      if (normalized.creatorUrl !== undefined) (token as any).creatorUrl = normalized.creatorUrl;
      if (normalized.creatorLabel !== undefined) (token as any).creatorLabel = normalized.creatorLabel;
    }

    if (tokens.length > 0) {
      memoryCache.set(
        cacheKey,
        listedTokens,
        CACHE_TTL.TRENDING_TOKENS
      );
    }

    return listedTokens.slice(0, limit);
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
