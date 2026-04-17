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

test('getBillingCategory classifies NVIDIA GLM/Kimi variants as free quota bucket', () => {
    assert.equal(getBillingCategory('glm-5'), 'free');
    assert.equal(getBillingCategory('glm-5-reasoning'), 'free');
    assert.equal(getBillingCategory('kimi-k2-5-reasoning'), 'free');
    assert.equal(getBillingCategory('kimi-k2-5-instant'), 'free');
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

test('computeUsdCost defaults NVIDIA trial-hosted models to zero until pricing is pinned', () => {
    const usdCost = computeUsdCost(
        {
            prompt_tokens: 1_000_000,
            completion_tokens: 2_000_000,
            completion_tokens_details: { reasoning_tokens: 500_000 },
        },
        'glm-5',
        [],
    );

    assert.equal(usdCost, 0);
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
    const original = env.billing.dailyFreeModelLimit;
    env.billing.dailyFreeModelLimit = 20;
    try {
        assert.equal(getDailyFreeQuotaForModel('glm-5'), 20);
        assert.equal(getDailyFreeQuotaForModel('glm-5-reasoning'), 20);
        assert.equal(getDailyFreeQuotaForModel('kimi-k2-5-reasoning'), 20);
    } finally {
        env.billing.dailyFreeModelLimit = original;
    }
    assert.equal(getDailyFreeQuotaForModel('gpt-5.4-mini-2026-03-17'), env.billing.dailyFreePremium);
    assert.equal(getDailyFreeQuotaForModel('grok-4-1-fast-reasoning'), env.billing.dailyFreePremium);
});
