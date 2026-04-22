/**
 * Authentication middleware using Privy JWT
 * Validates Bearer token against Privy JWKS
 */

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Almurat
// Reason: authenticated requests now need a server-owned fallback that can
//         persist verified Privy X linkage even when the frontend-side sync
//         effect does not run or silently fails. Farcaster now follows the
//         same server-verified repair path.
// Goal: keep token verification authoritative while allowing the backend to
//       opportunistically repair authenticated user linkage state.
// Owns: Bearer token verification, end-user/service auth gates, and best-effort
//       post-auth hydration of verified social identity.
// Does Not Own: social identity verification rules, X bot OAuth, or webhook ingress.
// Design Language:
// - Authentication must not depend on frontend side effects for persisted identity.
// - Best-effort linkage repair must never block auth success on non-critical errors.
// - Service-key auth must remain isolated from end-user identity hydration.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-user-auto-sync.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-farcaster-verified-identity-sync.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { AppError } from './errorHandler.js';
import { resolvePrivyServerConfig } from '../config/privy.js';
import { maybeAutoSyncVerifiedPrivyFarcasterUser } from '../services/farcaster-agent/farcasterIdentityService.js';
import { maybeAutoSyncVerifiedPrivyXUser } from '../services/x/xIdentityService.js';
import prisma from '../db/prisma.js';

const PRIVY_JWKS_URL = process.env.PRIVY_JWKS_URL || '';
const { appId: PRIVY_APP_ID } = resolvePrivyServerConfig();
const NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase();
const RAILWAY_ENVIRONMENT = String(process.env.RAILWAY_ENVIRONMENT || '').toLowerCase();
const APP_ENV = String(process.env.APP_ENV || '').toLowerCase();
const isLocalDev =
  NODE_ENV === 'development' ||
  NODE_ENV === 'dev' ||
  NODE_ENV === 'test' ||
  APP_ENV === 'local' ||
  RAILWAY_ENVIRONMENT === 'development';
const ALLOW_DEV_AUTH_BYPASS = process.env.ALLOW_DEV_AUTH_BYPASS === 'true' && isLocalDev;
const PRIVY_SKIP_VERIFY = process.env.PRIVY_SKIP_VERIFY === 'true' && ALLOW_DEV_AUTH_BYPASS;

// Only create JWKS fetcher if URL is provided
const jwks = PRIVY_JWKS_URL ? createRemoteJWKSet(new URL(PRIVY_JWKS_URL)) : null;

/**
 * Verify Privy JWT token
 * Exported for use in WebSocket and other contexts
 */
export async function verifyPrivyToken(token: string) {
  // Dev escape hatch: skip signature verification if explicitly enabled
  if (PRIVY_SKIP_VERIFY) {
    const payload = decodeJwt(token);
    // Still check expiration even in dev mode
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new AppError(401, 'Token expired', 'TOKEN_EXPIRED');
    }
    console.warn('[auth] PRIVY_SKIP_VERIFY=true, accepting token without signature check');
    return payload;
  }

  if (!jwks) {
    throw new AppError(
      503,
      'Privy JWKS URL not configured (set PRIVY_JWKS_URL) and signature verification is required',
      'PRIVY_JWKS_MISSING'
    );
  }

  try {
    // End-to-End Hardening: Enforce issuer and audience (App ID)
    const { payload } = await jwtVerify(token, jwks, {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID || undefined, // Allow any if not set, but enforce if it is
    });

    // Double-check expiration (should be validated by jwtVerify but being explicit)
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new AppError(401, 'Token expired', 'TOKEN_EXPIRED');
    }

    return payload;
  } catch (error: any) {
    // If it's already an AppError, rethrow
    if (error instanceof AppError) throw error;

    const msg = error?.message || '';
    const isJwksFetchError =
      msg.includes('JSON Web Key Set') ||
      msg.includes('fetch') ||
      msg.includes('Expected 200 OK') ||
      msg.includes('failed to fetch');

    if (isJwksFetchError) {
      throw new AppError(
        503,
        'Privy JWKS fetch failed; please verify PRIVY_JWKS_URL or enable PRIVY_SKIP_VERIFY only for local development',
        'PRIVY_JWKS_UNAVAILABLE'
      );
    }

    // Check for expiration error from jose
    if (msg.includes('expired') || msg.includes('exp')) {
      throw new AppError(401, 'Token expired', 'TOKEN_EXPIRED');
    }

    throw new AppError(401, `Invalid Privy token: ${msg || 'unauthorized'}`, 'UNAUTHORIZED');
  }
}

