import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNonceFloor } from '../nonceFloorPolicy.js';

test('nonce floor policy upgrades stale trade nonce to cached floor', () => {
    const result = resolveNonceFloor({
        requestedNonce: '2',
        cachedFloorNonce: '3',
        txPurpose: 'trade',
    });

    assert.equal(result.upgraded, true);
    assert.equal(result.nonce, '3');
    assert.equal(result.reason, 'floor_applied');
});

test('nonce floor policy preserves speedup nonce for replacement semantics', () => {
    const result = resolveNonceFloor({
        requestedNonce: '2',
        cachedFloorNonce: '3',
        txPurpose: 'speedup',
    });

    assert.equal(result.upgraded, false);
    assert.equal(result.nonce, '2');
    assert.equal(result.reason, 'speedup_preserved');
});

test('nonce floor policy preserves nonce after prior accepted send', () => {
    const result = resolveNonceFloor({
        requestedNonce: '2',
        cachedFloorNonce: '3',
        txPurpose: 'trade',
        hasPriorAcceptedLifecycle: true,
    });

    assert.equal(result.upgraded, false);
    assert.equal(result.nonce, '2');
    assert.equal(result.reason, 'replacement_preserved');
});
