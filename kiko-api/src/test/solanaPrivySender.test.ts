import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../middleware/errorHandler.js';
import { __solanaPrivySenderTest } from '../services/solana/solanaPrivySender.js';

describe('solanaPrivySender wallet resolution', () => {
  test('uses delegated wallet when delegated wallet is complete', async () => {
    const result = await __solanaPrivySenderTest.resolvePreferredSolanaWallet('user-1', {
      getDelegatedWallet: async () => ({ id: 'delegated-id', address: 'delegated-address' }),
      getServerWallet: async () => ({ id: 'server-id', address: 'server-address' }),
    });

    assert.equal(result.walletSource, 'delegated');
    assert.equal(result.wallet.id, 'delegated-id');
    assert.equal(result.reasonCode, 'SOLANA_DELEGATED_WALLET_OK');
  });

  test('falls back to server wallet when delegated wallet is missing id', async () => {
    const result = await __solanaPrivySenderTest.resolvePreferredSolanaWallet('user-1', {
      getDelegatedWallet: async () => ({ address: 'delegated-address' }),
      getServerWallet: async () => ({ id: 'server-id', address: 'server-address' }),
    });

    assert.equal(result.walletSource, 'server');
    assert.equal(result.wallet.id, 'server-id');
    assert.equal(result.reasonCode, 'SOLANA_DELEGATED_WALLET_INVALID');
  });

  test('throws SOLANA_WALLET_INVALID when both delegated and server wallets are invalid', async () => {
    await assert.rejects(
      () => __solanaPrivySenderTest.resolvePreferredSolanaWallet('user-1', {
        getDelegatedWallet: async () => ({ address: 'delegated-address' }),
        getServerWallet: async () => ({ address: 'server-address' }),
      }),
      (error: unknown) => error instanceof AppError && error.code === 'SOLANA_WALLET_INVALID'
    );
  });
});

describe('solanaPrivySender sending', () => {
  test('falls back to server wallet and sends transaction when delegated wallet is invalid', async () => {
    const calls: any[] = [];
    const txHash = await __solanaPrivySenderTest.sendSolanaTransactionWithDeps(
      'user-1',
      Buffer.from('fake-tx').toString('base64'),
      {
        getDelegatedWallet: async () => ({ address: 'delegated-address' }),
        getServerWallet: async () => ({ id: 'server-id', address: 'server-address' }),
        deserializeTransaction: () => ({ fake: true } as any),
        signAndSendTransaction: async (params: any) => {
          calls.push(params);
          return { hash: 'solana-hash' };
        },
      } as any
    );

    assert.equal(txHash, 'solana-hash');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].walletId, 'server-id');
    assert.equal(calls[0].caip2, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
  });

  test('wraps Expected String failures as SOLANA_TRANSACTION_FAILED', async () => {
    await assert.rejects(
      () => __solanaPrivySenderTest.sendSolanaTransactionWithDeps(
        'user-1',
        Buffer.from('fake-tx').toString('base64'),
        {
          getDelegatedWallet: async () => ({ id: 'delegated-id', address: 'delegated-address' }),
          getServerWallet: async () => ({ id: 'server-id', address: 'server-address' }),
          deserializeTransaction: () => ({ fake: true } as any),
          signAndSendTransaction: async () => {
            throw new Error('Expected String');
          },
        } as any
      ),
      (error: unknown) => error instanceof AppError && error.code === 'SOLANA_TRANSACTION_FAILED'
    );
  });
});
