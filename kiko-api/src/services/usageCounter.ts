import { get as cacheGet, set as cacheSet, incrBy as cacheIncrBy, setIfNotExists } from '../cache/redis.js';
import { getDailyTotalUsageCount, getDailyUsageCount } from '../repositories/billingRepository.js';

export type UsageCounts = {
    total: number;
    deepseek: number;
    grok: number;
    other: number;
};

const MSG_DEDUPE_TTL_SECONDS = 60 * 60 * 48; // 48 hours

function usageKey(userId: string, dateUtc: string, category: string): string {
    return `usage:${dateUtc}:${userId}:${category}`;
}

function messageDedupeKey(messageId: string): string {
    return `usage:msg:${messageId}`;
}

function secondsUntilUtcDayEnd(dateUtc: string): number {
    const start = new Date(`${dateUtc}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return 0;
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const ttlSeconds = Math.floor((end.getTime() - now.getTime()) / 1000);
    return ttlSeconds > 0 ? ttlSeconds : 0;
}

async function readCachedCount(key: string): Promise<number | null> {
    const raw = await cacheGet(key).catch(() => null);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function getUsageCounts(params: { userId: string; dateUtc: string }): Promise<UsageCounts> {
    const { userId, dateUtc } = params;
    const totalKey = usageKey(userId, dateUtc, 'total');
    const deepseekKey = usageKey(userId, dateUtc, 'deepseek');
    const grokKey = usageKey(userId, dateUtc, 'grok');
    const otherKey = usageKey(userId, dateUtc, 'other');

    const [totalCached, deepseekCached, grokCached, otherCached] = await Promise.all([
        readCachedCount(totalKey),
        readCachedCount(deepseekKey),
        readCachedCount(grokKey),
        readCachedCount(otherKey),
    ]);

    const ttlSeconds = secondsUntilUtcDayEnd(dateUtc);
    const needsBackfill = [totalCached, deepseekCached, grokCached, otherCached].some(v => v === null);

    if (needsBackfill) {
        const [totalDb, deepseekDb, grokDb] = await Promise.all([
            getDailyTotalUsageCount(userId, dateUtc),
            getDailyUsageCount(userId, dateUtc, 'deepseek'),
            getDailyUsageCount(userId, dateUtc, 'grok'),
        ]);
        const otherDb = Math.max(0, totalDb - deepseekDb - grokDb);

        if (ttlSeconds > 0) {
            const writes: Array<Promise<void>> = [];
            if (totalCached === null) writes.push(cacheSet(totalKey, String(totalDb), ttlSeconds));
            if (deepseekCached === null) writes.push(cacheSet(deepseekKey, String(deepseekDb), ttlSeconds));
            if (grokCached === null) writes.push(cacheSet(grokKey, String(grokDb), ttlSeconds));
            if (otherCached === null) writes.push(cacheSet(otherKey, String(otherDb), ttlSeconds));
            await Promise.allSettled(writes);
        }

        return {
            total: totalDb,
            deepseek: deepseekDb,
            grok: grokDb,
            other: otherDb,
        };
    }

    return {
        total: totalCached || 0,
        deepseek: deepseekCached || 0,
        grok: grokCached || 0,
        other: otherCached || 0,
    };
}

export async function recordUsage(params: {
    userId: string;
    dateUtc: string;
    modelCategory: string;
    assistantMessageId: string;
}): Promise<void> {
    const { userId, dateUtc, modelCategory, assistantMessageId } = params;
    if (!userId || !assistantMessageId) return;

    const ttlSeconds = secondsUntilUtcDayEnd(dateUtc);
    if (ttlSeconds <= 0) return;

    const isFirst = await setIfNotExists(messageDedupeKey(assistantMessageId), '1', MSG_DEDUPE_TTL_SECONDS);
    if (!isFirst) return;

    const category = modelCategory || 'other';
    const totalKey = usageKey(userId, dateUtc, 'total');
    const categoryKey = usageKey(userId, dateUtc, category);
    await Promise.allSettled([
        cacheIncrBy(totalKey, 1, ttlSeconds),
        cacheIncrBy(categoryKey, 1, ttlSeconds),
    ]);
}
