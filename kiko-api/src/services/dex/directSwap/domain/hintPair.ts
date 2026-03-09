import { normalizeCanonicalEvmAsset } from '../../../evmCanonicalAsset.js';

export function normalizePairTokenForHint(token: string, wrappedNativeAddress?: string, chainId = 0): string {
  return normalizeCanonicalEvmAsset(chainId, token, wrappedNativeAddress);
}

export function isSameHintPair(
  tokenA: string,
  tokenB: string,
  tokenX: string,
  tokenY: string,
  wrappedNativeAddress?: string,
  chainId = 0
): boolean {
  const a = normalizePairTokenForHint(tokenA, wrappedNativeAddress, chainId);
  const b = normalizePairTokenForHint(tokenB, wrappedNativeAddress, chainId);
  const x = normalizePairTokenForHint(tokenX, wrappedNativeAddress, chainId);
  const y = normalizePairTokenForHint(tokenY, wrappedNativeAddress, chainId);
  if (!a || !b || !x || !y) return false;
  return (a === x && b === y) || (a === y && b === x);
}
