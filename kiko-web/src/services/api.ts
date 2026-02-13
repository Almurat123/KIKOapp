/**
 * API Service for KIKO Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || (
    import.meta.env.PROD
        ? 'https://api.kiko.app' // Production: must use HTTPS
        : 'http://localhost:3001'
);

/**
 * Get optimized image URL via backend proxy (Efficiency Protocol)
 * @param url Original image URL
 * @param width Target width (pixels)
 * @param quality Quality (0-100)
 */
export function getOptimizedImageUrl(url: string, width?: number, quality?: number): string {
    if (!url) return '';

    // Skip proxy for already optimized CDNs or trusted low-latency sources
    if (url.includes('wrpcd.net') || url.includes('imagedelivery.net') || url.includes('vxtwitter.com')) {
        return url;
    }

    const params = new URLSearchParams({ url });
    if (width) params.append('w', width.toString());
    if (quality) params.append('q', quality.toString());
    return `${API_BASE_URL}/api/images/token?${params.toString()}`;
}

import { logger } from '../utils/logger';
import { type ZoraToken } from './zoraApi';
import { type ClankerToken } from './clankerApi';
import { type FourMemeToken } from './fourMemeApi';
import { type PumpFunToken } from './pumpFunApi';
import { type RaydiumToken } from './raydiumApi';

/**
 * Combined Launchpad Data type
 */
export type LaunchpadData =
    | { provider: 'zora'; data: ZoraToken; chainId: number }
    | { provider: 'clanker'; data: ClankerToken; chainId: number }
    | { provider: 'doppler'; data: unknown; chainId: number }
    | { provider: 'fourmeme'; data: FourMemeToken; chainId: number }
    | { provider: 'flap'; data: unknown; chainId: number }
    | { provider: 'pumpfun'; data: PumpFunToken; chainId: number }
    | { provider: 'raydium'; data: RaydiumToken; chainId: number }
    | { provider: 'paragraph'; data: unknown; chainId: number }; // paragraph data is still loose

/**
 * Chart point: [timestamp, open, high, low, close, volume]
 */
export type ChartPoint = [number, number, number, number, number, number];

/**
 * Token Transaction
 */
export interface TokenTransaction {
    type: 'buy' | 'sell';
    address: string;
    symbol: string;
    amount: string;
    amountUsd: number;
    timestamp: number;
    txHash: string;
    maker: string;
}

/**
 * Chat Session
 */
export interface ChatSession {
    id: string;
    title: string;
    model?: string;
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'archived' | 'deleted';
    backend?: 'node' | 'python';
}

/**
 * Chat Message
 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    feedback?: 'like' | 'dislike' | null;
}

/**
 * AI Task
 */
export interface ChatTask {
    id: string;
    sessionId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
    progress?: number;
    message?: string;
}

export type MarketOverview = {
    globalMarketCap: number;
    volume24h: number;
    activeUsers?: number;
    ethGasPrice?: string;
    fearGreedIndex: number;
    fearGreedClassification: string;
    bitcoinDominance: number;
    altcoinSeasonIndex?: number;
    globalOpenInterest?: number;
    gasLevel?: number;
    gasLevelStatus?: string;
    bvix?: number;
    evix?: number;
    liquidityStressIndex?: number;
    liquidityStressStatus?: string;
    stablecoinsMcap?: number;
    btcDomChange24h?: number;
    mcapChange24h?: number;
    updatedAt?: string | Date;
};

export type ChainData = {
    name: string;
    tvl: number;
    tvlChange24h: number;
    volume24h?: number;
    txns24h?: number;
    poolsCount?: number;
    tokensCount?: number;
    contracts24h?: number;
    contracts7d?: number;
    activeWallets?: number;
    gasPrice?: string;
    logoUrl?: string;
};

export type ProtocolData = {
    name: string;
    symbol?: string;
    category: string;
    tvl: number;
    tvlChange1d: number;
    tvlChange7d: number;
    volume24h?: number;
    chains: string[];
    mcapTvlRatio?: number;
    description?: string;
    logoUrl?: string;
    mcap?: number;
    fdv?: number;
    audits?: string[];
};

