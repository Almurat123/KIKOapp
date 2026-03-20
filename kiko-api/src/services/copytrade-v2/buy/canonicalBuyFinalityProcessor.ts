import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getTokenInfo } from '../../tokenService.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import { applyBuyConfirmationTransition } from './buyConfirmationTransition.js';
import { releaseMirrorSellAfterBuyConfirm } from './buyConfirmationMirrorSellRelease.js';

type PositionStatusCompatLike = {
  pendingCreateStatus: string;
  failedFinalStatus: string;
};

async function resolvePositionStatusCompat(): Promise<PositionStatusCompatLike> {
  try {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'PositionStatus'
    `;
    const labels = new Set(rows.map((row) => String(row.enumlabel)));
    return {
      pendingCreateStatus: labels.has('pending_broadcast') ? 'pending_broadcast' : 'pending',
      failedFinalStatus: labels.has('failed_final') ? 'failed_final' : 'failed',
    };
  } catch {
    return {
      pendingCreateStatus: 'pending',
      failedFinalStatus: 'failed',
    };
  }
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = String(metadata?.[key] || '').trim();
  return value || null;
}

export async function processCanonicalBuyFinality(params: {
  orderId: string;
  confirmation: ConfirmationOutcome;
  recoverySource?: 'initial_wait' | 'late_recovery';
}): Promise<'processed' | 'skipped'> {
  const order = await prisma.copytradeOrder.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      chainId: true,
      txHash: true,
      targetWallet: true,
      tokenOut: true,
      userId: true,
      configId: true,
      metadataJson: true,
    },
  }).catch(() => null);
  if (!order?.configId || !order.userId) return 'skipped';

  const metadata = (order.metadataJson as Record<string, unknown> | null) || {};
  const positionId = readMetadataString(metadata, 'positionIdLegacy');
  if (!positionId) return 'skipped';

  const [position, config, positionStatusCompat] = await Promise.all([
    prisma.position.findUnique({
      where: { id: positionId },
      select: {
        id: true,
        createdAt: true,
        status: true,
        userId: true,
        configId: true,
        chainId: true,
        tokenAddress: true,
        entryAmountExact: true,
        entryAmountDec: true,
      },
    }).catch(() => null),
    prisma.copyTradeConfig.findUnique({
      where: { id: order.configId },
      include: { user: true },
    }).catch(() => null),
    resolvePositionStatusCompat(),
  ]);

  if (!position || !config?.user) return 'skipped';

  const pendingCreateStatus = ['pending', 'pending_broadcast', 'broadcasted_unseen'].includes(String(position.status || '').toLowerCase())
    ? String(position.status)
    : positionStatusCompat.pendingCreateStatus;

  const tokenInfo = await getTokenInfo(order.tokenOut, order.chainId, {
    verbose: false,
    forceRefresh: false,
    priority: 'normal',
    rpcStrategy: 'cheap',
  }).catch(() => null);

  if (!tokenInfo) {
    logger.warn(LogCode.SYS_ERROR, '[CanonicalBuyFinality] Missing token info for deferred buy confirmation processing', {
      orderId: order.id,
      tokenAddress: order.tokenOut,
      chainId: order.chainId,
    });
    return 'skipped';
  }

  await applyBuyConfirmationTransition({
    confirmation: params.confirmation,
    chainId: order.chainId,
    tokenToBuy: order.tokenOut,
    txHash: readMetadataString(metadata, 'buyTxHash') || params.confirmation.resolvedTxHash || order.txHash,
    userId: order.userId,
    configId: order.configId,
    targetWallet: order.targetWallet,
    leaderBuyTxHash: readMetadataString(metadata, 'leaderTxHash') || order.txHash,
    persistedPositionId: position.id,
    pendingPositionCreatedAt: position.createdAt,
    tokenInfo: {
      symbol: tokenInfo.symbol,
      price: Number(tokenInfo.price || 0),
      decimals: Number(tokenInfo.decimals || 18),
    },
    walletAddress: config.user.walletAddress,
    positionStatusCompat: {
      pendingCreateStatus,
      failedFinalStatus: positionStatusCompat.failedFinalStatus,
    },
    recoverySource: params.recoverySource || 'late_recovery',
    onMirrorSellAfterConfirm: async (context) => {
      const refreshedPosition = await prisma.position.findUnique({
        where: { id: context.positionId },
        select: {
          id: true,
          status: true,
          userId: true,
          configId: true,
          chainId: true,
          tokenAddress: true,
          entryAmountExact: true,
          entryAmountDec: true,
        },
      }).catch(() => null);
      await releaseMirrorSellAfterBuyConfirm({
        position: refreshedPosition as any,
        chainId: order.chainId,
        tokenAddress: order.tokenOut,
        targetWallet: order.targetWallet,
        targetSellTxHash: context.targetSellTxHash,
        reasonCode: context.reasonCode,
      });
    },
  });

  return 'processed';
}
