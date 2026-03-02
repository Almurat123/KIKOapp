export type OnChainPriceCandidate<TData extends { price: number; dexName: string }> = {
  data: TData;
  sourceKind: 'factory' | 'router';
  version: 'v2' | 'v3' | 'v4' | 'v4-pool' | 'bonding' | 'aerodrome';
  quoteSymbol: string;
  quoteIsStable: boolean;
};

export type OnChainPriceSelection<TData extends { price: number; dexName: string }> = {
  selected: OnChainPriceCandidate<TData>;
  clusterSize: number;
  discarded: Array<OnChainPriceCandidate<TData>>;
};

function candidateWeight(candidate: OnChainPriceCandidate<{ price: number; dexName: string }>): number {
  let score = 0;
  if (candidate.sourceKind === 'router') score += 4;
  if (candidate.version === 'v2') score += 3;
  if (candidate.version === 'aerodrome') score += 3;
  if (candidate.version === 'v3') score += 2;
  if (candidate.version === 'v4' || candidate.version === 'v4-pool') score += 2;
  if (candidate.version === 'bonding') score += 1;
  if (candidate.quoteIsStable) score += 1;
  const dexName = String(candidate.data.dexName || '').toLowerCase();
  if (dexName.includes('pancake')) score += 1;
  return score;
}

function priceRatio(a: number, b: number): number {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0) return Number.POSITIVE_INFINITY;
  return high / low;
}

export function selectBestOnChainPriceCandidate<TData extends { price: number; dexName: string }>(
  candidates: Array<OnChainPriceCandidate<TData>>,
  options: { maxClusterRatio?: number } = {}
): OnChainPriceSelection<TData> | null {
  const valid = candidates.filter((candidate) => Number.isFinite(candidate.data.price) && candidate.data.price > 0);
  if (!valid.length) return null;
  if (valid.length === 1) {
    return { selected: valid[0], clusterSize: 1, discarded: [] };
  }

  const maxClusterRatio = Math.max(1.05, Number(options.maxClusterRatio || 1.5));
  let bestCluster: OnChainPriceCandidate<TData>[] = [valid[0]];
  let bestClusterScore = -1;

  for (const anchor of valid) {
    const cluster = valid.filter((candidate) => priceRatio(anchor.data.price, candidate.data.price) <= maxClusterRatio);
    const clusterScore = cluster.length * 100 + cluster.reduce((sum, candidate) => sum + candidateWeight(candidate), 0);
    if (clusterScore > bestClusterScore) {
      bestCluster = cluster;
      bestClusterScore = clusterScore;
    }
  }

  const clusterMedian = [...bestCluster]
    .map((candidate) => candidate.data.price)
    .sort((left, right) => left - right)[Math.floor(bestCluster.length / 2)];

  const selected = [...bestCluster].sort((left, right) => {
    const weightDiff = candidateWeight(right) - candidateWeight(left);
    if (weightDiff !== 0) return weightDiff;
    const leftDistance = Math.abs(left.data.price - clusterMedian);
    const rightDistance = Math.abs(right.data.price - clusterMedian);
    return leftDistance - rightDistance;
  })[0];

  const discarded = valid.filter((candidate) => candidate !== selected && !bestCluster.includes(candidate));
  return {
    selected,
    clusterSize: bestCluster.length,
    discarded
  };
}
