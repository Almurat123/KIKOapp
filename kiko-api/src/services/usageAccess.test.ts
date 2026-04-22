import test from 'node:test';
import assert from 'node:assert/strict';

import { buildUsageDecision, getUsageLimitMessage, isCurrentRequestFree, type UsageDecision } from './usageAccess.js';

function makeDecision(overrides: Partial<UsageDecision>): UsageDecision {
    return {
        allowed: true,
        dateUtc: '2026-04-16',
        totalUsed: 0,
        freeUsed: 0,
        freeLimit: 0,
        premiumUsed: 0,
        premiumLimit: 8,
        modelCategory: 'free',
        requestedModel: 'kimi-k2-5-instant',
        modelLimitSource: 'free_unlimited',
        ...overrides,
    };
}

test('isCurrentRequestFree treats unlimited free-model traffic as free', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ modelLimitSource: 'free_unlimited', premiumUsed: 999 })),
        true,
    );
});

test('isCurrentRequestFree respects the shared free-model cap when configured', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({
            modelLimitSource: 'free_shared',
            freeUsed: 4,
            freeLimit: 5,
        })),
        true,
    );
    assert.equal(
        isCurrentRequestFree(makeDecision({
            modelLimitSource: 'free_shared',
            freeUsed: 5,
            freeLimit: 5,
            allowed: false,
        })),
        false,
    );
});

test('isCurrentRequestFree returns true while premium shared quota remains available', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({
            modelLimitSource: 'premium_shared',
            premiumUsed: 7,
            premiumLimit: 8,
        })),
        true,
    );
});

test('isCurrentRequestFree returns false after premium shared quota is consumed', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({
            modelLimitSource: 'premium_shared',
            premiumUsed: 8,
            premiumLimit: 8,
            allowed: false,
        })),
        false,
    );
});

test('buildUsageDecision does not block Kimi free-model traffic when resolved free cap is disabled', () => {
    const decision = buildUsageDecision({
        usageLimitsEnabled: true,
        model: 'kimi-k2-5-instant',
        dateUtc: '2026-04-16',
        counts: {
            total: 10_000,
            free: 10_000,
            premium: 8,
            other: 0,
        },
        quota: {
            freeModelLimit: 0,
            premiumLimit: 8,
        },
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.modelCategory, 'free');
    assert.equal(decision.modelLimitSource, 'free_unlimited');
});

test('buildUsageDecision enforces one shared free quota across Kimi modes when the holder tier sets a free cap', () => {
    const decision = buildUsageDecision({
        usageLimitsEnabled: true,
        model: 'kimi-k2-5-reasoning',
        dateUtc: '2026-04-16',
        counts: {
            total: 5,
            free: 5,
            premium: 0,
            other: 0,
        },
        quota: {
            freeModelLimit: 5,
            premiumLimit: 12,
        },
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'DAILY_FREE_LIMIT_REACHED');
    assert.equal(decision.modelCategory, 'free');
    assert.equal(decision.modelLimitSource, 'free_shared');
    assert.equal(decision.freeLimit, 5);
});

test('buildUsageDecision enforces one shared premium quota across GPT and Grok from the resolved holder tier', () => {
    const decision = buildUsageDecision({
        usageLimitsEnabled: true,
        model: 'gpt-5.4-mini-2026-03-17',
        dateUtc: '2026-04-16',
        counts: {
            total: 12,
            free: 0,
            premium: 12,
            other: 0,
        },
        quota: {
            freeModelLimit: 50,
            premiumLimit: 12,
        },
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'DAILY_PREMIUM_LIMIT_REACHED');
    assert.equal(decision.modelCategory, 'premium');
});

test('buildUsageDecision lets premium models through before shared quota is consumed', () => {
    const decision = buildUsageDecision({
        usageLimitsEnabled: true,
        model: 'grok-4-1-fast-reasoning',
        dateUtc: '2026-04-16',
        counts: {
            total: 11,
            free: 0,
            premium: 11,
            other: 0,
        },
        quota: {
            freeModelLimit: 50,
            premiumLimit: 12,
        },
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.modelCategory, 'premium');
    assert.equal(decision.premiumLimit, 12);
});

test('getUsageLimitMessage describes the shared premium quota', () => {
    const message = getUsageLimitMessage(makeDecision({
        reason: 'DAILY_PREMIUM_LIMIT_REACHED',
        premiumLimit: 8,
    }));

    assert.equal(message, 'You have reached your daily premium model limit (8 messages). Please use Kimi or check back tomorrow.');
});

test('getUsageLimitMessage describes the shared free-model quota', () => {
    const message = getUsageLimitMessage(makeDecision({
        reason: 'DAILY_FREE_LIMIT_REACHED',
        freeLimit: 20,
    }));

    assert.equal(message, 'You have reached your daily free model limit (20 messages). Please use a premium model or check back tomorrow.');
});
