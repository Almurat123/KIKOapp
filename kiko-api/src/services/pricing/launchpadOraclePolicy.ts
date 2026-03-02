const DEFAULT_LAUNCHPAD_MAX_DEVIATION_RATIO = 2.5;

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

  const reference = referenceCandidates[0];
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
      deviationRatio
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
