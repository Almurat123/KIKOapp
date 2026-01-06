/**
 * Social Data Repository
 * Handles storage and retrieval of Farcaster trending casts
 */

import { pool } from '../db/connection.js';
import { get, set, del } from '../cache/redis.js';
import { TrendingCast } from '../types/social.js';

/**
 * Get the last update time for trending casts
 */
export async function getLastUpdateTime(): Promise<Date | null> {
    try {
        const result = await pool.query(
            `SELECT MAX(updated_at) as last_update FROM trending_casts`
        );
        return result.rows[0]?.last_update || null;
    } catch (error) {
        console.error('[SocialRepo] Error getting last update time:', error);
        return null;
    }
}

/**
 * Save trending casts to database and cache
 */
export async function saveTrendingCasts(casts: TrendingCast[]): Promise<void> {
    if (casts.length === 0) {
        console.warn('[SocialRepo] Attempted to save empty casts array, skipping to preserve existing data');
        return;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // MERGE STRATEGY: Do NOT delete all existing data.
        // Instead, just insert/update the new batch.
        // Cleanup of old data happens at the end.

        // Insert new casts with rank
        // Sort by likes before saving to ensure correct order
        const sortedCasts = [...casts].sort((a, b) => {
            const likesA = typeof a.stats.likes === 'number' ? a.stats.likes : parseInt(String(a.stats.likes)) || 0;
            const likesB = typeof b.stats.likes === 'number' ? b.stats.likes : parseInt(String(b.stats.likes)) || 0;
            return likesB - likesA; // Descending order
        });

        for (let i = 0; i < sortedCasts.length; i++) {
            const cast = sortedCasts[i];

            // Ensure stats are numbers before saving
            const likes = typeof cast.stats.likes === 'number' ? cast.stats.likes : parseInt(String(cast.stats.likes)) || 0;
            const recasts = typeof cast.stats.recasts === 'number' ? cast.stats.recasts : parseInt(String(cast.stats.recasts)) || 0;
            const replies = typeof cast.stats.replies === 'number' ? cast.stats.replies : parseInt(String(cast.stats.replies)) || 0;

            // Limit heatScore to fit NUMERIC(5, 2) - max 999.99
            // For Snapchain data, heatScore might be likes+recasts (could be 2000+)
            // We'll cap it at 999.99 and log a warning
            let heatScore = typeof cast.heatScore === 'number' ? cast.heatScore : parseFloat(String(cast.heatScore)) || 0;
            if (heatScore > 999.99) {
                // console.warn(`[SocialRepo] HeatScore ${heatScore} exceeds max (999.99), capping to 999.99 for cast ${cast.hash.substring(0, 20)}`);
                heatScore = 999.99;
            }

            const baseAppMetadata = cast.baseAppCoinMetadata ? JSON.stringify(cast.baseAppCoinMetadata) : null;

            await client.query(
                `INSERT INTO trending_casts (
          cast_hash, fid, author_username, author_display_name, author_avatar, author_verified,
          text, timestamp, embeds, parent_cast_fid, parent_cast_hash,
          stats_likes, stats_recasts, stats_replies, heat_score, rank,
          is_base_app_coin, base_app_coin_metadata, coin_value, author_bio, mentions, author_creator_coin, author_twitter, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
        ON CONFLICT (cast_hash) 
        DO UPDATE SET 
          fid = EXCLUDED.fid,
          author_username = EXCLUDED.author_username,
          author_display_name = EXCLUDED.author_display_name,
          author_avatar = EXCLUDED.author_avatar,
          author_verified = EXCLUDED.author_verified,
          text = EXCLUDED.text,
          timestamp = EXCLUDED.timestamp,
          embeds = EXCLUDED.embeds,
          parent_cast_fid = EXCLUDED.parent_cast_fid,
          parent_cast_hash = EXCLUDED.parent_cast_hash,
          stats_likes = EXCLUDED.stats_likes,
          stats_recasts = EXCLUDED.stats_recasts,
          stats_replies = EXCLUDED.stats_replies,
          heat_score = EXCLUDED.heat_score,
          rank = EXCLUDED.rank,
          is_base_app_coin = EXCLUDED.is_base_app_coin,
          base_app_coin_metadata = EXCLUDED.base_app_coin_metadata,
          coin_value = EXCLUDED.coin_value,
          author_bio = EXCLUDED.author_bio,
          mentions = EXCLUDED.mentions,
          author_creator_coin = EXCLUDED.author_creator_coin,
          author_twitter = EXCLUDED.author_twitter,
          updated_at = NOW()`,
                [
                    cast.hash,
                    cast.fid,
                    cast.author.username,
                    cast.author.displayName,
                    cast.author.avatar,
                    cast.author.verified || false,
                    cast.text,
                    cast.timestamp,
                    cast.embeds ? JSON.stringify(cast.embeds) : null,
                    cast.parentCastId?.fid || null,
                    cast.parentCastId?.hash || null,
                    likes,  // Use converted number
                    recasts, // Use converted number
                    replies, // Use converted number
                    heatScore, // Capped to 999.99
                    i + 1, // rank (1-based)
                    cast.isBaseAppCoin || false,
                    baseAppMetadata,
                    cast.coinValue || null,
                    cast.author.bio || null,
                    JSON.stringify(cast.mentions || []),
                    cast.author.creatorCoin ? JSON.stringify(cast.author.creatorCoin) : null,
                    cast.author.twitter || null
                ]
            );
        }

        // CLEANUP: Delete posts older than 24 hours (unless high quality) OR invalid timestamps
        // This ensures we keep a rolling 24h window of "normal" data, but keep "hits" for longer
        const retentionValues = [Date.now() - (24 * 60 * 60 * 1000), 1609459200000];
        const deleteResult = await client.query(
            'DELETE FROM trending_casts WHERE ((timestamp < $1 AND stats_likes <= 15) OR timestamp < $2) AND is_base_app_coin = false',
            retentionValues
        );
        if ((deleteResult.rowCount ?? 0) > 0) {
            console.log(`[SocialRepo] Pruned ${deleteResult.rowCount} old/low-quality casts`);
        }

        await client.query('COMMIT');

        // Save sorted casts to Redis cache (3 minutes TTL for trending data)
        // Note: This cache might only contain the *new* batch if we only query sortedCasts.
        // Ideally, we should re-query the DB to get the full top list from the last 24h 
        // to keep the cache consistent with the merged DB state.

        // Re-query the top 500 from DB to update cache with the FULL merged list
        // This correction ensures `getTrendingCasts` (which often hits cache) sees the full merged picture immediately
        await del('social:trending:casts:24h'); // Force cache invalidation
        const fullMergedList = await getTrendingCasts(500);

        // getTrendingCasts updates the cache itself if there is a miss, but here we force update it
        // Actually, getTrendingCasts reads from cache first. We want to WRITE to cache.
        // The previous implementation wrote `sortedCasts` (just the new batch) to cache.
        // If we want the cache to reflect the merged state, we should write `fullMergedList` to cache.
        if (fullMergedList.length > 0) {
            await set('social:trending:casts:24h', JSON.stringify(fullMergedList), 180);
            console.log(`[SocialRepo] Updated cache with ${fullMergedList.length} merged casts`);
        } else {
            // Fallback if DB query fails for some reason (unlikely inside this transaction flow, but safe)
            await set('social:trending:casts', JSON.stringify(sortedCasts), 180);
        }

        console.log(`Saved ${sortedCasts.length} trending casts to database (sorted by likes)`);
        if (sortedCasts.length > 0) {
            console.log(`[SocialRepo] Sample saved cast stats:`, {
                hash: sortedCasts[0].hash.substring(0, 10),
                likes: sortedCasts[0].stats.likes,
                recasts: sortedCasts[0].stats.recasts,
                replies: sortedCasts[0].stats.replies,
            });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving trending casts:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get trending casts from cache or database
 * Only returns casts from the last 24 hours OR high quality (>30 likes) older casts
 * @param limit - Maximum number of casts to return
 */
export async function getTrendingCasts(
    limit: number = 50,
    timeRange: 'trending' | '24h' | '7d' | '30d' = 'trending'
): Promise<TrendingCast[]> {
    try {
        // Only use cache for default 'trending' view to ensure speed
        // For specific time ranges, query DB directly to ensure accuracy
        const cacheKey = 'social:trending:casts:24h';

        if (timeRange === 'trending') {
            // Try cache first (3 minutes TTL)
            const cached = await get(cacheKey);
            if (cached) {
                // ... (existing cache logic)
                console.log('[SocialRepo] Found cached trending casts (24h)');
                const casts = JSON.parse(cached) as TrendingCast[];
                // ... (existing processing map)
                const processedCasts = casts.map(cast => ({
                    ...cast,
                    stats: {
                        likes: typeof cast.stats?.likes === 'number' ? cast.stats.likes : parseInt(String(cast.stats?.likes || 0)) || 0,
                        recasts: typeof cast.stats?.recasts === 'number' ? cast.stats.recasts : parseInt(String(cast.stats?.recasts || 0)) || 0,
                        replies: typeof cast.stats?.replies === 'number' ? cast.stats.replies : parseInt(String(cast.stats?.replies || 0)) || 0,
                    },
                }));

                // Sort by likes DESC
                const sortedCasts = processedCasts.sort((a, b) => {
                    const likesA = a.stats?.likes || 0;
                    const likesB = b.stats?.likes || 0;
                    return likesB - likesA;
                });
                const result = sortedCasts.slice(0, limit);
                console.log(`[SocialRepo] Returning ${result.length} casts from cache (trending)`);
                return result;
            }
        }

        console.log(`[SocialRepo] Querying database for range: ${timeRange}...`);

        let timeFilterClause = '';
        let timeParams: any[] = [];
        const now = Date.now();

        const Jan1_2021 = 1609459200000; // Farcaster didn't exist before this

        if (timeRange === 'trending') {
            // Default smart view: Last 24h OR High Quality (>15 likes)
            // AND must be valid date (> 2021)
            const cutoff = now - (24 * 60 * 60 * 1000);
            timeFilterClause = 'WHERE (timestamp >= $1 OR stats_likes > 15) AND timestamp > $2';
            timeParams = [cutoff, Jan1_2021];
        } else {
            // Strict time windows
            let days = 1;
            if (timeRange === '7d') days = 7;
            if (timeRange === '30d') days = 30;

            const cutoff = now - (days * 24 * 60 * 60 * 1000);
            timeFilterClause = 'WHERE timestamp >= $1 AND timestamp > $2';
            timeParams = [cutoff, Jan1_2021];
        }

        // Build query
        const query = `SELECT 
        cast_hash as hash,
        fid,
        json_build_object(
          'fid', fid,
          'username', author_username,
          'displayName', author_display_name,
          'avatar', author_avatar,
          'username', author_username,
          'displayName', author_display_name,
          'avatar', author_avatar,
          'verified', author_verified,
          'verified', author_verified,
          'verified', author_verified,
          'bio', author_bio,
          'twitter', author_twitter,
          'creatorCoin', author_creator_coin
        ) as author,
        text,
        timestamp,
        embeds,
        CASE 
          WHEN parent_cast_fid IS NOT NULL THEN
            json_build_object(
              'fid', parent_cast_fid,
              'hash', parent_cast_hash
            )
          ELSE NULL
        END as parent_cast_id,
        json_build_object(
          'likes', stats_likes,
          'recasts', stats_recasts,
          'replies', stats_replies
        ) as stats,
        heat_score as heat_score,
        is_base_app_coin,
        base_app_coin_metadata,
        coin_value,
        coin_value,
        mentions,
        author_creator_coin
      FROM trending_casts
      ${timeFilterClause}
      ORDER BY stats_likes DESC, heat_score DESC, updated_at DESC 
      LIMIT $${timeParams.length + 1}`;

        const result = await pool.query(query, [...timeParams, limit]);

        const casts: TrendingCast[] = result.rows.map((row, index) => {
            // Ensure stats are numbers, not strings
            const likes = typeof row.stats.likes === 'number' ? row.stats.likes : parseInt(String(row.stats.likes)) || 0;
            const recasts = typeof row.stats.recasts === 'number' ? row.stats.recasts : parseInt(String(row.stats.recasts)) || 0;
            const replies = typeof row.stats.replies === 'number' ? row.stats.replies : parseInt(String(row.stats.replies)) || 0;

            return {
                rank: index + 1,
                hash: row.hash,
                fid: row.fid,
                author: {
                    fid: row.author.fid,
                    username: row.author.username,
                    displayName: row.author.displayName,
                    avatar: row.author.avatar,
                    verified: row.author.verified || false,
                    bio: row.author.bio,
                    creatorCoin: row.author_creator_coin ? (typeof row.author_creator_coin === 'string' ? JSON.parse(row.author_creator_coin) : row.author_creator_coin) : undefined,
                },
                text: row.text,
                timestamp: new Date(parseInt(row.timestamp)),
                embeds: row.embeds ? (typeof row.embeds === 'string' ? JSON.parse(row.embeds) : row.embeds) : undefined,
                mentions: row.mentions ? (typeof row.mentions === 'string' ? JSON.parse(row.mentions) : row.mentions) : undefined,
                parentCastId: row.parent_cast_id,
                stats: {
                    likes: likes,
                    recasts: recasts,
                    replies: replies,
                },
                heatScore: parseFloat(String(row.heat_score)) || 0,
                isBaseAppCoin: row.is_base_app_coin,
                baseAppCoinMetadata: row.base_app_coin_metadata,
                coinValue: row.coin_value,
            };
        });

        console.log(`[SocialRepo] Retrieved ${casts.length} casts from database (24h)`);
        if (casts.length > 0) {
            console.log(`[SocialRepo] Sample cast stats (from DB):`, {
                hash: casts[0].hash.substring(0, 10),
                likes: casts[0].stats.likes,
                recasts: casts[0].stats.recasts,
                replies: casts[0].stats.replies,
                likesType: typeof casts[0].stats.likes,
            });
        }

        // Cache the filtered results (3 minutes TTL)
        if (casts.length > 0) {
            await set(cacheKey, JSON.stringify(casts), 180);
        }


        return casts;
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
            console.log('[SocialRepo] Empty search query, returning empty results');
            return [];
        }

        const trimmedQuery = query.trim();
        console.log(`[SocialRepo] Searching casts for: "${trimmedQuery}" (limit: ${limit})`);

        // Use PostgreSQL full-text search with fallback to ILIKE for simple queries
        // This handles both indexed full-text search and simple substring matching
        const result = await pool.query(`
      SELECT 
        cast_hash as hash,
        fid,
        json_build_object(
          'fid', fid,
          'username', author_username,
          'displayName', author_display_name,
          'avatar', author_avatar,
          'verified', author_verified,
          'bio', author_bio,
          'twitter', author_twitter,
          'creatorCoin', author_creator_coin
        ) as author,
        text,
        timestamp,
        embeds,
        CASE 
          WHEN parent_cast_fid IS NOT NULL THEN
            json_build_object(
              'fid', parent_cast_fid,
              'hash', parent_cast_hash
            )
          ELSE NULL
        END as parent_cast_id,
        json_build_object(
          'likes', stats_likes,
          'recasts', stats_recasts,
          'replies', stats_replies
        ) as stats,
        heat_score,
        is_base_app_coin,
        base_app_coin_metadata,
        coin_value,
        mentions,
        author_creator_coin,
        CASE 
          WHEN search_vector IS NOT NULL 
          THEN ts_rank(search_vector, plainto_tsquery('english', $1))
          ELSE 0
        END as relevance_score
      FROM trending_casts
      WHERE 
        (search_vector @@ plainto_tsquery('english', $1))
        OR (text ILIKE '%' || $1 || '%')
        OR (author_username ILIKE '%' || $1 || '%')
      ORDER BY 
        relevance_score DESC,
        stats_likes DESC,
        updated_at DESC
      LIMIT $2
    `, [trimmedQuery, limit]);

        const casts: TrendingCast[] = result.rows.map((row, index) => {
            const likes = typeof row.stats.likes === 'number' ? row.stats.likes : parseInt(String(row.stats.likes)) || 0;
            const recasts = typeof row.stats.recasts === 'number' ? row.stats.recasts : parseInt(String(row.stats.recasts)) || 0;
            const replies = typeof row.stats.replies === 'number' ? row.stats.replies : parseInt(String(row.stats.replies)) || 0;

            return {
                rank: index + 1,
                hash: row.hash,
                fid: row.fid,
                author: {
                    fid: row.author.fid,
                    username: row.author.username,
                    displayName: row.author.displayName,
                    avatar: row.author.avatar,
                    verified: row.author.verified || false,
                    bio: row.author.bio,
                    creatorCoin: row.author_creator_coin ? (typeof row.author_creator_coin === 'string' ? JSON.parse(row.author_creator_coin) : row.author_creator_coin) : undefined,
                },
                text: row.text,
                timestamp: new Date(parseInt(row.timestamp)),
                embeds: row.embeds ? (typeof row.embeds === 'string' ? JSON.parse(row.embeds) : row.embeds) : undefined,
                mentions: row.mentions ? (typeof row.mentions === 'string' ? JSON.parse(row.mentions) : row.mentions) : undefined,
                parentCastId: row.parent_cast_id,
                stats: {
                    likes: likes,
                    recasts: recasts,
                    replies: replies,
                },
                heatScore: parseFloat(String(row.heat_score)) || 0,
                isBaseAppCoin: row.is_base_app_coin,
                baseAppCoinMetadata: row.base_app_coin_metadata,
                coinValue: row.coin_value,
            };
        });

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
