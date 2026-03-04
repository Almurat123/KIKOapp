import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMirrorSellExecutionPolicy } from '../services/copytrade-v2/exit/mirrorSellExecutionPolicy.js';

describe('mirror sell execution policy', () => {
  test('allows immediate sell when follower has open attributed exposure even without pending lots', () => {
    const result = evaluateMirrorSellExecutionPolicy({
      matchedPositions: [{ id: 'pos-open', status: 'open' }],
      pendingAttributedLots: [],
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
    });

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, 'MIRROR_SELL_ALLOWED_PENDING_EXPOSURE');
    assert.equal(result.metrics.pendingAttributedLotCount, 1);
  });

  test('blocks only when follower has no attributed exposure at all', () => {
    const result = evaluateMirrorSellExecutionPolicy({
      matchedPositions: [],
      pendingAttributedLots: [],
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'MIRROR_SELL_NO_ATTRIBUTED_EXPOSURE');
  });
});
