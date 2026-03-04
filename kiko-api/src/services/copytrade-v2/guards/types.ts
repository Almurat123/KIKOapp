export type BuyGuardName =
    | 'minTargetValue'
    | 'minLiquidity'
    | 'minMarketCap'
    | 'priceDeviationRatio'
    | 'priceDeviationBps'
    | 'gasBuffer'
    | 'cooldown'
    | 'duplicateLock';

export type BuyGuardPolicyName = 'turbo' | 'normal';

export type BuyGuardPolicy = {
    name: BuyGuardPolicyName;
    enabled: Record<BuyGuardName, boolean>;
};
