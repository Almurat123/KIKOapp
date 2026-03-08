export type EthCopytradeFeePolicy = {
  speedUpAfterMs?: number;
  speedUpBumpBps?: number;
  replacementScheduleMs?: number[];
  replacementBumpBps?: number[];
  priorityMultiplierBps?: number;
  maxFeeMultiplierBps?: number;
  minPriorityFeeWei?: bigint;
  maxPriorityFeeWei?: bigint;
  gasPolicyTier: 'eth_copytrade_normal' | 'eth_copytrade_turbo' | 'default';
  replacementPolicyTier: 'eth_copytrade_normal' | 'eth_copytrade_turbo' | 'default';
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
      replacementScheduleMs: isTurbo ? [900, 3000] : [1500, 5000],
      replacementBumpBps: isTurbo ? [26000, 34000] : [22000, 30000],
      priorityMultiplierBps: isTurbo ? 30000 : 25000,
      maxFeeMultiplierBps: isTurbo ? 30000 : 25000,
      minPriorityFeeWei: 2_000_000_000n,
      maxPriorityFeeWei: isTurbo ? 12_000_000_000n : 8_000_000_000n,
      gasPolicyTier: isTurbo ? 'eth_copytrade_turbo' : 'eth_copytrade_normal',
      replacementPolicyTier: isTurbo ? 'eth_copytrade_turbo' : 'eth_copytrade_normal',
      reasonCode: 'ETH_FEE_POLICY_AGGRESSIVE',
    };
  }

  return {
    gasPolicyTier: 'default',
    replacementPolicyTier: 'default',
    reasonCode: 'DEFAULT_FEE_POLICY',
  };
}