export interface TokenSearchResult {
    address: string;
    name: string;
    symbol: string;
    network: string;
    imageUrl?: string;        // Token logo/avatar URL
    poolCreatedAt?: string;   // Pool creation timestamp (ISO string)
    price?: number;
    priceChange5m?: number;   // 5 minutes
    priceChange1h?: number;   // 1 hour
    priceChange6h?: number;   // 6 hours
    priceChange24h?: number;  // 24 hours
    volume24h?: number;
    txns24h?: number;         // 24h transaction count
    buys24h?: number;         // 24h buy count
    sells24h?: number;        // 24h sell count
    liquidity?: number | string;
    fdv?: number | string;
    poolAddress?: string;
    holders?: number;
    socials?: Array<{ type: string; url: string }>;
    websites?: Array<{ url: string; label?: string }>;
    decimals?: number;        // Token decimals
    logoUrl?: string;         // Legacy alias for imageUrl
    launchpad?: string;       // Originating launchpad (e.g. 'pump.fun', 'clanker')
    creatorAddress?: string;  // Launchpad creator/deployer (when available)
    creatorUrl?: string;      // Preferred creator social/profile URL
    creatorLabel?: string;    // Preferred creator display label (e.g. @handle)
    launchMultiple?: number;  // Current price multiple vs earliest available launch candle
}

/**
 * API Response wrapper
 */
interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
    message?: string;
}

/**
 * Fetch with error handling
 */
import { apiCache } from '../utils/apiCache';
import { getAuthToken, clearAuthTokenCache } from '../utils/authToken';
import { getRuntimeConfigUrl, getEnvUrl } from '../utils/runtimeConfig';

/**
 * Request deduplication map
 */
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Get cache TTL based on endpoint
 */
function getCacheTime(endpoint: string): number {
    // Live trending must always be fresh to avoid showing tokens that are no longer in DB
    if (endpoint.includes('/tokens/trending/live')) return 0;
    // Chains data: NO CACHE - always fetch fresh data
    if (endpoint.includes('/market/chains')) return 0;
    // Market data: 5 seconds (Reduced from 30s to satisfy user refresh expectation)
    if (endpoint.includes('/market/')) return 5000;
    // Token data: 60 seconds
    if (endpoint.includes('/tokens/')) return 60000;
    // Social data: 5 minutes
    if (endpoint.includes('/social/')) return 300000;
    // Default: 1 minute
    return 60000;
}

