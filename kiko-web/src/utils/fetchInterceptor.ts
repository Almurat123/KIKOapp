/**
 * Global Fetch Interceptor
 * Automatically adds X-App-Key header to all API requests
 * No client-side signing: secrets must never be shipped to browsers.
 */

const originalFetch = window.fetch;
const API_HOST = import.meta.env.VITE_API_URL || '';
const APP_KEY = import.meta.env.VITE_APP_KEY || '';

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

        return originalFetch(input, { ...init, headers });
    }

    return originalFetch(input, init);
};

console.log('[FetchInterceptor] Ready:', APP_KEY ? '✓' : '✗ KEY MISSING');
