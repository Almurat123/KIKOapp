/**
 * KiKo V2 Token Oracle
 * Background service for fetching and caching token data.
 * Decouples ChatWorker from external APIs to prevent 429 rate limit crashes.
 */

import { LRUCache } from 'lru-cache';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { getTokenDetails, getTrendingTokens } from '../../services/geckoTerminal.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT } from '../../config/tokenRegistry.js';

interface TokenData {
    price: number;
    symbol: string;
    name: string;
    decimals: number;
    liquidity: number;
    volume24h: number;
    lastUpdated: number;
}

export class TokenOracle {
    private static instance: TokenOracle;
    private cache: LRUCache<string, TokenData>;
    private pendingRequests: Map<string, Promise<TokenData | null>> = new Map();

    // Cache longer than API rate limits to act as a buffer
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.cache = new LRUCache<string, TokenData>({
            max: 1000,
            ttl: this.CACHE_TTL
        });
    }

    public static getInstance(): TokenOracle {
        if (!TokenOracle.instance) {
            TokenOracle.instance = new TokenOracle();
        }
        return TokenOracle.instance;
    }

    /**
     * Get token data. If cached/stale, returns immediately.
     * If missing, triggers background fetch but might return null initially if non-blocking.
     */
    public async getTokenData(address: string, chainId: number, blockWait = false): Promise<TokenData | null> {
        const key = this.getCacheKey(address, chainId);
        const cached = this.cache.get(key);

        if (cached) {
            return cached;
        }

        if (blockWait) {
            return this.fetchTokenData(address, chainId);
        } else {
            // Trigger fetch in background if not already pending
            if (!this.pendingRequests.has(key)) {
                this.fetchTokenData(address, chainId).catch(err =>
                    logger.error(LogCode.API_FETCH_FAILED, 'Oracle background fetch failed', { error: err, address })
                );
            }
            return null; // Should handle "loading" state in UI
        }
    }

    private async fetchTokenData(address: string, chainId: number): Promise<TokenData | null> {
        const key = this.getCacheKey(address, chainId);

        // Deduplicate in-flight requests
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key)!;
        }

        const fetchPromise = (async () => {
            try {
                // Determine network slug
                const network = this.getNetworkSlug(chainId);

                // Call GeckoTerminal Service (which now has circuit breaker)
                const result = await getTokenDetails(network, address);

                if (result) {
                    const data: TokenData = {
                        price: result.price || 0,
                        symbol: result.symbol,
                        name: result.name,
                        decimals: result.decimals || 18,
                        liquidity: result.liquidity || 0,
                        volume24h: result.volume24h || 0,
                        lastUpdated: Date.now()
                    };
                    this.cache.set(key, data);
                    return data;
                }
                return null;
            } finally {
                this.pendingRequests.delete(key);
            }
        })();

        this.pendingRequests.set(key, fetchPromise);
        return fetchPromise;
    }

    private getCacheKey(address: string, chainId: number): string {
        return `${chainId}:${address.toLowerCase()}`;
    }

    private getNetworkSlug(chainId: number): string {
        const map: Record<number, string> = {
            1: 'eth',
            8453: 'base',
            56: 'bsc',
            42161: 'arbitrum',
            10: 'optimism',
            137: 'polygon',
            900: 'solana'
        };
        return map[chainId] || 'base';
    }
}
