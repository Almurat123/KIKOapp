import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBuyLiquidityGuardSnapshot } from '../guards/liquidityGuard.js';

test('resolveBuyLiquidityGuardSnapshot forwards bounded full-scan budget to direct liquidity lookup', async () => {
  let observedBudgetMs: number | undefined;

  const snapshot = await resolveBuyLiquidityGuardSnapshot('0xtoken', 8453, {
    liquidity: 0,
    price: 0,
  }, {
    stopAtLiquidityUsd: 1000,
    fullScanBudgetMs: 321,
  }, {
    async getV2PoolInfo() {
      return null;
    },
    async getV3PoolInfo() {
      return null;
    },
    async getV4PoolInfo() {
      return null;
    },
    async getLiquidityFromCandidatePools() {
      return null as any;
    },
    async getTokenLiquidity(_token, _chainId, options) {
      observedBudgetMs = options?.budgetMs;
      return {
        totalTvlUsd: 250,
        pools: [{ address: '0xpool', tvlUsd: 250 }],
        reliable: true,
      } as any;
    },
  });

  assert.equal(observedBudgetMs, 321);
  assert.equal(snapshot.source, 'direct_pool_tvl');
  assert.equal(snapshot.metadata?.budgetMs, 321);
});

test('resolveBuyLiquidityGuardSnapshot skips target-pool candidates for multi-hop swaps with disabled fast path', async () => {
  let targetPoolLookupCalls = 0;
  let directLiquidityCalls = 0;

  const snapshot = await resolveBuyLiquidityGuardSnapshot('0xtoken', 8453, {
    liquidity: 0,
    price: 0,
  }, {
    swap: {
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xtoken',
      amountIn: '1',
      amountOut: '1',
      router: '0xrouter',
      dexName: 'Uniswap v4',
      routeHopCount: 2,
      canUseResolvedPoolFastPath: false,
      resolvedPoolHint: {
        kind: 'v4',
        poolAddress: '0xhinted-pool',
        v4PoolKey: {
          currency0: '0xalias',
          currency1: '0xtoken',
          hooks: '0xhook',
          poolManager: '0xmanager',
          fee: 0,
          tickSpacing: 60,
        },
      },
      routeHops: [
        { kind: 'v4', poolAddress: '0xhop-a' },
        { kind: 'v4', poolAddress: '0xhop-b' },
      ],
    } as any,
  }, {
    async getV2PoolInfo() {
      throw new Error('target pool lookup should be skipped');
    },
    async getV3PoolInfo() {
      throw new Error('target pool lookup should be skipped');
    },
    async getV4PoolInfo() {
      targetPoolLookupCalls += 1;
      return null;
    },
    async getLiquidityFromCandidatePools() {
      throw new Error('target pool liquidity stage should be skipped');
    },
    async getTokenLiquidity() {
      directLiquidityCalls += 1;
      return {
        totalTvlUsd: 250,
        pools: [{ address: '0xpool', tvlUsd: 250 }],
        reliable: true,
      } as any;
    },
  });

  assert.equal(targetPoolLookupCalls, 0);
  assert.equal(directLiquidityCalls, 1);
  assert.equal(snapshot.source, 'direct_pool_tvl');
  assert.equal(snapshot.metadata?.mode, 'full_scan');
  assert.equal(snapshot.metadata?.targetPoolCount, 0);
});
