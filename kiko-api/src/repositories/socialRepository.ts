import prisma, { withRetry } from '../db/prisma.js';
import { get, set, del } from '../cache/redis.js';
import { TrendingCast } from '../types/social.js';
import { Decimal } from 'decimal.js';

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
    } catch (error) {
        console.error('[SocialRepo] Error getting last update time:', error);
        return null;
    }
}

export async function saveTrendingCasts(casts: TrendingCast[]): Promise<void> {
    if (casts.length === 0) {
        console.warn('[SocialRepo] Attempted to save empty casts array, skipping to preserve existing data');
        return;
    }

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
            }, {
                timeout: 60000, // 60 seconds (default is 5s)
                maxWait: 5000
            });
        });

        await del('social:trending:casts:24h');
        const fullMergedList = await getTrendingCasts(500);

        if (fullMergedList.length > 0) {
            await set('social:trending:casts:24h', JSON.stringify(fullMergedList), 180);
            console.log(`[SocialRepo] Updated cache with ${fullMergedList.length} merged casts`);
        } else {
            await set('social:trending:casts', JSON.stringify(sortedCasts), 180);
        }

        console.log(`Saved ${sortedCasts.length} trending casts to database`);
    } catch (error) {
        console.error('Error saving trending casts:', error);
        throw error;
    }
}

export async function getTrendingCasts(
    limit: number = 50,
    timeRange: 'trending' | '24h' | '7d' | '30d' = 'trending',
    offset: number = 0
): Promise<TrendingCast[]> {
    try {
        const cacheKey = 'social:trending:casts:24h';
        const FULL_LIST_LIMIT = 500;

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
            orderBy: [{ likes: 'desc' }, { heatScore: 'desc' }, { updatedAt: 'desc' }],
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

        // 4. Return Requested Slice
        return casts.slice(offset, offset + limit);

    } catch (error) {
        console.error('[SocialRepo] Error getting trending casts:', error);
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
        console.log(`[SocialRepo] Searching casts for: "${trimmedQuery}" (limit: ${limit})`);

        // Use PostgreSQL full-text search via Prisma raw query
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

        const casts: TrendingCast[] = result.map((row, index) => ({
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

        console.log(`[SocialRepo] Search found ${casts.length} casts for "${trimmedQuery}"`);
        return casts;
    } catch (error) {
        console.error('[SocialRepo] Error searching casts:', error);
        return [];
    }
}

/**
 * Hybrid search: Local DB first, Neynar API as supplement
 * Combines results from both sources, deduplicates by hash
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 20)
 * @param useNeynar - Whether to use Neynar API as supplement (default: true)
 * @returns Combined array of casts from both sources
 */
export async function hybridSearchCasts(
    query: string,
    limit: number = 20,
    useNeynar: boolean = true
): Promise<TrendingCast[]> {
    try {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const trimmedQuery = query.trim();
        console.log(`[SocialRepo] Hybrid search for: "${trimmedQuery}" (limit: ${limit}, neynar: ${useNeynar})`);

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
            const neynarResults = await searchCastsNeynar(trimmedQuery, remainingNeeded, 'literal');

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
    } catch (error) {
        console.error(`[SocialRepo] Error getting Farcaster profile for ${username}:`, error);
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
        return await checkIsFollowing(fid, kikoFid);
    } catch (error) {
        console.error(`[SocialRepo] Error checking if FID ${fid} follows Kiko:`, error);
        return false;
    }
}
