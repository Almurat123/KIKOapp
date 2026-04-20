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

test('generated image tool defaults to GPT image when the current chat model is OpenAI', () => {
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('gpt-5.4-mini-2026-03-17'),
        'gpt-image-1.5',
    );
});

test('generated image tool keeps Grok image when the current chat model is non-OpenAI', () => {
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('grok-4-1-fast-non-reasoning'),
        'grok-imagine-image',
    );
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('kimi-k2-5-instant'),
        'grok-imagine-image',
    );
});
