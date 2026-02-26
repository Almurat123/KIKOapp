import type { DexStrategy, DirectSwapHint } from '../../directSwapTypes.js';
import type { DirectSwapResult } from '../types.js';

export const WETH_ADDRESSES: Record<number, string> = {
  8453: '0x4200000000000000000000000000000000000006',
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
};

export const ZORA_TOKEN_ADDRESSES: Record<number, string> = {
  8453: '0x1111111111166b7fe7bd91427724b487980afc69'
};

export const VIRTUAL_TOKEN_ADDRESSES: Record<number, string> = {
  8453: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b'
};

export const STABLE_TOKEN_HINTS_BY_CHAIN: Record<number, string[]> = {
  8453: [
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    '0xfde4c96c8593536e31f229ea8f37b2adabf6a27b'
  ],
  56: [
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    '0xe9e7cea3dedca5984780bafc599bd69add087d56'
  ],
  1: [
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0xdac17f958d2ee523a2206206994597c13d831ec7'
  ],
  137: [
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
  ],
  42161: [
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'
  ],
  10: [
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    '0x94b008aa00579c1307b0ef2b499ad98a8ce58e58'
  ]
};

const TURBO_USD_DEPTH_TIERS: Array<{ maxUsd: number; multiplier: number }> = [
  { maxUsd: 100, multiplier: 100 },
  { maxUsd: 1000, multiplier: 60 },
  { maxUsd: 5000, multiplier: 30 },
  { maxUsd: Number.POSITIVE_INFINITY, multiplier: 15 }
];

export function createDirectSwapTraceId(chainId: number, hint?: DirectSwapHint): string {
  const source = (hint?.sourceTxHash || 'nohint').slice(2, 10);
  return `${chainId}-${source}-${Date.now().toString(36).slice(-6)}`;
}

export function providerToStrategy(provider: DirectSwapResult['provider'], chainId: number): DexStrategy | null {
  switch (provider) {
    case 'uniswap-v4':
      return { kind: 'v4', dex: chainId === 56 ? 'pancake' : 'uniswap' };
    case 'pancake-infinity':
      return { kind: 'infinity', dex: 'pancake-infinity' };
    case 'uniswap-v3':
      return { kind: 'v3', dex: 'uniswap' };
    case 'pancake-v3':
      return { kind: 'v3', dex: 'pancake' };
    case 'uniswap-v2':
      return { kind: 'v2', dex: 'uniswap' };
    case 'pancake-v2':
      return { kind: 'v2', dex: 'pancake' };
    case 'aerodrome':
      return { kind: 'aerodrome', dex: 'aerodrome' };
    case 'zora-sdk':
      return { kind: 'zora-sdk', dex: 'uniswap' };
    default:
      return null;
  }
}

export function getTxExecutionProfile(chainId: number): 'default' | 'base-sniper' | 'bsc-sniper' {
  if (chainId === 8453) return 'base-sniper';
  if (chainId === 56) return 'bsc-sniper';
  return 'default';
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function withAbortableTimeout<T>(
  runner: (signal: AbortSignal) => Promise<T>,
  ms: number
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      runner(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`timeout_${ms}ms`));
        }, ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getChainSlugForUsdLookup(chainId: number): string {
  if (chainId === 8453) return 'base';
  if (chainId === 1) return 'eth';
  if (chainId === 56) return 'bsc';
  if (chainId === 137) return 'polygon';
  if (chainId === 42161) return 'arbitrum';
  if (chainId === 10) return 'optimism';
  return '';
}

export function isStableTokenAddress(chainId: number, tokenAddress: string): boolean {
  const normalized = tokenAddress.toLowerCase();
  return (STABLE_TOKEN_HINTS_BY_CHAIN[chainId] || []).includes(normalized);
}

export function pickDepthMultiplierByUsd(effectiveAmountUsd: number): number {
  if (!Number.isFinite(effectiveAmountUsd) || effectiveAmountUsd <= 0) {
    return TURBO_USD_DEPTH_TIERS[0].multiplier;
  }
  for (const tier of TURBO_USD_DEPTH_TIERS) {
    if (effectiveAmountUsd <= tier.maxUsd) return tier.multiplier;
  }
  return TURBO_USD_DEPTH_TIERS[TURBO_USD_DEPTH_TIERS.length - 1].multiplier;
}

export function isBuySideStableOrNativeIn(chainId: number, tokenIn: string): boolean {
  const normalized = tokenIn.toLowerCase();
  const nativePseudo = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const wrappedNative = (WETH_ADDRESSES[chainId] || '').toLowerCase();
  if (normalized === nativePseudo) return true;
  if (wrappedNative && normalized === wrappedNative) return true;
  return isStableTokenAddress(chainId, normalized);
}
