import type { TokenSearchResult } from './geckoTerminal.js';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function hasNonTrivialString(value: unknown, maxLen: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLen;
}

function isEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

function isSolanaAddress(address: string): boolean {
  // Base58, usually 32-44 chars, no 0/O/I/l.
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isReasonableTimestamp(ts?: string): boolean {
  if (!ts) return true;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return false;
  // Allow up to 1h clock skew in future.
  return ms <= Date.now() + 60 * 60 * 1000;
}

export type TrendingValidationResult = {
  ok: boolean;
  reason?: string;
};

/**
 * Zero-cost validation (no extra API calls).
 * Goal: keep the list stable and avoid obvious junk entries before "listing" (saving/serving).
 */
export function validateTrendingTokenForListing(
  chainId: string,
  token: TokenSearchResult
): TrendingValidationResult {
  if (!token || typeof token !== 'object') return { ok: false, reason: 'invalid_object' };

  if (!hasNonTrivialString(token.address, 64)) return { ok: false, reason: 'missing_address' };
  if (!hasNonTrivialString(token.symbol, 24)) return { ok: false, reason: 'missing_symbol' };
  if (!hasNonTrivialString(token.name, 80)) return { ok: false, reason: 'missing_name' };

  const chain = chainId.toLowerCase();
  if (chain === 'solana') {
    if (!isSolanaAddress(token.address)) return { ok: false, reason: 'bad_address' };
  } else {
    if (!isEvmAddress(token.address)) return { ok: false, reason: 'bad_address' };
  }

  if (!isReasonableTimestamp(token.poolCreatedAt)) return { ok: false, reason: 'bad_pool_created_at' };

  const liquidity = toNumber(token.liquidity);
  if (!Number.isFinite(liquidity) || liquidity <= 0) return { ok: false, reason: 'non_positive_liquidity' };

  const price = toNumber(token.price);
  if (Number.isFinite(price) && price < 0) return { ok: false, reason: 'negative_price' };

  const volume24h = toNumber(token.volume24h);
  if (Number.isFinite(volume24h) && volume24h < 0) return { ok: false, reason: 'negative_volume' };

  const txns24h = toNumber(token.txns24h);
  if (Number.isFinite(txns24h) && txns24h < 0) return { ok: false, reason: 'negative_txns' };

  return { ok: true };
}

