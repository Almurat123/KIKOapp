import type { CopytradeLifecycleState, CopytradeReasonCode } from '../contracts/lifecycle.js';

export type CtIssueId = `CT-${string}`;
export type CtIssueFlow = 'order-flow' | 'trading-flow' | 'data-flow';

export interface CtIssueReproduction {
  trigger: string;
  expected: string;
  probe: string;
}

export interface CtIssueDefinition {
  id: CtIssueId;
  flow: CtIssueFlow;
  modeScope: 'turbo/normal/safety';
  title: string;
  fault: string;
  invariant: string;
  reasonCodes: CopytradeReasonCode[];
  lifecycleStates: CopytradeLifecycleState[];
  reproduction: CtIssueReproduction;
  relatedIds: CtIssueId[];
}

export interface CtIssueTrace {
  primaryIds: CtIssueId[];
  relatedIds: CtIssueId[];
  flows: CtIssueFlow[];
}

export function normalizeCtIssueId(input: unknown): CtIssueId | undefined {
  const raw = String(input || '').trim().toUpperCase();
  if (!/^CT-\d{3}$/.test(raw)) return undefined;
  return raw as CtIssueId;
}

export const ALL_COPYTRADE_REASON_CODES: CopytradeReasonCode[] = [
  'ok_detected',
  'ok_validated',
  'ok_buy_submitted',
  'ok_buy_accepted',
  'ok_buy_confirmed_open',
  'ok_exit_armed',
  'ok_exit_submitted',
  'ok_exit_accepted',
  'ok_exit_confirmed_closed',
  'ok_retry_scheduled',
  'ingress_deduped',
  'ingress_invalid_swap',
  'ingress_missing_identity',
  'validation_low_confidence',
  'validation_direction_conflict',
  'validation_unroutable',
  'deferred_retry_later',
  'deferred_confirmation_pending',
  'quarantined_policy',
  'quarantine_direction_conflict',
  'failed_retryable',
  'failed_terminal',
  'failed_retry_budget_exhausted',
  'trading_execution_failed',
  'trading_execution_uncertain',
  'invalid_transition',
];
