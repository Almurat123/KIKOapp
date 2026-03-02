import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../middleware/errorHandler.js';
import { __solanaSigningContextTest } from '../services/solana/solanaSigningContext.js';

describe('solanaSigningContext', () => {
  test('uses delegated wallet when delegated wallet is complete', async () => {
    const result = await __solanaSigningContextTest.resolveSolanaSigningContext('user-1', {
      getDelegatedWallet: async () => ({ id: 'delegated-id', address: 'delegated-address' }),
      getServerWallet: async () => ({ id: 'server-id', address: 'server-address' }),
    });

    assert.equal(result.walletId, 'delegated-id');
    assert.equal(result.address, 'delegated-address');
    assert.equal(result.walletSource, 'delegated');
    assert.equal(result.reasonCode, 'SOLANA_DELEGATED_WALLET_OK');
  });

  test('falls back to server wallet when delegated wallet is invalid', async () => {
    const result = await __solanaSigningContextTest.resolveSolanaSigningContext('user-1', {
      getDelegatedWallet: async () => ({ address: 'delegated-address' }),
      getServerWallet: async () => ({ id: 'server-id', address: 'server-address' }),
    });

    assert.equal(result.walletId, 'server-id');
    assert.equal(result.address, 'server-address');
    assert.equal(result.walletSource, 'server');
    assert.equal(result.reasonCode, 'SOLANA_DELEGATED_WALLET_INVALID');
  });

  test('throws SOLANA_WALLET_INVALID when no valid wallet is available', async () => {
    await assert.rejects(
      () => __solanaSigningContextTest.resolveSolanaSigningContext('user-1', {
        getDelegatedWallet: async () => ({ address: 'delegated-address' }),
        getServerWallet: async () => ({ address: 'server-address' }),
      }),
      (error: unknown) => error instanceof AppError && error.code === 'SOLANA_WALLET_INVALID'
    );
  });
});
