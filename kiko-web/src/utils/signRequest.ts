/**
 * Request Signing Utility
 * Generates HMAC-SHA256 signatures for API requests
 */

/**
 * Generate SHA-256 hash of a string
 * [Logic]: Uses Web Crypto API for browser compatibility
 * [Ref]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 * [Risk]: Requires modern browser with crypto.subtle support
 */
async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign an API request with HMAC-SHA256
 * [Logic]: Signature = HMAC-SHA256(timestamp.method.url.bodyHash, secret)
 * [Ref]: Matches backend verification in requestSigning.ts
 * [Risk]: Secret exposed in frontend bundle (can be extracted)
 */
export async function signRequest(
    method: string,
    url: string,
    body?: object
): Promise<{ 'X-Timestamp': string; 'X-Signature': string }> {
    const timestamp = Date.now().toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const bodyHash = await sha256(bodyStr);
    const payload = `${timestamp}.${method}.${url}.${bodyHash}`;

    // [Logic]: Import secret key for HMAC signing
    // [Ref]: Web Crypto API HMAC pattern
    // [Risk]: VITE_SIGNING_SECRET must be set in environment
    const secret = import.meta.env.VITE_SIGNING_SECRET;
    if (!secret) {
        console.warn('[signRequest] VITE_SIGNING_SECRET not set, request will fail signature verification');
        return { 'X-Timestamp': timestamp, 'X-Signature': '' };
    }

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // [Logic]: Generate HMAC signature
    // [Risk]: Signature computation failure will throw error
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const signature = Array.from(new Uint8Array(sigBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return {
        'X-Timestamp': timestamp,
        'X-Signature': signature,
    };
}
