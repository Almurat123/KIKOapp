import { ethers } from 'ethers';
import prisma from '../../../db/prisma.js';
import { getErc20Decimals } from '../../rpcManager.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { emitCopytradeSummaryAudit } from '../audit/copytradeSummaryAudit.js';
import { findLedgerFirstOrphanSweepCandidates } from '../ledger/copytradeLedgerSelectors.js';

const PENDING_REPAIR_QUARANTINE_REASON = 'pending_expected_amount_missing_quarantine';

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

export async function runCopytradeOrphanSweepCycle(params?: {
  staleBefore?: Date;
}): Promise<{
  candidateCount: number;
  scheduledRetryCount: number;
  pendingExpectedAmountRepaired: number;
  quarantinedPendingLots: number;
}> {
  const staleBefore = params?.staleBefore || new Date(Date.now() - 10 * 60 * 1000);
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
    action: scheduledRetryCount > 0 ? 'orphan_retry_scheduled' : 'noop',
    candidateCount: candidates.length,
    scheduledRetryCount,
    pendingExpectedAmountRepaired,
    quarantinedPendingLots,
    legacyFallbackUsed: false,
  });

  return {
    candidateCount: candidates.length,
    scheduledRetryCount,
    pendingExpectedAmountRepaired,
    quarantinedPendingLots,
  };
}
