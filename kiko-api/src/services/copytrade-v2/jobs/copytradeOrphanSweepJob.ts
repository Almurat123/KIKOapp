import { ethers } from 'ethers';
import prisma from '../../../db/prisma.js';
import { getErc20Decimals, getTransactionReceipt } from '../../rpcManager.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { emitCopytradeSummaryAudit } from '../audit/copytradeSummaryAudit.js';
import { findLedgerFirstOrphanSweepCandidates } from '../ledger/copytradeLedgerSelectors.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';
import {
  buildTargetSellEventPayload,
  persistTargetSellEventAndSchedulePositions,
} from '../exit/positionExitIntentScheduler.js';

const PENDING_REPAIR_QUARANTINE_REASON = 'pending_expected_amount_missing_quarantine';
const HYGIENE_REASON_CODE = 'hygiene_position_closed';
const HYGIENE_BACKFILL_REASON_CODE = 'hygiene_open_backfill';
const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

type PendingRepairSource =
  | 'order_metadata_direct_fee_settlement'
  | 'buy_receipt_transfer'
  | 'pending_expected_amount_dec'
  | 'position_entry_amount_exact';

function parsePositiveBigInt(value: unknown): bigint | null {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^[0-9]+$/.test(text) && !/^0x[0-9a-fA-F]+$/.test(text)) return null;
  try {
    const parsed = BigInt(text);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeAddress(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function extractDirectFeeSettlementAmountOutBase(value: unknown): bigint | null {
  if (!value || typeof value !== 'object') return null;
  const seen = new Set<any>();
  const queue: any[] = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const directFee = (current as Record<string, unknown>).directFeeSettlement;
    if (directFee && typeof directFee === 'object') {
      const raw = parsePositiveBigInt((directFee as Record<string, unknown>).amountOutBase);
      if (raw) return raw;
    }

    const maybeRaw = parsePositiveBigInt((current as Record<string, unknown>).amountOutBase);
    if (maybeRaw) return maybeRaw;
    for (const nested of Object.values(current as Record<string, unknown>)) {
      if (nested && typeof nested === 'object') queue.push(nested);
    }
  }
  return null;
}

async function resolveFromOrderMetadata(params: {
  positionId: string;
  chainId: number;
  pendingLotLeaderBuyTxHash?: string | null;
}): Promise<bigint | null> {
  const ledger = await prisma.copytradePositionLedger.findFirst({
    where: {
      positionIdLegacy: params.positionId,
      chainId: params.chainId,
    },
    select: {
      followerBuyTxHash: true,
    },
  });
  const candidateHashes = [
    String(ledger?.followerBuyTxHash || '').trim(),
    String(params.pendingLotLeaderBuyTxHash || '').trim(),
  ].filter(Boolean);
  if (candidateHashes.length === 0) return null;

  const txHashVariants = [...new Set(
    candidateHashes.flatMap((hash) => [hash, hash.toLowerCase(), hash.toUpperCase()]),
  )];
  const rows = await prisma.copytradeOrderExecution.findMany({
    where: {
      txHash: { in: txHashVariants },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      metadataJson: true,
      order: {
        select: {
          metadataJson: true,
        },
      },
    },
  });
  for (const row of rows) {
    const fromExecution = extractDirectFeeSettlementAmountOutBase(row.metadataJson);
    if (fromExecution) return fromExecution;
    const fromOrder = extractDirectFeeSettlementAmountOutBase(row.order?.metadataJson);
    if (fromOrder) return fromOrder;
  }
  return null;
}

async function resolveFromFollowerBuyReceipt(params: {
  positionId: string;
  chainId: number;
  tokenAddress: string;
  userId: string;
}): Promise<bigint | null> {
  if (params.chainId === 900) return null;
  const ledger = await prisma.copytradePositionLedger.findFirst({
    where: {
      positionIdLegacy: params.positionId,
      chainId: params.chainId,
    },
    select: {
      followerBuyTxHash: true,
    },
  });
  const followerBuyTxHash = String(ledger?.followerBuyTxHash || '').trim();
  if (!followerBuyTxHash) return null;

  const user = await prisma.user.findUnique({
    where: { privyDid: params.userId },
    select: { walletAddress: true },
  });
  const walletAddress = normalizeAddress(user?.walletAddress);
  if (!walletAddress) return null;

  const receipt = await getTransactionReceipt(params.chainId, followerBuyTxHash).catch(() => null);
  const logs = Array.isArray(receipt?.logs) ? receipt.logs : [];
  if (logs.length === 0) return null;

  let sum = 0n;
  const tokenAddress = normalizeAddress(params.tokenAddress);
  for (const log of logs) {
    const logAddress = normalizeAddress((log as any)?.address);
    const topics = Array.isArray((log as any)?.topics) ? (log as any).topics : [];
    if (logAddress !== tokenAddress) continue;
    if (String(topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC.toLowerCase()) continue;
    if (topics.length < 3) continue;
    const toTopic = String(topics[2] || '');
    if (!toTopic.startsWith('0x') || toTopic.length < 42) continue;
    const toAddress = `0x${toTopic.slice(-40)}`.toLowerCase();
    if (toAddress !== walletAddress) continue;
    const amount = parsePositiveBigInt((log as any)?.data);
    if (amount) sum += amount;
  }
  return sum > 0n ? sum : null;
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
      expectedAmountDec: true,
      status: true,
      leaderBuyTxHash: true,
      tokenAddress: true,
      chainId: true,
    },
  });
  if (pendingLots.length === 0) return { repaired: 0, quarantined: 0 };

  let repaired = 0;
  let quarantined = 0;
  const decimals = await getErc20Decimals(params.tokenAddress, params.chainId).catch(() => 18);
  const orderMetadataRaw = await resolveFromOrderMetadata({
    positionId: params.positionId,
    chainId: params.chainId,
    pendingLotLeaderBuyTxHash: pendingLots[0]?.leaderBuyTxHash || null,
  });
  const receiptTransferRaw = await resolveFromFollowerBuyReceipt({
    positionId: params.positionId,
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    userId: params.userId,
  });
  const entryExactRaw = parsePositiveBigInt(params.entryAmountExact);

  for (const lot of pendingLots) {
    const hasRaw = parsePositiveBigInt(lot.expectedAmountRaw);
    if (hasRaw) continue;

    let repairedRaw: bigint | null = null;
    let repairSource: PendingRepairSource | null = null;
    const expectedAmountDecText = String(lot.expectedAmountDec || '').trim();

    if (orderMetadataRaw && orderMetadataRaw > 0n) {
      repairedRaw = orderMetadataRaw;
      repairSource = 'order_metadata_direct_fee_settlement';
    } else if (receiptTransferRaw && receiptTransferRaw > 0n) {
      repairedRaw = receiptTransferRaw;
      repairSource = 'buy_receipt_transfer';
    } else if (expectedAmountDecText) {
      try {
        const parsed = ethers.parseUnits(expectedAmountDecText, decimals);
        if (parsed > 0n) {
          repairedRaw = parsed;
          repairSource = 'pending_expected_amount_dec';
        }
      } catch {
        // ignore malformed pending decimal amount
      }
    } else if (entryExactRaw && entryExactRaw > 0n) {
      repairedRaw = entryExactRaw;
      repairSource = 'position_entry_amount_exact';
    }

    if (repairedRaw && repairedRaw > 0n && repairSource) {
      await prisma.pendingAttributedPosition.update({
        where: { id: lot.id },
        data: {
          expectedAmountRaw: repairedRaw.toString(),
          expectedAmountDec: ethers.formatUnits(repairedRaw, decimals),
          status: 'sell_armed',
          reasonCode: `repair:${repairSource}`,
        },
      });
      repaired += 1;
      emitCopytradeDomainAudit('quarantine_auto_repaired', {
        extra: {
          positionId: params.positionId,
          pendingLotId: lot.id,
          chainId: params.chainId,
          tokenAddress: params.tokenAddress,
          targetWallet: params.targetWallet,
          userId: params.userId,
          reasonCode: 'pending_expected_amount_repaired',
          repairAttempted: true,
          repairSource,
          repairResult: 'success',
        },
      });
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
        repairAttempted: true,
        repairSource: 'none',
        repairResult: 'failed',
      },
    });
    emitCopytradeDomainAudit('quarantine_repair_failed', {
      extra: {
        positionId: params.positionId,
        pendingLotId: lot.id,
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        targetWallet: params.targetWallet,
        userId: params.userId,
        reasonCode: PENDING_REPAIR_QUARANTINE_REASON,
        repairAttempted: true,
        repairSource: 'none',
        repairResult: 'failed',
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
    await persistTargetSellEventAndSchedulePositions({
      event: buildTargetSellEventPayload({
        chainId: position.chainId,
        targetWallet: String(position.ledgerTargetWallet || position.config.targetWallet || ''),
        tokenAddress: position.tokenAddress,
        targetSellTxHash: String(position.latestTargetSellTxHash || `ORPHAN_SWEEP_${position.id}`),
        targetFullExitVerified: true,
        source: 'orphan_sweep',
        metadata: {
          orphanSweepReasonCode: position.lastExecutionReasonCode || null,
        },
      }),
      positions: [{
        id: position.id,
        userId: position.userId,
        configId: position.configId,
        chainId: position.chainId,
        tokenAddress: position.tokenAddress,
        entryAmountExact: position.entryAmountExact,
        entryAmountDec: position.entryAmountDec,
      }],
      priority: 230,
      metadata: {
        orphanSweepScheduled: true,
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
