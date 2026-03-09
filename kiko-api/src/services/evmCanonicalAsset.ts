const NATIVE_PSEUDO = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const WRAPPED_NATIVE_BY_CHAIN: Record<number, string> = {
  1: '0xc02aa39b223fe8d0a0e5c4f27ead9083c756cc2',
  10: '0x4200000000000000000000000000000000000006',
  56: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  137: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
};

const EXTRA_NATIVE_ALIASES_BY_CHAIN: Record<number, string[]> = {
  8453: ['0x000000000d564d5be76f7f0d28fe52605afc7cf8'],
};

const EXTRA_NATIVE_ALIASES_BY_WRAPPED: Record<string, string[]> = {
  '0x4200000000000000000000000000000000000006': ['0x000000000d564d5be76f7f0d28fe52605afc7cf8'],
};

export interface CanonicalAssetIdentity {
  chainId: number;
  original: string;
  normalized: string;
  wrappedNativeAddress: string | null;
  nativeAliasSet: string[];
  isNativeLike: boolean;
}

function normalizeLower(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function getWrappedNativeAddressForChain(chainId: number, wrappedNativeAddress?: string): string | null {
  const explicit = normalizeLower(wrappedNativeAddress);
  if (explicit) return explicit;
  return WRAPPED_NATIVE_BY_CHAIN[chainId] || null;
}

export function getNativeAliasSetForChain(chainId: number, wrappedNativeAddress?: string): string[] {
  const wrapped = getWrappedNativeAddressForChain(chainId, wrappedNativeAddress);
  const aliases = new Set<string>([
    NATIVE_PSEUDO,
    ZERO_ADDRESS,
    ...(EXTRA_NATIVE_ALIASES_BY_CHAIN[chainId] || []),
  ]);
  if (wrapped) {
    for (const alias of EXTRA_NATIVE_ALIASES_BY_WRAPPED[wrapped] || []) aliases.add(alias);
  }
  if (wrapped) aliases.add(wrapped);
  return Array.from(aliases);
}

export function getCanonicalAssetIdentity(
  chainId: number,
  token: string,
  wrappedNativeAddress?: string,
): CanonicalAssetIdentity {
  const original = normalizeLower(token);
  const wrapped = getWrappedNativeAddressForChain(chainId, wrappedNativeAddress);
  const nativeAliasSet = getNativeAliasSetForChain(chainId, wrappedNativeAddress);
  const isNativeLike = original ? nativeAliasSet.includes(original) : false;
  return {
    chainId,
    original,
    normalized: isNativeLike ? (wrapped || original) : original,
    wrappedNativeAddress: wrapped,
    nativeAliasSet,
    isNativeLike,
  };
}

export function normalizeCanonicalEvmAsset(chainId: number, token: string, wrappedNativeAddress?: string): string {
  return getCanonicalAssetIdentity(chainId, token, wrappedNativeAddress).normalized;
}
