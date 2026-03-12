import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMirrorSellExecutionPolicy } from '../services/copytrade-v2/exit/mirrorSellExecutionPolicy.js';

describe('mirror sell execution policy', () => {
  test('allows immediate sell when follower has config-scoped leader-linked exposure', () => {
    const result = evaluateMirrorSellExecutionPolicy({
      matchedPositions: [{ id: 'pos-open', status: 'open', configId: 'cfg-1', leaderTxHash: '0xleader' }],
      pendingAttributedLots: [],
      expectedConfigId: 'cfg-1',
    });

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, 'MIRROR_SELL_ALLOWED_OPEN_EXPOSURE');
    assert.equal(result.metrics.pendingAttributedLotCount, 0);
  });

  test('allows immediate sell when follower has pending attributed exposure and armed lots', () => {
    const result = evaluateMirrorSellExecutionPolicy({
      matchedPositions: [{ id: 'pos-pending', status: 'pending' }],
      pendingAttributedLots: [
        {
          id: 'lot-1',
          positionId: 'pos-pending',
          userId: 'user-1',
          chainId: 1,
          tokenAddress: '0xtoken',
          entryTxHash: '0xentry',
          status: 'sell_armed',
        },
      ],
      expectedConfigId: 'cfg-1',
    });

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, 'MIRROR_SELL_ALLOWED_PENDING_EXPOSURE');
    assert.equal(result.metrics.pendingAttributedLotCount, 1);
  });

  test('blocks unverified open exposure even when token matches', () => {
    const result = evaluateMirrorSellExecutionPolicy({
      matchedPositions: [{ id: 'pos-open', status: 'open', configId: 'cfg-1' }],
      pendingAttributedLots: [],
      expectedConfigId: 'cfg-1',
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'MIRROR_SELL_BLOCKED_UNVERIFIED_OPEN_EXPOSURE');
  });

  test('blocks positions from another config even if they are leader-linked', () => {
    const result = evaluateMirrorSellExecutionPolicy({
      matchedPositions: [{ id: 'pos-open', status: 'open', configId: 'cfg-2', leaderTxHash: '0xleader' }],
      pendingAttributedLots: [],
      expectedConfigId: 'cfg-1',
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'MIRROR_SELL_BLOCKED_UNVERIFIED_OPEN_EXPOSURE');
  });
});
