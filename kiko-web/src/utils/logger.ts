// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Almurat
// Reason: Frontend regression tests import shared helpers in a Node runtime
//         where Vite's `import.meta.env` object is absent. The logger must not
//         crash on import just because the build-time env shim is missing.
// Goal: keep browser logging behavior unchanged while making Node/test imports
//       safe and silent outside Vite.
// Owns: env-safe logger initialization and redacted console output.
// Does Not Own: caller-side test setup or feature flags.
// Design Language:
// - treat missing Vite env as non-development
// - never throw during logger import
// - preserve redaction behavior regardless of runtime
// Document Provenance:
// - Source: local Node test crash when importing chat model persistence helper
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: safe `import.meta.env` access in logger init
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-chat-model-family-control-memory.md
const isDevelopment = import.meta.env?.DEV || import.meta.env?.MODE === 'development';

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
