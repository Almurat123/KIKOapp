import crypto from 'node:crypto';
import { getBlockByNumber } from '../services/rpcManager.js';

const receiptBlockTimestampCache = new Map<string, number | null>();

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

export async function resolveReceiptBlockTimestampMs(chainId: number, receipt: any): Promise<number | undefined> {
    const rawBlockNumber = receipt?.blockNumber;
    if (rawBlockNumber === undefined || rawBlockNumber === null || rawBlockNumber === '') return undefined;
    const cacheKey = `${chainId}:${String(rawBlockNumber).toLowerCase()}`;
    if (receiptBlockTimestampCache.has(cacheKey)) {
        return receiptBlockTimestampCache.get(cacheKey) || undefined;
    }
    const block = await getBlockByNumber(chainId, rawBlockNumber, false).catch(() => null);
    const timestampMs = normalizeBlockTimestampMs(block?.timestamp);
    if (receiptBlockTimestampCache.size > 5000) receiptBlockTimestampCache.clear();
    receiptBlockTimestampCache.set(cacheKey, timestampMs);
    return timestampMs || undefined;
}

function normalizeBlockTimestampMs(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value >= 1e12 ? Math.round(value) : Math.round(value * 1000);
    }
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('0x')) {
        const seconds = Number.parseInt(trimmed, 16);
        return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
        return numeric >= 1e12 ? Math.round(numeric) : Math.round(numeric * 1000);
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
