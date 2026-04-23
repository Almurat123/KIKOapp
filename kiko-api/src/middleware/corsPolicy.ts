import { env } from '../config/env.js';

function firstHeaderValue(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return (value[0] || '').trim();
    return (value || '').trim();
}

export function getConfiguredCorsOrigins(): string[] {
    return env.corsOrigin
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
}

export function isAllowedCorsOrigin(origin?: string): boolean {
    if (!origin) {
        return true;
    }

    const normalized = origin.replace(/\/+$/, '');
    const configured = new Set(getConfiguredCorsOrigins());
    if (configured.has(normalized)) {
        return true;
    }

    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase();
        if (host === 'kikoapp.app' || host.endsWith('.kikoapp.app')) {
            return true;
        }
        if (env.nodeEnv !== 'production' && (host === 'localhost' || host === '127.0.0.1')) {
            return true;
        }
    } catch {
        return false;
    }

    return false;
}

export function applyCorsResponseHeaders(
    request: { headers?: Record<string, string | string[] | undefined> },
    reply: {
        getHeader?: (name: string) => unknown;
        header: (name: string, value: string) => unknown;
    }
): void {
    const origin = firstHeaderValue(request.headers?.origin);
    if (!origin || !isAllowedCorsOrigin(origin)) {
        return;
    }

    if (!reply.getHeader?.('Access-Control-Allow-Origin')) {
        reply.header('Access-Control-Allow-Origin', origin);
    }
    if (!reply.getHeader?.('Access-Control-Allow-Credentials')) {
        reply.header('Access-Control-Allow-Credentials', 'true');
    }

    const varyHeader = reply.getHeader?.('Vary');
    const varyValue = Array.isArray(varyHeader)
        ? varyHeader.join(', ')
        : typeof varyHeader === 'string'
            ? varyHeader
            : '';
    const varyParts = varyValue
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    if (!varyParts.includes('Origin')) {
        varyParts.push('Origin');
        reply.header('Vary', varyParts.join(', '));
    }
}
