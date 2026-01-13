const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * 敏感词脱敏处理
 */
const SENSITIVE_KEYS = ['api', 'key', 'secret', 'token', 'auth', 'password', 'jwt', 'private'];

const MAX_DEPTH = 8;
export function redact(data: any, visited = new WeakSet(), depth = 0): any {
    if (data === null || data === undefined) return data;
    if (depth > MAX_DEPTH) return '[Max Depth Exceeded]';

    if (typeof data === 'string') {
        let redacted = data;
        redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9\-_.]+/gi, 'Bearer [REDACTED]');
        // Redact potential API keys in URLs
        redacted = redacted.replace(/([?&](?:apiKey|token|key|auth)=)([^&]+)/gi, '$1[REDACTED]');
        return redacted;
    }

    if (typeof data === 'object') {
        if (visited.has(data)) return '[Circular]';
        visited.add(data);
    }

    if (Array.isArray(data)) return data.map(item => redact(item, visited, depth + 1));

    if (typeof data === 'object') {
        // Handle Error objects specifically
        if (data instanceof Error) {
            return {
                message: redact(data.message, visited, depth + 1),
                name: data.name,
                stack: redact(data.stack, visited, depth + 1),
                ...redact({ ...data }, visited, depth + 1)
            };
        }

        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
                result[key] = '[REDACTED]';
            } else {
                result[key] = redact(value, visited, depth + 1);
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
            console.log(...args.map(a => redact(a)));
        }
    },
    warn: (...args: any[]) => {
        console.warn(...args.map(a => redact(a)));
    },
    error: (...args: any[]) => {
        // Errors are always logged, but must be redacted
        console.error(...args.map(a => redact(a)));
    },
    debug: (...args: any[]) => {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args.map(a => redact(a)));
        }
    },
    swap: (type: string, data: any) => {
        if (isDevelopment) {
            console.log(`[SWAP:${type.toUpperCase()}]`, redact(data));
        }
    },
    intent: (...args: any[]) => {
        if (isDevelopment) {
            console.log('[INTENT]', ...args.map(a => redact(a)));
        }
    },
    ai: (...args: any[]) => {
        if (isDevelopment) {
            console.log('[AI]', ...args.map(a => redact(a)));
        }
    }
};
