import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveCopyTradeQueuePriority } from '../services/copytrade-v2/eth/ethBuyFastPath.js';
import { buildEthAwarePendingPollPlan } from '../services/copytrade-v2/eth/ethPendingIngressPolicy.js';

describe('copytrade eth execution policy', () => {
  test('polls eth on every tick while rotating non-eth chains', () => {
    const first = buildEthAwarePendingPollPlan({
      chainIds: [1, 56, 8453],
      cursor: 0,
    });
    const second = buildEthAwarePendingPollPlan({
      chainIds: [1, 56, 8453],
      cursor: first.nextCursor,
    });

    assert.deepEqual(first.chainIdsToPoll, [1, 56]);
    assert.deepEqual(second.chainIdsToPoll, [1, 8453]);
  });

  test('prioritizes eth pending-prefetch queue tasks ahead of webhook tasks', () => {
    const pendingPriority = resolveCopyTradeQueuePriority({
      chainId: 1,
      source: 'pending_prefetch',
    });
    const webhookPriority = resolveCopyTradeQueuePriority({
      chainId: 1,
      source: 'webhook_decode',
    });
    const basePriority = resolveCopyTradeQueuePriority({
      chainId: 8453,
      source: 'pending_prefetch',
    });

    assert.equal(pendingPriority > webhookPriority, true);
    assert.equal(webhookPriority > basePriority, true);
  });
});
