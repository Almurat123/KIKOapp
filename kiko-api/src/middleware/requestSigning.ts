/**
 * Request Signing Middleware
 * Validates HMAC-SHA256 signatures to prevent request tampering
 */

import crypto from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errorHandler.js';

// [Logic]: Load signing secret from environment
// [Ref]: Security configuration pattern from env.ts
// [Risk]: Empty secret will disable signature verification
const SIGNING_SECRET = process.env.REQUEST_SIGNING_SECRET || '';
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify HMAC signature on incoming requests
 * [Logic]: Signature = HMAC-SHA256(timestamp.method.path.bodyHash, secret)
 * [Ref]: Standard HMAC request signing pattern
 * [Risk]: Replay attacks possible within 5-minute window
 */
export async function verifyRequestSignature(request: FastifyRequest, _reply: FastifyReply) {
    // [Logic]: Skip if signing not configured (optional feature)
    // [Risk]: Silent bypass if secret not set
    if (!SIGNING_SECRET) {
        console.warn('[requestSigning] REQUEST_SIGNING_SECRET not set, skipping signature verification');
        return;
    }

    const timestamp = request.headers['x-timestamp'] as string;
    const signature = request.headers['x-signature'] as string;

    // [Logic]: Require both timestamp and signature headers
    // [Risk]: Missing headers indicate unsigned request
    if (!timestamp || !signature) {
        throw new AppError(401, 'Missing signature headers (X-Timestamp, X-Signature)', 'MISSING_SIGNATURE');
    }

    // [Logic]: Prevent replay attacks by checking timestamp freshness
    // [Ref]: Standard anti-replay mechanism
    // [Risk]: Clock skew between client/server may cause false rejections
    const reqTime = parseInt(timestamp, 10);
    if (isNaN(reqTime) || Math.abs(Date.now() - reqTime) > MAX_TIMESTAMP_DRIFT_MS) {
        throw new AppError(401, 'Request timestamp expired or invalid', 'EXPIRED_TIMESTAMP');
    }

    // [Logic]: Compute expected signature from request components
    // [Ref]: HMAC-SHA256 standard
    // [Risk]: Body must be exactly as sent (whitespace matters)
    const body = request.body ? JSON.stringify(request.body) : '';
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
    const payload = `${timestamp}.${request.method}.${request.url}.${bodyHash}`;
    const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');

    // [Logic]: Constant-time comparison to prevent timing attacks
    // [Ref]: crypto.timingSafeEqual prevents timing side-channel
    // [Risk]: Buffer length mismatch will throw error
    try {
        const sigBuffer = Buffer.from(signature, 'hex');
        const expBuffer = Buffer.from(expected, 'hex');

        if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
            throw new AppError(401, 'Invalid request signature', 'INVALID_SIGNATURE');
        }
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(401, 'Malformed signature format', 'INVALID_SIGNATURE_FORMAT');
    }
}