/**
 * Fetch with error handling, caching, and deduplication
 */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Create a unique key for this request
    const cacheKey = `${endpoint}-${JSON.stringify(options || {})}`;

    // 1. Check for pending duplicate requests (Deduplication)
    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey) as Promise<T>;
    }

    // 2. Check cache (if not a POST/PUT/DELETE request)
    const isReadRequest = !options?.method || options.method === 'GET';
    if (isReadRequest) {
        const cachedData = apiCache.get<T>(cacheKey);
        if (cachedData) {
            return cachedData;
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Get Privy access token if available
    const authToken = await getAuthToken();

    // Generate request signature if enabled
    let signatureHeaders = {};
    if (import.meta.env.VITE_SIGNING_SECRET) {
        try {
            const { signRequest } = await import('../utils/signRequest.js');
            const body = options?.body ? JSON.parse(options.body as string) : undefined;
            signatureHeaders = await signRequest(options?.method || 'GET', endpoint, body);
        } catch (error) {
            console.warn('[API] Failed to sign request:', error);
        }
    }

    // Create the request promise
    const requestPromise = (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                cache: 'no-store',
                signal: controller.signal,
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'X-App-Key': import.meta.env.VITE_APP_KEY || '',
                    ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    ...signatureHeaders,
                    ...options?.headers,
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;

                // Provide more helpful error messages
                if (response.status === 0 || response.status === 503) {
                    throw new Error('Backend server is not available. Please ensure the backend is running.');
                }

                // Handle rate limiting (429)
                if (response.status === 429) {
                    throw new Error('You have exceeded the request limit. Please try again later.');
                }

                throw new Error(errorMessage);
            }

            const data: ApiResponse<T> = await response.json();

            if (!data.success) {
                throw new Error(data.message || data.error || 'API request failed');
            }

            // Handle null/undefined data
            let result = data.data;
            if (result === null || result === undefined) {
                // For array types, return empty array; for object types, return null
                const isArrayEndpoint = endpoint.includes('/chains') ||
                    endpoint.includes('/protocols') ||
                    endpoint.includes('/trending') ||
                    endpoint.includes('/gainers') ||
                    endpoint.includes('/articles') ||
                    endpoint.includes('/flash') ||
                    endpoint.includes('/tokens');
                result = (isArrayEndpoint ? [] : null) as T;
            }

            // 3. Cache the successful result
            if (isReadRequest) {
                const ttl = getCacheTime(endpoint);
                apiCache.set(cacheKey, result, ttl);
            }

            return result;
        } catch (error: unknown) {
            clearTimeout(timeoutId);

            const err = error as Error;

            // Handle specific error types
            if (err.name === 'AbortError') {
                logger.error(`API Timeout [${endpoint}]: Request took longer than 30 seconds`);
                throw new Error('Request timeout. The server may be slow or unavailable.');
            }

            if (err.message?.includes('Failed to fetch') ||
                err.message?.includes('NetworkError') ||
                err.message?.includes('ERR_CONNECTION_REFUSED')) {
                logger.error(`API Connection Error [${endpoint}]: Backend server not available`);
                throw new Error('Cannot connect to backend server. Please ensure the backend is running on port 3001.');
            }

            logger.error(`API Error [${endpoint}]:`, err);
            throw err;
        } finally {
            // 4. Remove from pending requests when done
            pendingRequests.delete(cacheKey);
        }
    })();

    // Store the promise in pending requests map
    pendingRequests.set(cacheKey, requestPromise);

    return requestPromise;
}

/**
 * Market Data API
 */
export const marketApi = {
    /**
     * Get market overview
     */
    async getOverview(): Promise<MarketOverview> {
        return fetchApi<MarketOverview>('/api/market/overview');
    },

    /**
     * Get chains data
     */
    async getChains(): Promise<ChainData[]> {
        return fetchApi<ChainData[]>('/api/market/chains');
    },

    /**
     * Get protocols data
     */
    async getProtocols(): Promise<ProtocolData[]> {
        return fetchApi<ProtocolData[]>('/api/market/protocols');
    },

    /**
     * Get trending tokens
     */
    async getTrending(): Promise<TokenSearchResult[]> {
        return fetchApi<TokenSearchResult[]>('/api/market/trending');
    },

    /**
     * Get top gainers
     */
    async getGainers(): Promise<TokenSearchResult[]> {
        return fetchApi<TokenSearchResult[]>('/api/market/gainers');
    },


};

/**
 * Trending duration type
 */
export type TrendingDuration = '5m' | '1h' | '6h' | '24h';

/**
 * Token Data API
 */
