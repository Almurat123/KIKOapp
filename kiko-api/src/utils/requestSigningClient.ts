/**
 * Request signing helper for internal API calls (server -> server).
 * Mirrors middleware verification in middleware/requestSigning.ts
 */

import crypto from 'crypto';

export function buildSignedHeaders(
    method: string,
    path: string,
    body?: string,
    secret: string = process.env.REQUEST_SIGNING_SECRET || ''
): Record<string, string> {
    if (!secret) return {};

    const timestamp = Date.now().toString();
    const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex');
    const payload = `${timestamp}.${method}.${path}.${bodyHash}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return {
        'X-Timestamp': timestamp,
        'X-Signature': signature
    };
}
