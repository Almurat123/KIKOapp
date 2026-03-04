import prisma from '../../../db/prisma.js';
import { projectCopytradeLedgerSnapshot } from './copytradeLedgerProjector.js';
import type { CopytradeLedgerSnapshot } from './copytradeLedgerTypes.js';
import { resolvePositionLedgerSnapshot } from '../positions/positionLedgerResolver.js';
import type { PositionLedgerLifecyclePhase } from '../positions/positionLedgerSnapshot.js';

type LedgerRecord = Awaited<ReturnType<typeof prisma.copytradePositionLedger.findFirst>>;

function toText(value: bigint): string {
  return value.toString();
}

function parseBigIntText(value?: string | null): bigint {
  const normalized = String(value || '').trim();
  if (!normalized) return 0n;
  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
}

function toLegacySnapshot(record: NonNullable<LedgerRecord>): CopytradeLedgerSnapshot {
  const lifecyclePhase: PositionLedgerLifecyclePhase = record.lifecycleState.includes('OPEN')
    ? 'open_only'
    : record.lifecycleState.includes('EXIT') || record.lifecycleState.includes('AWAITING') || record.lifecycleState.includes('BUY')
      ? 'pending_only'
      : record.lifecycleState.includes('CLOSED')
        ? 'closed_only'
        : 'empty';
  const projected = {
    chainId: record.chainId,
    tokenAddress: record.tokenAddress,
    userId: record.userId,
    positionIds: record.positionIdLegacy ? [record.positionIdLegacy] : [],
    positions: [] as CopytradeLedgerSnapshot['positions'],
    pendingLots: [] as CopytradeLedgerSnapshot['pendingLots'],
    latestTargetSellTxHash: record.targetSellTxHash,
    latestTargetSellAt: null,
    targetFullExitVerified: record.targetFullExitVerified,
    lifecyclePhase,
  };
  return {
    ...projected,
    metrics: {
      openPositionCount: projected.lifecyclePhase === 'open_only' ? 1 : 0,
      pendingLotCount: record.pendingLotIdLegacy ? 1 : 0,
      armedPendingLotCount: record.lifecycleState === 'FOLLOWER_EXIT_ARMED' ? 1 : 0,
      sellArmedPendingLotCount: record.lifecycleState === 'FOLLOWER_EXIT_ARMED' ? 1 : 0,
      confirmedOwnedAmountRaw: parseBigIntText(record.confirmedOwnedAmountRaw),
      pendingOwnedAmountRaw: parseBigIntText(record.pendingOwnedAmountRaw),
      effectiveOwnedAmountRaw: parseBigIntText(record.effectiveOwnedAmountRaw),
    },
    reasonCode: projected.lifecyclePhase === 'open_only'
      ? 'LEDGER_OPEN_ONLY'
      : projected.lifecyclePhase === 'pending_only'
        ? 'LEDGER_PENDING_ONLY'
        : projected.lifecyclePhase === 'closed_only'
          ? 'LEDGER_CLOSED_ONLY'
          : 'LEDGER_EMPTY',
  };
}

export async function loadCopytradeLedgerByLeaderBuy(params: {
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  leaderBuyTxHash: string;
}): Promise<CopytradeLedgerSnapshot | null> {
  const record = await prisma.copytradePositionLedger.findFirst({
    where: {
      userId: params.userId,
      configId: params.configId,
      chainId: params.chainId,
      tokenAddress: { equals: params.tokenAddress, mode: 'insensitive' },
      leaderBuyTxHash: params.leaderBuyTxHash,
    },
  });
  return record ? toLegacySnapshot(record) : null;
}

