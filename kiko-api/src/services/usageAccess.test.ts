import test from 'node:test';
import assert from 'node:assert/strict';

import { buildUsageDecision, getUsageLimitMessage, isCurrentRequestFree, type UsageDecision } from './usageAccess.js';

function makeDecision(overrides: Partial<UsageDecision>): UsageDecision {
    return {
        allowed: true,
        dateUtc: '2026-04-22',
        isFree: true,
        totalUsed: 0,
        freeUsed: 0,
        freeLimit: 5,
        premiumUsed: 0,
        premiumLimit: 5,
        modelCategory: 'premium',
        requestedModel: 'gpt-5.4-mini-2026-03-17',
        modelLimitSource: 'premium_daily_free',
        premiumFreeUsed: 0,
        premiumFreeLimit: 5,
        availableCredits: 10,
        requiredCredits: 0,
        ...overrides,
    };
}

test('isCurrentRequestFree treats free text models as free', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ modelLimitSource: 'free_text_model', modelCategory: 'free' })),
        true,
    );
});

test('isCurrentRequestFree treats premium daily free turns as free', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ modelLimitSource: 'premium_daily_free', premiumUsed: 4, freeUsed: 4 })),
        true,
    );
});

test('isCurrentRequestFree returns false for credits-paid premium traffic', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ modelLimitSource: 'credits_paid', isFree: false })),
        false,
    );
});

test('buildUsageDecision maps free text models to the free_text_model source', () => {
    const decision = buildUsageDecision({
        allowed: true,
        requestedModel: 'kimi-k2-5-instant',
        modelCategory: 'free',
        dateUtc: '2026-04-22',
        isFree: true,
        premiumFreeUsed: 0,
        premiumFreeLimit: 5,
        availableCredits: 0,
        requiredCredits: 0,
    });

    assert.equal(decision.modelLimitSource, 'free_text_model');
    assert.equal(decision.allowed, true);
    assert.equal(decision.modelCategory, 'free');
});

test('buildUsageDecision maps premium free allowance to premium_daily_free', () => {
    const decision = buildUsageDecision({
        allowed: true,
        requestedModel: 'gpt-5.4-mini-2026-03-17',
        modelCategory: 'premium',
        dateUtc: '2026-04-22',
        isFree: true,
        premiumFreeUsed: 4,
        premiumFreeLimit: 5,
        availableCredits: 0,
        requiredCredits: 0,
    });

    assert.equal(decision.modelLimitSource, 'premium_daily_free');
    assert.equal(decision.premiumUsed, 4);
    assert.equal(decision.premiumLimit, 5);
});

test('buildUsageDecision maps paid premium traffic to credits_paid', () => {
    const decision = buildUsageDecision({
        allowed: true,
        requestedModel: 'gpt-5.4-mini-2026-03-17',
        modelCategory: 'premium',
        dateUtc: '2026-04-22',
        isFree: false,
        premiumFreeUsed: 5,
        premiumFreeLimit: 5,
        availableCredits: 42,
        requiredCredits: 1,
    });

    assert.equal(decision.modelLimitSource, 'credits_paid');
    assert.equal(decision.allowed, true);
    assert.equal(decision.availableCredits, 42);
});

test('getUsageLimitMessage describes insufficient credits', () => {
    const message = getUsageLimitMessage(makeDecision({
        allowed: false,
        reason: 'INSUFFICIENT_CREDITS',
        isFree: false,
        availableCredits: 0.5,
        requiredCredits: 1.25,
        modelLimitSource: 'none',
    }));

    assert.equal(message, 'Insufficient credits. You need at least 1.25 credits and currently have 0.50.');
});

test('getUsageLimitMessage describes missing pricing', () => {
    const message = getUsageLimitMessage(makeDecision({
        allowed: false,
        reason: 'MODEL_PRICING_NOT_CONFIGURED',
        isFree: false,
        modelLimitSource: 'none',
    }));

    assert.equal(message, 'This premium model is not available for paid usage right now.');
});
