const DEFAULT_LAUNCHPAD_MAX_DEVIATION_RATIO = 2.5;
const DEFAULT_SINGLE_SOURCE_OUTLIER_RATIO = 8;

export type LaunchpadOracleDecision = {
  finalPriceUsd: number;
  finalProvider: string;
  referencePriceUsd?: number;
  referenceProvider?: string;
  reasonCode?: string;
  fallbackUsed: boolean;
  deviationRatio?: number;
};

function normalizeLabel(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

type ReferenceCandidate = {
  priceUsd: number;
  provider: string;
  reasonCode: string;
};

type ReferenceSelection = {
  selected?: ReferenceCandidate;
  reasonCode?: string;
  conflictDetected: boolean;
};

function selectValidatedReference(params: {
  rpcPriceUsd: number;
  candidates: ReferenceCandidate[];
  maxDeviationRatio: number;
  singleSourceOutlierRatio?: number;
}): ReferenceSelection {
  const candidates = params.candidates.filter((candidate) => Number.isFinite(candidate.priceUsd) && candidate.priceUsd > 0);
  if (!candidates.length) {
    return { conflictDetected: false };
  }

  if (candidates.length === 1) {
    const candidate = candidates[0];
    const deviationRatio = priceRatio(params.rpcPriceUsd, candidate.priceUsd);
    if (Number.isFinite(deviationRatio) && deviationRatio > (params.singleSourceOutlierRatio || DEFAULT_SINGLE_SOURCE_OUTLIER_RATIO)) {
      return {
        conflictDetected: true,
        reasonCode: 'market_validator_single_source_outlier_rejected',
      };
    }
    return { selected: candidate, conflictDetected: false };
  }

  const sorted = [...candidates].sort((a, b) => priceRatio(params.rpcPriceUsd, a.priceUsd) - priceRatio(params.rpcPriceUsd, b.priceUsd));
  const [closest, second] = sorted;
  const candidateConsensusRatio = priceRatio(closest.priceUsd, second.priceUsd);
  if (Number.isFinite(candidateConsensusRatio) && candidateConsensusRatio > params.maxDeviationRatio) {
    return {
      conflictDetected: true,
      reasonCode: 'market_validator_reference_conflict',
      selected: closest,
    };
  }

  return { selected: closest, conflictDetected: false };
}

export function isLaunchpadOracleSource(params: {
  chainId: number;
  dexName?: string;
  provider?: string;
}): boolean {
  const dexName = normalizeLabel(params.dexName);
  const provider = normalizeLabel(params.provider);
  if (params.chainId === 56 && (dexName.includes('fourmeme') || provider.includes('fourmeme'))) {
    return true;
  }
  return false;
}

export function decideLaunchpadOraclePrice(params: {
  chainId: number;
  rpcPriceUsd: number;
  rpcDexName?: string;
  provider?: string;
  liquidityPriceUsd?: number;
  dexPriceUsd?: number;
  maxDeviationRatio?: number;
}): LaunchpadOracleDecision {
  const rpcPriceUsd = Number(params.rpcPriceUsd || 0);
  const provider = params.provider || 'rpc+api';
  const maxDeviationRatio = Math.max(
    1,
    Number(params.maxDeviationRatio || DEFAULT_LAUNCHPAD_MAX_DEVIATION_RATIO)
  );
  const dexPriceUsd = Number(params.dexPriceUsd || 0);
  const liquidityPriceUsd = Number(params.liquidityPriceUsd || 0);

  if (!Number.isFinite(rpcPriceUsd) || rpcPriceUsd <= 0) {
    return {
      finalPriceUsd: 0,
      finalProvider: provider,
      fallbackUsed: false
    };
  }

  if (!isLaunchpadOracleSource({
    chainId: params.chainId,
    dexName: params.rpcDexName,
    provider: params.provider
  })) {
    return {
      finalPriceUsd: rpcPriceUsd,
      finalProvider: provider,
      fallbackUsed: false
    };
  }

  const referenceCandidates = [
    { priceUsd: dexPriceUsd, provider: '0x-dex', reasonCode: 'launchpad_oracle_deviation_dex' },
    { priceUsd: liquidityPriceUsd, provider: 'dexscreener-liquidity', reasonCode: 'launchpad_oracle_deviation_liquidity' }
  ].filter((candidate) => Number.isFinite(candidate.priceUsd) && candidate.priceUsd > 0);

  if (!referenceCandidates.length) {
    return {
      finalPriceUsd: rpcPriceUsd,
      finalProvider: provider,
      fallbackUsed: false,
      reasonCode: 'launchpad_oracle_validator_unavailable'
    };
  }

  const selection = selectValidatedReference({
    rpcPriceUsd,
    candidates: referenceCandidates,
    maxDeviationRatio,
  });
  if (!selection.selected) {
    return {
      finalPriceUsd: rpcPriceUsd,
      finalProvider: provider,
      fallbackUsed: false,
      reasonCode: selection.reasonCode || 'launchpad_oracle_validator_unavailable',
    };
  }
  const reference = selection.selected;
  const high = Math.max(rpcPriceUsd, reference.priceUsd);
  const low = Math.min(rpcPriceUsd, reference.priceUsd);
  const deviationRatio = low > 0 ? high / low : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(deviationRatio) || deviationRatio <= maxDeviationRatio) {
    return {
      finalPriceUsd: rpcPriceUsd,
      finalProvider: provider,
      referencePriceUsd: reference.priceUsd,
      referenceProvider: reference.provider,
      fallbackUsed: false,
      deviationRatio,
      reasonCode: selection.conflictDetected ? selection.reasonCode : undefined,
    };
  }

  return {
    finalPriceUsd: reference.priceUsd,
    finalProvider: reference.provider,
    referencePriceUsd: reference.priceUsd,
    referenceProvider: reference.provider,
    reasonCode: reference.reasonCode,
    fallbackUsed: true,
    deviationRatio
  };
}

