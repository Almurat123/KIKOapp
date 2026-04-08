/**
 * Simple in-memory cache for API responses
 */

// CONTEXT MEMORY
// Updated: 2026-04-08
// Author: Codex
// Reason: This cache now supports stale fallback so transient 429/network failures
//         do not strand the UI on empty states.
// Goal: Preserve a fast in-memory read path while allowing controlled reuse of
//       slightly stale data during rate-limit recovery.
// Owns: Short-lived response storage and stale lookups for read-only API data.
// Does Not Own: Request scheduling, invalidation policy, or server-side throttling.
// Design Language:
// - Prefer fail-soft reads over blanking out the UI when the backend is throttled.
// - Keep cache semantics simple and local; do not add hidden cross-tab state here.
// - Do not use this as a substitute for request deduplication or batching.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-08-rate-limit-loading-stall.md

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
     * Get data even if expired, but only within a bounded stale window.
     * Useful for 429/network fallback.
     */
    getStale<T>(key: string, maxAgeMs: number): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const age = Date.now() - entry.timestamp;
        if (age > maxAgeMs) {
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
