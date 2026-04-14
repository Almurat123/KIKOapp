import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import { releaseMirrorSellAfterBuyConfirm } from './buyConfirmationMirrorSellRelease.js';
import { cancelPendingAttributedPosition } from '../positions/pendingAttributedPositionLedger.js';
import {
  resolveHistoricalTargetSellIntent,
  resolveBuyConfirmationPromotionAction,
  resolvePendingMirrorSellIntent,
  type ResolvedPendingMirrorSellIntent,
} from '../positions/buySellRaceCoordinator.js';
import {
  collectDirectSwapFeeFromSettlement,
  type DirectSwapFeeSettlement
} from '../../swap/fee/directSwapFeeCollector.js';
import { preheatSellApprovalForToken } from '../../sellApprovalPreheater.js';
import { resolveConfirmedReceiptTokenAmount } from './confirmedReceiptTokenAmount.js';
import { persistConfirmedBuyAmount } from './confirmedBuyAmountPersistence.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { scheduleDeferredBuyFeeRecovery } from './deferredBuyFeeRecovery.js';
import { scheduleDeferredSellApprovalPreheat } from './deferredSellApprovalPreheat.js';
import { recordFollowerTransactionFactByPosition } from '../data-flow/followerTransactionFactLedger.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';
import {
  advanceCanonicalOrderState,
  claimOrCreateCanonicalOrder,
  recordCanonicalOrderExecution,
} from '../orders/canonicalOrderState.js';
import { resolveCanonicalSellPreemption } from '../orders/canonicalOrderPolicy.js';
import {
  chooseMirrorSellIntent,
  hasMirrorSellIntent,
} from '../positions/mirrorSellIntentPolicy.js';

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Avery Lin
// Reason: Buy confirmation is the owner boundary where a pending position becomes
//         durable exposure. It must also replay any already-seen target sell so the
//         position does not linger as open with no exit work scheduled.
// Goal: Promote confirmed buys exactly once, recover historical mirror-sell races,
//       and keep canonical order / position / exit-intent state aligned.
// Owns: Buy-confirmation state transition, receipt persistence, and historical
//       target-sell release into exit work.
// Does Not Own: Target-sell detection, exit execution, or monitor-side stale cleanup.
// Design Language:
// - Promotion to open and mirror-sell replay must happen in the same owner layer.
// - Durable historical sell evidence must be released before falling back to TP/SL monitoring.
// - Do not mark an order armed for exit unless durable exit work was actually created or reused.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-buy-confirm-target-sell-replay-gap.md

export type BuyConfirmationTransitionResult = 'confirmed_success' | 'confirmed_failed' | 'deferred';
export interface MirrorSellAbortContext {
  positionId: string;
  reasonCode: 'buy_confirmation_failed';
}

type PositionStatusCompatLike = {
  pendingCreateStatus: string;
  failedFinalStatus: string;
};

