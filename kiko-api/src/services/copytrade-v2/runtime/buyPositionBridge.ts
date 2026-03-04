import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { getTokenInfo } from '../../tokenService.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import { finalizeCopytradeBuyPosition } from '../positions/positionPersistence.js';
import {
  cancelPendingAttributedPosition,
  upsertPendingAttributedPosition,
} from '../positions/pendingAttributedPositionLedger.js';

const PENDING_STATUSES = ['pending', 'pending_broadcast', 'broadcasted_unseen'] as const;

function isBuyFlowState(state: CopytradeOrderAggregate['lifecycleState']): boolean {
  return state === 'BUY_SUBMITTING'
    || state === 'BUY_ACCEPTED'
    || state === 'BUY_CONFIRMED_OPEN'
    || state === 'EXIT_ARMED'
    || state === 'FAILED_RETRYABLE'
    || state === 'FAILED_TERMINAL';
}

function toStringValue(value: unknown): string {
  const normalized = String(value || '').trim();
  return normalized;
}

function toNumberValue(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function resolveBuyTokenAddress(order: CopytradeOrderAggregate): string {
  return String(order.tokenOut || '').trim();
}

function resolveLeaderBuyTxHash(order: CopytradeOrderAggregate): string {
  return String(order.txHash || '').trim();
}

function resolvePositionIdFromMetadata(order: CopytradeOrderAggregate): string | null {
  const value = toStringValue(order.metadata?.buyPositionId || order.metadata?.positionId);
  return value || null;
}

async function resolveExistingPositionId(order: CopytradeOrderAggregate): Promise<string | null> {
  const existing = await prisma.position.findFirst({
    where: {
      userId: order.userId || undefined,
      chainId: order.chainId,
      tokenAddress: resolveBuyTokenAddress(order),
      leaderTxHash: resolveLeaderBuyTxHash(order),
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
    },
  });
  return existing?.id || null;
}

async function markPendingPositionFailed(positionId: string): Promise<void> {
  try {
    await prisma.position.updateMany({
      where: {
        id: positionId,
        status: { in: [...PENDING_STATUSES] as any },
      },
      data: {
        status: 'failed_final' as any,
        exitReason: 'buy_confirmation_failed',
        closedAt: new Date(),
      },
    });
  } catch {
    await prisma.position.updateMany({
      where: {
        id: positionId,
        status: { in: [...PENDING_STATUSES] as any },
      },
      data: {
        status: 'failed' as any,
        exitReason: 'buy_confirmation_failed',
        closedAt: new Date(),
      },
    });
  }
}

export interface BuyPositionBridgeResult {
  positionId?: string;
}

export class CopytradeBuyPositionBridge {
  async ensurePending(order: CopytradeOrderAggregate, outcome?: CopytradeExecutionOutcome): Promise<BuyPositionBridgeResult> {
    if (!order.userId || !order.configId || !isBuyFlowState(order.lifecycleState)) return {};
    if (order.direction === 'sell') return {};

    const tokenAddress = resolveBuyTokenAddress(order);
    if (!tokenAddress) return {};

    const leaderBuyTxHash = resolveLeaderBuyTxHash(order);
    const existingFromMetadata = resolvePositionIdFromMetadata(order);
    const existingPositionId = existingFromMetadata || await resolveExistingPositionId(order);

    if (existingPositionId) {
      await upsertPendingAttributedPosition({
        positionId: existingPositionId,
        userId: order.userId,
        chainId: order.chainId,
        tokenAddress,
        entryTxHash: toStringValue(outcome?.txHash) || leaderBuyTxHash,
        leaderBuyTxHash,
        expectedAmountRaw: toStringValue(order.metadata?.amountOut) || null,
        expectedAmountDec: toStringValue(order.metadata?.amountOut) || null,
        reasonCode: 'buy_pending_armed',
      }).catch(() => {});
      return { positionId: existingPositionId };
    }

    const tokenInfo = await getTokenInfo(tokenAddress, order.chainId).catch(() => null);
    const entryAmount = toStringValue(order.metadata?.amountOut) || '0';
    const entryUsdValue = toNumberValue(order.metadata?.targetBuyValueUsd || order.metadata?.amountInUsd);
    const entryPrice = Number(tokenInfo?.price || 0);
    const tokenSymbol = String(tokenInfo?.symbol || tokenAddress.slice(0, 10));
    const entryTxHash = toStringValue(outcome?.txHash) || leaderBuyTxHash;

    const persisted = await finalizeCopytradeBuyPosition({
      userId: order.userId,
      configId: order.configId,
      tokenAddress,
      tokenSymbol,
      chainId: order.chainId,
      entryPrice,
      entryAmount,
      attributedEntryAmountExact: entryAmount,
      entryTxHash,
      leaderTxHash: leaderBuyTxHash,
      entryUsdValue,
      status: 'pending',
    });

    await upsertPendingAttributedPosition({
      positionId: persisted.positionId,
      userId: order.userId,
      chainId: order.chainId,
      tokenAddress,
      entryTxHash,
      leaderBuyTxHash,
      expectedAmountRaw: entryAmount,
      expectedAmountDec: entryAmount,
      reasonCode: 'buy_pending_armed',
    }).catch(() => {});

    return { positionId: persisted.positionId };
  }

  async promoteOpen(order: CopytradeOrderAggregate, outcome?: CopytradeExecutionOutcome): Promise<void> {
    if (!order.userId || !order.configId || order.direction === 'sell') return;
    const tokenAddress = resolveBuyTokenAddress(order);
    const leaderBuyTxHash = resolveLeaderBuyTxHash(order);
    if (!tokenAddress || !leaderBuyTxHash) return;

    const pending = await this.ensurePending(order, outcome);
    const positionId = pending.positionId || resolvePositionIdFromMetadata(order);
    if (!positionId) return;

    const tokenInfo = await getTokenInfo(tokenAddress, order.chainId).catch(() => null);
    const entryAmount = toStringValue(order.metadata?.amountOut) || '0';
    const entryUsdValue = toNumberValue(order.metadata?.targetBuyValueUsd || order.metadata?.amountInUsd);
    const entryPrice = Number(tokenInfo?.price || 0);
    const tokenSymbol = String(tokenInfo?.symbol || tokenAddress.slice(0, 10));
    const entryTxHash = toStringValue(outcome?.txHash) || toStringValue(order.metadata?.executionTxHash) || leaderBuyTxHash;

    await finalizeCopytradeBuyPosition({
      pendingPositionId: positionId,
      userId: order.userId,
      configId: order.configId,
      tokenAddress,
      tokenSymbol,
      chainId: order.chainId,
      entryPrice,
      entryAmount,
      attributedEntryAmountExact: entryAmount,
      entryTxHash,
      leaderTxHash: leaderBuyTxHash,
      entryUsdValue,
      status: 'open',
    }).catch((error) => {
      logger.warn(LogCode.SYS_ERROR, '[CopyTradeV2][BuyPositionBridge] promote open failed', {
        orderId: order.id,
        positionId,
        chainId: order.chainId,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
    });
  }

  async markFailed(order: CopytradeOrderAggregate): Promise<void> {
    if (!order.userId || order.direction === 'sell') return;
    const positionId = resolvePositionIdFromMetadata(order) || await resolveExistingPositionId(order);
    if (!positionId) return;

    await markPendingPositionFailed(positionId).catch(() => {});
    await cancelPendingAttributedPosition({
      positionId,
      reasonCode: 'buy_confirmation_failed',
    }).catch(() => 0);
  }
}
