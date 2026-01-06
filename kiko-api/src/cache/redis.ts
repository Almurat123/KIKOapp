import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = createClient({
    url: REDIS_URL
});

redis.on('error', (err) => console.error('Redis Client Error', err));

export async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}

// Alias for backwards compatibility
export const initRedis = connectRedis;

export async function get(key: string): Promise<string | null> {
    await connectRedis();
    return await redis.get(key);
}

export async function set(key: string, value: string, options?: any): Promise<void> {
    await connectRedis();
    await redis.set(key, value, options);
}

export async function del(key: string): Promise<void> {
    await connectRedis();
    await redis.del(key);
}

// Default export for common usage
export default {
    get,
    set,
    del,
    connect: connectRedis,
    client: redis
};
