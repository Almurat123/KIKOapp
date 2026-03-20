import prisma from '../../../db/prisma.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';
import {
  getCanonicalOrderById,
  type CanonicalOrderSnapshot,
} from './canonicalOrderState.js';

function readMetadataString(order: CanonicalOrderSnapshot | null, key: string): string | null {
  const value = String(order?.metadata?.[key] || '').trim();
  return value || null;
}

export async function syncOrderProjections(orderId: string): Promise<void> {
  const order = await getCanonicalOrderById(orderId);
  if (!order) return;

  const positionId = readMetadataString(order, 'positionIdLegacy');
  const buyTxHash = readMetadataString(order, 'buyTxHash');
  const sellTxHash = readMetadataString(order, 'sellTxHash');
  const targetSellTxHash = readMetadataString(order, 'targetSellTxHash');
  const targetWallet = readMetadataString(order, 'targetWallet') || order.targetWallet;
  const pendingAttributedPositionId = readMetadataString(order, 'pendingAttributedPositionId');
  const awaitingKind = readMetadataString(order, 'awaitingKind');

  if (positionId && buyTxHash) {
    await prisma.position.updateMany({
      where: {
        id: positionId,
        status: { in: ['pending', 'pending_broadcast', 'broadcasted_unseen', 'open'] as any },
      },
      data: {
        entryTxHash: buyTxHash,
      },
    }).catch(() => null);

    await prisma.pendingAttributedPosition.updateMany({
      where: {
        positionId,
        status: { in: ['armed', 'sell_armed'] },
      },
      data: {
        entryTxHash: buyTxHash,
      },
    }).catch(() => null);

    await syncCopytradeLedgerFromLegacy({
      positionId,
      targetWallet,
      followerBuyTxHash: buyTxHash,
      targetSellTxHash: targetSellTxHash || undefined,
      lastExecutionState: awaitingKind === 'buy_finality' ? 'submitted_unresolved' : undefined,
      lastExecutionReasonCode: awaitingKind === 'buy_finality' ? 'projection_repaired_from_order' : undefined,
    }).catch(() => null);
  }

  if (positionId && sellTxHash) {
    await prisma.position.updateMany({
      where: {
        id: positionId,
      },
      data: {
        exitTxHash: sellTxHash,
      },
    }).catch(() => null);

    await syncCopytradeLedgerFromLegacy({
      positionId,
      targetWallet,
      followerExitTxHash: sellTxHash,
      targetSellTxHash: targetSellTxHash || undefined,
      lastExecutionState: awaitingKind === 'projection_repair' ? 'projection_repair_pending' : undefined,
      lastExecutionReasonCode: awaitingKind === 'projection_repair' ? 'projection_repaired_from_order' : undefined,
    }).catch(() => null);
  }

  if (pendingAttributedPositionId && buyTxHash) {
    await prisma.pendingAttributedPosition.updateMany({
      where: {
        id: pendingAttributedPositionId,
        status: { in: ['armed', 'sell_armed'] },
      },
      data: {
        entryTxHash: buyTxHash,
      },
    }).catch(() => null);
  }
}
