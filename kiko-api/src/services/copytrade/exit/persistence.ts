import { ethers } from 'ethers';
import prisma from '../../../db/prisma.js';
import type { AttributedPositionLike } from '../positions/positionAttribution.js';
import { consumePendingAttributedPositions } from '../positions/pendingAttributedPositionLedger.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';

export async function reconcileNoopExitPosition(params: {
  positions: Array<AttributedPositionLike & { id: string }>;
  action: 'keep_open' | 'close_position' | 'quarantine' | 'retry_later';
  closeReason?: 'balance_empty' | 'balance_dust';
}): Promise<void> {
  if (params.action !== 'close_position' || params.positions.length === 0) return;
  await prisma.position.updateMany({
    where: { id: { in: params.positions.map((position) => position.id) }, status: 'open' },
    data: {
      status: 'closed',
      exitReason: params.closeReason,
      closedAt: new Date()
    }
  });
}

export async function persistDeferredExitRetryState(params: {
  positions: Array<AttributedPositionLike & { id: string; exitRetryCount?: number | null; chainId?: number; tokenAddress?: string; }>;
  targetWallet?: string | null;
  exitReason: string;
  reasonCode: string;
}): Promise<void> {
  if (params.positions.length === 0) return;
  const ids = params.positions.map((entry) => entry.id);
  const retryCount = Math.max(1, ...params.positions.map((position) => Number(position.exitRetryCount || 0) + 1));
  await prisma.position.updateMany({
    where: { id: { in: ids }, status: 'open' },
    data: {
      exitRetryCount: retryCount,
      lastExitAttempt: new Date(),
      exitReason: params.exitReason,
    },
  });
  await Promise.all(params.positions.map(async (position) => {
    await syncCopytradeLedgerFromLegacy({
      positionId: position.id,
      targetWallet: params.targetWallet,
      lifecycleState: 'FOLLOWER_EXIT_FAILED_RETRYABLE',
      lastExecutionState: 'uncertain',
      lastExecutionReasonCode: params.reasonCode,
    }).catch(() => null);
  }));
}

export async function persistSuccessfulExit(params: {
  positions: Array<AttributedPositionLike & {
    id: string;
    entryPrice: number;
    entryUsdValue: number | null;
    entryAmountExact?: string | null;
    entryAmountDec?: { toString(): string } | string | number | null;
  }>;
  txHash: string;
  exitReason: string;
  balance: bigint;
  decimals: number;
  exitPrice: number;
}): Promise<{ openPositions: any[]; sellVolUsd: number }> {
  const openPositions = params.positions;
  let attributedRawTotal = 0n;
  for (const pos of openPositions) {
    const rawExact = pos.entryAmountExact ? String(pos.entryAmountExact).trim() : '';
    if (rawExact && rawExact !== '0') {
      try {
        attributedRawTotal += BigInt(rawExact);
        continue;
      } catch {
        // fall through to decimal parse
      }
    }
    const decValue = pos.entryAmountDec == null ? '' : String(pos.entryAmountDec).trim();
    if (decValue && decValue !== '0') {
      try {
        attributedRawTotal += ethers.parseUnits(decValue, params.decimals);
      } catch {
        // ignore malformed historical amount
      }
    }
  }

  let effectiveBalanceRaw = params.balance;
  if (attributedRawTotal > 0n) {
    const maxReasonableRaw = attributedRawTotal * 5n;
    if (effectiveBalanceRaw > maxReasonableRaw) {
      effectiveBalanceRaw = attributedRawTotal;
    }
  }

  const sellAmount = Number(ethers.formatUnits(effectiveBalanceRaw, params.decimals));
  const sellVolUsd = Number.isFinite(sellAmount) ? sellAmount * params.exitPrice : 0;
  const totalEntryUsd = openPositions.reduce((sum, pos) => sum + (pos.entryUsdValue || 0), 0);

  for (const pos of openPositions) {
    const positionWeight = totalEntryUsd > 0 ? (pos.entryUsdValue || 0) / totalEntryUsd : (openPositions.length > 0 ? 1 / openPositions.length : 0);
    const positionExitUsd = sellVolUsd * positionWeight;
    let realizedPnlUsd = positionExitUsd - (pos.entryUsdValue || 0);
    const realizedPnlPct = pos.entryPrice && pos.entryPrice > 0
      ? ((params.exitPrice - pos.entryPrice) / pos.entryPrice) * 100
      : 0;
    const maxPlausiblePnl = Math.max((pos.entryUsdValue || 0) * 10, 100000);
    if (Math.abs(realizedPnlUsd) > maxPlausiblePnl) {
      realizedPnlUsd = 0;
    }
    await prisma.position.update({
      where: { id: pos.id },
      data: {
        status: 'closed',
        exitTxHash: params.txHash,
        exitReason: params.exitReason,
        closedAt: new Date(),
        exitAmountExact: pos.entryAmountExact ? String(pos.entryAmountExact) : undefined,
        exitAmount: pos.entryAmountDec ? String(pos.entryAmountDec) : undefined,
        exitAmountDec: pos.entryAmountDec ? String(pos.entryAmountDec) : undefined,
        exitPrice: params.exitPrice,
        exitUsdValue: positionExitUsd,
        realizedPnlUsd,
        realizedPnlPct
      }
    });
  }

  await consumePendingAttributedPositions({
    positionIds: openPositions.map((position) => position.id),
    exitTxHash: params.txHash,
    reasonCode: `exit_persisted:${params.exitReason}`,
  }).catch(() => 0);

  return { openPositions, sellVolUsd };
}

export async function persistFailedExitState(params: {
  positions: Array<AttributedPositionLike & { id: string; exitRetryCount?: number | null }>;
  exitReason: string;
  maxRetries: number;
}): Promise<{ retryCount: number; terminal: boolean }> {
  const position = params.positions[0];
  const retryCount = (position?.exitRetryCount || 0) + 1;
  const ids = params.positions.map((entry) => entry.id);
  if (retryCount <= params.maxRetries) {
    await prisma.position.updateMany({
      where: { id: { in: ids }, status: 'open' },
      data: {
        exitRetryCount: retryCount,
        lastExitAttempt: new Date(),
        exitReason: params.exitReason
      }
    });
    return { retryCount, terminal: false };
  }

  await prisma.position.updateMany({
    where: { id: { in: ids }, status: 'open' },
    data: {
      status: 'closed',
      exitReason: 'exit_failed_max_retries',
      closedAt: new Date()
    }
  });
  return { retryCount, terminal: true };
}
