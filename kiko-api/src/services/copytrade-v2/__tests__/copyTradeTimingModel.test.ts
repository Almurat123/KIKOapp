import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateCopyTradeDelay,
  getCopyTradeDispatchDetectedAt,
  getCopyTradeDispatchTimingAnchor,
} from '../timing/copyTradeTimingModel.js';

test('dispatch timing anchor ignores missing legacy detectedAt fallback', () => {
  const anchor = getCopyTradeDispatchTimingAnchor(undefined);
  assert.equal(anchor.timestamp, undefined);
  assert.equal(anchor.delayAnchor, 'none');

  const legacy = getCopyTradeDispatchDetectedAt(undefined, 123456789);
  assert.equal(legacy, 123456789);
});

test('delay evaluation still uses legacy detectedAt only for hard-cap accounting', () => {
  const nowMs = 200_000;
  const result = evaluateCopyTradeDelay(100_000, true, {
    maxDelayMs: 12_000,
    hardMaxDelayMs: 180_000,
  }, nowMs);

  assert.equal(result.skip, false);
  assert.equal(result.delayMs, 0);
  assert.equal(result.hardDelayMs, 100_000);
  assert.equal(result.delayAnchor, 'none');
});
