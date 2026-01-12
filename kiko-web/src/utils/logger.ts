const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * 敏感词脱敏处理
 */
const SENSITIVE_KEYS = ['api', 'key', 'secret', 'token', 'auth', 'password', 'jwt', 'private'];

export function redact(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
        let redacted = data;
        redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9\-_.]+/gi, 'Bearer [REDACTED]');
        // Redact potential API keys in URLs
        redacted = redacted.replace(/([?&](?:apiKey|token|key|auth)=)([^&]+)/gi, '$1[REDACTED]');
        return redacted;
    }
    if (Array.isArray(data)) return data.map(redact);
    if (typeof data === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
                result[key] = '[REDACTED]';
            } else {
                result[key] = redact(value);
            }
        }
        return result;
    }
    return data;
}

export interface Logger {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    swap: (type: string, data: any) => void;
    intent: (...args: any[]) => void;
    ai: (...args: any[]) => void;
}

export const logger: Logger = {
    log: (...args: any[]) => {
        if (isDevelopment) {
            console.log(...args.map(redact));
        }
    },
    warn: (...args: any[]) => {
        console.warn(...args.map(redact));
    },
    error: (...args: any[]) => {
        // Errors are always logged, but must be redacted
        console.error(...args.map(redact));
    },
    debug: (...args: any[]) => {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args.map(redact));
        }
    },
    swap: (type: string, data: any) => {
        if (isDevelopment) {
            console.log(`[SWAP:${type.toUpperCase()}]`, redact(data));
        }
    },
    intent: (...args: any[]) => {
        if (isDevelopment) {
            console.log('[INTENT]', ...args.map(redact));
        }
    },
    ai: (...args: any[]) => {
        if (isDevelopment) {
            console.log('[AI]', ...args.map(redact));
        }
    }
};
