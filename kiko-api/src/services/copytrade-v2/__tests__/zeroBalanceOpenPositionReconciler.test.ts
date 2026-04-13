import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileZeroBalanceOpenPosition } from '../runtime/zeroBalanceOpenPositionReconciler.js';

test('closes mature open position when follower balance is zero', async () => {
  const reconcileCalls: any[] = [];

  const result = await reconcileZeroBalanceOpenPosition({
    position: {
      id: 'pos-1',
      status: 'open',
      tokenAddress: '0xtoken',
      tokenSymbol: 'TOK',
      chainId: 8453,
      userId: 'user-1',
      configId: 'config-1',
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
    walletAddress: '0xwallet',
    deps: {
      readBalance: async () => 0n,
      readDecimals: async () => 18,
      reconcile: async (payload: any) => {
        reconcileCalls.push(payload);
      },
    },
  });

  assert.equal(result.closed, true);
  assert.equal(result.closeReason, 'balance_empty');
  assert.equal(reconcileCalls.length, 1);
});

test('skips mature open position when follower still has balance', async () => {
  const result = await reconcileZeroBalanceOpenPosition({
    position: {
      id: 'pos-2',
      status: 'open',
      tokenAddress: '0xtoken',
      chainId: 8453,
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
    walletAddress: '0xwallet',
    deps: {
      readBalance: async () => 10_000_000_000_000_000n,
      readDecimals: async () => 18,
      reconcile: async () => undefined,
    },
  });

  assert.equal(result.closed, false);
  assert.equal(result.skipped, 'positive_balance');
});

test('does not reconcile new positions before grace window', async () => {
  const result = await reconcileZeroBalanceOpenPosition({
    position: {
      id: 'pos-3',
      status: 'open',
      tokenAddress: '0xtoken',
      chainId: 8453,
      createdAt: new Date(Date.now() - 30 * 1000),
    },
    walletAddress: '0xwallet',
    deps: {
      readBalance: async () => 0n,
      readDecimals: async () => 18,
      reconcile: async () => undefined,
    },
  });

  assert.equal(result.closed, false);
  assert.equal(result.skipped, 'too_new');
});
