import test from 'node:test';
import assert from 'node:assert/strict';

import { isPublicGeneratedImageProxyRequest } from './originRestriction.js';

test('public generated-image proxy fetches are path-scoped read-only bypasses', () => {
    assert.equal(
        isPublicGeneratedImageProxyRequest({
            method: 'GET',
            url: '/api/chat/generated-images/public/chat-uploads/generated-public/farcaster/user/day/message.png',
        } as any),
        true,
    );
    assert.equal(
        isPublicGeneratedImageProxyRequest({
            method: 'HEAD',
            url: '/api/chat/generated-images/public/chat-uploads/generated-public/farcaster/user/day/message.png',
        } as any),
        true,
    );
    assert.equal(
        isPublicGeneratedImageProxyRequest({
            method: 'POST',
            url: '/api/chat/generated-images/public/chat-uploads/generated-public/farcaster/user/day/message.png',
        } as any),
        false,
    );
    assert.equal(
        isPublicGeneratedImageProxyRequest({
            method: 'GET',
            url: '/api/chat/uploads/images/prepare',
        } as any),
        false,
    );
});
