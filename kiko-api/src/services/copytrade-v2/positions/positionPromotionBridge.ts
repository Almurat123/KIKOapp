import prisma from '../../../db/prisma.js';

export async function promoteCopytradePositionAfterConfirmation(params: {
  positionId?: string | null;
  txHash: string;
}): Promise<{
  updated: number;
  reasonCode: 'POSITION_PROMOTED_OPEN' | 'POSITION_ALREADY_VISIBLE' | 'POSITION_PROMOTION_SKIPPED';
}> {
  if (!params.positionId) {
    return { updated: 0, reasonCode: 'POSITION_PROMOTION_SKIPPED' };
  }

  const result = await prisma.position.updateMany({
    where: {
      id: params.positionId,
      status: { in: ['pending', 'open'] as any },
    },
    data: {
      status: 'open' as any,
      entryTxHash: params.txHash,
    },
  });

  if (result.count > 0) {
    return { updated: result.count, reasonCode: 'POSITION_PROMOTED_OPEN' };
  }

  const existing = await prisma.position.findUnique({
    where: { id: params.positionId },
    select: { status: true },
  });
  if (existing?.status === 'open') {
    return { updated: 0, reasonCode: 'POSITION_ALREADY_VISIBLE' };
  }

  return { updated: 0, reasonCode: 'POSITION_PROMOTION_SKIPPED' };
}
