export function buildEthAwarePendingPollPlan(params: {
  chainIds: number[];
  cursor: number;
}): { chainIdsToPoll: number[]; nextCursor: number } {
  const unique = Array.from(new Set(params.chainIds));
  if (unique.length === 0) {
    return { chainIdsToPoll: [], nextCursor: 0 };
  }

  const hasEth = unique.includes(1);
  const nonEth = unique.filter((chainId) => chainId !== 1);
  if (!hasEth) {
    const chainId = unique[params.cursor % unique.length];
    return {
      chainIdsToPoll: [chainId],
      nextCursor: (params.cursor + 1) % unique.length,
    };
  }

  if (nonEth.length === 0) {
    return {
      chainIdsToPoll: [1],
      nextCursor: 0,
    };
  }

  const nextNonEthCursor = params.cursor % nonEth.length;
  return {
    chainIdsToPoll: [1, nonEth[nextNonEthCursor]],
    nextCursor: (nextNonEthCursor + 1) % nonEth.length,
  };
}
