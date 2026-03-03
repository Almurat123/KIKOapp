import { ethers } from 'ethers';
import { getErc20Balance, getErc20Decimals } from '../../rpcManager.js';
import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import type { EvmExitPlan, ExitTokenInfo, PositionExitReason } from './types.js';
import { createExitOrderRuntimeContext } from './runtime.js';
import {
  resolveAttributedPositionExitAmount,
  type AttributedPositionLike,
} from '../positions/positionAttribution.js';

function formatTokenAmount(amount: bigint, decimals: number): number {
  const value = Number(ethers.formatUnits(amount, decimals));
  return Number.isFinite(value) ? value : 0;
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
}): Promise<EvmExitPlan> {
  const { userId, walletAddress, tokenAddress, chainId, exitReason, tokenInfo } = input;
  const hasValidPrice = Number.isFinite(tokenInfo?.price) && Number(tokenInfo.price) > 0;
  const dec = await getErc20Decimals(tokenAddress, chainId).catch(() => 18);
  let balance = await getErc20Balance(tokenAddress, walletAddress, chainId).catch(() => 0n);
  const isMirrorSell = exitReason === 'mirror_sell';

  if (isMirrorSell && balance <= 0n) {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 220));
      const retryBalance = await getErc20Balance(tokenAddress, walletAddress, chainId).catch(() => 0n);
      if (retryBalance > balance) balance = retryBalance;
      if (balance > 0n) break;
    }
  }

  const decimals = Number(dec);
  const balanceUsd = formatTokenAmount(balance, decimals) * (hasValidPrice ? Number(tokenInfo.price) : 0);
  const treatAsEmptyOrDust = balance <= 0n || (!isMirrorSell && hasValidPrice && balanceUsd < 0.1);
  const attribution = resolveAttributedPositionExitAmount({
    positions: input.positions,
    decimals,
    onChainBalanceRaw: balance,
  });

  if (treatAsEmptyOrDust) {
    if (isMirrorSell && balance <= 0n) {
      return {
        kind: 'noop',
        action: 'keep_open',
        balance,
        decimals,
        balanceUsd,
        isMirrorSell,
        attributedReasonCode: attribution.reasonCode,
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
      positions: attribution.eligiblePositions
    };
  }

  if (attribution.sellAmountRaw <= 0n) {
    return {
      kind: 'noop',
      action: 'keep_open',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: attribution.reasonCode,
      positions: attribution.eligiblePositions
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
      positions: attribution.eligiblePositions
    };
  }

  const amountInHuman = ethers.formatUnits(attribution.sellAmountRaw, decimals);
  if (!amountInHuman || Number(amountInHuman) <= 0) {
    return {
      kind: 'noop',
      action: 'keep_open',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell,
      attributedReasonCode: attribution.reasonCode,
      positions: attribution.eligiblePositions
    };
  }

  const safeBalance999Raw = (attribution.sellAmountRaw * 999n) / 1000n;
  const retryBalance = safeBalance999Raw > 0n ? safeBalance999Raw : attribution.sellAmountRaw;
  const retryAmountInHuman = ethers.formatUnits(retryBalance, decimals);
  return {
    kind: 'swap',
    userId,
    walletAddress,
    tokenAddress,
    chainId,
    exitReason,
    tokenInfo,
    balance,
    decimals,
    balanceUsd,
    attributedBalance: attribution.sellAmountRaw,
    amountInHuman,
    retryAmountInHuman,
    initialSlippageBps: input.universalSlippageBps,
    retrySlippageBps: Math.min(Math.floor(input.universalSlippageBps * 1.5), 2500),
    executionMode: input.executionMode,
    sellRoutePolicy: 'external_primary',
    positions: attribution.eligiblePositions,
    attributedReasonCode: attribution.reasonCode,
    hasExternalBalance: attribution.metrics.hasExternalBalance,
    runtimeContext: createExitOrderRuntimeContext({
      userId,
      walletAddress,
      chainId,
      tokenAddress,
      exitReason,
      targetWallet: input.targetWallet
    })
  };
}
