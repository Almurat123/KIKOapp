import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCopytradeDomainAuditFields } from '../services/copytrade-v2/audit/copytradeDomainAudit.js';

describe('copytrade domain audit', () => {
  test('builds unified business audit fields from ledger and lifecycle inputs', () => {
    const fields = buildCopytradeDomainAuditFields({
      ledger: {
        chainId: 8453,
        tokenAddress: '0xtoken',
        userId: 'did:test',
        positionIds: ['p1'],
        positions: [],
        pendingLots: [],
        latestTargetSellTxHash: '0xsell',
        latestTargetSellAt: new Date(),
        lifecyclePhase: 'open_only',
        metrics: {
          openPositionCount: 1,
          pendingLotCount: 0,
          armedPendingLotCount: 0,
          sellArmedPendingLotCount: 0,
          confirmedOwnedAmountRaw: 1000n,
          pendingOwnedAmountRaw: 0n,
          effectiveOwnedAmountRaw: 1000n,
          trackedEntryRaw: 1000n,
          trackedRemainingRaw: 1000n,
          trackedSoldRaw: 0n,
        },
        reasonCode: 'LEDGER_OPEN_ONLY',
      },
      txLifecycle: {
        status: 'confirmed_success',
        txHash: '0xabc',
        attempts: 1,
        chainId: 8453,
      },
      extra: {
        tokenAddress: '0xtoken',
      },
    });

    assert.equal(fields.ledgerLifecyclePhase, 'open_only');
    assert.equal(fields.executionLifecycleState, 'confirmed_success');
    assert.equal(fields.latestTargetSellTxHash, '0xsell');
    assert.equal(fields.ledgerEffectiveOwnedAmountRaw, '1000');
  });
});
