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
  const precisionSafeSellRaw = input.snapshot.balanceRaw > 1n
    ? input.snapshot.balanceRaw - 1n
    : input.snapshot.balanceRaw;
  const amountInHuman = ethers.formatUnits(precisionSafeSellRaw, input.snapshot.decimals);
  const retryBalanceRaw = (precisionSafeSellRaw * 999n) / 1000n;
  const retryAmountInHuman = ethers.formatUnits(retryBalanceRaw > 0n ? retryBalanceRaw : precisionSafeSellRaw, input.snapshot.decimals);

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
    attributedBalance: precisionSafeSellRaw,
    amountInHuman,
    retryAmountInHuman,
    initialSlippageBps: input.universalSlippageBps,
    retrySlippageBps: Math.min(Math.floor(input.universalSlippageBps * 1.5), 2500),
    executionMode: input.executionMode,
    sellRoutePolicy: 'external_primary',
    positions: input.snapshot.positions.filter((position) => String(position.status || '').toLowerCase() === 'open'),
    pendingAttributedLotIds: input.snapshot.attribution.pendingAttributedLotIds,
    attributedReasonCode: 'FORCED_FULL_EXIT_FROM_LEDGER',
    attributionMetrics: {
      ...input.snapshot.attribution.metrics,
      orphanRecoveryReasonCode: input.reasonCode,
      forcedExit: true,
      precisionSafeSellRaw: precisionSafeSellRaw.toString(),
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
