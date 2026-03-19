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
}): Promise<CopytradeBuyAdmissionDecision> {
  const pendingPositionId = String(params.pendingPositionId || '').trim();
  if (!pendingPositionId) {
    return { blocked: false, reasonCode: 'buy_admission_ok' };
  }

  const [position, pendingLot] = await Promise.all([
    prisma.position.findUnique({
      where: { id: pendingPositionId },
      select: {
        id: true,
        status: true,
      },
    }).catch(() => null),
    getPendingAttributedPositionById(pendingPositionId).catch(() => null),
  ]);

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
      acceptedTxHash: isOnchainTxHash(position?.id ? pendingLot?.entryTxHash : null)
        ? String(pendingLot?.entryTxHash || '').toLowerCase()
        : null,
    };
  }

  if (
    positionStatus === 'pending_broadcast'
    || positionStatus === 'broadcasted_unseen'
    || isOnchainTxHash(pendingLot?.entryTxHash)
  ) {
    return {
      blocked: true,
      reasonCode: 'buy_tx_already_accepted',
      targetSellTxHash: pendingLot?.targetSellTxHash || null,
      acceptedTxHash: isOnchainTxHash(pendingLot?.entryTxHash)
        ? String(pendingLot?.entryTxHash || '').toLowerCase()
        : null,
    };
  }

  return { blocked: false, reasonCode: 'buy_admission_ok' };
}
