import { Prisma } from '@prisma/client';
import { ethers } from 'ethers';

import prisma from '../../../db/prisma.js';
import { normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import { consumePendingAttributedPositions } from '../positions/pendingAttributedPositionLedger.js';

const MIRROR_CLOSE_THRESHOLD_BPS = 9500n;

type MirrorSellTrackedPosition = {
  id: string;
  userId: string;
  configId: string;
  tokenAddress: string;
  chainId: number;
  entryPrice: number;
  entryUsdValue: number | null;
  entryAmountExact?: string | null;
  entryAmountDec?: { toString(): string } | string | number | null;
  leaderTxHash?: string | null;
  entryTxHash?: string | null;
};

function parsePositiveBigInt(value: unknown): bigint {
  const raw = String(value || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return 0n;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

function deriveEntryAmountRaw(position: MirrorSellTrackedPosition, decimals: number): bigint {
  const exact = parsePositiveBigInt(position.entryAmountExact);
  if (exact > 0n) return exact;
  const decText = String(position.entryAmountDec || '').trim();
  if (!decText) return 0n;
  try {
    return ethers.parseUnits(decText, decimals);
  } catch {
    return 0n;
  }
}

export async function persistMirrorSellTrackedExit(params: {
  position: MirrorSellTrackedPosition;
  txHash: string;
  soldAmountRaw: bigint;
  decimals: number;
  exitPrice: number;
  targetWallet?: string | null;
  targetSellTxHash?: string | null;
  targetFullExitVerified?: boolean;
  targetSellRatioBps?: number | null;
  hasExternalBalance: boolean;
}): Promise<{ sellVolUsd: number; closed: boolean; mirrorSoldRatioBps: number }> {
  const existingLedger = await prisma.copytradePositionLedger.findUnique({
    where: { positionIdLegacy: params.position.id },
    select: {
      id: true,
      trackedEntryRaw: true,
      trackedRemainingRaw: true,
      trackedSoldRaw: true,
      targetWallet: true,
      followerBuyTxHash: true,
      leaderBuyTxHash: true,
      pendingLotIdLegacy: true,
      targetFullExitVerified: true,
    },
  }).catch(() => null);

  const derivedEntryRaw = deriveEntryAmountRaw(params.position, params.decimals);
  const previousTrackedEntryRaw = parsePositiveBigInt(existingLedger?.trackedEntryRaw);
  const previousTrackedSoldRaw = parsePositiveBigInt(existingLedger?.trackedSoldRaw);
  const previousTrackedRemainingRaw = parsePositiveBigInt(existingLedger?.trackedRemainingRaw);
  const trackedEntryRaw = previousTrackedEntryRaw > 0n
    ? previousTrackedEntryRaw
    : (previousTrackedRemainingRaw > 0n ? previousTrackedRemainingRaw + previousTrackedSoldRaw : derivedEntryRaw);
  const trackedRemainingBeforeRaw = previousTrackedRemainingRaw > 0n
    ? previousTrackedRemainingRaw
    : (trackedEntryRaw > 0n ? trackedEntryRaw - previousTrackedSoldRaw : 0n);
  const soldNowRaw = params.soldAmountRaw > trackedRemainingBeforeRaw && trackedRemainingBeforeRaw > 0n
    ? trackedRemainingBeforeRaw
    : params.soldAmountRaw;
  const trackedSoldRaw = trackedEntryRaw > 0n
    ? (previousTrackedSoldRaw + soldNowRaw > trackedEntryRaw ? trackedEntryRaw : previousTrackedSoldRaw + soldNowRaw)
    : previousTrackedSoldRaw + soldNowRaw;
  const trackedRemainingRaw = trackedEntryRaw > trackedSoldRaw ? trackedEntryRaw - trackedSoldRaw : 0n;
  const mirrorSoldRatioBps = trackedEntryRaw > 0n
    ? Number((trackedSoldRaw * 10_000n) / trackedEntryRaw)
    : 10_000;
  const shouldClose = Boolean(params.targetFullExitVerified)
    && !params.hasExternalBalance
    && trackedEntryRaw > 0n
    && ((trackedSoldRaw * 10_000n) / trackedEntryRaw) >= MIRROR_CLOSE_THRESHOLD_BPS;

  const sellAmount = Number(ethers.formatUnits(soldNowRaw, params.decimals));
  const sellVolUsd = Number.isFinite(sellAmount) ? sellAmount * params.exitPrice : 0;

  await prisma.position.update({
    where: { id: params.position.id },
    data: shouldClose
      ? {
          status: 'closed',
          exitTxHash: params.txHash,
          exitReason: 'mirror_sell',
          closedAt: new Date(),
          exitAmountExact: trackedEntryRaw > 0n ? trackedEntryRaw.toString() : undefined,
          exitAmountDec: trackedEntryRaw > 0n ? ethers.formatUnits(trackedEntryRaw, params.decimals) : undefined,
          exitAmount: trackedEntryRaw > 0n ? ethers.formatUnits(trackedEntryRaw, params.decimals) : undefined,
          exitPrice: params.exitPrice,
          exitUsdValue: (params.position.entryUsdValue || 0) + sellVolUsd,
          realizedPnlUsd: params.position.entryUsdValue != null
            ? ((params.position.entryUsdValue || 0) + sellVolUsd) - (params.position.entryUsdValue || 0)
            : sellVolUsd,
          realizedPnlPct: params.position.entryPrice > 0
            ? ((params.exitPrice - params.position.entryPrice) / params.position.entryPrice) * 100
            : 0,
          lastExitAttempt: new Date(),
          exitRetryCount: 0,
        }
      : {
          status: 'open',
          exitTxHash: params.txHash,
          exitReason: 'mirror_sell',
          lastExitAttempt: new Date(),
          exitRetryCount: 0,
        },
  });

  await consumePendingAttributedPositions({
    positionIds: [params.position.id],
    exitTxHash: params.txHash,
    reasonCode: shouldClose ? 'mirror_sell_closed' : 'mirror_sell_partial_progress',
  }).catch(() => 0);

  const ledgerTargetWallet = normalizeWallet(params.position.chainId, params.targetWallet || existingLedger?.targetWallet || '');
  await prisma.copytradePositionLedger.upsert({
    where: { positionIdLegacy: params.position.id },
    create: {
      userId: params.position.userId,
      configId: params.position.configId,
      chainId: params.position.chainId,
      tokenAddress: params.position.tokenAddress,
      targetWallet: ledgerTargetWallet,
      leaderBuyTxHash: params.position.leaderTxHash || existingLedger?.leaderBuyTxHash || null,
      targetSellTxHash: params.targetSellTxHash || null,
      followerBuyTxHash: params.position.entryTxHash || existingLedger?.followerBuyTxHash || null,
      followerExitTxHash: params.txHash,
      lifecycleState: shouldClose ? 'FOLLOWER_CLOSED' : 'FOLLOWER_OPEN',
      targetFullExitVerified: Boolean(params.targetFullExitVerified || existingLedger?.targetFullExitVerified),
      confirmedOwnedAmountRaw: trackedRemainingRaw.toString(),
      pendingOwnedAmountRaw: '0',
      effectiveOwnedAmountRaw: trackedRemainingRaw.toString(),
      sellableAmountRaw: trackedRemainingRaw.toString(),
      trackedEntryRaw: trackedEntryRaw.toString(),
      trackedRemainingRaw: trackedRemainingRaw.toString(),
      trackedSoldRaw: trackedSoldRaw.toString(),
      lastMirroredTargetSellTxHash: params.targetSellTxHash || null,
      lastMirroredRatioBps: params.targetSellRatioBps ?? null,
      externalBalanceDetected: params.hasExternalBalance,
      exitExecutionState: 'EXIT_CONFIRMED',
      lastExecutionState: 'confirmed_success',
      lastExecutionReasonCode: shouldClose ? 'mirror_sell_closed' : 'mirror_sell_partial_progress',
      positionIdLegacy: params.position.id,
      pendingLotIdLegacy: existingLedger?.pendingLotIdLegacy || null,
      closedAt: shouldClose ? new Date() : null,
    },
    update: {
      targetWallet: ledgerTargetWallet,
      targetSellTxHash: params.targetSellTxHash || null,
      followerExitTxHash: params.txHash,
      lifecycleState: shouldClose ? 'FOLLOWER_CLOSED' : 'FOLLOWER_OPEN',
      targetFullExitVerified: Boolean(params.targetFullExitVerified || existingLedger?.targetFullExitVerified),
      confirmedOwnedAmountRaw: trackedRemainingRaw.toString(),
      pendingOwnedAmountRaw: '0',
      effectiveOwnedAmountRaw: trackedRemainingRaw.toString(),
      sellableAmountRaw: trackedRemainingRaw.toString(),
      trackedEntryRaw: trackedEntryRaw.toString(),
      trackedRemainingRaw: trackedRemainingRaw.toString(),
      trackedSoldRaw: trackedSoldRaw.toString(),
      lastMirroredTargetSellTxHash: params.targetSellTxHash || null,
      lastMirroredRatioBps: params.targetSellRatioBps ?? undefined,
      externalBalanceDetected: params.hasExternalBalance,
      exitExecutionState: 'EXIT_CONFIRMED',
      lastExecutionState: 'confirmed_success',
      lastExecutionReasonCode: shouldClose ? 'mirror_sell_closed' : 'mirror_sell_partial_progress',
      closedAt: shouldClose ? new Date() : null,
    },
  });

  return {
    sellVolUsd,
    closed: shouldClose,
    mirrorSoldRatioBps,
  };
}
