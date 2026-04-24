import assert from 'node:assert/strict';
import test from 'node:test';

import { env } from '../config/env.js';
import {
    buildGeneratedImageBillingDecision,
    normalizeGeneratedImagePreference,
    resolveAvailableGeneratedImagePreference,
} from './generatedImageBilling.js';

function withCloudflareDailyFreeRequests<T>(value: number, fn: () => T): T {
    const originalValue = env.credits.dailyFreeCloudflareImageRequests;
    env.credits.dailyFreeCloudflareImageRequests = value;
    try {
        return fn();
    } finally {
        env.credits.dailyFreeCloudflareImageRequests = originalValue;
    }
}

test('GPT Image 2 requires credits from the first request', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-22',
        model: 'gpt-image-2',
        quality: 'medium',
        imageCount: 1,
        freeOutputImagesUsed: 0,
        availableCredits: 0,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'INSUFFICIENT_CREDITS');
    assert.equal(decision.freeOutputImageLimit, 0);
    assert.equal(decision.freeRequestCount, 0);
    assert.equal(decision.freeImageCount, 0);
    assert.equal(decision.billedImageCount, 1);
    assert.equal(decision.creditsCost, 1.59);
});

test('GPT Image 2 medium quality is billable when enough credits are available', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-22',
        model: 'gpt-image-2',
        quality: 'medium',
        imageCount: 1,
        freeOutputImagesUsed: 0,
        availableCredits: 2,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.freeRequestCount, 0);
    assert.equal(decision.billedImageCount, 1);
    assert.equal(decision.creditsCost, 1.59);
    assert.equal(decision.usdCost, 0.053);
});

test('GPT Image 2 high quality is billable when enough credits are available', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-22',
        model: 'gpt-image-2',
        quality: 'high',
        imageCount: 1,
        freeOutputImagesUsed: 3,
        availableCredits: 20,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.freeRequestCount, 0);
    assert.equal(decision.billedImageCount, 1);
    assert.equal(decision.creditsCost, 6.33);
    assert.equal(decision.usdCost, 0.211);
});

test('GPT Image 1 Mini requires credits from the first request', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-22',
        model: 'gpt-image-1-mini',
        quality: 'medium',
        imageCount: 2,
        freeOutputImagesUsed: 0,
        availableCredits: 1,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.freeOutputImageLimit, 0);
    assert.equal(decision.freeRequestCount, 0);
    assert.equal(decision.freeImageCount, 0);
    assert.equal(decision.billedImageCount, 2);
    assert.equal(decision.creditsCost, 0.66);
    assert.equal(decision.usdCost, 0.022);
});

test('Grok normal charges credits from the first request', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-22',
        model: 'grok-imagine-image',
        quality: 'normal',
        imageCount: 1,
        freeOutputImagesUsed: 3,
        availableCredits: 1,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.freeRequestCount, 0);
    assert.equal(decision.billedImageCount, 1);
    assert.equal(decision.creditsCost, 0.6);
    assert.equal(decision.usdCost, 0.02);
});

