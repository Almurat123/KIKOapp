/**
 * Sanitizer Utility
 * Provides functions to redact sensitive information from logs, objects, and strings.
 */

const SENSITIVE_KEYS = [
    'api',
    'key',
    'apikey',
    'api_key',
    'secret',
    'token',
    'auth',
    'authorization',
    'bearer',
    'password',
    'pwd',
    'jwt',
    'database',
    'db_url',
    'jwks',
    'private',
    'mnemonic',
    'seed',
];

const URL_SENSITIVE_PARAMS = [
    'api_key',
    'apiKey',
    'key',
    'token',
    'auth',
    'access_token',
];

/**
 * Redacts sensitive information from a string or object.
 * Recursively scans objects and arrays.
 */
export function redact(data: any): any {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'string') {
        return redactString(data);
    }

    if (Array.isArray(data)) {
        return data.map(item => redact(item));
    }

    if (typeof data === 'object') {
        const redactedObj: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();

            // If the key itself is sensitive, redact its value immediately
            if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
                redactedObj[key] = '[REDACTED]';
            } else {
                // Otherwise, recursively redact the value
                redactedObj[key] = redact(value);
            }
        }
        return redactedObj;
    }

    return data;
}

/**
 * Redacts sensitive patterns within a string using regex.
 */
function redactString(str: string): string {
    let redacted = str;

    // 1. Redact Bearer tokens in headers or strings
    redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9\-_.]+/gi, 'Bearer [REDACTED]');

    // 2. Redact potential API keys/secrets in URL-like patterns
    // Pattern: key=VALUE or apiKey=VALUE
    URL_SENSITIVE_PARAMS.forEach(param => {
        const regex = new RegExp(`(${param}=)([^&\\s]+)`, 'gi');
        redacted = redacted.replace(regex, '$1[REDACTED]');
    });

    // 3. Redact common API key patterns (hex or base64 looking long strings after a key identifier)
    // This is a bit aggressive but safer for logs
    // redacted = redacted.replace(/(key["']?\s*[:=]\s*["'])([a-zA-Z0-9\-_]{20,})/gi, '$1[REDACTED]');

    return redacted;
}

/**
 * Redacts sensitive query parameters from a URL string.
 */
export function redactUrl(url: string): string {
    try {
        if (!url.includes('?') && !url.includes('=')) return url;

        // Simple regex-based redaction for speed in hooks
        let sanitized = url;
        URL_SENSITIVE_PARAMS.forEach(param => {
            const regex = new RegExp(`([?&]${param}=)([^&\\s]+)`, 'gi');
            sanitized = sanitized.replace(regex, '$1[REDACTED]');
        });

        return sanitized;
    } catch (e) {
        return '[INVALID_URL]';
    }
}
