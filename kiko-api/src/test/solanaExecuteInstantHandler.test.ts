import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { __solanaExecuteInstantTest } from '../routes/swap/solanaExecuteInstantHandler.js';

describe('solanaExecuteInstant handler helpers', () => {
  test('resolveSolanaTokenAddress resolves common symbols and preserves addresses', () => {
    assert.equal(__solanaExecuteInstantTest.resolveSolanaTokenAddress('SOL'), 'So11111111111111111111111111111111111111112');
    assert.equal(__solanaExecuteInstantTest.resolveSolanaTokenAddress('usdc'), 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    assert.equal(
      __solanaExecuteInstantTest.resolveSolanaTokenAddress('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    );
  });
});

describe('solanaExecuteInstant handler routing', () => {
  const baseParams = {
    userId: 'user-1',
    tokenIn: 'SOL',
    tokenOut: 'TARGET',
    amountIn: '1.5',
    slippageBps: 250,
    accessToken: 'access-token',
  };

  function createDeps(overrides: Record<string, unknown> = {}) {
    const calls: Record<string, any[]> = {
      execute: [],
      fastSwap: [],
      metadata: [],
      findToken: [],
      normalize: [],
      toWei: [],
    };

    const deps = {
      calls,
      executeSolanaSwap: async (params: any) => {
        calls.execute.push(params);
        return 'executor-tx';
      },
      findTokenOnAnyChain: async (address: string) => {
        calls.findToken.push(address);
        return null;
      },
      getSolanaTokenMetadata: async (address: string) => {
        calls.metadata.push(address);
        return { decimals: address === 'TARGET' ? 6 : 9 };
      },
      normalizeSolanaTokenAddress: (symbol: string) => {
        calls.normalize.push(symbol);
        if (symbol === 'USDC') return 'USDC-MINT';
        if (symbol === 'USDT') return 'USDT-MINT';
        if (symbol === 'SOL') return 'SOL-MINT';
        return symbol;
      },
      solanaLaunchpadSwapService: {
        fastSwap: async (params: any) => {
          calls.fastSwap.push(params);
          return 'launchpad-tx';
        }
      },
      toWei: (amount: string, decimals: number) => {
        calls.toWei.push({ amount, decimals });
        return `${amount}:${decimals}`;
      },
      ...overrides,
    };

    return deps;
  }

  test('routes pumpfun to launchpad fast swap', async () => {
    const deps = createDeps({
      findTokenOnAnyChain: async () => ({ launchpad: { provider: 'pumpfun' } }),
    });

    const result = await __solanaExecuteInstantTest.executeSolanaInstantWithDeps(baseParams as any, deps as any);

    assert.equal(result.method, 'solana_launchpad');
    assert.equal(result.txHash, 'launchpad-tx');
    assert.equal(deps.calls.fastSwap.length, 1);
    assert.equal(deps.calls.execute.length, 0);
    assert.equal(deps.calls.fastSwap[0].provider, 'pumpfun');
  });

  test('routes bonkfun to launchpad fast swap', async () => {
    const deps = createDeps({
      findTokenOnAnyChain: async () => ({ launchpad: { provider: 'bonkfun' } }),
    });

    const result = await __solanaExecuteInstantTest.executeSolanaInstantWithDeps(baseParams as any, deps as any);

    assert.equal(result.method, 'solana_launchpad');
    assert.equal(deps.calls.fastSwap[0].provider, 'bonkfun');
  });

  test('routes pumpswap to turbo executor', async () => {
    const deps = createDeps({
      findTokenOnAnyChain: async () => ({ launchpad: { provider: 'pumpswap' } }),
    });

    const result = await __solanaExecuteInstantTest.executeSolanaInstantWithDeps(baseParams as any, deps as any);

    assert.equal(result.method, 'solana_pumpswap_fast');
    assert.equal(result.txHash, 'executor-tx');
    assert.equal(deps.calls.execute.length, 1);
    assert.equal(deps.calls.execute[0].executionMode, 'turbo');
    assert.equal(deps.calls.execute[0].launchpadProvider, 'pumpswap');
    assert.equal(deps.calls.execute[0].waitForConfirmation, false);
  });

  test('routes standard tokens to normal executor', async () => {
    const deps = createDeps();

    const result = await __solanaExecuteInstantTest.executeSolanaInstantWithDeps(baseParams as any, deps as any);

    assert.equal(result.method, 'jupiter_aggregator');
    assert.equal(result.txHash, 'executor-tx');
    assert.equal(deps.calls.execute.length, 1);
    assert.equal(deps.calls.execute[0].executionMode, 'normal');
    assert.equal(deps.calls.execute[0].tokenInMint, 'So11111111111111111111111111111111111111112');
    assert.equal(deps.calls.execute[0].tokenOutMint, 'TARGET');
    assert.deepEqual(deps.calls.toWei[0], { amount: '1.5', decimals: 9 });
  });
});
