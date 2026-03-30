import test from 'node:test';
import assert from 'node:assert/strict';

import { env } from '../config/env.js';
import { computeDailyLimitFromBalance, getUsageLimitRpcChain } from './usageLimitsService.js';

test('getUsageLimitRpcChain follows usage limits chain config', () => {
    assert.equal(getUsageLimitRpcChain(), env.usageLimits.chainId);
});

test('computeDailyLimitFromBalance never drops below base tier and upgrades on matching tier', () => {
    const lowBalanceLimit = computeDailyLimitFromBalance(0);
    const highBalanceLimit = computeDailyLimitFromBalance(50_000_000);

    assert.equal(lowBalanceLimit, env.usageLimits.baseDailyLimit);
    assert.ok(highBalanceLimit >= lowBalanceLimit);
});
