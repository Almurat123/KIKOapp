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