export const tokenApi = {
    /**
     * Get trending tokens (from database/cache, 24h only)
     */
    async getTrending(chain: string = 'eth'): Promise<TokenSearchResult[]> {
        return fetchApi<TokenSearchResult[]>(`/api/tokens/trending?chain=${chain}`);
    },

    /**
     * Get live trending tokens with duration support
     * @param chain - Chain identifier (eth, base, bsc, arbitrum)
     * @param duration - Trending duration: 5m, 1h, 6h, 24h
     * @param limit - Maximum number of tokens
     */
    async getTrendingLive(
        chain: string = 'eth',
        duration: TrendingDuration = '24h',
        limit: number = 100,
        strict: boolean = true
    ): Promise<TokenSearchResult[]> {
        const strictParam = strict ? '&strict=1' : '';
        const nonce = `&_t=${Date.now()}`;
        return fetchApi<TokenSearchResult[]>(
            `/api/tokens/trending/live?chain=${chain}&duration=${duration}&limit=${limit}${strictParam}${nonce}`
        );
    },

    /**
     * Search tokens
     */
    async search(query: string, network?: string): Promise<TokenSearchResult[]> {
        const params = new URLSearchParams({ q: query });
        if (network) params.append('network', network);
        return fetchApi<TokenSearchResult[]>(`/api/tokens/search?${params.toString()}`);
    },

    /**
     * Get token details
     */
    async getDetails(network: string, address: string): Promise<TokenSearchResult> {
        // Validate and encode path parameters to prevent injection
        const sanitizedNetwork = encodeURIComponent(network);
        const sanitizedAddress = encodeURIComponent(address);
        return fetchApi<TokenSearchResult>(`/api/tokens/${sanitizedNetwork}/${sanitizedAddress}`);
    },

    /**
     * Detect launchpad token by address
     */
    async detectLaunchpad(address: string, chainId?: number): Promise<LaunchpadData | null> {
        const params = new URLSearchParams({ address });
        if (chainId) params.append('chainId', chainId.toString());
        return fetchApi<LaunchpadData | null>(`/api/tokens/launchpad/detect?${params.toString()}`);
    },

    /**
     * Detect Paragraph token specifically
     */
    async detectParagraphToken(address: string): Promise<LaunchpadData | null> {
        const params = new URLSearchParams({ address });
        return fetchApi<LaunchpadData | null>(`/api/tokens/launchpad/paragraph?${params.toString()}`);
    },

    /**
     * Get chart data
     */
    async getChart(network: string, address: string, timeframe: string = 'h1', limit: number = 100, signal?: AbortSignal): Promise<ChartPoint[]> {
        try {
            const url = `${API_BASE_URL}/api/tokens/${network}/${address}/chart?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`;

            logger.debug(`[API] getChart request:`, { network, address, timeframe, limit, url });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            // Combine signals if both are provided
            if (signal) {
                // If external signal is already aborted, abort immediately
                if (signal.aborted) {
                    clearTimeout(timeoutId);
                    throw new Error('Request was cancelled');
                }
                signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    controller.abort();
                });
            }

            let response: Response;
            try {
                response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                clearTimeout(timeoutId);
            } catch (fetchError: unknown) {
                clearTimeout(timeoutId);
                const err = fetchError as Error;
                // Re-throw AbortError as-is (will be handled by caller)
                if (err.name === 'AbortError') {
                    throw err;
                }
                throw err;
            }

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`[API] Chart request failed: ${response.status} ${response.statusText}`, errorText);
                return [];
            }

            const data = await response.json();

            logger.debug(`[API] getChart response:`, {
                status: response.status,
                hasData: !!data,
                dataType: Array.isArray(data) ? 'array' : typeof data,
                dataLength: Array.isArray(data) ? data.length : (data?.data?.length || 0),
                success: data?.success,
            });

            // Handle both wrapped and unwrapped responses
            if (Array.isArray(data)) {
                logger.debug(`[API] Returning array data directly (${data.length} items)`);
                return data;
            } else if (data && typeof data === 'object') {
                if (data.success && Array.isArray(data.data)) {
                    logger.debug(`[API] Returning data.data (${data.data.length} items)`);
                    return data.data;
                } else if (data.data?.data && Array.isArray(data.data.data)) {
                    logger.debug(`[API] Returning data.data (${data.data.data.length} items)`);
                    return data.data.data;
                } else if (Array.isArray(data.data)) {
                    logger.debug(`[API] Returning data.data (${data.data.length} items)`);
                    return data.data;
                } else if (Array.isArray(data.result)) {
                    logger.debug(`[API] Returning data.result (${data.result.length} items)`);
                    return data.result;
                }
            }
            logger.warn(`[API] No valid data found in response, returning empty array`);
            return [];
        } catch (error: unknown) {
            const err = error as Error;
            // Don't log AbortError as it's expected when requests are cancelled
            if (err.name !== 'AbortError') {
                logger.error('[API] Error fetching chart data:', err);
            }
            // Return empty array for all errors (including AbortError)
            return [];
        }
    },

    /**
     * Get token transactions
     */
    async getTransactions(
        network: string,
        address: string,
        options: { limit?: number; type?: 'all' | 'buy' | 'sell' } = {}
    ): Promise<TokenTransaction[]> {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit.toString());
        if (options.type) params.append('type', options.type);

        const response = await fetchApi<{ success: boolean; data: TokenTransaction[]; count: number }>(
            `/api/tokens/${network}/${address}/transactions?${params.toString()}`
        );

        return response.data || [];
    },

    /**
     * Get token security scan
     */
    async getSecurityScan(network: string, address: string): Promise<{ success: boolean; data: unknown; cached: boolean }> {
        const response = await fetchApi<{ success: boolean; data: unknown; cached: boolean }>(
            `/api/security/scan?chain=${network}&address=${address}`
        );
        return response || { success: false, data: null, cached: false };
    },
};

