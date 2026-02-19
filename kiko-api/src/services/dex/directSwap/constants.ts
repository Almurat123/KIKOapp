import type { DexStrategy } from './types.js';

export const DIRECT_SWAP_SUPPORTED_CHAINS = [1, 56, 8453] as const;

// Keep the chain strategy map centralized for future pluggable pool/turbo work.
export const CHAIN_STRATEGIES: Record<number, DexStrategy[]> = {
  8453: [
    { kind: 'v4', dex: 'uniswap' },
    { kind: 'virtual-bridge', dex: 'uniswap' },
    { kind: 'zora-sdk', dex: 'uniswap' },
    { kind: 'v3', dex: 'uniswap' },
    { kind: 'aerodrome', dex: 'aerodrome' },
    { kind: 'v2', dex: 'uniswap' }
  ],
  56: [
    { kind: 'v3', dex: 'pancake' },
    { kind: 'infinity', dex: 'pancake-infinity' },
    { kind: 'v2', dex: 'pancake' }
  ],
  1: [
    { kind: 'v3', dex: 'uniswap' },
    { kind: 'v2', dex: 'uniswap' },
    { kind: 'v4', dex: 'uniswap' }
  ]
};

function parseChainAddressMap(raw?: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const token of String(raw || '').split(',')) {
    const part = token.trim();
    if (!part) continue;
    const [chainRaw, addressRaw] = part.split(':');
    const chainId = Number(chainRaw);
    const address = String(addressRaw || '').trim().toLowerCase();
    if (!Number.isFinite(chainId) || chainId <= 0) continue;
    if (!/^0x[a-f0-9]{40}$/.test(address)) continue;
    out[chainId] = address;
  }
  return out;
}

// Official Uniswap V4 PoolManager addresses by chain
// [Ref]: https://docs.uniswap.org/contracts/v4/deployments
const DEFAULT_UNISWAP_V4_POOL_MANAGER_BY_CHAIN: Record<number, string> = {
  1:    '0x000000000004444c5dc75cb358380d2e3de08a90', // Ethereum
  8453: '0x498581ff718922c3f8e6a244956af099b2652b2b', // Base (correct address)
  56:   '0x28e2ea090877bf75740558f6bfb36a5ffee9e9df', // BSC
  42161:'0x360e68faccca8ca495c1b759fd9eee466db9fb32', // Arbitrum
  10:   '0x9a13f98cb987694c9f086b1f5eb990eea8264ec3', // Optimism
};

// Official Uniswap V4 Quoter addresses by chain
// [Ref]: https://docs.uniswap.org/contracts/v4/deployments
const DEFAULT_V4_QUOTER_ADDRESSES: Record<number, string> = {
  1:    '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203', // Ethereum
  8453: '0x0d5e0f971ed27fbff6c2837bf31316121532048d', // Base
  56:   '0x9f75dd27d6664c475b90e105573e550ff69437b0', // BSC
  42161:'0x3972c00f7ed4885e145823eb7c655375d275a1c5', // Arbitrum
  10:   '0x1f3131a13296fb91c90870043742c3cdbff1a8d7', // Optimism
};

export const V4_QUOTER_ADDRESSES: Record<number, string> = {
  ...DEFAULT_V4_QUOTER_ADDRESSES,
  ...parseChainAddressMap(process.env.DIRECT_SWAP_V4_QUOTER_ADDRESSES)
};

export const DOPPLER_LENS_QUOTER_ADDRESSES: Record<number, string> = {
  ...parseChainAddressMap(process.env.DIRECT_SWAP_DOPPLER_LENS_ADDRESSES)
};

export const UNISWAP_V4_POOL_MANAGER_BY_CHAIN: Record<number, string> = {
  ...DEFAULT_UNISWAP_V4_POOL_MANAGER_BY_CHAIN,
  ...parseChainAddressMap(process.env.DIRECT_SWAP_V4_POOL_MANAGER_ADDRESSES)
};
