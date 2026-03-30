import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getTokenInfo } from '../../tokenService.js';
import { getTokenMetadata } from '../../rpcService.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import { applyBuyConfirmationTransition } from './buyConfirmationTransition.js';
import {
  resolveDisplayTokenSymbol,
  sendNotificationAsync,
} from '../runtime/legacyAutoTradeHelpers.js';

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

type BuyFinalityTokenInfo = {
  symbol?: string | null;
  price: number;
  decimals: number;
};

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = String(metadata?.[key] || '').trim();
  return value || null;
}

export async function processCanonicalBuyFinality(params: {
  orderId: string;
  confirmation: ConfirmationOutcome;
  recoverySource?: 'initial_wait' | 'late_recovery';
  deps?: {
    prisma?: typeof prisma;
    getTokenInfo?: typeof getTokenInfo;
    getTokenMetadata?: typeof getTokenMetadata;
    applyBuyConfirmationTransition?: typeof applyBuyConfirmationTransition;
    sendNotificationAsync?: typeof sendNotificationAsync;
  };
}): Promise<'processed' | 'skipped'> {
  const prismaClient = params.deps?.prisma || prisma;
  const getTokenInfoFn = params.deps?.getTokenInfo || getTokenInfo;
  const getTokenMetadataFn = params.deps?.getTokenMetadata || getTokenMetadata;
  const applyTransition = params.deps?.applyBuyConfirmationTransition || applyBuyConfirmationTransition;
  const sendNotification = params.deps?.sendNotificationAsync || sendNotificationAsync;

  const order = await prismaClient.copytradeOrder.findUnique({
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
    prismaClient.position.findUnique({
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
    prismaClient.copyTradeConfig.findUnique({
      where: { id: order.configId },
      include: { user: true },
    }).catch(() => null),
    resolvePositionStatusCompat(),
  ]);

  if (!position || !config?.user) return 'skipped';

  const pendingCreateStatus = ['pending', 'pending_broadcast', 'broadcasted_unseen'].includes(String(position.status || '').toLowerCase())
    ? String(position.status)
    : positionStatusCompat.pendingCreateStatus;

  const resolvedTokenInfo = await getTokenInfoFn(order.tokenOut, order.chainId, {
    verbose: false,
    forceRefresh: false,
    priority: 'normal',
    rpcStrategy: 'cheap',
  }).catch(() => null) as BuyFinalityTokenInfo | null;

  let tokenInfo = resolvedTokenInfo;
  if (!tokenInfo) {
    const metadataOnly = await getTokenMetadataFn(order.chainId, order.tokenOut, {
      rpcStrategy: 'cheap',
    }).catch(() => null);
    if (metadataOnly) {
      tokenInfo = {
        symbol: metadataOnly.symbol,
        price: 0,
        decimals: Number(metadataOnly.decimals || 18),
      };
      logger.warn(LogCode.SYS_INFO, '[CanonicalBuyFinality] Token price unavailable; proceeding with metadata-only deferred buy confirmation', {
        orderId: order.id,
        tokenAddress: order.tokenOut,
        chainId: order.chainId,
        symbol: metadataOnly.symbol,
      });
    }
  }

  if (!tokenInfo) {
    logger.warn(LogCode.SYS_ERROR, '[CanonicalBuyFinality] Missing token metadata for deferred buy confirmation processing', {
      orderId: order.id,
      tokenAddress: order.tokenOut,
      chainId: order.chainId,
    });
    return 'skipped';
  }

  await applyTransition({
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
    onNotifySuccess: async () => {
      sendNotification({
        userId: config.user.privyDid,
        farcasterFid: config.user.farcasterFid,
        type: 'TRADE_SUCCESS_BUY',
        data: {
          tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol, order.tokenOut),
          usdValue: Number(config.buyAmountUsd || 0).toFixed(2),
          targetWallet: order.targetWallet,
          txHash: readMetadataString(metadata, 'buyTxHash') || params.confirmation.resolvedTxHash || order.txHash,
          chainId: order.chainId,
        },
      }, 'copytrade_buy_success_confirmed_canonical');
    },
  });

  return 'processed';
}
