import test from 'node:test';
import assert from 'node:assert/strict';
import { __solanaSwapTest } from './solanaSwap.js';

test('normalizePriorityFeeMaxLamports sanitizes invalid values', () => {
  assert.equal(__solanaSwapTest.normalizePriorityFeeMaxLamports(undefined), undefined);
  assert.equal(__solanaSwapTest.normalizePriorityFeeMaxLamports(0), undefined);
  assert.equal(__solanaSwapTest.normalizePriorityFeeMaxLamports(-10), undefined);
  assert.equal(__solanaSwapTest.normalizePriorityFeeMaxLamports(Number.NaN), undefined);
});

test('normalizePriorityFeeMaxLamports floors positive numbers', () => {
  assert.equal(__solanaSwapTest.normalizePriorityFeeMaxLamports(100000), 100000);
  assert.equal(__solanaSwapTest.normalizePriorityFeeMaxLamports(1234.9), 1234);
});

test('resolvePriorityFeeMaxLamportsFromQuote prefers explicit field over legacy alias', () => {
  const resolved = __solanaSwapTest.resolvePriorityFeeMaxLamportsFromQuote({
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    inAmount: '1000',
    outAmount: '999',
    priceImpact: '0',
    aggregator: 'jupiter',
    priorityFeeMaxLamports: 2000,
    computeUnitPriceMicroLamports: 1000
  });
  assert.equal(resolved, 2000);
});
