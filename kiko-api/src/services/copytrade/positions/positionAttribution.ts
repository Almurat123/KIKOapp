import { ethers } from 'ethers';

export interface AttributedPositionLike {
  id: string;
  tokenAddress: string;
  chainId?: number;
  entryTxHash?: string | null;
  entryAmountExact?: string | null;
  entryAmountDec?: { toString(): string } | string | number | null;
}

export type PositionAttributionReasonCode =
  | 'ATTRIBUTED_AMOUNT_RESOLVED'
  | 'ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE'
  | 'NO_CONFIRMED_POSITIONS'
  | 'ATTRIBUTED_AMOUNT_UNAVAILABLE'
  | 'ONCHAIN_BALANCE_EMPTY'
  | 'FULL_BALANCE_FALLBACK';

export interface PositionAttributionResult<T extends AttributedPositionLike> {
  eligiblePositions: T[];
  excludedPositions: T[];
  attributedAmountRaw: bigint;
  sellAmountRaw: bigint;
  reasonCode: PositionAttributionReasonCode;
  metrics: {
    positionCountBefore: number;
    eligiblePositionCount: number;
    excludedPositionCount: number;
    onChainBalanceRaw: string;
    attributedAmountRaw: string;
    sellAmountRaw: string;
    hasExternalBalance: boolean;
  };
}

const INVALID_ENTRY_TX_PREFIXES = [
  'PENDING_',
  'RECOVERED_ONCHAIN_',
  'MANUAL_',
  'FAILED_',
];

function parseHumanAmount(
  exactValue: AttributedPositionLike['entryAmountExact'],
  decimalValue: AttributedPositionLike['entryAmountDec']
): string | null {
  const exact = exactValue === null || exactValue === undefined ? null : String(exactValue).trim();
  if (exact && exact !== '0') return exact;

  const value = decimalValue;
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'object' && 'toString' in value ? value.toString() : String(value);
  const normalized = raw.trim();
  if (!normalized || normalized === '0') return null;
  return normalized;
}

function parseAttributedAmountRaw(params: {
  exactValue: AttributedPositionLike['entryAmountExact'];
  decimalValue: AttributedPositionLike['entryAmountDec'];
  decimals: number;
}): bigint | null {
  const exact = parseHumanAmount(params.exactValue, null);
  const decimal = parseHumanAmount(null, params.decimalValue);

  if (exact && !exact.includes('.')) {
    try {
      const exactRaw = BigInt(exact);
      if (decimal) {
        const decimalRaw = ethers.parseUnits(decimal, params.decimals);
        const delta = exactRaw > decimalRaw ? exactRaw - decimalRaw : decimalRaw - exactRaw;
        const tolerance = (decimalRaw / 1_000_000n) + 10n;
        if (delta <= tolerance) {
          return exactRaw;
        }
      }
    } catch {
      // Fall through to decimal parsing.
    }
  }

  if (exact) {
    try {
      return ethers.parseUnits(exact, params.decimals);
    } catch {
      // Fall through to decimal helper.
    }
  }

  if (decimal) {
    try {
      return ethers.parseUnits(decimal, params.decimals);
    } catch {
      return null;
    }
  }

  return null;
}

export function isConfirmedAttributedPosition(position: AttributedPositionLike): boolean {
  const txHash = String(position.entryTxHash || '').trim();
  if (!txHash) return false;
  return !INVALID_ENTRY_TX_PREFIXES.some((prefix) => txHash.startsWith(prefix));
}

export function resolveAttributedPositionExitAmount<T extends AttributedPositionLike>(params: {
  positions: T[];
  decimals: number;
  onChainBalanceRaw: bigint;
  /** When true (mirror sell), if attribution fails but on-chain balance exists, sell the full balance */
  allowFullBalanceFallback?: boolean;
}): PositionAttributionResult<T> {
  const eligiblePositions: T[] = [];
  const excludedPositions: T[] = [];
  let attributedAmountRaw = 0n;

  for (const position of params.positions) {
    if (!isConfirmedAttributedPosition(position)) {
      excludedPositions.push(position);
      continue;
    }
    const amountRaw = parseAttributedAmountRaw({
      exactValue: position.entryAmountExact,
      decimalValue: position.entryAmountDec,
      decimals: params.decimals,
    });
    if (amountRaw === null || amountRaw <= 0n) {
      excludedPositions.push(position);
      continue;
    }
    attributedAmountRaw += amountRaw;
    eligiblePositions.push(position);
  }

  let reasonCode: PositionAttributionReasonCode = 'ATTRIBUTED_AMOUNT_RESOLVED';
  let sellAmountRaw = attributedAmountRaw;

  if (params.onChainBalanceRaw <= 0n) {
    sellAmountRaw = 0n;
    reasonCode = 'ONCHAIN_BALANCE_EMPTY';
  } else if (eligiblePositions.length === 0 && params.allowFullBalanceFallback && params.positions.length > 0) {
    // Mirror sell fallback: positions exist but none have confirmed entryAmountDec yet
    // (e.g. sell signal arrived while buy tx is still confirming on-chain).
    // Sell the full on-chain balance instead of skipping the sell entirely.
    sellAmountRaw = params.onChainBalanceRaw;
    reasonCode = 'FULL_BALANCE_FALLBACK';
    // Treat all passed positions as eligible for closure
    eligiblePositions.push(...excludedPositions.splice(0));
  } else if (eligiblePositions.length === 0) {
    sellAmountRaw = 0n;
    reasonCode = 'NO_CONFIRMED_POSITIONS';
  } else if (attributedAmountRaw <= 0n) {
    sellAmountRaw = 0n;
    reasonCode = 'ATTRIBUTED_AMOUNT_UNAVAILABLE';
  } else if (params.onChainBalanceRaw < attributedAmountRaw) {
    sellAmountRaw = params.onChainBalanceRaw;
    reasonCode = 'ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE';
  }

  return {
    eligiblePositions,
    excludedPositions,
    attributedAmountRaw,
    sellAmountRaw,
    reasonCode,
    metrics: {
      positionCountBefore: params.positions.length,
      eligiblePositionCount: eligiblePositions.length,
      excludedPositionCount: excludedPositions.length,
      onChainBalanceRaw: params.onChainBalanceRaw.toString(),
      attributedAmountRaw: attributedAmountRaw.toString(),
      sellAmountRaw: sellAmountRaw.toString(),
      hasExternalBalance: params.onChainBalanceRaw > attributedAmountRaw && attributedAmountRaw > 0n,
    },
  };
}
