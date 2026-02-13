import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errorHandler.js';
import { env } from '../config/env.js';

// [Logic]: Load valid app keys from environment variables
// [Ref]: Environment-based configuration pattern from env.ts
// [Risk]: If appKey is not set, all requests will be rejected
const VALID_APP_KEYS = new Set([
    env.appKey,                        // Web frontend application
    (process.env as any).KIKO_MOBILE_APP_KEY,   // Mobile app (future)
].filter(Boolean));

/**
 * Fastify preHandler to require valid App Key
 * [Logic]: Checks X-App-Key header against whitelist
 * [Ref]: Similar pattern to requireAuth in auth.ts
 * [Risk]: Empty VALID_APP_KEYS set will block all requests
 */
export async function requireAppKey(request: FastifyRequest, _reply: FastifyReply) {
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    const requestInternalKey = (request.headers['x-internal-service-key'] as string) || (request.headers['x-service-key'] as string) || '';
    if (internalKey && requestInternalKey === internalKey) {
        return;
    }

    // [Logic]: Allow bypass in development if no keys configured
    // [Risk]: Production deployment without keys will allow all traffic
    if (VALID_APP_KEYS.size === 0) {
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev) {
            console.warn('[apiKey] No app keys configured, allowing request in development mode');
            return;
        }
        throw new AppError(503, 'App key validation not configured', 'APP_KEY_NOT_CONFIGURED');
    }

    const appKey = request.headers['x-app-key'] as string;

    // [Logic]: Reject requests without app key
    // [Risk]: Null/undefined check required to prevent bypass
    if (!appKey || !VALID_APP_KEYS.has(appKey)) {
        // [Logic]: Log details for debugging
        console.warn('[apiKey] Request blocked', {
            hasAppKey: !!appKey,
            appKeyPrefix: appKey ? appKey.substring(0, 15) + '...' : 'none',
            url: request.url,
            method: request.method,
            userAgent: (request.headers['user-agent'] || '').substring(0, 80),
            origin: request.headers.origin || 'none',
        });
        throw new AppError(401, 'Invalid or missing App Key', 'INVALID_APP_KEY');
    }
}
