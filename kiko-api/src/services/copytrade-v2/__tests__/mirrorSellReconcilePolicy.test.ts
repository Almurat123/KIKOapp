import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateDeferredMirrorSellIntent } from '../reconcile/mirrorSellReconcilePolicy.js';

test('deferred mirror sell intent executes immediately for verified history', () => {
  const result = evaluateDeferredMirrorSellIntent({
    latestTargetSellTxHash: '0xsell',
    strictFullExit: { isFullExit: true, reasonCode: 'TARGET_FULL_EXIT_CONFIRMED' } as any,
  });

  assert.deepEqual(result, {
    disposition: 'execute_immediately',
    targetSellTxHash: '0xsell',
    reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY',
  });
});

test('deferred mirror sell intent only arms exit for unverified history', () => {
  const result = evaluateDeferredMirrorSellIntent({
    latestTargetSellTxHash: '0xsell',
    strictFullExit: { isFullExit: false, reasonCode: 'TARGET_BALANCE_REMAINING' } as any,
  });

  assert.deepEqual(result, {
    disposition: 'arm_exit',
    targetSellTxHash: '0xsell',
    reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY_UNVERIFIED',
  });
});
