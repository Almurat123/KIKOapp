import * as dbCache from './dbCache.js';

// NOTE: Redis is intentionally disabled in this deployment.
// All cache operations are routed to PostgreSQL via dbCache.
const REDIS_ENABLED = false;

// Keep the exported redis client for compatibility (rate limiter checks for existence)
const redis = null;

export async function connectRedis(): Promise<boolean> {
    // DB cache is always available as long as Postgres is reachable.
    return true;
}

// Alias for backwards compatibility
export const initRedis = connectRedis;

export async function get(key: string): Promise<string | null> {
    return dbCache.get(key);
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await dbCache.set(key, value, ttlSeconds);
}

export async function acquireLock(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    // Best-effort lock using DB cache (not strictly atomic).
    const existing = await dbCache.getEntry(key);
    if (existing) {
        const now = Date.now();
        const expiresAt = existing.expiresAt ? existing.expiresAt.getTime() : null;
        const ageMs = now - existing.updatedAt.getTime();

        // Check if lock has expired - if so, clean it up and acquire new lock
        const isExpired = expiresAt && now > expiresAt;
        const isVeryStale = !expiresAt && ageMs > (ttlSeconds + 60) * 1000;

        if (isExpired || isVeryStale) {
            console.warn('[DBLock] Cleaning expired/stale lock', {
                key,
                expiresAt: existing.expiresAt?.toISOString() || null,
                ageMs,
                isExpired,
                isVeryStale
            });
            // Delete the stale lock and acquire new one
            await dbCache.del(key);
            await dbCache.set(key, value, ttlSeconds);
            console.info('[DBLock] Acquired lock after cleaning stale entry', { key });
            return true;
        }

        // Lock is still valid and held by someone else
        console.warn('[DBLock] Lock already held (valid)', {
            key,
            expiresAt: existing.expiresAt?.toISOString() || null,
            ageMs
        });
        return false;
    }
    await dbCache.set(key, value, ttlSeconds);
    return true;
}

export async function releaseLock(key: string, value: string): Promise<void> {
    const existing = await dbCache.get(key);
    if (existing === value) {
        await dbCache.del(key);
    }
}

export async function del(key: string): Promise<void> {
    await dbCache.del(key);
}

// Export for direct access if needed
export { redis };

// Default export for common usage
export default {
    get,
    set,
    del,
    connect: connectRedis,
    client: redis
};
