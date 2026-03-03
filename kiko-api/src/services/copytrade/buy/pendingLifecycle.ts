import prisma from '../../../db/prisma.js';

export async function cleanupPendingCopytradePosition(params: {
  pendingPositionId: string | null | undefined;
  reasonCode: string;
}): Promise<boolean> {
  if (!params.pendingPositionId) return false;
  void params.reasonCode;
  const result = await prisma.position.deleteMany({
    where: {
      id: params.pendingPositionId,
      status: 'pending',
    },
  });
  return result.count > 0;
}
