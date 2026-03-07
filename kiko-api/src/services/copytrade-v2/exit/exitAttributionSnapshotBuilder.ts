import { ethers } from 'ethers';
import { getErc20Decimals } from '../../rpcManager.js';
import { resolveAttributedPositionExitAmount } from '../positions/positionAttribution.js';
import { resolveCopytradeLedger } from '../ledger/copytradeLedgerService.js';
import { resolveTargetSellLink } from '../reconcile/copytradeTargetSellLinkResolver.js';
import { verifyTargetFullExit } from '../reconcile/targetSellFullExitVerifier.js';
import { resolveMirrorSellAttributedAmount } from './mirrorSellAttribution.js';
import type { ExitAttributionSnapshot, ExitSnapshotPosition } from './exitSnapshotTypes.js';
import type { ExitTokenInfo, PendingAttributedExitContext, PositionExitReason } from './types.js';
import { readExitBalanceOracle } from '../oracle/exitBalanceOracle.js';
import { emitCopytradeOracleAudit } from '../audit/copytradeOracleAudit.js';
import { resolveMirrorSellRatioContext } from './mirrorSellRatioContext.js';
import { writeExitBalanceHint } from './exitBalanceHintStore.js';

function formatTokenAmount(amount: bigint, decimals: number): number {
  const value = Number(ethers.formatUnits(amount, decimals));
  return Number.isFinite(value) ? value : 0;
}

function normalizeDecimalsCandidate(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return null;
  if (numeric < 0 || numeric > 36) return null;
  return numeric;
}

function resolveSnapshotDecimalsCandidate(input: {
  tokenInfo: ExitTokenInfo;
  positions: ExitSnapshotPosition[];
}): number | null {
  const tokenInfoDecimals = normalizeDecimalsCandidate((input.tokenInfo as { decimals?: unknown })?.decimals);
  if (tokenInfoDecimals !== null) return tokenInfoDecimals;

  for (const position of input.positions) {
    const candidates = [
      (position as { tokenDecimals?: unknown }).tokenDecimals,
      (position as { decimals?: unknown }).decimals,
      (position as { metadata?: { tokenDecimals?: unknown; decimals?: unknown } | null }).metadata?.tokenDecimals,
      (position as { metadata?: { tokenDecimals?: unknown; decimals?: unknown } | null }).metadata?.decimals,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeDecimalsCandidate(candidate);
      if (normalized !== null) return normalized;
    }
  }

  return null;
}

export const __exitAttributionSnapshotBuilderTest = {
  normalizeDecimalsCandidate,
  resolveSnapshotDecimalsCandidate,
};

export function buildEvmExitAttributionSnapshotFromResolvedInputs(input: {
  tokenAddress: string;
  chainId: number;
  walletAddress: string;
  exitReason: PositionExitReason;
  tokenInfo: ExitTokenInfo;
  decimals: number;
  onChainBalanceRaw: bigint;
  balanceRead: ExitAttributionSnapshot['balanceRead'];
  positions: ExitSnapshotPosition[];
  pendingLots?: PendingAttributedExitContext['pendingLots'];
  latestTargetSellTxHash?: string | null;
  targetFullExitVerified?: boolean;
  targetFullExitReasonCode?: string | null;
  targetSellRatioBps?: number | null;
  targetSellRatioReasonCode?: string | null;
  ledger?: ExitAttributionSnapshot['ledger'];
}): ExitAttributionSnapshot {
  const hasValidPrice = Number.isFinite(input.tokenInfo?.price) && Number(input.tokenInfo.price) > 0;
  const isMirrorSell = input.exitReason === 'mirror_sell';
  const pendingLots = [...(input.pendingLots || [])];
  const balanceUsd = formatTokenAmount(input.onChainBalanceRaw, input.decimals) * (hasValidPrice ? Number(input.tokenInfo.price) : 0);
  const treatAsEmptyOrDust = input.balanceRead.status === 'success'
    && (input.onChainBalanceRaw <= 0n || input.onChainBalanceRaw < 1000n || (hasValidPrice && balanceUsd < 0.1));
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
    balanceRead: input.balanceRead,
    positions: input.positions,
    pendingLots,
    latestTargetSellTxHash: input.latestTargetSellTxHash,
    targetFullExitVerified: input.targetFullExitVerified,
    targetFullExitReasonCode: input.targetFullExitReasonCode,
    targetSellRatioBps: input.targetSellRatioBps ?? null,
    targetSellRatioReasonCode: input.targetSellRatioReasonCode ?? null,
    ledger: input.ledger || null,
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
  const dec = resolveSnapshotDecimalsCandidate(input)
    ?? await getErc20Decimals(input.tokenAddress, input.chainId).catch(() => 18);
  // Execution amount always comes from follower wallet; target wallet is used as a sell-signal verifier.
  const balanceRead = await readExitBalanceOracle({
    tokenAddress: input.tokenAddress,
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    isMirrorSell,
    rpcPath: 'copytrade_exit_balance_follower',
  });
  emitCopytradeOracleAudit('EXIT_BALANCE_ORACLE', {
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    exitReason: input.exitReason,
    result: balanceRead,
  });
  const balance = balanceRead.value ?? 0n;
  if (balanceRead.status === 'success' && balance >= 0n) {
    void writeExitBalanceHint({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      tokenAddress: input.tokenAddress,
      balanceRaw: balance,
    });
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
  let targetSellRatioBps: number | null = null;
  let targetSellRatioReasonCode: string | null = null;

  if (isMirrorSell && input.targetWallet) {
    const targetVerification = await verifyTargetFullExit({
      targetWallet: input.targetWallet,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
    }).catch(() => null);
    if (targetVerification) {
      targetFullExitVerified = targetFullExitVerified || targetVerification.isFullExit;
      targetFullExitReasonCode = targetVerification.reasonCode;
    }
  }

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

  if (isMirrorSell && input.targetWallet) {
    const ratioContext = await resolveMirrorSellRatioContext({
      targetWallet: input.targetWallet,
      chainId: input.chainId,
      tokenAddress: input.tokenAddress,
      decimals: Number(dec),
      latestTargetSellTxHash,
      leaderBuyTxHash: input.positions.find((position) => String((position as any)?.leaderTxHash || '').trim())?.leaderTxHash || null,
    }).catch(() => null);
    if (ratioContext) {
      targetSellRatioBps = ratioContext.ratioBps;
      targetSellRatioReasonCode = ratioContext.reasonCode;
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
    balanceRead,
    positions: ledger.positions,
    pendingLots: ledger.pendingLots,
    latestTargetSellTxHash,
    targetFullExitVerified,
    targetFullExitReasonCode,
    targetSellRatioBps,
    targetSellRatioReasonCode,
    ledger,
  });
}
