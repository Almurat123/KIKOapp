import { ethers } from 'ethers';

export interface SolanaExitAmountLike {
  entryAmountExact?: string | null;
  entryAmountDec?: string | number | { toString(): string } | null;
  entryAmount?: string | null;
}

export interface SolanaDbBalanceFallbackResult {
  balanceRaw: bigint;
  decimals: number;
  usedSource: 'entryAmountExact' | 'entryAmountDec' | 'entryAmount' | 'none';
}

function parseRawExact(value: unknown): bigint | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '0') return null;
  if (!/^[0-9]+$/.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function parseDecimalAmount(value: unknown, decimals: number): bigint | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '0') return null;
  try {
    const parsed = ethers.parseUnits(raw, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveSolanaDbBalanceFallback(params: {
  positions: SolanaExitAmountLike[];
  tokenDecimals?: number | null;
  fallbackDecimals?: number;
}): SolanaDbBalanceFallbackResult {
  const decimals = Number.isInteger(params.tokenDecimals as number)
    ? Number(params.tokenDecimals)
    : Number(params.fallbackDecimals || 6);

  let balanceRaw = 0n;

  for (const pos of params.positions) {
    const exact = parseRawExact(pos.entryAmountExact);
    if (exact) {
      balanceRaw += exact;
    }
  }
  if (balanceRaw > 0n) {
    return { balanceRaw, decimals, usedSource: 'entryAmountExact' };
  }

  for (const pos of params.positions) {
    const dec = parseDecimalAmount(pos.entryAmountDec, decimals);
    if (dec) {
      balanceRaw += dec;
    }
  }
  if (balanceRaw > 0n) {
    return { balanceRaw, decimals, usedSource: 'entryAmountDec' };
  }

  // Historical compatibility: old records may only have entryAmount populated.
  for (const pos of params.positions) {
    const legacy = parseDecimalAmount(pos.entryAmount, decimals);
    if (legacy) {
      balanceRaw += legacy;
    }
  }
  if (balanceRaw > 0n) {
    return { balanceRaw, decimals, usedSource: 'entryAmount' };
  }

  return { balanceRaw: 0n, decimals, usedSource: 'none' };
}
