import {
    evaluateTextUsageAccess,
    getCreditLimitMessage,
    type TextUsageDecision,
} from './creditBillingService.js';

export type UsageLimitReason = 'INSUFFICIENT_CREDITS' | 'MODEL_PRICING_NOT_CONFIGURED';
export type UsageLimitSource = 'free_text_model' | 'premium_daily_free' | 'credits_paid' | 'none';

export type UsageDecision = TextUsageDecision & {
    reason?: UsageLimitReason;
    totalUsed: number;
    freeUsed: number;
    freeLimit: number;
    premiumUsed: number;
    premiumLimit: number;
    modelLimitSource: UsageLimitSource;
};

function resolveLimitSource(decision: TextUsageDecision): UsageLimitSource {
    if (decision.modelCategory === 'free') return 'free_text_model';
    if (decision.isFree) return 'premium_daily_free';
    if (decision.allowed) return 'credits_paid';
    return 'none';
}

export function buildUsageDecision(decision: TextUsageDecision): UsageDecision {
    const modelLimitSource = resolveLimitSource(decision);
    return {
        ...decision,
        totalUsed: decision.premiumFreeUsed,
        freeUsed: decision.modelCategory === 'free' ? 0 : decision.premiumFreeUsed,
        freeLimit: decision.modelCategory === 'free' ? 0 : decision.premiumFreeLimit,
        premiumUsed: decision.premiumFreeUsed,
        premiumLimit: decision.premiumFreeLimit,
        modelLimitSource,
    };
}

export function isCurrentRequestFree(
    decision: Pick<UsageDecision, 'modelLimitSource'>
): boolean {
    return decision.modelLimitSource === 'free_text_model' || decision.modelLimitSource === 'premium_daily_free';
}

export function getUsageLimitMessage(
    decision: Pick<UsageDecision, 'reason' | 'availableCredits' | 'requiredCredits'>
): string {
    return getCreditLimitMessage(decision);
}

export async function evaluateUsageAccess(params: { userId: string; model: string }): Promise<UsageDecision> {
    const decision = await evaluateTextUsageAccess(params);
    return buildUsageDecision(decision);
}
