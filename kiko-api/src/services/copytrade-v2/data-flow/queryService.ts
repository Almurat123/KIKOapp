import prisma from '../../../db/prisma.js';
import type { CopytradeLifecycleState } from '../contracts/lifecycle.js';

export interface CopytradeOrderView {
  id: string;
  chainId: number;
  txHash: string;
  targetWallet: string;
  mode: string;
  lifecycleState: string;
  lastReasonCode: string;
  retryCount: number;
  direction: string;
  userId: string | null;
  configId: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  eventCount: number;
  lastExecutionStatus: string | null;
  lastExecutionReasonCode: string | null;
}

function toView(row: any): CopytradeOrderView {
  const latestExecution = row.executions?.[0] || null;
  return {
    id: row.id,
    chainId: row.chainId,
    txHash: row.txHash,
    targetWallet: row.targetWallet,
    mode: row.mode,
    lifecycleState: row.lifecycleState,
    lastReasonCode: row.lastReasonCode,
    retryCount: row.retryCount,
    direction: row.direction || 'unknown',
    userId: row.userId || null,
    configId: row.configId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt || null,
    eventCount: Number(row._count?.events || 0),
    lastExecutionStatus: latestExecution?.status || null,
    lastExecutionReasonCode: latestExecution?.reasonCode || null,
  };
}

export class CopytradeV2QueryService {
  async getOrderById(id: string): Promise<CopytradeOrderView | null> {
    const row = await prisma.copytradeOrder.findUnique({
      where: { id },
      include: {
        _count: {
          select: { events: true },
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return row ? toView(row) : null;
  }

  async listOrders(params?: {
    userId?: string;
    chainId?: number;
    states?: CopytradeLifecycleState[];
    take?: number;
  }): Promise<CopytradeOrderView[]> {
    const rows = await prisma.copytradeOrder.findMany({
      where: {
        ...(params?.userId ? { userId: params.userId } : {}),
        ...(params?.chainId ? { chainId: params.chainId } : {}),
        ...(params?.states?.length ? { lifecycleState: { in: params.states } } : {}),
      },
      include: {
        _count: {
          select: { events: true },
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: Math.min(Math.max(params?.take || 50, 1), 200),
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map(toView);
  }

  async getOrderEvents(orderId: string, take = 200): Promise<Array<{
    id: string;
    eventType: string;
    lifecycleState: string;
    reasonCode: string;
    payload: Record<string, unknown> | null;
    createdAt: Date;
  }>> {
    const rows = await prisma.copytradeOrderEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(take, 1), 1000),
    });

    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      lifecycleState: row.lifecycleState,
      reasonCode: row.reasonCode,
      payload: (row.payloadJson as Record<string, unknown> | null) || null,
      createdAt: row.createdAt,
    }));
  }
}
