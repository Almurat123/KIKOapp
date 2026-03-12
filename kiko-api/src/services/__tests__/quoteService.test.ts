import assert from 'node:assert/strict';
import test from 'node:test';
import { __testOnly } from '../quoteService.js';
import type { BestQuoteParams } from '../quoteService.js';

function makeParams(overrides: Partial<BestQuoteParams> = {}): BestQuoteParams {
  return {
    tokenIn: '0x1111111111111111111111111111111111111111',
    tokenOut: '0x2222222222222222222222222222222222222222',
    actualTokenIn: '0x1111111111111111111111111111111111111111',
    actualTokenOut: '0x2222222222222222222222222222222222222222',
    amountInBase: '1000000000000000000',
    amountInHuman: 1,
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    chainId: 56,
    slippageBps: 1500,
    userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    feeContext: 'copyTrade',
    isSell: true,
    executionMode: 'turbo',
    ...overrides,
  };
}

test('quote cache key isolates wallet-specific quotes', () => {
  const a = __testOnly.buildQuoteCacheKey(makeParams({
    userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  }));
  const b = __testOnly.buildQuoteCacheKey(makeParams({
    userAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  }));

  assert.notEqual(a, b);
});

test('quote cache key keeps quote-only requests separate from wallet-bound swaps', () => {
  const quoteOnly = __testOnly.buildQuoteCacheKey(makeParams({
    userAddress: undefined,
  }));
  const execution = __testOnly.buildQuoteCacheKey(makeParams());

  assert.notEqual(quoteOnly, execution);
});

test('turbo sell bounded deadline waits for the full deadline when no quick quote arrived', () => {
  const strategy = __testOnly.resolveTurboSellWaitStrategy({
    hasQuickQuote: false,
    elapsedMs: 240,
    totalWaitMs: 1600,
    sellQuotePolicy: 'bounded_deadline',
  });

  assert.equal(strategy.mode, 'bounded_deadline');
  assert.equal(strategy.waitMs, 1360);
});

test('turbo sell fast window keeps the short retry window when a quick quote already exists', () => {
  const strategy = __testOnly.resolveTurboSellWaitStrategy({
    hasQuickQuote: true,
    elapsedMs: 180,
    totalWaitMs: 1600,
    sellQuotePolicy: 'fast_window',
  });

  assert.equal(strategy.mode, 'secondary_window');
  assert.equal(strategy.waitMs, 220);
});
