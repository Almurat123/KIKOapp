import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileTerminalExitGhostPosition } from '../runtime/terminalExitGhostPositionReconciler.js';

test('reconciles open position when latest exit intent is terminal failed', async () => {
  let archivedPayload: any = null;
  let advancedPayload: any = null;

  const result = await reconcileTerminalExitGhostPosition({
    position: {
      id: 'pos-1',
      status: 'open',
      tokenAddress: '0xtoken',
      tokenSymbol: 'TOK',
      chainId: 56,
      userId: 'user-1',
      configId: 'cfg-1',
    },
    terminalIntent: {
      id: 'intent-1',
      lifecycleState: 'EXIT_FAILED_TERMINAL',
      lastReasonCode: 'Swap failed: No valid quotes found',
      targetSellTxHash: '0xsell',
      closedAt: new Date('2026-04-10T00:00:00.000Z'),
      metadata: {
        orderId: 'order-1',
        targetWallet: '0xtarget',
      },
    },
    deps: {
      async persistTerminalExitBlockState(payload: any) {
        archivedPayload = payload;
      },
      async advanceCanonicalOrderState(payload: any) {
        advancedPayload = payload;
        return null;
      },
    },
  });

  assert.equal(result.repaired, true);
  assert.equal(result.reasonCode, 'Swap failed: No valid quotes found');
  assert.equal(archivedPayload?.reasonCode, 'Swap failed: No valid quotes found');
  assert.equal(advancedPayload?.orderId, 'order-1');
  assert.equal(advancedPayload?.lifecycleState, 'FAILED_TERMINAL');
});

test('does nothing when terminal exit intent is missing', async () => {
  const result = await reconcileTerminalExitGhostPosition({
    position: {
      id: 'pos-2',
      status: 'open',
      tokenAddress: '0xtoken',
      chainId: 56,
    },
    terminalIntent: null,
  });

  assert.equal(result.repaired, false);
});
