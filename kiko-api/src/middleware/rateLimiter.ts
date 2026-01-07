/**
 * Rate Limiter Middleware
 * Uses Redis to track request frequency and prevent abuse.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../cache/redis.js';

const WINDOW_SIZE_IN_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 50; // Default: 50 requests per minute

export async function rateLimiterMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Skip rate limiting for specific paths or in dev if needed
    if (process.env.NODE_ENV === 'test' || process.env.SKIP_RATE_LIMIT === 'true') {
        return;
    }

    const ip = request.ip;
    const key = `ratelimit:${ip}`;

    try {
        // Use Redis INCR for atomic counting
        const current = await redis.incr(key);

        // On first request, set the expiration window
        if (current === 1) {
            await redis.expire(key, WINDOW_SIZE_IN_SECONDS);
        }

        // Check if limit exceeded
        if (current > MAX_REQUESTS_PER_WINDOW) {
            const ttl = await redis.ttl(key);

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
        reply.header('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
        reply.header('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_WINDOW - current));
        reply.header('X-RateLimit-Reset', await redis.ttl(key));

    } catch (error) {
        // Fallback: If Redis is down, allow request but log warning
        // This ensures a Redis outage doesn't take down the entire API
        console.warn('[RateLimiter] Redis connection issue, skipping limit check:', (error as any).message);
    }
}

export function registerRateLimiter(fastify: FastifyInstance): void {
    // Registered as a hook in index.ts
}

export const rateLimiter = rateLimiterMiddleware;
