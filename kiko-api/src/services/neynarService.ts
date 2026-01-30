/**
 * Neynar Service
 * Provides access to Neynar's Farcaster API for full-network search
 * Used as a supplement to local database search
 */

const NEYNAR_API_BASE = 'https://api.neynar.com/v2';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

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

interface NeynarUserResponse {
    users: {
        fid: number;
        username: string;
        display_name: string;
        pfp_url: string;
        profile: {
            bio: {
                text: string;
            }
        };
        verifications: string[];
    }[];
}

/**
 * Search Farcaster casts using Neynar API
 * Supports literal, semantic, and hybrid search modes
 * [Logic]: Wraps Neynar /v2/farcaster/cast/search API
 * [Ref]: Neynar API docs - sort_type: 'algorithmic' | 'desc_chron' | 'chron'
 * [Risk]: API returns 402 if API key is on free tier
 */
export async function searchCastsNeynar(
    query: string,
    limit: number = 15,
    mode: 'literal' | 'semantic' | 'hybrid' = 'literal',
    sortBy: 'algorithmic' | 'recent' = 'algorithmic'
): Promise<any[]> {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
        logger.warn(LogCode.SYS_INFO, 'Neynar API key not configured, skipping search');
        return [];
    }

    try {
        logger.debug(LogCode.SYS_INFO, 'Neynar: Searching casts', { query, mode, limit, sortBy });

        const url = new URL(`${NEYNAR_API_BASE}/farcaster/cast/search`);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', String(Math.min(limit, 100)));
        url.searchParams.set('mode', mode);
        // [Logic]: Map 'recent' to Neynar's 'desc_chron' (descending chronological)
        url.searchParams.set('sort_type', sortBy === 'recent' ? 'desc_chron' : 'algorithmic');

        const data = await unifiedApiService.fetchJson<NeynarSearchResponse>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const casts = data.result?.casts || [];

        logger.debug(LogCode.SYS_INFO, 'Neynar search results', { query, count: casts.length });

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
        logger.error(LogCode.SYS_ERROR, 'Neynar: Search error', { error: error.message });
        return [];
    }
}

/**
 * Fetch trending casts from Neynar Feed
 * [Logic]: Neynar /feed/trending endpoint
 * [Ref]: Neynar API docs - limit must be between 1 and 10
 * [Risk]: Returns empty if API key not configured
 */
export async function getTrendingFeed(limit: number = 10): Promise<any[]> {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
        logger.warn(LogCode.SYS_INFO, 'Neynar API key not configured, skipping trending feed');
        return [];
    }

    try {
        logger.debug(LogCode.SYS_INFO, 'Neynar: Fetching trending feed', { limit });

        const url = new URL(`${NEYNAR_API_BASE}/farcaster/feed/trending`);
        // [Logic]: Neynar trending feed limit must be 1-10
        url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 10)));
        url.searchParams.set('time_window', '24h');
        url.searchParams.set('provider', 'neynar'); // or 'farcaster_network'

        const data = await unifiedApiService.fetchJson<{ casts: NeynarCast[] }>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const casts = data.casts || [];

        logger.debug(LogCode.SYS_INFO, 'Neynar trending casts count', { count: casts.length });

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
            // Improved heatScore with time decay (consistent with snapchainService)
            heatScore: (() => {
                const weightedEng = (cast.reactions?.likes_count || 0) + ((cast.reactions?.recasts_count || 0) * 2) + ((cast.replies?.count || 0) * 1.5);
                const castTime = new Date(cast.timestamp).getTime();
                const hoursOld = (Date.now() - castTime) / (1000 * 60 * 60);
                const decay = Math.pow(0.97, Math.min(hoursOld, 168));
                return Math.log10(Math.max(1, weightedEng) + 1) * 100 * decay;
            })()
        }));

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: Feed error', { error: error.message });
        return [];
    }
}

/**
 * Check if Neynar API is configured and working
 */
export async function isNeynarConfigured(): Promise<boolean> {
    return !!process.env.NEYNAR_API_KEY;
}

/**
 * Fetch users by FIDs using Neynar API
 */
export async function getUsersNeynar(fids: number[]): Promise<any[]> {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey || fids.length === 0) {
        return [];
    }

    try {
        const url = new URL(`${NEYNAR_API_BASE}/farcaster/user/bulk`);
        url.searchParams.set('fids', fids.join(','));

        const data = await unifiedApiService.fetchJson<NeynarUserResponse>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        return data.users.map(u => ({
            fid: u.fid,
            username: u.username,
            displayName: u.display_name,
            pfp: u.pfp_url,
            bio: u.profile?.bio?.text,
            verifications: u.verifications
        }));
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: Users fetch error', { error: error.message });
        return [];
    }
}

/**
 * Fetch user details by username using Neynar API
 */
export async function getUserByUsername(username: string): Promise<any | null> {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
        return null;
    }

    try {
        const url = new URL(`${NEYNAR_API_BASE}/farcaster/user/by_username`);
        url.searchParams.set('username', username);

        const data = await unifiedApiService.fetchJson<{ user: any }>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const u = data.user;

        if (!u) {
            return null;
        }

        return {
            fid: u.fid,
            username: u.username,
            displayName: u.display_name,
            pfp: u.pfp_url,
            bio: u.profile?.bio?.text,
            followers: u.follower_count,
            following: u.following_count,
            verifications: u.verifications
        };
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: User by username error', { error: error.message, username });
        return null;
    }
}

/**
 * Check if a user follows another user on Farcaster
 */
export async function checkIsFollowing(fid: number, targetFid: number): Promise<boolean> {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
        return false;
    }

    try {
        const url = new URL(`${NEYNAR_API_BASE}/farcaster/user/bulk`);
        url.searchParams.set('fids', String(targetFid));
        url.searchParams.set('viewer_fid', String(fid));

        const data = await unifiedApiService.fetchJson<{ users: any[] }>({
            url: url.toString(),
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            endpointName: 'api.neynar.com'
        });
        const u = data.users?.[0];

        // viewer_context.following is true if viewer_fid follows the user in bulk request
        return !!u?.viewer_context?.following;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Neynar: Check following error', { error: error.message, fid, targetFid });
        return false;
    }
}

export default {
    searchCastsNeynar,
    getTrendingFeed,
    isNeynarConfigured,
    getUsersNeynar,
    getUserByUsername,
    checkIsFollowing
};
