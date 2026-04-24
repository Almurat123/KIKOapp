import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_GENERATED_IMAGE_CREDIT_MARKUP_MULTIPLIER,
    buildDefaultCreditImagePricing,
} from '../config/creditPricingDefaults.js';
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

    assert.equal(credits, 0.19);
});

test('premium text pricing uses the recommended default credits table for grok fast reasoning', () => {
    const credits = computePremiumTextCreditsCharge({
        model: 'grok-4-1-fast-reasoning',
        promptTokens: 2000,
        completionTokens: 1000,
    });

    assert.equal(credits, 0.0635);
});

test('generated image pricing uses the credits image table', () => {
    const defaultImagePricing = buildDefaultCreditImagePricing(10);

    assert.deepEqual(defaultImagePricing, {
        'gpt-image-1-mini': {
            low: 0.15,
            medium: 0.33,
            high: 1.08,
        },
        'gpt-image-2': {
            low: 0.18,
            medium: 1.59,
            high: 6.33,
        },
        'grok-imagine-image': {
            normal: 0.6,
        },
        'grok-imagine-image-pro': {
            pro: 2.1,
        },
        'cloudflare-flux-2-klein-4b': {
            normal: 0,
        },
        'runware-flux-2-klein-9b-kv': {
            normal: 0.0234,
        },
    });
    assert.equal(DEFAULT_GENERATED_IMAGE_CREDIT_MARKUP_MULTIPLIER, 3);

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

    assert.equal(
        computeGeneratedImageCreditsCharge({
            model: 'runware-flux-2-klein-9b-kv',
            quality: 'normal',
            imageCount: 1,
        }),
        0.0234,
    );
});
