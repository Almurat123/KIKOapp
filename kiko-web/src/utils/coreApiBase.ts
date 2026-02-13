import { getRuntimeConfigUrl, getEnvUrl } from './runtimeConfig';

export function resolveCoreApiBase(): string {
    const explicit = getRuntimeConfigUrl('API_URL') || getEnvUrl('VITE_API_URL');
    if (explicit) {
        try {
            new URL(explicit);
            return explicit;
        } catch {
            console.warn('[coreApi] Invalid API_URL, fallback to default:', explicit);
        }
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        const host = window.location.hostname.toLowerCase();
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (isLocal) {
            return window.location.origin.replace(/\/+$/, '');
        }
    }

    return 'http://localhost:3001';
}
