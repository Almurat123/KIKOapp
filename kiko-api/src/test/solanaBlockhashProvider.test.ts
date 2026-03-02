import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../middleware/errorHandler.js';
import { __solanaBlockhashProviderTest, getLatestSolanaBlockhash } from '../services/solana/blockhashProvider.js';

describe('solana blockhash provider', () => {
  test('uses finalized blockhash when primary RPC is healthy', async () => {
    const rpcCalls: string[] = [];
    const result = await __solanaBlockhashProviderTest.getLatestSolanaBlockhashWithDeps(
      undefined,
      'test_operation',
      {
        getRpcEndpointsWithStrategy: () => [{ name: 'rpc-1', url: 'https://rpc-1', priority: 1, requiresAuth: false, type: 'public' }],
        callRpcCustom: async (_endpoints: any, _method: string, params: any[]) => {
          rpcCalls.push(params[0].commitment);
          return { blockhash: 'finalized-hash', lastValidBlockHeight: 1 };
        }
      } as any
    );

    assert.equal(result.blockhash, 'finalized-hash');
    assert.equal(result.commitmentUsed, 'finalized');
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.attemptedEndpoints, 1);
    assert.deepEqual(rpcCalls, ['finalized']);
  });

  test('normalizes nested Solana RPC blockhash response shape', () => {
    const result = __solanaBlockhashProviderTest.normalizeBlockhashResult({
      context: { slot: 123 },
      value: {
        blockhash: 'nested-hash',
        lastValidBlockHeight: 42,
      },
    } as any);

    assert.equal(result.blockhash, 'nested-hash');
    assert.equal(result.lastValidBlockHeight, 42);
  });

  test('falls back to confirmed when finalized fetch fails', async () => {
    const rpcCalls: string[] = [];
    const result = await __solanaBlockhashProviderTest.getLatestSolanaBlockhashWithDeps(
      undefined,
      'test_operation',
      {
        getRpcEndpointsWithStrategy: () => [{ name: 'rpc-1', url: 'https://rpc-1', priority: 1, requiresAuth: false, type: 'public' }],
        callRpcCustom: async (_endpoints: any, _method: string, params: any[]) => {
          rpcCalls.push(params[0].commitment);
          if (params[0].commitment === 'finalized') {
            throw new Error('finalized endpoint unavailable');
          }
          return { blockhash: 'confirmed-hash', lastValidBlockHeight: 2 };
        }
      } as any
    );

    assert.equal(result.blockhash, 'confirmed-hash');
    assert.equal(result.commitmentUsed, 'confirmed');
    assert.equal(result.fallbackUsed, true);
    assert.deepEqual(rpcCalls, ['finalized', 'confirmed']);
  });

  test('throws SOLANA_BLOCKHASH_FETCH_FAILED when all commitments fail', async () => {
    const connection = {
      getLatestBlockhash: async (commitment: 'finalized' | 'confirmed') => {
        throw new Error(`${commitment} unavailable`);
      }
    };

    await assert.rejects(
      () => __solanaBlockhashProviderTest.getLatestSolanaBlockhashWithDeps(
        connection as any,
        'test_operation',
        {
          getRpcEndpointsWithStrategy: () => [{ name: 'rpc-1', url: 'https://rpc-1', priority: 1, requiresAuth: false, type: 'public' }],
          callRpcCustom: async () => { throw new Error('all rpc endpoints failed'); }
        } as any
      ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'SOLANA_BLOCKHASH_FETCH_FAILED');
        assert.match(error.message, /finalized:all rpc endpoints failed/);
        assert.match(error.message, /connection:finalized:finalized unavailable/);
        return true;
      }
    );
  });

  test('replay: endpoint failover recovers the copytrade Solana blockhash path', async () => {
    const endpointAttempts: Array<{ endpoint: string; commitment: string }> = [];
    const endpoints = [
      { name: 'rpc-1', url: 'https://rpc-1', priority: 1, requiresAuth: false, type: 'public' },
      { name: 'rpc-2', url: 'https://rpc-2', priority: 2, requiresAuth: false, type: 'public' },
      { name: 'rpc-3', url: 'https://rpc-3', priority: 3, requiresAuth: false, type: 'premium' },
    ];

    const result = await __solanaBlockhashProviderTest.getLatestSolanaBlockhashWithDeps(
      undefined,
      'copytrade_replay',
      {
        getRpcEndpointsWithStrategy: () => endpoints as any,
        callRpcCustom: async (passedEndpoints: any[], _method: string, params: any[]) => {
          const commitment = params[0].commitment;
          for (const endpoint of passedEndpoints) {
            endpointAttempts.push({ endpoint: endpoint.url, commitment });
            if (endpoint.url === 'https://rpc-3' && commitment === 'finalized') {
              return { blockhash: 'replay-blockhash', lastValidBlockHeight: 99 };
            }
          }
          throw new Error('All RPC endpoints failed');
        }
      } as any
    );

    assert.equal(result.blockhash, 'replay-blockhash');
    assert.equal(result.commitmentUsed, 'finalized');
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.attemptedEndpoints, 3);
    assert.deepEqual(endpointAttempts, [
      { endpoint: 'https://rpc-1', commitment: 'finalized' },
      { endpoint: 'https://rpc-2', commitment: 'finalized' },
      { endpoint: 'https://rpc-3', commitment: 'finalized' },
    ]);
  });

  test('replay: nested RPC response shape does not break recentBlockhash injection path', async () => {
    const result = await __solanaBlockhashProviderTest.getLatestSolanaBlockhashWithDeps(
      undefined,
      'copytrade_nested_shape',
      {
        getRpcEndpointsWithStrategy: () => [{ name: 'rpc-1', url: 'https://rpc-1', priority: 1, requiresAuth: false, type: 'public' }],
        callRpcCustom: async () => ({
          context: { slot: 999 },
          value: {
            blockhash: 'nested-replay-blockhash',
            lastValidBlockHeight: 88,
          },
        }),
      } as any
    );

    assert.equal(result.blockhash, 'nested-replay-blockhash');
    assert.equal(result.lastValidBlockHeight, 88);
    assert.equal(result.commitmentUsed, 'finalized');
  });

  test('throws SOLANA_BLOCKHASH_FETCH_FAILED when RPC returns invalid blockhash shape', async () => {
    await assert.rejects(
      () => __solanaBlockhashProviderTest.getLatestSolanaBlockhashWithDeps(
        undefined,
        'invalid_shape',
        {
          getRpcEndpointsWithStrategy: () => [{ name: 'rpc-1', url: 'https://rpc-1', priority: 1, requiresAuth: false, type: 'public' }],
          callRpcCustom: async () => ({ value: { blockhash: null, lastValidBlockHeight: 1 } }),
        } as any
      ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'SOLANA_BLOCKHASH_FETCH_FAILED');
        assert.match(error.message, /Invalid getLatestBlockhash response shape/);
        return true;
      }
    );
  });
});
