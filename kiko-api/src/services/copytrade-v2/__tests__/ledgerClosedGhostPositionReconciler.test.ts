import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileLedgerClosedGhostPosition } from '../runtime/ledgerClosedGhostPositionReconciler.js';

test('reconciles open position when ledger already says FOLLOWER_CLOSED', async () => {
  const syncCalls: any[] = [];

  const result = await reconcileLedgerClosedGhostPosition({
    position: {
      id: 'pos-1',
      status: 'open',
      tokenAddress: '0xtoken',
      tokenSymbol: 'TOK',
      chainId: 8453,
      userId: 'user-1',
      configId: 'config-1',
    },
    ledgerHint: {
      lifecycleState: 'FOLLOWER_CLOSED',
      trackedRemainingRaw: '0',
      followerExitTxHash: '0xexit',
      closedAt: new Date('2026-04-13T03:59:53.000Z'),
    },
    deps: {
      async updateMany() {
        return { count: 1 };
      },
      async syncLedger(payload: any) {
        syncCalls.push(payload);
      },
    },
  });

  assert.equal(result.repaired, true);
  assert.equal(result.reasonCode, 'ledger_closed_ghost_repaired');
  assert.equal(syncCalls.length, 1);
  assert.equal(syncCalls[0]?.followerExitTxHash, '0xexit');
});

test('reconciles open position when ledger has zero remaining exposure and exit evidence', async () => {
  const result = await reconcileLedgerClosedGhostPosition({
    position: {
      id: 'pos-2',
      status: 'open',
      tokenAddress: '0xtoken',
      chainId: 8453,
    },
    ledgerHint: {
      lifecycleState: 'FOLLOWER_OPEN',
      trackedRemainingRaw: '0',
      followerExitTxHash: '0xexit',
    },
    deps: {
      async updateMany() {
        return { count: 1 };
      },
      async syncLedger() {
        return null;
      },
    },
  });

  assert.equal(result.repaired, true);
  assert.equal(result.reasonCode, 'ledger_zero_remaining_ghost_repaired');
});

test('does not reconcile when ledger still shows remaining exposure', async () => {
  const result = await reconcileLedgerClosedGhostPosition({
    position: {
      id: 'pos-3',
      status: 'open',
      tokenAddress: '0xtoken',
      chainId: 8453,
    },
    ledgerHint: {
      lifecycleState: 'FOLLOWER_OPEN',
      trackedRemainingRaw: '42',
      followerExitTxHash: '0xexit',
    },
    deps: {
      async updateMany() {
        return { count: 1 };
      },
      async syncLedger() {
        return null;
      },
    },
  });

  assert.equal(result.repaired, false);
});
