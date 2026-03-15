import assert from 'node:assert/strict';
import test from 'node:test';

import { __sellQuotePreheatStateTest } from '../sellQuotePreheatState.js';

test('sellQuotePreheatState builds a stable wallet-token scoped key', () => {
  const a = __sellQuotePreheatStateTest.buildSellQuotePreheatStateKey({
    chainId: 8453,
    walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
    tokenAddress: '0x7bbaad1cd9deb7de5567f0cac6d7a7c7a3535ba3',
  });
  const b = __sellQuotePreheatStateTest.buildSellQuotePreheatStateKey({
    chainId: 8453,
    walletAddress: '0xa386bc9d8f26ab170a847d73226e3e0bceb0fe8e',
    tokenAddress: '0x7BBAAD1CD9DEB7DE5567F0CAC6D7A7C7A3535BA3',
  });

  assert.equal(a, b);
});

test('sellQuotePreheatState returns warm quote only for exact-match fresh amounts', () => {
  const warmQuote = {
    dex: '0x',
    dexName: '0x Aggregator',
    amountOut: '1',
    amountOutBase: '1',
    gasEstimate: 123,
    priceImpact: 0,
    path: ['a', 'b'] as string[],
    router: '0xrouter',
    data: '0x1234',
    to: '0xto',
    value: '0',
    allowanceTarget: '0xallowance',
    deadline: Date.now(),
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
  };

  const usable = __sellQuotePreheatStateTest.getUsableWarmSellQuote({
    state: {
      chainId: 8453,
      walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
      tokenAddress: '0x7BBAAD1CD9DEB7DE5567F0CAC6D7A7C7A3535BA3',
      amountInBase: '100',
      preferredDexes: ['0x'],
      warmQuote,
      warmedAt: new Date(Date.now() - 500).toISOString(),
    },
    amountInBase: '100',
    now: Date.now(),
  });
  const mismatched = __sellQuotePreheatStateTest.getUsableWarmSellQuote({
    state: {
      chainId: 8453,
      walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
      tokenAddress: '0x7BBAAD1CD9DEB7DE5567F0CAC6D7A7C7A3535BA3',
      amountInBase: '100',
      preferredDexes: ['0x'],
      warmQuote,
      warmedAt: new Date(Date.now() - 500).toISOString(),
    },
    amountInBase: '101',
    now: Date.now(),
  });

  assert.equal(usable?.dexName, '0x Aggregator');
  assert.equal(mismatched, null);
});
