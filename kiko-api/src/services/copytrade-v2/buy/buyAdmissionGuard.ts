import prisma from '../../../db/prisma.js';
import { getPendingAttributedPositionById } from '../positions/pendingAttributedPositionLedger.js';

export interface CopytradeBuyAdmissionDecision {
  blocked: boolean;
  reasonCode:
    | 'buy_admission_ok'
    | 'buy_tx_already_accepted'
    | 'position_already_open'
    | 'target_sell_preempted'
    | 'position_already_closed'
    | 'position_exit_in_progress'
    | 'pending_position_cancelled';
  targetSellTxHash?: string | null;
  acceptedTxHash?: string | null;
}

function isOnchainTxHash(value?: string | null): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return /^0x[a-f0-9]{64}$/.test(normalized);
}

export async function evaluateCopytradeBuyAdmission(params: {
  pendingPositionId?: string | null;
  userId?: string | null;
  chainId?: number | null;
  tokenAddress?: string | null;
  leaderBuyTxHash?: string | null;
}): Promise<CopytradeBuyAdmissionDecision> {
  const pendingPositionId = String(params.pendingPositionId || '').trim();
  const userId = String(params.userId || '').trim();
  const tokenAddress = String(params.tokenAddress || '').trim().toLowerCase();
  const leaderBuyTxHash = String(params.leaderBuyTxHash || '').trim().toLowerCase();
  const chainId = Number(params.chainId);

  const canQueryCanonicalIdentity =
    Boolean(userId)
    && Boolean(tokenAddress)
    && Boolean(leaderBuyTxHash)
    && Number.isFinite(chainId)
    && chainId > 0;

  if (!pendingPositionId && !canQueryCanonicalIdentity) {
    return { blocked: false, reasonCode: 'buy_admission_ok' };
  }

  let position: { id: string; status: string; entryTxHash?: string | null } | null = null;
  let pendingLot: {
    status?: string | null;
    targetSellTxHash?: string | null;
    entryTxHash?: string | null;
  } | null = null;

  if (pendingPositionId) {
    [position, pendingLot] = await Promise.all([
      prisma.position.findUnique({
        where: { id: pendingPositionId },
        select: {
          id: true,
          status: true,
          entryTxHash: true,
        },
      }).catch(() => null),
      getPendingAttributedPositionById(pendingPositionId).catch(() => null),
    ]);
  }

  if (!position && canQueryCanonicalIdentity) {
    const [canonicalPosition, canonicalPendingLot] = await Promise.all([
      prisma.position.findFirst({
        where: {
          userId,
          chainId,
          tokenAddress,
          leaderTxHash: leaderBuyTxHash,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          entryTxHash: true,
        },
      }).catch(() => null),
      prisma.pendingAttributedPosition.findFirst({
        where: {
          userId,
          chainId,
          tokenAddress,
          leaderBuyTxHash,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          targetSellTxHash: true,
          entryTxHash: true,
        },
      }).catch(() => null),
    ]);
    position = canonicalPosition;
    pendingLot = canonicalPendingLot;
  }

  const positionStatus = String(position?.status || '').toLowerCase();
  if (positionStatus === 'closed' || positionStatus === 'failed' || positionStatus === 'failed_final') {
    return {
      blocked: true,
      reasonCode: 'position_already_closed',
      targetSellTxHash: pendingLot?.targetSellTxHash || null,
    };
  }

  if (positionStatus === 'closing' || positionStatus === 'close_pending') {
    return {
      blocked: true,
      reasonCode: 'position_exit_in_progress',
      targetSellTxHash: pendingLot?.targetSellTxHash || null,
    };
  }

  const pendingStatus = String(pendingLot?.status || '').toLowerCase();
  if (pendingStatus === 'sell_armed') {
    return {
      blocked: true,
      reasonCode: 'target_sell_preempted',
      targetSellTxHash: pendingLot?.targetSellTxHash || null,
    };
  }

  if (pendingStatus === 'cancelled') {
    return {
      blocked: true,
      reasonCode: 'pending_position_cancelled',
      targetSellTxHash: pendingLot?.targetSellTxHash || null,
    };
  }

  if (positionStatus === 'open') {
    return {
      blocked: true,
      reasonCode: 'position_already_open',
      targetSellTxHash: pendingLot?.targetSellTxHash || null,
      acceptedTxHash: isOnchainTxHash(pendingLot?.entryTxHash || position?.entryTxHash)
        ? String(pendingLot?.entryTxHash || position?.entryTxHash || '').toLowerCase()
        : null,
    };
  }

  if (
    positionStatus === 'pending_broadcast'
    || positionStatus === 'broadcasted_unseen'
    || isOnchainTxHash(pendingLot?.entryTxHash || position?.entryTxHash)
  ) {
    return {
      blocked: true,
      reasonCode: 'buy_tx_already_accepted',
      targetSellTxHash: pendingLot?.targetSellTxHash || null,
      acceptedTxHash: isOnchainTxHash(pendingLot?.entryTxHash || position?.entryTxHash)
        ? String(pendingLot?.entryTxHash || position?.entryTxHash || '').toLowerCase()
        : null,
    };
  }

  return { blocked: false, reasonCode: 'buy_admission_ok' };
}
