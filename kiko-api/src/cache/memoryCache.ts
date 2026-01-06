/**
 * In-Memory Cache Layer
 * 
 * Purpose: Eliminate Railway PostgreSQL network latency (400-2000ms per query)
 * by caching frequently accessed data in local memory.
 * 
 * Data Flow:
 * 1. Background Job fetches from external API
 * 2. Saves to PostgreSQL (persistent storage)
 * 3. Updates memory cache (fast access)
 * 4. API routes read from memory cache (instant)
 * 
 * On Server Restart:
 * - Memory cache is empty
 * - First request triggers cache population from PostgreSQL
 * - Subsequent requests read from memory (instant)
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // in milliseconds
}

class MemoryCache {
    private cache: Map<string, CacheEntry<any>> = new Map();

    /**
     * Get item from memory cache
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if expired
        if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    /**
     * Set item in memory cache
     * @param ttl Time to live in milliseconds (0 = never expires)
     */
    set<T>(key: string, data: T, ttl: number = 0): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    /**
     * Delete item from memory cache
     */
    delete(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Clear all items from cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Singleton instance
export const memoryCache = new MemoryCache();

// Cache keys for standardization
export const CACHE_KEYS = {
    CHAINS: 'chains',
    PROTOCOLS: 'protocols',
    MARKET_OVERVIEW: 'marketOverview',
    TRENDING_TOKENS: 'trendingTokens',
    TRENDING_CASTS: 'trendingCasts',
    TRENDING_TOKENS_BY_CHAIN: (chain: string) => `trendingTokens:${chain}`,
} as const;

// Default TTL values (in milliseconds)
export const CACHE_TTL = {
    CHAINS: 24 * 60 * 60 * 1000,        // 24 hours
    PROTOCOLS: 24 * 60 * 60 * 1000,     // 24 hours
    MARKET_OVERVIEW: 24 * 60 * 60 * 1000, // 24 hours
    TRENDING_TOKENS: 5 * 60 * 1000,     // 5 minutes
    TRENDING_CASTS: 10 * 60 * 1000,     // 10 minutes
} as const;
