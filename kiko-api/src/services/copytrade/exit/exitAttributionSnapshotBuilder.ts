import { ethers } from 'ethers';
import { getErc20Balance, getErc20Decimals } from '../../rpcManager.js';
import { resolveAttributedPositionExitAmount } from '../positions/positionAttribution.js';
import { resolveCopytradeLedger } from '../ledger/copytradeLedgerService.js';
import { resolveTargetSellLink } from '../reconcile/copytradeTargetSellLinkResolver.js';
import { verifyTargetFullExit } from '../reconcile/targetSellFullExitVerifier.js';
import { resolveMirrorSellAttributedAmount } from './mirrorSellAttribution.js';
import type { ExitAttributionSnapshot, ExitSnapshotPosition } from './exitSnapshotTypes.js';
import type { ExitTokenInfo, PendingAttributedExitContext, PositionExitReason } from './types.js';

function formatTokenAmount(amount: bigint, decimals: number): number {
  const value = Number(ethers.formatUnits(amount, decimals));
  return Number.isFinite(value) ? value : 0;
}

export function buildEvmExitAttributionSnapshotFromResolvedInputs(input: {
  tokenAddress: string;
  chainId: number;
  walletAddress: string;
  exitReason: PositionExitReason;
  tokenInfo: ExitTokenInfo;
  decimals: number;
  onChainBalanceRaw: bigint;
  positions: ExitSnapshotPosition[];
  pendingLots?: PendingAttributedExitContext['pendingLots'];
  latestTargetSellTxHash?: string | null;
  targetFullExitVerified?: boolean;
  targetFullExitReasonCode?: string | null;
}): ExitAttributionSnapshot {
  const hasValidPrice = Number.isFinite(input.tokenInfo?.price) && Number(input.tokenInfo.price) > 0;
  const isMirrorSell = input.exitReason === 'mirror_sell';
  const pendingLots = [...(input.pendingLots || [])];
  const balanceUsd = formatTokenAmount(input.onChainBalanceRaw, input.decimals) * (hasValidPrice ? Number(input.tokenInfo.price) : 0);
  const treatAsEmptyOrDust = input.onChainBalanceRaw <= 0n || (!isMirrorSell && hasValidPrice && balanceUsd < 0.1);
  const attribution = isMirrorSell
    ? resolveMirrorSellAttributedAmount({
        positions: input.positions,
        pendingLots,
        decimals: input.decimals,
        onChainBalanceRaw: input.onChainBalanceRaw,
      })
    : resolveAttributedPositionExitAmount({
        positions: input.positions,
        decimals: input.decimals,
        onChainBalanceRaw: input.onChainBalanceRaw,
      });

  return {
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    isMirrorSell,
    hasValidPrice,
    decimals: input.decimals,
    balanceRaw: input.onChainBalanceRaw,
    balanceUsd,
    treatAsEmptyOrDust,
    positions: input.positions,
    pendingLots,
    latestTargetSellTxHash: input.latestTargetSellTxHash,
    targetFullExitVerified: input.targetFullExitVerified,
    targetFullExitReasonCode: input.targetFullExitReasonCode,
    attribution: {
      eligiblePositions: attribution.eligiblePositions,
      pendingAttributedLotIds: 'pendingAttributedLotIds' in attribution ? attribution.pendingAttributedLotIds : undefined,
      sellAmountRaw: attribution.sellAmountRaw,
      reasonCode: attribution.reasonCode,
      metrics: attribution.metrics,
      hasExternalBalance: attribution.metrics.hasExternalBalance,
    },
  };
}

export async function buildEvmExitAttributionSnapshot(input: {
  walletAddress: string;
  tokenAddress: string;
  chainId: number;
  exitReason: PositionExitReason;
  tokenInfo: ExitTokenInfo;
  positions: ExitSnapshotPosition[];
  targetWallet?: string;
} & PendingAttributedExitContext): Promise<ExitAttributionSnapshot> {
  const hasValidPrice = Number.isFinite(input.tokenInfo?.price) && Number(input.tokenInfo.price) > 0;
  const isMirrorSell = input.exitReason === 'mirror_sell';
  const dec = await getErc20Decimals(input.tokenAddress, input.chainId).catch(() => 18);
  let balance = await getErc20Balance(input.tokenAddress, input.walletAddress, input.chainId).catch(() => 0n);

  if (isMirrorSell && balance <= 0n) {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 220));
      const retryBalance = await getErc20Balance(input.tokenAddress, input.walletAddress, input.chainId).catch(() => 0n);
      if (retryBalance > balance) balance = retryBalance;
      if (balance > 0n) break;
    }
  }

  const ledger = await resolveCopytradeLedger({
    chainId: input.chainId,
    tokenAddress: input.tokenAddress,
    targetWallet: input.targetWallet,
    positions: input.positions,
    pendingLots: input.pendingLots,
    positionIds: input.positions.map((position) => position.id).filter(Boolean),
  });
  let latestTargetSellTxHash = ledger.latestTargetSellTxHash;
  let targetFullExitVerified = ledger.targetFullExitVerified;
  let targetFullExitReasonCode: string | null = null;

  if (isMirrorSell && input.targetWallet && (!latestTargetSellTxHash || !targetFullExitVerified)) {
    const linkedSell = await resolveTargetSellLink({
      targetWallet: input.targetWallet,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
      leaderBuyTxHash: input.positions.find((position: any) => position.leaderTxHash)?.leaderTxHash || null,
      positionCreatedAt: (input.positions[0] as any)?.createdAt || null,
      pendingCreatedAt: input.pendingLots?.[0]?.createdAt || null,
      allowUnanchoredVerifiedFallback: true,
      targetFullExitVerified: true,
    }).catch(() => null);

    if (linkedSell?.txHash) {
      latestTargetSellTxHash = linkedSell.txHash;
      targetFullExitReasonCode = linkedSell.reasonCode;
      const verification = await verifyTargetFullExit({
        targetWallet: input.targetWallet,
        chainId: input.chainId,
        tokenAddress: input.tokenAddress,
      }).catch(() => null);
      if (verification) {
        targetFullExitVerified = verification.isFullExit;
        targetFullExitReasonCode = verification.reasonCode;
      }
    }
  }

  return buildEvmExitAttributionSnapshotFromResolvedInputs({
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    exitReason: input.exitReason,
    tokenInfo: input.tokenInfo,
    decimals: Number(dec),
    onChainBalanceRaw: balance,
    positions: ledger.positions,
    pendingLots: ledger.pendingLots,
    latestTargetSellTxHash,
    targetFullExitVerified,
    targetFullExitReasonCode,
  });
}