export function decideValidatedMarketPrice(params: {
  rpcPriceUsd: number;
  provider?: string;
  liquidityPriceUsd?: number;
  dexPriceUsd?: number;
  maxDeviationRatio?: number;
}): LaunchpadOracleDecision {
  const rpcPriceUsd = Number(params.rpcPriceUsd || 0);
  const provider = params.provider || 'rpc+api';
  const maxDeviationRatio = Math.max(
    1,
    Number(params.maxDeviationRatio || DEFAULT_LAUNCHPAD_MAX_DEVIATION_RATIO)
  );
  const referenceCandidates = [
    { priceUsd: Number(params.dexPriceUsd || 0), provider: '0x-dex', reasonCode: 'market_price_deviation_dex' },
    { priceUsd: Number(params.liquidityPriceUsd || 0), provider: 'dexscreener-liquidity', reasonCode: 'market_price_deviation_liquidity' }
  ].filter((candidate) => Number.isFinite(candidate.priceUsd) && candidate.priceUsd > 0);

  if (!Number.isFinite(rpcPriceUsd) || rpcPriceUsd <= 0) {
    return {
      finalPriceUsd: 0,
      finalProvider: provider,
      fallbackUsed: false
    };
  }
  if (!referenceCandidates.length) {
    return {
      finalPriceUsd: rpcPriceUsd,
      finalProvider: provider,
      fallbackUsed: false,
      reasonCode: 'market_validator_unavailable'
    };
  }

  const selection = selectValidatedReference({
    rpcPriceUsd,
    candidates: referenceCandidates,
    maxDeviationRatio,
  });
  if (!selection.selected) {
    return {
      finalPriceUsd: rpcPriceUsd,
      finalProvider: provider,
      fallbackUsed: false,
      reasonCode: selection.reasonCode || 'market_validator_unavailable'
    };
  }
  const reference = selection.selected;
  const deviationRatio = priceRatio(rpcPriceUsd, reference.priceUsd);
  if (!Number.isFinite(deviationRatio) || deviationRatio <= maxDeviationRatio) {
    return {
      finalPriceUsd: rpcPriceUsd,
      finalProvider: provider,
      referencePriceUsd: reference.priceUsd,
      referenceProvider: reference.provider,
      fallbackUsed: false,
      deviationRatio,
      reasonCode: selection.conflictDetected ? selection.reasonCode : undefined
    };
  }

  return {
    finalPriceUsd: reference.priceUsd,
    finalProvider: reference.provider,
    referencePriceUsd: reference.priceUsd,
    referenceProvider: reference.provider,
    reasonCode: reference.reasonCode,
    fallbackUsed: true,
    deviationRatio
  };
}

function priceRatio(a: number, b: number): number {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0) return Number.POSITIVE_INFINITY;
  return high / low;
}
