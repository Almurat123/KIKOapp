import { env } from '../config/env.js';
import {
    getBillingCategory,
    getUtcDateString,
    normalizeModelForPricing,
} from './billing/billingService.js';
import { getUsageCounts, type UsageCounts } from './usageCounter.js';
import { getUserUsageQuota, type ResolvedUsageQuota } from './usageLimitsService.js';

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: chat quota policy changed after DeepSeek removal. NVIDIA-hosted
//         GLM/Kimi models are free-model traffic and GPT/Grok are premium-model
//         traffic, but holder tiers still need to decide the actual free and
//         premium allowances per user.
// Goal: enforce exactly two product quota states while resolving the actual
//       free/premium limits from the current user's holder tier whenever token
//       gating is configured.
// Owns: request-time usage access decisions, free-vs-paid classification, and
//       human-facing limit messages for chat/social ingress.
// Does Not Own: cache persistence, provider-side upstream rate limits, or pricing math.
// Design Language:
// - Free-model traffic must only be blocked when the resolved free-model limit is positive.
// - Premium GPT/Grok traffic consumes one shared premium counter.
// - Holder-tier quota resolution lives elsewhere; this layer only applies the resolved limits.
// - Do not reintroduce Normal/Advanced or DeepSeek/Grok quota branches.
// - Access decisions must carry enough context for routes to render one stable limit message.
// Document Provenance:
// - Source: operator quota-policy correction after DeepSeek removal
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: free GLM/Kimi traffic, shared GPT/Grok premium quota, and token-tier rebinding
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-api/src/config/env.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: free/premium model-list parsing and token-tier fallback semantics
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-api/src/services/usageLimitsService.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: user-specific free/premium quota resolution before request gating
// - Verification: verified in code
// - Source: operator quota-policy correction for optional free-model cap
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: env-driven shared cap for all free-model traffic
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type UsageLimitReason = 'DAILY_FREE_LIMIT_REACHED' | 'DAILY_PREMIUM_LIMIT_REACHED';
export type UsageLimitSource = 'free_unlimited' | 'free_shared' | 'premium_shared' | 'none';

export type UsageDecision = {
    allowed: boolean;
    reason?: UsageLimitReason;
    dateUtc: string;
    totalUsed: number;
    freeUsed: number;
    freeLimit: number;
    premiumUsed: number;
    premiumLimit: number;
    modelCategory: 'free' | 'premium' | 'other';
    requestedModel: string;
    modelLimitSource: UsageLimitSource;
};

type UsageDecisionSnapshot = {
    usageLimitsEnabled: boolean;
    model: string;
    dateUtc: string;
    counts: UsageCounts;
    quota: Pick<ResolvedUsageQuota, 'freeModelLimit' | 'premiumLimit'>;
};

function resolveLimitSource(modelCategory: UsageDecision['modelCategory'], freeLimit: number): UsageLimitSource {
    if (modelCategory === 'free') {
        return freeLimit > 0 ? 'free_shared' : 'free_unlimited';
    }
    if (modelCategory === 'premium') return 'premium_shared';
    return 'none';
}

export function buildUsageDecision(snapshot: UsageDecisionSnapshot): UsageDecision {
    const requestedModel = normalizeModelForPricing(snapshot.model);
    const modelCategory = getBillingCategory(requestedModel);
    const freeLimit = Math.max(0, snapshot.quota.freeModelLimit);
    const premiumLimit = Math.max(0, snapshot.quota.premiumLimit);
    const modelLimitSource = resolveLimitSource(modelCategory, freeLimit);
    const baseDecision = {
        dateUtc: snapshot.dateUtc,
        totalUsed: snapshot.counts.total,
        freeUsed: snapshot.counts.free,
        freeLimit,
        premiumUsed: snapshot.counts.premium,
        premiumLimit,
        modelCategory,
        requestedModel,
        modelLimitSource,
    };

    if (!snapshot.usageLimitsEnabled || modelLimitSource === 'free_unlimited' || modelLimitSource === 'none') {
        return {
            ...baseDecision,
            allowed: true,
        };
    }

    if (modelLimitSource === 'free_shared' && snapshot.counts.free >= freeLimit) {
        return {
            ...baseDecision,
            allowed: false,
            reason: 'DAILY_FREE_LIMIT_REACHED',
        };
    }

    if (snapshot.counts.premium >= premiumLimit) {
        return {
            ...baseDecision,
            allowed: false,
            reason: 'DAILY_PREMIUM_LIMIT_REACHED',
        };
    }

    return {
        ...baseDecision,
        allowed: true,
    };
}

export function isCurrentRequestFree(
    decision: Pick<UsageDecision, 'allowed' | 'freeUsed' | 'freeLimit' | 'premiumUsed' | 'premiumLimit' | 'modelLimitSource'>
): boolean {
    if (decision.modelLimitSource === 'free_unlimited') {
        return true;
    }
    if (decision.modelLimitSource === 'free_shared') {
        return decision.allowed && decision.freeUsed < decision.freeLimit;
    }
    if (decision.modelLimitSource !== 'premium_shared') {
        return false;
    }
    return decision.allowed && decision.premiumUsed < decision.premiumLimit;
}

export function getUsageLimitMessage(decision: Pick<UsageDecision, 'reason' | 'freeLimit' | 'premiumLimit'>): string {
    if (decision.reason === 'DAILY_FREE_LIMIT_REACHED') {
        return `You have reached your daily free model limit (${decision.freeLimit} messages). Please use a premium model or check back tomorrow.`;
    }
    if (decision.reason === 'DAILY_PREMIUM_LIMIT_REACHED') {
        return `You have reached your daily premium model limit (${decision.premiumLimit} messages). Please use Kimi or check back tomorrow.`;
    }
    return 'Daily premium model limit reached.';
}

export async function evaluateUsageAccess(params: { userId: string; model: string }): Promise<UsageDecision> {
    const dateUtc = getUtcDateString();
    const requestedModel = normalizeModelForPricing(params.model);
    const [counts, quota] = await Promise.all([
        getUsageCounts({ userId: params.userId, dateUtc }),
        getUserUsageQuota({ userId: params.userId }),
    ]);

    return buildUsageDecision({
        usageLimitsEnabled: env.usageLimits.enabled,
        model: requestedModel,
        dateUtc,
        counts,
        quota,
    });
}
