import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';
import {
  resolveCopytradeBuyPositionStatus,
  type CopytradeBuyPositionStatus,
} from './buyConfirmationPolicy.js';
import { finalizeCopytradeBuyPosition } from '../positions/positionPersistence.js';
import { upsertPendingAttributedPosition } from '../positions/pendingAttributedPositionLedger.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';
import {
  advanceCanonicalOrderState,
  claimOrCreateCanonicalOrder,
  recordCanonicalOrderExecution,
} from '../orders/canonicalOrderState.js';

export async function persistCopytradeBuySubmission(params: {
  pendingPositionId?: string | null;
  pendingPositionCreatedAt?: Date | null;
  userId: string;
  configId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chainId: number;
  tokenPrice: number;
  entryAmount: string;
  attributedEntryAmountHuman?: string;
  attributedEntryAmountExact?: string | null;
  entryTxHash: string;
  leaderBuyTxHash?: string | null;
  targetWallet?: string | null;
  entryUsdValue: number;
  txLifecycleStatus?: string;
  runtimeContext?: OrderRuntimeContext;
}, deps?: {
  finalizeCopytradeBuyPosition?: typeof finalizeCopytradeBuyPosition;
  upsertPendingAttributedPosition?: typeof upsertPendingAttributedPosition;
  syncCopytradeLedgerFromLegacy?: typeof syncCopytradeLedgerFromLegacy;
  claimOrCreateCanonicalOrder?: typeof claimOrCreateCanonicalOrder;
  advanceCanonicalOrderState?: typeof advanceCanonicalOrderState;
  recordCanonicalOrderExecution?: typeof recordCanonicalOrderExecution;
}): Promise<{
  nextPositionStatus: CopytradeBuyPositionStatus;
  persistedPositionId: string;
  pendingPositionCreatedAt?: Date | null;
  pendingPositionSettled: true;
  positionAmountStorageReasonCode: string;
}> {
  const finalizePosition = deps?.finalizeCopytradeBuyPosition || finalizeCopytradeBuyPosition;
  const upsertPendingLot = deps?.upsertPendingAttributedPosition || upsertPendingAttributedPosition;
  const syncLedger = deps?.syncCopytradeLedgerFromLegacy || syncCopytradeLedgerFromLegacy;
  const claimOrder = deps?.claimOrCreateCanonicalOrder || claimOrCreateCanonicalOrder;
  const advanceOrderState = deps?.advanceCanonicalOrderState || advanceCanonicalOrderState;
  const recordOrderExecution = deps?.recordCanonicalOrderExecution || recordCanonicalOrderExecution;

  const nextPositionStatus: CopytradeBuyPositionStatus = (params.entryTxHash && params.chainId === 900)
    ? 'open'
    : resolveCopytradeBuyPositionStatus(
      params.runtimeContext,
      params.txLifecycleStatus
        ? { status: params.txLifecycleStatus as TxLifecycleResult['status'], attempts: 1, chainId: params.chainId }
        : null,
    );

  const persistedPosition = await finalizePosition({
    pendingPositionId: params.pendingPositionId,
    userId: params.userId,
    configId: params.configId,
    tokenAddress: params.tokenAddress,
    tokenSymbol: params.tokenSymbol,
    chainId: params.chainId,
    entryPrice: params.tokenPrice,
    entryAmount: params.entryAmount,
    attributedEntryAmountExact: params.attributedEntryAmountExact || params.attributedEntryAmountHuman || undefined,
    entryTxHash: params.entryTxHash,
    leaderTxHash: params.leaderBuyTxHash || undefined,
    entryUsdValue: params.entryUsdValue,
    status: nextPositionStatus,
  });

  let pendingPositionCreatedAt = params.pendingPositionCreatedAt;
  const persistedPositionId = persistedPosition.positionId;
  if (!params.pendingPositionId && persistedPosition.createdAt) {
    pendingPositionCreatedAt = persistedPosition.createdAt;
  }

  if (params.chainId !== 900 && persistedPositionId) {
    const expectedAmountRaw = params.attributedEntryAmountExact || undefined;
    const expectedAmountDec = expectedAmountRaw ? null : (params.attributedEntryAmountHuman || null);
    await upsertPendingLot({
      positionId: persistedPositionId,
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      entryTxHash: params.entryTxHash,
      leaderBuyTxHash: params.leaderBuyTxHash || undefined,
      expectedAmountRaw,
      expectedAmountDec,
      reasonCode: expectedAmountRaw ? 'swap_amount_out_base' : 'swap_amount_out_human_fallback',
    }).catch((lotErr: any) => {
      logger.warn(LogCode.SYS_ERROR, 'Failed to upsert pending attributed position lot', {
        userId: params.userId,
        token: params.tokenAddress,
        chainId: params.chainId,
        txHash: params.entryTxHash,
        positionId: persistedPositionId,
        error: lotErr?.message || String(lotErr),
      });
    });
  }

  if (persistedPositionId && params.targetWallet) {
    const executionState = nextPositionStatus === 'open'
      ? 'submitted_open'
      : 'submitted_unresolved';
    const executionReasonCode = nextPositionStatus === 'open'
      ? 'buy_submission_open'
      : 'buy_submission_visible';
    await syncLedger({
      positionId: persistedPositionId,
      targetWallet: params.targetWallet,
      followerBuyTxHash: params.entryTxHash,
      lastExecutionState: executionState,
      lastExecutionReasonCode: executionReasonCode,
    }).catch((ledgerErr: any) => {
      logger.warn(LogCode.SYS_ERROR, 'Failed to sync unresolved copytrade ledger exposure after buy submission', {
        userId: params.userId,
        token: params.tokenAddress,
        chainId: params.chainId,
        txHash: params.entryTxHash,
        positionId: persistedPositionId,
        error: ledgerErr?.message || String(ledgerErr),
      });
    });
  }

  const leaderBuyTxHash = String(params.leaderBuyTxHash || '').trim().toLowerCase();
  if (leaderBuyTxHash && params.targetWallet) {
    const order = await claimOrder({
      userId: params.userId,
      configId: params.configId,
      chainId: params.chainId,
      targetWallet: params.targetWallet,
      tokenAddress: params.tokenAddress,
      leaderTxHash: leaderBuyTxHash,
      direction: 'buy',
      mode: 'legacy',
      tokenOut: params.tokenAddress,
      metadata: {
        buyTxHash: params.entryTxHash,
        positionIdLegacy: persistedPositionId,
        lastKnownExposureSource: 'position_projection',
        txLifecycleStatus: params.txLifecycleStatus || null,
        runtimeOrderId: params.runtimeContext?.orderId || null,
        runtimeCanonicalTxHash: params.runtimeContext?.canonicalTxHash || null,
      },
    }).catch(() => null);

    if (order) {
      const lifecycleState = nextPositionStatus === 'open' ? 'BUY_ACCEPTED' : 'BUY_SUBMITTING';
      const reasonCode = nextPositionStatus === 'open' ? 'buy_tx_accepted' : 'buy_tx_visible';
      await advanceOrderState({
        orderId: order.id,
        lifecycleState,
        reasonCode,
        eventType: 'ORDER_BUY_PERSISTED',
        metadataPatch: {
          buyTxHash: params.entryTxHash,
          positionIdLegacy: persistedPositionId,
          lastKnownExposureSource: 'position_projection',
          positionStatus: nextPositionStatus,
        },
      }).catch(() => null);
      await recordOrderExecution({
        orderId: order.id,
        status: nextPositionStatus === 'open' ? 'accepted' : 'submitted',
        reasonCode,
        txHash: params.entryTxHash,
        mode: 'legacy',
        retryable: false,
        metadata: {
          txLifecycleStatus: params.txLifecycleStatus || null,
          runtimeOrderId: params.runtimeContext?.orderId || null,
          runtimeCanonicalTxHash: params.runtimeContext?.canonicalTxHash || null,
        },
      }).catch(() => null);
    }
  }

  return {
    nextPositionStatus,
    persistedPositionId,
    pendingPositionCreatedAt,
    pendingPositionSettled: true,
    positionAmountStorageReasonCode: persistedPosition.reasonCode,
  };
}
