import { normalizeCanonicalEvmAsset } from '../../../evmCanonicalAsset.js';

export function normalizePairTokenForHint(token: string, wrappedNativeAddress?: string): string {
  return normalizeCanonicalEvmAsset(0, token, wrappedNativeAddress);
}

export function isSameHintPair(
  tokenA: string,
  tokenB: string,
  tokenX: string,
  tokenY: string,
  wrappedNativeAddress?: string
): boolean {
  const a = normalizePairTokenForHint(tokenA, wrappedNativeAddress);
  const b = normalizePairTokenForHint(tokenB, wrappedNativeAddress);
  const x = normalizePairTokenForHint(tokenX, wrappedNativeAddress);
  const y = normalizePairTokenForHint(tokenY, wrappedNativeAddress);
  if (!a || !b || !x || !y) return false;
  return (a === x && b === y) || (a === y && b === x);
}
