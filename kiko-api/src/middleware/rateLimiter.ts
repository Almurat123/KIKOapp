/**
 * Rate Limiter Middleware Stub
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function rateLimiterMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // No-op - rate limiting disabled
}

export function registerRateLimiter(fastify: FastifyInstance): void {
    // No-op
}

// Alias for backwards compatibility
export const rateLimiter = rateLimiterMiddleware;
