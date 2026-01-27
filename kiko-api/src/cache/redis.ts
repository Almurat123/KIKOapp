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
        console.warn('[DBLock] Lock already held', {
            key,
            expiresAt: existing.expiresAt?.toISOString() || null,
            ageMs
        });
        // If lock looks stale (no expiry or very old), surface it for ops.
        if (!expiresAt || ageMs > (ttlSeconds + 60) * 1000) {
            console.warn('[DBLock] Potential stale lock detected', { key, ageMs, ttlSeconds });
        }
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
