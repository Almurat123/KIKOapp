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
