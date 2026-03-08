export type EthCopytradeRelayPolicy = {
  mevProtection: boolean;
  privateRelayEligible: boolean;
  relayTier: 'eth_private_relay_turbo' | 'eth_private_relay_opt_in' | 'default';
  reasonCode: 'ETH_PRIVATE_RELAY_ENABLED' | 'DEFAULT_RELAY_POLICY';
};

export function resolveEthCopytradeRelayPolicy(params: {
  chainId: number;
  mode: 'copytrade' | 'fast-swap' | 'swap-card' | 'allowance' | 'launchpad';
  executionMode?: 'safe' | 'normal' | 'turbo';
  mevProtection?: boolean;
}): EthCopytradeRelayPolicy {
  if (params.chainId === 1 && params.mode === 'copytrade') {
    const privateRelayEligible = params.executionMode === 'turbo' || params.mevProtection === true;
    return {
      mevProtection: privateRelayEligible,
      privateRelayEligible,
      relayTier: params.executionMode === 'turbo' ? 'eth_private_relay_turbo' : 'eth_private_relay_opt_in',
      reasonCode: 'ETH_PRIVATE_RELAY_ENABLED',
    };
  }

  return {
    mevProtection: params.mode === 'fast-swap',
    privateRelayEligible: params.mode === 'fast-swap',
    relayTier: 'default',
    reasonCode: 'DEFAULT_RELAY_POLICY',
  };
}
