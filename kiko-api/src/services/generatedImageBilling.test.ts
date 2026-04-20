import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import {
    buildGeneratedImageBillingDecision,
    normalizeGeneratedImagePreference,
    resolveAvailableGeneratedImagePreference,
} from './generatedImageBilling.js';

test('GPT image stays disabled even though pricing is known', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-18',
        model: 'gpt-image-1.5',
        quality: 'medium',
        imageCount: 1,
        freeOutputImagesUsed: 0,
        hasBillingConsent: false,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'MODEL_DISABLED');
    assert.equal(decision.freeOutputImageLimit, 0);
    assert.equal(decision.providerModel, 'gpt-image-1.5');
    assert.equal(decision.billedImageCount, 0);
    assert.equal(decision.pricePerOutputImageUsd, 0.034);
    assert.equal(decision.usdCost, 0);
});

test('GPT image high quality keeps the documented future price while disabled', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-18',
        model: 'gpt-image-1.5',
        quality: 'high',
        imageCount: 1,
        freeOutputImagesUsed: 0,
        hasBillingConsent: true,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'MODEL_DISABLED');
    assert.equal(decision.pricePerOutputImageUsd, 0.133);
    assert.equal(decision.usdCost, 0);
});

test('Grok normal grants free output images while quota remains', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-18',
        model: 'grok-imagine-image',
        quality: 'normal',
        imageCount: 1,
        freeOutputImagesUsed: 0,
        hasBillingConsent: false,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.freeImageCount, 1);
    assert.equal(decision.billedImageCount, 0);
    assert.equal(decision.usdCost, 0);
});

test('Grok normal blocks after free quota without billing consent', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-18',
        model: 'grok-imagine-image',
        quality: 'normal',
        imageCount: 1,
        freeOutputImagesUsed: 2,
        hasBillingConsent: false,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'BILLING_CONSENT_REQUIRED');
    assert.equal(decision.freeImageCount, 0);
    assert.equal(decision.billedImageCount, 1);
    assert.equal(decision.usdCost, 0.02);
});

test('Grok normal uses remaining free output image before paid spillover', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-18',
        model: 'grok-imagine-image',
        quality: 'normal',
        imageCount: 2,
        freeOutputImagesUsed: 1,
        hasBillingConsent: true,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.freeImageCount, 1);
    assert.equal(decision.billedImageCount, 1);
    assert.equal(decision.usdCost, 0.02);
});

test('Grok normal free output allowance can be tuned from env', () => {
    const originalFreeOutputs = env.generatedImage.dailyFreeOutputs;
    env.generatedImage.dailyFreeOutputs = 5;

    try {
        const decision = buildGeneratedImageBillingDecision({
            dateUtc: '2026-04-18',
            model: 'grok-imagine-image',
            quality: 'normal',
            imageCount: 1,
            freeOutputImagesUsed: 4,
            hasBillingConsent: false,
        });

        assert.equal(decision.allowed, true);
        assert.equal(decision.freeOutputImageLimit, 5);
        assert.equal(decision.freeImageCount, 1);
        assert.equal(decision.billedImageCount, 0);
        assert.equal(decision.usdCost, 0);
    } finally {
        env.generatedImage.dailyFreeOutputs = originalFreeOutputs;
    }
});

test('Grok pro remains disabled even though pricing is known', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-18',
        model: 'grok-imagine-image-pro',
        quality: 'pro',
        imageCount: 1,
        freeOutputImagesUsed: 0,
        hasBillingConsent: true,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'MODEL_DISABLED');
    assert.equal(decision.pricePerOutputImageUsd, 0.07);
});

test('generated image preference normalization rejects disabled models', () => {
    assert.deepEqual(
        normalizeGeneratedImagePreference('gpt-image-1.5', 'high'),
        {
            model: null,
            quality: null,
        },
    );
    assert.deepEqual(
        normalizeGeneratedImagePreference('grok-imagine-image', 'normal'),
        {
            model: 'grok-imagine-image',
            quality: 'normal',
        },
    );
});

test('available generated image preference falls through disabled candidates to the first enabled model', () => {
    assert.deepEqual(
        resolveAvailableGeneratedImagePreference([
            { model: 'gpt-image-1.5', quality: 'high' },
            { model: 'grok-imagine-image-pro', quality: 'pro' },
            { model: 'grok-imagine-image', quality: 'normal' },
        ]),
        {
            model: 'grok-imagine-image',
            quality: 'normal',
        },
    );
});
