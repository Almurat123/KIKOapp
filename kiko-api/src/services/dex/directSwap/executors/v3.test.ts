import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { executeV3Swap } from './v3.js';
import type { PoolInfo } from '../../poolInfo.js';

const QUOTER_IFACE = new ethers.Interface([
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)'
]);

const BASE_PARAMS = {
  userId: 'u1',
  accessToken: 'a1',
  walletAddress: '0x0000000000000000000000000000000000000001',
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  tokenOut: '0x1111111111111111111111111111111111111111',
  amountIn: '0.01',
  amountInWei: 10_000_000_000_000_000n,
  chainId: 8453,
  slippageBps: 150
} as const;

const BASE_POOL: PoolInfo = {
  poolAddress: '0x2222222222222222222222222222222222222222',
  token0: '0x4200000000000000000000000000000000000006',
  token1: '0x1111111111111111111111111111111111111111',
  version: 'v3',
  fee: 500,
  liquidity: '1000000'
};

function buildDeps(
  callRpcImpl: (method: string) => Promise<string>,
  sendImpl: (tx: any) => Promise<string>
) {
  return {
    wethAddresses: { 8453: '0x4200000000000000000000000000000000000006' } as Record<number, string>,
    pancakeV3Router: '0x13f4ea83d0bd40e75c8222255bc855a974568dd4',
    pancakeV3Quoter: '0xb048bbc1ee6b733fffcfb9e9cef7375518e25997',
    pancakeV3FeeTiers: [100, 500, 2500, 10000] as const,
    v3QuoterByChain: { 8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' } as Record<number, string>,
    v3FeeTiers: [500, 3000, 10000] as const,
    v3QuoterInterface: QUOTER_IFACE,
    turboV3GasLimit: '420000',
    callRpc: async <T>(chainId: number, method: string): Promise<T> => {
      assert.equal(chainId, 8453);
      return await callRpcImpl(method) as unknown as T;
    },
    sendTransaction: async (_userId: string, _accessToken: string, tx: any): Promise<string> => {
      return await sendImpl(tx);
    },
    getTxExecutionProfile: () => 'base-sniper' as const,
    get0xExpectedOutput: async () => 0n
  };
}

test('executeV3Swap turbo continues when pre-sim fails due transient RPC error', async () => {
  let sentGas = '';
  let sentCount = 0;
  const deps = buildDeps(
    async (method: string) => {
      if (method === 'eth_estimateGas') {
        throw new Error('All RPC endpoints failed for Base. Last error: capacity_limited:rps');
      }
      throw new Error(`unexpected method ${method}`);
    },
    async (tx: any) => {
      sentCount += 1;
      sentGas = String(tx.gas || '');
      return '0xabc';
    }
  );

  const result = await executeV3Swap(BASE_PARAMS, BASE_POOL, 'uniswap', deps, {
    fastMode: true,
    executionMode: 'turbo'
  });

  assert.equal(result.success, true);
  assert.equal(result.txHash, '0xabc');
  assert.equal(sentCount, 1);
  assert.equal(sentGas, deps.turboV3GasLimit);
});

test('executeV3Swap normal still fails on transient pre-sim RPC error', async () => {
  let sent = false;
  const deps = buildDeps(
    async (method: string) => {
      if (method === 'eth_estimateGas') {
        throw new Error('All RPC endpoints failed for Base. Last error: capacity_limited:rps');
      }
      throw new Error(`unexpected method ${method}`);
    },
    async () => {
      sent = true;
      return '0xabc';
    }
  );

  const result = await executeV3Swap(BASE_PARAMS, BASE_POOL, 'uniswap', deps, {
    fastMode: true,
    executionMode: 'normal'
  });

  assert.equal(result.success, false);
  assert.equal(sent, false);
  assert.match(result.error || '', /V3 pre-sim reverted/i);
});

test('executeV3Swap turbo still blocks real pre-sim revert', async () => {
  let sent = false;
  const deps = buildDeps(
    async (method: string) => {
      if (method === 'eth_estimateGas') {
        throw new Error('execution reverted: STF');
      }
      throw new Error(`unexpected method ${method}`);
    },
    async () => {
      sent = true;
      return '0xabc';
    }
  );

  const result = await executeV3Swap(BASE_PARAMS, BASE_POOL, 'uniswap', deps, {
    fastMode: true,
    executionMode: 'turbo'
  });

  assert.equal(result.success, false);
  assert.equal(sent, false);
  assert.match(result.error || '', /V3 pre-sim reverted/i);
});
