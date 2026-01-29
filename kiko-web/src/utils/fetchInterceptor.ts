/**
 * Global Fetch Interceptor
 * Automatically adds X-App-Key header to all API requests
 * And optionally adds HMAC signature for sensitive endpoints
 */

const originalFetch = window.fetch;
const API_HOST = import.meta.env.VITE_API_URL || '';
const APP_KEY = import.meta.env.VITE_APP_KEY || '';
const SIGNING_SECRET = import.meta.env.VITE_SIGNING_SECRET || '';

// DEBUG: Log all VITE_ environment variables at startup
console.log('[FetchInterceptor DEBUG] Environment check:', {
    VITE_APP_KEY: import.meta.env.VITE_APP_KEY ? 'SET' : 'MISSING',
    VITE_APP_KEY_value: APP_KEY ? APP_KEY.substring(0, 10) + '...' : 'empty',
    VITE_API_URL: import.meta.env.VITE_API_URL || 'NOT_SET',
    VITE_SIGNING_SECRET: import.meta.env.VITE_SIGNING_SECRET ? 'SET' : 'MISSING',
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    allEnvKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
});

// Sensitive endpoints that require HMAC signature
const SENSITIVE_ENDPOINTS = ['/api/swap/', '/api/trade/', '/api/wallet/'];

/**
 * Generate HMAC-SHA256 signature for request
 */
async function generateSignature(timestamp: number, method: string, path: string, body?: string): Promise<string> {
    if (!SIGNING_SECRET) return '';

    const encoder = new TextEncoder();
    const bodyHash = body
        ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(body))))
            .map(b => b.toString(16).padStart(2, '0')).join('')
        : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // Empty string SHA-256

    const payload = `${timestamp}.${method}.${path}.${bodyHash}`;
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(SIGNING_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only add App Key to our API requests
    const isOurApi = url.includes('/api/') && (
        url.startsWith('/api/') ||
        url.startsWith(API_HOST) ||
        url.includes('kiko-api') ||
        url.includes('railway.app')
    );

    if (isOurApi && APP_KEY) {
        const headers = new Headers(init?.headers);
        if (!headers.has('X-App-Key')) {
            headers.set('X-App-Key', APP_KEY);
        }

        // Add signature for sensitive endpoints
        const isSensitive = SENSITIVE_ENDPOINTS.some(ep => url.includes(ep));
        if (isSensitive && SIGNING_SECRET) {
            try {
                const timestamp = Date.now();
                const method = init?.method || 'GET';
                // Use pathname + search to match backend's request.url
                const urlObj = new URL(url, window.location.origin);
                const path = urlObj.pathname + urlObj.search;
                const body = init?.body as string | undefined;
                const signature = await generateSignature(timestamp, method, path, body);

                headers.set('X-Timestamp', timestamp.toString());
                headers.set('X-Signature', signature);
            } catch (err) {
                console.warn('[FetchInterceptor] Failed to sign request:', err);
            }
        }

        return originalFetch(input, { ...init, headers });
    } else if (isOurApi && !APP_KEY) {
        // DEBUG: Log when APP_KEY is missing for our API
        console.error('[FetchInterceptor] ❌ APP_KEY missing! API request will fail:', url);
    }

    return originalFetch(input, init);
};

console.log('[FetchInterceptor] Initialized with App Key:', APP_KEY ? 'present' : 'MISSING ❌',
    '| Signing:', SIGNING_SECRET ? 'enabled' : 'disabled');