function tryParsePositiveRawAmount(value: string | null | undefined): bigint | null {
  if (!value) return null;
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function repairDeferredDirectFeeSettlement(params: {
  settlement?: DirectSwapFeeSettlement | null;
  confirmedAmountRaw?: string | null;
}): DirectSwapFeeSettlement | null | undefined {
  const { settlement, confirmedAmountRaw } = params;
  if (!settlement) return settlement;
  if (tryParsePositiveRawAmount(settlement.amountOutBase)) return settlement;

  const repairedAmountOutBase = tryParsePositiveRawAmount(confirmedAmountRaw);
  if (!repairedAmountOutBase) return settlement;

  return {
    ...settlement,
    amountOutBase: repairedAmountOutBase.toString(),
  };
}

function confirmationToTxLifecycle(params: {
  confirmation: ConfirmationOutcome;
  chainId: number;
  txHash: string;
}): TxLifecycleResult | null {
  if (params.confirmation.kind === 'confirmed_success') {
    return {
      status: 'confirmed_success',
      txHash: params.txHash,
      confirmedAt: Date.now(),
      attempts: 1,
      chainId: params.chainId,
    };
  }
  if (params.confirmation.kind === 'confirmed_failed') {
    return {
      status: 'confirmed_failed',
      txHash: params.txHash,
      confirmedAt: Date.now(),
      lastRpcError: params.confirmation.reason,
      attempts: 1,
      chainId: params.chainId,
    };
  }
  return null;
}

export async function applyBuyConfirmationTransition(params: {
  confirmation: ConfirmationOutcome;
  chainId: number;
  tokenToBuy: string;
  txHash: string;
  userId: string;
  configId?: string;
  targetWallet: string;
  leaderBuyTxHash?: string | null;
  persistedPositionId?: string | null;
  pendingPositionCreatedAt?: Date | null;
  tokenInfo: {
    symbol?: string | null;
    price: number;
    decimals: number;
  };
  walletAddress: string;
  positionStatusCompat: PositionStatusCompatLike;
  directFeeSettlement?: DirectSwapFeeSettlement | null;
  runtimeContext?: OrderRuntimeContext | null;
  onMirrorSellAbort?: (context: MirrorSellAbortContext) => Promise<void>;
  onNotifySuccess?: () => Promise<void>;
  recoverySource: 'initial_wait' | 'late_recovery';
  deps?: {
    prisma?: typeof prisma;
    cancelPendingAttributedPosition?: typeof cancelPendingAttributedPosition;
    resolvePendingMirrorSellIntent?: typeof resolvePendingMirrorSellIntent;
    resolveBuyConfirmationPromotionAction?: typeof resolveBuyConfirmationPromotionAction;
    collectDirectSwapFeeFromSettlement?: typeof collectDirectSwapFeeFromSettlement;
    scheduleDeferredBuyFeeRecovery?: typeof scheduleDeferredBuyFeeRecovery;
    scheduleDeferredSellApprovalPreheat?: typeof scheduleDeferredSellApprovalPreheat;
    preheatSellApprovalForToken?: typeof preheatSellApprovalForToken;
    emitCopytradeDomainAudit?: typeof emitCopytradeDomainAudit;
    resolveConfirmedReceiptTokenAmount?: typeof resolveConfirmedReceiptTokenAmount;
    persistConfirmedBuyAmount?: typeof persistConfirmedBuyAmount;
    recordFollowerTransactionFactByPosition?: typeof recordFollowerTransactionFactByPosition;
    claimOrCreateCanonicalOrder?: typeof claimOrCreateCanonicalOrder;
    advanceCanonicalOrderState?: typeof advanceCanonicalOrderState;
    recordCanonicalOrderExecution?: typeof recordCanonicalOrderExecution;
    resolveHistoricalTargetSellIntent?: typeof resolveHistoricalTargetSellIntent;
    releaseMirrorSellAfterBuyConfirm?: typeof releaseMirrorSellAfterBuyConfirm;
  };
}): Promise<BuyConfirmationTransitionResult> {
  const {
    confirmation,
    chainId,
    tokenToBuy,
    txHash,
    userId,
    configId,
    targetWallet,
    leaderBuyTxHash,
    persistedPositionId,
    pendingPositionCreatedAt,
    tokenInfo,
    walletAddress,
    positionStatusCompat,
    directFeeSettlement,
    runtimeContext,
    onMirrorSellAbort,
    onNotifySuccess,
    recoverySource,
    deps,
  } = params;
  const prismaClient = deps?.prisma || prisma;
  const cancelPending = deps?.cancelPendingAttributedPosition || cancelPendingAttributedPosition;
  const resolveMirrorIntent = deps?.resolvePendingMirrorSellIntent || resolvePendingMirrorSellIntent;
  const resolvePromotionAction = deps?.resolveBuyConfirmationPromotionAction || resolveBuyConfirmationPromotionAction;
  const deferFeeRecovery = deps?.scheduleDeferredBuyFeeRecovery || scheduleDeferredBuyFeeRecovery;
  const deferApprovalPreheat = deps?.scheduleDeferredSellApprovalPreheat || scheduleDeferredSellApprovalPreheat;
  const preheatSell = deps?.preheatSellApprovalForToken || preheatSellApprovalForToken;
  const emitDomainAudit = deps?.emitCopytradeDomainAudit || emitCopytradeDomainAudit;
  const resolveReceiptAmount = deps?.resolveConfirmedReceiptTokenAmount || resolveConfirmedReceiptTokenAmount;
  const persistReceiptAmount = deps?.persistConfirmedBuyAmount || persistConfirmedBuyAmount;
  const recordFollowerFact = deps?.recordFollowerTransactionFactByPosition || recordFollowerTransactionFactByPosition;
  const claimOrder = deps?.claimOrCreateCanonicalOrder || claimOrCreateCanonicalOrder;
  const advanceOrderState = deps?.advanceCanonicalOrderState || advanceCanonicalOrderState;
  const recordOrderExecution = deps?.recordCanonicalOrderExecution || recordCanonicalOrderExecution;
  const resolveHistoricalSellIntent = deps?.resolveHistoricalTargetSellIntent || resolveHistoricalTargetSellIntent;
  const releaseHistoricalMirrorSell = deps?.releaseMirrorSellAfterBuyConfirm || releaseMirrorSellAfterBuyConfirm;
  const resolvedTxHash = confirmation.resolvedTxHash || txHash;
  const confirmationLifecycle = confirmationToTxLifecycle({
    confirmation,
    chainId,
    txHash: resolvedTxHash,
  });
  const canonicalOrder = leaderBuyTxHash && targetWallet && configId
    ? await claimOrder({
        userId,
        configId,
        chainId,
        targetWallet,
        tokenAddress: tokenToBuy,
        leaderTxHash: leaderBuyTxHash,
        direction: 'buy',
        mode: 'legacy',
        tokenOut: tokenToBuy,
        metadata: {
          buyTxHash: resolvedTxHash,
          positionIdLegacy: persistedPositionId || null,
        },
      }).catch(() => null)
    : null;

  if (confirmation.kind === 'confirmed_failed') {
    if (persistedPositionId) {
      await prismaClient.position.updateMany({
        where: { id: persistedPositionId, status: positionStatusCompat.pendingCreateStatus as any },
        data: { status: positionStatusCompat.failedFinalStatus as any }
      }).catch((error) => {
        logger.error(LogCode.SYS_ERROR, 'Failed to mark pending buy position as failed', { error });
      });
    }

    await cancelPending({
      positionId: persistedPositionId,
      reasonCode: 'buy_confirmation_failed'
    }).catch(() => 0);

    if (persistedPositionId && onMirrorSellAbort) {
      await onMirrorSellAbort({
        positionId: persistedPositionId,
        reasonCode: 'buy_confirmation_failed',
      });
    }

    logger.warn(LogCode.EXE_TX_REVERTED, '[CopyTradeBuyConfirm] Buy transaction failed after submission', {
      chainId,
      token: tokenToBuy,
      txHash: resolvedTxHash,
      recoverySource,
      reason: confirmation.reason || 'confirmed_failed'
    });
    if (canonicalOrder) {
      await advanceOrderState({
        orderId: canonicalOrder.id,
        lifecycleState: 'FAILED_TERMINAL',
        reasonCode: 'buy_confirmation_failed',
        eventType: 'ORDER_BUY_CONFIRM_FAILED',
        metadataPatch: {
          buyTxHash: resolvedTxHash,
          positionIdLegacy: persistedPositionId || null,
          awaitingKind: null,
          nextObservationAt: null,
          lastObservedTxHash: resolvedTxHash,
          lastObservedTxState: 'confirmed_failed',
          lastObservedAt: new Date().toISOString(),
        },
      }).catch(() => null);
      await recordOrderExecution({
        orderId: canonicalOrder.id,
        status: 'failed_terminal',
        reasonCode: 'buy_confirmation_failed',
        txHash: resolvedTxHash,
        mode: 'legacy',
        retryable: false,
        metadata: {
          recoverySource,
        },
      }).catch(() => null);
    }
    return 'confirmed_failed';
  }

  if (confirmation.kind !== 'confirmed_success') {
    logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Skipped: buy tx not confirmed yet', {
      chainId,
      token: tokenToBuy,
      txHash: resolvedTxHash,
      recoverySource
    });
    return 'deferred';
  }

  let confirmedAmountRaw: string | null = null;
  if (persistedPositionId) {
    confirmedAmountRaw = await resolveReceiptAmount({
      chainId,
      txHash: resolvedTxHash,
      tokenAddress: tokenToBuy,
      walletAddress,
      receipt: confirmation.receipt,
    }).catch(() => null);

    if (confirmedAmountRaw) {
      await persistReceiptAmount({
        positionId: persistedPositionId,
        chainId,
        tokenAddress: tokenToBuy,
        walletAddress,
        targetWallet,
        txHash: resolvedTxHash,
        amountRaw: confirmedAmountRaw,
        decimals: tokenInfo.decimals,
      }).catch(() => null);
    }

    await recordFollowerFact({
      positionId: persistedPositionId,
      kind: 'buy',
      phase: 'confirmed',
      txHash: resolvedTxHash,
      walletAddress,
      amountRaw: confirmedAmountRaw,
      reasonCode: confirmedAmountRaw ? 'ok_follower_buy_confirmed' : 'ok_follower_buy_confirmed_without_receipt_amount',
      metadata: {
        chainId,
        tokenAddress: tokenToBuy,
        recoverySource,
      },
    }).catch(() => null);
  }

  const effectiveDirectFeeSettlement = repairDeferredDirectFeeSettlement({
    settlement: directFeeSettlement,
    confirmedAmountRaw,
  });

  // Gather every already-known mirror-sell signal before we decide whether the
  // confirmed buy should stay open or immediately release into exit work.
  const pendingMirrorIntent = await resolveMirrorIntent({
    positionId: persistedPositionId,
    targetWallet,
    tokenAddress: tokenToBuy,
    chainId,
    leaderBuyTxHash: leaderBuyTxHash || undefined,
    positionCreatedAt: pendingPositionCreatedAt
  }).catch(() => null);
  const canonicalMirrorIntent = resolveCanonicalSellPreemption(canonicalOrder);
  const directMirrorIntent = chooseMirrorSellIntent(
    pendingMirrorIntent,
    canonicalMirrorIntent,
  );
  const historicalMirrorIntent = !hasMirrorSellIntent(directMirrorIntent)
    ? await resolveHistoricalSellIntent({
        targetWallet,
        tokenAddress: tokenToBuy,
        chainId,
        leaderBuyTxHash: leaderBuyTxHash || undefined,
        positionCreatedAt: pendingPositionCreatedAt,
      }).catch(() => null)
    : null;

  const promotionAction = await resolvePromotionAction({
    positionId: persistedPositionId
  }).catch(() => ({ action: 'missing' as const }));

  if (persistedPositionId) {
    let promotionOutcome = 'POSITION_PROMOTION_SKIPPED';
    let rowsUpdated: number | null = null;
    if (promotionAction.action === 'promote_open') {
      const promoteResult = await prismaClient.position.updateMany({
        where: { id: persistedPositionId, status: positionStatusCompat.pendingCreateStatus as any },
        data: { status: 'open' as any, entryTxHash: resolvedTxHash }
      }).catch((error) => {
        logger.error(LogCode.SYS_ERROR, 'Failed to promote pending buy position to open', { error });
        return null;
      });
      rowsUpdated = promoteResult?.count ?? null;
      promotionOutcome = promoteResult === null
        ? 'error'
        : promoteResult.count > 0 ? 'PROMOTED_NOW' : 'POSITION_PROMOTION_SKIPPED';
      if (promotionOutcome === 'PROMOTED_NOW') {
        emitDomainAudit('BUY_CONFIRMATION_PROMOTED_OPEN', {
          txLifecycle: confirmationLifecycle,
          runtimeContext,
          extra: {
            orderId: canonicalOrder?.id || runtimeContext?.orderId || null,
            positionId: persistedPositionId,
            txHash: resolvedTxHash,
            chainId,
            tokenAddress: tokenToBuy,
            recoverySource,
          }
        });
      }
    } else if (promotionAction.action === 'already_open') {
      promotionOutcome = 'ALREADY_OPEN';
    } else if (promotionAction.action === 'closed_before_open') {
      promotionOutcome = 'CLOSED_BEFORE_OPEN';
      emitDomainAudit('BUY_CONFIRMATION_CLOSED_BEFORE_OPEN', {
        txLifecycle: confirmationLifecycle,
        runtimeContext,
        extra: {
          orderId: canonicalOrder?.id || runtimeContext?.orderId || null,
          positionId: persistedPositionId,
          txHash: resolvedTxHash,
          chainId,
          tokenAddress: tokenToBuy,
          recoverySource,
          exitTxHash: promotionAction.exitTxHash || null,
          exitReason: promotionAction.exitReason || null,
        }
      });
    } else {
      promotionOutcome = 'POSITION_PROMOTION_SKIPPED';
    }

    logger.info(LogCode.SYS_INFO, `[CopyTradePosition] Buy confirmation promotion result: ${promotionOutcome} rowsUpdated=${rowsUpdated ?? 'n/a'} positionId=${persistedPositionId}`, {
      positionId: persistedPositionId,
      promotionOutcome,
      rowsUpdated,
      txHash: resolvedTxHash,
      chainId,
      token: tokenToBuy,
      recoverySource,
      targetSellTxHash: directMirrorIntent?.targetSellTxHash || historicalMirrorIntent?.targetSellTxHash || undefined,
      targetSellReasonCode: directMirrorIntent?.reasonCode || historicalMirrorIntent?.reasonCode || undefined
    });
  }

  let resolvedMirrorIntent = directMirrorIntent;
  if (
    persistedPositionId
    && configId
    && !hasMirrorSellIntent(directMirrorIntent)
    && historicalMirrorIntent?.disposition === 'execute_immediately'
    && (promotionAction.action === 'promote_open' || promotionAction.action === 'already_open')
  ) {
    const releaseResult = await releaseHistoricalMirrorSell({
      position: {
        id: persistedPositionId,
        status: 'open',
        userId,
        configId,
        chainId,
        tokenAddress: tokenToBuy,
        orderId: canonicalOrder?.id || runtimeContext?.orderId || null,
        entryAmountExact: confirmedAmountRaw,
      },
      chainId,
      tokenAddress: tokenToBuy,
      targetWallet,
      targetSellTxHash: historicalMirrorIntent.targetSellTxHash || null,
      targetSellRatioBps: historicalMirrorIntent.targetSellRatioBps ?? null,
      targetFullExitVerified: historicalMirrorIntent.targetFullExitVerified,
      targetRemainingBalanceRaw: historicalMirrorIntent.targetRemainingBalanceRaw ?? null,
      reasonCode: historicalMirrorIntent.reasonCode,
      disposition: historicalMirrorIntent.disposition,
    }).catch((error) => {
      logger.error(LogCode.SYS_ERROR, 'Failed to release historical target sell after buy confirmation', {
        positionId: persistedPositionId,
        chainId,
        token: tokenToBuy,
        targetSellTxHash: historicalMirrorIntent.targetSellTxHash || undefined,
        reasonCode: historicalMirrorIntent.reasonCode,
        error,
      });
      return { outcome: 'not_scheduled' as const };
    });

    if (releaseResult.outcome === 'scheduled') {
      logger.info(LogCode.SYS_INFO, '[CopyTradeBuyConfirm] Historical target sell replay released into exit flow', {
        positionId: persistedPositionId,
        chainId,
        token: tokenToBuy,
        targetSellTxHash: historicalMirrorIntent.targetSellTxHash || undefined,
        reasonCode: historicalMirrorIntent.reasonCode,
      });
      resolvedMirrorIntent = chooseMirrorSellIntent(directMirrorIntent, historicalMirrorIntent);
    } else if (releaseResult.outcome === 'already_active' || releaseResult.outcome === 'armed_pending') {
      logger.info(LogCode.SYS_INFO, '[CopyTradeBuyConfirm] Historical target sell reused existing exit work', {
        positionId: persistedPositionId,
        chainId,
        token: tokenToBuy,
        targetSellTxHash: historicalMirrorIntent.targetSellTxHash || undefined,
        reasonCode: historicalMirrorIntent.reasonCode,
        releaseOutcome: releaseResult.outcome,
      });
      resolvedMirrorIntent = chooseMirrorSellIntent(directMirrorIntent, historicalMirrorIntent);
    }
  }

  const hasExitIntent = hasMirrorSellIntent(resolvedMirrorIntent);

  if (canonicalOrder) {
    await advanceOrderState({
      orderId: canonicalOrder.id,
      lifecycleState: hasExitIntent ? 'EXIT_ARMED' : 'BUY_CONFIRMED_OPEN',
      reasonCode: hasExitIntent ? 'exit_armed_from_target_sell' : 'ok_buy_confirmed_open',
      eventType: !hasExitIntent
        ? 'ORDER_BUY_CONFIRMED_OPEN'
        : 'ORDER_BUY_CONFIRMED_ARMED_FOR_EXIT',
      metadataPatch: {
        buyTxHash: resolvedTxHash,
        targetSellTxHash: resolvedMirrorIntent?.targetSellTxHash || null,
        targetSellReasonCode: resolvedMirrorIntent?.reasonCode || null,
        positionIdLegacy: persistedPositionId || null,
        confirmedAmountRaw,
        lastKnownExposureSource: !hasExitIntent
          ? 'buy_confirmed_open'
          : 'buy_confirmed_exit_armed',
        awaitingKind: null,
        nextObservationAt: null,
        lastObservedTxHash: resolvedTxHash,
        lastObservedTxState: 'confirmed_success',
        lastObservedAt: new Date().toISOString(),
        directFeeSettlement: effectiveDirectFeeSettlement || null,
      },
    }).catch(() => null);
    await recordOrderExecution({
      orderId: canonicalOrder.id,
      status: 'confirmed',
      reasonCode: 'ok_buy_confirmed_open',
      txHash: resolvedTxHash,
      mode: 'legacy',
      retryable: false,
      metadata: {
        recoverySource,
        confirmedAmountRaw,
        directFeeSettlement: effectiveDirectFeeSettlement || null,
      },
    }).catch(() => null);
  }

  if (effectiveDirectFeeSettlement?.deferred) {
    deferFeeRecovery({
      userId,
      chainId,
      tokenAddress: tokenToBuy,
      txHash: resolvedTxHash,
      recoverySource,
      settlement: effectiveDirectFeeSettlement,
    });
  }

  if (onNotifySuccess && promotionAction.action === 'promote_open') {
    await onNotifySuccess();
  }

  // Production-grade behavior: avoid speculative approval traffic on the critical buy path.
  // Approval preheat is only useful for future sells and should never compete with a just-confirmed buy
  // or an already-armed mirror sell.
  if (!hasExitIntent) {
    const preheatResult = await preheatSell({
      userId,
      walletAddress,
      chainId,
      tokenAddress: tokenToBuy,
      tokenPriceUsd: tokenInfo.price,
      tokenDecimals: tokenInfo.decimals
    }, {
      queueBehavior: 'skip_if_busy',
      txPurpose: 'preheat',
    });

    if (preheatResult.status === 'deferred') {
      deferApprovalPreheat({
        userId,
        walletAddress,
        chainId,
        tokenAddress: tokenToBuy,
        tokenPriceUsd: tokenInfo.price,
        tokenDecimals: tokenInfo.decimals,
        trigger: 'buy_confirmation',
      });
    }
  }

  return 'confirmed_success';
}
