import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { applyBuyConfirmationTransition } from '../services/copytrade-v2/buy/buyConfirmationTransition.js';

describe('buy confirmation transition', () => {
  test('cancels blocked mirror sell intents when buy confirmation fails', async () => {
    let abortContext: any = null;

    const result = await applyBuyConfirmationTransition({
      confirmation: { success: false, kind: 'confirmed_failed', visible: true, reason: 'reverted' },
      chainId: 56,
      tokenToBuy: '0xpep',
      txHash: '0xfail',
      userId: 'user',
      targetWallet: '0xtarget',
      persistedPositionId: 'pos_fail',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'initial_wait',
      onMirrorSellAbort: async (context) => {
        abortContext = context;
      },
      deps: {
        prisma: {
          position: {
            updateMany: async () => ({ count: 1 }),
          },
        } as any,
        cancelPendingAttributedPosition: async () => 1,
      },
    });

    assert.equal(result, 'confirmed_failed');
    assert.deepEqual(abortContext, {
      positionId: 'pos_fail',
      reasonCode: 'buy_confirmation_failed',
    });
  });

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
          return { status: 'completed', reasonCode: 'approval_warmed' };
        },
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.equal(notified, true);
    assert.equal(preheated, true);
  });

  test('schedules mirror sell on confirmation without skipping downstream side effects', async () => {
    let notified = false;
    let preheated = false;
    let mirrorSellContext: any = null;

    const result = await applyBuyConfirmationTransition({
      confirmation: { success: true, kind: 'confirmed_success', visible: true },
      chainId: 56,
      tokenToBuy: '0xpep',
      txHash: '0xbuy',
      userId: 'user',
      targetWallet: '0xtarget',
      persistedPositionId: 'pos_2',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'initial_wait',
      onMirrorSellAfterConfirm: async (context) => {
        mirrorSellContext = context;
      },
      onNotifySuccess: async () => {
        notified = true;
      },
      deps: {
        prisma: {
          position: {
            updateMany: async () => ({ count: 1 }),
          },
        } as any,
        resolvePendingMirrorSellIntent: async () => ({
          shouldMirrorSell: true,
          targetSellTxHash: '0xtargetsell',
          reasonCode: 'TARGET_SELL_SEEN_IN_LEDGER',
        }),
        resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
        preheatSellApprovalForToken: async (_params, options) => {
          preheated = true;
          assert.deepEqual(options, {
            queueBehavior: 'allow_queue',
            txPurpose: 'approval',
          });
          return { status: 'completed', reasonCode: 'approval_warmed' };
        },
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.deepEqual(mirrorSellContext, {
      positionId: 'pos_2',
      targetSellTxHash: '0xtargetsell',
      reasonCode: 'TARGET_SELL_SEEN_IN_LEDGER',
    });
    assert.equal(notified, true);
    assert.equal(preheated, true);
  });

  test('defers fee recovery out of the buy confirmation hot path', async () => {
    let scheduledFeeRecovery: any = null;
    let collectorCalled = false;

    const result = await applyBuyConfirmationTransition({
      confirmation: { success: true, kind: 'confirmed_success', visible: true },
      chainId: 56,
      tokenToBuy: '0xpep',
      txHash: '0xbuy',
      userId: 'user',
      targetWallet: '0xtarget',
      persistedPositionId: 'pos_3',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'initial_wait',
      directFeeSettlement: {
        amountIn: '1',
        chainId: 56,
        mode: 'normal',
        normalizedTokenIn: '0xeeee',
        normalizedTokenOut: '0xpep',
        feeContext: 'copyTrade',
        deferred: true,
        reasonCode: 'buy_submitted_before_confirm',
        sourceTxHash: '0xbuy',
      },
      deps: {
        prisma: {
          position: {
            updateMany: async () => ({ count: 1 }),
          },
        } as any,
        resolvePendingMirrorSellIntent: async () => ({ shouldMirrorSell: false, reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT' }),
        resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
        scheduleDeferredBuyFeeRecovery: (params) => {
          scheduledFeeRecovery = params;
          return true;
        },
        scheduleDeferredSellApprovalPreheat: () => false,
        collectDirectSwapFeeFromSettlement: async () => {
          collectorCalled = true;
        },
        preheatSellApprovalForToken: async () => ({ status: 'noop', reasonCode: 'approval_already_sufficient' }),
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.equal(collectorCalled, false);
    assert.deepEqual(scheduledFeeRecovery, {
      userId: 'user',
      chainId: 56,
      tokenAddress: '0xpep',
      txHash: '0xbuy',
      recoverySource: 'initial_wait',
      settlement: {
        amountIn: '1',
        chainId: 56,
        mode: 'normal',
        normalizedTokenIn: '0xeeee',
        normalizedTokenOut: '0xpep',
        feeContext: 'copyTrade',
        deferred: true,
        reasonCode: 'buy_submitted_before_confirm',
        sourceTxHash: '0xbuy',
      },
    });
  });

  test('schedules deferred approval preheat when queue pressure blocks immediate warmup', async () => {
    let scheduledApproval: any = null;

    const result = await applyBuyConfirmationTransition({
      confirmation: { success: true, kind: 'confirmed_success', visible: true },
      chainId: 56,
      tokenToBuy: '0xpep',
      txHash: '0xbusy',
      userId: 'user',
      targetWallet: '0xtarget',
      persistedPositionId: 'pos_4',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'initial_wait',
      deps: {
        prisma: {
          position: {
            updateMany: async () => ({ count: 1 }),
          },
        } as any,
        resolvePendingMirrorSellIntent: async () => ({ shouldMirrorSell: false, reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT' }),
        resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
        preheatSellApprovalForToken: async () => ({ status: 'deferred', reasonCode: 'wallet_tx_queue_busy' }),
        scheduleDeferredSellApprovalPreheat: (params) => {
          scheduledApproval = params;
          return true;
        },
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.deepEqual(scheduledApproval, {
      userId: 'user',
      walletAddress: '0xwallet',
      chainId: 56,
      tokenAddress: '0xpep',
      tokenPriceUsd: 1,
      tokenDecimals: 18,
      trigger: 'buy_confirmation',
    });
  });
});
