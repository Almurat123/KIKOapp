type GeoResult = {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: GeoResult }>();

function isPrivateIp(ip: string): boolean {
    return (
        ip.startsWith('10.') ||
        ip.startsWith('127.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('::1') ||
        ip.startsWith('fc') ||
        ip.startsWith('fd') ||
        (ip.startsWith('172.') && (() => {
            const parts = ip.split('.');
            const second = Number(parts[1] || 0);
            return second >= 16 && second <= 31;
        })())
    );
}

export async function resolveGeoFromIp(ip?: string | null): Promise<GeoResult> {
    if (!ip) return {};
    const cleanIp = ip.split(',')[0].trim();
    if (!cleanIp || isPrivateIp(cleanIp)) return {};

    const cached = cache.get(cleanIp);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.data;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
        const res = await fetch(`https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) return {};
        const data = await res.json() as any;
        const result: GeoResult = {
            country: data.country || undefined,
            region: data.region || undefined,
            city: data.city || undefined,
            timezone: data.timezone || undefined,
        };
        cache.set(cleanIp, { at: Date.now(), data: result });
        return result;
    } catch {
        return {};
    } finally {
        clearTimeout(timeout);
    }
}
