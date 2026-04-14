import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBuyConfirmationTransition } from '../buy/buyConfirmationTransition.js';
import { buildCopytradeDomainAuditFields } from '../audit/copytradeDomainAudit.js';

function buildBaseParams() {
  return {
    confirmation: {
      success: true,
      kind: 'confirmed_success' as const,
      resolvedTxHash: '0xconfirmed',
      receipt: { status: '0x1' },
      visible: true,
    },
    chainId: 8453,
    tokenToBuy: '0xtoken',
    txHash: '0xsubmitted',
    userId: 'did:privy:user-1',
    configId: 'cfg-1',
    targetWallet: '0xtarget',
    leaderBuyTxHash: '0xleader',
    persistedPositionId: 'position-1',
    pendingPositionCreatedAt: new Date('2026-03-28T00:00:00.000Z'),
    tokenInfo: {
      symbol: 'TOK',
      price: 1,
      decimals: 18,
    },
    walletAddress: '0xwallet',
    recoverySource: 'late_recovery' as const,
    positionStatusCompat: {
      pendingCreateStatus: 'pending',
      failedFinalStatus: 'failed',
    },
    runtimeContext: {
      orderId: 'runtime-order-1',
      chainId: 8453,
      userId: 'did:privy:user-1',
      walletAddress: '0xwallet',
      side: 'buy' as const,
      mode: 'copytrade' as const,
      state: 'rpc_uncertain' as const,
      reasonCode: 'pending_visibility' as const,
      sourceTxHash: '0xleader',
      canonicalTxHash: '0xconfirmed',
      relatedTxHashes: ['0xconfirmed'],
      route: { provider: 'uniswap-v2' },
      timing: { createdAt: Date.now() },
      attempts: [],
      fallbackUsed: false,
      metadata: {},
      lastLifecycle: {
        status: 'broadcasted_unseen' as const,
        txHash: '0xconfirmed',
        attempts: 1,
        chainId: 8453,
      },
    },
  };
}

test('applyBuyConfirmationTransition emits promoted-open audit with confirmed lifecycle and order id', async () => {
  const events: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const deferredRecoveries: Array<Record<string, unknown>> = [];

  const result = await applyBuyConfirmationTransition({
    ...buildBaseParams(),
    directFeeSettlement: {
      amountIn: '1',
      chainId: 8453,
      mode: 'copytrade',
      normalizedTokenIn: '0xeeee',
      normalizedTokenOut: '0xtoken',
      amountOutBase: '1000',
      feeContext: 'copyTrade',
      deferred: true,
      reasonCode: 'broadcasted_unseen',
      sourceTxHash: '0xconfirmed',
    },
    deps: {
      prisma: {
        position: {
          updateMany: async () => ({ count: 1 }),
        },
      } as any,
      resolvePendingMirrorSellIntent: (async () => null) as any,
      resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
      emitCopytradeDomainAudit: (event: any, input: any) => {
        events.push({ event, fields: buildCopytradeDomainAuditFields(input as any) });
      },
      resolveConfirmedReceiptTokenAmount: async () => '1000',
      persistConfirmedBuyAmount: async () => null,
      recordFollowerTransactionFactByPosition: async () => undefined,
      claimOrCreateCanonicalOrder: (async () => ({ id: 'canonical-order-1' })) as any,
      advanceCanonicalOrderState: (async () => null) as any,
      recordCanonicalOrderExecution: async () => undefined,
      scheduleDeferredBuyFeeRecovery: (params: any) => {
        deferredRecoveries.push(params as any);
        return true;
      },
      preheatSellApprovalForToken: async () => ({ status: 'ready' } as any),
    } as any,
  });

  assert.equal(result, 'confirmed_success');
  assert.equal(deferredRecoveries.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.event, 'BUY_CONFIRMATION_PROMOTED_OPEN');
  assert.equal(events[0]?.fields.executionLifecycleState, 'confirmed_success');
  assert.equal(events[0]?.fields.executionLifecycleAccepted, true);
  assert.equal(events[0]?.fields.executionLifecycleConfirmed, true);
  assert.equal(events[0]?.fields.executionTxHash, '0xconfirmed');
  assert.equal(events[0]?.fields.executionProvider, 'uniswap-v2');
  assert.equal(events[0]?.fields.orderId, 'canonical-order-1');
});

