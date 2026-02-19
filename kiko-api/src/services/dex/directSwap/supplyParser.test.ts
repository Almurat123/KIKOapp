import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSwapSupplyFromSourceTx,
  resolveHintedPoolFromSwapSupply,
  resolveHintedV4PoolFromSwapSupply,
  resolvePoolHintFromSwapSupply
} from './supplyParser.js';
import type { DirectSwapHint } from '../directSwapTypes.js';

test('parseSwapSupplyFromSourceTx returns null for invalid tx hash', async () => {
  const parsed = await parseSwapSupplyFromSourceTx({
    chainId: 8453,
    sourceTxHash: 'invalid',
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0x1111111111111111111111111111111111111111'
  });
  assert.equal(parsed, null);
});

test('resolvePoolHintFromSwapSupply prefers pre-resolved hint', async () => {
  const hint: DirectSwapHint = {
    resolvedPoolHint: {
      kind: 'v3',
      dex: 'uniswap',
      poolAddress: '0x1111111111111111111111111111111111111111',
      fee: 3000
    }
  };

  const resolved = await resolvePoolHintFromSwapSupply({
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0x2222222222222222222222222222222222222222',
    chainId: 8453,
    hint
  });

  assert.ok(resolved);
  assert.equal(resolved?.kind, 'v3');
  assert.equal(resolved?.poolAddress?.toLowerCase(), '0x1111111111111111111111111111111111111111');
});

test('resolveHintedPoolFromSwapSupply maps v3 hint to pool info', async () => {
  const hint: DirectSwapHint = {
    resolvedPoolHint: {
      kind: 'v3',
      dex: 'uniswap',
      poolAddress: '0x3333333333333333333333333333333333333333',
      fee: 500
    }
  };

  const pool = await resolveHintedPoolFromSwapSupply({
    tokenIn: '0xaaaaaa0000000000000000000000000000000000',
    tokenOut: '0xbbbbbb0000000000000000000000000000000000',
    chainId: 8453,
    hint
  });

  assert.ok(pool);
  assert.equal(pool?.kind, 'v3');
  assert.equal(pool?.pool.poolAddress.toLowerCase(), '0x3333333333333333333333333333333333333333');
  assert.equal(pool?.pool.fee, 500);
});

test('resolveHintedPoolFromSwapSupply maps v2 hint and applies chain fallback dex', async () => {
  const hint: DirectSwapHint = {
    resolvedPoolHint: {
      kind: 'v2',
      poolAddress: '0x4444444444444444444444444444444444444444'
    }
  };

  const pool = await resolveHintedPoolFromSwapSupply({
    tokenIn: '0xaaaaaa0000000000000000000000000000000000',
    tokenOut: '0xbbbbbb0000000000000000000000000000000000',
    chainId: 56,
    hint
  });

  assert.ok(pool);
  assert.equal(pool?.kind, 'v2');
  assert.equal(pool?.dex, 'pancake');
});

test('resolveHintedV4PoolFromSwapSupply maps resolved v4 pool key directly', async () => {
  const hint: DirectSwapHint = {
    resolvedPoolHint: {
      kind: 'v4',
      dex: 'uniswap',
      poolAddress: '0x5555555555555555555555555555555555555555',
      v4PoolKey: {
        currency0: '0x0000000000000000000000000000000000000001',
        currency1: '0x0000000000000000000000000000000000000002',
        hooks: '0x0000000000000000000000000000000000000000',
        poolManager: '0x0000000000000000000000000000000000000000',
        fee: 3000,
        tickSpacing: 60
      }
    }
  };

  const pool = await resolveHintedV4PoolFromSwapSupply({
    tokenIn: '0x0000000000000000000000000000000000000001',
    tokenOut: '0x0000000000000000000000000000000000000002',
    chainId: 8453,
    hint
  });

  assert.ok(pool);
  assert.equal(pool?.poolAddress.toLowerCase(), '0x5555555555555555555555555555555555555555');
  assert.equal(pool?.poolKey.fee, 3000);
});

test('parseSwapSupplyFromSourceTx deduplicates inflight decode and serves cached result', async () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const txHash = `0x${'a'.repeat(64)}`;
  const tokenIn = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const tokenOut = '0x7777777777777777777777777777777777777777';

  let txCalls = 0;
  let receiptCalls = 0;
  let parseCalls = 0;

  const deps = {
    getTransactionByHash: async (_chainId: number, _sourceTxHash: string) => {
      txCalls += 1;
      await sleep(25);
      return {
        hash: txHash,
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        input: '0x',
        value: '0x0'
      };
    },
    getTransactionReceipt: async (_chainId: number, _sourceTxHash: string) => {
      receiptCalls += 1;
      await sleep(25);
      return { logs: [], status: 1 };
    },
    parseSwapTransaction: async (_tx: any, _receipt: any, _chainId: number) => {
      parseCalls += 1;
      await sleep(25);
      return {
        tokenIn,
        tokenOut,
        amountIn: '1000',
        amountOut: '2000',
        router: '0x3333333333333333333333333333333333333333',
        dexName: 'mock'
      };
    }
  };

  const params = {
    chainId: 8453,
    sourceTxHash: txHash,
    tokenIn,
    tokenOut
  };

  const [a, b, c, d] = await Promise.all([
    parseSwapSupplyFromSourceTx(params, deps),
    parseSwapSupplyFromSourceTx(params, deps),
    parseSwapSupplyFromSourceTx(params, deps),
    parseSwapSupplyFromSourceTx(params, deps)
  ]);

  assert.ok(a && b && c && d);
  assert.equal(txCalls, 1);
  assert.equal(receiptCalls, 1);
  assert.equal(parseCalls, 1);

  const cacheStart = Date.now();
  const cached = await parseSwapSupplyFromSourceTx(params, deps);
  const cacheMs = Date.now() - cacheStart;

  assert.ok(cached);
  assert.equal(txCalls, 1);
  assert.equal(receiptCalls, 1);
  assert.equal(parseCalls, 1);
  assert.ok(cacheMs < 15);
});
