import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEntryDeviationCurrentPrice } from '../buy/entryDeviationPriceSelection.js';

test('entry deviation price selection prefers validated reference quote over fallback dex price', () => {
  const result = resolveEntryDeviationCurrentPrice({
    referencePrice: 0.00917252,
    referencePriceSource: 'local_quote_price',
    fallbackDexPrice: 9100030992.572664,
  });

  assert.equal(result.currentPrice, 0.00917252);
  assert.equal(result.currentPriceSource, 'local_quote_price');
});

test('entry deviation price selection falls back to dex price only when no reference price exists', () => {
  const result = resolveEntryDeviationCurrentPrice({
    referencePrice: 0,
    referencePriceSource: 'reference_unavailable',
    fallbackDexPrice: 0.1234,
  });

  assert.equal(result.currentPrice, 0.1234);
  assert.equal(result.currentPriceSource, 'market_oracle_price');
});

