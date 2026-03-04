import assert from 'node:assert/strict';
import test from 'node:test';
import { normalPolicy } from '../policies/modes/normalPolicy.js';
import { resolveRetryAt, resolveRetryDelayMs } from '../order-flow/scheduler.js';

test('scheduler: retry delay grows with attempt number', () => {
  const d1 = resolveRetryDelayMs(normalPolicy, 1);
  const d2 = resolveRetryDelayMs(normalPolicy, 2);
  const d3 = resolveRetryDelayMs(normalPolicy, 3);

  assert.equal(d2 > d1, true);
  assert.equal(d3 > d2, true);
});

test('scheduler: resolveRetryAt applies delay on top of now', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const retryAt = resolveRetryAt(normalPolicy, 1, now);
  assert.equal(retryAt.getTime(), now + resolveRetryDelayMs(normalPolicy, 1));
});
