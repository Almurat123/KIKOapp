import prisma from '../../../db/prisma.js';
import { cancelPendingAttributedPosition } from '../positions/pendingAttributedPositionLedger.js';
import { shouldTerminalFailStalePendingPosition } from './pendingProtectionPolicy.js';

export async function cleanupPendingCopytradePosition(params: {
  pendingPositionId: string | null | undefined;
  reasonCode: string;
}): Promise<boolean> {
  if (!params.pendingPositionId) return false;
  void params.reasonCode;
  const pending = await prisma.position.findUnique({
    where: { id: params.pendingPositionId },
    select: {
      id: true,
      status: true,
      entryTxHash: true,
    },
  });
  if (!pending || pending.status !== 'pending') return false;
  if (!shouldTerminalFailStalePendingPosition(pending.entryTxHash)) {
    return false;
  }
  const result = await prisma.position.deleteMany({
    where: {
      id: params.pendingPositionId,
      status: 'pending',
    },
  });
  if (result.count > 0) {
    await cancelPendingAttributedPosition({
      positionId: params.pendingPositionId,
      reasonCode: params.reasonCode,
    }).catch(() => 0);
  }
  return result.count > 0;
}
