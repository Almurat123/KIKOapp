export type CopyTradeLatencyLimits = {
  maxDelayMs: number;
  hardMaxDelayMs: number;
  policyName: 'default' | 'eth_mainnet_latency_first';
};

const ETH_COPYTRADE_MAX_DELAY_MS = Number(process.env.ETH_COPYTRADE_MAX_DELAY_MS || '2500');
const ETH_COPYTRADE_HARD_MAX_DELAY_MS = Number(process.env.ETH_COPYTRADE_HARD_MAX_DELAY_MS || '8000');

export function resolveCopyTradeLatencyLimits(params: {
  chainId?: number;
  turboMode: boolean;
  defaultMaxDelayMs: number;
  defaultHardMaxDelayMs: number;
}): CopyTradeLatencyLimits {
  // Production-grade behavior: only the turbo path should hard-optimize for
  // ultra-low ETH latency. Normal mode should prefer execution completeness
  // and only respect the broader stale-signal limits provided by the caller.
  if (params.chainId === 1 && params.turboMode) {
    return {
      maxDelayMs: ETH_COPYTRADE_MAX_DELAY_MS,
      hardMaxDelayMs: Math.max(ETH_COPYTRADE_HARD_MAX_DELAY_MS, ETH_COPYTRADE_MAX_DELAY_MS),
      policyName: 'eth_mainnet_latency_first',
    };
  }

  return {
    maxDelayMs: params.defaultMaxDelayMs,
    hardMaxDelayMs: params.defaultHardMaxDelayMs,
    policyName: 'default',
  };
}
