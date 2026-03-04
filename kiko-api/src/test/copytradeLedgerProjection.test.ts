import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { projectCopytradeLedgerSnapshot } from '../services/copytrade/ledger/copytradeLedgerProjector.js';

describe('copytrade ledger projection', () => {
  test('prefers confirmed owned amount when open position and pending lot coexist', () => {
    const projected = projectCopytradeLedgerSnapshot({
      chainId: 8453,
      tokenAddress: '0xtoken',
      userId: 'did:test',
      positionIds: ['p1'],
      positions: [
        {
          id: 'p1',
          tokenAddress: '0xtoken',
          status: 'open',
          entryAmountExact: '1000',
          entryAmountDec: '0',
        },
      ],
      pendingLots: [
        {
          id: 'lot1',
          positionId: 'p1',
          userId: 'did:test',
          chainId: 8453,
          tokenAddress: '0xtoken',
          status: 'sell_armed',
          expectedAmountRaw: '800',
        },
      ] as any,
      latestTargetSellTxHash: '0xsell',
      latestTargetSellAt: new Date(),
      lifecyclePhase: 'mixed',
    });

    assert.equal(projected.metrics.confirmedOwnedAmountRaw, 1000n);
    assert.equal(projected.metrics.pendingOwnedAmountRaw, 800n);
    assert.equal(projected.metrics.effectiveOwnedAmountRaw, 1000n);
    assert.equal(projected.reasonCode, 'LEDGER_MIXED');
  });
});
