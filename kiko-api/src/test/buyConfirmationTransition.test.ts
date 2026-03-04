import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { applyBuyConfirmationTransition } from '../services/copytrade-v2/buy/buyConfirmationTransition.js';

describe('buy confirmation transition', () => {
  test('treats timeout as deferred without side effects', async () => {
    let notified = false;
    const result = await applyBuyConfirmationTransition({
      confirmation: { success: false, kind: 'uncertain', reason: 'tx_broadcast_unconfirmed', visible: true },
      chainId: 1,
      tokenToBuy: '0xpep',
      txHash: '0xtimeout',
      userId: 'user',
      targetWallet: '0xtarget',
      persistedPositionId: 'pos_1',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'late_recovery',
      onNotifySuccess: async () => {
        notified = true;
      },
      deps: {
        prisma: {
          position: {
            updateMany: async () => ({ count: 0 }),
          },
        } as any,
      },
    });

    assert.equal(result, 'deferred');
    assert.equal(notified, false);
  });

  test('promotes and notifies on confirmed success', async () => {
    let notified = false;
    let preheated = false;
    const result = await applyBuyConfirmationTransition({
      confirmation: { success: true, kind: 'confirmed_success', visible: true },
      chainId: 1,
      tokenToBuy: '0xpep',
      txHash: '0xok',
      userId: 'user',
      targetWallet: '0xtarget',
      persistedPositionId: 'pos_1',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'late_recovery',
      onNotifySuccess: async () => {
        notified = true;
      },
      deps: {
        prisma: {
          position: {
            updateMany: async () => ({ count: 1 }),
          },
        } as any,
        resolvePendingMirrorSellIntent: async () => ({ shouldMirrorSell: false, reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT' }),
        resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
        preheatSellApprovalForToken: async () => {
          preheated = true;
        },
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.equal(notified, true);
    assert.equal(preheated, true);
  });
});
