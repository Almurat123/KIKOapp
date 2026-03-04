import { ethers } from 'ethers';
import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import type { EvmExitPlan, ExitTokenInfo, PositionExitReason } from './types.js';
import { createExitOrderRuntimeContext } from './runtime.js';
import type { AttributedPositionLike } from '../positions/positionAttribution.js';
import { buildEvmExitAttributionSnapshot } from './exitAttributionSnapshotBuilder.js';
import type { ExitAttributionSnapshot } from './exitSnapshotTypes.js';
import type { PendingAttributedExitContext } from './types.js';
import { evaluateVerifiedMirrorExitFallback } from './verifiedMirrorExitFallbackPolicy.js';
import { evaluateOrphanRecovery } from '../recovery/orphanRecoveryPolicy.js';
import { buildForcedExitSwapPlan } from '../recovery/forcedExitPlanner.js';
import { resolveExitBalanceAdaptation } from '../../oracle/rpcAdaptationPolicy.js';

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
  const orphanRecovery = evaluateOrphanRecovery(snapshot);
  const balanceAdaptation = resolveExitBalanceAdaptation(snapshot.balanceRead);

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
      },
      positions: snapshot.positions,
    };
  }

  if (snapshot.treatAsEmptyOrDust) {
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

  if (orphanRecovery.action === 'close_as_empty') {
    return {
      kind: 'noop',
      action: 'close_position',
      closeReason: 'balance_empty',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: 'TARGET_EXIT_QUARANTINED',
      attributionMetrics: {
        ...attribution.metrics,
        orphanRecoveryReasonCode: orphanRecovery.reasonCode,
        targetFullExitReasonCode: snapshot.targetFullExitReasonCode || null,
      },
      positions: snapshot.positions,
    };
  }

  if (orphanRecovery.action === 'force_exit') {
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
        ...attribution.metrics,
        orphanRecoveryReasonCode: orphanRecovery.reasonCode,
        targetFullExitReasonCode: snapshot.targetFullExitReasonCode || null,
      },
      positions: snapshot.positions,
    };
  }

  const effectiveSellAmountRaw = verifiedFallback.shouldFallback
    ? verifiedFallback.sellAmountRaw
    : attribution.sellAmountRaw;
  const effectivePositions = verifiedFallback.shouldFallback
    ? verifiedFallback.positions
    : attribution.eligiblePositions;
  const effectiveReasonCode = verifiedFallback.shouldFallback
    ? verifiedFallback.reasonCode
    : attribution.reasonCode;

  if (effectiveSellAmountRaw <= 0n) {
    return {
      kind: 'noop',
      action: 'keep_open',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: effectiveReasonCode,
      attributionMetrics: attribution.metrics,
      positions: effectivePositions
    };
  }

  if (attribution.reasonCode === 'ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE') {
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

  const amountInHuman = ethers.formatUnits(effectiveSellAmountRaw, decimals);
  if (!amountInHuman || Number(amountInHuman) <= 0) {
    return {
      kind: 'noop',
      action: 'keep_open',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: effectiveReasonCode,
      attributionMetrics: attribution.metrics,
      positions: effectivePositions
    };
  }

  const safeBalance999Raw = (effectiveSellAmountRaw * 999n) / 1000n;
  const retryBalance = safeBalance999Raw > 0n ? safeBalance999Raw : effectiveSellAmountRaw;
  const retryAmountInHuman = ethers.formatUnits(retryBalance, decimals);
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
    attributedBalance: effectiveSellAmountRaw,
    amountInHuman,
    retryAmountInHuman,
    initialSlippageBps: input.universalSlippageBps,
    retrySlippageBps: Math.min(Math.floor(input.universalSlippageBps * 1.5), 2500),
    executionMode: input.executionMode,
    sellRoutePolicy: 'external_primary',
    positions: effectivePositions,
    pendingAttributedLotIds: attribution.pendingAttributedLotIds,
    attributedReasonCode: effectiveReasonCode,
    attributionMetrics: attribution.metrics,
    hasExternalBalance: attribution.hasExternalBalance,
    runtimeContext: createExitOrderRuntimeContext({
      userId,
      walletAddress: snapshot.walletAddress,
      chainId,
      tokenAddress,
      exitReason,
      targetWallet: input.targetWallet
    })
  };
}
