export type CopytradeLifecycleState =
  | 'DETECTED'
  | 'VALIDATED'
  | 'BUY_SUBMITTING'
  | 'BUY_ACCEPTED'
  | 'BUY_CONFIRMED_OPEN'
  | 'EXIT_ARMED'
  | 'EXIT_SUBMITTING'
  | 'EXIT_ACCEPTED'
  | 'EXIT_CONFIRMED_CLOSED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_TERMINAL'
  | 'DEFERRED'
  | 'QUARANTINED';

export type CopytradeLifecycleEvent =
  | 'DETECTED'
  | 'VALIDATE'
  | 'BUY_SUBMIT'
  | 'BUY_ACCEPT'
  | 'BUY_CONFIRM_OPEN'
  | 'ARM_EXIT'
  | 'EXIT_SUBMIT'
  | 'EXIT_ACCEPT'
  | 'EXIT_CONFIRM_CLOSED'
  | 'DEFER'
  | 'QUARANTINE'
  | 'FAIL_RETRYABLE'
  | 'FAIL_TERMINAL'
  | 'RETRY';

export type CopytradeReasonCode =
  | 'ok_detected'
  | 'ok_validated'
  | 'ok_buy_submitted'
  | 'ok_buy_accepted'
  | 'ok_buy_confirmed_open'
  | 'ok_exit_armed'
  | 'ok_exit_submitted'
  | 'ok_exit_accepted'
  | 'ok_exit_confirmed_closed'
  | 'ok_retry_scheduled'
  | 'ingress_deduped'
  | 'ingress_invalid_swap'
  | 'ingress_missing_identity'
  | 'validation_low_confidence'
  | 'validation_direction_conflict'
  | 'validation_unroutable'
  | 'deferred_retry_later'
  | 'deferred_confirmation_pending'
  | 'quarantined_policy'
  | 'quarantine_direction_conflict'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'failed_retry_budget_exhausted'
  | 'trading_execution_failed'
  | 'trading_execution_uncertain'
  | 'invalid_transition';

export interface CopytradeTransitionInput {
  current: CopytradeLifecycleState;
  event: CopytradeLifecycleEvent;
  reasonCode?: CopytradeReasonCode;
}

export interface CopytradeTransitionDecision {
  next: CopytradeLifecycleState;
  accepted: boolean;
  reasonCode: CopytradeReasonCode;
}

const ALLOWED_TRANSITIONS: Record<
  CopytradeLifecycleState,
  Partial<Record<CopytradeLifecycleEvent, CopytradeLifecycleState>>
> = {
  DETECTED: {
    VALIDATE: 'VALIDATED',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  VALIDATED: {
    BUY_SUBMIT: 'BUY_SUBMITTING',
    ARM_EXIT: 'EXIT_ARMED',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_RETRYABLE: 'FAILED_RETRYABLE',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  BUY_SUBMITTING: {
    BUY_ACCEPT: 'BUY_ACCEPTED',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_RETRYABLE: 'FAILED_RETRYABLE',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  BUY_ACCEPTED: {
    BUY_CONFIRM_OPEN: 'BUY_CONFIRMED_OPEN',
    ARM_EXIT: 'EXIT_ARMED',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_RETRYABLE: 'FAILED_RETRYABLE',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  BUY_CONFIRMED_OPEN: {
    ARM_EXIT: 'EXIT_ARMED',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_RETRYABLE: 'FAILED_RETRYABLE',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  EXIT_ARMED: {
    EXIT_SUBMIT: 'EXIT_SUBMITTING',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_RETRYABLE: 'FAILED_RETRYABLE',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  EXIT_SUBMITTING: {
    EXIT_ACCEPT: 'EXIT_ACCEPTED',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_RETRYABLE: 'FAILED_RETRYABLE',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  EXIT_ACCEPTED: {
    EXIT_CONFIRM_CLOSED: 'EXIT_CONFIRMED_CLOSED',
    DEFER: 'DEFERRED',
    QUARANTINE: 'QUARANTINED',
    FAIL_RETRYABLE: 'FAILED_RETRYABLE',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  EXIT_CONFIRMED_CLOSED: {},
  FAILED_RETRYABLE: {
    RETRY: 'VALIDATED',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  FAILED_TERMINAL: {},
  DEFERRED: {
    RETRY: 'VALIDATED',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
  QUARANTINED: {
    RETRY: 'VALIDATED',
    FAIL_TERMINAL: 'FAILED_TERMINAL',
  },
};

function defaultReasonCode(event: CopytradeLifecycleEvent): CopytradeReasonCode {
  switch (event) {
    case 'VALIDATE':
      return 'ok_validated';
    case 'BUY_SUBMIT':
      return 'ok_buy_submitted';
    case 'BUY_ACCEPT':
      return 'ok_buy_accepted';
    case 'BUY_CONFIRM_OPEN':
      return 'ok_buy_confirmed_open';
    case 'ARM_EXIT':
      return 'ok_exit_armed';
    case 'EXIT_SUBMIT':
      return 'ok_exit_submitted';
    case 'EXIT_ACCEPT':
      return 'ok_exit_accepted';
    case 'EXIT_CONFIRM_CLOSED':
      return 'ok_exit_confirmed_closed';
    case 'DEFER':
      return 'deferred_retry_later';
    case 'QUARANTINE':
      return 'quarantined_policy';
    case 'FAIL_RETRYABLE':
      return 'failed_retryable';
    case 'FAIL_TERMINAL':
      return 'failed_terminal';
    case 'RETRY':
      return 'ok_retry_scheduled';
    default:
      return 'ok_detected';
  }
}

export function resolveLifecycleTransition(input: CopytradeTransitionInput): CopytradeTransitionDecision {
  const allowed = ALLOWED_TRANSITIONS[input.current] || {};
  const next = allowed[input.event];
  if (!next) {
    return {
      next: input.current,
      accepted: false,
      reasonCode: 'invalid_transition',
    };
  }

  return {
    next,
    accepted: true,
    reasonCode: input.reasonCode || defaultReasonCode(input.event),
  };
}

export function isTerminalState(state: CopytradeLifecycleState): boolean {
  return state === 'EXIT_CONFIRMED_CLOSED' || state === 'FAILED_TERMINAL';
}
