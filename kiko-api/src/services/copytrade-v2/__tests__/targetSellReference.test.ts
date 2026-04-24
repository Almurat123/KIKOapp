import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildMirrorSellSourceAnchor, coerceMirrorSellSourceAnchor } from '../exit/targetSellReference.js';

test('mirror sell source anchor captures target execution ratio from decoded sell', () => {
  const anchor = buildMirrorSellSourceAnchor({
    sourceTxHash: '0xabc',
    tokenIn: '0xtoken',
    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    amountIn: '200000000000000000000',
    amountOut: '1000000000000000000',
  });

  assert.deepEqual(anchor, {
    sourceTxHash: '0xabc',
    sourceTokenIn: '0xtoken',
    sourceTokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    sourceAmountIn: '200000000000000000000',
    sourceAmountOut: '1000000000000000000',
    reasonCode: 'target_sell_reference_ready',
  });
});

test('mirror sell source anchor skips when decoded target output is unavailable', () => {
  const anchor = buildMirrorSellSourceAnchor({
    sourceTxHash: '0xabc',
    tokenIn: '0xtoken',
    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    amountIn: '200000000000000000000',
    amountOut: '0',
  });

  assert.equal(anchor, null);
});

test('mirror sell source anchor coercion rejects malformed metadata', () => {
  assert.equal(coerceMirrorSellSourceAnchor({
    sourceTokenIn: '0xtoken',
    sourceTokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    sourceAmountIn: '200000000000000000000',
    sourceAmountOut: '0',
  }), null);
});
