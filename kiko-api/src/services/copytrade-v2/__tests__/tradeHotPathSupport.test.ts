import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveTurboMetadataFallbackInfo,
  scheduleAsyncMarketCapHydration,
} from '../buy/tradeHotPathSupport.js';
import { TRADE_METADATA_PROFILE } from '../../rpc/profile.js';

test('resolveTurboMetadataFallbackInfo returns metadata immediately when available within budget', async () => {
  const result = await resolveTurboMetadataFallbackInfo({
    tokenAddress: '0xtoken',
    metadataPromise: Promise.resolve({ name: 'Token', symbol: 'TOK', decimals: 6 }),
    timeoutMs: 200,
    metadataProfile: TRADE_METADATA_PROFILE,
    async getTokenDecimals() {
      assert.fail('getTokenDecimals should not be called when metadata resolves in time');
    },
    chainId: 8453,
  });

  assert.equal(result.metadataTimedOut, false);
  assert.equal(result.tokenInfo.symbol, 'TOK');
  assert.equal(result.tokenInfo.decimals, 6);
  assert.equal(result.tokenInfo.provider, 'rpc-metadata');
});

test('resolveTurboMetadataFallbackInfo falls back to fast decimals when metadata times out', async () => {
  let decimalsCalls = 0;
  const result = await resolveTurboMetadataFallbackInfo({
    tokenAddress: '0xtoken',
    metadataPromise: new Promise((resolve) => setTimeout(() => resolve({ name: 'Late', symbol: 'LATE', decimals: 9 }), 200)),
    timeoutMs: 20,
    metadataProfile: TRADE_METADATA_PROFILE,
    async getTokenDecimals(_chainId, _address, options) {
      decimalsCalls += 1;
      assert.equal(options?.profile?.purpose, 'trade_execution');
      return 9;
    },
    chainId: 8453,
  });

  assert.equal(decimalsCalls, 1);
  assert.equal(result.metadataTimedOut, true);
  assert.equal(result.tokenInfo.symbol, 'UNKNOWN');
  assert.equal(result.tokenInfo.decimals, 9);
  assert.equal(result.tokenInfo.provider, 'rpc-metadata-timeout');
});

test('scheduleAsyncMarketCapHydration resolves market cap without blocking caller flow', async () => {
  const observed: Array<{ marketCap: number; totalSupply: number }> = [];
  let capturedProfilePurpose = '';

  scheduleAsyncMarketCapHydration({
    chainId: 8453,
    tokenAddress: '0xtoken',
    impliedPrice: 0.25,
    decimals: 18,
    async getTokenSupply(_chainId, _address, options) {
      capturedProfilePurpose = String(options?.profile?.purpose || '');
      return 400;
    },
    profile: TRADE_METADATA_PROFILE,
    onResolved(marketCap, totalSupply) {
      observed.push({ marketCap, totalSupply });
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(capturedProfilePurpose, 'trade_execution');
  assert.deepEqual(observed, [{ marketCap: 100, totalSupply: 400 }]);
});
