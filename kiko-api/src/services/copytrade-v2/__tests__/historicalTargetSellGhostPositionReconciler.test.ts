import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileHistoricalTargetSellGhostPosition } from '../runtime/historicalTargetSellGhostPositionReconciler.js';

test('replays historical target sell for open ghost position without active intent', async () => {
  const calls: any[] = [];

  const result = await reconcileHistoricalTargetSellGhostPosition({
    position: {
      id: 'pos-1',
      status: 'open',
      userId: 'user-1',
      configId: 'config-1',
      chainId: 8453,
      tokenAddress: '0xtoken',
      leaderTxHash: '0xbuy',
      createdAt: new Date('2026-04-08T13:06:38.000Z'),
      entryAmountExact: '100',
    },
    targetWallet: '0xtarget',
    deps: {
      async resolveHistoricalTargetSellIntent() {
        return {
          disposition: 'execute_immediately',
          targetSellTxHash: '0xsell',
          reasonCode: 'TARGET_SELL_EVENT_REPLAYED_FROM_STORE',
          targetSellRatioBps: null,
          targetFullExitVerified: false,
          targetRemainingBalanceRaw: null,
        };
      },
      async releaseMirrorSellAfterBuyConfirm(payload: any) {
        calls.push(payload);
        return { outcome: 'scheduled' };
      },
    },
  });

  assert.equal(result.repaired, true);
  assert.equal(result.targetSellTxHash, '0xsell');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.sourceRuntime, 'position_monitor_historical_target_sell_reconciler');
});

test('skips historical replay when active exit intent already exists', async () => {
  let resolved = false;

  const result = await reconcileHistoricalTargetSellGhostPosition({
    position: {
      id: 'pos-1',
      status: 'open',
      userId: 'user-1',
      configId: 'config-1',
      chainId: 8453,
      tokenAddress: '0xtoken',
    },
    targetWallet: '0xtarget',
    hasActiveExitIntent: true,
    deps: {
      async resolveHistoricalTargetSellIntent() {
        resolved = true;
        return {
          disposition: 'execute_immediately',
          targetSellTxHash: '0xsell',
          reasonCode: 'TARGET_SELL_EVENT_REPLAYED_FROM_STORE',
        } as any;
      },
    },
  });

  assert.equal(result.repaired, false);
  assert.equal(resolved, false);
});

test('skips when no executable historical sell exists', async () => {
  let released = false;

  const result = await reconcileHistoricalTargetSellGhostPosition({
    position: {
      id: 'pos-1',
      status: 'open',
      userId: 'user-1',
      configId: 'config-1',
      chainId: 8453,
      tokenAddress: '0xtoken',
    },
    targetWallet: '0xtarget',
    deps: {
      async resolveHistoricalTargetSellIntent() {
        return {
          disposition: 'none',
          reasonCode: 'NO_HISTORICAL_TARGET_SELL',
        } as any;
      },
      async releaseMirrorSellAfterBuyConfirm() {
        released = true;
        return { outcome: 'scheduled' };
      },
    },
  });

  assert.equal(result.repaired, false);
  assert.equal(released, false);
});

test('treats already-active exit intent reuse as repaired without claiming fresh replay', async () => {
  const result = await reconcileHistoricalTargetSellGhostPosition({
    position: {
      id: 'pos-1',
      status: 'open',
      userId: 'user-1',
      configId: 'config-1',
      chainId: 8453,
      tokenAddress: '0xtoken',
      leaderTxHash: '0xbuy',
      createdAt: new Date('2026-04-08T13:06:38.000Z'),
    },
    targetWallet: '0xtarget',
    deps: {
      async resolveHistoricalTargetSellIntent() {
        return {
          disposition: 'execute_immediately',
          targetSellTxHash: '0xsell',
          reasonCode: 'TARGET_SELL_EVENT_REPLAYED_FROM_STORE',
        };
      },
      async releaseMirrorSellAfterBuyConfirm() {
        return { outcome: 'already_active' as const };
      },
    },
  });

  assert.equal(result.repaired, true);
  assert.equal(result.targetSellTxHash, '0xsell');
});
