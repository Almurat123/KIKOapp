import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateStaleBuySignal } from '../buy/staleBuyPolicy.js';

test('stale buy policy skips buys older than configured max age', () => {
  const sourceBlockTimestampMs = 1_700_000_000_000;
  const decision = evaluateStaleBuySignal({
    isBuy: true,
    sourceBlockTimestampMs,
    nowMs: sourceBlockTimestampMs + 122_500,
    maxAgeMs: 120_000,
  });

  assert.equal(decision.skip, true);
  assert.equal(decision.reasonCode, 'stale_target_buy_signal');
  assert.equal(decision.signalAgeMs, 122_500);
});

test('stale buy policy allows fresh buys within max age', () => {
  const sourceBlockTimestampMs = 1_700_000_000_000;
  const decision = evaluateStaleBuySignal({
    isBuy: true,
    sourceBlockTimestampMs,
    nowMs: sourceBlockTimestampMs + 119_000,
    maxAgeMs: 120_000,
  });

  assert.equal(decision.skip, false);
  assert.equal(decision.signalAgeMs, 119_000);
});

test('stale buy policy never skips when block timestamp is unavailable', () => {
  const decision = evaluateStaleBuySignal({
    isBuy: true,
    sourceBlockTimestampMs: undefined,
    nowMs: 500_000,
    maxAgeMs: 120_000,
  });

  assert.equal(decision.skip, false);
  assert.equal(decision.signalAgeMs, null);
});
