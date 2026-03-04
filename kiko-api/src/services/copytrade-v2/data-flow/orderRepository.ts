import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../../db/prisma.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import type { CopytradeReasonCode } from '../contracts/lifecycle.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';
import type { CopytradeIngressSignal, CopytradeOrderRepositoryPort } from '../contracts/ports.js';

function toAggregate(row: any): CopytradeOrderAggregate {
  return {
    id: row.id,
    chainId: row.chainId,
    txHash: row.txHash,
    targetWallet: row.targetWallet,
    tokenIn: row.tokenIn,
    tokenOut: row.tokenOut,
    mode: row.mode as CopytradeMode,
    lifecycleState: row.lifecycleState,
    lastReasonCode: row.lastReasonCode,
    retryCount: row.retryCount,
    direction: (row.direction || 'unknown') as CopytradeOrderAggregate['direction'],
    userId: row.userId,
    configId: row.configId,
    detectedAt: row.detectedAt,
    lastExecutionAt: row.lastExecutionAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
    metadata: (row.metadataJson as Record<string, unknown> | null) || undefined,
  };
}

async function lookupActiveConfig(targetWallet: string, chainId: number): Promise<{
  configId: string | null;
  userId: string | null;
}>
{
  const config = await prisma.copyTradeConfig.findFirst({
    where: {
      targetWallet,
      chainId,
      status: 'active',
    },
    select: {
      id: true,
      userId: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return {
    configId: config?.id || null,
    userId: config?.userId || null,
  };
}

export class PrismaCopytradeOrderRepository implements CopytradeOrderRepositoryPort {
  async claimOrLoad(
    signal: CopytradeIngressSignal,
    mode: CopytradeMode,
  ): Promise<{ order: CopytradeOrderAggregate; claimed: boolean }> {
    const txHash = String(signal.swap.txHash || '').trim().toLowerCase();
    const targetWallet = String(signal.targetWallet || '').trim().toLowerCase();

    const existing = await prisma.copytradeOrder.findUnique({
      where: {
        chainId_txHash_targetWallet: {
          chainId: signal.chainId,
          txHash,
          targetWallet,
        },
      },
    });

    if (existing) {
      return { order: toAggregate(existing), claimed: false };
    }

    const activeConfig = await lookupActiveConfig(targetWallet, signal.chainId);

    try {
      const created = await prisma.copytradeOrder.create({
        data: {
          id: crypto.randomUUID(),
          chainId: signal.chainId,
          txHash,
          targetWallet,
          tokenIn: String(signal.swap.tokenIn || '').toLowerCase(),
          tokenOut: String(signal.swap.tokenOut || '').toLowerCase(),
          mode,
          direction: 'unknown',
          lifecycleState: 'DETECTED',
          lastReasonCode: 'ok_detected',
          retryCount: 0,
          userId: activeConfig.userId,
          configId: activeConfig.configId,
          detectedAt: signal.detectedAt ? new Date(signal.detectedAt) : new Date(),
          metadataJson: {
            sourceDex: signal.swap.dexName || null,
            amountIn: String(signal.swap.amountIn || '0'),
            amountOut: String(signal.swap.amountOut || '0'),
            routeHopCount: signal.swap.routeHopCount || signal.swap.routeHops?.length || 0,
            ctIssueHintId: signal.ctIssueHintId || null,
          } as Prisma.InputJsonValue,
        },
      });

      return { order: toAggregate(created), claimed: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        const raced = await prisma.copytradeOrder.findUnique({
          where: {
            chainId_txHash_targetWallet: {
              chainId: signal.chainId,
              txHash,
              targetWallet,
            },
          },
        });
        if (raced) return { order: toAggregate(raced), claimed: false };
      }
      throw error;
    }
  }

  async updateState(params: {
    orderId: string;
    lifecycleState: CopytradeOrderAggregate['lifecycleState'];
    reasonCode: CopytradeReasonCode;
    retryCount?: number;
    direction?: CopytradeOrderAggregate['direction'];
    lastExecutionAt?: Date;
    closedAt?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<CopytradeOrderAggregate> {
    const existing = await prisma.copytradeOrder.findUnique({
      where: { id: params.orderId },
      select: { metadataJson: true },
    });

    const mergedMetadata = params.metadata
      ? {
          ...((existing?.metadataJson as Record<string, unknown> | null) || {}),
          ...params.metadata,
        }
      : undefined;

    const updated = await prisma.copytradeOrder.update({
      where: { id: params.orderId },
      data: {
        lifecycleState: params.lifecycleState,
        lastReasonCode: params.reasonCode,
        retryCount: params.retryCount,
        direction: params.direction,
        lastExecutionAt: params.lastExecutionAt,
        closedAt: params.closedAt,
        ...(mergedMetadata
          ? { metadataJson: mergedMetadata as Prisma.InputJsonValue }
          : {}),
      },
    });

    return toAggregate(updated);
  }

  async getById(orderId: string): Promise<CopytradeOrderAggregate | null> {
    const row = await prisma.copytradeOrder.findUnique({ where: { id: orderId } });
    return row ? toAggregate(row) : null;
  }

  async list(params?: {
    userId?: string;
    chainId?: number;
    states?: CopytradeOrderAggregate['lifecycleState'][];
    take?: number;
  }): Promise<CopytradeOrderAggregate[]> {
    const rows = await prisma.copytradeOrder.findMany({
      where: {
        ...(params?.userId ? { userId: params.userId } : {}),
        ...(params?.chainId ? { chainId: params.chainId } : {}),
        ...(params?.states?.length ? { lifecycleState: { in: params.states } } : {}),
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: Math.min(Math.max(params?.take || 100, 1), 500),
    });

    return rows.map(toAggregate);
  }
}
