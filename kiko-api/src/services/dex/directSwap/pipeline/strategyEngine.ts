import type { DexStrategy } from '../../directSwapTypes.js';
import { computeMinReasonable } from './referenceGate.js';

export function buildStrategyEvaluationContext(params: {
  referenceQuote: bigint;
  deviationBps: number;
  mergedStrategies: DexStrategy[];
  preferredStrategy: DexStrategy | null;
  forceV4: boolean;
  chainId: number;
  poolsCount: number;
  zoraRoutesEnabled: boolean;
  virtualLikely: boolean;
}): {
  noReferenceMode: boolean;
  minReasonable: bigint;
  strategies: DexStrategy[];
} {
  const noReferenceMode = params.referenceQuote <= 0n;
  const minReasonable = computeMinReasonable(params.referenceQuote, params.deviationBps);

  const preFilteredStrategies = noReferenceMode && params.preferredStrategy
    ? (params.poolsCount > 0
      ? params.mergedStrategies
      : params.mergedStrategies.filter((s) => {
        if (s.kind === params.preferredStrategy!.kind || (params.forceV4 && s.kind === 'v4')) return true;
        if (params.chainId === 8453 && params.preferredStrategy!.kind === 'v4' && s.kind === 'zora-sdk' && params.zoraRoutesEnabled) return true;
        if (params.chainId === 8453 && params.preferredStrategy!.kind === 'v4' && s.kind === 'virtual-bridge' && params.virtualLikely) return true;
        return false;
      }))
    : params.mergedStrategies;

  return {
    noReferenceMode,
    minReasonable,
    strategies: preFilteredStrategies
  };
}
