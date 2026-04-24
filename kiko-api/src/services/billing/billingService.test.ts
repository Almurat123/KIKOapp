import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../../config/env.js';
import {
    computeTotalTokens,
    computeUsdCost,
    getBillingCategory,
    getDailyFreeQuotaForModel,
    getReasoningTokens,
} from './billingService.js';

test('getBillingCategory classifies Grok variants as premium even if env lists drift', () => {
    assert.equal(getBillingCategory('grok-4-1-fast-non-reasoning'), 'premium');
});

test('getBillingCategory classifies OpenAI GPT variants as premium quota bucket', () => {
    assert.equal(getBillingCategory('gpt-5.4-mini-2026-03-17'), 'premium');
});

test('getBillingCategory classifies DeepSeek variants as premium quota bucket', () => {
    assert.equal(getBillingCategory('deepseek-v4-flash'), 'premium');
});

test('getBillingCategory classifies explicitly allowlisted free models as free quota bucket', () => {
    const original = [...env.billing.freeModels];
    env.billing.freeModels = ['free-model-example'];
    try {
        assert.equal(getBillingCategory('free-model-example'), 'free');
    } finally {
        env.billing.freeModels = original;
    }
});

test('computeUsdCost prefers xAI exact cost_in_usd_ticks and still adds tool invocation fees', () => {
    const usdCost = computeUsdCost(
        {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 200,
            cost_in_usd_ticks: 1_500_000_000,
        },
        'grok-4-1-fast-reasoning',
        ['x_search'],
    );

    assert.equal(usdCost, 0.155);
});

test('computeUsdCost bills Grok reasoning tokens as output tokens when exact cost is absent', () => {
    const usdCost = computeUsdCost(
        {
            prompt_tokens: 1_000_000,
            completion_tokens: 2_000_000,
            completion_tokens_details: { reasoning_tokens: 3_000_000 },
        },
        'grok-4-1-fast-reasoning',
        [],
    );

    assert.equal(usdCost, 2.7);
});

test('computeUsdCost applies OpenAI cached input pricing and does not double-count reasoning tokens', () => {
    const usdCost = computeUsdCost(
        {
            prompt_tokens: 1_000_000,
            completion_tokens: 2_000_000,
            prompt_tokens_details: { cached_tokens: 400_000 },
            completion_tokens_details: { reasoning_tokens: 500_000 },
        },
        'gpt-5.4-mini-2026-03-17',
        [],
    );

    assert.equal(usdCost, 9.48);
});

test('computeUsdCost applies DeepSeek cache-hit and cache-miss pricing', () => {
    const usdCost = computeUsdCost(
        {
            prompt_tokens: 1_000_000,
            completion_tokens: 2_000_000,
            prompt_cache_hit_tokens: 400_000,
            prompt_cache_miss_tokens: 600_000,
        },
        'deepseek-v4-flash',
        [],
    );

    assert.equal(usdCost, 0.6552);
});

test('computeTotalTokens only adds reasoning fallback for Grok', () => {
    const usage = {
        prompt_tokens: 100,
        completion_tokens: 20,
        completion_tokens_details: { reasoning_tokens: 15 },
    };

    assert.equal(getReasoningTokens(usage), 15);
    assert.equal(computeTotalTokens(usage, 'grok-4-1-fast-reasoning'), 135);
    assert.equal(computeTotalTokens(usage, 'gpt-5-mini'), 120);
});

test('getDailyFreeQuotaForModel returns shared free and premium model quota knobs', () => {
    const originalFreeModels = [...env.billing.freeModels];
    const originalFreeLimit = env.billing.dailyFreeModelLimit;
    env.billing.freeModels = ['free-model-example'];
    env.billing.dailyFreeModelLimit = 20;
    try {
        assert.equal(getDailyFreeQuotaForModel('free-model-example'), 20);
    } finally {
        env.billing.freeModels = originalFreeModels;
        env.billing.dailyFreeModelLimit = originalFreeLimit;
    }
    assert.equal(getDailyFreeQuotaForModel('gpt-5.4-mini-2026-03-17'), env.billing.dailyFreePremium);
    assert.equal(getDailyFreeQuotaForModel('deepseek-v4-flash'), env.billing.dailyFreePremium);
    assert.equal(getDailyFreeQuotaForModel('grok-4-1-fast-reasoning'), env.billing.dailyFreePremium);
});
