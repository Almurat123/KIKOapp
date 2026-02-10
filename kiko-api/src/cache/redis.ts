import * as dbCache from './dbCache.js';
import prisma from '../db/prisma.js';
import { createClient, type RedisClientType } from 'redis';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD;
const REDIS_ENABLED = (process.env.REDIS_ENABLED || 'true').toLowerCase() !== 'false';

// Keep the exported redis client for compatibility (rate limiter checks for existence)
let redis: RedisClientType | null = null;

function buildRedisClient(): RedisClientType {
    if (redisUrl) {
        return createClient({ url: redisUrl });
    }

    return createClient({
        socket: {
            host: redisHost || 'localhost',
            port: Number.isFinite(redisPort) ? redisPort : 6379,
        },
        password: redisPassword || undefined,
    });
}

export async function connectRedis(): Promise<boolean> {
    if (!REDIS_ENABLED) return false;

    if (redis?.isOpen) return true;

    try {
        redis = buildRedisClient();
        redis.on('error', (err) => {
            console.error('[Redis] client error:', err?.message || String(err));
        });
        await redis.connect();
        return true;
    } catch (error: any) {
        console.error('[Redis] connect failed, fallback to DB cache:', error?.message || String(error));
        redis = null;
        return false;
    }
}

// Alias for backwards compatibility
export const initRedis = connectRedis;

export async function get(key: string): Promise<string | null> {
    if (redis?.isOpen) {
        try {
            return await redis.get(key);
        } catch (error: any) {
            console.error('[Redis] get failed, fallback to DB cache:', error?.message || String(error));
        }
    }
    return dbCache.get(key);
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (redis?.isOpen) {
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await redis.set(key, value, { EX: Math.floor(ttlSeconds) });
            } else {
                await redis.set(key, value);
            }
            return;
        } catch (error: any) {
            console.error('[Redis] set failed, fallback to DB cache:', error?.message || String(error));
        }
    }
    await dbCache.set(key, value, ttlSeconds);
}

export async function setIfNotExists(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (redis?.isOpen) {
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                const result = await redis.set(key, value, { NX: true, EX: Math.floor(ttlSeconds) });
                return result === 'OK';
            }
            const result = await redis.set(key, value, { NX: true });
            return result === 'OK';
        } catch (error: any) {
            console.error('[Redis] setIfNotExists failed, fallback to DB cache:', error?.message || String(error));
        }
    }
    return dbCache.setIfNotExists(key, value, ttlSeconds);
}

export async function incrBy(key: string, amount: number, ttlSeconds?: number): Promise<number> {
    if (redis?.isOpen) {
        try {
            const next = await redis.incrBy(key, amount);
            if (ttlSeconds && ttlSeconds > 0) {
                await redis.expire(key, Math.floor(ttlSeconds));
            }
            return Number(next);
        } catch (error: any) {
            console.error('[Redis] incrBy failed, fallback to DB cache:', error?.message || String(error));
        }
    }
    return dbCache.incrBy(key, amount, ttlSeconds);
}

export async function acquireLock(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    if (redis?.isOpen) {
        try {
            const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : 30;
            const result = await redis.set(key, value, { NX: true, EX: safeTtl });
            return result === 'OK';
        } catch (error: any) {
            console.error('[Redis] acquireLock failed, fallback to DB lock:', {
                key,
                error: error?.message || String(error)
            });
        }
    }

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
    if (redis?.isOpen) {
        try {
            await redis.eval(
                "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
                { keys: [key], arguments: [value] }
            );
            return;
        } catch (error: any) {
            console.error('[Redis] releaseLock failed, fallback to DB lock:', {
                key,
                error: error?.message || String(error)
            });
        }
    }

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
    if (redis?.isOpen) {
        try {
            await redis.del(key);
            return;
        } catch (error: any) {
            console.error('[Redis] del failed, fallback to DB cache:', error?.message || String(error));
        }
    }
    await dbCache.del(key);
}

// Export for direct access if needed
export { redis };

// Default export for common usage
export default {
    get,
    set,
    setIfNotExists,
    incrBy,
    del,
    connect: connectRedis,
    get client() {
        return redis;
    }
};
