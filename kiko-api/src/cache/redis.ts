import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false'; // Default enabled, set to 'false' to disable

let redis: RedisClientType | null = null;
let redisConnected = false;
let redisConnectionFailed = false;

// Only create client if Redis is enabled
if (REDIS_ENABLED) {
    redis = createClient({ url: REDIS_URL });
    redis.on('error', (err) => {
        if (!redisConnectionFailed) {
            console.warn('[Redis] Connection error (Redis disabled for this session):', err.message);
            redisConnectionFailed = true;
        }
    });
}

export async function connectRedis(): Promise<boolean> {
    if (!REDIS_ENABLED || redisConnectionFailed) return false;
    if (!redis) return false;

    if (!redis.isOpen && !redisConnected) {
        try {
            // Add timeout to prevent blocking forever
            const connectWithTimeout = Promise.race([
                redis.connect(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Connection timeout')), 5000)
                )
            ]);
            await connectWithTimeout;
            redisConnected = true;
            console.log('[Redis] Connected successfully');
        } catch (err: any) {
            console.warn('[Redis] Failed to connect, running without cache:', err.message);
            redisConnectionFailed = true;
            return false;
        }
    }
    return redisConnected;
}

// Alias for backwards compatibility
export const initRedis = connectRedis;

export async function get(key: string): Promise<string | null> {
    if (!REDIS_ENABLED || redisConnectionFailed || !redis) return null;
    try {
        const connected = await connectRedis();
        if (!connected) return null;
        return await redis.get(key);
    } catch (err) {
        return null;
    }
}

export async function set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!REDIS_ENABLED || redisConnectionFailed || !redis) return;
    try {
        const connected = await connectRedis();
        if (!connected) return;
        if (ttlSeconds) {
            await redis.set(key, value, { EX: ttlSeconds });
        } else {
            await redis.set(key, value);
        }
    } catch (err) {
        // Silently fail - cache is optional
    }
}

export async function acquireLock(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    if (!REDIS_ENABLED || redisConnectionFailed || !redis) return false;
    try {
        const connected = await connectRedis();
        if (!connected) return false;
        const result = await redis.set(key, value, { NX: true, EX: ttlSeconds });
        return result === 'OK';
    } catch {
        return false;
    }
}

export async function releaseLock(key: string, value: string): Promise<void> {
    if (!REDIS_ENABLED || redisConnectionFailed || !redis) return;
    try {
        const connected = await connectRedis();
        if (!connected) return;
        // Only release if we still own it.
        await redis.eval(
            'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
            { keys: [key], arguments: [value] }
        );
    } catch {
        // Silently fail - lock is best-effort
    }
}

export async function del(key: string): Promise<void> {
    if (!REDIS_ENABLED || redisConnectionFailed || !redis) return;
    try {
        const connected = await connectRedis();
        if (!connected) return;
        await redis.del(key);
    } catch (err) {
        // Silently fail - cache is optional
    }
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
