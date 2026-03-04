import prisma from '../../../db/prisma.js';
import { armPendingAttributedPositionsForMirrorSell } from './pendingAttributedPositionLedger.js';
import { resolvePositionLedgerSnapshot } from './positionLedgerResolver.js';
import * as targetSellFullExitVerifier from '../reconcile/targetSellFullExitVerifier.js';

export async function resolvePendingMirrorSellIntent(params: {
  positionId?: string | null;
  targetWallet?: string | null;
  tokenAddress: string;
  chainId: number;
  leaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
}): Promise<{
  shouldMirrorSell: boolean;
  targetSellTxHash?: string;
  reasonCode:
    | 'PENDING_TARGET_SELL_ARMED'
    | 'TARGET_SELL_SEEN_IN_LEDGER'
    | 'TARGET_SELL_SEEN_IN_HISTORY'
    | 'TARGET_SELL_PARTIAL_BALANCE_REMAINING'
    | 'TARGET_SELL_BALANCE_UNVERIFIED'
    | 'NO_PENDING_MIRROR_SELL_INTENT';
}> {
  const ledger = await resolvePositionLedgerSnapshot({
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    targetWallet: params.targetWallet,
    leaderBuyTxHash: params.leaderBuyTxHash,
    positionCreatedAt: params.positionCreatedAt,
    positionIds: params.positionId ? [params.positionId] : [],
  });
  const lot = params.positionId
    ? ledger.pendingLots.find((entry) => entry.positionId === params.positionId) || null
    : null;
  if (lot?.status === 'sell_armed' && lot.targetSellTxHash) {
    return {
      shouldMirrorSell: true,
      targetSellTxHash: lot.targetSellTxHash,
      reasonCode: 'TARGET_SELL_SEEN_IN_LEDGER',
    };
  }

  const normalizedWallet = String(params.targetWallet || '').trim().toLowerCase();
  if (!normalizedWallet) {
    return {
      shouldMirrorSell: false,
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  if (!ledger.latestTargetSellTxHash || !params.positionId) {
    return {
      shouldMirrorSell: false,
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  const fullExit = await targetSellFullExitVerifier.verifyTargetFullExit({
    targetWallet: params.targetWallet || normalizedWallet,
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
  });
  if (!fullExit.isFullExit) {
    return {
      shouldMirrorSell: false,
      reasonCode: fullExit.reasonCode === 'TARGET_BALANCE_REMAINING'
        ? 'TARGET_SELL_PARTIAL_BALANCE_REMAINING'
        : 'TARGET_SELL_BALANCE_UNVERIFIED',
    };
  }

  await armPendingAttributedPositionsForMirrorSell({
    userId: ledger.userId || lot?.userId || '',
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    positionIds: [params.positionId],
    targetSellTxHash: ledger.latestTargetSellTxHash,
    reasonCode: 'target_sell_seen_in_history',
  }).catch(() => 0);

  return {
    shouldMirrorSell: true,
    targetSellTxHash: ledger.latestTargetSellTxHash,
    reasonCode: 'TARGET_SELL_SEEN_IN_HISTORY',
  };
}

export async function resolveBuyConfirmationPromotionAction(params: {
  positionId?: string | null;
}): Promise<{
  action: 'promote_open' | 'already_open' | 'closed_before_open' | 'missing';
  status?: string | null;
  exitTxHash?: string | null;
  exitReason?: string | null;
}> {
  if (!params.positionId) return { action: 'missing' };
  const position = await prisma.position.findUnique({
    where: { id: params.positionId },
    select: { status: true, exitTxHash: true, exitReason: true },
  });
  if (!position) return { action: 'missing' };
  if (position.status === 'closed') {
    return {
      action: 'closed_before_open',
      status: position.status,
      exitTxHash: position.exitTxHash,
      exitReason: position.exitReason,
    };
  }
  if (position.status === 'open') {
    return {
      action: 'already_open',
      status: position.status,
      exitTxHash: position.exitTxHash,
      exitReason: position.exitReason,
    };
  }
  return {
    action: 'promote_open',
    status: position.status,
    exitTxHash: position.exitTxHash,
    exitReason: position.exitReason,
  };
}
