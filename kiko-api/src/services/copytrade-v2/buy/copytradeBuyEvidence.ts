import { getAdjudicatedSnapshot, hydrateSharedAdjudicatedSnapshot } from '../../order-runtime/adjudicator/service.js';
import { resolveTxFinalState, type TxFinalStateResolution } from '../../order-runtime/adjudicator/finalState.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { TxLifecycleResult } from '../../txLifecycle.js';

function normalizeTxHash(value: unknown): string | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  return /^0x[a-f0-9]{64}$/.test(normalized) ? normalized : undefined;
}

function collectCandidateTxHashes(params: {
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): string[] {
  return [...new Set(
    [
      params.txHash,
      params.runtimeContext?.canonicalTxHash,
      ...(params.runtimeContext?.relatedTxHashes || []),
      params.runtimeContext?.lastLifecycle?.txHash,
      params.lifecycle?.txHash,
    ]
      .map((value) => normalizeTxHash(value))
      .filter((value): value is string => Boolean(value))
  )];
}

export interface ResolvedCopytradeBuyEvidence {
  resolution: TxFinalStateResolution;
  txHash?: string;
  candidateTxHashes: string[];
  source: 'adjudicated' | 'runtime' | 'candidate' | 'none';
}

export function resolveCopytradeBuyEvidence(params: {
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): ResolvedCopytradeBuyEvidence {
  const orderId = params.runtimeContext?.orderId;
  const candidateTxHashes = collectCandidateTxHashes(params);
  const seedTxHash = candidateTxHashes[0];
  const snapshot = getAdjudicatedSnapshot({
    orderId,
    chainId: params.chainId,
    txHash: seedTxHash,
  });
  const resolvedTxHash = normalizeTxHash(snapshot?.canonicalTxHash)
    || normalizeTxHash(params.runtimeContext?.canonicalTxHash)
    || seedTxHash;
  const resolution = resolveTxFinalState({
    runtimeContext: params.runtimeContext,
    lifecycle: params.lifecycle || params.runtimeContext?.lastLifecycle || null,
    chainId: params.chainId,
    txHash: resolvedTxHash,
    orderId,
  });
  const source = normalizeTxHash(snapshot?.canonicalTxHash)
    ? 'adjudicated'
    : normalizeTxHash(params.runtimeContext?.canonicalTxHash)
      ? 'runtime'
      : resolvedTxHash
        ? 'candidate'
        : 'none';

  return {
    resolution,
    txHash: resolvedTxHash,
    candidateTxHashes,
    source,
  };
}

export async function hydrateResolvedCopytradeBuyEvidence(params: {
  chainId: number;
  txHash?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  lifecycle?: TxLifecycleResult | null;
}): Promise<ResolvedCopytradeBuyEvidence> {
  const candidateTxHashes = collectCandidateTxHashes(params);
  await hydrateSharedAdjudicatedSnapshot({
    orderId: params.runtimeContext?.orderId,
    chainId: params.chainId,
    txHash: candidateTxHashes[0],
  }).catch(() => null);
  return resolveCopytradeBuyEvidence(params);
}
