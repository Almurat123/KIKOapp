import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../middleware/errorHandler.js';
import { getLatestSolanaBlockhash } from '../services/solana/blockhashProvider.js';

describe('solana blockhash provider', () => {
  test('uses finalized blockhash when primary RPC is healthy', async () => {
    const calls: string[] = [];
    const connection = {
      getLatestBlockhash: async (commitment: 'finalized' | 'confirmed') => {
        calls.push(commitment);
        return { blockhash: 'finalized-hash', lastValidBlockHeight: 1 };
      }
    };

    const result = await getLatestSolanaBlockhash(connection as any, 'test_operation');

    assert.equal(result.blockhash, 'finalized-hash');
    assert.equal(result.commitmentUsed, 'finalized');
    assert.equal(result.fallbackUsed, false);
    assert.deepEqual(calls, ['finalized']);
  });

  test('falls back to confirmed when finalized fetch fails', async () => {
    const calls: string[] = [];
    const connection = {
      getLatestBlockhash: async (commitment: 'finalized' | 'confirmed') => {
        calls.push(commitment);
        if (commitment === 'finalized') {
          throw new Error('finalized endpoint unavailable');
        }
        return { blockhash: 'confirmed-hash', lastValidBlockHeight: 2 };
      }
    };

    const result = await getLatestSolanaBlockhash(connection as any, 'test_operation');

    assert.equal(result.blockhash, 'confirmed-hash');
    assert.equal(result.commitmentUsed, 'confirmed');
    assert.equal(result.fallbackUsed, true);
    assert.deepEqual(calls, ['finalized', 'confirmed']);
  });

  test('throws SOLANA_BLOCKHASH_FETCH_FAILED when all commitments fail', async () => {
    const connection = {
      getLatestBlockhash: async (commitment: 'finalized' | 'confirmed') => {
        throw new Error(`${commitment} unavailable`);
      }
    };

    await assert.rejects(
      () => getLatestSolanaBlockhash(connection as any, 'test_operation'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'SOLANA_BLOCKHASH_FETCH_FAILED');
        assert.match(error.message, /finalized:finalized unavailable/);
        assert.match(error.message, /confirmed:confirmed unavailable/);
        return true;
      }
    );
  });
});