/**
 * Social Data API (Farcaster)
 */
export interface TrendingCast {
    hash: string;
    fid: number;
    author: {
        fid: number;
        username?: string;
        displayName?: string;
        avatar?: string;
        verified?: boolean;
        bio?: string;
        creatorCoin?: ZoraToken; // Zora Creator Coin data
    };
    mentions?: number[]; // FIDs of mentioned users

    text: string;
    timestamp: number;
    embeds?: Array<{
        url?: string;
        castId?: {
            fid: number;
            hash: string;
        };
    }>;
    parentCastId?: {
        fid: number;
        hash: string;
    };
    stats: {
        likes: number;
        recasts: number;
        replies: number;
    };
    heatScore: number;
}

export const socialApi = {
    /**
     * Get trending casts from local database/cache (fast)
     * Only returns casts from the last 24 hours
     * Data is refreshed every 10 minutes from Snapchain Hub
     * @param limit - Maximum number of casts to return
     */
    async getTrending(limit: number = 50, timeRange: 'trending' | '24h' | '7d' | '30d' = 'trending', page: number = 1): Promise<TrendingCast[]> {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (page) params.append('page', page.toString());
        params.append('timeRange', timeRange);

        // Use local endpoint which serves cached/DB data (Save-then-Display pattern)
        const casts = await fetchApi<TrendingCast[]>(`/api/social/trending?${params.toString()}`);
        return casts;
    },

    /**
     * Get trending casts with cursor-based pagination (Twitter-style)
     * Returns nextCursor for stable pagination without duplicates
     * sortBy: 'trending' (by engagement) or 'newest' (by time)
     */
    async getTrendingWithCursor(
        limit: number = 30,
        timeRange: 'trending' | '24h' | '7d' | '30d' = 'trending',
        cursor?: string,
        sortBy: 'trending' | 'newest' = 'trending'
    ): Promise<{ casts: TrendingCast[]; nextCursor: string | null; hasMore: boolean }> {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('timeRange', timeRange);
        params.append('sortBy', sortBy);
        if (cursor) params.append('cursor', cursor);

        const response = await fetch(`${API_BASE_URL}/api/social/trending/cursor?${params.toString()}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        return {
            casts: data.data || [],
            nextCursor: data.nextCursor || null,
            hasMore: data.hasMore ?? false,
        };
    },

    /**
     * Manually trigger refresh of trending casts (Neynar)
     */
    async refresh(): Promise<TrendingCast[]> {
        return fetchApi<TrendingCast[]>('/api/social/refresh', {
            method: 'POST',
        });
    },

    /**
     * Get health status of social data sources
     */
    async getHealth(): Promise<{ status: string; services: Record<string, unknown> }> {
        return fetchApi<{ status: string; services: Record<string, unknown> }>('/api/social/health');
    },

    /**
     * Get user data by FID from Snapchain
     */
    async getUserByFid(fid: number): Promise<unknown> {
        return fetchApi<unknown>(`/api/social/snapchain/user/${fid}`);
    },
};

export interface Author {
    name: string;
    handle: string;
    avatar: string;
    isVerified: boolean;
    bio?: string;
    twitter?: string;
    creatorCoin?: ZoraToken; // Zora Creator Coin data
}

export interface Frame {
    image?: string;
    buttons?: string[];
    isPoll?: boolean;
    options?: Array<{ label: string; percent: number }>;
}

export interface FeedItem {
    id: number | string;
    rank?: number;
    heatScore?: string;
    type: 'frame' | 'text' | 'image' | 'poll' | 'suggestions' | 'video';
    author?: Author;
    time?: string;
    content?: string;
    embeds?: Array<{ url?: string; castId?: { fid: number; hash: string }; metadata?: unknown }>; // Raw embeds from cast
    mentions?: number[]; // FIDs of mentioned users
    frame?: Frame;
    images?: string[];
    videos?: string[];
    stats?: {
        replies: string;
        recasts: string;
        likes: string;
    };
    castUrl?: string; // Farcaster cast URL for navigation
    timestamp?: number; // Unix timestamp for sorting
}


/**
 * Chat System API
 * Note: Chat routes return custom response format (e.g., { success, sessions } instead of { success, data })
 */
function resolveChatApiBase(): string {
    const explicit = getRuntimeConfigUrl('CHAT_API_URL') || getEnvUrl('VITE_CHAT_API_URL');
    if (explicit) {
        try {
            new URL(explicit);
            return explicit.replace(/\/+$/, '');
        } catch {
            console.warn('[chatApi] Invalid CHAT_API_URL, falling back:', explicit);
        }
    }

    // Fallback to core API URL when chat URL is not explicitly configured.
    const core = getRuntimeConfigUrl('API_URL') || getEnvUrl('VITE_API_URL');
    if (core) {
        try {
            new URL(core);
            return core.replace(/\/+$/, '');
        } catch {
            console.warn('[chatApi] Invalid API_URL fallback:', core);
        }
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        const host = window.location.hostname.toLowerCase();
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (isLocal) {
            return window.location.origin.replace(/\/+$/, '');
        }
    }

    return 'http://localhost:8100';
}

const CHAT_API_BASE = resolveChatApiBase();

async function chatFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const doRequest = async (token: string | null) => {
        const appKey = import.meta.env.VITE_APP_KEY || '';
        return fetch(`${CHAT_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                ...(appKey ? { 'X-App-Key': appKey } : {}),
                ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options?.headers,
            },
        });
    };

    try {
        let token = await getAuthToken();
        let response = await doRequest(token);

        // Common auth race/expiry path: refresh token and retry once.
        if (response.status === 401) {
            clearAuthTokenCache();
            token = await getAuthToken();
            response = await doRequest(token);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        logger.error(`[chatApi] Error ${endpoint}:`, error);
        throw error;
    }
}

