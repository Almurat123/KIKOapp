import type { CopytradeReasonCode } from './lifecycle.js';

export type CopytradeExecutionStatus =
  | 'accepted'
  | 'submitted'
  | 'confirmed'
  | 'deferred'
  | 'quarantined'
  | 'failed_retryable'
  | 'failed_terminal';

export type CopytradeExecutionIntent = 'buy' | 'exit';

export type CopytradeExecutionLifecycleStatus =
  | 'pending_broadcast'
  | 'broadcasted_unseen'
  | 'visible_pending'
  | 'confirmed_success'
  | 'confirmed_failed'
  | 'dropped_timeout'
  | 'unknown';

export type CopytradeExecutionVisibilityState = 'unknown' | 'unseen' | 'visible' | 'confirmed';
export type CopytradeExecutionFinalityHint = 'none' | 'confirmed_success' | 'confirmed_failed' | 'timeout_uncertain';

export interface CopytradeExecutionOutcome {
  status: CopytradeExecutionStatus;
  reasonCode: CopytradeReasonCode;
  retryable: boolean;
  sourceTxHash: string | null;
  txHash?: string | null;
  intent?: CopytradeExecutionIntent;
  durationMs?: number;
  lifecycleStatus?: CopytradeExecutionLifecycleStatus;
  visibilityState?: CopytradeExecutionVisibilityState;
  finalityHint?: CopytradeExecutionFinalityHint;
  metadata?: Record<string, unknown>;
}

export type CopytradeTxFinalityKind = 'confirmed_success' | 'confirmed_failed' | 'timeout_uncertain';

export interface CopytradeTxFinalityEvent {
  orderId: string;
  chainId: number;
  txHash: string;
  sourceTxHash: string | null;
  kind: CopytradeTxFinalityKind;
  reasonCode: CopytradeReasonCode;
  observedAt: Date;
}

export function isExecutionFailure(outcome: CopytradeExecutionOutcome): boolean {
  return outcome.status === 'failed_retryable' || outcome.status === 'failed_terminal';
}

export function isExecutionSuccess(outcome: CopytradeExecutionOutcome): boolean {
  return (
    outcome.status === 'accepted'
    || outcome.status === 'submitted'
    || outcome.status === 'confirmed'
  );
}
