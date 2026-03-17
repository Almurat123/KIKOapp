import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloneTargetSellEventReconcileMetadata,
  getTargetSellEventConfigReconcileState,
  isTargetSellEventConfigDue,
  markTargetSellEventConfigResolved,
  markTargetSellEventConfigRetry,
} from '../exit/targetSellEventReconcileState.js';

test('target sell event retry state backs off after first missing-evidence attempt', () => {
  const metadata = cloneTargetSellEventReconcileMetadata(null);
  const now = new Date('2026-03-17T06:00:00.000Z');

  const result = markTargetSellEventConfigRetry({
    metadata,
    configId: 'cfg-1',
    blockedReason: 'missing_follower_evidence',
    reasonCode: 'orphan_recovery_evidence_missing',
    now,
  });

  const state = getTargetSellEventConfigReconcileState(metadata, 'cfg-1');
  assert.equal(result.exhausted, false);
  assert.equal(result.attemptCount, 1);
  assert.equal(result.shouldAudit, true);
  assert.equal(state.status, 'retry_wait');
  assert.equal(state.attemptCount, 1);
  assert.equal(state.lastBlockedReason, 'missing_follower_evidence');
  assert.equal(state.lastReasonCode, 'orphan_recovery_evidence_missing');
  assert.equal(isTargetSellEventConfigDue(metadata, 'cfg-1', now.getTime()), false);
});

test('target sell event retry state exhausts after bounded attempts', () => {
  const metadata = cloneTargetSellEventReconcileMetadata(null);
  const now = new Date('2026-03-17T06:00:00.000Z');

  let finalResult = null as ReturnType<typeof markTargetSellEventConfigRetry> | null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    finalResult = markTargetSellEventConfigRetry({
      metadata,
      configId: 'cfg-1',
      blockedReason: 'missing_follower_evidence',
      reasonCode: 'orphan_recovery_evidence_missing',
      now: new Date(now.getTime() + attempt * 60_000),
    });
  }

  const state = getTargetSellEventConfigReconcileState(metadata, 'cfg-1');
  assert.ok(finalResult);
  assert.equal(finalResult?.exhausted, true);
  assert.equal(finalResult?.shouldAudit, true);
  assert.equal(state.status, 'exhausted');
  assert.equal(state.attemptCount, 4);
  assert.equal(isTargetSellEventConfigDue(metadata, 'cfg-1', now.getTime() + 10 * 60_000), false);
});

test('target sell event resolved state stops future retries immediately', () => {
  const metadata = cloneTargetSellEventReconcileMetadata(null);
  const now = new Date('2026-03-17T06:00:00.000Z');

  markTargetSellEventConfigResolved({
    metadata,
    configId: 'cfg-1',
    blockedReason: 'scheduled',
    reasonCode: 'mirror_sell_intent_scheduled',
    now,
  });

  const state = getTargetSellEventConfigReconcileState(metadata, 'cfg-1');
  assert.equal(state.status, 'resolved');
  assert.equal(state.lastBlockedReason, 'scheduled');
  assert.equal(state.lastReasonCode, 'mirror_sell_intent_scheduled');
  assert.equal(isTargetSellEventConfigDue(metadata, 'cfg-1', now.getTime() + 60_000), false);
});
