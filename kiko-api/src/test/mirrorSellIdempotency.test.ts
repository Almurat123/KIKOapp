import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMirrorSellIdempotencyKeys,
  claimMirrorSellIdempotency,
  resetMirrorSellIdempotencyStateForTests,
  settleMirrorSellIdempotency,
} from '../services/copytrade-v2/exit/mirrorSellIdempotency.js';

describe('mirror sell idempotency', () => {
  beforeEach(() => {
    resetMirrorSellIdempotencyStateForTests();
  });

  test('blocks duplicate inflight attempts for the same (positionId,targetSellTxHash)', () => {
    const keys = buildMirrorSellIdempotencyKeys({
      positionIds: ['pos-1'],
      targetSellTxHash: '0xabc',
    });
    const first = claimMirrorSellIdempotency({ keys, nowMs: 1_000, minRetryIntervalMs: 60_000 });
    assert.equal(first.allowed, true);

    const second = claimMirrorSellIdempotency({ keys, nowMs: 1_100, minRetryIntervalMs: 60_000 });
    assert.equal(second.allowed, false);
    assert.equal(second.blockedReason, 'inflight');
  });

  test('enforces cooldown after unresolved attempt and allows retry later', () => {
    const keys = buildMirrorSellIdempotencyKeys({
      positionIds: ['pos-2'],
      targetSellTxHash: '0xdef',
    });
    const first = claimMirrorSellIdempotency({ keys, nowMs: 10_000, minRetryIntervalMs: 20_000 });
    assert.equal(first.allowed, true);

    settleMirrorSellIdempotency({
      keys,
      finalityState: 'retryable_unresolved',
      nowMs: 10_100,
      minRetryIntervalMs: 20_000,
    });

    const blocked = claimMirrorSellIdempotency({ keys, nowMs: 25_000, minRetryIntervalMs: 20_000 });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.blockedReason, 'cooldown');

    const allowedLater = claimMirrorSellIdempotency({ keys, nowMs: 31_000, minRetryIntervalMs: 20_000 });
    assert.equal(allowedLater.allowed, true);
  });
});

