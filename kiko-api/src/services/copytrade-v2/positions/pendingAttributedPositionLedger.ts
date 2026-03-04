import prisma from '../../../db/prisma.js';
import { encodePositionTokenAmount } from './positionDecimalCodec.js';

export type PendingAttributedPositionStatus = 'armed' | 'sell_armed' | 'consumed' | 'cancelled';

export interface PendingAttributedPositionLotLike {
  id: string;
  positionId: string;
  userId: string;
  chainId: number;
  tokenAddress: string;
  entryTxHash: string;
  leaderBuyTxHash?: string | null;
  expectedAmountRaw?: string | null;
  expectedAmountDec?: { toString(): string } | string | number | null;
  status: string;
  reasonCode?: string | null;
  targetSellTxHash?: string | null;
  exitTxHash?: string | null;
  createdAt?: Date | null;
}

function normalizeOptionalAmount(value?: string | null): string | null {
  const raw = String(value || '').trim();
  return raw ? raw : null;
}

export async function upsertPendingAttributedPosition(params: {
  positionId: string;
  userId: string;
  chainId: number;
  tokenAddress: string;
  entryTxHash: string;
  leaderBuyTxHash?: string | null;
  expectedAmountRaw?: string | null;
  expectedAmountDec?: string | null;
  reasonCode: string;
}): Promise<void> {
  const encoded = encodePositionTokenAmount({
    exactAmount: params.expectedAmountDec,
  });
  const expectedAmountRaw = normalizeOptionalAmount(params.expectedAmountRaw);
  await prisma.pendingAttributedPosition.upsert({
    where: { positionId: params.positionId },
    update: {
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      entryTxHash: params.entryTxHash,
      leaderBuyTxHash: params.leaderBuyTxHash || undefined,
      expectedAmountRaw: expectedAmountRaw || undefined,
      expectedAmountDec: encoded.decimalAmount || undefined,
      status: 'armed',
      reasonCode: params.reasonCode,
      targetSellTxHash: null,
      exitTxHash: null,
      consumedAt: null,
    },
    create: {
      positionId: params.positionId,
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      entryTxHash: params.entryTxHash,
      leaderBuyTxHash: params.leaderBuyTxHash || undefined,
      expectedAmountRaw: expectedAmountRaw || undefined,
      expectedAmountDec: encoded.decimalAmount || undefined,
      status: 'armed',
      reasonCode: params.reasonCode,
    },
  });
}

export async function cancelPendingAttributedPosition(params: {
  positionId?: string | null;
  reasonCode: string;
}): Promise<number> {
  if (!params.positionId) return 0;
  const result = await prisma.pendingAttributedPosition.updateMany({
    where: {
      positionId: params.positionId,
      status: { in: ['armed', 'sell_armed'] },
    },
    data: {
      status: 'cancelled',
      reasonCode: params.reasonCode,
      consumedAt: new Date(),
    },
  });
  return result.count;
}

export async function armPendingAttributedPositionsForMirrorSell(params: {
  userId: string;
  chainId: number;
  tokenAddress: string;
  positionIds: string[];
  targetSellTxHash?: string | null;
  reasonCode: string;
}): Promise<number> {
  if (params.positionIds.length === 0) return 0;
  const result = await prisma.pendingAttributedPosition.updateMany({
    where: {
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      positionId: { in: params.positionIds },
      status: { in: ['armed', 'sell_armed'] },
    },
    data: {
      status: 'sell_armed',
      targetSellTxHash: params.targetSellTxHash || undefined,
      reasonCode: params.reasonCode,
    },
  });
  return result.count;
}

export async function listPendingAttributedPositions(params: {
  userId?: string;
  chainId: number;
  tokenAddress: string;
  statuses?: PendingAttributedPositionStatus[];
  positionIds?: string[];
}): Promise<PendingAttributedPositionLotLike[]> {
  return prisma.pendingAttributedPosition.findMany({
    where: {
      ...(params.userId ? { userId: params.userId } : {}),
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      ...(params.statuses?.length ? { status: { in: params.statuses } } : {}),
      ...(params.positionIds?.length ? { positionId: { in: params.positionIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function consumePendingAttributedPositions(params: {
  positionIds: string[];
  exitTxHash: string;
  reasonCode: string;
}): Promise<number> {
  if (params.positionIds.length === 0) return 0;
  const result = await prisma.pendingAttributedPosition.updateMany({
    where: {
      positionId: { in: params.positionIds },
      status: { in: ['armed', 'sell_armed'] },
    },
    data: {
      status: 'consumed',
      exitTxHash: params.exitTxHash,
      reasonCode: params.reasonCode,
      consumedAt: new Date(),
    },
  });
  return result.count;
}

export async function getPendingAttributedPositionById(positionId?: string | null): Promise<PendingAttributedPositionLotLike | null> {
  if (!positionId) return null;
  return prisma.pendingAttributedPosition.findUnique({
    where: { positionId },
  });
}
