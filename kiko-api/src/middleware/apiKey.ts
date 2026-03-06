import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errorHandler.js';
import { env } from '../config/env.js';

// App keys are treated as optional public client identifiers.
// They are not a security boundary for authenticated user requests.
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

    if (VALID_APP_KEYS.size === 0) {
        return;
    }

    const appKey = request.headers['x-app-key'] as string;

    // Backward compatibility: clients may still send an app key, but it is optional.
    if (!appKey) {
        return;
    }

    if (!VALID_APP_KEYS.has(appKey)) {
        console.warn('[apiKey] Request blocked', {
            appKeyPrefix: appKey ? appKey.substring(0, 15) + '...' : 'none',
            url: request.url,
            method: request.method,
            userAgent: (request.headers['user-agent'] || '').substring(0, 80),
            origin: request.headers.origin || 'none',
        });
        throw new AppError(401, 'Invalid or missing App Key', 'INVALID_APP_KEY');
    }
}
