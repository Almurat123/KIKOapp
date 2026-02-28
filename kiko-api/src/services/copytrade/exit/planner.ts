import { ethers } from 'ethers';
import { getErc20Balance, getErc20Decimals } from '../../rpcManager.js';
import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import type { EvmExitPlan, ExitTokenInfo, PositionExitReason } from './types.js';
import { createExitOrderRuntimeContext } from './runtime.js';

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

  if (treatAsEmptyOrDust) {
    if (isMirrorSell && balance <= 0n) {
      return {
        kind: 'noop',
        action: 'keep_open',
        balance,
        decimals,
        balanceUsd,
        isMirrorSell
      };
    }
    return {
      kind: 'noop',
      action: 'close_position',
      closeReason: balance <= 0n ? 'balance_empty' : 'balance_dust',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell
    };
  }

  const amountInHuman = ethers.formatUnits(balance, decimals);
  if (!amountInHuman || Number(amountInHuman) <= 0) {
    return {
      kind: 'noop',
      action: 'close_position',
      closeReason: 'balance_dust',
      balance,
      decimals,
      balanceUsd,
      isMirrorSell
    };
  }

  const safeBalance999Raw = (balance * 999n) / 1000n;
  const retryBalance = safeBalance999Raw > 0n ? safeBalance999Raw : balance;
  const retryAmountInHuman = ethers.formatUnits(retryBalance, decimals);
  const directFirst = (process.env.COPYTRADE_SELL_DIRECT_ENABLED || 'true').toLowerCase() !== 'false';

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
    amountInHuman,
    retryAmountInHuman,
    initialSlippageBps: input.universalSlippageBps,
    retrySlippageBps: Math.min(Math.floor(input.universalSlippageBps * 1.5), 2500),
    executionMode: input.executionMode,
    directFirst,
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
