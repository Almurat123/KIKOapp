// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Linh Tran
// Reason: Legacy Farcaster search/profile fallback traffic must not consume
//         Neynar quota now that the paid ingress path is handled elsewhere.
// Goal: keep social reads local-first and deterministic, with no automatic
//       Neynar supplementation from the search/profile repository layer.
// Owns: local social search, local profile cache lookup, and KIKO official
//       profile fallback behavior.
// Does Not Own: Farcaster mention ingress, Hub publication, or paid API
//               supplementation policy.
// Design Language:
// - Local database search is the only search path from this repository.
// - Profile reads must not silently fan out to external Farcaster providers.
// - Keep the repository safe to run without any Neynar key at all.
// Document Provenance:
// - Source: repository audit of social search/profile call sites
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: disabling Neynar fallback on search/profile endpoints
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-legacy-reads-disabled.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma, { withRetry } from '../db/prisma.js';
import { get, set, del } from '../cache/cacheClient.js';
import { TrendingCast } from '../types/social.js';
import { Decimal } from 'decimal.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

let hasSearchVectorColumnCache: boolean | null = null;
const FARCASTER_EPOCH_MS = 1609459200000; // 2021-01-01 UTC
const MAX_FUTURE_SKEW_MS = 7 * 24 * 60 * 60 * 1000; // tolerate small clock skew
const FULL_LIST_LIMIT = 1500; // In practice DB is capped lower, but keep headroom for sorting/pagination

type SocialTimeRange = 'trending' | '24h' | '7d' | '30d';

function getTimeRangeDays(timeRange: SocialTimeRange): number {
    if (timeRange === '7d') return 7;
    if (timeRange === '30d') return 30;
    return 1;
}

function getTrendingScoreProfile(timeRange: SocialTimeRange): {
    gravity: number;
    offsetHours: number;
    floorWeight: number;
} {
    switch (timeRange) {
        case '7d':
            return { gravity: 0.72, offsetHours: 12, floorWeight: 0.16 };
        case '30d':
            return { gravity: 0.48, offsetHours: 24, floorWeight: 0.26 };
        case '24h':
            return { gravity: 0.95, offsetHours: 2, floorWeight: 0.10 };
        case 'trending':
        default:
            return { gravity: 1.0, offsetHours: 2, floorWeight: 0.10 };
    }
}

function computeWindowTrendingScore(
    likes: number,
    recasts: number,
    replies: number,
    timestamp: Date,
    timeRange: SocialTimeRange
): number {
    const now = Date.now();
    const ageHours = Math.max(0, (now - timestamp.getTime()) / (1000 * 60 * 60));
    const { gravity, offsetHours, floorWeight } = getTrendingScoreProfile(timeRange);
    const engagement = likes + (2 * recasts) + (0.5 * replies);
    const decayScore = engagement / Math.pow(Math.max(ageHours + offsetHours, 0.01), gravity);
    const floorScore = (likes * floorWeight) + (recasts * floorWeight * 1.35) + (replies * floorWeight * 0.35);
    return Math.min(99999999.99, Math.max(decayScore, floorScore));
}

function mapRowToTrendingCast(row: any, index: number, scoreOverride?: number): TrendingCast {
    return {
        rank: index + 1,
        hash: row.hash,
        fid: row.fid,
        author: {
            fid: row.fid,
            username: row.authorUsername || '',
            displayName: row.authorDisplayName || '',
            avatar: row.authorAvatar || '',
            verified: row.authorVerified,
            bio: row.authorBio || undefined,
            twitter: row.authorTwitter || undefined,
            creatorCoin: row.authorCreatorCoin ? JSON.parse(row.authorCreatorCoin) : undefined,
        },
        text: row.text,
        timestamp: row.timestamp,
        embeds: row.embeds as any,
        mentions: row.mentions as any,
        parentCastId: row.parentCastFid ? { fid: row.parentCastFid, hash: row.parentCastHash || '' } : undefined,
        stats: {
            likes: row.likes,
            recasts: row.recasts,
            replies: row.replies,
        },
        heatScore: scoreOverride ?? (Number(row.heatScore) || 0),
        isBaseAppCoin: row.isBaseAppCoin,
        baseAppCoinMetadata: row.baseAppCoinMetadata as any,
        coinValue: row.coinValue ? String(row.coinValue) : undefined,
    };
}

function sortRowsForTimeRange<T extends {
    likes: number;
    recasts: number;
    replies: number;
    timestamp: Date;
    hash: string;
}>(rows: T[], timeRange: SocialTimeRange): Array<T & { computedScore: number }> {
    return rows
        .map((row) => ({
            ...row,
            computedScore: computeWindowTrendingScore(
                Number(row.likes) || 0,
                Number(row.recasts) || 0,
                Number(row.replies) || 0,
                row.timestamp,
                timeRange
            )
        }))
        .sort((a, b) => {
            if (b.computedScore !== a.computedScore) return b.computedScore - a.computedScore;
            const tsDiff = b.timestamp.getTime() - a.timestamp.getTime();
            if (tsDiff !== 0) return tsDiff;
            return b.hash.localeCompare(a.hash);
        });
}

