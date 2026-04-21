import test from 'node:test';
import assert from 'node:assert/strict';

import { __generateImageFromIntentTest } from './generateImageFromIntent.js';

test('generated image source stays web chat when only linked Farcaster profile exists', () => {
    const source = __generateImageFromIntentTest.resolveGeneratedImageSource(
        {
            currentPage: '/',
            pageContext: 'KIKO | /',
            farcaster: {
                fid: 1576616,
                username: 'kikoapp',
            },
        },
        {
            runtime: {
                farcaster: {
                    fid: 1576616,
                    username: 'kikoapp',
                },
            },
        },
    );

    assert.equal(source, 'chat-v2-tool');
});

test('generated image source uses Farcaster for explicit Farcaster runtime page', () => {
    const source = __generateImageFromIntentTest.resolveGeneratedImageSource({
        currentPage: 'farcaster',
        pageContext: 'farcaster_agent',
    });

    assert.equal(source, 'farcaster');
});

test('generated image source uses Farcaster from snapshot page context', () => {
    const source = __generateImageFromIntentTest.resolveGeneratedImageSource(
        {},
        {
            runtime: {
                currentPage: 'chat',
                pageContext: 'farcaster_agent',
            },
        },
    );

    assert.equal(source, 'farcaster');
});

test('generated image tool prefers GPT Image 1 Mini for OpenAI chat sessions', () => {
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('gpt-5.4-mini-2026-03-17'),
        'gpt-image-1-mini',
    );
});

test('generated image tool still defaults to GPT Image 1 Mini for non-OpenAI chat sessions', () => {
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('grok-4-1-fast-non-reasoning'),
        'gpt-image-1-mini',
    );
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('kimi-k2-5-instant'),
        'gpt-image-1-mini',
    );
});

test('generated image tool honors saved image model preferences from tool context', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreference({
            generatedImagePreference: {
                model: 'grok-imagine-image',
                quality: 'normal',
            },
        }, 'gpt-5.4-mini-2026-03-17'),
        {
            requestedModel: 'grok-imagine-image',
            quality: 'normal',
        },
    );
});

test('generated image tool falls back when saved image preference is disabled', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreference({
            generatedImagePreference: {
                model: 'gpt-image-1.5',
                quality: 'high',
            },
        }, 'gpt-5.4-mini-2026-03-17'),
        {
            requestedModel: 'gpt-image-1-mini',
            quality: 'medium',
        },
    );
});

test('generated image tool falls back to GPT image when reference inputs are present and saved model cannot edit', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreferenceWithOptions({
            generatedImagePreference: {
                model: 'grok-imagine-image',
                quality: 'normal',
            },
        }, 'gpt-5.4-mini-2026-03-17', {
            hasReferenceInputs: true,
        }),
        {
            requestedModel: 'gpt-image-1-mini',
            quality: 'medium',
        },
    );
});
