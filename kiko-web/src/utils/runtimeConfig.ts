export type KikoRuntimeConfig = {
    CHAT_API_URL?: string;
    CHAT_WS_URL?: string;
    API_URL?: string;
};

declare global {
    interface Window {
        __KIKO_RUNTIME_CONFIG__?: KikoRuntimeConfig;
    }
}

function sanitize(raw: string | undefined): string {
    return (raw || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
}

export function getRuntimeConfigUrl(key: keyof KikoRuntimeConfig): string {
    if (typeof window === 'undefined') return '';
    return sanitize(window.__KIKO_RUNTIME_CONFIG__?.[key]);
}

export function getEnvUrl(key: 'VITE_CHAT_API_URL' | 'VITE_CHAT_WS_URL' | 'VITE_API_URL' | 'VITE_WS_URL'): string {
    return sanitize(import.meta.env[key]);
}

