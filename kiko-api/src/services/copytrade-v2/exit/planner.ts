import { ethers } from 'ethers';
import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import type { EvmExitPlan, ExitTokenInfo, PositionExitReason } from './types.js';
import { createExitOrderRuntimeContext } from './runtime.js';
import { setOrderMetadata } from '../../order-runtime/context.js';
import type { AttributedPositionLike } from '../positions/positionAttribution.js';
import { buildEvmExitAttributionSnapshot } from './exitAttributionSnapshotBuilder.js';
import type { ExitAttributionSnapshot } from './exitSnapshotTypes.js';
import type { PendingAttributedExitContext } from './types.js';
import { evaluateVerifiedMirrorExitFallback } from './verifiedMirrorExitFallbackPolicy.js';
import { evaluateOrphanRecovery } from '../recovery/orphanRecoveryPolicy.js';
import { buildForcedExitSwapPlan } from '../recovery/forcedExitPlanner.js';
import { resolveExitBalanceAdaptation } from '../../oracle/rpcAdaptationPolicy.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';

const MIRROR_SELL_CLOSE_THRESHOLD_BPS = 9500;
const MIRROR_SELL_RATIO_DENOMINATOR = 10_000n;
const MIRROR_SELL_ZERO_DUST_RETRY_GRACE_MS = Math.max(
  30_000,
  Number(process.env.COPYTRADE_MIRROR_SELL_ZERO_DUST_RETRY_GRACE_MS || '180000')
);

