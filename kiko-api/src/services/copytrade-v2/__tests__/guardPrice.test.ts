import assert from 'node:assert/strict';
import test from 'node:test';

import { getGuardPriceSnapshot } from '../runtime/guardPrice.js';

test('getGuardPriceSnapshot falls back to dex price when token info is unavailable', async () => {
  const snapshot = await getGuardPriceSnapshot('0xtoken', 8453, {
    priority: 'high',
    deps: {
      getTokenPriceSnapshot: () => null,
      getTokenInfo: async () => null as any,
      getDexPriceDetailed: async () => ({
        price: 0.1234,
        provider: 'dexscreener-monitor',
      }),
      getTokenMetadata: async () => ({
        name: 'Token',
        symbol: 'TOK',
        decimals: 18,
      }) as any,
    },
  });

  assert.deepEqual(snapshot, {
    price: 0.1234,
    provider: 'dexscreener-monitor',
    symbol: 'TOK',
    decimals: 18,
    priceValidationReason: null,
    referencePrice: null,
    referenceProvider: null,
    priceFallbackUsed: true,
  });
});

test('getGuardPriceSnapshot returns null when both token info and fallback price are unavailable', async () => {
  const snapshot = await getGuardPriceSnapshot('0xtoken', 56, {
    priority: 'high',
    deps: {
      getTokenPriceSnapshot: () => null,
      getTokenInfo: async () => null as any,
      getDexPriceDetailed: async () => ({
        price: 0,
        provider: 'unavailable',
      }),
      getTokenMetadata: async () => ({
        name: 'Token',
        symbol: 'TOK',
        decimals: 18,
      }) as any,
    },
  });

  assert.equal(snapshot, null);
});
