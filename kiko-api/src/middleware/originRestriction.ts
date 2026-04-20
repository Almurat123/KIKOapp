/**
 * Origin Restriction Middleware
 * Validates request Origin/Referer headers to ensure requests come from allowed domains
 */

// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: browser API calls need Origin/Referer enforcement, but public media
//         proxy routes must remain fetchable by social crawlers that do not
//         send first-party browser headers. A 2026-04-20 Farcaster trace showed
//         `TwitterBot`, `probe-image-size`, and Node crawlers receiving 403
//         from this middleware when fetching a generated-image `.png`, causing
//         Farcaster to render an OGP/link card instead of the direct image.
// Goal: keep browser/API CSRF-style origin enforcement intact while allowing
//       explicitly public generated-image media routes to behave like public
//       static assets.
// Owns: request Origin/Referer validation and narrow public media exceptions.
// Does Not Own: route-level auth, object-key validation, or generated-image
//               storage prefix safety.
// Design Language:
// - public generated-image route bypass must stay path-scoped and read-only
// - object-key allowlisting remains owned by chat image storage/route code
// - do not relax origin enforcement for authenticated chat, wallet, or trade APIs
// - forbidden local patch pattern: user-agent allowlists for social crawlers
// Document Provenance:
// - Source: /Users/almurat/Downloads/logs.1776665425918.json
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: bypassing origin checks only for public generated-image media
//   proxy fetches that social crawlers request without Origin/Referer headers
// - Verification: verified in runtime log and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-public-proxy-and-task-hydration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-public-image-origin-and-message-preservation.md

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

function firstHeaderValue(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return (value[0] || '').trim();
    return (value || '').trim();
}

function isAllowedOriginValue(candidateOrigin: string): boolean {
    return ALLOWED_ORIGINS.some(allowed => {
        if (allowed.endsWith('*')) {
            const prefix = allowed.slice(0, -1);
            return candidateOrigin.startsWith(prefix);
        }
        return candidateOrigin === allowed;
    });
}

function deriveAllowedOriginFromForwardedHost(request: FastifyRequest): string {
    const forwardedHost = firstHeaderValue(request.headers['x-forwarded-host'] as string | string[] | undefined).split(',')[0]?.trim().toLowerCase() || '';
    const host = firstHeaderValue(request.headers.host as string | string[] | undefined).split(',')[0]?.trim().toLowerCase() || '';
    const forwardedProto = firstHeaderValue(request.headers['x-forwarded-proto'] as string | string[] | undefined).split(',')[0]?.trim().toLowerCase() || '';
    const candidates = [forwardedHost, host].filter(Boolean);
    const browserLike =
        !!firstHeaderValue(request.headers['sec-ch-ua'] as string | string[] | undefined)
        || !!firstHeaderValue(request.headers['sec-fetch-mode'] as string | string[] | undefined)
        || ((request.headers['user-agent'] as string) || '').includes('Mozilla/');

    if (!browserLike) return '';

    for (const candidateHost of candidates) {
        const protos = forwardedProto ? [forwardedProto] : ['https', 'http'];
        for (const proto of protos) {
            const candidateOrigin = `${proto}://${candidateHost}`;
            if (isAllowedOriginValue(candidateOrigin)) {
                return candidateOrigin;
            }
        }
    }

    return '';
}

function isLoopbackAddress(ip: string | undefined): boolean {
    if (!ip) return false;
    const normalized = ip.replace(/^::ffff:/, '');
    return normalized === '127.0.0.1' || normalized === '::1';
}

export function isPublicGeneratedImageProxyRequest(request: Pick<FastifyRequest, 'method' | 'url'>): boolean {
    const method = String(request.method || '').trim().toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        return false;
    }
    return String(request.url || '').startsWith('/api/chat/generated-images/public/');
}

/**
 * Validate request origin
 * [Logic]: Checks Origin or Referer header against whitelist
 * [Risk]: Mobile apps may not send Origin header
 */
export async function requireAllowedOrigin(request: FastifyRequest, _reply: FastifyReply) {
    if (isPublicGeneratedImageProxyRequest(request)) {
        return;
    }

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

    const origin = firstHeaderValue(request.headers.origin as string | string[] | undefined);
    const referer = firstHeaderValue(request.headers.referer as string | string[] | undefined);
    const userAgent = firstHeaderValue(request.headers['user-agent'] as string | string[] | undefined);
    const secFetchSite = firstHeaderValue(request.headers['sec-fetch-site'] as string | string[] | undefined).toLowerCase();
    const authHeader = firstHeaderValue(request.headers.authorization as string | string[] | undefined).toLowerCase();

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

    // Some first-party browser requests can arrive without Origin/Referer after
    // CDN / privacy-layer normalization. Fall back to the forwarded host only if
    // it resolves to one of our explicitly allowed browser origins.
    if (!effectiveOrigin) {
        const derivedOrigin = deriveAllowedOriginFromForwardedHost(request);
        if (derivedOrigin) {
            effectiveOrigin = derivedOrigin;
            console.log('[originRestriction] Missing origin/referer accepted by forwarded host fallback', {
                effectiveOrigin,
                host: firstHeaderValue(request.headers.host as string | string[] | undefined),
                forwardedHost: firstHeaderValue(request.headers['x-forwarded-host'] as string | string[] | undefined),
                forwardedProto: firstHeaderValue(request.headers['x-forwarded-proto'] as string | string[] | undefined),
            });
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
    const isAllowed = isAllowedOriginValue(effectiveOrigin);

    if (!isAllowed) {
        // [Logic]: Log details for debugging mobile issues
        console.warn('[originRestriction] Request blocked', {
            origin,
            referer,
            effectiveOrigin,
            host: firstHeaderValue(request.headers.host as string | string[] | undefined),
            forwardedHost: firstHeaderValue(request.headers['x-forwarded-host'] as string | string[] | undefined),
            forwardedProto: firstHeaderValue(request.headers['x-forwarded-proto'] as string | string[] | undefined),
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
