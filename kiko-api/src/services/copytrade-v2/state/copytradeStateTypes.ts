export type CopytradeLifecycleState =
  | 'TARGET_BUY_DETECTED'
  | 'FOLLOWER_BUY_SUBMITTING'
  | 'FOLLOWER_BUY_ACCEPTED'
  | 'FOLLOWER_BUY_AWAITING_CONFIRMATION'
  | 'FOLLOWER_OPEN'
  | 'TARGET_FULL_EXIT_VERIFIED'
  | 'FOLLOWER_EXIT_ARMED'
  | 'FOLLOWER_EXIT_SUBMITTING'
  | 'FOLLOWER_EXIT_ACCEPTED'
  | 'FOLLOWER_EXIT_AWAITING_CONFIRMATION'
  | 'FOLLOWER_CLOSED'
  | 'FOLLOWER_CLOSED_BEFORE_OPEN'
  | 'FOLLOWER_EXIT_FAILED_RETRYABLE'
  | 'FOLLOWER_EXIT_FAILED_TERMINAL';

export type CopytradeDomainEventType =
  | 'TARGET_BUY_DETECTED'
  | 'TARGET_SELL_DETECTED'
  | 'BUY_SUBMIT_REQUESTED'
  | 'BUY_TX_ACCEPTED'
  | 'BUY_TX_CONFIRMED_SUCCESS'
  | 'BUY_TX_CONFIRMED_FAILED'
  | 'TARGET_FULL_EXIT_VERIFIED'
  | 'EXIT_SUBMIT_REQUESTED'
  | 'EXIT_TX_ACCEPTED'
  | 'EXIT_TX_CONFIRMED_SUCCESS'
  | 'EXIT_TX_CONFIRMED_FAILED'
  | 'RETRY_TICK'
  | 'RECONCILE_TICK';

export type CopytradeCommandType =
  | 'NOOP'
  | 'SUBMIT_BUY'
  | 'WRITE_PENDING_LEDGER'
  | 'PROMOTE_OPEN'
  | 'ARM_EXIT'
  | 'SUBMIT_EXIT'
  | 'CLOSE_LEDGER'
  | 'MARK_RETRYABLE_FAILURE'
  | 'MARK_TERMINAL_FAILURE'
  | 'EMIT_NOTIFICATION';

export interface CopytradeDomainEvent {
  type: CopytradeDomainEventType;
  retryable?: boolean;
}

export interface CopytradeCommand {
  type: CopytradeCommandType;
  reasonCode: string;
}

export interface CopytradeStateContext {
  currentState?: CopytradeLifecycleState | null;
  openPositionCount?: number;
  targetFullExitVerified?: boolean;
}

export interface CopytradeTransitionDecision {
  nextState: CopytradeLifecycleState;
  reasonCode: string;
  commands: CopytradeCommand[];
}
