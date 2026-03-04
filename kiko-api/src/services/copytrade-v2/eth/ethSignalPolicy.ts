export function prioritizeCopyTradePendingChains(chainIds: number[]): number[] {
  return [...chainIds].sort((left, right) => {
    if (left === 1 && right !== 1) return -1;
    if (right === 1 && left !== 1) return 1;
    return left - right;
  });
}

export function isEthPendingPrimary(chainId: number): boolean {
  return chainId === 1;
}
