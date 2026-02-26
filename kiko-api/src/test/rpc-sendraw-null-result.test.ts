import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { __rpcManagerTest, callRpc } from '../services/rpcManager.js';

describe('rpcManager sendRaw null-result behavior', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __rpcManagerTest.resetRuntimeStateForTest();
  });

  test('fanout path rejects null result for eth_sendRawTransaction', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )) as typeof fetch;

    const rawTx = '0x02f86c0180843b9aca00847735940082520894aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa80c001a0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0a0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0';
    try {
      await assert.rejects(
        () => callRpc<string>(
          8453,
          'eth_sendRawTransaction',
          [rawTx],
          {
            strategy: 'fast',
            importance: 'critical',
            exhaustiveFailover: true,
            sendRawFanout: true,
            bypassRawTxCache: true
          }
        ),
        /All RPC endpoints failed for Base/i
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
