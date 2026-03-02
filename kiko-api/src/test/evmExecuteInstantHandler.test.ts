import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../middleware/errorHandler.js';
import { __evmExecuteInstantTest } from '../routes/swap/evmExecuteInstantHandler.js';

describe('evmExecuteInstant handler routing', () => {
  const baseParams = {
    userId: 'user-1',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    accessToken: 'access-token',
    tokenIn: 'ETH',
    tokenOut: '0x9999999999999999999999999999999999999999',
    amountIn: '1.5',
    chainId: 8453,
    slippageBps: 250,
    transactionMessageId: 'msg-1',
  };

  function createDeps(overrides: Record<string, unknown> = {}) {
    const calls: Record<string, any[]> = {
      metadata: [],
      price: [],
      rpc: [],
      swap: [],
      trade: [],
      track: [],
    };

    const deps = {
      calls,
      getTokenPriceUSD: async (token: string) => {
        calls.price.push(token);
        return token === __evmExecuteInstantTest.NATIVE_TOKEN_PLACEHOLDER ? 2500 : 1;
      },
      getZeroExTokenMetadata: async (token: string) => {
        calls.metadata.push(token);
        return {
          symbol: token === __evmExecuteInstantTest.NATIVE_TOKEN_PLACEHOLDER ? 'ETH' : 'USDC',
          decimals: token === __evmExecuteInstantTest.NATIVE_TOKEN_PLACEHOLDER ? 18 : 6,
        };
      },
      getNativeTokenAddress: () => '0x4200000000000000000000000000000000000006',
      toWei: (amount: string, decimals: number) => {
        if (decimals === 18) return '1500000000000000000';
        if (decimals === 6 && amount === '10') return '10000000';
        return '999999';
      },
      resolveTokenAddress: (token: string) => token,
      isNativeToken: (token: string) => token === 'ETH' || token === __evmExecuteInstantTest.NATIVE_TOKEN_PLACEHOLDER,
      getKnownTokenDecimals: (token: string) => token === '0x9999999999999999999999999999999999999999' ? 6 : undefined,
      callRpc: async (...args: any[]) => {
        calls.rpc.push(args);
        return '0x989680';
      },
      executeSwap: async (request: any) => {
        calls.swap.push(request);
        return {
          success: true,
          txHash: '0xswap',
          amountOut: '3750',
        };
      },
      createSwapHistory: async (record: any) => {
        calls.trade.push(record);
        return {
          id: 'trade-1',
          userId: record.userId,
          tokenInUsd: record.amountInUsd,
        };
      },
      trackSwap: (userId: string, volumeUsd: number) => {
        calls.track.push({ userId, volumeUsd });
      },
      ...overrides,
    };

    return deps;
  }

  test('normalizes native token input for swap execution', async () => {
    const deps = createDeps();

    const result = await __evmExecuteInstantTest.executeEvmInstantWithDeps(baseParams as any, deps as any);

    assert.equal(result.txHash, '0xswap');
    assert.equal(deps.calls.swap.length, 1);
    assert.equal(deps.calls.swap[0].tokenIn, __evmExecuteInstantTest.NATIVE_TOKEN_PLACEHOLDER);
    assert.equal(deps.calls.swap[0].tokenOut, '0x9999999999999999999999999999999999999999');
    assert.equal(deps.calls.swap[0].messageId, 'msg-1');
  });

  test('caps ERC20 amount to on-chain balance when requested amount is too high', async () => {
    const deps = createDeps({
      resolveTokenAddress: (token: string) => token === 'USDC' ? '0x9999999999999999999999999999999999999999' : token,
      isNativeToken: () => false,
      getZeroExTokenMetadata: async () => ({ symbol: 'USDC', decimals: 6 }),
      getKnownTokenDecimals: () => 6,
      toWei: (amount: string, decimals: number) => {
        if (amount === '10' && decimals === 6) return '10000000';
        return '0';
      },
      callRpc: async (...args: any[]) => {
        deps.calls.rpc.push(args);
        return '0x07a120';
      },
    });

    await __evmExecuteInstantTest.executeEvmInstantWithDeps({
      ...baseParams,
      tokenIn: 'USDC',
      amountIn: '10',
    } as any, deps as any);

    assert.equal(deps.calls.swap[0].amountIn, '0.499000');
  });

  test('remaps insufficient native balance precheck to AppError', async () => {
    const deps = createDeps({
      executeSwap: async () => ({
        success: false,
        error: 'insufficient_native_balance_precheck: have=0.002 required=0.005',
      }),
    });

    await assert.rejects(
      __evmExecuteInstantTest.executeEvmInstantWithDeps(baseParams as any, deps as any),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INSUFFICIENT_NATIVE_BALANCE');
        return true;
      }
    );
  });

  test('creates trade record and tracks user activity on success', async () => {
    const deps = createDeps();

    const result = await __evmExecuteInstantTest.executeEvmInstantWithDeps(baseParams as any, deps as any);

    assert.equal(result.tradeId, 'trade-1');
    assert.equal(deps.calls.trade.length, 1);
    assert.equal(deps.calls.track.length, 1);
    assert.equal(deps.calls.track[0].userId, 'user-1');
    assert.equal(deps.calls.track[0].volumeUsd, 3750);
  });

  test('throws SWAP_FAILED when unified executor returns a generic failure', async () => {
    const deps = createDeps({
      executeSwap: async () => ({
        success: false,
        error: 'router unavailable',
      }),
    });

    await assert.rejects(
      __evmExecuteInstantTest.executeEvmInstantWithDeps(baseParams as any, deps as any),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'SWAP_FAILED');
        return true;
      }
    );
  });
});
