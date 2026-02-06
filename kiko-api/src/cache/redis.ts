import * as dbCache from './dbCache.js';
import prisma from '../db/prisma.js';

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
    try {
        const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : 30;
        const expiresAt = new Date(Date.now() + safeTtl * 1000);

        const rows = await prisma.$queryRaw<Array<{ key: string }>>`
            INSERT INTO "Cache" ("key", "value", "expiresAt", "createdAt", "updatedAt")
            VALUES (${key}, ${value}, ${expiresAt}, NOW(), NOW())
            ON CONFLICT ("key") DO UPDATE
            SET "value" = EXCLUDED."value",
                "expiresAt" = EXCLUDED."expiresAt",
                "updatedAt" = NOW()
            WHERE "Cache"."expiresAt" IS NULL OR "Cache"."expiresAt" < NOW()
            RETURNING "key"
        `;

        return rows.length > 0;
    } catch (error: any) {
        console.error('[DBLock] acquireLock failed', {
            key,
            error: error?.message || String(error)
        });
        return false;
    }
}

export async function releaseLock(key: string, value: string): Promise<void> {
    try {
        await prisma.$executeRaw`
            DELETE FROM "Cache"
            WHERE "key" = ${key}
              AND "value" = ${value}
        `;
    } catch (error: any) {
        console.error('[DBLock] releaseLock failed', {
            key,
            error: error?.message || String(error)
        });
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