export const chatApi = {
    /**
     * Create a new chat session
     */
    async createSession(title?: string, model?: string): Promise<{ success: boolean; session: ChatSession }> {
        return chatFetch<{ success: boolean; session: ChatSession }>('/v2/chat/sessions', {
            method: 'POST',
            body: JSON.stringify({ title, model }),
        });
    },

    /**
     * List user sessions
     */
    async getSessions(limit = 50, offset = 0): Promise<ChatSession[]> {
        const resp = await chatFetch<{ success: boolean; sessions: ChatSession[] }>(`/v2/chat/sessions?limit=${limit}&offset=${offset}`);
        return resp?.sessions || [];
    },

    /**
     * Get a specific session with messages
     */
    async getSession(sessionId: string): Promise<{ success: boolean; session: ChatSession; messages: ChatMessage[]; activeTask?: ChatTask }> {
        return chatFetch<{ success: boolean; session: ChatSession; messages: ChatMessage[]; activeTask?: ChatTask }>(`/v2/chat/sessions/${sessionId}`);
    },

    /**
     * Update session (title, model, status)
     */
    async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<{ success: boolean; session: ChatSession }> {
        return chatFetch<{ success: boolean; session: ChatSession }>(`/v2/chat/sessions/${sessionId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    },

    /**
     * Delete session
     */
    async deleteSession(sessionId: string): Promise<{ success: boolean }> {
        return chatFetch<{ success: boolean }>(`/v2/chat/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Rate a message (Like/Dislike)
     */
    async rateMessage(sessionId: string, messageId: string, feedback: 'like' | 'dislike' | null): Promise<{ success: boolean }> {
        return chatFetch<{ success: boolean }>(`/v2/chat/sessions/${sessionId}/messages/${messageId}/feedback`, {
            method: 'PUT',
            body: JSON.stringify({ feedback }),
        });
    },

    /**
     * Send a message to a session (starts AI task)
     */
    async sendMessage(sessionId: string, content: string, options: Record<string, unknown> = {}): Promise<{ success: boolean; userMessage: ChatMessage; assistantMessage: ChatMessage; task: ChatTask }> {
        return chatFetch<{ success: boolean; userMessage: ChatMessage; assistantMessage: ChatMessage; task: ChatTask }>(`/v2/chat/sessions/${sessionId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content, ...options }),
        });
    },

    /**
     * Get messages for a session
     */
    async getMessages(sessionId: string, after?: number): Promise<ChatMessage[]> {
        const url = `/v2/chat/sessions/${sessionId}/messages${after !== undefined ? `?after=${after}` : ''}`;
        const resp = await chatFetch<{ success: boolean; messages: ChatMessage[] }>(url);
        return resp?.messages || [];
    },

    /**
     * Get task status
     */
    async getTaskStatus(taskId: string): Promise<ChatTask> {
        return chatFetch<ChatTask>(`/v2/chat/tasks/${taskId}`);
    },

    /**
     * Stop/cancel a task
     */
    async stopTask(taskId: string): Promise<{ success: boolean }> {
        return chatFetch<{ success: boolean }>(`/v2/chat/tasks/${taskId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({}), // Fastify requires body when Content-Type is JSON
        });
    },

    /**
     * Poll for message chunks
     */
    async getMessageChunks(messageId: string, after?: number): Promise<{ success: boolean; chunks: unknown[] }> {
        const url = `/v2/chat/messages/${messageId}/chunks${after !== undefined ? `?after=${after}` : ''}`;
        return chatFetch<{ success: boolean; chunks: unknown[] }>(url);
    },

    /**
     * Get personalized suggestions
     */
    async getSuggestions(): Promise<{ success: boolean; suggestions: string[] }> {
        return chatFetch<{ success: boolean; suggestions: string[] }>('/v2/chat/suggestions');
    },

    /**
     * Log moderation event
     */
    async logModeration(data: {
        channel?: string;
        content: string;
        result: unknown;
        sessionId?: string | null;
        model?: string | null;
    }): Promise<unknown> {
        return chatFetch<unknown>('/v2/chat/moderation/log', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};

/**
 * Wallet Export API (for compliance tracking)
 */
export const walletExportApi = {
    /**
     * Get list of exported wallets for current user
     */
    async getExportedWallets(): Promise<Array<{ walletAddress: string; chainType: string; exportedAt: string }>> {
        return fetchApi<Array<{ walletAddress: string; chainType: string; exportedAt: string }>>('/api/users/wallet-exports');
    },

    /**
     * Record a wallet key export
     */
    async recordExport(walletAddress: string, chainType: string): Promise<{ walletAddress: string; chainType: string; exportedAt: string }> {
        return fetchApi<{ walletAddress: string; chainType: string; exportedAt: string }>('/api/users/wallet-exports', {
            method: 'POST',
            body: JSON.stringify({ walletAddress, chainType })
        });
    },

    /**
     * Check if a specific wallet has been exported
     */
    async checkExported(walletAddress: string): Promise<{ exported: boolean; exportedAt: string | null }> {
        return fetchApi<{ exported: boolean; exportedAt: string | null }>(`/api/users/wallet-exports/check?walletAddress=${encodeURIComponent(walletAddress)}`);
    }
};
