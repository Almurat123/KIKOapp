import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMirrorSellGate } from '../services/copytrade-v2/exit/mirrorSellGate.js';
import { evaluateDeferredMirrorSellIntent } from '../services/copytrade-v2/reconcile/mirrorSellReconcilePolicy.js';

describe('mirror sell gate', () => {
  test('allows immediate sell when open attributed exposure exists even without strict full-exit confirmation', () => {
    const result = evaluateMirrorSellGate([
      { id: 'pos-open', status: 'open' },
    ]);

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, 'MIRROR_SELL_ALLOWED_OPEN_EXPOSURE');
  });

  test('allows immediate sell when pending attributed exposure exists', () => {
    const result = evaluateMirrorSellGate([
      { id: 'pos-pending', status: 'pending' },
    ]);

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, 'MIRROR_SELL_ALLOWED_PENDING_EXPOSURE');
  });

  test('blocks only when no attributed exposure exists at all', () => {
    const result = evaluateMirrorSellGate([]);

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'MIRROR_SELL_NO_ATTRIBUTED_EXPOSURE');
  });
});

describe('deferred mirror sell reconcile policy', () => {
  test('history-backed sell intent still arms mirror sell when full-exit remains unverified', () => {
    const result = evaluateDeferredMirrorSellIntent({
      latestTargetSellTxHash: '0xsell',
      strictFullExit: {
        isFullExit: false,
        reasonCode: 'TARGET_BALANCE_REMAINING',
        remainingBalanceRaw: '10',
        decimals: 18,
        dustThresholdRaw: '1',
      },
    });

    assert.equal(result.disposition, 'arm_exit');
    assert.equal(result.reasonCode, 'TARGET_SELL_SEEN_IN_HISTORY_UNVERIFIED');
  });
});
