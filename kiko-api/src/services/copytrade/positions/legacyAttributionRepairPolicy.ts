import { ethers } from 'ethers';

import type { PendingAttributedPositionLotLike } from './pendingAttributedPositionLedger.js';

export type LegacyAttributionRepairSource =
  | 'pending_lot_expected_dec'
  | 'pending_lot_expected_raw'
  | 'ledger_effective_owned_raw'
  | 'position_entry_amount';

export interface LegacyAttributionRepairDecision {
  shouldRepair: boolean;
  repairedExactAmount?: string;
  source?: LegacyAttributionRepairSource;
  reasonCode: string;
}

function normalizePositiveDecimal(value: unknown, maxFractionDigits = 18): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === '0') return null;
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(normalized)) return null;
  const [integerPart, fractionPart = ''] = normalized.split('.');
  const trimmedFraction = fractionPart.slice(0, Math.max(0, maxFractionDigits)).replace(/0+$/, '');
  const bounded = trimmedFraction ? `${integerPart}.${trimmedFraction}` : integerPart;
  try {
    return ethers.parseUnits(bounded, Math.max(0, maxFractionDigits)) > 0n ? bounded : null;
  } catch {
    return null;
  }
}

function normalizeRawToDecimal(value: unknown, decimals?: number | null): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === '0' || !/^[0-9]+$/.test(normalized)) return null;
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0) return null;
  try {
    const raw = BigInt(normalized);
    return raw > 0n ? ethers.formatUnits(raw, decimals) : null;
  } catch {
    return null;
  }
}

function pickRepairAmountFromPendingLots(params: {
  pendingLots: PendingAttributedPositionLotLike[];
  decimals?: number | null;
}): { amount: string; source: LegacyAttributionRepairSource } | null {
  for (const lot of params.pendingLots) {
    const dec = normalizePositiveDecimal(lot.expectedAmountDec, typeof params.decimals === 'number' ? params.decimals : 18);
    if (dec) return { amount: dec, source: 'pending_lot_expected_dec' };
  }
  for (const lot of params.pendingLots) {
    const dec = normalizeRawToDecimal(lot.expectedAmountRaw, params.decimals);
    if (dec) return { amount: dec, source: 'pending_lot_expected_raw' };
  }
  return null;
}

export function resolveLegacyAttributionRepair(params: {
  hasExactAmount: boolean;
  hasDecimalAmount: boolean;
  entryAmount?: string | null;
  pendingLots?: PendingAttributedPositionLotLike[];
  ledgerEffectiveOwnedAmountRaw?: bigint;
  decimals?: number | null;
}): LegacyAttributionRepairDecision {
  if (params.hasExactAmount || params.hasDecimalAmount) {
    return { shouldRepair: false, reasonCode: 'repair_not_needed' };
  }

  const pendingDecision = pickRepairAmountFromPendingLots({
    pendingLots: params.pendingLots || [],
    decimals: params.decimals,
  });
  if (pendingDecision) {
    return {
      shouldRepair: true,
      repairedExactAmount: pendingDecision.amount,
      source: pendingDecision.source,
      reasonCode: `repair_from_${pendingDecision.source}`,
    };
  }

  const ledgerDecimal = normalizeRawToDecimal(params.ledgerEffectiveOwnedAmountRaw?.toString(), params.decimals);
  if (ledgerDecimal) {
    return {
      shouldRepair: true,
      repairedExactAmount: ledgerDecimal,
      source: 'ledger_effective_owned_raw',
      reasonCode: 'repair_from_ledger_effective_owned_raw',
    };
  }

  const entryAmount = normalizePositiveDecimal(params.entryAmount, typeof params.decimals === 'number' ? params.decimals : 18);
  if (entryAmount) {
    return {
      shouldRepair: true,
      repairedExactAmount: entryAmount,
      source: 'position_entry_amount',
      reasonCode: 'repair_from_position_entry_amount',
    };
  }

  return {
    shouldRepair: false,
    reasonCode: 'repair_source_unavailable',
  };
}
