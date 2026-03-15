import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __executionFeeSnapshotTest,
  getExecutionFeeSnapshot
} from '../executionFeeSnapshot.js';

test('executionFeeSnapshot builds a stable chain-scoped key', () => {
  assert.equal(
    __executionFeeSnapshotTest.buildExecutionFeeSnapshotKey(8453),
    'swap-execution-fee:8453'
  );
});

test('executionFeeSnapshot fetches latest block and priority fee in parallel and derives max fee', async () => {
  const calls: string[] = [];
  const snapshot = await getExecutionFeeSnapshot(8453, {
    callRpc: (async (_chainId: string | number, method: string) => {
      calls.push(method);
      if (method === 'eth_getBlockByNumber') return { baseFeePerGas: '0x989680' };
      if (method === 'eth_maxPriorityFeePerGas') return '0xf4240';
      throw new Error(`unexpected method ${method}`);
    }) as any,
    withScopedCache: async ({ producer }) => await producer()
  });

  assert.deepEqual(calls.sort(), ['eth_getBlockByNumber', 'eth_maxPriorityFeePerGas']);
  assert.equal(snapshot.baseFeePerGas, 10_000_000n);
  assert.equal(snapshot.maxPriorityFeePerGas, 1_000_000n);
  assert.equal(snapshot.maxFeePerGas, 21_000_000n);
});

test('executionFeeSnapshot tolerates partial RPC failure', async () => {
  const snapshot = await getExecutionFeeSnapshot(8453, {
    callRpc: (async (_chainId: string | number, method: string) => {
      if (method === 'eth_getBlockByNumber') throw new Error('block rpc timeout');
      return '0xf4240';
    }) as any,
    withScopedCache: async ({ producer }) => await producer()
  });

  assert.equal(snapshot.baseFeePerGas, null);
  assert.equal(snapshot.maxPriorityFeePerGas, 1_000_000n);
  assert.equal(snapshot.maxFeePerGas, null);
});
