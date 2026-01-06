/**
 * Neynar Service
 * Provides access to Neynar's Farcaster API for full-network search
 * Used as a supplement to local database search
 */

const NEYNAR_API_BASE = 'https://api.neynar.com/v2';

interface NeynarCast {
    hash: string;
    author: {
        fid: number;
        username: string;
        display_name: string;
        pfp_url?: string;
    };
    text: string;
    timestamp: string;
    reactions: {
        likes_count: number;
        recasts_count: number;
    };
    replies: {
        count: number;
    };
}

interface NeynarSearchResponse {
    result: {
        casts: NeynarCast[];
        next?: {
            cursor: string;
        };
    };
}

/**
 * Search Farcaster casts using Neynar API
 * Supports literal, semantic, and hybrid search modes
 */
export async function searchCastsNeynar(
    query: string,
    limit: number = 15,
    mode: 'literal' | 'semantic' | 'hybrid' = 'literal'
): Promise<any[]> {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
        console.warn('[Neynar] API key not configured, skipping Neynar search');
        return [];
    }

    try {
        console.log(`[Neynar] Searching for: "${query}" (mode: ${mode}, limit: ${limit})`);

        const url = new URL(`${NEYNAR_API_BASE}/farcaster/cast/search`);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', String(Math.min(limit, 100)));
        url.searchParams.set('mode', mode);
        url.searchParams.set('sort_type', 'algorithmic'); // Sort by engagement

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Neynar] Search failed: ${response.status} - ${errorText}`);
            return [];
        }

        const data = await response.json() as NeynarSearchResponse;
        const casts = data.result?.casts || [];

        console.log(`[Neynar] Found ${casts.length} casts for "${query}"`);

        // Transform to our standard format
        return casts.map(cast => ({
            hash: cast.hash,
            fid: cast.author.fid,
            author: {
                fid: cast.author.fid,
                username: cast.author.username,
                displayName: cast.author.display_name,
                avatar: cast.author.pfp_url,
                verified: false
            },
            text: cast.text,
            timestamp: new Date(cast.timestamp).getTime(),
            stats: {
                likes: cast.reactions?.likes_count || 0,
                recasts: cast.reactions?.recasts_count || 0,
                replies: cast.replies?.count || 0
            },
            source: 'neynar' // Mark source for debugging
        }));

    } catch (error: any) {
        console.error('[Neynar] Search error:', error.message);
        return [];
    }
}

/**
 * Fetch trending casts from Neynar Feed
 */
export async function getTrendingFeed(limit: number = 25): Promise<any[]> {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
        console.warn('[Neynar] API key not configured, skipping trending feed');
        return [];
    }

    try {
        console.log(`[Neynar] Fetching trending feed (limit: ${limit})`);

        const url = new URL(`${NEYNAR_API_BASE}/farcaster/feed/trending`);
        url.searchParams.set('limit', String(Math.min(limit, 100)));
        url.searchParams.set('time_window', '24h');
        url.searchParams.set('provider', 'neynar'); // or 'farcaster_network'

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Neynar] Feed fetch failed: ${response.status} - ${errorText}`);
            return [];
        }

        const data = await response.json() as { casts: NeynarCast[] };
        const casts = data.casts || [];

        console.log(`[Neynar] Found ${casts.length} trending casts`);

        // Transform to our standard format
        return casts.map(cast => ({
            hash: cast.hash,
            fid: cast.author.fid,
            author: {
                fid: cast.author.fid,
                username: cast.author.username,
                displayName: cast.author.display_name,
                avatar: cast.author.pfp_url,
                verified: false, // Neynar doesn't give this directly in simple feed? check docs
                bio: (cast.author as any).profile?.bio?.text // Neynar structure might vary
            },
            text: cast.text,
            timestamp: new Date(cast.timestamp).getTime(),
            stats: {
                likes: cast.reactions?.likes_count || 0,
                recasts: cast.reactions?.recasts_count || 0,
                replies: cast.replies?.count || 0
            },
            embeds: (cast as any).embeds, // Pass through embeds
            mentions: (cast as any).mentioned_profiles?.map((p: any) => p.fid) || [],
            source: 'neynar',
            heatScore: (cast.reactions?.likes_count || 0) + (cast.reactions?.recasts_count || 0)
        }));

    } catch (error: any) {
        console.error('[Neynar] Feed error:', error.message);
        return [];
    }
}

/**
 * Check if Neynar API is configured and working
 */
export async function isNeynarConfigured(): Promise<boolean> {
    return !!process.env.NEYNAR_API_KEY;
}

export default {
    searchCastsNeynar,
    getTrendingFeed,
    isNeynarConfigured
};
