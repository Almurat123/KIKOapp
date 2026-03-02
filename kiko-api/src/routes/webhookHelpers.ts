import crypto from 'node:crypto';

export function logWebhookTiming(
    scope: string,
    txHash: string,
    timings: Record<string, number | string | boolean | undefined>
): void {
    const printable = Object.entries(timings)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
    console.log(`[WebhookTiming][${scope}] tx=${txHash.slice(0, 12)} ${printable}`);
}

export function resolveDetectedAt(
    staleMs: number,
    ...candidates: Array<number | undefined | null>
): number {
    const now = Date.now();
    for (const candidate of candidates) {
        if (!Number.isFinite(candidate as number)) continue;
        const value = Number(candidate);
        if (value <= 0) continue;
        if (now - value <= staleMs) {
            return value;
        }
    }
    return now;
}

export function waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`timeout_${label}_${ms}ms`)), ms);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export function safeSecretEquals(provided: unknown, expected: string): boolean {
    if (typeof provided !== 'string') return false;
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
}
