import { Tool } from './registry.js';
import { getTrendingCasts, searchCasts, hybridSearchCasts } from '../repositories/socialRepository.js';
import { getUserDataByFid, getCastsByFid, farcasterToUnixTimestamp } from '../services/snapchainService.js';
// Removed axios dependency to use native fetch

// SNAPCHAIN_HUB_URL will be fetched inside handlers to ensure env vars are loaded

export const GetTrendingCastsTool: Tool = {
    definition: {
        name: 'get_trending_casts',
        description: 'Get top 30 trending Farcaster casts from the last 24 hours. Use this when user asks about trending posts, popular casts, or what\'s hot on Farcaster.',
        parameters: {
            type: 'object',
            properties: {
                limit: {
                    type: 'integer',
                    description: 'Number of casts to return (1-30). Default is 30.'
                }
            },
            required: []
        }
    },
    handler: async ({ limit = 30 }) => {
        // Cap limit at 30 to save tokens
        const cappedLimit = Math.min(limit, 30);

        const casts = await getTrendingCasts(cappedLimit);

        // Simplify data to save tokens
        const simplifiedCasts = casts.map(cast => ({
            hash: cast.hash.substring(0, 16), // Shorten hash
            author: {
                username: cast.author.username,
                displayName: cast.author.displayName,
                fid: cast.author.fid
            },
            text: cast.text,
            stats: {
                likes: typeof cast.stats.likes === 'number' ? cast.stats.likes : parseInt(String(cast.stats.likes)) || 0,
                recasts: typeof cast.stats.recasts === 'number' ? cast.stats.recasts : parseInt(String(cast.stats.recasts)) || 0,
                replies: typeof cast.stats.replies === 'number' ? cast.stats.replies : parseInt(String(cast.stats.replies)) || 0
            },
            heatScore: typeof cast.heatScore === 'number' ? parseFloat(cast.heatScore.toFixed(2)) : parseFloat(String(cast.heatScore)) || 0
        }));

        return {
            count: simplifiedCasts.length,
            casts: simplifiedCasts
        };
    }
};


/**
 * Get Farcaster user profile and recent casts
 */
export async function getFarcasterUser(fid: number, includeCasts: boolean = true) {
    if (!fid) {
        throw new Error('FID is required');
    }

    try {
        // Fetch user data using shared service
        // 1. Get User Profile
        const userData = await getUserDataByFid(fid);

        if (!userData) {
            throw new Error(`User with FID ${fid} not found`);
        }

        // Map consistent with API response
        const userProfile = {
            fid: userData.fid,
            username: userData.username || 'Unknown',
            displayName: userData.displayName || 'Unknown',
            pfp: userData.pfp || '',
            bio: userData.bio || ''
        };

        const result: any = {
            user: userProfile,
            casts: []
        };

        // 2. Get Recent Casts if requested
        if (includeCasts) {
            const recentCasts = await getCastsByFid(fid, 10);

            result.casts = recentCasts.map((cast: any) => ({
                hash: cast.hash.substring(0, 16),
                text: cast.text,
                timestamp: farcasterToUnixTimestamp(cast.timestamp),
                mentions: cast.mentions,
                parent: cast.parentCastId ? {
                    fid: cast.parentCastId.fid,
                    hash: cast.parentCastId.hash?.substring(0, 10)
                } : undefined
            }));

            result.totalCasts = result.casts.length;
        }

        return result;
    } catch (error: any) {
        console.error('[GetFarcasterUserTool] Error:', error.message);
        throw new Error(`Failed to fetch Farcaster user data: ${error.message}`);
    }
}

export const GetFarcasterUserTool: Tool = {
    definition: {
        name: 'get_farcaster_user',
        description: 'Get Farcaster user profile and recent casts by FID (Farcaster ID). Use this when user asks about a specific Farcaster user or their posts.',
        parameters: {
            type: 'object',
            properties: {
                fid: {
                    type: 'integer',
                    description: 'Farcaster user ID (FID)'
                },
                include_casts: {
                    type: 'boolean',
                    description: 'Whether to include recent casts. Default is true.'
                }
            },
            required: ['fid']
        }
    },
    handler: async ({ fid, include_casts = true }) => {
        return await getFarcasterUser(fid, include_casts);
    }
};


/**
 * Search Farcaster casts by keyword
 * Uses PostgreSQL full-text search on locally cached trending casts
 */
export const SearchFarcasterCastsTool: Tool = {
    definition: {
        name: 'search_farcaster_casts',
        description: 'Search Farcaster casts by keyword. Use this when user asks to find, search, or look for specific posts/casts on Farcaster. Searches in cast text and author names.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query - keywords to search for in Farcaster casts'
                },
                limit: {
                    type: 'integer',
                    description: 'Number of results to return (1-30). Default is 15.'
                }
            },
            required: ['query']
        }
    },
    handler: async ({ query, limit = 15 }) => {
        if (!query || query.trim().length === 0) {
            return {
                success: false,
                error: 'Search query is required',
                casts: []
            };
        }

        // Cap limit at 30 to save tokens
        const cappedLimit = Math.min(limit, 30);

        try {
            // Use hybrid search (local DB + Neynar API)
            const casts = await hybridSearchCasts(query, cappedLimit, true);

            // Simplify data to save tokens
            const simplifiedCasts = casts.map(cast => ({
                hash: cast.hash.substring(0, 16),
                author: {
                    username: cast.author.username,
                    displayName: cast.author.displayName,
                    fid: cast.author.fid
                },
                text: cast.text,
                stats: {
                    likes: typeof cast.stats.likes === 'number' ? cast.stats.likes : parseInt(String(cast.stats.likes)) || 0,
                    recasts: typeof cast.stats.recasts === 'number' ? cast.stats.recasts : parseInt(String(cast.stats.recasts)) || 0,
                    replies: typeof cast.stats.replies === 'number' ? cast.stats.replies : parseInt(String(cast.stats.replies)) || 0
                }
            }));

            return {
                success: true,
                query: query,
                count: simplifiedCasts.length,
                casts: simplifiedCasts,
                note: simplifiedCasts.length === 0
                    ? 'No casts found matching your search. Try different keywords.'
                    : `Found ${simplifiedCasts.length} cast(s) matching "${query}"`
            };
        } catch (error: any) {
            console.error('[SearchFarcasterCastsTool] Error:', error.message);
            return {
                success: false,
                error: `Search failed: ${error.message}`,
                casts: []
            };
        }
    }
};
