import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveTokenDisplayMetadata } from './tokens.js';

test('resolveTokenDisplayMetadata prefers cached token-page metadata for address cards', async () => {
  const resolved = await resolveTokenDisplayMetadata('0xFCa95aeb5bF44aE355806A5ad14659c940dC6BF7', 8453, {
    findCachedTrendingToken: async (query, chain) => {
      assert.equal(query, '0xFCa95aeb5bF44aE355806A5ad14659c940dC6BF7');
      assert.equal(chain, 'base');
      return {
        address: '0xFCa95aeb5bF44aE355806A5ad14659c940dC6BF7',
        symbol: 'SHIB',
        name: 'Shiba Inu',
        network: 'base',
        imageUrl: 'https://example.com/shib.png',
      } as any;
    },
    getDetectedTokenInfo: async () => {
      throw new Error('token detector should not be needed when cache has metadata');
    },
  });

  assert.deepEqual(resolved, {
    symbol: 'SHIB',
    logoURI: 'https://example.com/shib.png',
  });
});

test('resolveTokenDisplayMetadata prefers cached token-page metadata for symbol cards', async () => {
  const resolved = await resolveTokenDisplayMetadata('virtual', 8453, {
    findCachedTrendingToken: async (query, chain) => {
      assert.equal(query, 'virtual');
      assert.equal(chain, 'base');
      return {
        address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
        symbol: 'VIRTUAL',
        name: 'Virtual Protocol',
        network: 'base',
        imageUrl: 'https://example.com/virtual-cache.png',
      } as any;
    },
    searchDexTokens: async () => {
      throw new Error('DexScreener search should not be needed when cache has metadata');
    },
  });

  assert.deepEqual(resolved, {
    symbol: 'VIRTUAL',
    logoURI: 'https://example.com/virtual-cache.png',
  });
});
