/**
 * Simple In-Memory Cache with TTL
 * Used for storing temporary data like OGP previews that don't need strict persistence
 * but benefit greatly from high-speed access.
 */

interface CacheEntry<T> {
    value: T;
    expiry: number;
}

export class SimpleCache<T = any> {
    private cache: Map<string, CacheEntry<T>>;
    private defaultTtl: number;

    /**
     * @param defaultTtlMs Default Time To Live in milliseconds (default: 1 hour)
     */
    constructor(defaultTtlMs: number = 3600 * 1000) {
        this.cache = new Map();
        this.defaultTtl = defaultTtlMs;
    }

    set(key: string, value: T, ttlMs?: number): void {
        const expiry = Date.now() + (ttlMs || this.defaultTtl);
        this.cache.set(key, { value, expiry });

        // Prevent unbounded growth - simple cleanup if too big
        if (this.cache.size > 10000) {
            this.cleanup();
        }
    }

    get(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
            }
        }
    }
}

// Export a singleton instance for OGP specifically
export const ogpCache = new SimpleCache<any>(24 * 60 * 60 * 1000); // 24 hours default for OGP
