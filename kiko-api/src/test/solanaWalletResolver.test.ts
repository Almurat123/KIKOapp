import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSolanaWalletRecord } from '../services/solana/solanaWalletResolver.js';

describe('solanaWalletResolver', () => {
  test('accepts wallet with id and address', () => {
    const result = resolveSolanaWalletRecord({ id: 'wallet-id', address: 'wallet-address' });
    assert.deepEqual(result, {
      wallet: { id: 'wallet-id', address: 'wallet-address' },
      reasonCode: 'ok',
    });
  });

  test('rejects wallet missing id', () => {
    const result = resolveSolanaWalletRecord({ address: 'wallet-address' });
    assert.equal(result.wallet, null);
    assert.equal(result.reasonCode, 'missing_wallet_id');
  });

  test('rejects wallet missing address', () => {
    const result = resolveSolanaWalletRecord({ id: 'wallet-id' });
    assert.equal(result.wallet, null);
    assert.equal(result.reasonCode, 'missing_wallet_address');
  });
});
