import { env } from '../config/env.js';
import { getUtcDateString } from './billing/billingService.js';
import { getBillingCategory } from './billing/billingService.js';
import { getUsageCounts } from './usageCounter.js';
import { getUserDailyLimit } from './usageLimitsService.js';

export type UsageDecision = {
    allowed: boolean;
    reason?: string;
    dateUtc: string;
    totalUsed: number;
    totalLimit: number;
    tokenBalance: number;
    normalUsed: number;
    advancedUsed: number;
    modelCategory: 'deepseek' | 'grok' | 'other';
};

export async function evaluateUsageAccess(params: { userId: string; model: string }): Promise<UsageDecision> {
    const dateUtc = getUtcDateString();
    const modelCategory = getBillingCategory(params.model);

    if (!env.usageLimits.enabled) {
        const counts = await getUsageCounts({ userId: params.userId, dateUtc });
        return {
            allowed: true,
            dateUtc,
            totalUsed: counts.total,
            totalLimit: 0,
            tokenBalance: 0,
            normalUsed: counts.deepseek,
            advancedUsed: counts.grok,
            modelCategory
        };
    }

    const { limit: totalLimit, tokenBalance } = await getUserDailyLimit({ userId: params.userId });
    const counts = await getUsageCounts({ userId: params.userId, dateUtc });
    const totalUsed = counts.total;
    const normalUsed = counts.deepseek;
    const advancedUsed = counts.grok;

    // 1. Check strict hard cap total limit
    if (totalLimit > 0 && totalUsed >= totalLimit) {
        return {
            allowed: false,
            reason: 'DAILY_TOTAL_LIMIT_REACHED',
            dateUtc,
            totalUsed,
            totalLimit,
            tokenBalance,
            normalUsed,
            advancedUsed,
            modelCategory
        };
    }

    // 2. Check individual model category limits
    if (modelCategory === 'grok' && advancedUsed >= env.billing.dailyFreeGrok) {
        return {
            allowed: false,
            reason: 'DAILY_ADVANCED_LIMIT_REACHED',
            dateUtc,
            totalUsed,
            totalLimit,
            tokenBalance,
            normalUsed,
            advancedUsed,
            modelCategory
        };
    }

    if (modelCategory === 'deepseek' && normalUsed >= env.billing.dailyFreeDeepseek) {
        return {
            allowed: false,
            reason: 'DAILY_NORMAL_LIMIT_REACHED',
            dateUtc,
            totalUsed,
            totalLimit,
            tokenBalance,
            normalUsed,
            advancedUsed,
            modelCategory
        };
    }

    return {
        allowed: true,
        dateUtc,
        totalUsed,
        totalLimit,
        tokenBalance,
        normalUsed,
        advancedUsed,
        modelCategory
    };
}

