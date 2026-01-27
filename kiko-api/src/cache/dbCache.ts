import prisma from '../db/prisma.js';

/**
 * Get item from PostgreSQL Cache
 */
export async function get(key: string): Promise<string | null> {
    try {
        const item = await prisma.cache.findUnique({
            where: { key }
        });

        // Check if expired
        if (item && item.expiresAt && new Date() > item.expiresAt) {
            // Delete expired item asynchronously
            await del(key); // Using existing del function
            return null;
        }

        return item?.value || null;
    } catch (error) {
        console.error(`[DBCache] Get error for ${key}:`, error);
        return null;
    }
}

/**
 * Get cache entry with metadata (no auto-delete of expired items).
 */
export async function getEntry(key: string): Promise<{ value: string; expiresAt: Date | null; updatedAt: Date } | null> {
    try {
        const item = await prisma.cache.findUnique({
            where: { key },
            select: { value: true, expiresAt: true, updatedAt: true }
        });
        if (!item) return null;
        return {
            value: item.value,
            expiresAt: item.expiresAt,
            updatedAt: item.updatedAt
        };
    } catch (error) {
        console.error(`[DBCache] GetEntry error for ${key}:`, error);
        return null;
    }
}

/**
 * Set item in PostgreSQL Cache
 * ttl: Time to live in seconds
 */
export async function set(key: string, value: string, ttl?: number): Promise<void> {
    try {
        let expiresAt: Date | null = null;
        if (ttl) {
            expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + ttl);
        }

        await prisma.cache.upsert({
            where: { key },
            update: {
                value,
                expiresAt,
                updatedAt: new Date()
            },
            create: {
                key,
                value,
                expiresAt
            }
        });
    } catch (error) {
        console.error(`[DBCache] Set error for ${key}:`, error);
    }
}

/**
 * Delete item from PostgreSQL Cache
 */
export async function del(key: string): Promise<void> {
    try {
        await prisma.cache.delete({
            where: { key }
        }).catch(() => {
            // Ignore if not found
        });
    } catch (error) {
        console.error(`[DBCache] Del error for ${key}:`, error);
    }
}

/**
 * Initialize Cache (Cleanup expired items on startup)
 */
export async function initCache(): Promise<void> {
    try {
        console.log('[DBCache] Initializing PostgreSQL Cache...');
        // Remove expired items
        const result = await prisma.cache.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date()
                }
            }
        });
        console.log(`[DBCache] Cleaned ${result.count} expired items.`);
    } catch (error) {
        console.error('[DBCache] Init error:', error);
    }
}

// Export for backward compatibility with redis.ts (if needed directly)
export const redisClient = {
    get,
    set,
    del,
    // Add mock quit/disconnect if needed
    quit: async () => { },
    disconnect: async () => { }
};
