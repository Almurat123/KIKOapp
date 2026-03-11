import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePendingNonce } from '../pendingNonceResolution.js';

test('pending nonce resolution keeps cached floor when rpc is stale', () => {
    const result = resolvePendingNonce({
        cachedNonce: '84',
        rpcNonce: '83'
    });

    assert.equal(result.nonce, '84');
    assert.equal(result.source, 'merged');
});

test('pending nonce resolution accepts higher rpc nonce', () => {
    const result = resolvePendingNonce({
        cachedNonce: '84',
        rpcNonce: '85'
    });

    assert.equal(result.nonce, '85');
    assert.equal(result.source, 'merged');
});

test('pending nonce resolution falls back to cached nonce when rpc fails', () => {
    const result = resolvePendingNonce({
        cachedNonce: '84'
    });

    assert.equal(result.nonce, '84');
    assert.equal(result.source, 'cached');
});