function parsePositiveBigIntMetric(metrics: Record<string, unknown> | undefined, key: string): bigint {
  if (!metrics) return 0n;
  const raw = String(metrics[key] ?? '').trim();
  if (!raw || !/^\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function hasRecentMirrorSellOwnershipEvidence(snapshot: ExitAttributionSnapshot, attributedAmountRaw: bigint): boolean {
  if (!snapshot.isMirrorSell) return false;
  const now = Date.now();
  const hasRecentPosition = snapshot.positions.some((position) => {
    const createdAt = position.createdAt instanceof Date ? position.createdAt.getTime() : 0;
    return createdAt > 0 && (now - createdAt) <= MIRROR_SELL_ZERO_DUST_RETRY_GRACE_MS;
  });
  if (hasRecentPosition) return true;
  if ((snapshot.pendingLots?.length || 0) > 0) return true;
  return attributedAmountRaw > 0n;
}

function getRecentMirrorSellOwnershipMetrics(snapshot: ExitAttributionSnapshot, attributedAmountRaw: bigint): Record<string, unknown> {
  const now = Date.now();
  const positionAgesMs = snapshot.positions
    .map((position) => position.createdAt instanceof Date ? Math.max(0, now - position.createdAt.getTime()) : null)
    .filter((value): value is number => typeof value === 'number');
  const newestPositionAgeMs = positionAgesMs.length > 0 ? Math.min(...positionAgesMs) : null;
  return {
    recentOwnershipEvidence: hasRecentMirrorSellOwnershipEvidence(snapshot, attributedAmountRaw),
    recentPositionCount: positionAgesMs.filter((ageMs) => ageMs <= MIRROR_SELL_ZERO_DUST_RETRY_GRACE_MS).length,
    newestPositionAgeMs,
    pendingLotCount: snapshot.pendingLots?.length || 0,
    attributedAmountRaw: attributedAmountRaw.toString(),
    onChainBalanceRaw: snapshot.balanceRaw.toString(),
  };
}

export async function buildEvmExitPlan(input: {
  userId: string;
  walletAddress: string;
  tokenAddress: string;
  chainId: number;
  exitReason: PositionExitReason;
  tokenInfo: ExitTokenInfo;
  universalSlippageBps: number;
  executionMode: CopyTradeExecutionMode;
  targetWallet?: string;
  positions: AttributedPositionLike[];
} & PendingAttributedExitContext): Promise<EvmExitPlan> {
  const snapshot = await buildEvmExitAttributionSnapshot({
    walletAddress: input.walletAddress,
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    exitReason: input.exitReason,
    tokenInfo: input.tokenInfo,
    targetWallet: input.targetWallet,
    positions: input.positions as Array<AttributedPositionLike & { id: string; status?: string | null }>,
    pendingLots: input.pendingLots,
  });
  return buildEvmExitPlanFromSnapshot({
    userId: input.userId,
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    exitReason: input.exitReason,
    tokenInfo: input.tokenInfo,
    universalSlippageBps: input.universalSlippageBps,
    executionMode: input.executionMode,
    targetWallet: input.targetWallet,
    snapshot,
  });
}

export function buildEvmExitPlanFromSnapshot(input: {
  userId: string;
  tokenAddress: string;
  chainId: number;
  exitReason: PositionExitReason;
  tokenInfo: ExitTokenInfo;
  universalSlippageBps: number;
  executionMode: CopyTradeExecutionMode;
  targetWallet?: string;
  snapshot: ExitAttributionSnapshot;
}): EvmExitPlan {
  const { userId, tokenAddress, chainId, exitReason, tokenInfo, snapshot } = input;
  const balance = snapshot.balanceRaw;
  const decimals = snapshot.decimals;
  const balanceUsd = snapshot.balanceUsd;
  const isMirrorSell = snapshot.isMirrorSell;
  const attribution = snapshot.attribution;
  const verifiedFallback = evaluateVerifiedMirrorExitFallback(snapshot);
  const balanceAdaptation = resolveExitBalanceAdaptation(snapshot.balanceRead);
  const attributedAmountRaw = parsePositiveBigIntMetric(attribution.metrics, 'attributedAmountRaw');
  const mirrorSoldRatioBps = (isMirrorSell && attributedAmountRaw > 0n && snapshot.balanceRaw <= attributedAmountRaw)
    ? Number(((attributedAmountRaw - snapshot.balanceRaw) * 10_000n) / attributedAmountRaw)
    : 0;
  const mirrorCloseByRatioEligible = isMirrorSell
    && Boolean(snapshot.targetFullExitVerified)
    && !attribution.hasExternalBalance
    && attributedAmountRaw > 0n
    && mirrorSoldRatioBps >= MIRROR_SELL_CLOSE_THRESHOLD_BPS
    // 95% auto-close is only safe when the remainder is actually dust-like.
    && (snapshot.treatAsEmptyOrDust || (snapshot.hasValidPrice && snapshot.balanceUsd < 0.1));
  const rawRatioBps = Number(snapshot.targetSellRatioBps || 0);
  const targetSellRatioBps = Number.isFinite(rawRatioBps)
    ? Math.max(0, Math.min(10_000, Math.floor(rawRatioBps)))
    : 0;
  const shouldDeferContradictoryDustClose = snapshot.treatAsEmptyOrDust
    && isMirrorSell
    && balanceAdaptation === 'accept'
    && hasRecentMirrorSellOwnershipEvidence(snapshot, attributedAmountRaw);
  const mirrorSellOwnershipMetrics = getRecentMirrorSellOwnershipMetrics(snapshot, attributedAmountRaw);

  if (isMirrorSell && balanceAdaptation !== 'accept') {
    return {
      kind: 'noop',
      action: balanceAdaptation === 'quarantine' ? 'quarantine' : 'retry_later',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: snapshot.balanceRead.reasonCode === 'EXIT_BALANCE_RPC_FAILED'
        ? 'EXIT_BALANCE_RPC_FAILED'
        : 'EXIT_BALANCE_RPC_UNCERTAIN',
      attributionMetrics: {
        ...attribution.metrics,
        oracleStatus: snapshot.balanceRead.status,
        oracleReasonCode: snapshot.balanceRead.reasonCode,
        oracleAttemptCount: snapshot.balanceRead.attemptCount,
        oracleLastError: snapshot.balanceRead.lastError || null,
          ...mirrorSellOwnershipMetrics,
      },
      positions: snapshot.positions,
    };
  }

  if (snapshot.treatAsEmptyOrDust) {
    if (shouldDeferContradictoryDustClose) {
      return {
        kind: 'noop',
        action: 'retry_later',
        balance,
        decimals,
        balanceUsd,
        isMirrorSell,
        attributedReasonCode: 'EXIT_BALANCE_RPC_UNCERTAIN',
        attributionMetrics: {
          ...attribution.metrics,
          oracleStatus: snapshot.balanceRead.status,
          oracleReasonCode: snapshot.balanceRead.reasonCode,
          oracleAttemptCount: snapshot.balanceRead.attemptCount,
          oracleLastError: snapshot.balanceRead.lastError || null,
          mirrorSellDustCloseDeferred: true,
          mirrorSellDustRetryGraceMs: MIRROR_SELL_ZERO_DUST_RETRY_GRACE_MS,
          latestTargetSellTxHash: snapshot.latestTargetSellTxHash || null,
          targetFullExitVerified: Boolean(snapshot.targetFullExitVerified),
          ...mirrorSellOwnershipMetrics,
        },
        positions: snapshot.positions,
      };
    }
    if (isMirrorSell && balance <= 0n) {
      return {
        kind: 'noop',
        action: 'keep_open',
        balance,
        decimals,
        balanceUsd,
        isMirrorSell,
        attributedReasonCode: attribution.reasonCode,
        attributionMetrics: attribution.metrics,
        positions: attribution.eligiblePositions
      };
    }
    return {
      kind: 'noop',
      action: 'close_position',
      closeReason: balance <= 0n ? 'balance_empty' : 'balance_dust',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: attribution.reasonCode,
      attributionMetrics: attribution.metrics,
      positions: attribution.eligiblePositions
    };
  }

  if (mirrorCloseByRatioEligible) {
    return {
      kind: 'noop',
      action: 'close_position',
      closeReason: 'balance_dust',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: attribution.reasonCode,
      attributionMetrics: {
        ...attribution.metrics,
        mirrorCloseThresholdBps: MIRROR_SELL_CLOSE_THRESHOLD_BPS,
        mirrorSoldRatioBps,
      },
      positions: attribution.eligiblePositions,
    };
  }

  const effectiveSellAmountRaw = verifiedFallback.shouldFallback
    ? verifiedFallback.sellAmountRaw
    : attribution.sellAmountRaw;
  const effectivePositions = verifiedFallback.shouldFallback
    ? verifiedFallback.positions
    : attribution.eligiblePositions;
  let adjustedSellAmountRaw = effectiveSellAmountRaw;
  let effectiveReasonCode = verifiedFallback.shouldFallback
    ? verifiedFallback.reasonCode
    : attribution.reasonCode;
  let adjustedMetrics: Record<string, unknown> = { ...attribution.metrics };

  if (isMirrorSell && targetSellRatioBps > 0 && targetSellRatioBps < 10_000 && balance > 0n) {
    const ratioBaseRaw = adjustedSellAmountRaw > 0n ? adjustedSellAmountRaw : balance;
    let ratioSellRaw = (ratioBaseRaw * BigInt(targetSellRatioBps)) / MIRROR_SELL_RATIO_DENOMINATOR;
    if (ratioSellRaw <= 0n && ratioBaseRaw > 0n) {
      ratioSellRaw = 1n;
    }
    if (ratioSellRaw > balance) {
      ratioSellRaw = balance;
    }
    adjustedSellAmountRaw = ratioSellRaw;
    if (effectiveSellAmountRaw <= 0n) {
      effectiveReasonCode = 'FULL_BALANCE_FALLBACK';
    }
    adjustedMetrics = {
      ...adjustedMetrics,
      mirrorTargetSellRatioBps: targetSellRatioBps,
      mirrorRatioReasonCode: snapshot.targetSellRatioReasonCode || null,
      mirrorRatioBaseRaw: ratioBaseRaw.toString(),
      mirrorRatioSellRaw: ratioSellRaw.toString(),
      mirrorRatioFallbackApplied: effectiveSellAmountRaw <= 0n,
    };
  }

  if (adjustedSellAmountRaw <= 0n) {
    const orphanRecovery = evaluateOrphanRecovery(snapshot);
    if (orphanRecovery.action === 'force_exit') {
      emitCopytradeDomainAudit('forced_mirror_exit_applied', {
        extra: {
          userId,
          chainId,
          tokenAddress,
          targetWallet: input.targetWallet || null,
          reasonCode: orphanRecovery.reasonCode,
          targetFullExitVerified: snapshot.targetFullExitVerified || false,
          latestTargetSellTxHash: snapshot.latestTargetSellTxHash || null,
          balanceRaw: snapshot.balanceRaw.toString(),
          effectiveReasonCode,
        }
      });
      return buildForcedExitSwapPlan({
        userId,
        tokenAddress,
        chainId,
        exitReason,
        tokenInfo,
        universalSlippageBps: input.universalSlippageBps,
        executionMode: input.executionMode,
        targetWallet: input.targetWallet,
        snapshot,
        reasonCode: orphanRecovery.reasonCode,
      });
    }
    if (orphanRecovery.action === 'quarantine') {
      return {
        kind: 'noop',
        action: 'quarantine',
        balance,
        decimals,
        balanceUsd,
        isMirrorSell,
        attributedReasonCode: 'TARGET_EXIT_QUARANTINED',
        attributionMetrics: {
          ...adjustedMetrics,
          orphanRecoveryReasonCode: orphanRecovery.reasonCode,
          targetFullExitReasonCode: snapshot.targetFullExitReasonCode || null,
        },
        positions: snapshot.positions,
      };
    }
    return {
      kind: 'noop',
      action: 'keep_open',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: effectiveReasonCode,
      attributionMetrics: adjustedMetrics,
      positions: effectivePositions
    };
  }

  if (
    attribution.reasonCode === 'ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE'
    && isMirrorSell
    && !snapshot.targetFullExitVerified
  ) {
    return {
      kind: 'noop',
      action: 'keep_open',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: attribution.reasonCode,
      attributionMetrics: attribution.metrics,
      positions: attribution.eligiblePositions
    };
  }

  const amountInHuman = ethers.formatUnits(adjustedSellAmountRaw, decimals);
  if (!amountInHuman || Number(amountInHuman) <= 0) {
    return {
      kind: 'noop',
      action: 'keep_open',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: effectiveReasonCode,
      attributionMetrics: adjustedMetrics,
      positions: effectivePositions
    };
  }

  const safeBalance999Raw = (adjustedSellAmountRaw * 999n) / 1000n;
  const retryBalance = safeBalance999Raw > 0n ? safeBalance999Raw : adjustedSellAmountRaw;
  const retryAmountInHuman = ethers.formatUnits(retryBalance, decimals);
  const runtimeContext = createExitOrderRuntimeContext({
    userId,
    walletAddress: snapshot.walletAddress,
    chainId,
    tokenAddress,
    exitReason,
    targetWallet: input.targetWallet
  });
  setOrderMetadata(runtimeContext, {
    pendingBridgeApplied: Boolean((adjustedMetrics as { pendingBridgeApplied?: unknown }).pendingBridgeApplied),
  });
  return {
    kind: 'swap',
    userId,
    walletAddress: snapshot.walletAddress,
    tokenAddress,
    chainId,
    exitReason,
    tokenInfo,
    balance,
    decimals,
    balanceUsd,
    attributedBalance: adjustedSellAmountRaw,
    amountInHuman,
    retryAmountInHuman,
    initialSlippageBps: input.universalSlippageBps,
    retrySlippageBps: Math.min(Math.floor(input.universalSlippageBps * 1.5), 2500),
    executionMode: input.executionMode,
    sellRoutePolicy: 'external_primary',
    positions: effectivePositions,
    pendingAttributedLotIds: attribution.pendingAttributedLotIds,
    latestTargetSellTxHash: snapshot.latestTargetSellTxHash || null,
    attributedReasonCode: effectiveReasonCode,
    attributionMetrics: adjustedMetrics,
    hasExternalBalance: attribution.hasExternalBalance,
    runtimeContext
  };
}
