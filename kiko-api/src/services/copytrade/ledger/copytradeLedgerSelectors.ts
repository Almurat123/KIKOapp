import prisma from '../../../db/prisma.js';
import { resolveCopytradeLedgerMode } from './copytradeLedgerMode.js';

const BUY_PENDING_STATES = [
  'FOLLOWER_BUY_SUBMITTING',
  'FOLLOWER_BUY_ACCEPTED',
  'FOLLOWER_BUY_AWAITING_CONFIRMATION',
] as const;

export async function findLedgerFirstPendingCleanupPositionIds(params: {
  createdBefore: Date;
}): Promise<string[]> {
  if (resolveCopytradeLedgerMode() !== 'v2_primary') return [];
  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      lifecycleState: { in: [...BUY_PENDING_STATES] },
      createdAt: { lt: params.createdBefore },
      closedAt: null,
      positionIdLegacy: { not: null },
    },
    select: { positionIdLegacy: true },
  });
  return rows.map((row) => row.positionIdLegacy).filter((value): value is string => Boolean(value));
}

export async function markLedgerPendingCleanup(params: {
  positionIds: string[];
  reasonCode: string;
  closedAt: Date;
}): Promise<number> {
  if (params.positionIds.length === 0) return 0;
  const result = await prisma.copytradePositionLedger.updateMany({
    where: {
      positionIdLegacy: { in: params.positionIds },
      lifecycleState: { in: [...BUY_PENDING_STATES] },
    },
    data: {
      lifecycleState: 'FOLLOWER_EXIT_FAILED_TERMINAL',
      lastExecutionState: 'terminal_failure',
      lastExecutionReasonCode: params.reasonCode,
      closedAt: params.closedAt,
    },
  });
  return result.count;
}

export async function findLedgerFirstRetryPositions(params: {
  retryBefore: Date;
}) {
  if (resolveCopytradeLedgerMode() !== 'v2_primary') return [];
  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      lifecycleState: 'FOLLOWER_EXIT_FAILED_RETRYABLE',
      updatedAt: { lt: params.retryBefore },
      closedAt: null,
      positionIdLegacy: { not: null },
    },
    select: { positionIdLegacy: true },
  });
  const ids = rows.map((row) => row.positionIdLegacy).filter((value): value is string => Boolean(value));
  if (ids.length === 0) return [];
  return prisma.position.findMany({
    where: {
      id: { in: ids },
      status: 'open',
    },
    include: {
      user: { include: { settings: true } },
    },
  });
}

export async function findLedgerFirstMonitorPositions() {
  if (resolveCopytradeLedgerMode() !== 'v2_primary') return [];
  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      lifecycleState: 'FOLLOWER_OPEN',
      closedAt: null,
      positionIdLegacy: { not: null },
    },
    select: { positionIdLegacy: true },
  });
  const ids = rows.map((row) => row.positionIdLegacy).filter((value): value is string => Boolean(value));
  if (ids.length === 0) return [];
  return prisma.position.findMany({
    where: { id: { in: ids }, status: 'open' },
    include: { user: { include: { settings: true } } },
  });
}

export async function findLedgerFirstReconcileOpenCandidates(params: {
  createdAfter: Date;
}) {
  if (resolveCopytradeLedgerMode() !== 'v2_primary') return [];
  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      lifecycleState: { in: ['FOLLOWER_OPEN', 'FOLLOWER_EXIT_FAILED_RETRYABLE'] },
      OR: [
        { createdAt: { gte: params.createdAfter } },
        { updatedAt: { gte: params.createdAfter } },
      ],
      closedAt: null,
      positionIdLegacy: { not: null },
    },
    select: { positionIdLegacy: true },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
  const ids = rows.map((row) => row.positionIdLegacy).filter((value): value is string => Boolean(value));
  if (ids.length === 0) return [];
  return prisma.position.findMany({
    where: {
      id: { in: ids },
      status: 'open',
      config: { mirrorSell: true, status: 'active' },
    },
    include: {
      config: true,
      user: true,
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findLedgerFirstReconcilePendingCandidates(params: {
  createdAfter: Date;
}) {
  if (resolveCopytradeLedgerMode() !== 'v2_primary') return [];
  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      lifecycleState: { in: ['FOLLOWER_BUY_AWAITING_CONFIRMATION', 'FOLLOWER_EXIT_ARMED'] },
      OR: [
        { createdAt: { gte: params.createdAfter } },
        { updatedAt: { gte: params.createdAfter } },
      ],
      pendingLotIdLegacy: { not: null },
      closedAt: null,
    },
    select: { pendingLotIdLegacy: true },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
  const ids = rows.map((row) => row.pendingLotIdLegacy).filter((value): value is string => Boolean(value));
  if (ids.length === 0) return [];
  return prisma.pendingAttributedPosition.findMany({
    where: {
      id: { in: ids },
      status: { in: ['armed', 'sell_armed'] },
      createdAt: { gte: params.createdAfter },
      position: {
        config: { mirrorSell: true, status: 'active' },
      },
    },
    include: {
      position: {
        include: {
          config: true,
        },
      },
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
}
