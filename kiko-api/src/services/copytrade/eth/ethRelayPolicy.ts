export type EthCopytradeRelayPolicy = {
  mevProtection: boolean;
  reasonCode: 'ETH_PRIVATE_RELAY_ENABLED' | 'DEFAULT_RELAY_POLICY';
};

export function resolveEthCopytradeRelayPolicy(params: {
  chainId: number;
  mode: 'copytrade' | 'fast-swap' | 'swap-card' | 'allowance' | 'launchpad';
  executionMode?: 'safe' | 'normal' | 'turbo';
}): EthCopytradeRelayPolicy {
  if (params.chainId === 1 && params.mode === 'copytrade') {
    return {
      mevProtection: true,
      reasonCode: 'ETH_PRIVATE_RELAY_ENABLED',
    };
  }

  return {
    mevProtection: params.mode === 'fast-swap',
    reasonCode: 'DEFAULT_RELAY_POLICY',
  };
}
