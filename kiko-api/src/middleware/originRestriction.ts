/**
 * Origin Restriction Middleware
 * Validates request Origin/Referer headers to ensure requests come from allowed domains
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errorHandler.js';

// [Logic]: Load allowed origins from environment, with development defaults
// [Ref]: CORS-like origin validation pattern
// [Risk]: Empty ALLOWED_ORIGINS will block all requests in production
const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV
    ? ALLOWED_ORIGINS_ENV.split(',').map(o => o.trim())
    : [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:3000',  // Alternative dev port
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
        'https://kikoapp.app',    // Production web app
        'https://www.kikoapp.app',
        'capacitor://localhost',  // iOS Capacitor app
        'http://localhost',       // iOS Capacitor WebView
    ];

// [Logic]: Allow bypassing origin check in development mode only
const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';

function isLoopbackAddress(ip: string | undefined): boolean {
    if (!ip) return false;
    const normalized = ip.replace(/^::ffff:/, '');
    return normalized === '127.0.0.1' || normalized === '::1';
}

/**
 * Validate request origin
 * [Logic]: Checks Origin or Referer header against whitelist
 * [Risk]: Mobile apps may not send Origin header
 */
export async function requireAllowedOrigin(request: FastifyRequest, _reply: FastifyReply) {
    // [Logic]: Skip origin check for server-to-server webhooks
    // [Risk]: Webhooks have their own signature verification (HMAC)
    const webhookPaths = ['/api/webhook/', '/webhook/'];
    if (webhookPaths.some(p => request.url.startsWith(p))) {
        return;
    }

    // [Logic]: Allow internal service-to-service calls with valid key
    // [Ref]: Used by Python Grok service calling Node.js API
    // [Risk]: Key must be kept secret, only for server-to-server calls
    const internalServiceKey = process.env.INTERNAL_SERVICE_KEY;
    const requestKey = request.headers['x-internal-service-key'] as string;
    if (internalServiceKey && requestKey === internalServiceKey) {
        console.log('[originRestriction] Internal service call authenticated');
        return;
    }

    const origin = request.headers.origin as string || '';
    const referer = request.headers.referer as string || '';
    const userAgent = request.headers['user-agent'] as string || '';
    const secFetchSite = (request.headers['sec-fetch-site'] as string || '').toLowerCase();
    const authHeader = (request.headers.authorization as string || '').toLowerCase();

    // [Logic]: Extract base origin from referer if origin is missing
    let effectiveOrigin = origin;
    if (!effectiveOrigin && referer) {
        try {
            const url = new URL(referer);
            effectiveOrigin = `${url.protocol}//${url.host}`;
        } catch {
            effectiveOrigin = '';
        }
    }

    // [Logic]: Allow mobile apps (Capacitor) which may not send standard origin
    const isMobileApp =
        userAgent.includes('KIKO/') ||           // Custom app identifier
        origin === 'capacitor://localhost' ||    // iOS Capacitor
        origin === 'http://localhost' ||         // iOS WebView
        userAgent.includes('Capacitor');         // Capacitor UA

    if (isMobileApp) {
        console.log('[originRestriction] Mobile app detected, allowing request');
        return;
    }

    // Some browsers/privacy settings can omit Origin/Referer on navigation-related fetches.
    // Keep CSRF posture by only allowing this fallback for same-site browser signals
    // or authenticated first-party API calls.
    if (!effectiveOrigin) {
        const sameSiteSignal = secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none';
        const hasBearer = authHeader.startsWith('bearer ');
        if (sameSiteSignal || hasBearer) {
            console.log('[originRestriction] Missing origin/referer accepted by safe fallback', {
                secFetchSite: secFetchSite || 'none',
                hasBearer
            });
            return;
        }
    }

    // [Logic]: Check if origin is in allowed list
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
        if (allowed.endsWith('*')) {
            // Wildcard matching: https://*.kiko.app
            const prefix = allowed.slice(0, -1);
            return effectiveOrigin.startsWith(prefix);
        }
        return effectiveOrigin === allowed;
    });

    if (!isAllowed) {
        // [Logic]: Log details for debugging mobile issues
        console.warn('[originRestriction] Request blocked', {
            origin,
            referer,
            effectiveOrigin,
            userAgent: userAgent.substring(0, 100),
            allowedOrigins: ALLOWED_ORIGINS.slice(0, 5),
        });

        // Keep local development working, but never turn "development mode"
        // into a remote-access bypass on a shared host.
        if (!isProduction && isLoopbackAddress(request.ip)) {
            console.warn('[originRestriction] DEV MODE: Allowing local loopback request despite origin mismatch');
            return;
        }

        throw new AppError(403, 'Request origin not allowed', 'ORIGIN_NOT_ALLOWED');
    }
}
