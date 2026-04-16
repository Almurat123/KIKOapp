import test from 'node:test';
import assert from 'node:assert/strict';

import { env } from '../config/env.js';
import { computeDailyLimitFromBalance, computeUsageQuotaFromBalance, getUsageLimitRpcChain } from './usageLimitsService.js';

test('getUsageLimitRpcChain follows usage limits chain config', () => {
    assert.equal(getUsageLimitRpcChain(), env.usageLimits.chainId);
});

test('computeDailyLimitFromBalance never drops below base tier and upgrades on matching tier', () => {
    const lowBalanceLimit = computeDailyLimitFromBalance(0);
    const highBalanceLimit = computeDailyLimitFromBalance(50_000_000);

    assert.equal(lowBalanceLimit, env.usageLimits.tiers[0]?.dailyLimit ?? env.usageLimits.baseDailyLimit);
    assert.ok(highBalanceLimit >= lowBalanceLimit);
});

test('computeUsageQuotaFromBalance resolves free and premium limits from the matched holder tier', () => {
    const originalTiers = env.usageLimits.tiers;
    env.usageLimits.tiers = [
        { minBalance: 0, dailyLimit: 8, freeModelLimit: 0, premiumLimit: 8 },
        { minBalance: 10_000_000, dailyLimit: 12, freeModelLimit: 50, premiumLimit: 12 },
        { minBalance: 50_000_000, dailyLimit: 20, freeModelLimit: 200, premiumLimit: 20 },
    ];

    try {
        const lowTier = computeUsageQuotaFromBalance(0);
        const highTier = computeUsageQuotaFromBalance(50_000_000);

        assert.equal(lowTier.freeModelLimit, 0);
        assert.equal(lowTier.premiumLimit, 8);
        assert.equal(highTier.freeModelLimit, 200);
        assert.equal(highTier.premiumLimit, 20);
        assert.equal(highTier.matchedTier?.minBalance, 50_000_000);
    } finally {
        env.usageLimits.tiers = originalTiers;
    }
});
