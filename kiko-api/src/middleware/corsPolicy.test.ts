import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCorsResponseHeaders, isAllowedCorsOrigin } from './corsPolicy.js';

function createReplyMock() {
    const headers = new Map<string, string>();
    return {
        header(name: string, value: string) {
            headers.set(name.toLowerCase(), value);
            return this;
        },
        getHeader(name: string) {
            return headers.get(name.toLowerCase());
        },
    };
}

test('isAllowedCorsOrigin allows first-party web origin', () => {
    assert.equal(isAllowedCorsOrigin('https://kikoapp.app'), true);
});

test('applyCorsResponseHeaders reflects allowed origin and credentials', () => {
    const reply = createReplyMock();
    applyCorsResponseHeaders(
        { headers: { origin: 'https://kikoapp.app' } },
        reply
    );

    assert.equal(reply.getHeader('Access-Control-Allow-Origin'), 'https://kikoapp.app');
    assert.equal(reply.getHeader('Access-Control-Allow-Credentials'), 'true');
    assert.equal(reply.getHeader('Vary'), 'Origin');
});

test('applyCorsResponseHeaders leaves disallowed origin untouched', () => {
    const reply = createReplyMock();
    applyCorsResponseHeaders(
        { headers: { origin: 'https://evil.example.com' } },
        reply
    );

    assert.equal(reply.getHeader('Access-Control-Allow-Origin'), undefined);
    assert.equal(reply.getHeader('Access-Control-Allow-Credentials'), undefined);
});
