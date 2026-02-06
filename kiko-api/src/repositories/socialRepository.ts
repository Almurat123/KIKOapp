import prisma, { withRetry } from '../db/prisma.js';
import { get, set, del } from '../cache/redis.js';
import { TrendingCast } from '../types/social.js';
import { Decimal } from 'decimal.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

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
                            timestamp: new Date(cast.timestamp),
                            embeds: cast.embeds || [],
                            parentCastFid: cast.parentCastId?.fid || null,
                            parentCastHash: cast.parentCastId?.hash || null,
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
                            timestamp: new Date(cast.timestamp),
                            embeds: cast.embeds || [],
                            parentCastFid: cast.parentCastId?.fid || null,
                            parentCastHash: cast.parentCastId?.hash || null,
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
                const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));
                const longTermCutoff = new Date(1609459200000);
                await tx.trendingCast.deleteMany({
                    where: {
                        OR: [
                            { AND: [{ timestamp: { lt: cutoff } }, { likes: { lte: 5 } }] },
                            { timestamp: { lt: longTermCutoff } }
                        ],
                        isBaseAppCoin: false
                    }
                });

                // HARD CAP: Keep only 1000 casts maximum
                const MAX_CASTS = 1000;
                const totalCasts = await tx.trendingCast.count();
                if (totalCasts > MAX_CASTS) {
                    // Find the oldest casts beyond the limit and delete them
                    const castsToKeep = await tx.trendingCast.findMany({
                        orderBy: [{ timestamp: 'desc' }, { likes: 'desc' }],
                        take: MAX_CASTS,
                        select: { hash: true }
                    });
                    const hashesToKeep = castsToKeep.map(c => c.hash);

                    await tx.trendingCast.deleteMany({
                        where: {
                            hash: { notIn: hashesToKeep }
                        }
                    });
                    console.log(`[SocialRepo] Cleaned up ${totalCasts - MAX_CASTS} old casts (cap: ${MAX_CASTS})`);
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
    timeRange: 'trending' | '24h' | '7d' | '30d' = 'trending',
    offset: number = 0
): Promise<TrendingCast[]> {
    const timerLabel = `get_trending_casts_${timeRange}`;
    logger.startTimer(timerLabel);
    try {
        const cacheKey = 'social:trending:casts:24h';
        const FULL_LIST_LIMIT = 1500; // Increased from 500 to support more casts

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

        // 2. Cache Miss: Fetch FULL list (up to 500) from DB to repopulate cache
        // We always query for 'trending' (24h) logic if timeRange is trending, to fill cache correctly
        const Jan1_2021 = new Date(1609459200000);
        let where: any = { timestamp: { gt: Jan1_2021 } };

        // Determine params for DB query
        let queryLimit = limit;
        if (timeRange === 'trending') {
            queryLimit = FULL_LIST_LIMIT; // Fetch full list for cache
            const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));
            where = {
                OR: [
                    { timestamp: { gte: cutoff } },
                    { likes: { gt: 5 } }
                ],
                timestamp: { gt: Jan1_2021, lte: new Date() } // Ensure no future dates
            };
        } else {
            // Use specific time range logic (no caching for non-trending usually, or different keys)
            let days = 1;
            if (timeRange === '7d') days = 7;
            if (timeRange === '30d') days = 30;
            const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
            where = { timestamp: { gte: cutoff } };
        }

        const rows = await prisma.trendingCast.findMany({
            where,
            // Order by heatScore (trending velocity) and likes for SMART TRENDING
            orderBy: [{ heatScore: 'desc' }, { likes: 'desc' }, { timestamp: 'desc' }],
            take: queryLimit,
            // No offset/skip here! We fetch from 0 to FULL_LIMIT or limit
        });

        const casts: TrendingCast[] = rows.map((row, index) => ({
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
            heatScore: Number(row.heatScore),
            isBaseAppCoin: row.isBaseAppCoin,
            baseAppCoinMetadata: row.baseAppCoinMetadata as any,
            coinValue: row.coinValue ? String(row.coinValue) : undefined,
        }));

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
        try {
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

            if (!missingVector) throw rawError;

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
 * Hybrid search: Local DB first, Neynar API as supplement
 * Combines results from both sources, deduplicates by hash
 * [Logic]: DB-first for speed, Neynar supplement for coverage
 * [Ref]: searchCastsNeynar sort_type: algorithmic | desc_chron
 * [Risk]: Neynar 402 if API key is free tier
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 20)
 * @param useNeynar - Whether to use Neynar API as supplement (default: true)
 * @param sortBy - Sort order: 'algorithmic' (engagement) or 'recent' (desc_chron)
 * @returns Combined array of casts from both sources
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
        console.log(`[SocialRepo] Hybrid search for: "${trimmedQuery}" (limit: ${limit}, neynar: ${useNeynar}, sort: ${sortBy})`);

        // 1. Search local database first (fast, free)
        const localResults = await searchCasts(trimmedQuery, limit);
        console.log(`[SocialRepo] Local search found: ${localResults.length} casts`);

        // 2. If we have enough local results or Neynar is disabled, return local only
        if (localResults.length >= limit || !useNeynar) {
            return localResults.slice(0, limit);
        }

        // 3. Supplement with Neynar API (for full-network coverage)
        try {
            const { searchCastsNeynar } = await import('../services/neynarService.js');
            const remainingNeeded = limit - localResults.length;
            const neynarResults = await searchCastsNeynar(trimmedQuery, remainingNeeded, 'literal', sortBy);

            console.log(`[SocialRepo] Neynar search found: ${neynarResults.length} casts`);

            // 4. Deduplicate by hash (local results take priority)
            const localHashes = new Set(localResults.map(c => c.hash));
            const uniqueNeynarResults = neynarResults.filter((c: any) => !localHashes.has(c.hash));

            // 5. Combine and limit results
            const combined = [...localResults, ...uniqueNeynarResults as TrendingCast[]];
            console.log(`[SocialRepo] Hybrid search total: ${combined.length} casts (${localResults.length} local + ${uniqueNeynarResults.length} neynar)`);

            return combined.slice(0, limit);
        } catch (neynarError: any) {
            console.warn(`[SocialRepo] Neynar fallback failed: ${neynarError.message}, returning local results only`);
            return localResults;
        }

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

        // 2. Cache miss or expired, fetch from Neynar
        const { getUserByUsername } = await import('../services/neynarService.js');
        const profile = await getUserByUsername(username);

        if (profile) {
            // 3. Save to Cache table (expires in 24 hours)
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await prisma.cache.upsert({
                where: { key: cacheKey },
                update: {
                    value: JSON.stringify(profile),
                    expiresAt,
                    updatedAt: new Date()
                },
                create: {
                    key: cacheKey,
                    value: JSON.stringify(profile),
                    expiresAt,
                    updatedAt: new Date()
                }
            });
            return profile;
        }

        // If fetch failed but we have stale cache, return it as fallback
        if (cached && cached.value) {
            return JSON.parse(cached.value);
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
        const { checkIsFollowing } = await import('../services/neynarService.js');

        // 1. Get Kiko's FID (cached via getFarcasterProfile)
        const kikoProfile = await getFarcasterProfile('kikoapp');
        if (!kikoProfile) return false;

        const kikoFid = kikoProfile.fid;

        // 2. Check if user follows Kiko
        const isFollowing = await checkIsFollowing(fid, kikoFid);
        logger.info(LogCode.SOC_FOLLOW_DETECTED, 'SocialRepo: Checked follow status', { fid, isFollowing });
        return isFollowing;
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
    timeRange: 'trending' | '24h' | '7d' | '30d' = 'trending',
    cursor?: string,
    sortBy: 'trending' | 'newest' = 'trending'
): Promise<CursorPaginationResult> {
    try {
        const Jan1_2021 = new Date(1609459200000);
        let baseWhere: any = { timestamp: { gt: Jan1_2021 } };

        // Time range filter
        if (timeRange === 'trending') {
            const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));
            baseWhere = {
                OR: [
                    { timestamp: { gte: cutoff } },
                    { likes: { gt: 5 } }
                ],
                timestamp: { gt: Jan1_2021, lte: new Date() }
            };
        } else {
            let days = 1;
            if (timeRange === '7d') days = 7;
            if (timeRange === '30d') days = 30;
            const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
            baseWhere = { timestamp: { gte: cutoff } };
        }

        let where = baseWhere;

        // Cursor-based filtering: get items AFTER the cursor position
        if (cursor) {
            const cursorData = decodeCursor(cursor);
            if (cursorData) {
                if (sortBy === 'newest') {
                    // For newest sort: filter by timestamp only
                    where = {
                        AND: [
                            baseWhere,
                            {
                                OR: [
                                    { timestamp: { lt: new Date(cursorData.timestamp) } },
                                    {
                                        AND: [
                                            { timestamp: new Date(cursorData.timestamp) },
                                            { hash: { lt: cursorData.hash } }
                                        ]
                                    }
                                ]
                            }
                        ]
                    };
                } else {
                    // For trending sort: filter by heatScore first
                    where = {
                        AND: [
                            baseWhere,
                            {
                                OR: [
                                    { heatScore: { lt: cursorData.heatScore } },
                                    {
                                        AND: [
                                            { heatScore: cursorData.heatScore },
                                            { timestamp: { lt: new Date(cursorData.timestamp) } }
                                        ]
                                    },
                                    {
                                        AND: [
                                            { heatScore: cursorData.heatScore },
                                            { timestamp: new Date(cursorData.timestamp) },
                                            { hash: { lt: cursorData.hash } }
                                        ]
                                    }
                                ]
                            }
                        ]
                    };
                }
            }
        }

        // Fetch one extra to determine hasMore
        // Sort by timestamp for newest, by heatScore for trending
        const orderBy = sortBy === 'newest'
            ? [{ timestamp: 'desc' as const }, { hash: 'desc' as const }]
            : [{ heatScore: 'desc' as const }, { timestamp: 'desc' as const }, { hash: 'desc' as const }];

        const rows = await prisma.trendingCast.findMany({
            where,
            orderBy,
            take: limit + 1,
        });

        const hasMore = rows.length > limit;
        const resultRows = hasMore ? rows.slice(0, limit) : rows;

        const casts: TrendingCast[] = resultRows.map((row, index) => ({
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
            heatScore: Number(row.heatScore),
            isBaseAppCoin: row.isBaseAppCoin,
            baseAppCoinMetadata: row.baseAppCoinMetadata as any,
            coinValue: row.coinValue ? String(row.coinValue) : undefined,
        }));

        // [OPTIMIZED]: Embed 数据已在 socialDataJob 后台任务中预处理并保存到数据库
        // 不再进行实时 API 调用获取 embed 内容，直接使用缓存数据

        // Generate next cursor from last item
        let nextCursor: string | null = null;
        if (hasMore && resultRows.length > 0) {
            const lastRow = resultRows[resultRows.length - 1];
            nextCursor = encodeCursor(Number(lastRow.heatScore), lastRow.timestamp, lastRow.hash);
        }

        return { casts, nextCursor, hasMore };

    } catch (error: any) {
        logger.error(LogCode.SOC_CAST_FETCHED, 'SocialRepo: Error in cursor pagination', { error: error.message });
        return { casts: [], nextCursor: null, hasMore: false };
    }
}
