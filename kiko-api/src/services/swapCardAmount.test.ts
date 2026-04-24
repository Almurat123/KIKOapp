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

test('resolveDisplayedAmountOut keeps quoted amount when settled amount is rounded to zero', () => {
  assert.equal(resolveDisplayedAmountOut({
    status: 'success',
    currentAmountOut: '0.010627563013151585',
    settledAmountOut: '0.00',
  }), '0.010627563013151585');
});

test('resolveDisplayedAmountOut keeps quoted amount when settled amount looks like raw base units', () => {
  assert.equal(resolveDisplayedAmountOut({
    status: 'success',
    currentAmountOut: '7647801510.662393331',
    settledAmountOut: '7647801510662393331',
  }), '7647801510.662393331');
});
