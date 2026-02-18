import type { Token } from '@/types/swap';

export const IMPORTED_TOKENS_STORAGE_KEY = 'kiko-swap-imported-tokens-v1';
export const IMPORTED_TOKENS_UPDATED_EVENT = 'kiko-swap-imported-tokens-updated';

export type ImportedSwapToken = Pick<Token, 'address' | 'symbol' | 'name' | 'decimals' | 'chainId' | 'logoUrl'>;

export function readImportedSwapTokensFromStorage(): Record<string, ImportedSwapToken[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(IMPORTED_TOKENS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ImportedSwapToken[]>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

export function writeImportedSwapTokensToStorage(tokensByChain: Record<string, ImportedSwapToken[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IMPORTED_TOKENS_STORAGE_KEY, JSON.stringify(tokensByChain));
  } catch {
    // Ignore persistence errors
  }
}

export function emitImportedTokensUpdated(chainId?: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(IMPORTED_TOKENS_UPDATED_EVENT, { detail: { chainId } }));
}