async function hasSearchVectorColumn(): Promise<boolean> {
    if (hasSearchVectorColumnCache !== null) return hasSearchVectorColumnCache;
    try {
        const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'trending_casts'
                  AND column_name = 'search_vector'
            ) AS exists
        `;
        hasSearchVectorColumnCache = !!rows?.[0]?.exists;
    } catch {
        hasSearchVectorColumnCache = false;
    }
    return hasSearchVectorColumnCache;
}

/**
 * Parse formatted coin value strings like "$2.1K", "$1.5M" into raw numbers
 */
function parseCoinValue(value: string | number | undefined | null): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return value;

    // Remove $ and commas
    let cleaned = String(value).replace(/[$,]/g, '').trim();
    if (!cleaned) return null;

    // Handle K (thousands) and M (millions) suffixes
    const multipliers: Record<string, number> = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
    const suffix = cleaned.slice(-1).toUpperCase();

    if (multipliers[suffix]) {
        const num = parseFloat(cleaned.slice(0, -1));
        return isNaN(num) ? null : num * multipliers[suffix];
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function normalizeCastTimestamp(input: unknown): Date | null {
    const now = Date.now();
    let ts: number | null = null;

    if (input instanceof Date) {
        ts = input.getTime();
    } else if (typeof input === 'number' && Number.isFinite(input)) {
        ts = input;
    } else if (typeof input === 'string') {
        const parsedDate = new Date(input).getTime();
        if (Number.isFinite(parsedDate) && !Number.isNaN(parsedDate)) {
            ts = parsedDate;
        } else {
            const parsedNum = Number(input);
            if (Number.isFinite(parsedNum)) ts = parsedNum;
        }
    }

    if (ts === null || !Number.isFinite(ts)) return null;

    // Seconds -> milliseconds (unix or farcaster style)
    if (ts > 0 && ts < 1e11) {
        const unixMs = ts * 1000;
        const farcasterMs = ts * 1000 + FARCASTER_EPOCH_MS;

        // Prefer candidate closer to "now" and within sane bounds
        const unixDelta = Math.abs(now - unixMs);
        const farcasterDelta = Math.abs(now - farcasterMs);
        ts = farcasterDelta < unixDelta ? farcasterMs : unixMs;
    }

    // Repair double-epoch drift: (unix/farcaster ms) + FARCASTER_EPOCH_MS
    if (ts > now + MAX_FUTURE_SKEW_MS) {
        const deEpoch = ts - FARCASTER_EPOCH_MS;
        if (deEpoch >= FARCASTER_EPOCH_MS && deEpoch <= now + MAX_FUTURE_SKEW_MS) {
            ts = deEpoch;
        }
    }

    // Hard bounds: reject obviously invalid timestamps
    if (ts < FARCASTER_EPOCH_MS || ts > now + MAX_FUTURE_SKEW_MS) {
        return null;
    }

    return new Date(ts);
}

export async function getLastUpdateTime(): Promise<Date | null> {
    try {
        const result = await prisma.trendingCast.aggregate({
            _max: {
                updatedAt: true
            }
        });
        return result._max.updatedAt || null;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'SocialRepo: Error getting last update time', { error: error.message });
        return null;
    }
}

export async function saveTrendingCasts(casts: TrendingCast[]): Promise<void> {
    if (casts.length === 0) {
        logger.warn(LogCode.SOC_TRENDING_UPDATED, 'SocialRepo: Attempted to save empty casts array, skipping to preserve existing data');
        return;
    }

    const timerLabel = 'save_trending_casts';
    logger.startTimer(timerLabel);
    try {
        // Sort by likes before saving to ensure correct order for rank
        const sortedCasts = [...casts].sort((a, b) => {
            const likesA = typeof a.stats.likes === 'number' ? a.stats.likes : parseInt(String(a.stats.likes)) || 0;
            const likesB = typeof b.stats.likes === 'number' ? b.stats.likes : parseInt(String(b.stats.likes)) || 0;
            return likesB - likesA;
        });

        await withRetry(async () => {
            // Prisma doesn't support transaction-level isolation easily without $transaction
            // We'll use $transaction for the bulk upsert and cleanup
            // Set timeout to 60s to handle high volume of writes (prevent P2028)
            await prisma.$transaction(async (tx) => {
                const processedAuthorFids = new Set<number>();

                for (let i = 0; i < sortedCasts.length; i++) {
                    const cast = sortedCasts[i];
                    const normalizedTimestamp = normalizeCastTimestamp(cast.timestamp);

                    // FINAL GUARD: Prevent mock data from ever hitting the DB
                    const isMockUser = !cast.author.username ||
                        cast.author.username.startsWith('fid') ||
                        !cast.author.displayName ||
                        cast.author.displayName.startsWith('User ') ||
                        (cast.author.avatar && cast.author.avatar.includes('placehold.co'));

                    if (isMockUser) {
                        logger.warn(LogCode.SOC_TRENDING_UPDATED, 'SocialRepo: Dropping cast with mock user data', { hash: cast.hash, fid: cast.fid });
                        continue;
                    }
                    if (!normalizedTimestamp) {
                        logger.warn(LogCode.SOC_TRENDING_UPDATED, 'SocialRepo: Dropping cast with invalid timestamp', {
                            hash: cast.hash,
                            fid: cast.fid,
                            rawTimestamp: cast.timestamp
                        });
                        continue;
                    }

                    const likes = typeof cast.stats.likes === 'number' ? cast.stats.likes : parseInt(String(cast.stats.likes)) || 0;
                    const recasts = typeof cast.stats.recasts === 'number' ? cast.stats.recasts : parseInt(String(cast.stats.recasts)) || 0;
                    const replies = typeof cast.stats.replies === 'number' ? cast.stats.replies : parseInt(String(cast.stats.replies)) || 0;

                    let heatScore = typeof cast.heatScore === 'number' ? cast.heatScore : parseFloat(String(cast.heatScore)) || 0;
                    if (heatScore > 999.99) heatScore = 999.99;

                    await tx.trendingCast.upsert({
                        where: { hash: cast.hash },
                        update: {
                            fid: cast.fid,
                            authorUsername: cast.author.username,
                            authorDisplayName: cast.author.displayName,
                            authorAvatar: cast.author.avatar,
                            authorVerified: cast.author.verified || false,
                            text: cast.text,
                            timestamp: normalizedTimestamp,
                            embeds: cast.embeds || [],
                            parentCastFid: cast.parentCastId?.fid || null,
                            parentCastHash: cast.parentCastId?.hash || null,
                            parentUrl: (cast as any).parentUrl || null,
                            mentionsPositions: (cast as any).mentionsPositions || [],
                            likes,
                            recasts,
                            replies,
                            heatScore: new Decimal(heatScore),
                            rank: i + 1,
                            isBaseAppCoin: cast.isBaseAppCoin || false,
                            baseAppCoinMetadata: cast.baseAppCoinMetadata || null,
                            coinValue: parseCoinValue(cast.coinValue) !== null ? new Decimal(parseCoinValue(cast.coinValue)!) : null,
                            authorBio: cast.author.bio || null,
                            mentions: cast.mentions || [],
                            authorCreatorCoin: cast.author.creatorCoin ? JSON.stringify(cast.author.creatorCoin) : null,
                            authorTwitter: cast.author.twitter || null,
                            authorUrl: (cast.author as any).url || null,
                            authorBanner: (cast.author as any).banner || null,
                            authorPrimaryAddress: (cast.author as any).primaryAddress || null,
                            authorLocation: (cast.author as any).location || null,
                            updatedAt: new Date(),
                        },
                        create: {
                            hash: cast.hash,
                            fid: cast.fid,
                            authorUsername: cast.author.username,
                            authorDisplayName: cast.author.displayName,
                            authorAvatar: cast.author.avatar,
                            authorVerified: cast.author.verified || false,
                            text: cast.text,
                            timestamp: normalizedTimestamp,
                            embeds: cast.embeds || [],
                            parentCastFid: cast.parentCastId?.fid || null,
                            parentCastHash: cast.parentCastId?.hash || null,
                            parentUrl: (cast as any).parentUrl || null,
                            mentionsPositions: (cast as any).mentionsPositions || [],
                            likes,
                            recasts,
                            replies,
                            heatScore: new Decimal(heatScore),
                            rank: i + 1,
                            isBaseAppCoin: cast.isBaseAppCoin || false,
                            baseAppCoinMetadata: cast.baseAppCoinMetadata || null,
                            coinValue: parseCoinValue(cast.coinValue) !== null ? new Decimal(parseCoinValue(cast.coinValue)!) : null,
                            authorBio: cast.author.bio || null,
                            mentions: cast.mentions || [],
                            authorCreatorCoin: cast.author.creatorCoin ? JSON.stringify(cast.author.creatorCoin) : null,
                            authorTwitter: cast.author.twitter || null,
                            authorUrl: (cast.author as any).url || null,
                            authorBanner: (cast.author as any).banner || null,
                            authorPrimaryAddress: (cast.author as any).primaryAddress || null,
                            authorLocation: (cast.author as any).location || null,
                        }
                    });

                    // AUTO-FIX: If this cast has valid author data (not mock), propagate to all other entries for this FID
                    // OPTIMIZATION: Only do this once per batch per FID to save DB calls
                    const isValidAuthorData = cast.author.username &&
                        !cast.author.username.startsWith('fid') &&
                        cast.author.displayName &&
                        !cast.author.displayName.startsWith('User ') &&
                        cast.author.avatar &&
                        !cast.author.avatar.includes('placehold.co');

                    if (isValidAuthorData && !processedAuthorFids.has(cast.fid)) {
                        await tx.trendingCast.updateMany({
                            where: {
                                fid: cast.fid,
                                hash: { not: cast.hash }, // Don't update the one we just upserted
                                OR: [
                                    { authorUsername: { startsWith: 'fid' } },
                                    { authorDisplayName: { startsWith: 'User ' } },
                                    { authorAvatar: { startsWith: 'https://placehold.co' } },
                                ]
                            },
                            data: {
                                authorUsername: cast.author.username,
                                authorDisplayName: cast.author.displayName,
                                authorAvatar: cast.author.avatar,
                                authorBio: cast.author.bio || null,
                                authorTwitter: cast.author.twitter || null,
                            }
                        });
                        processedAuthorFids.add(cast.fid);
                    }
                }

                // Prune old low-quality data
                const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
                const longTermCutoff = new Date(1609459200000);
                await tx.trendingCast.deleteMany({
                    where: {
                        OR: [
                            { AND: [{ timestamp: { lt: cutoff } }, { likes: { lte: 0 } }] },
                            { timestamp: { lt: longTermCutoff } },
                            { timestamp: { gt: new Date(Date.now() + MAX_FUTURE_SKEW_MS) } }
                        ],
                        isBaseAppCoin: false
                    }
                });

                // HARD CAP: Keep only 1500 casts maximum, prioritized by heatScore
                // [FIX]: Previously used timestamp: 'desc' which ejected all older posts,
                // preventing 7D/30D filters from having any historical data to show.
                // Now use heatScore: 'desc' so high-engagement historical posts survive.
                const MAX_CASTS = 1500;
                const totalCasts = await tx.trendingCast.count();
                if (totalCasts > MAX_CASTS) {
                    // Keep the posts with the highest heat scores (not just the newest)
                    const castsToKeep = await tx.trendingCast.findMany({
                        orderBy: [{ heatScore: 'desc' }, { timestamp: 'desc' }],
                        take: MAX_CASTS,
                        select: { hash: true }
                    });
                    const hashesToKeep = castsToKeep.map(c => c.hash);

                    await tx.trendingCast.deleteMany({
                        where: {
                            hash: { notIn: hashesToKeep }
                        }
                    });
                    console.log(`[SocialRepo] Cleaned up ${totalCasts - MAX_CASTS} low-score casts (cap: ${MAX_CASTS})`);
                }
            }, {
                timeout: 60000, // 60 seconds (default is 5s)
                maxWait: 5000
            });
        });

        await del('social:trending:casts:24h');
        const fullMergedList = await getTrendingCasts(500);

        if (fullMergedList.length > 0) {
            await set('social:trending:casts:24h', JSON.stringify(fullMergedList), 180);
            logger.info(LogCode.SOC_TRENDING_UPDATED, `SocialRepo: Updated cache with ${fullMergedList.length} merged casts`);
        } else {
            await set('social:trending:casts', JSON.stringify(sortedCasts), 180);
        }

        logger.info(LogCode.SOC_TRENDING_UPDATED, `SocialRepo: Saved ${sortedCasts.length} trending casts to database`);
        logger.endTimer(timerLabel, LogCode.SOC_TRENDING_UPDATED, { count: sortedCasts.length });
    } catch (error: any) {
        logger.error(LogCode.SOC_TRENDING_UPDATED, 'SocialRepo: Error saving trending casts', { error: error.message });
        throw error;
    }
}

export async function getTrendingCasts(
    limit: number = 50,
    timeRange: SocialTimeRange = 'trending',
    offset: number = 0
): Promise<TrendingCast[]> {
    const timerLabel = `get_trending_casts_${timeRange}`;
    logger.startTimer(timerLabel);
    try {
        const cacheKey = 'social:trending:casts:24h';

        // 1. Try Cache
        if (timeRange === 'trending') {
            try {
                const cached = await get(cacheKey);
                if (cached) {
                    const casts = JSON.parse(cached) as TrendingCast[];
                    return casts.slice(offset, offset + limit);
                }
            } catch (ignore) { }
        }

        // 2. Fetch full window slice from DB, then sort by time-range-aware score in memory.
        const Jan1_2021 = new Date(1609459200000);
        let where: any = { timestamp: { gt: Jan1_2021 } };

        // Determine params for DB query
        let queryLimit = FULL_LIST_LIMIT;
        if (timeRange === 'trending') {
            const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
            where = {
                timestamp: { gte: cutoff, lte: new Date() } // strict recency guard: hide stale months-old data
            };
        } else {
            const days = getTimeRangeDays(timeRange);
            const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
            where = { timestamp: { gte: cutoff } };
        }

        const rows = await prisma.trendingCast.findMany({
            where,
            orderBy: [{ heatScore: 'desc' }, { timestamp: 'desc' }, { hash: 'desc' }],
            take: queryLimit,
        });

        const sortedRows = sortRowsForTimeRange(rows, timeRange);
        const casts: TrendingCast[] = sortedRows.map((row, index) => mapRowToTrendingCast(row, index, row.computedScore));

        // 3. Update Cache (Only for trending)
        if (timeRange === 'trending' && casts.length > 0) {
            await set(cacheKey, JSON.stringify(casts), 180);
        }

        // [OPTIMIZED]: Embed 数据已在 socialDataJob 后台任务中预处理并保存到数据库
        // 不再进行实时 API 调用获取 embed 内容，直接使用缓存数据

        // 4. Return Requested Slice
        const result = casts.slice(offset, offset + limit);
        logger.endTimer(timerLabel, LogCode.SOC_CAST_FETCHED, { timeRange, limit, offset, count: result.length, fromCache: false });
        return result;

    } catch (error: any) {
        logger.error(LogCode.SOC_CAST_FETCHED, 'SocialRepo: Error getting trending casts', { error: error.message });
        return [];
    }
}

/**
 * Search Farcaster casts by keyword using PostgreSQL full-text search
 * Searches in cast text, author username, and display name
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 20)
 * @returns Array of matching casts sorted by relevance and engagement
 */
export async function searchCasts(
    query: string,
    limit: number = 20
): Promise<TrendingCast[]> {
    try {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const trimmedQuery = query.trim();
        const timerLabel = `search_casts_${trimmedQuery.slice(0, 10)}`;
        logger.startTimer(timerLabel);
        logger.debug(LogCode.SOC_CAST_FETCHED, `SocialRepo: Searching casts for: "${trimmedQuery}" (limit: ${limit})`);

        // Preferred: PostgreSQL full-text search (requires `search_vector`).
        // Fallback: plain ILIKE/contains search (works even if migrations didn't add `search_vector`).
        let casts: TrendingCast[] = [];
        const canUseSearchVector = await hasSearchVectorColumn();
        try {
            if (!canUseSearchVector) {
                throw new Error('search_vector_missing');
            }
            const result = await prisma.$queryRaw<any[]>`
        SELECT 
          cast_hash as hash,
          fid,
          author_username,
          author_display_name,
          author_avatar,
          author_verified,
          author_bio,
          author_twitter,
          author_creator_coin,
          text,
          timestamp,
          embeds,
          parent_cast_fid,
          parent_cast_hash,
          stats_likes,
          stats_recasts,
          stats_replies,
          heat_score,
          is_base_app_coin,
          base_app_coin_metadata,
          coin_value,
          mentions,
          ts_rank(search_vector, plainto_tsquery('english', ${trimmedQuery})) as relevance_score
        FROM trending_casts
        WHERE 
          (search_vector @@ plainto_tsquery('english', ${trimmedQuery}))
          OR (text ILIKE ${'%' + trimmedQuery + '%'})
          OR (author_username ILIKE ${'%' + trimmedQuery + '%'})
        ORDER BY 
          relevance_score DESC,
          stats_likes DESC,
          updated_at DESC
        LIMIT ${limit}
      `;

            casts = result.map((row, index) => ({
                rank: index + 1,
                hash: row.hash,
                fid: row.fid,
                author: {
                    fid: row.fid,
                    username: row.author_username || '',
                    displayName: row.author_display_name || '',
                    avatar: row.author_avatar || '',
                    verified: row.author_verified || false,
                    bio: row.author_bio || undefined,
                    twitter: row.author_twitter || undefined,
                    creatorCoin: row.author_creator_coin ? (typeof row.author_creator_coin === 'string' ? JSON.parse(row.author_creator_coin) : row.author_creator_coin) : undefined,
                },
                text: row.text,
                timestamp: row.timestamp,
                embeds: row.embeds as any,
                mentions: row.mentions as any,
                parentCastId: row.parent_cast_fid ? { fid: row.parent_cast_fid, hash: row.parent_cast_hash || '' } : undefined,
                stats: {
                    likes: row.stats_likes || 0,
                    recasts: row.stats_recasts || 0,
                    replies: row.stats_replies || 0,
                },
                heatScore: Number(row.heat_score) || 0,
                isBaseAppCoin: row.is_base_app_coin,
                baseAppCoinMetadata: row.base_app_coin_metadata as any,
                coinValue: row.coin_value ? String(row.coin_value) : undefined,
            }));
        } catch (rawError: any) {
            const message = rawError?.meta?.message || rawError?.message || '';
            const code = rawError?.meta?.code || rawError?.code || '';
            const missingVector = String(message).includes('search_vector') || String(code) === '42703';

            if (!missingVector && rawError?.message !== 'search_vector_missing') throw rawError;
            hasSearchVectorColumnCache = false;

            console.warn('[SocialRepo] search_vector missing; falling back to simple search');

            const rows = await prisma.trendingCast.findMany({
                where: {
                    OR: [
                        { text: { contains: trimmedQuery, mode: 'insensitive' } },
                        { authorUsername: { contains: trimmedQuery, mode: 'insensitive' } },
                        { authorDisplayName: { contains: trimmedQuery, mode: 'insensitive' } },
                    ],
                },
                orderBy: [{ likes: 'desc' }, { heatScore: 'desc' }, { updatedAt: 'desc' }],
                take: limit,
            });

            casts = rows.map((row, index) => ({
                rank: index + 1,
                hash: row.hash,
                fid: row.fid,
                author: {
                    fid: row.fid,
                    username: row.authorUsername || '',
                    displayName: row.authorDisplayName || '',
                    avatar: row.authorAvatar || '',
                    verified: row.authorVerified,
                    bio: row.authorBio || undefined,
                    twitter: row.authorTwitter || undefined,
                    creatorCoin: row.authorCreatorCoin ? JSON.parse(row.authorCreatorCoin) : undefined,
                },
                text: row.text,
                timestamp: row.timestamp,
                embeds: row.embeds as any,
                mentions: row.mentions as any,
                parentCastId: row.parentCastFid ? { fid: row.parentCastFid, hash: row.parentCastHash || '' } : undefined,
                stats: {
                    likes: row.likes,
                    recasts: row.recasts,
                    replies: row.replies,
                },
                heatScore: Number(row.heatScore) || 0,
                isBaseAppCoin: row.isBaseAppCoin,
                baseAppCoinMetadata: row.baseAppCoinMetadata as any,
                coinValue: row.coinValue ? String(row.coinValue) : undefined,
            }));
        }

        const result = casts;
        logger.endTimer(timerLabel, LogCode.SOC_CAST_FETCHED, { query: trimmedQuery, limit, count: result.length });
        return result;
    } catch (error: any) {
        logger.error(LogCode.SOC_CAST_FETCHED, 'SocialRepo: Error searching casts', { error: error.message });
        return [];
    }
}

/**
 * Hybrid search: Local DB only
 * Keeps the call shape for existing callers without Neynar fanout.
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 20)
 * @param useNeynar - Retained for backward compatibility; ignored.
 * @param sortBy - Sort order: 'algorithmic' (engagement) or 'recent' (desc_chron)
 * @returns Local array of casts
 */
export async function hybridSearchCasts(
    query: string,
    limit: number = 20,
    useNeynar: boolean = true,
    sortBy: 'algorithmic' | 'recent' = 'algorithmic'
): Promise<TrendingCast[]> {
    try {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const trimmedQuery = query.trim();
        void useNeynar;
        void sortBy;
        console.log(`[SocialRepo] Local-only search for: "${trimmedQuery}" (limit: ${limit}, sort: ${sortBy})`);

        // Search local database only.
        const localResults = await searchCasts(trimmedQuery, limit);
        console.log(`[SocialRepo] Local search found: ${localResults.length} casts`);
        return localResults.slice(0, limit);

    } catch (error) {
        console.error('[SocialRepo] Error in hybrid search:', error);
        return [];
    }
}
/**
 * Fetch a Farcaster profile by username, with caching
 */
export async function getFarcasterProfile(username: string): Promise<any | null> {
    const cacheKey = `fc:profile:${username.toLowerCase()}`;

    try {
        // 1. Check DB Cache table
        const cached = await prisma.cache.findUnique({
            where: { key: cacheKey }
        });

        if (cached && cached.expiresAt && cached.expiresAt > new Date()) {
            return JSON.parse(cached.value);
        }

        if (username.toLowerCase() === 'kikoapp') {
            const { resolveOfficialKikoProfile } = await import('../services/farcasterRelationshipService.js');
            const officialProfile = await resolveOfficialKikoProfile();
            if (officialProfile) {
                const fallbackProfile = {
                    fid: officialProfile.fid,
                    username: officialProfile.username,
                    displayName: officialProfile.username,
                    pfp: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/ea891190-307c-4f75-2b36-cea864cb6800/original'
                };

                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                await prisma.cache.upsert({
                    where: { key: cacheKey },
                    update: {
                        value: JSON.stringify(fallbackProfile),
                        expiresAt,
                        updatedAt: new Date()
                    },
                    create: {
                        key: cacheKey,
                        value: JSON.stringify(fallbackProfile),
                        expiresAt,
                        updatedAt: new Date()
                    }
                });

                return fallbackProfile;
            }
        }

        return null;
    } catch (error: any) {
        logger.error(LogCode.SOC_USER_LOOKUP, `SocialRepo: Error getting Farcaster profile for ${username}`, { error: error.message });
        return null;
    }
}

/**
 * Check if a user follows the Kiko account on Farcaster
 */
export async function checkUserFollowsKiko(fid: number): Promise<boolean> {
    try {
        const { resolveKikoFollowState } = await import('../services/farcasterRelationshipService.js');
        const followState = await resolveKikoFollowState(fid);
        logger.info(LogCode.SOC_FOLLOW_DETECTED, 'SocialRepo: Checked follow status', {
            fid,
            isFollowing: followState.followsKiko,
            status: followState.status,
        });
        return followState.followsKiko === true;
    } catch (error: any) {
        logger.error(LogCode.SOC_FOLLOW_DETECTED, `SocialRepo: Error checking if FID ${fid} follows Kiko`, { error: error.message });
        return false;
    }
}

/**
 * Get posts that need engagement refresh
 * Criteria: High engagement, recent (within 7 days), but haven't been updated recently
 */
export async function getPostsForRefresh(limit: number = 200, maxAgeDays: number = 7): Promise<{ hash: string, fid: number }[]> {
    try {
        const cutoff = new Date(Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000));
        // Refresh items that haven't been updated in 30 mins
        const statsCutoff = new Date(Date.now() - (30 * 60 * 1000));

        // Use raw query to prioritize posts that are BOTH popular AND stale
        // Score = likes * seconds_since_update
        const posts = await prisma.$queryRaw<{ hash: string, fid: number }[]>`
            SELECT cast_hash AS hash, fid 
            FROM trending_casts
            WHERE timestamp > ${cutoff}
            AND (stats_last_updated_at < ${statsCutoff} OR stats_last_updated_at IS NULL)
            ORDER BY 
                stats_likes DESC,
                stats_last_updated_at ASC
            LIMIT ${limit}
        `;

        return posts;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'SocialRepo: Error getting posts for refresh', { error: error.message });
        return [];
    }
}

/**
 * Update engagement stats for a single cast
 */
export async function updateCastStats(hash: string, stats: { likes: number, recasts: number, replies: number }): Promise<void> {
    try {
        await prisma.trendingCast.update({
            where: { hash },
            data: {
                likes: stats.likes,
                recasts: stats.recasts,
                replies: stats.replies,
                statsLastUpdatedAt: new Date()
            }
        });
    } catch (error: any) {
        // Warning mainly used if cast was deleted in between reads
        logger.warn(LogCode.SYS_ERROR, `SocialRepo: Failed to update stats for ${hash}`, { error: error.message });
    }
}

/**
 * Recalculate heat scores for all relevant posts using improved decay formula
 * [Logic]: Uses GREATEST(decay_score, floor_score) to ensure high-engagement posts stay visible
 * [Ref]: HackerNews uses G=1.8, Reddit uses log scaling. We use G=1.0 + floor for balance.
 * [Risk]: Too low decay may cause stale content to dominate; floor prevents complete decay
 * 
 * New Formula: GREATEST(
 *   (engagement) / (ageHours + 2)^1.0,  -- Decay score (reduced from 1.5 to 1.0)
 *   likes * 0.1                          -- Floor score (10% of likes as minimum)
 * )
 */
export async function recalculateHeatScores(): Promise<void> {
    const timerLabel = 'recalc_heat_scores';
    logger.startTimer(timerLabel);

    try {
        // Update posts from the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));

        // [Logic]: Use GREATEST to pick max between decay_score and floor_score
        // [Ref]: Inspired by Reddit's approach - high quality content never fully disappears
        // [Risk]: If floor is too high, old viral posts may dominate; 0.1 is conservative
        const updated = await prisma.$executeRaw`
            UPDATE trending_casts
            SET heat_score = LEAST(
                GREATEST(
                    -- Decay score: engagement / (ageHours + 2)^1.0 (reduced gravity from 1.5)
                    CAST((stats_likes + (2 * stats_recasts) + (0.5 * stats_replies)) AS DECIMAL) / 
                    POWER(GREATEST((EXTRACT(EPOCH FROM (NOW() - timestamp)) / 3600) + 2, 0.01), 1.0),
                    -- Floor score: 10% of likes as minimum heat score
                    CAST(stats_likes AS DECIMAL) * 0.1
                ),
                99999999.99
            )
            WHERE timestamp > ${thirtyDaysAgo}
            AND timestamp <= NOW()
        `;

        logger.info(LogCode.SYS_INFO, `SocialRepo: Recalculated heat scores for ${updated} casts`);
        logger.endTimer(timerLabel, LogCode.SYS_INFO, { count: Number(updated) });
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'SocialRepo: Error recalculating heat scores', { error: error.message });
    }
}

/**
 * Cursor-based pagination for trending casts (Twitter/X style)
 * Uses composite key (heatScore, timestamp, hash) for stable ordering
 * Prevents duplicates during pagination and handles real-time data changes
 */
export interface CursorPaginationResult {
    casts: TrendingCast[];
    nextCursor: string | null;
    hasMore: boolean;
}

export function encodeCursor(heatScore: number, timestamp: Date, hash: string): string {
    return Buffer.from(JSON.stringify({ h: heatScore, t: timestamp.getTime(), id: hash })).toString('base64');
}

export function decodeCursor(cursor: string): { heatScore: number; timestamp: number; hash: string } | null {
    try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        return { heatScore: decoded.h, timestamp: decoded.t, hash: decoded.id };
    } catch {
        return null;
    }
}

export async function getTrendingCastsWithCursor(
    limit: number = 30,
    timeRange: SocialTimeRange = 'trending',
    cursor?: string,
    sortBy: 'trending' | 'newest' = 'trending'
): Promise<CursorPaginationResult> {
    try {
        const Jan1_2021 = new Date(1609459200000);
        let baseWhere: any = { timestamp: { gt: Jan1_2021 } };

        // Time range filter
        if (timeRange === 'trending') {
            const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
            baseWhere = {
                timestamp: { gte: cutoff, lte: new Date() }
            };
        } else {
            const days = getTimeRangeDays(timeRange);
            const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
            baseWhere = { timestamp: { gte: cutoff } };
        }

        const rows = await prisma.trendingCast.findMany({
            where: baseWhere,
            orderBy: sortBy === 'newest'
                ? [{ timestamp: 'desc' as const }, { hash: 'desc' as const }]
                : [{ heatScore: 'desc' as const }, { timestamp: 'desc' as const }, { hash: 'desc' as const }],
            take: FULL_LIST_LIMIT,
        });

        const sortedRows = sortBy === 'newest'
            ? rows
                .map((row) => ({ ...row, computedScore: Number(row.heatScore) || 0 }))
                .sort((a, b) => {
                    const tsDiff = b.timestamp.getTime() - a.timestamp.getTime();
                    if (tsDiff !== 0) return tsDiff;
                    return b.hash.localeCompare(a.hash);
                })
            : sortRowsForTimeRange(rows, timeRange);

        let filteredRows = sortedRows;
        if (cursor) {
            const cursorData = decodeCursor(cursor);
            if (cursorData) {
                filteredRows = sortedRows.filter((row) => {
                    if (sortBy === 'newest') {
                        const rowTs = row.timestamp.getTime();
                        if (rowTs < cursorData.timestamp) return true;
                        if (rowTs > cursorData.timestamp) return false;
                        return row.hash < cursorData.hash;
                    }

                    if (row.computedScore < cursorData.heatScore) return true;
                    if (row.computedScore > cursorData.heatScore) return false;

                    const rowTs = row.timestamp.getTime();
                    if (rowTs < cursorData.timestamp) return true;
                    if (rowTs > cursorData.timestamp) return false;
                    return row.hash < cursorData.hash;
                });
            }
        }

        const hasMore = filteredRows.length > limit;
        const resultRows = hasMore ? filteredRows.slice(0, limit) : filteredRows;

        const casts: TrendingCast[] = resultRows.map((row, index) =>
            mapRowToTrendingCast(
                row,
                index,
                sortBy === 'trending' ? row.computedScore : undefined
            )
        );

        // [OPTIMIZED]: Embed 数据已在 socialDataJob 后台任务中预处理并保存到数据库
        // 不再进行实时 API 调用获取 embed 内容，直接使用缓存数据

        // Generate next cursor from last item
        let nextCursor: string | null = null;
        if (hasMore && resultRows.length > 0) {
            const lastRow = resultRows[resultRows.length - 1];
            nextCursor = encodeCursor(
                sortBy === 'trending' ? lastRow.computedScore : (Number(lastRow.heatScore) || 0),
                lastRow.timestamp,
                lastRow.hash
            );
        }

        return { casts, nextCursor, hasMore };

    } catch (error: any) {
        logger.error(LogCode.SOC_CAST_FETCHED, 'SocialRepo: Error in cursor pagination', { error: error.message });
        return { casts: [], nextCursor: null, hasMore: false };
    }
}
