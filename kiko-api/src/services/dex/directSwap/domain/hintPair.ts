const NATIVE_PSEUDO = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export function normalizePairTokenForHint(token: string, wrappedNativeAddress?: string): string {
  const normalized = String(token || '').toLowerCase();
  if (!normalized) return normalized;
  if (normalized === NATIVE_PSEUDO) {
    return String(wrappedNativeAddress || NATIVE_PSEUDO).toLowerCase();
  }
  return normalized;
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
