/**
 * Simple in-memory cache for API responses
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresIn: number;
}

class ApiCache {
    private cache = new Map<string, CacheEntry<any>>();

    /**
     * Set data in cache
     * @param key Cache key
     * @param data Data to cache
     * @param expiresIn Expiration time in milliseconds (default: 1 minute)
     */
    set<T>(key: string, data: T, expiresIn: number = 60000) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn,
        });
    }

    /**
     * Get data from cache
     * @param key Cache key
     * @returns Cached data or null if not found or expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const age = Date.now() - entry.timestamp;
        if (age > entry.expiresIn) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Remove specific cache entry
     */
    delete(key: string) {
        this.cache.delete(key);
    }
}

export const apiCache = new ApiCache();
