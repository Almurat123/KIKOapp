/**
 * Authentication middleware using Privy JWT
 * Validates Bearer token against Privy JWKS
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { AppError } from './errorHandler.js';

const PRIVY_JWKS_URL = process.env.PRIVY_JWKS_URL || '';
const PRIVY_SKIP_VERIFY = process.env.PRIVY_SKIP_VERIFY === 'true';

// Only create JWKS fetcher if URL is provided
const jwks = PRIVY_JWKS_URL ? createRemoteJWKSet(new URL(PRIVY_JWKS_URL)) : null;

async function verifyPrivyToken(token: string) {
  // Dev escape hatch: skip signature verification if explicitly enabled
  if (PRIVY_SKIP_VERIFY) {
    const payload = decodeJwt(token);
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
    // Do not enforce audience to avoid false negatives; signature + JWKS is sufficient
    const { payload } = await jwtVerify(token, jwks);
    return payload;
  } catch (error: any) {
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

    throw new AppError(401, `Invalid Privy token: ${msg || 'unauthorized'}`, 'UNAUTHORIZED');
  }
}

/**
 * Fastify preHandler to require Privy auth
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  // DEV ONLY: TEST_MODE bypass for automated testing
  const TEST_MODE = process.env.TEST_MODE === 'true';
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

  const auth = request.headers.authorization || '';
  const token = auth.toLowerCase().startsWith('bearer ')
    ? auth.substring(7).trim()
    : auth.trim();

  if (!token) {
    throw new AppError(401, 'Missing Authorization Bearer token', 'UNAUTHORIZED');
  }

  // Attach decoded payload for downstream use if needed
  (request as any).user = await verifyPrivyToken(token);
}


