// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Mina Zhou
// Reason: DirectSwap 的链支持和策略优先级之前只体现在常量值里，缺少 owner
//         层说明，后续模型容易把“地址已知”“链已支持”“某策略已启用”混成一件事。
// Goal: 让 DirectSwap 的产品启用边界、默认策略排序和官方 v4 只读地址映射在
//       同一 owner 层显式可读，避免误开执行范围。
// Owns: DirectSwap 默认支持链、每条链的策略优先级、v4 Quoter/PoolManager 官方
//       只读地址映射，以及环境变量覆盖入口。
// Does Not Own: v4 Universal Router 交易发送、hook capability 判定、或具体池发现。
// Design Language:
// - 官方部署地址表与产品启用边界必须分开表达。
// - 新增链支持时先改产品边界，再决定是否启用对应策略。
// - 环境变量覆盖只用于地址覆盖，不用于隐式扩大产品支持范围。
// Document Provenance:
// - Source: Uniswap v4 deployments
// - Kind: official API doc
// - Retrieved: 2026-04-11
// - Applied To: `DEFAULT_UNISWAP_V4_POOL_MANAGER_BY_CHAIN` and `DEFAULT_V4_QUOTER_ADDRESSES`
// - Verification: verified in docs
// - Source: DirectSwap execution-boundary audit
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: `DIRECT_SWAP_SUPPORTED_CHAINS` and `CHAIN_STRATEGIES` as product enablement truth
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/directswap-v4-hook-provenance.md
// - /Users/almurat/KiKo/system-journal/owner-map/backend-swap-validation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-directswap-v4-hook-provenance-audit.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import type { DexStrategy } from './types.js';

// Product enablement boundary for DirectSwap.
export const DIRECT_SWAP_SUPPORTED_CHAINS = [1, 56, 8453] as const;

// Default strategy ordering per enabled chain.
// This is product policy, not an upstream deployment fact.
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
