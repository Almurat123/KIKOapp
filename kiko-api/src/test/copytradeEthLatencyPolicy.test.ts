import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCopyTradeDelay } from '../services/copytrade-v2/timing/copyTradeTimingModel.js';

describe('copytrade eth latency policy', () => {
  test('eth mainnet uses latency-first dispatch cutoff', () => {
    const nowMs = 10_000;
    const result = evaluateCopyTradeDelay(
      {
        chainId: 1,
        firstSeenAt: 6_500,
        swapReadyAt: 7_000,
        dispatchEligibleAt: 7_000,
        enqueuedAt: 7_000,
        source: 'webhook_decode',
      },
      false,
      {
        maxDelayMs: 45_000,
        hardMaxDelayMs: 180_000,
      },
      nowMs,
    );

    assert.equal(result.skip, true);
    assert.equal(result.reasonCode, 'copytrade_delay_exceeded_dispatch');
    assert.equal(result.maxDelayMs, 2_500);
  });

  test('non-eth chains retain default delay policy', () => {
    const nowMs = 10_000;
    const result = evaluateCopyTradeDelay(
      {
        chainId: 8453,
        firstSeenAt: 6_500,
        swapReadyAt: 7_000,
        dispatchEligibleAt: 7_000,
        enqueuedAt: 7_000,
        source: 'webhook_decode',
      },
      false,
      {
        maxDelayMs: 45_000,
        hardMaxDelayMs: 180_000,
      },
      nowMs,
    );

    assert.equal(result.skip, false);
    assert.equal(result.maxDelayMs, 45_000);
  });
});
