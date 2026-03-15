import { ethers } from 'ethers';
import { getErc20Decimals } from '../../rpcManager.js';
import { resolveAttributedPositionExitAmount } from '../positions/positionAttribution.js';
import { resolveCopytradeLedger } from '../ledger/copytradeLedgerService.js';
import { resolveMirrorSellAttributedAmount } from './mirrorSellAttribution.js';
import type { ExitAttributionSnapshot, ExitSnapshotPosition } from './exitSnapshotTypes.js';
import type { ExitTokenInfo, PendingAttributedExitContext, PositionExitReason } from './types.js';
import { readExitBalanceOracle } from '../oracle/exitBalanceOracle.js';
import { emitCopytradeOracleAudit } from '../audit/copytradeOracleAudit.js';
import { readExitBalanceHint, writeExitBalanceHint } from './exitBalanceHintStore.js';
import { createRpcFactSuccess, type RpcFactResult } from '../../oracle/rpcFactResult.js';
import { resolveMirrorSellTargetContext } from './mirrorSellTargetContext.js';

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
  coerceMirrorSellBalanceReadWithHint,
  resolveMirrorSellBalanceReadFastPath,
};

function coerceMirrorSellBalanceReadWithHint(input: {
  balanceRead: RpcFactResult<bigint>;
  hintedBalanceRaw: bigint | null;
  isMirrorSell: boolean;
  positionCount: number;
  pendingLotCount: number;
}): RpcFactResult<bigint> {
  if (input.balanceRead.status === 'success') {
    return input.balanceRead;
  }
  if (!input.isMirrorSell) {
    return input.balanceRead;
  }
  if ((input.positionCount + input.pendingLotCount) <= 0) {
    return input.balanceRead;
  }
  const hintedBalanceRaw = input.hintedBalanceRaw ?? 0n;
  if (hintedBalanceRaw <= 0n) {
    return input.balanceRead;
  }
  return createRpcFactSuccess(
    hintedBalanceRaw,
    'EXIT_BALANCE_CONFIRMED_POSITIVE',
    input.balanceRead.attemptCount,
    'copytrade:balance_hint',
  );
}

async function resolveMirrorSellBalanceReadFastPath(input: {
  balanceReadPromise: Promise<RpcFactResult<bigint>>;
  hintedBalanceRaw: bigint | null;
  isMirrorSell: boolean;
  positionCount: number;
  pendingLotCount: number;
}): Promise<RpcFactResult<bigint>> {
  const hintedBalanceRaw = input.hintedBalanceRaw ?? 0n;
  if (
    input.isMirrorSell
    && (input.positionCount + input.pendingLotCount) > 0
    && hintedBalanceRaw > 0n
  ) {
    void input.balanceReadPromise.catch(() => null);
    return createRpcFactSuccess(
      hintedBalanceRaw,
      'EXIT_BALANCE_CONFIRMED_POSITIVE',
      0,
      'copytrade:balance_hint',
    );
  }

  const balanceRead = await input.balanceReadPromise;
  return coerceMirrorSellBalanceReadWithHint({
    balanceRead,
    hintedBalanceRaw,
    isMirrorSell: input.isMirrorSell,
    positionCount: input.positionCount,
    pendingLotCount: input.pendingLotCount,
  });
}

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
  const isMirrorSell = input.exitReason === 'mirror_sell';
  const decimalsPromise = Promise.resolve(resolveSnapshotDecimalsCandidate(input))
    .then((value) => value
      ?? getErc20Decimals(input.tokenAddress, input.chainId, 'latest', { lane: 'critical' }).catch(() => 18));
  // Execution amount always comes from follower wallet; target wallet is used as a sell-signal verifier.
  const balanceReadPromise = readExitBalanceOracle({
    tokenAddress: input.tokenAddress,
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    isMirrorSell,
    rpcPath: 'copytrade_exit_balance_follower',
  });
  const hintedBalanceRawPromise = readExitBalanceHint({
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    tokenAddress: input.tokenAddress,
  }).catch(() => null);
  const ledgerPromise = resolveCopytradeLedger({
    chainId: input.chainId,
    tokenAddress: input.tokenAddress,
    targetWallet: input.targetWallet,
    positions: input.positions,
    pendingLots: input.pendingLots,
    positionIds: input.positions.map((position) => position.id).filter(Boolean),
  });
  const mirrorTargetContextPromise = isMirrorSell && input.targetWallet
    ? resolveMirrorSellTargetContext({
        targetWallet: input.targetWallet,
        chainId: input.chainId,
        tokenAddress: input.tokenAddress,
        latestTargetSellTxHash: null,
        leaderBuyTxHash: input.pendingLots?.find((lot) => String(lot.leaderBuyTxHash || '').trim())?.leaderBuyTxHash
          || input.positions.find((position) => String((position as any).leaderTxHash || '').trim())?.leaderTxHash
          || null,
        positionCreatedAt: input.positions.find((position) => position.createdAt instanceof Date)?.createdAt || null,
        pendingCreatedAt: input.pendingLots?.find((lot) => lot.createdAt instanceof Date)?.createdAt || null,
      })
    : Promise.resolve(null);

  const [dec, hintedBalanceRaw, ledger, mirrorTargetContext] = await Promise.all([
    decimalsPromise,
    hintedBalanceRawPromise,
    ledgerPromise,
    mirrorTargetContextPromise,
  ]);
  const effectiveBalanceRead = await resolveMirrorSellBalanceReadFastPath({
    balanceReadPromise,
    hintedBalanceRaw,
    isMirrorSell,
    positionCount: input.positions.length,
    pendingLotCount: input.pendingLots?.length || 0,
  });
  emitCopytradeOracleAudit('EXIT_BALANCE_ORACLE', {
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    exitReason: input.exitReason,
    result: effectiveBalanceRead,
  });
  const balance = effectiveBalanceRead.value ?? 0n;
  if (effectiveBalanceRead.status === 'success' && balance >= 0n) {
    void writeExitBalanceHint({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      tokenAddress: input.tokenAddress,
      balanceRaw: balance,
    });
  }

  let latestTargetSellTxHash = ledger.latestTargetSellTxHash;
  let targetFullExitVerified = ledger.targetFullExitVerified;
  let targetFullExitReasonCode: string | null = mirrorTargetContext?.targetFullExitReasonCode || null;
  let targetSellRatioBps: number | null = mirrorTargetContext?.targetSellRatioBps ?? null;
  let targetSellRatioReasonCode: string | null = mirrorTargetContext?.targetSellRatioReasonCode ?? null;

  if (mirrorTargetContext?.latestTargetSellTxHash) {
    latestTargetSellTxHash = latestTargetSellTxHash || mirrorTargetContext.latestTargetSellTxHash;
  }
  if (mirrorTargetContext) {
    targetFullExitVerified = targetFullExitVerified || mirrorTargetContext.targetFullExitVerified;
  }

  return buildEvmExitAttributionSnapshotFromResolvedInputs({
    tokenAddress: input.tokenAddress,
    chainId: input.chainId,
    walletAddress: input.walletAddress,
    exitReason: input.exitReason,
    tokenInfo: input.tokenInfo,
    decimals: Number(dec),
    onChainBalanceRaw: balance,
    balanceRead: effectiveBalanceRead,
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
