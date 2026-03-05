import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { verifyTargetFullExit, formatTargetRemainingBalance } from './targetSellFullExitVerifier.js';
import { armPendingAttributedPositionsForMirrorSell } from '../positions/pendingAttributedPositionLedger.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { applyCopytradeStateEvent } from '../state/copytradeStateRuntime.js';
import { resolveTargetSellLink } from './copytradeTargetSellLinkResolver.js';
import {
  findLedgerFirstReconcileOpenCandidates,
  findLedgerFirstReconcilePendingCandidates,
} from '../ledger/copytradeLedgerSelectors.js';
import { emitCopytradeSummaryAudit } from '../audit/copytradeSummaryAudit.js';

const TARGET_SELL_RECONCILE_WINDOW_MS = Math.max(60_000, Number(process.env.COPYTRADE_TARGET_SELL_RECONCILE_WINDOW_MS || '21600000'));

export async function runTargetSellReconciliationCycle(): Promise<{
  scannedOpen: number;
  scannedPending: number;
  armedPending: number;
  scheduledOpen: number;
  fullExitMatches: number;
}> {
  const createdAfter = new Date(Date.now() - TARGET_SELL_RECONCILE_WINDOW_MS);
  let scannedOpen = 0;
  let scannedPending = 0;
  let armedPending = 0;
  let scheduledOpen = 0;
  let fullExitMatches = 0;

  const openCandidates = await findLedgerFirstReconcileOpenCandidates({ createdAfter });

  for (const position of openCandidates) {
    scannedOpen += 1;
    const fullExit = await verifyTargetFullExit({
      targetWallet: position.config.targetWallet,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
    });
    if (!fullExit.isFullExit) continue;
    const latestSell = await resolveTargetSellLink({
      targetWallet: position.config.targetWallet,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      leaderBuyTxHash: position.leaderTxHash,
      positionCreatedAt: position.createdAt,
      allowUnanchoredVerifiedFallback: true,
      targetFullExitVerified: true,
    });
    if (!latestSell.txHash) continue;
    fullExitMatches += 1;
    emitCopytradeDomainAudit('TARGET_FULL_EXIT_VERIFIED', {
      extra: {
        userId: position.userId,
        tokenAddress: position.tokenAddress,
        chainId: position.chainId,
        targetWallet: position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        reasonCode: fullExit.reasonCode,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
      }
    });

    const updated = await prisma.position.updateMany({
      where: {
        id: position.id,
        status: 'open',
        OR: [
          { exitReason: null },
          { exitReason: { not: 'mirror_sell' } },
          { exitRetryCount: 0 },
        ],
      },
      data: {
        exitReason: 'mirror_sell',
        exitRetryCount: 1,
        lastExitAttempt: null,
      },
    });
    if (updated.count > 0) {
      await applyCopytradeStateEvent({
        event: { type: 'TARGET_FULL_EXIT_VERIFIED' },
        chainId: position.chainId,
        tokenAddress: position.tokenAddress,
        targetWallet: position.config.targetWallet,
        positionIds: [position.id],
        targetFullExitVerified: true,
        targetSellTxHash: latestSell.txHash,
        lastExecutionState: 'target_full_exit_verified',
        lastExecutionReasonCode: fullExit.reasonCode,
      });
      scheduledOpen += updated.count;
      logger.info(LogCode.SYS_INFO, '[TargetSellReconcile] Scheduled open position for mirror-sell retry after strict full-exit verification', {
        positionId: position.id,
        userId: position.userId,
        token: position.tokenAddress,
        chainId: position.chainId,
        targetWallet: position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
        remainingBalance: formatTargetRemainingBalance(fullExit),
        dustThresholdRaw: fullExit.dustThresholdRaw,
        reasonCode: fullExit.reasonCode,
      });
    }
  }

  const pendingCandidates = await findLedgerFirstReconcilePendingCandidates({ createdAfter });

  for (const lot of pendingCandidates) {
    scannedPending += 1;
    const fullExit = await verifyTargetFullExit({
      targetWallet: lot.position.config.targetWallet,
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
    });
    if (!fullExit.isFullExit) continue;
    const latestSell = await resolveTargetSellLink({
      targetWallet: lot.position.config.targetWallet,
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
      leaderBuyTxHash: lot.position.leaderTxHash,
      positionCreatedAt: lot.position.createdAt,
      pendingCreatedAt: lot.createdAt,
      allowUnanchoredVerifiedFallback: true,
      targetFullExitVerified: true,
    });
    if (!latestSell.txHash) continue;
    fullExitMatches += 1;
    emitCopytradeDomainAudit('TARGET_FULL_EXIT_VERIFIED', {
      extra: {
        userId: lot.userId,
        tokenAddress: lot.tokenAddress,
        chainId: lot.chainId,
        targetWallet: lot.position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        reasonCode: fullExit.reasonCode,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
      }
    });

    const count = await armPendingAttributedPositionsForMirrorSell({
      userId: lot.userId,
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
      positionIds: [lot.positionId],
      targetSellTxHash: latestSell.txHash,
      reasonCode: 'strict_full_exit_reconciled',
    });
    armedPending += count;
    if (count > 0) {
      const nextRetryCount = Math.max(1, Number((lot.position as any)?.exitRetryCount || 0));
      await prisma.position.updateMany({
        where: {
          id: lot.positionId,
          status: { in: ['open', 'pending'] },
        },
        data: {
          exitReason: 'mirror_sell',
          exitRetryCount: nextRetryCount,
          lastExitAttempt: null,
        },
      }).catch(() => null);
    }
    if (count > 0) {
      await applyCopytradeStateEvent({
        event: { type: 'TARGET_FULL_EXIT_VERIFIED' },
        chainId: lot.chainId,
        tokenAddress: lot.tokenAddress,
        targetWallet: lot.position.config.targetWallet,
        positionIds: [lot.positionId],
        targetFullExitVerified: true,
        targetSellTxHash: latestSell.txHash,
        lastExecutionState: 'target_full_exit_verified',
        lastExecutionReasonCode: fullExit.reasonCode,
      });
      logger.info(LogCode.SYS_INFO, '[TargetSellReconcile] Armed pending attributed lot after strict full-exit verification', {
        lotId: lot.id,
        positionId: lot.positionId,
        userId: lot.userId,
        token: lot.tokenAddress,
        chainId: lot.chainId,
        targetWallet: lot.position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
        remainingBalance: formatTargetRemainingBalance(fullExit),
        dustThresholdRaw: fullExit.dustThresholdRaw,
        reasonCode: fullExit.reasonCode,
      });
    }
  }

  const result = {
    scannedOpen,
    scannedPending,
    armedPending,
    scheduledOpen,
    fullExitMatches,
  };
  emitCopytradeSummaryAudit('RECONCILE_CYCLE_SUMMARY', {
    action: fullExitMatches > 0 ? 'processed_full_exit_matches' : 'noop',
    scannedOpen,
    scannedPending,
    armedPending,
    scheduledOpen,
    fullExitMatches,
    legacyFallbackUsed: false,
  });
  return result;
}
