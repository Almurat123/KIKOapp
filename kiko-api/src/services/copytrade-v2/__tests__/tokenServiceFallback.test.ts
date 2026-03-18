import assert from 'node:assert/strict';
import test from 'node:test';

import { __tokenServiceTest } from '../../tokenService.js';

test('adaptive EVM on-chain price retries alternate RPC lane when the first lane returns no price', async () => {
  const calls: Array<{ strategy: string; purpose: string; importance: string }> = [];

  const result = await __tokenServiceTest.fetchAdaptiveEvmOnChainPrice({
    tokenAddress: '0xtoken',
    chainId: 56,
    rpcStrategy: 'fast',
    fastMode: false,
    async getOnChainPriceImpl(_tokenAddress, _chainId, options = {}) {
      const rpcStrategy = options.rpcStrategy as { strategy: string; purpose: string; importance: string };
      calls.push({
        strategy: String(rpcStrategy?.strategy || ''),
        purpose: String(rpcStrategy?.purpose || ''),
        importance: String(rpcStrategy?.importance || ''),
      });
      if (rpcStrategy?.strategy === 'fast') return null;
      return { price: 0.123, dexName: 'pancakeswap', marketCap: 1, pairAddress: '0xpair' };
    },
  });

  assert.equal(result?.price, 0.123);
  assert.deepEqual(calls, [
    { strategy: 'fast', purpose: 'trade_execution', importance: 'critical' },
    { strategy: 'cheap', purpose: 'trade_execution', importance: 'critical' },
  ]);
});

test('adaptive EVM on-chain price does not fan out to alternate RPC lane in fast mode', async () => {
  const calls: Array<{ strategy: string; purpose: string; importance: string }> = [];

  const result = await __tokenServiceTest.fetchAdaptiveEvmOnChainPrice({
    tokenAddress: '0xtoken',
    chainId: 56,
    rpcStrategy: 'cheap',
    fastMode: true,
    async getOnChainPriceImpl(_tokenAddress, _chainId, options = {}) {
      const rpcStrategy = options.rpcStrategy as { strategy: string; purpose: string; importance: string };
      calls.push({
        strategy: String(rpcStrategy?.strategy || ''),
        purpose: String(rpcStrategy?.purpose || ''),
        importance: String(rpcStrategy?.importance || ''),
      });
      return null;
    },
  });

  assert.equal(result, null);
  assert.deepEqual(calls, [
    { strategy: 'cheap', purpose: 'trade_execution', importance: 'critical' },
  ]);
});

test('external DEX fallback returns a usable price when primary pricing is unavailable', async () => {
  const result = await __tokenServiceTest.resolveExternalDexPriceFallback({
    tokenAddress: '0xtoken',
    chainId: 56,
    isSolana: false,
    fastMode: false,
    async getDexPriceDetailedImpl() {
      return { price: 0.456, provider: '0x-dex' } as any;
    },
  });

  assert.equal(result.price, 0.456);
  assert.equal(result.provider, '0x-dex');
});
