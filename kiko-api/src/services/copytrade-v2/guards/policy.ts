import type { BuyGuardName, BuyGuardPolicy, BuyGuardPolicyName } from './types.js';

export const BUY_GUARD_POLICIES: Record<BuyGuardPolicyName, BuyGuardPolicy> = {
    turbo: {
        name: 'turbo',
        enabled: {
            minTargetValue: true,
            minLiquidity: false,
            minMarketCap: false,
            priceDeviationRatio: true,
            priceDeviationBps: true,
            gasBuffer: true,
            cooldown: true,
            duplicateLock: true
        }
    },
    normal: {
        name: 'normal',
        enabled: {
            minTargetValue: true,
            minLiquidity: true,
            minMarketCap: true,
            priceDeviationRatio: true,
            priceDeviationBps: true,
            gasBuffer: true,
            cooldown: true,
            duplicateLock: true
        }
    }
};

export function resolveBuyGuardPolicy(executionMode: string | null | undefined): BuyGuardPolicy {
    return String(executionMode || '').toLowerCase() === 'turbo'
        ? BUY_GUARD_POLICIES.turbo
        : BUY_GUARD_POLICIES.normal;
}

export function shouldEnforceBuyGuard(policy: BuyGuardPolicy, guardName: BuyGuardName): boolean {
    return Boolean(policy.enabled[guardName]);
}
