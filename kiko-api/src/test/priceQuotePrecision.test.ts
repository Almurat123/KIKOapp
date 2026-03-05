import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeUsdPriceFromRawQuote,
  resolveAdaptivePriceSampleSellAmountRaw,
} from '../services/zeroEx.js';

describe('price quote precision helpers', () => {
  test('rescales tiny quotes to avoid micro-USDC quantization drift', () => {
    const oneTokenRaw = '1000000000000000000'; // 1 token @ 18 decimals
    const firstQuoteBuyRaw = '3'; // 0.000003 USDC (very coarse)

    const adaptive = resolveAdaptivePriceSampleSellAmountRaw({
      baseSellAmountRaw: oneTokenRaw,
      quotedBuyAmountRaw: firstQuoteBuyRaw,
    });

    assert.equal(adaptive.resampled, true);
    assert.equal(adaptive.multiplier > 1n, true);

    const coarse = computeUsdPriceFromRawQuote({
      sellAmountRaw: oneTokenRaw,
      buyAmountRaw: firstQuoteBuyRaw,
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
    });

    // Simulate refined quote result after resampling.
    const refined = computeUsdPriceFromRawQuote({
      sellAmountRaw: adaptive.sellAmountRaw,
      buyAmountRaw: '118294',
      sellTokenDecimals: 18,
      buyTokenDecimals: 6,
    });

    assert.equal(coarse, 0.000003);
    assert.equal(refined > coarse, true);
    assert.equal(refined > 0.0000035 && refined < 0.0000036, true);
  });

  test('keeps decimals-aware ratio for non-18 tokens', () => {
    const price = computeUsdPriceFromRawQuote({
      sellAmountRaw: '1000000000', // 1 token @ 9 decimals
      buyAmountRaw: '2500000', // 2.5 USDC @ 6 decimals
      sellTokenDecimals: 9,
      buyTokenDecimals: 6,
    });

    assert.equal(price, 2.5);
  });

  test('does not resample when quote already has enough precision', () => {
    const adaptive = resolveAdaptivePriceSampleSellAmountRaw({
      baseSellAmountRaw: '1000000000000000000',
      quotedBuyAmountRaw: '250000', // 0.25 USDC
    });

    assert.equal(adaptive.resampled, false);
    assert.equal(adaptive.multiplier, 1n);
  });
});
