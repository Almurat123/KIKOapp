import assert from 'node:assert/strict';
import test from 'node:test';

import { preparePerConfigBuyLiquidity } from '../buy/perConfigBuyLiquidity.js';

test('preparePerConfigBuyLiquidity escalates only configs whose minLiquidity exceeds shared result', async () => {
  const calls: number[] = [];
  const baseTokenInfo = {
    price: 0,
    symbol: 'TOK',
    name: 'Token',
    decimals: 18,
    liquidity: 0,
  };

  const prepared = await preparePerConfigBuyLiquidity({
    tokenToBuy: '0xtoken',
    chainId: 8453,
    swap: {
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xtoken',
      amountIn: '1',
      amountOut: '1',
      router: '0xrouter',
      dexName: 'test',
    },
    tokenInfo: baseTokenInfo,
    configs: [
      { id: 'fast-user', minLiquidityUsd: null },
      { id: 'strict-a', minLiquidityUsd: 1000 },
      { id: 'strict-b', minLiquidityUsd: 1000 },
    ],
  }, {
    async resolveBuyLiquidityGuardSnapshot(_token, _chainId, _tokenInfo, options) {
      const stopAtLiquidityUsd = Number(options?.stopAtLiquidityUsd || 0);
      calls.push(stopAtLiquidityUsd);
      if (stopAtLiquidityUsd === 0) {
        return {
          liquidityUsd: 454,
          source: 'target_pool_tvl',
          reliable: true,
          poolCount: 1,
          fallbackUsed: false,
          metadata: { mode: 'target_interacted_pools' },
        };
      }
      return {
        liquidityUsd: 454,
        source: 'direct_pool_tvl',
        reliable: true,
        poolCount: 1,
        fallbackUsed: false,
        metadata: { mode: 'full_scan_after_target_pool_miss', stopAtLiquidityUsd },
      };
    },
  });

  assert.deepEqual(calls, [0, 1000]);
  assert.equal((prepared.tokenInfoByConfigId.get('fast-user') as any)?.guardLiquiditySource, 'target_pool_tvl');
  assert.equal((prepared.tokenInfoByConfigId.get('strict-a') as any)?.guardLiquiditySource, 'direct_pool_tvl');
  assert.equal((prepared.tokenInfoByConfigId.get('strict-b') as any)?.guardLiquiditySource, 'direct_pool_tvl');
  assert.equal(
    prepared.liquidityGuardSnapshotByConfigId.get('strict-a')?.metadata?.stopAtLiquidityUsd,
    1000
  );
});
