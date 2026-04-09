/**
 * Rate Limiter Middleware
 * Uses Redis to track request frequency and prevent abuse.
 */

// CONTEXT MEMORY
// Updated: 2026-04-09
// Author: Almurat
// Reason: global API throttling now coexists with privileged OAuth bootstrap
//         flows, so the limiter must explicitly protect interactive traffic
//         without breaking one-time operator authorization paths.
// Goal: preserve broad abuse protection while allowing security-sensitive but
//       low-frequency bootstrap routes to complete deterministically.
// Owns: request throttling categories, bypass rules, and fail-open behavior for
//       limiter backend faults.
// Does Not Own: endpoint-level authorization, webhook validation, or OAuth token exchange.
// Design Language:
// - Keep global limits on by default.
// - Explicitly exempt privileged bootstrap routes instead of relying on retries.
// - Treat limiter backend faults as non-fatal to request handling.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-x-auth-rate-limit-bypass.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../cache/cacheClient.js';
import prisma from '../db/prisma.js';

const WINDOW_SIZE_IN_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = Math.max(
    100,
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10) || 500
); // Align with env default (500/min) and keep sane lower bound
const REDIS_ENABLED = process.env.REDIS_URL && process.env.REDIS_ENABLED !== 'false';

export async function rateLimiterMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Skip rate limiting for specific paths or in dev if needed
    const isProduction = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod');
    if (process.env.NODE_ENV === 'test' || (process.env.SKIP_RATE_LIMIT === 'true' && !isProduction)) {
        return;
    }

    // Always skip preflight from limiter bucket.
    if (request.method === 'OPTIONS') {
        return;
    }

    // Skip rate limiting for health checks and static assets
    if (
        request.url === '/health' ||
        request.url === '/api/health' ||
        request.url === '/api/chat/ws' ||
        request.url.startsWith('/api/chat/ws?') ||
        request.url === '/v2/chat/ws' ||
        request.url.startsWith('/v2/chat/ws?') ||
        request.url === '/api/auth/x/start' ||
        request.url.startsWith('/api/auth/x/start?') ||
        request.url === '/api/auth/x/callback' ||
        request.url.startsWith('/api/auth/x/callback?') ||
        request.url.startsWith('/api/webhook/') ||
        request.url.startsWith('/webhook/') ||
        request.url.startsWith('/assets/') ||
        request.url.startsWith('/api/images/') ||
        request.url === '/api/chat/moderation/log'
    ) {
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
    } else if (request.method === 'POST' && url === '/api/chat/sessions') {
        maxRequests = Math.max(MAX_REQUESTS_PER_WINDOW, 180);
        category = 'chat_session_create';
    } else if (request.method === 'GET' && (url === '/api/chat/sessions' || url.startsWith('/api/chat/sessions?'))) {
        maxRequests = Math.max(MAX_REQUESTS_PER_WINDOW, 240);
        category = 'chat_session_list';
    } else if (request.method === 'GET' && url.startsWith('/api/chat/sessions/')) {
        maxRequests = Math.max(MAX_REQUESTS_PER_WINDOW, 240);
        category = 'chat_session_read';
    } else if (url.includes('/api/ai/') || url.includes('/api/chat/')) {
        maxRequests = 60; // Other AI endpoints: 60/min
        category = 'ai_general';
    } else if (url.includes('/api/swap/') || url.includes('/api/tokens/')) {
        maxRequests = 120; // Trading endpoints: 120/min
        category = 'trading';
    } else if (
        request.method === 'GET' &&
        (
            url.includes('/api/social/') ||
            url.includes('/api/wallets/') ||
            url.includes('/api/market/') ||
            url.includes('/api/news/')
        )
    ) {
        // Page switching bursts can trigger many parallel read requests.
        // Use a looser bucket to avoid transient false-positive throttling.
        maxRequests = Math.max(MAX_REQUESTS_PER_WINDOW, 1200);
        category = 'read_burst';
    }

    // Key prioritization: userId > ip
    // Using userId prevents rate-limit bypass via IP rotation
    const identifier = userId ? `u:${userId.slice(-12)}` : `i:${ip}`;
    const key = `ratelimit:${category}:${identifier}`;

    try {
        let current = 0;
        let ttl = WINDOW_SIZE_IN_SECONDS;
        const redisAny = redis as any;
        const canUseRedis = REDIS_ENABLED && !!redisAny && redisAny.isOpen && redisAny.isReady;

        if (canUseRedis) {
            // Use Redis INCR for atomic counting with timeout
            const incrPromise = redisAny.incr(key);
            const timeoutPromise = new Promise<number>((_, reject) =>
                setTimeout(() => reject(new Error('Redis timeout')), 1000)
            );

            current = await Promise.race([incrPromise, timeoutPromise]);

            // On first request, set the expiration window
            if (current === 1) {
                await redisAny.expire(key, WINDOW_SIZE_IN_SECONDS).catch(() => { });
            }
            ttl = await redisAny.ttl(key).catch(() => WINDOW_SIZE_IN_SECONDS);
            if (!Number.isFinite(ttl) || ttl <= 0) ttl = WINDOW_SIZE_IN_SECONDS;
        } else {
            // PostgreSQL fallback (atomic counter in Cache table)
            const expiresAt = new Date(Date.now() + WINDOW_SIZE_IN_SECONDS * 1000);
            const rows = await prisma.$queryRaw<Array<{ value: string; expiresAt: Date | null }>>`
                INSERT INTO "Cache" ("key", "value", "expiresAt", "createdAt", "updatedAt")
                VALUES (${key}, '1', ${expiresAt}, NOW(), NOW())
                ON CONFLICT ("key") DO UPDATE
                SET "value" = CASE
                        WHEN "Cache"."expiresAt" IS NULL OR "Cache"."expiresAt" < NOW() THEN '1'
                        ELSE (("Cache"."value")::bigint + 1)::text
                    END,
                    "expiresAt" = CASE
                        WHEN "Cache"."expiresAt" IS NULL OR "Cache"."expiresAt" < NOW() THEN ${expiresAt}
                        ELSE "Cache"."expiresAt"
                    END,
                    "updatedAt" = NOW()
                RETURNING "value", "expiresAt"
            `;

            current = Number(rows[0]?.value || 0);
            const expiresAtValue = rows[0]?.expiresAt ? new Date(rows[0].expiresAt).getTime() : Date.now() + WINDOW_SIZE_IN_SECONDS * 1000;
            ttl = Math.max(1, Math.ceil((expiresAtValue - Date.now()) / 1000));
        }

        // Check if limit exceeded
        if (current > maxRequests) {
            console.warn('[RateLimiter] Request blocked', {
                method: request.method,
                url,
                category,
                current,
                maxRequests,
                retryAfterSec: ttl,
            });
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
        // Fail-open: transient limiter backend issues should not take down API.
        console.warn('[RateLimiter] Limiter backend issue, skipping limit check:', (error as any).message);
    }
}

export function registerRateLimiter(fastify: FastifyInstance): void {
    // Registered as a hook in index.ts
}

export const rateLimiter = rateLimiterMiddleware;
