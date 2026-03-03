import test from 'node:test';
import assert from 'node:assert/strict';

import { computeUsdPriceFromQuote } from '../services/pricing/evmUsdPriceMath.js';

test('computes ETH mainnet UNI price without integer truncation', () => {
  const price = computeUsdPriceFromQuote({
    buyAmount: '3818778',
    sellAmount: '1000000000000000000',
    buyTokenDecimals: 6,
    sellTokenDecimals: 18,
  });

  assert.equal(Number(price.toFixed(6)), 3.818778);
});

test('supports non-18-decimal sell tokens correctly', () => {
  const price = computeUsdPriceFromQuote({
    buyAmount: '1234500',
    sellAmount: '1000000',
    buyTokenDecimals: 6,
    sellTokenDecimals: 6,
  });

  assert.equal(Number(price.toFixed(4)), 1.2345);
});

test('returns zero for invalid quote amounts', () => {
  const price = computeUsdPriceFromQuote({
    buyAmount: '0',
    sellAmount: '1000000',
    buyTokenDecimals: 6,
    sellTokenDecimals: 6,
  });

  assert.equal(price, 0);
});
