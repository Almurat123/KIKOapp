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
