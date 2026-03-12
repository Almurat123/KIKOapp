import { ethers } from 'ethers';

import type { ExitAttributionSnapshot } from '../exit/exitSnapshotTypes.js';
import type { EvmExitSwapPlan } from '../exit/types.js';
import { createExitOrderRuntimeContext } from '../exit/runtime.js';

export function buildForcedExitSwapPlan(input: {
  userId: string;
  tokenAddress: string;
  chainId: number;
  exitReason: EvmExitSwapPlan['exitReason'];
  tokenInfo: EvmExitSwapPlan['tokenInfo'];
  universalSlippageBps: number;
  executionMode: EvmExitSwapPlan['executionMode'];
  targetWallet?: string;
  snapshot: ExitAttributionSnapshot;
  reasonCode: string;
}): EvmExitSwapPlan {
  // Forced exits should liquidate the full visible balance. Do not preserve dust on
  // purpose; retry policy is handled by execution settings, not by shrinking amount.
  const forcedSellRaw = input.snapshot.balanceRaw > 0n
    ? input.snapshot.balanceRaw
    : 0n;
  const amountInHuman = ethers.formatUnits(forcedSellRaw, input.snapshot.decimals);
  const retryAmountInHuman = amountInHuman;

  return {
    kind: 'swap',
    userId: input.userId,
    walletAddress: input.snapshot.walletAddress,
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    exitReason: input.exitReason,
    tokenInfo: input.tokenInfo,
    balance: input.snapshot.balanceRaw,
    decimals: input.snapshot.decimals,
    balanceUsd: input.snapshot.balanceUsd,
    attributedBalance: forcedSellRaw,
    amountInHuman,
    retryAmountInHuman,
    initialSlippageBps: input.universalSlippageBps,
    retrySlippageBps: Math.min(Math.max(Math.floor(input.universalSlippageBps * 2), input.universalSlippageBps + 400), 3000),
    executionMode: input.executionMode,
    sellRoutePolicy: 'external_primary',
    positions: input.snapshot.positions.filter((position) => String(position.status || '').toLowerCase() === 'open'),
    pendingAttributedLotIds: input.snapshot.attribution.pendingAttributedLotIds,
    latestTargetSellTxHash: input.snapshot.latestTargetSellTxHash || null,
    attributedReasonCode: 'FORCED_FULL_EXIT_FROM_LEDGER',
    attributionMetrics: {
      ...input.snapshot.attribution.metrics,
      orphanRecoveryReasonCode: input.reasonCode,
      forcedExit: true,
      forcedExitSellRaw: forcedSellRaw.toString(),
    },
    hasExternalBalance: false,
    runtimeContext: createExitOrderRuntimeContext({
      userId: input.userId,
      walletAddress: input.snapshot.walletAddress,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
      exitReason: input.exitReason,
      targetWallet: input.targetWallet,
    }),
  };
}