test('Grok pro charges credits from the first request', () => {
    const decision = buildGeneratedImageBillingDecision({
        dateUtc: '2026-04-22',
        model: 'grok-imagine-image-pro',
        quality: 'pro',
        imageCount: 1,
        freeOutputImagesUsed: 0,
        availableCredits: 3,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.freeRequestCount, 0);
    assert.equal(decision.freeImageCount, 0);
    assert.equal(decision.billedImageCount, 1);
    assert.equal(decision.creditsCost, 2.1);
    assert.equal(decision.usdCost, 0.07);
});

test('Cloudflare FLUX.2 Klein 4B uses the daily free image bucket', () => {
    withCloudflareDailyFreeRequests(3, () => {
        const decision = buildGeneratedImageBillingDecision({
            dateUtc: '2026-04-24',
            model: 'cloudflare-flux-2-klein-4b',
            quality: 'normal',
            imageCount: 1,
            freeOutputImagesUsed: 2,
            availableCredits: 0,
        });

        assert.equal(decision.allowed, true);
        assert.equal(decision.provider, 'cloudflare');
        assert.equal(decision.providerModel, 'cloudflare-flux-2-klein-4b');
        assert.equal(decision.freeOutputImageLimit, 3);
        assert.equal(decision.freeOutputImagesRemaining, 1);
        assert.equal(decision.freeRequestCount, 1);
        assert.equal(decision.freeImageCount, 1);
        assert.equal(decision.billedImageCount, 0);
        assert.equal(decision.requiresCredits, false);
        assert.equal(decision.creditsCost, 0);
        assert.equal(decision.usdCost, 0);
    });
});

test('Cloudflare FLUX.2 Klein 4B blocks after the daily free bucket is exhausted', () => {
    withCloudflareDailyFreeRequests(3, () => {
        const decision = buildGeneratedImageBillingDecision({
            dateUtc: '2026-04-24',
            model: 'cloudflare-flux-2-klein-4b',
            quality: 'normal',
            imageCount: 1,
            freeOutputImagesUsed: 3,
            availableCredits: 0,
        });

        assert.equal(decision.allowed, false);
        assert.equal(decision.reason, 'DAILY_FREE_LIMIT_EXHAUSTED');
        assert.equal(decision.freeOutputImageLimit, 3);
        assert.equal(decision.freeOutputImagesRemaining, 0);
        assert.equal(decision.billedImageCount, 0);
        assert.equal(decision.requiresCredits, false);
    });
});

test('Runware FLUX.2 Klein 9B KV charges low credits price from the first request', () => {
    withCloudflareDailyFreeRequests(3, () => {
        const decision = buildGeneratedImageBillingDecision({
            dateUtc: '2026-04-24',
            model: 'runware-flux-2-klein-9b-kv',
            quality: 'normal',
            imageCount: 1,
            freeOutputImagesUsed: 0,
            availableCredits: 0.03,
        });
        assert.equal(decision.allowed, true);
        assert.equal(decision.provider, 'runware');
        assert.equal(decision.freeRequestCount, 0);
        assert.equal(decision.billedImageCount, 1);
        assert.equal(decision.requiresCredits, true);
        assert.equal(decision.creditsCost, 0.0234);
        assert.equal(decision.usdCost, 0.00078);
    });
});

test('generated image preference normalization rejects disabled models', () => {
    assert.deepEqual(
        normalizeGeneratedImagePreference('gpt-image-2', 'high'),
        {
            model: 'gpt-image-2',
            quality: 'high',
        },
    );
    assert.deepEqual(
        normalizeGeneratedImagePreference('gpt-image-1-mini', 'high'),
        {
            model: 'gpt-image-1-mini',
            quality: 'high',
        },
    );
    assert.deepEqual(
        normalizeGeneratedImagePreference('grok-imagine-image', 'normal'),
        {
            model: 'grok-imagine-image',
            quality: 'normal',
        },
    );
    assert.deepEqual(
        normalizeGeneratedImagePreference('cloudflare-flux-2-klein-4b', 'normal'),
        {
            model: 'cloudflare-flux-2-klein-4b',
            quality: 'normal',
        },
    );
    assert.deepEqual(
        normalizeGeneratedImagePreference('runware:400@6', 'normal'),
        {
            model: 'runware-flux-2-klein-9b-kv',
            quality: 'normal',
        },
    );
});

test('available generated image preference returns the first enabled candidate', () => {
    assert.deepEqual(
        resolveAvailableGeneratedImagePreference([
            { model: 'gpt-image-2', quality: 'high' },
            { model: 'gpt-image-1-mini', quality: 'high' },
            { model: 'grok-imagine-image-pro', quality: 'pro' },
            { model: 'grok-imagine-image', quality: 'normal' },
        ]),
        {
            model: 'gpt-image-2',
            quality: 'high',
        },
    );
});

test('generated image preference normalization accepts Grok pro', () => {
    assert.deepEqual(
        normalizeGeneratedImagePreference('grok-imagine-image-pro', 'pro'),
        {
            model: 'grok-imagine-image-pro',
            quality: 'pro',
        },
    );
});
