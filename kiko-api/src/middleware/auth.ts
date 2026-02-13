/**
 * Authentication middleware using Privy JWT
 * Validates Bearer token against Privy JWKS
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { AppError } from './errorHandler.js';

const PRIVY_JWKS_URL = process.env.PRIVY_JWKS_URL || '';
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || '';
const isProduction = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod');
const PRIVY_SKIP_VERIFY = process.env.PRIVY_SKIP_VERIFY === 'true' && !isProduction;

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
  // Strictly disabled in production
  const isProduction = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod');
  const TEST_MODE = process.env.TEST_MODE === 'true' && !isProduction;
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

  // Log successful authentication (only in dev or for debugging)
  if (process.env.AUTH_DEBUG === 'true') {
    console.log('[auth] ✅ Authenticated:', {
      sub: (request as any).user.sub?.substring(0, 25) + '...',
      exp: (request as any).user.exp
    });
  }
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
