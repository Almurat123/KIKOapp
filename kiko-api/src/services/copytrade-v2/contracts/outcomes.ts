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

export interface CopytradeExecutionOutcome {
  status: CopytradeExecutionStatus;
  reasonCode: CopytradeReasonCode;
  retryable: boolean;
  txHash?: string | null;
  intent?: CopytradeExecutionIntent;
  durationMs?: number;
  metadata?: Record<string, unknown>;
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
