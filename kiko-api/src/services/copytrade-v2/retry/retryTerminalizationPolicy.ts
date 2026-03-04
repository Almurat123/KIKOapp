import type { PositionAttributionReasonCode } from '../positions/positionAttribution.js';

export interface RetryTerminalizationDecision {
  nextRetryCount: number;
  shouldTerminalize: boolean;
  reasonCode: string;
}

const DETERMINISTIC_NOT_SELLABLE = new Set<PositionAttributionReasonCode>([
  'NO_CONFIRMED_POSITIONS',
  'ATTRIBUTED_AMOUNT_UNAVAILABLE',
  'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
  'PENDING_BALANCE_NOT_VISIBLE_YET',
]);

export function resolveRetryTerminalization(params: {
  isRetryAttempt: boolean;
  attributedReasonCode?: string | null;
  existingRetryCount: number;
}): RetryTerminalizationDecision | null {
  if (!params.isRetryAttempt) return null;
  const attributedReasonCode = String(params.attributedReasonCode || '').trim() as PositionAttributionReasonCode;
  if (!DETERMINISTIC_NOT_SELLABLE.has(attributedReasonCode)) return null;
  const threshold = Math.max(2, Number(process.env.COPYTRADE_NOT_SELLABLE_RETRY_THRESHOLD || '3'));
  const nextRetryCount = params.existingRetryCount + 1;
  return {
    nextRetryCount,
    shouldTerminalize: nextRetryCount >= threshold,
    reasonCode: nextRetryCount >= threshold
      ? `deterministic_not_sellable_terminalized:${attributedReasonCode}`
      : `deterministic_not_sellable_retry:${attributedReasonCode}`,
  };
}
