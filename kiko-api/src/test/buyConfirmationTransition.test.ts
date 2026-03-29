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
        resolvePendingMirrorSellIntent: async () => ({ disposition: 'none', reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT' }),
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

  test('arms exit on confirmation without triggering mirror sell side effects', async () => {
    let notified = false;
    let preheated = false;
    const advanced: any[] = [];

    const result = await applyBuyConfirmationTransition({
      confirmation: { success: true, kind: 'confirmed_success', visible: true },
      chainId: 56,
      tokenToBuy: '0xpep',
      txHash: '0xbuy',
      userId: 'user',
      configId: 'cfg-1',
      targetWallet: '0xtarget',
      leaderBuyTxHash: '0xleader-buy',
      persistedPositionId: 'pos_2',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'initial_wait',
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
          disposition: 'execute_immediately',
          targetSellTxHash: '0xtargetsell',
          reasonCode: 'ACTIVE_EXIT_INTENT_PRESENT',
        }),
        resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
        claimOrCreateCanonicalOrder: async () => ({
          id: 'order-2',
          canonicalKey: 'chain:leader:target:user:cfg:token:buy',
          lifecycleState: 'BUY_SUBMITTING',
          lastReasonCode: 'ok_buy_submitted',
          chainId: 56,
          txHash: '0xleader',
          targetWallet: '0xtarget',
          tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          tokenOut: '0xpep',
          userId: 'user',
          configId: 'cfg-1',
          metadata: {},
        }),
        advanceCanonicalOrderState: async (params) => {
          advanced.push(params);
          return null;
        },
        preheatSellApprovalForToken: async () => {
          preheated = true;
          return { status: 'completed', reasonCode: 'approval_warmed' };
        },
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.equal(
      advanced.some((entry) =>
        entry.lifecycleState === 'EXIT_ARMED'
        && entry.eventType === 'ORDER_BUY_CONFIRMED_ARMED_FOR_EXIT'
        && entry.metadataPatch?.targetSellTxHash === '0xtargetsell'
      ),
      true,
    );
    assert.equal(notified, true);
    assert.equal(preheated, false);
  });

  test('confirmed buy with pending target sell stays in buy workflow even when position closed before open', async () => {
    let notified = false;
    let preheated = false;

    const result = await applyBuyConfirmationTransition({
      confirmation: { success: true, kind: 'confirmed_success', visible: true },
      chainId: 8453,
      tokenToBuy: '0xpep',
      txHash: '0xbuy-race',
      userId: 'user',
      targetWallet: '0xtarget',
      persistedPositionId: 'pos-race',
      pendingPositionCreatedAt: null,
      tokenInfo: { symbol: 'PEPE', price: 1, decimals: 18 },
      walletAddress: '0xwallet',
      positionStatusCompat: { pendingCreateStatus: 'pending', failedFinalStatus: 'failed' },
      recoverySource: 'initial_wait',
      onNotifySuccess: async () => {
        notified = true;
      },
      deps: {
        prisma: {
          position: {
            updateMany: async () => ({ count: 0 }),
          },
        } as any,
        resolvePendingMirrorSellIntent: async () => ({
          disposition: 'execute_immediately',
          targetSellTxHash: '0xtargetsell-race',
          reasonCode: 'ACTIVE_EXIT_INTENT_PRESENT',
        }),
        resolveBuyConfirmationPromotionAction: async () => ({
          action: 'closed_before_open',
          status: 'closed',
          exitTxHash: '0xexit',
          exitReason: 'mirror_sell',
        }),
        preheatSellApprovalForToken: async () => {
          preheated = true;
          return { status: 'completed', reasonCode: 'approval_warmed' };
        },
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.equal(notified, true);
    assert.equal(preheated, false);
  });

  test('canonical order target sell metadata keeps order armed for exit without releasing sell', async () => {
    const advanced: any[] = [];

    const result = await applyBuyConfirmationTransition({
      confirmation: { success: true, kind: 'confirmed_success', visible: true },
      chainId: 8453,
      tokenToBuy: '0xpep',
      txHash: '0xbuy-canonical',
      userId: 'user',
      configId: 'cfg-1',
      targetWallet: '0xtarget',
      leaderBuyTxHash: '0xleader',
      persistedPositionId: 'pos-canonical',
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
        resolvePendingMirrorSellIntent: async () => ({
          disposition: 'none',
          reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
        }),
        resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
        claimOrCreateCanonicalOrder: async () => ({
          id: 'order-1',
          canonicalKey: 'chain:leader:target:user:cfg:token:buy',
          lifecycleState: 'BUY_SUBMITTING',
          lastReasonCode: 'ok_buy_submitted',
          chainId: 8453,
          txHash: '0xleader',
          targetWallet: '0xtarget',
          tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          tokenOut: '0xpep',
          userId: 'user',
          configId: 'cfg-1',
          metadata: {
            targetSellTxHash: '0xtargetsell-canonical',
            targetSellReasonCode: 'sell_preempted_before_buy_confirm',
          },
        }),
        advanceCanonicalOrderState: async (params) => {
          advanced.push(params);
          return null;
        },
        recordCanonicalOrderExecution: async () => undefined,
        preheatSellApprovalForToken: async () => ({ status: 'noop', reasonCode: 'approval_already_sufficient' }),
        emitCopytradeDomainAudit: () => {},
      },
    });

    assert.equal(result, 'confirmed_success');
    assert.equal(
      advanced.some((entry) =>
        entry.lifecycleState === 'EXIT_ARMED'
        && entry.eventType === 'ORDER_BUY_CONFIRMED_ARMED_FOR_EXIT'
        && entry.metadataPatch?.targetSellTxHash === '0xtargetsell-canonical'
      ),
      true,
    );
    assert.equal(
      advanced.some((entry) => entry.lifecycleState === 'BUY_CONFIRMED_OPEN' && entry.eventType === 'ORDER_BUY_CONFIRMED_OPEN'),
      false,
    );
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
        resolvePendingMirrorSellIntent: async () => ({ disposition: 'none', reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT' }),
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
        resolvePendingMirrorSellIntent: async () => ({ disposition: 'none', reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT' }),
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
