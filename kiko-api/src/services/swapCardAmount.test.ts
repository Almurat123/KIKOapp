import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDisplayedAmountOut } from './swapCardAmount.js';

test('resolveDisplayedAmountOut keeps quoted amount during pending states', () => {
  assert.equal(resolveDisplayedAmountOut({
    status: 'pending',
    currentAmountOut: '8779.58',
    settledAmountOut: '5794.55',
  }), '8779.58');
});

test('resolveDisplayedAmountOut uses settled amount only on success', () => {
  assert.equal(resolveDisplayedAmountOut({
    status: 'success',
    currentAmountOut: '8779.58',
    settledAmountOut: '5794.55',
  }), '5794.55');
});
