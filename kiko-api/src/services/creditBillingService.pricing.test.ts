import test from 'node:test';
import assert from 'node:assert/strict';

import {
    computeGeneratedImageCreditsCharge,
    computePremiumTextCreditsCharge,
} from './creditBillingService.js';

test('premium text pricing uses the recommended default credits table for gpt-5.4-mini', () => {
    const credits = computePremiumTextCreditsCharge({
        model: 'gpt-5.4-mini-2026-03-17',
        promptTokens: 2000,
        completionTokens: 1000,
    });

    assert.equal(credits, 0.68);
});

test('premium text pricing uses the recommended default credits table for grok fast reasoning', () => {
    const credits = computePremiumTextCreditsCharge({
        model: 'grok-4-1-fast-reasoning',
        promptTokens: 2000,
        completionTokens: 1000,
    });

    assert.equal(credits, 0.327);
});

test('generated image pricing uses the credits image table', () => {
    assert.equal(
        computeGeneratedImageCreditsCharge({
            model: 'gpt-image-2',
            quality: 'high',
            imageCount: 1,
        }),
        6.33,
    );

    assert.equal(
        computeGeneratedImageCreditsCharge({
            model: 'grok-imagine-image',
            quality: 'normal',
            imageCount: 2,
        }),
        1.2,
    );
});