test('applyBuyConfirmationTransition emits closed-before-open audit with confirmed lifecycle context', async () => {
  const events: Array<{ event: string; fields: Record<string, unknown> }> = [];

  const result = await applyBuyConfirmationTransition({
    ...buildBaseParams(),
    deps: {
      prisma: {
        position: {
          updateMany: async () => ({ count: 0 }),
        },
      } as any,
      resolvePendingMirrorSellIntent: (async () => null) as any,
      resolveBuyConfirmationPromotionAction: async () => ({
        action: 'closed_before_open',
        exitTxHash: '0xexit',
        exitReason: 'target_already_sold',
      }),
      emitCopytradeDomainAudit: (event: any, input: any) => {
        events.push({ event, fields: buildCopytradeDomainAuditFields(input as any) });
      },
      resolveConfirmedReceiptTokenAmount: async () => null,
      persistConfirmedBuyAmount: async () => null,
      recordFollowerTransactionFactByPosition: async () => undefined,
      claimOrCreateCanonicalOrder: (async () => ({ id: 'canonical-order-2' })) as any,
      advanceCanonicalOrderState: (async () => null) as any,
      recordCanonicalOrderExecution: async () => undefined,
      preheatSellApprovalForToken: async () => ({ status: 'ready' } as any),
    } as any,
  });

  assert.equal(result, 'confirmed_success');
  assert.equal(events.length, 1);
  assert.equal(events[0]?.event, 'BUY_CONFIRMATION_CLOSED_BEFORE_OPEN');
  assert.equal(events[0]?.fields.executionLifecycleState, 'confirmed_success');
  assert.equal(events[0]?.fields.executionLifecycleAccepted, true);
  assert.equal(events[0]?.fields.executionTxHash, '0xconfirmed');
  assert.equal(events[0]?.fields.exitTxHash, '0xexit');
  assert.equal(events[0]?.fields.exitReason, 'target_already_sold');
  assert.equal(events[0]?.fields.orderId, 'canonical-order-2');
});

test('applyBuyConfirmationTransition arms exit without immediate mirror sell for unverified history intent', async () => {
  const advanceCalls: any[] = [];

  const result = await applyBuyConfirmationTransition({
    ...buildBaseParams(),
    deps: {
      prisma: {
        position: {
          updateMany: async () => ({ count: 1 }),
        },
      } as any,
      resolvePendingMirrorSellIntent: async () => ({
        disposition: 'arm_exit',
        targetSellTxHash: '0xsell-history',
        reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY_UNVERIFIED',
      }),
      resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
      emitCopytradeDomainAudit: () => undefined,
      resolveConfirmedReceiptTokenAmount: async () => '1000',
      persistConfirmedBuyAmount: async () => null,
      recordFollowerTransactionFactByPosition: async () => undefined,
      claimOrCreateCanonicalOrder: (async () => ({ id: 'canonical-order-3' })) as any,
      advanceCanonicalOrderState: async (payload: any) => {
        advanceCalls.push(payload);
        return null;
      },
      recordCanonicalOrderExecution: async () => undefined,
      preheatSellApprovalForToken: async () => {
        throw new Error('preheat should be skipped when exit is armed');
      },
    } as any,
  });

  assert.equal(result, 'confirmed_success');
  assert.equal(advanceCalls.some((call) => call.eventType === 'ORDER_BUY_CONFIRMED_ARMED_FOR_EXIT'), true);
  assert.equal(advanceCalls.some((call) => call.eventType === 'ORDER_BUY_CONFIRMED_RELEASED_TO_EXIT'), false);
});

test('applyBuyConfirmationTransition replays durable target sell history into exit scheduling after promotion', async () => {
  const advanceCalls: any[] = [];
  let releasedPayload: any = null;

  const result = await applyBuyConfirmationTransition({
    ...buildBaseParams(),
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
      resolveHistoricalTargetSellIntent: async () => ({
        disposition: 'execute_immediately',
        targetSellTxHash: '0xhistoricalsell',
        reasonCode: 'TARGET_SELL_EVENT_REPLAYED_FROM_STORE',
        targetSellRatioBps: null,
        targetFullExitVerified: false,
        targetRemainingBalanceRaw: null,
      }),
      releaseMirrorSellAfterBuyConfirm: async (payload: any) => {
        releasedPayload = payload;
        return { outcome: 'scheduled' as const };
      },
      resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
      emitCopytradeDomainAudit: () => undefined,
      resolveConfirmedReceiptTokenAmount: async () => '1000',
      persistConfirmedBuyAmount: async () => null,
      recordFollowerTransactionFactByPosition: async () => undefined,
      claimOrCreateCanonicalOrder: (async () => ({ id: 'canonical-order-history' })) as any,
      advanceCanonicalOrderState: async (payload: any) => {
        advanceCalls.push(payload);
        return null;
      },
      recordCanonicalOrderExecution: async () => undefined,
      preheatSellApprovalForToken: async () => {
        throw new Error('preheat should be skipped when historical mirror sell is replayed');
      },
    } as any,
  });

  assert.equal(result, 'confirmed_success');
  assert.equal(releasedPayload?.targetSellTxHash, '0xhistoricalsell');
  assert.equal(releasedPayload?.position?.id, 'position-1');
  assert.equal(
    advanceCalls.some((call) =>
      call.lifecycleState === 'EXIT_ARMED'
      && call.eventType === 'ORDER_BUY_CONFIRMED_ARMED_FOR_EXIT'
      && call.metadataPatch?.targetSellTxHash === '0xhistoricalsell'
    ),
    true,
  );
});

