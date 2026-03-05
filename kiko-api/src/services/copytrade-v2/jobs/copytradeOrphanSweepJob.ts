import { ethers } from 'ethers';
import prisma from '../../../db/prisma.js';
import { getErc20Decimals } from '../../rpcManager.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { emitCopytradeSummaryAudit } from '../audit/copytradeSummaryAudit.js';
import { findLedgerFirstOrphanSweepCandidates } from '../ledger/copytradeLedgerSelectors.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';

const PENDING_REPAIR_QUARANTINE_REASON = 'pending_expected_amount_missing_quarantine';
const HYGIENE_REASON_CODE = 'hygiene_position_closed';
const HYGIENE_BACKFILL_REASON_CODE = 'hygiene_open_backfill';

function parsePositiveBigInt(value: unknown): bigint | null {
  const text = String(value || '').trim();
  if (!/^[0-9]+$/.test(text)) return null;
  try {
    const parsed = BigInt(text);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

async function resolveFallbackExpectedAmountRaw(params: {
  chainId: number;
  tokenAddress: string;
  entryAmountExact?: string | null;
  entryAmountDec?: { toString(): string } | string | number | null;
  entryAmount?: string | null;
}): Promise<bigint | null> {
  const exact = parsePositiveBigInt(params.entryAmountExact);
  if (exact) return exact;

  const decimalText = String(params.entryAmountDec || '').trim();
  if (decimalText) {
    const decimals = await getErc20Decimals(params.tokenAddress, params.chainId).catch(() => 18);
    try {
      const parsed = ethers.parseUnits(decimalText, decimals);
      return parsed > 0n ? parsed : null;
    } catch {
      // continue to entryAmount fallback
    }
  }

  return parsePositiveBigInt(params.entryAmount);
}

async function repairMissingPendingExpectedAmount(params: {
  positionId: string;
  chainId: number;
  tokenAddress: string;
  entryAmountExact?: string | null;
  entryAmountDec?: { toString(): string } | string | number | null;
  entryAmount?: string | null;
  userId: string;
  targetWallet: string;
}): Promise<{ repaired: number; quarantined: number }> {
  const pendingLots = await prisma.pendingAttributedPosition.findMany({
    where: {
      positionId: params.positionId,
      status: { in: ['armed', 'sell_armed'] },
    },
    select: {
      id: true,
      expectedAmountRaw: true,
      status: true,
      tokenAddress: true,
      chainId: true,
    },
  });
  if (pendingLots.length === 0) return { repaired: 0, quarantined: 0 };

  let repaired = 0;
  let quarantined = 0;
  const fallbackRaw = await resolveFallbackExpectedAmountRaw(params);
  const decimals = fallbackRaw ? await getErc20Decimals(params.tokenAddress, params.chainId).catch(() => 18) : 18;

  for (const lot of pendingLots) {
    const hasRaw = parsePositiveBigInt(lot.expectedAmountRaw);
    if (hasRaw) continue;

    if (fallbackRaw && fallbackRaw > 0n) {
      await prisma.pendingAttributedPosition.update({
        where: { id: lot.id },
        data: {
          expectedAmountRaw: fallbackRaw.toString(),
          expectedAmountDec: ethers.formatUnits(fallbackRaw, decimals),
          reasonCode: 'repair_from_position_amount',
        },
      });
      repaired += 1;
      continue;
    }

    await prisma.pendingAttributedPosition.update({
      where: { id: lot.id },
      data: {
        status: 'cancelled',
        reasonCode: PENDING_REPAIR_QUARANTINE_REASON,
        consumedAt: new Date(),
      },
    });
    quarantined += 1;
    emitCopytradeDomainAudit('FOLLOWER_EXIT_QUARANTINED', {
      extra: {
        positionId: params.positionId,
        pendingLotId: lot.id,
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        targetWallet: params.targetWallet,
        userId: params.userId,
        reasonCode: PENDING_REPAIR_QUARANTINE_REASON,
      },
    });
  }

  return { repaired, quarantined };
}

async function runCopytradeStateHygieneCycle(): Promise<{
  closedPendingConsumed: number;
  closedLedgerFinalized: number;
  openLedgerBackfilled: number;
  sellOrderRetryArmed: number;
  reopenedFailedMaxRetryPositions: number;
}> {
  let closedPendingConsumed = 0;
  let closedLedgerFinalized = 0;
  let openLedgerBackfilled = 0;
  let sellOrderRetryArmed = 0;
  let reopenedFailedMaxRetryPositions = 0;

  // Re-open positions that were previously hard-closed by max retry exhaustion
  // but still keep pending lots armed (historical bug state).
  const reopenCandidates = await prisma.position.findMany({
    where: {
      status: { in: ['closed', 'failed', 'failed_final'] as any },
      exitReason: 'exit_failed_max_retries',
      config: {
        mirrorSell: true,
        status: 'active',
      },
      pendingAttributed: {
        status: { in: ['armed', 'sell_armed'] },
      },
    },
    select: {
      id: true,
      userId: true,
      configId: true,
      chainId: true,
      tokenAddress: true,
      config: { select: { targetWallet: true } },
    },
    take: 200,
    orderBy: { updatedAt: 'desc' },
  });
  if (reopenCandidates.length > 0) {
    const reopenedIds = reopenCandidates.map((position) => position.id);
    const reopened = await prisma.position.updateMany({
      where: { id: { in: reopenedIds } },
      data: {
        status: 'open',
        exitReason: 'mirror_sell',
        exitRetryCount: 1,
        lastExitAttempt: null,
        closedAt: null,
      },
    });
    reopenedFailedMaxRetryPositions = Number(reopened.count || 0);
    await Promise.all(reopenCandidates.map(async (position) => {
      await syncCopytradeLedgerFromLegacy({
        positionId: position.id,
        targetWallet: position.config?.targetWallet || null,
        lifecycleState: 'FOLLOWER_EXIT_FAILED_RETRYABLE',
        lastExecutionState: 'retryable_failure',
        lastExecutionReasonCode: 'hygiene_reopen_failed_max_retries',
      }).catch(() => null);
    }));
  }

  const closedPendingLots = await prisma.pendingAttributedPosition.findMany({
    where: {
      status: { in: ['armed', 'sell_armed'] },
      position: {
        status: { in: ['closed', 'failed', 'failed_final'] as any },
        NOT: {
          exitReason: 'exit_failed_max_retries',
          config: {
            mirrorSell: true,
            status: 'active',
          },
        },
      },
    },
    select: {
      id: true,
    },
    take: 300,
  });
  if (closedPendingLots.length > 0) {
    const result = await prisma.pendingAttributedPosition.updateMany({
      where: { id: { in: closedPendingLots.map((lot) => lot.id) } },
      data: {
        status: 'consumed',
        reasonCode: HYGIENE_REASON_CODE,
        consumedAt: new Date(),
      },
    });
    closedPendingConsumed = result.count;
  }

  const openLedgerRows = await prisma.copytradePositionLedger.findMany({
    where: {
      closedAt: null,
      positionIdLegacy: { not: null },
    },
    select: {
      positionIdLegacy: true,
      targetWallet: true,
    },
    take: 300,
    orderBy: { updatedAt: 'asc' },
  });
  const linkedPositionIds = openLedgerRows
    .map((row) => String(row.positionIdLegacy || '').trim())
    .filter(Boolean);
  if (linkedPositionIds.length > 0) {
    const closedPositions = await prisma.position.findMany({
      where: {
        id: { in: linkedPositionIds },
        status: { in: ['closed', 'failed', 'failed_final'] as any },
      },
      select: {
        id: true,
        closedAt: true,
      },
    });
    const closedMap = new Map(closedPositions.map((position) => [position.id, position]));
    for (const row of openLedgerRows) {
      const positionId = String(row.positionIdLegacy || '').trim();
      const closedPosition = closedMap.get(positionId);
      if (!positionId || !closedPosition) continue;
      await syncCopytradeLedgerFromLegacy({
        positionId,
        targetWallet: row.targetWallet,
        lifecycleState: 'FOLLOWER_CLOSED',
        lastExecutionState: 'closed_reconciled',
        lastExecutionReasonCode: HYGIENE_REASON_CODE,
        closedAt: closedPosition.closedAt || new Date(),
      }).catch(() => null);
      closedLedgerFinalized += 1;
    }
  }

  const openMirrorPositions = await prisma.position.findMany({
    where: {
      status: 'open',
      config: {
        mirrorSell: true,
        status: 'active',
      },
    },
    select: {
      id: true,
      config: { select: { targetWallet: true } },
    },
    take: 300,
    orderBy: { updatedAt: 'desc' },
  });
  if (openMirrorPositions.length > 0) {
    const openIds = openMirrorPositions.map((position) => position.id);
    const existingLedgerRows = await prisma.copytradePositionLedger.findMany({
      where: { positionIdLegacy: { in: openIds } },
      select: { positionIdLegacy: true },
    });
    const existingIds = new Set(
      existingLedgerRows
        .map((row) => String(row.positionIdLegacy || '').trim())
        .filter(Boolean),
    );
    for (const position of openMirrorPositions) {
      if (existingIds.has(position.id)) continue;
      await syncCopytradeLedgerFromLegacy({
        positionId: position.id,
        targetWallet: position.config?.targetWallet || null,
        lifecycleState: 'FOLLOWER_OPEN',
        lastExecutionState: 'ledger_backfilled',
        lastExecutionReasonCode: HYGIENE_BACKFILL_REASON_CODE,
      }).catch(() => null);
      openLedgerBackfilled += 1;
    }
  }

  const stuckSellOrders = await prisma.copytradeOrder.findMany({
    where: {
      direction: 'sell',
      lifecycleState: { in: ['DEFERRED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL'] },
      userId: { not: null },
      configId: { not: null },
      closedAt: null,
    },
    select: {
      userId: true,
      configId: true,
      chainId: true,
      tokenIn: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  for (const order of stuckSellOrders) {
    const tokenWhere = order.chainId === 900
      ? { tokenAddress: String(order.tokenIn || '') }
      : { tokenAddress: { equals: String(order.tokenIn || ''), mode: 'insensitive' as const } };
    const updated = await prisma.position.updateMany({
      where: {
        status: 'open',
        userId: String(order.userId || ''),
        configId: String(order.configId || ''),
        chainId: order.chainId,
        ...tokenWhere,
      },
      data: {
        exitReason: 'mirror_sell',
        exitRetryCount: 1,
        lastExitAttempt: null,
      },
    }).catch(() => ({ count: 0 }));
    sellOrderRetryArmed += Number(updated.count || 0);
  }

  return {
    closedPendingConsumed,
    closedLedgerFinalized,
    openLedgerBackfilled,
    sellOrderRetryArmed,
    reopenedFailedMaxRetryPositions,
  };
}

export async function runCopytradeOrphanSweepCycle(params?: {
  staleBefore?: Date;
}): Promise<{
  candidateCount: number;
  scheduledRetryCount: number;
  pendingExpectedAmountRepaired: number;
  quarantinedPendingLots: number;
  closedPendingConsumed: number;
  closedLedgerFinalized: number;
  openLedgerBackfilled: number;
  sellOrderRetryArmed: number;
  reopenedFailedMaxRetryPositions: number;
}> {
  const staleBefore = params?.staleBefore || new Date(Date.now() - 10 * 60 * 1000);
  const hygiene = await runCopytradeStateHygieneCycle();
  const candidates = await findLedgerFirstOrphanSweepCandidates({ staleBefore });
  let scheduledRetryCount = 0;
  let pendingExpectedAmountRepaired = 0;
  let quarantinedPendingLots = 0;

  for (const position of candidates) {
    const pendingRepair = await repairMissingPendingExpectedAmount({
      positionId: position.id,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      entryAmountExact: position.entryAmountExact,
      entryAmountDec: position.entryAmountDec,
      entryAmount: position.entryAmount,
      userId: position.userId,
      targetWallet: String(position.ledgerTargetWallet || position.config.targetWallet || ''),
    });
    pendingExpectedAmountRepaired += pendingRepair.repaired;
    quarantinedPendingLots += pendingRepair.quarantined;

    const nextRetryCount = Math.max(1, Number(position.exitRetryCount || 0));
    await prisma.position.update({
      where: { id: position.id },
      data: {
        exitReason: 'mirror_sell',
        exitRetryCount: nextRetryCount,
        lastExitAttempt: null,
      },
    }).catch(() => null);
    scheduledRetryCount += 1;
  }

  emitCopytradeSummaryAudit('ORPHAN_SWEEP_CYCLE_SUMMARY', {
    action: scheduledRetryCount > 0
      ? 'orphan_retry_scheduled'
      : (hygiene.closedPendingConsumed > 0 || hygiene.closedLedgerFinalized > 0 || hygiene.openLedgerBackfilled > 0 || hygiene.sellOrderRetryArmed > 0 || hygiene.reopenedFailedMaxRetryPositions > 0)
        ? 'hygiene_reconciled'
        : 'noop',
    candidateCount: candidates.length,
    scheduledRetryCount,
    pendingExpectedAmountRepaired,
    quarantinedPendingLots,
    closedPendingConsumed: hygiene.closedPendingConsumed,
    closedLedgerFinalized: hygiene.closedLedgerFinalized,
    openLedgerBackfilled: hygiene.openLedgerBackfilled,
    sellOrderRetryArmed: hygiene.sellOrderRetryArmed,
    reopenedFailedMaxRetryPositions: hygiene.reopenedFailedMaxRetryPositions,
    legacyFallbackUsed: false,
  });

  return {
    candidateCount: candidates.length,
    scheduledRetryCount,
    pendingExpectedAmountRepaired,
    quarantinedPendingLots,
    closedPendingConsumed: hygiene.closedPendingConsumed,
    closedLedgerFinalized: hygiene.closedLedgerFinalized,
    openLedgerBackfilled: hygiene.openLedgerBackfilled,
    sellOrderRetryArmed: hygiene.sellOrderRetryArmed,
    reopenedFailedMaxRetryPositions: hygiene.reopenedFailedMaxRetryPositions,
  };
}
