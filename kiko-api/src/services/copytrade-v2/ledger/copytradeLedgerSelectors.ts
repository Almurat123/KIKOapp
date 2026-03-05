import prisma from '../../../db/prisma.js';
import { hasPositiveAttributionAmount } from '../positions/positionAttributionAmount.js';
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
        return !hasPositiveAttributionAmount(exact)
          && !hasPositiveAttributionAmount(position.entryAmountDec)
          && hasPositiveAttributionAmount(entryAmount);
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

export async function findLedgerFirstOrphanSweepCandidates(params: {
  staleBefore: Date;
}) {
  if (resolveCopytradeLedgerMode() !== 'v2_primary') return [];
  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      lifecycleState: { in: ['FOLLOWER_OPEN', 'FOLLOWER_OPEN_REPAIR_REQUIRED', 'FOLLOWER_EXIT_FAILED_RETRYABLE', 'FOLLOWER_EXIT_ARMED'] },
      targetFullExitVerified: true,
      updatedAt: { lt: params.staleBefore },
      closedAt: null,
      positionIdLegacy: { not: null },
    },
    select: {
      positionIdLegacy: true,
      chainId: true,
      tokenAddress: true,
      targetWallet: true,
      targetSellTxHash: true,
      lastExecutionReasonCode: true,
    },
    take: 200,
    orderBy: { updatedAt: 'asc' },
  });
  const ids = rows.map((row) => row.positionIdLegacy).filter((value): value is string => Boolean(value));
  if (ids.length === 0) return [];

  const positions = await prisma.position.findMany({
    where: {
      id: { in: ids },
      status: 'open',
      exitReason: 'mirror_sell',
      config: {
        mirrorSell: true,
        status: 'active',
      },
    },
    include: {
      config: {
        select: {
          targetWallet: true,
          status: true,
        }
      },
    },
  });
  const byId = new Map(positions.map((position) => [position.id, position]));
  return rows
    .map((row) => {
      const id = String(row.positionIdLegacy || '');
      const position = byId.get(id);
      if (!position) return null;
      return {
        ...position,
        ledgerTargetWallet: row.targetWallet,
        latestTargetSellTxHash: row.targetSellTxHash,
        lastExecutionReasonCode: row.lastExecutionReasonCode,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}