test('applyBuyConfirmationTransition repairs deferred fee settlement with confirmed amount before scheduling recovery', async () => {
  const deferredRecoveries: any[] = [];
  const advanceCalls: any[] = [];
  const executionCalls: any[] = [];

  const result = await applyBuyConfirmationTransition({
    ...buildBaseParams(),
    directFeeSettlement: {
      amountIn: '1',
      chainId: 8453,
      mode: 'copytrade',
      normalizedTokenIn: '0xeeee',
      normalizedTokenOut: '0xtoken',
      amountOutBase: '0',
      feeContext: 'copyTrade',
      deferred: true,
      reasonCode: 'broadcasted_unseen',
      sourceTxHash: '0xconfirmed',
    },
    deps: {
      prisma: {
        position: {
          updateMany: async () => ({ count: 1 }),
        },
      } as any,
      resolvePendingMirrorSellIntent: async () => null,
      resolveBuyConfirmationPromotionAction: async () => ({ action: 'promote_open' }),
      emitCopytradeDomainAudit: () => undefined,
      resolveConfirmedReceiptTokenAmount: async () => '123456',
      persistConfirmedBuyAmount: async () => null,
      recordFollowerTransactionFactByPosition: async () => undefined,
      claimOrCreateCanonicalOrder: (async () => ({ id: 'canonical-order-4' })) as any,
      advanceCanonicalOrderState: async (payload: any) => {
        advanceCalls.push(payload);
        return null;
      },
      recordCanonicalOrderExecution: async (payload: any) => {
        executionCalls.push(payload);
        return undefined;
      },
      scheduleDeferredBuyFeeRecovery: (params: any) => {
        deferredRecoveries.push(params);
        return true;
      },
      preheatSellApprovalForToken: async () => ({ status: 'ready' } as any),
    } as any,
  });

  assert.equal(result, 'confirmed_success');
  assert.equal(deferredRecoveries.length, 1);
  assert.equal(deferredRecoveries[0]?.settlement?.amountOutBase, '123456');
  assert.equal(advanceCalls[0]?.metadataPatch?.directFeeSettlement?.amountOutBase, '123456');
  assert.equal(executionCalls[0]?.metadata?.directFeeSettlement?.amountOutBase, '123456');
});

test('applyBuyConfirmationTransition does not notify again when position is already open', async () => {
  let notifyCount = 0;

  const result = await applyBuyConfirmationTransition({
    ...buildBaseParams(),
    onNotifySuccess: async () => {
      notifyCount += 1;
    },
    deps: {
      prisma: {
        position: {
          updateMany: async () => ({ count: 0 }),
        },
      } as any,
      resolvePendingMirrorSellIntent: async () => null,
      resolveBuyConfirmationPromotionAction: async () => ({ action: 'already_open' }),
      emitCopytradeDomainAudit: () => undefined,
      resolveConfirmedReceiptTokenAmount: async () => '1000',
      persistConfirmedBuyAmount: async () => null,
      recordFollowerTransactionFactByPosition: async () => undefined,
      claimOrCreateCanonicalOrder: (async () => ({ id: 'canonical-order-5' })) as any,
      advanceCanonicalOrderState: (async () => null) as any,
      recordCanonicalOrderExecution: async () => undefined,
      preheatSellApprovalForToken: async () => ({ status: 'ready' } as any),
    } as any,
  });

  assert.equal(result, 'confirmed_success');
  assert.equal(notifyCount, 0);
});
