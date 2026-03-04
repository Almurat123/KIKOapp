import { hasPositiveAttributionAmount } from './positionAttributionAmount.js';

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
  if (hasPositiveAttributionAmount(params.entryAmountExact)) {
    return { repairRequired: false, reasonCode: 'integrity_exact_amount_present' };
  }
  if (hasPositiveAttributionAmount(params.entryAmountDec)) {
    return { repairRequired: false, reasonCode: 'integrity_decimal_amount_present' };
  }
  if (hasPositiveLedgerAmount({ ledger: params.ledger })) {
    return { repairRequired: false, reasonCode: 'integrity_ledger_owned_amount_present' };
  }
  return { repairRequired: true, reasonCode: 'integrity_missing_entry_attribution' };
}
