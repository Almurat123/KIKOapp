import prisma from '../../../db/prisma.js';
import { encodePositionTokenAmount, type PositionAmountStorageReasonCode } from './positionDecimalCodec.js';

export async function finalizeCopytradeBuyPosition(params: {
  pendingPositionId?: string | null;
  userId: string;
  configId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chainId: number;
  entryPrice: number;
  entryAmount: string;
  attributedEntryAmountExact?: string | null;
  entryTxHash: string;
  leaderTxHash?: string | null;
  entryUsdValue: number;
  status: string;
}): Promise<{ usedPendingPosition: boolean; reasonCode: PositionAmountStorageReasonCode; positionId: string; createdAt?: Date }> {
  const encoded = encodePositionTokenAmount({
    exactAmount: params.attributedEntryAmountExact,
  });

  const data = {
    entryPrice: params.entryPrice,
    entryAmount: params.entryAmount,
    entryAmountDec: encoded.decimalAmount,
    entryAmountExact: encoded.exactAmount,
    entryTxHash: params.entryTxHash,
    leaderTxHash: params.leaderTxHash || undefined,
    entryUsdValue: params.entryUsdValue,
    status: params.status as any,
  };

  if (params.pendingPositionId) {
    await prisma.position.update({
      where: { id: params.pendingPositionId },
      data,
    });
    return { usedPendingPosition: true, reasonCode: encoded.reasonCode, positionId: params.pendingPositionId };
  }

  const created = await prisma.position.create({
    data: {
      userId: params.userId,
      configId: params.configId,
      tokenAddress: params.tokenAddress,
      tokenSymbol: params.tokenSymbol,
      chainId: params.chainId,
      ...data,
    },
  });
  return { usedPendingPosition: false, reasonCode: encoded.reasonCode, positionId: created.id, createdAt: created.createdAt };
}