export async function loadCopytradeLedgerByPositionIds(params: {
  positionIds: string[];
}): Promise<CopytradeLedgerSnapshot | null> {
  if (params.positionIds.length === 0) return null;
  const records = await prisma.copytradePositionLedger.findMany({
    where: {
      positionIdLegacy: { in: params.positionIds },
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (records.length === 0) return null;
  return toLegacySnapshot(records[0]!);
}

export async function syncCopytradeLedgerFromLegacy(params: {
  positionId: string;
  targetWallet?: string | null;
  lifecycleState?: string;
  targetFullExitVerified?: boolean;
  lastExecutionState?: string | null;
  lastExecutionReasonCode?: string | null;
  followerBuyTxHash?: string | null;
  followerExitTxHash?: string | null;
  targetSellTxHash?: string | null;
  closedAt?: Date | null;
}): Promise<CopytradeLedgerSnapshot | null> {
  const position = await prisma.position.findUnique({
    where: { id: params.positionId },
    select: {
      id: true,
      userId: true,
      configId: true,
      tokenAddress: true,
      chainId: true,
      entryTxHash: true,
      leaderTxHash: true,
    },
  });
  if (!position) return null;

  const reloaded = await resolvePositionLedgerSnapshot({
    chainId: position.chainId,
    tokenAddress: position.tokenAddress,
    targetWallet: params.targetWallet,
    positionIds: [params.positionId],
  });
  const projected = projectCopytradeLedgerSnapshot(reloaded);
  const pendingLot = reloaded.pendingLots.find((lot) => lot.positionId === params.positionId) || null;

  await prisma.copytradePositionLedger.upsert({
    where: {
      positionIdLegacy: params.positionId,
    },
    create: {
      userId: position.userId || '',
      configId: position.configId || '',
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      targetWallet: String(params.targetWallet || '').toLowerCase(),
      leaderBuyTxHash: position.leaderTxHash || null,
      targetSellTxHash: params.targetSellTxHash || projected.latestTargetSellTxHash || null,
      followerBuyTxHash: params.followerBuyTxHash || position.entryTxHash || null,
      followerExitTxHash: params.followerExitTxHash || null,
      lifecycleState: params.lifecycleState || inferLedgerLifecycleStateFromSnapshot(projected),
      targetFullExitVerified: params.targetFullExitVerified || false,
      confirmedOwnedAmountRaw: toText(projected.metrics.confirmedOwnedAmountRaw),
      pendingOwnedAmountRaw: toText(projected.metrics.pendingOwnedAmountRaw),
      effectiveOwnedAmountRaw: toText(projected.metrics.effectiveOwnedAmountRaw),
      sellableAmountRaw: toText(projected.metrics.effectiveOwnedAmountRaw),
      lastExecutionState: params.lastExecutionState || null,
      lastExecutionReasonCode: params.lastExecutionReasonCode || null,
      positionIdLegacy: params.positionId,
      pendingLotIdLegacy: pendingLot?.id || null,
      closedAt: params.closedAt || null,
    },
    update: {
      userId: position.userId || '',
      configId: position.configId || '',
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      targetWallet: String(params.targetWallet || '').toLowerCase(),
      leaderBuyTxHash: position.leaderTxHash || null,
      targetSellTxHash: params.targetSellTxHash || projected.latestTargetSellTxHash || null,
      followerBuyTxHash: params.followerBuyTxHash || position.entryTxHash || null,
      followerExitTxHash: params.followerExitTxHash || null,
      lifecycleState: params.lifecycleState || inferLedgerLifecycleStateFromSnapshot(projected),
      targetFullExitVerified: params.targetFullExitVerified ?? undefined,
      confirmedOwnedAmountRaw: toText(projected.metrics.confirmedOwnedAmountRaw),
      pendingOwnedAmountRaw: toText(projected.metrics.pendingOwnedAmountRaw),
      effectiveOwnedAmountRaw: toText(projected.metrics.effectiveOwnedAmountRaw),
      sellableAmountRaw: toText(projected.metrics.effectiveOwnedAmountRaw),
      lastExecutionState: params.lastExecutionState ?? undefined,
      lastExecutionReasonCode: params.lastExecutionReasonCode ?? undefined,
      pendingLotIdLegacy: pendingLot?.id || null,
      closedAt: params.closedAt ?? undefined,
    },
  });

  return projected;
}

export function inferLedgerLifecycleStateFromSnapshot(snapshot: CopytradeLedgerSnapshot): string {
  switch (snapshot.lifecyclePhase) {
    case 'mixed':
      return 'FOLLOWER_EXIT_ARMED';
    case 'open_only':
      return 'FOLLOWER_OPEN';
    case 'pending_only':
      return 'FOLLOWER_BUY_AWAITING_CONFIRMATION';
    case 'closed_only':
      return 'FOLLOWER_CLOSED';
    default:
      return 'TARGET_BUY_DETECTED';
  }
}
