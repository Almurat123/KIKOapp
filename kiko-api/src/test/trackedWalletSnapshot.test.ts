import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  __resetTrackedWalletSnapshotForTests,
  __setTrackedWalletSnapshotForTests,
  resolveTrackedWalletsFromSnapshot,
} from '../services/copytrade-v2/ingress/trackedWalletSnapshot.js';

const SOL_ADDRESS = '7vT6hVh9fdxQ9fvtRB8mKx1R6fJQx6rVYw2JmX1r2QkL';
const EVM_ADDRESS = '0x1111111111111111111111111111111111111111';

describe('tracked wallet snapshot', () => {
  beforeEach(() => {
    __resetTrackedWalletSnapshotForTests();
    __setTrackedWalletSnapshotForTests({
      900: [SOL_ADDRESS],
      8453: [EVM_ADDRESS],
    });
  });

  test('matches solana tracked wallet on chain 900', () => {
    const matched = resolveTrackedWalletsFromSnapshot(900, [SOL_ADDRESS]);
    assert.deepEqual(matched, [SOL_ADDRESS]);
  });

  test('matches solana candidate from pubkey object form', () => {
    const matched = resolveTrackedWalletsFromSnapshot(900, [{ pubkey: SOL_ADDRESS } as any]);
    assert.deepEqual(matched, [SOL_ADDRESS]);
  });

  test('matches evm wallet case-insensitively on evm chains', () => {
    const matched = resolveTrackedWalletsFromSnapshot(8453, ['0x1111111111111111111111111111111111111111'.toUpperCase()]);
    assert.deepEqual(matched, [EVM_ADDRESS]);
  });

  test('does not cross-match solana address on evm chain', () => {
    const matched = resolveTrackedWalletsFromSnapshot(8453, [SOL_ADDRESS]);
    assert.deepEqual(matched, []);
  });
});

