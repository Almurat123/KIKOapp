import prisma from '../../../db/prisma.js';
import { getErc20Decimals } from '../../rpcManager.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { emitCopytradeSummaryAudit } from '../audit/copytradeSummaryAudit.js';
import { findLedgerFirstRepairCandidates } from '../ledger/copytradeLedgerSelectors.js';
import { resolveCopytradeLedger } from '../ledger/copytradeLedgerService.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';
import { resolveLegacyAttributionRepair } from '../positions/legacyAttributionRepairPolicy.js';
import { hasPositiveAttributionAmount } from '../positions/positionAttributionAmount.js';
import { evaluatePositionAttributionIntegrity } from '../positions/positionAttributionIntegrityGate.js';
import { encodePositionTokenAmount } from '../positions/positionDecimalCodec.js';

export interface CopytradeAttributionRepairCycleResult {
  candidateCount: number;
  repairedCount: number;
  armedRetryCount: number;
  repairRequiredCount: number;
}

export async function repairCopytradePositionAttribution(params: {
  positionId: string;
  chainId: number;
  tokenAddress: string;
  targetWallet?: string | null;
}): Promise<'not_needed' | 'repaired' | 'repair_required'> {
  const position = await prisma.position.findUnique({
    where: { id: params.positionId },
    select: {
      id: true,
      entryAmount: true,
      entryAmountDec: true,
      entryAmountExact: true,
      exitReason: true,
      exitRetryCount: true,
    },
  });
  if (!position) return 'repair_required';

  const ledger = await resolveCopytradeLedger({
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    targetWallet: params.targetWallet,
    positionIds: [params.positionId],
  }).catch(() => null);

  const integrity = evaluatePositionAttributionIntegrity({
    entryAmountExact: position.entryAmountExact,
    entryAmountDec: position.entryAmountDec,
    ledger,
  });
  if (!integrity.repairRequired) return 'not_needed';

  const decimals = await getErc20Decimals(params.tokenAddress, params.chainId).catch(() => 18);
  const repair = resolveLegacyAttributionRepair({
    hasExactAmount: hasPositiveAttributionAmount(position.entryAmountExact),
    hasDecimalAmount: hasPositiveAttributionAmount(position.entryAmountDec),
    entryAmount: position.entryAmount,
    pendingLots: ledger?.pendingLots || [],
    ledgerEffectiveOwnedAmountRaw: ledger?.metrics.effectiveOwnedAmountRaw,
    decimals,
  });

  if (!repair.shouldRepair || !repair.repairedExactAmount) {
    await syncCopytradeLedgerFromLegacy({
      positionId: params.positionId,
      targetWallet: params.targetWallet,
      lifecycleState: 'FOLLOWER_OPEN_REPAIR_REQUIRED',
      lastExecutionState: 'repair_required',
      lastExecutionReasonCode: repair.reasonCode,
    }).catch(() => null);
    emitCopytradeDomainAudit('FOLLOWER_POSITION_REPAIR_REQUIRED', {
      ledger,
      extra: {
        positionId: params.positionId,
        tokenAddress: params.tokenAddress,
        chainId: params.chainId,
        reasonCode: repair.reasonCode,
      },
    });
    return 'repair_required';
  }

  const encoded = encodePositionTokenAmount({
    exactAmount: repair.repairedExactAmount,
  });
  await prisma.position.update({
    where: { id: params.positionId },
    data: {
      entryAmountExact: encoded.exactAmount || repair.repairedExactAmount,
      entryAmountDec: encoded.decimalAmount || undefined,
      exitRetryCount: ledger?.targetFullExitVerified && String(position.exitReason || '').toLowerCase() === 'mirror_sell'
        ? Math.max(1, Number(position.exitRetryCount || 0))
        : position.exitRetryCount,
      lastExitAttempt: ledger?.targetFullExitVerified && String(position.exitReason || '').toLowerCase() === 'mirror_sell'
        ? null
        : undefined,
    },
  });

  await syncCopytradeLedgerFromLegacy({
    positionId: params.positionId,
    targetWallet: params.targetWallet,
    lifecycleState: ledger?.targetFullExitVerified && String(position.exitReason || '').toLowerCase() === 'mirror_sell'
      ? 'FOLLOWER_EXIT_FAILED_RETRYABLE'
      : 'FOLLOWER_OPEN',
    targetFullExitVerified: ledger?.targetFullExitVerified,
    lastExecutionState: ledger?.targetFullExitVerified ? 'retryable_failure' : 'repair_completed',
    lastExecutionReasonCode: repair.reasonCode,
    targetSellTxHash: ledger?.latestTargetSellTxHash || null,
  }).catch(() => null);

  emitCopytradeDomainAudit('FOLLOWER_POSITION_REPAIRED', {
    ledger,
    extra: {
      positionId: params.positionId,
      tokenAddress: params.tokenAddress,
      chainId: params.chainId,
      reasonCode: repair.reasonCode,
      repairSource: repair.source || null,
      repairedExactAmount: repair.repairedExactAmount,
      targetFullExitVerified: ledger?.targetFullExitVerified || false,
    },
  });
  return 'repaired';
}

export async function runCopytradeAttributionRepairCycle(): Promise<CopytradeAttributionRepairCycleResult> {
  const candidates = await findLedgerFirstRepairCandidates();
  const result: CopytradeAttributionRepairCycleResult = {
    candidateCount: candidates.length,
    repairedCount: 0,
    armedRetryCount: 0,
    repairRequiredCount: 0,
  };

  for (const candidate of candidates) {
    const outcome = await repairCopytradePositionAttribution({
      positionId: candidate.positionId,
      chainId: candidate.chainId,
      tokenAddress: candidate.tokenAddress,
      targetWallet: candidate.targetWallet,
    }).catch(() => 'repair_required' as const);
    if (outcome === 'repaired') {
      result.repairedCount += 1;
      if (candidate.targetFullExitVerified) result.armedRetryCount += 1;
    } else if (outcome === 'repair_required') {
      result.repairRequiredCount += 1;
    }
  }

  emitCopytradeSummaryAudit('REPAIR_CYCLE_SUMMARY', {
    action: result.repairedCount > 0 ? 'repair_applied' : result.repairRequiredCount > 0 ? 'repair_required' : 'noop',
    candidateCount: result.candidateCount,
    repairedCount: result.repairedCount,
    armedRetryCount: result.armedRetryCount,
    repairRequiredCount: result.repairRequiredCount,
    legacyFallbackUsed: false,
  });

  return result;
}
