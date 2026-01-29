/**
 * Rate Limiter Middleware
 * Uses Redis to track request frequency and prevent abuse.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../cache/redis.js';

const WINDOW_SIZE_IN_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 200; // Default: 200 requests per minute (generous)
const REDIS_ENABLED = process.env.REDIS_URL && process.env.REDIS_ENABLED !== 'false';

export async function rateLimiterMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Skip rate limiting if Redis is not configured
    if (!REDIS_ENABLED) {
        return;
    }

    // Skip rate limiting for specific paths or in dev if needed
    const isProduction = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod');
    if (process.env.NODE_ENV === 'test' || (process.env.SKIP_RATE_LIMIT === 'true' && !isProduction)) {
        return;
    }

    // Skip rate limiting for health checks and static assets
    if (request.url === '/health' || request.url === '/api/health' || request.url.startsWith('/assets/')) {
        return;
    }

    // Skip if Redis client is not available or not connected
    const redisAny = redis as any;
    if (!redisAny || !redisAny.isOpen || !redisAny.isReady) {
        return;
    }

    const ip = request.ip;
    const url = request.url;
    const authUser = (request as any).user;
    const userId = authUser?.sub;

    // Determine limit based on endpoint - more generous limits
    let maxRequests = MAX_REQUESTS_PER_WINDOW;
    let category = 'default';

    if (url.includes('/sessions/') && url.includes('/messages')) {
        maxRequests = 30; // AI chat: 30/min (reasonable for active conversations)
        category = 'ai_chat';
    } else if (url.includes('/api/ai/') || url.includes('/api/chat/')) {
        maxRequests = 60; // Other AI endpoints: 60/min
        category = 'ai_general';
    } else if (url.includes('/api/webhook/')) {
        maxRequests = 100; // Webhooks: 100/min
        category = 'webhook';
    } else if (url.includes('/api/swap/') || url.includes('/api/tokens/')) {
        maxRequests = 120; // Trading endpoints: 120/min
        category = 'trading';
    }

    // Key prioritization: userId > ip
    // Using userId prevents rate-limit bypass via IP rotation
    const identifier = userId ? `u:${userId.slice(-12)}` : `i:${ip}`;
    const key = `ratelimit:${category}:${identifier}`;

    try {
        // Use Redis INCR for atomic counting with timeout
        const redisAny = redis as any;
        const incrPromise = redisAny.incr(key);
        const timeoutPromise = new Promise<number>((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 1000)
        );

        const current = await Promise.race([incrPromise, timeoutPromise]);

        // On first request, set the expiration window
        if (current === 1) {
            await (redis as any).expire(key, WINDOW_SIZE_IN_SECONDS).catch(() => { });
        }

        // Check if limit exceeded
        if (current > maxRequests) {
            const ttl = await (redis as any).ttl(key).catch(() => WINDOW_SIZE_IN_SECONDS);

            reply.status(429).header('Retry-After', ttl).send({
                success: false,
                error: 'Too Many Requests',
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'You have exceeded the request limit. Please try again later.',
                retryAfter: ttl > 0 ? ttl : WINDOW_SIZE_IN_SECONDS,
            });
            return;
        }

        // Optional: Add rate limit headers to response
        reply.header('X-RateLimit-Limit', maxRequests);
        reply.header('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

    } catch (error) {
        // Fallback: If Redis is down, allow request but log warning
        // This ensures a Redis outage doesn't take down the entire API
        console.warn('[RateLimiter] Redis issue, skipping limit check:', (error as any).message);
    }
}

export function registerRateLimiter(fastify: FastifyInstance): void {
    // Registered as a hook in index.ts
}

export const rateLimiter = rateLimiterMiddleware;
