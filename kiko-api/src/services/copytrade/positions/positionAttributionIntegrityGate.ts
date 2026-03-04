function hasPositiveDecimal(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  if (!normalized) return false;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return false;
  return Number(normalized) > 0;
}

function hasPositiveLedgerAmount(params: {
  ledger?: { metrics?: { effectiveOwnedAmountRaw?: bigint } } | null;
}): boolean {
  return (params.ledger?.metrics?.effectiveOwnedAmountRaw || 0n) > 0n;
}

export interface PositionAttributionIntegrityDecision {
  repairRequired: boolean;
  reasonCode: string;
}

export function evaluatePositionAttributionIntegrity(params: {
  entryAmountExact?: string | null;
  entryAmountDec?: unknown;
  ledger?: { metrics?: { effectiveOwnedAmountRaw?: bigint } } | null;
}): PositionAttributionIntegrityDecision {
  if (hasPositiveDecimal(params.entryAmountExact)) {
    return { repairRequired: false, reasonCode: 'integrity_exact_amount_present' };
  }
  if (hasPositiveDecimal(params.entryAmountDec)) {
    return { repairRequired: false, reasonCode: 'integrity_decimal_amount_present' };
  }
  if (hasPositiveLedgerAmount({ ledger: params.ledger })) {
    return { repairRequired: false, reasonCode: 'integrity_ledger_owned_amount_present' };
  }
  return { repairRequired: true, reasonCode: 'integrity_missing_entry_attribution' };
}
