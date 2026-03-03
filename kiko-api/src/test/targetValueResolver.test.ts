import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveNativeLikeTargetValue } from '../services/copytrade/guards/targetValueResolver.js';

test('native-like target value prefers source tx value over widened cash hint on multihop routes', () => {
  const result = resolveNativeLikeTargetValue({
    broadTargetValueUsd: 3.88,
    hintedCashSpentUsd: 9.91,
    amountInUsd: 3.88,
    sourceTxValueUsd: 3.88,
    poolAmountInUsd: 3.88,
    chainId: 1,
    txHash: '0xeth',
  });

  assert.equal(result.targetSwapValueUsd, 3.88);
  assert.equal(result.strictTargetSwapValueUsd, 3.88);
  assert.equal(result.strictTargetSwapValueSource, 'native_like_source_tx_value');
  assert.equal(result.reasonCode, 'TARGET_VALUE_CASH_HINT_REJECTED_OVERCOUNT');
  assert.equal(result.metrics.hintRejected, true);
});

test('native-like target value falls back to cash hint only when no net input source exists', () => {
  const result = resolveNativeLikeTargetValue({
    broadTargetValueUsd: 0,
    hintedCashSpentUsd: 4.2,
    amountInUsd: 0,
    sourceTxValueUsd: 0,
    poolAmountInUsd: 0,
    chainId: 8453,
    txHash: '0xbase',
  });

  assert.equal(result.targetSwapValueUsd, 4.2);
  assert.equal(result.strictTargetSwapValueUsd, 4.2);
  assert.equal(result.strictTargetSwapValueSource, 'cash_leg_hint');
  assert.equal(result.reasonCode, 'TARGET_VALUE_CASH_HINT_ONLY');
});

test('native-like target value uses amountIn estimate when no other trusted source exists', () => {
  const result = resolveNativeLikeTargetValue({
    broadTargetValueUsd: 5.5,
    hintedCashSpentUsd: 0,
    amountInUsd: 5.5,
    sourceTxValueUsd: 0,
    poolAmountInUsd: 0,
    chainId: 56,
    txHash: '0xbsc',
  });

  assert.equal(result.targetSwapValueUsd, 5.5);
  assert.equal(result.strictTargetSwapValueUsd, 5.5);
  assert.equal(result.strictTargetSwapValueSource, 'native_like_amount_in');
  assert.equal(result.reasonCode, 'TARGET_VALUE_STRICT_AMOUNT_IN_SELECTED');
});
