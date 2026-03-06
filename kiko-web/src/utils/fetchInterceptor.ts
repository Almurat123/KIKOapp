/**
 * Global Fetch Interceptor
 * Preserves a single interception point for future request metadata.
 * Security-sensitive credentials must not be injected from the browser.
 */

const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return originalFetch(input, init);
};
