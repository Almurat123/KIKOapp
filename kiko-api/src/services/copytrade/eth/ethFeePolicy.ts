export type EthCopytradeFeePolicy = {
  speedUpAfterMs?: number;
  speedUpBumpBps?: number;
  priorityMultiplierBps?: number;
  minPriorityFeeWei?: bigint;
  maxPriorityFeeWei?: bigint;
  reasonCode: 'ETH_FEE_POLICY_AGGRESSIVE' | 'DEFAULT_FEE_POLICY';
};

export function resolveEthCopytradeFeePolicy(params: {
  chainId: number;
  mode: 'copytrade' | 'fast-swap' | 'swap-card' | 'allowance' | 'launchpad';
  executionMode?: 'safe' | 'normal' | 'turbo';
}): EthCopytradeFeePolicy {
  if (params.chainId === 1 && params.mode === 'copytrade') {
    const isTurbo = params.executionMode === 'turbo';
    return {
      speedUpAfterMs: isTurbo ? 900 : 1500,
      speedUpBumpBps: isTurbo ? 26000 : 22000,
      priorityMultiplierBps: isTurbo ? 30000 : 25000,
      minPriorityFeeWei: 2_000_000_000n,
      maxPriorityFeeWei: isTurbo ? 12_000_000_000n : 8_000_000_000n,
      reasonCode: 'ETH_FEE_POLICY_AGGRESSIVE',
    };
  }

  return {
    reasonCode: 'DEFAULT_FEE_POLICY',
  };
}