/**
 * Fastify preHandler to require Privy auth
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  // DEV ONLY: TEST_MODE bypass for automated testing
  // Strictly disabled unless local dev + explicit opt-in
  const TEST_MODE = process.env.TEST_MODE === 'true' && ALLOW_DEV_AUTH_BYPASS;
  if (TEST_MODE) {
    console.warn('[auth] TEST_MODE=true, using mock user for testing');
    (request as any).user = {
      sub: 'test-user-123',
      iat: Math.floor(Date.now() / 1000),
      iss: 'privy.io',
      aud: 'test'
    };
    return;
  }

  // Check for internal service key (Server-to-Server Auth)
  // Accept both legacy and current header names for compatibility.
  const serviceKey =
    (request.headers['x-internal-service-key'] as string) ||
    (request.headers['x-service-key'] as string) ||
    '';
  const internalKey = process.env.INTERNAL_SERVICE_KEY;
  if (internalKey && serviceKey === internalKey) {
    // Grant access as system service
    (request as any).user = {
      sub: 'system-service',
      role: 'service',
      permissions: ['*']
    };
    return;
  }

  const auth = request.headers.authorization || '';
  const token = auth.toLowerCase().startsWith('bearer ')
    ? auth.substring(7).trim()
    : auth.trim();

  if (!token) {
    console.warn('[auth] Missing Authorization Bearer token', {
      url: request.url,
      method: request.method,
      ip: request.ip,
      origin: request.headers.origin || 'none',
      referer: request.headers.referer || 'none',
      userAgent: (request.headers['user-agent'] || '').toString().substring(0, 120),
    });
    throw new AppError(401, 'Missing Authorization Bearer token', 'UNAUTHORIZED');
  }

  // Attach decoded payload for downstream use if needed
  (request as any).user = await verifyPrivyToken(token);
  const endUserId = String((request as any).user?.sub || '').trim();
  if (endUserId && (request as any).user?.role !== 'service') {
    await maybeAutoSyncVerifiedPrivyXUser(endUserId).catch(() => undefined);
    await maybeAutoSyncVerifiedPrivyFarcasterUser(endUserId).catch(() => undefined);
  }

  // Log successful authentication (only in dev or for debugging)
  if (process.env.AUTH_DEBUG === 'true') {
    console.log('[auth] ✅ Authenticated:', {
      sub: (request as any).user.sub?.substring(0, 25) + '...',
      exp: (request as any).user.exp
    });
  }
}

/**
 * Route guard for endpoints that must be called by end-users only.
 * Rejects service-key authenticated requests.
 */
export async function requireEndUserAuth(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  const user = (request as any).user;
  if (user?.role === 'service' || user?.sub === 'system-service') {
    console.warn('COPYTRADE_SERVICE_AUTH_BLOCKED', {
      url: request.url,
      method: request.method,
      ip: request.ip,
    });
    throw new AppError(403, 'Service authentication is not allowed for this endpoint', 'END_USER_AUTH_REQUIRED');
  }
}

export async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply) {
  await requireEndUserAuth(request, reply);
  const userId = String((request as any).user?.sub || '').trim();
  if (!userId) {
    throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  const user = await prisma.user.findUnique({
    where: { privyDid: userId },
    select: {
      id: true,
      privyDid: true,
      role: true,
      walletAddress: true,
    },
  });

  if (!user || user.role !== 'admin') {
    throw new AppError(403, 'Admin access required', 'ADMIN_REQUIRED');
  }

  (request as any).authUserRecord = user;
}

export async function canManageRefunds(userId: string | null | undefined): Promise<boolean> {
  const normalized = String(userId || '').trim();
  if (!normalized) return false;
  const user = await prisma.user.findUnique({
    where: { privyDid: normalized },
    select: { role: true },
  });
  return user?.role === 'admin';
}

/**
 * Helper function to extract userId from authenticated request
 * Use this instead of directly accessing request.user.sub
 */
export function getUserId(request: FastifyRequest): string | null {
  const user = (request as any).user;
  if (!user) {
    console.warn('[auth] getUserId called on unauthenticated request');
    return null;
  }
  return user.sub || user.id || null;
}

/**
 * Type definition for authenticated request user
 */
export interface AuthenticatedUser {
  sub: string;           // Privy DID (e.g., "did:privy:xxx")
  iat: number;           // Issued at timestamp
  exp: number;           // Expiration timestamp
  iss: string;           // Issuer (e.g., "privy.io")
  aud: string;           // Audience (App ID)
  sid?: string;          // Session ID
  role?: string;         // For service accounts
  permissions?: string[]; // For service accounts
}
