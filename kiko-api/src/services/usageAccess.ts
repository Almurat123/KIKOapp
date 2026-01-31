import { env } from '../config/env.js';
import { getUtcDateString } from './billing/billingService.js';
import { getBillingCategory } from './billing/billingService.js';
import { getDailyTotalUsageCount, getDailyUsageCount } from '../repositories/billingRepository.js';
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
        const normalUsed = await getDailyUsageCount(params.userId, dateUtc, 'deepseek');
        const advancedUsed = await getDailyUsageCount(params.userId, dateUtc, 'grok');
        return {
            allowed: true,
            dateUtc,
            totalUsed: normalUsed + advancedUsed,
            totalLimit: 0,
            tokenBalance: 0,
            normalUsed,
            advancedUsed,
            modelCategory
        };
    }

    const { limit: totalLimit, tokenBalance } = await getUserDailyLimit({ userId: params.userId });
    const totalUsed = await getDailyTotalUsageCount(params.userId, dateUtc);
    const normalUsed = await getDailyUsageCount(params.userId, dateUtc, 'deepseek');
    const advancedUsed = await getDailyUsageCount(params.userId, dateUtc, 'grok');

    if (totalLimit > 0 && totalUsed >= totalLimit) {
        return {
            allowed: false,
            reason: 'DAILY_LIMIT_REACHED',
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

