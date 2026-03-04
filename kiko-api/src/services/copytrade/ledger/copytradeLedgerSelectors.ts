import prisma from '../../../db/prisma.js';
import { resolveCopytradeLedgerMode } from './copytradeLedgerMode.js';

const BUY_PENDING_STATES = [
  'FOLLOWER_BUY_SUBMITTING',
  'FOLLOWER_BUY_ACCEPTED',
  'FOLLOWER_BUY_AWAITING_CONFIRMATION',
] as const;

function hasPositiveDecimal(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  if (!normalized) return false;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return false;
  return Number(normalized) > 0;
}

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
      OR: [
        { updatedAt: { lt: params.retryBefore } },
        { lastExecutionReasonCode: { startsWith: 'repair_from_' } },
      ],
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
      lifecycleState: { in: ['FOLLOWER_OPEN', 'FOLLOWER_OPEN_REPAIR_REQUIRED'] },
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
      lifecycleState: { in: ['FOLLOWER_OPEN', 'FOLLOWER_OPEN_REPAIR_REQUIRED', 'FOLLOWER_EXIT_FAILED_RETRYABLE'] },
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

export async function findLedgerFirstRepairCandidates() {
  if (resolveCopytradeLedgerMode() !== 'v2_primary') return [];
  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      lifecycleState: { in: ['FOLLOWER_OPEN', 'FOLLOWER_OPEN_REPAIR_REQUIRED', 'FOLLOWER_EXIT_FAILED_RETRYABLE'] },
      closedAt: null,
      positionIdLegacy: { not: null },
    },
    select: {
      positionIdLegacy: true,
      chainId: true,
      tokenAddress: true,
      targetWallet: true,
      targetFullExitVerified: true,
    },
    take: 100,
    orderBy: { updatedAt: 'desc' },
  });
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.positionIdLegacy).filter((value): value is string => Boolean(value));
  const positions = await prisma.position.findMany({
    where: { id: { in: ids }, status: 'open' },
    select: {
      id: true,
      entryAmount: true,
      entryAmountDec: true,
      entryAmountExact: true,
    },
  });
  const brokenIds = new Set(
    positions
      .filter((position) => {
        const exact = String(position.entryAmountExact || '').trim();
        const entryAmount = String(position.entryAmount || '').trim();
        return !hasPositiveDecimal(exact) && !hasPositiveDecimal(position.entryAmountDec) && hasPositiveDecimal(entryAmount);
      })
      .map((position) => position.id),
  );
  return rows
    .filter((row) => row.positionIdLegacy && brokenIds.has(row.positionIdLegacy))
    .map((row) => ({
      positionId: row.positionIdLegacy as string,
      chainId: row.chainId,
      tokenAddress: row.tokenAddress,
      targetWallet: row.targetWallet,
      targetFullExitVerified: row.targetFullExitVerified,
    }));
}
