import { get as cacheGet, set as cacheSet, incrBy as cacheIncrBy, setIfNotExists } from '../cache/cacheClient.js';
import { getDailyTotalUsageCount, getDailyUsageCount, getDailyUsageCountByModel } from '../repositories/billingRepository.js';
import { normalizeModelForPricing } from './billing/billingService.js';

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: usage access used to cache legacy DeepSeek/Grok category counters.
//         After the quota policy moved to free/premium shared counters, the
//         counter owner must write `free`/`premium` while still reading same-day
//         legacy `deepseek`/`grok` rows during deploys.
// Goal: preserve one canonical cache shape for total/free/premium counters while
//       also tracking model-level usage counts for diagnostics and summaries.
// Owns: per-day usage counter cache keys, backfill rules, and idempotent usage
//       increments after a successful assistant response is reserved.
// Does Not Own: billing price calculation, auth gating, or UI rendering.
// Design Language:
// - Cache keys must distinguish category counters from model counters.
// - New quota writes use `free` and `premium`; legacy `deepseek`/`grok` reads are compatibility only.
// - Model ids must be normalized once before entering cache storage.
// - Message dedupe must stay the single write-side idempotency guard.
// Document Provenance:
// - Source: /Users/almurat/KiKo/kiko-api/src/services/usageAccess.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: shared premium quota enforcement requiring cached category reads
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: cache-level support for free/premium categories with legacy same-day backfill
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type UsageCounts = {
    total: number;
    free: number;
    premium: number;
    other: number;
};

const MSG_DEDUPE_TTL_SECONDS = 60 * 60 * 48; // 48 hours

function usageKey(userId: string, dateUtc: string, category: string): string {
    return `usage:${dateUtc}:${userId}:${category}`;
}

function usageModelKey(userId: string, dateUtc: string, model: string): string {
    return `usage:${dateUtc}:${userId}:model:${model}`;
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
    const freeKey = usageKey(userId, dateUtc, 'free');
    const premiumKey = usageKey(userId, dateUtc, 'premium');
    const otherKey = usageKey(userId, dateUtc, 'other');

    const [totalCached, freeCached, premiumCached, otherCached] = await Promise.all([
        readCachedCount(totalKey),
        readCachedCount(freeKey),
        readCachedCount(premiumKey),
        readCachedCount(otherKey),
    ]);

    const ttlSeconds = secondsUntilUtcDayEnd(dateUtc);
    const needsBackfill = [totalCached, freeCached, premiumCached, otherCached].some(v => v === null);

    if (needsBackfill) {
        const [totalDb, freeDb, premiumDb, legacyDeepseekDb, legacyGrokDb] = await Promise.all([
            getDailyTotalUsageCount(userId, dateUtc),
            getDailyUsageCount(userId, dateUtc, 'free'),
            getDailyUsageCount(userId, dateUtc, 'premium'),
            getDailyUsageCount(userId, dateUtc, 'deepseek'),
            getDailyUsageCount(userId, dateUtc, 'grok'),
        ]);
        const resolvedFreeDb = freeDb + legacyDeepseekDb;
        const resolvedPremiumDb = premiumDb + legacyGrokDb;
        const otherDb = Math.max(0, totalDb - resolvedFreeDb - resolvedPremiumDb);
        const resolvedTotal = totalCached ?? totalDb;
        const resolvedFree = freeCached ?? resolvedFreeDb;
        const resolvedPremium = premiumCached ?? resolvedPremiumDb;
        const resolvedOther = otherCached ?? otherDb;

        if (ttlSeconds > 0) {
            const writes: Array<Promise<void>> = [];
            if (totalCached === null) writes.push(cacheSet(totalKey, String(resolvedTotal), ttlSeconds));
            if (freeCached === null) writes.push(cacheSet(freeKey, String(resolvedFree), ttlSeconds));
            if (premiumCached === null) writes.push(cacheSet(premiumKey, String(resolvedPremium), ttlSeconds));
            if (otherCached === null) writes.push(cacheSet(otherKey, String(resolvedOther), ttlSeconds));
            await Promise.allSettled(writes);
        }

        return {
            total: resolvedTotal,
            free: resolvedFree,
            premium: resolvedPremium,
            other: resolvedOther,
        };
    }

    return {
        total: totalCached || 0,
        free: freeCached || 0,
        premium: premiumCached || 0,
        other: otherCached || 0,
    };
}

export async function getUsageCountForModel(params: { userId: string; dateUtc: string; model: string }): Promise<number> {
    const normalizedModel = normalizeModelForPricing(params.model);
    if (!normalizedModel) return 0;

    const key = usageModelKey(params.userId, params.dateUtc, normalizedModel);
    const cached = await readCachedCount(key);
    if (cached !== null) return cached;

    const resolved = await getDailyUsageCountByModel(params.userId, params.dateUtc, normalizedModel);
    const ttlSeconds = secondsUntilUtcDayEnd(params.dateUtc);
    if (ttlSeconds > 0) {
        await cacheSet(key, String(resolved), ttlSeconds).catch(() => undefined);
    }
    return resolved;
}

export async function recordUsage(params: {
    userId: string;
    dateUtc: string;
    modelCategory: string;
    model?: string;
    assistantMessageId: string;
}): Promise<void> {
    // Credits billing now settles usage after durable persistence instead of
    // reserving daily quota counters up front. Keep this function as a no-op so
    // older ingress paths do not consume free premium turns on failed requests.
    void params;
}
