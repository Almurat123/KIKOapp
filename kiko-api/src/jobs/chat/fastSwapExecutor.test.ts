import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareFastSwapExecution } from './fastSwapExecutor.js';

test('prepareFastSwapExecution resolves sell-without-amount to exact balance instead of tiny default', async () => {
  const tokenAddress = '0x950e88438098bc08879243984a3cf7c63eb95ba3';
  const prepared = await prepareFastSwapExecution({
    parsedIntent: {
      detailed: { action: 'swap' },
      swapIntent: {
        tokenIn: tokenAddress,
        tokenOut: 'ETH',
      },
      contractAddress: tokenAddress,
      chainId: 8453,
    },
    lastUserMessage: `Sell ${tokenAddress} to ETH`,
    taskToolContext: {
      userId: 'user-1',
      walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
      chainId: 8453,
    },
    chainIdMap: { 8453: 'base' },
    findSnapshotBalance: (tokenIn, chainName, isNative) => {
      assert.equal(tokenIn, tokenAddress);
      assert.equal(chainName, 'base');
      assert.equal(isNative, false);
      return 123.456;
    },
    fetchOnchainBalance: async () => {
      throw new Error('should not hit on-chain balance when snapshot balance is available');
    },
    resolveSolWallet: async () => null,
    resolveEvmWallet: async () => '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  });

  assert.equal(prepared.shouldFallbackToLlm, false);
  assert.equal(prepared.amountIn, '123.456');
  assert.equal(prepared.tokenIn, tokenAddress);
  assert.equal(prepared.tokenOut, 'ETH');
});

test('prepareFastSwapExecution treats Polygon native POL as native balance source', async () => {
  const prepared = await prepareFastSwapExecution({
    parsedIntent: {
      detailed: { action: 'swap' },
      swapIntent: {
        tokenIn: 'POL',
        tokenOut: 'USDC',
      },
      chainId: 137,
    },
    lastUserMessage: 'Sell all POL to USDC',
    taskToolContext: {
      userId: 'user-1',
      walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
      chainId: 137,
    },
    chainIdMap: { 137: 'polygon' },
    findSnapshotBalance: (tokenIn, chainName, isNative) => {
      assert.equal(tokenIn, 'POL');
      assert.equal(chainName, 'polygon');
      assert.equal(isNative, true);
      return 10;
    },
    fetchOnchainBalance: async () => {
      throw new Error('should not hit on-chain balance when snapshot balance is available');
    },
    resolveSolWallet: async () => null,
    resolveEvmWallet: async () => '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  });

  assert.equal(prepared.shouldFallbackToLlm, false);
  assert.equal(prepared.amountIn, '9.5');
  assert.equal(prepared.tokenIn, 'POL');
  assert.equal(prepared.tokenOut, 'USDC');
});

test('prepareFastSwapExecution falls back when the request is USD-denominated and still needs amount resolution', async () => {
  const tokenAddress = '0x76331326a25904ddcfb0fa7c03b5e2847d49ffff';
  const prepared = await prepareFastSwapExecution({
    parsedIntent: {
      detailed: { action: 'swap' },
      swapIntent: {
        tokenIn: 'BNB',
        tokenOut: tokenAddress,
        amount: '2',
        amountKind: 'fiat_value',
        amountSemantic: 'fiat_value',
      },
      contractAddress: tokenAddress,
      chainId: 56,
      needsAmountResolution: true,
    },
    lastUserMessage: '你可以帮我买价值2美金的龙虾王吗？',
    taskToolContext: {
      userId: 'user-1',
      walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
      chainId: 56,
    },
    chainIdMap: { 56: 'bsc' },
    findSnapshotBalance: () => 1,
    fetchOnchainBalance: async () => 1,
    resolveSolWallet: async () => null,
    resolveEvmWallet: async () => '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
  });

  assert.equal(prepared.shouldFallbackToLlm, true);
  assert.equal(prepared.tokenIn, 'BNB');
  assert.equal(prepared.tokenOut, tokenAddress);
  assert.equal(prepared.amountIn, '2');
});
