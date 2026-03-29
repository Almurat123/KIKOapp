import prisma from '../../../db/prisma.js';
import { getPendingAttributedPositionById } from './pendingAttributedPositionLedger.js';
import { normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import type { MirrorSellIntentDecision } from './mirrorSellIntentPolicy.js';
import { hasActiveExitIntent } from '../exit/positionExitIntentStore.js';

export type ResolvedPendingMirrorSellIntent = MirrorSellIntentDecision & {
  reasonCode:
    | 'PENDING_TARGET_SELL_ARMED'
    | 'ACTIVE_EXIT_INTENT_PRESENT'
    | 'NO_PENDING_MIRROR_SELL_INTENT';
};

export async function resolvePendingMirrorSellIntent(params: {
  positionId?: string | null;
  targetWallet?: string | null;
  tokenAddress: string;
  chainId: number;
  leaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
}): Promise<ResolvedPendingMirrorSellIntent> {
  const positionId = String(params.positionId || '').trim();
  if (!positionId) {
    return {
      disposition: 'none',
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  const normalizedWallet = normalizeWallet(params.chainId, params.targetWallet);
  if (!normalizedWallet) {
    return {
      disposition: 'none',
      reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
    };
  }

  const [pendingLot, hasActiveIntent] = await Promise.all([
    getPendingAttributedPositionById(positionId).catch(() => null),
    hasActiveExitIntent(positionId).catch(() => false),
  ]);

  if (String(pendingLot?.status || '').toLowerCase() === 'sell_armed') {
    return {
      disposition: 'arm_exit',
      targetSellTxHash: pendingLot?.targetSellTxHash || undefined,
      reasonCode: 'PENDING_TARGET_SELL_ARMED',
    };
  }

  if (hasActiveIntent) {
    return {
      disposition: 'arm_exit',
      targetSellTxHash: pendingLot?.targetSellTxHash || undefined,
      reasonCode: 'ACTIVE_EXIT_INTENT_PRESENT',
    };
  }

  return {
    disposition: 'none',
    reasonCode: 'NO_PENDING_MIRROR_SELL_INTENT',
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
