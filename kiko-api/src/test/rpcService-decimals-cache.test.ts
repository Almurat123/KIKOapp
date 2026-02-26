import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { __rpcManagerTest } from '../services/rpcManager.js';
import { getTokenDecimals } from '../services/rpcService.js';

describe('rpcService decimals cache', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __rpcManagerTest.resetRuntimeStateForTest();
  });

  test('uses local cache for repeated decimals lookup', async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: `0x${'0'.repeat(63)}6`
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );
    }) as typeof fetch;

    try {
      const token = `0x${'1'.repeat(39)}${Math.floor(Math.random() * 10)}`;
      const first = await getTokenDecimals(8453, token, { defaultDecimals: 18 });
      const second = await getTokenDecimals(8453, token, { defaultDecimals: 18 });
      assert.equal(first, 6);
      assert.equal(second, 6);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('uses negative cache after first failure', async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      throw new Error('rpc_down');
    }) as typeof fetch;

    try {
      const token = `0x${'2'.repeat(39)}${Math.floor(Math.random() * 10)}`;
      const first = await getTokenDecimals(8453, token, { defaultDecimals: 18 });
      const countAfterFirst = fetchCount;
      const second = await getTokenDecimals(8453, token, { defaultDecimals: 18 });
      assert.equal(first, 18);
      assert.equal(second, 18);
      assert.equal(fetchCount, countAfterFirst);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
