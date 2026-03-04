import { buildCopytradeCommand } from './copytradeCommandBuilder.js';
import type {
  CopytradeDomainEvent,
  CopytradeLifecycleState,
  CopytradeStateContext,
  CopytradeTransitionDecision,
} from './copytradeStateTypes.js';

function currentState(input: CopytradeStateContext): CopytradeLifecycleState {
  return input.currentState || 'TARGET_BUY_DETECTED';
}

export function resolveCopytradeTransition(
  context: CopytradeStateContext,
  event: CopytradeDomainEvent,
): CopytradeTransitionDecision {
  const state = currentState(context);

  switch (event.type) {
    case 'TARGET_BUY_DETECTED':
      return {
        nextState: 'TARGET_BUY_DETECTED',
        reasonCode: 'target_buy_detected',
        commands: [buildCopytradeCommand('SUBMIT_BUY', 'target_buy_detected')],
      };
    case 'BUY_SUBMIT_REQUESTED':
      return {
        nextState: 'FOLLOWER_BUY_SUBMITTING',
        reasonCode: 'buy_submit_requested',
        commands: [buildCopytradeCommand('SUBMIT_BUY', 'buy_submit_requested')],
      };
    case 'BUY_TX_ACCEPTED':
      return {
        nextState: 'FOLLOWER_BUY_AWAITING_CONFIRMATION',
        reasonCode: 'buy_tx_accepted',
        commands: [buildCopytradeCommand('WRITE_PENDING_LEDGER', 'buy_tx_accepted')],
      };
    case 'BUY_TX_CONFIRMED_SUCCESS':
      if (state === 'FOLLOWER_EXIT_ARMED' || context.targetFullExitVerified) {
        return {
          nextState: 'FOLLOWER_EXIT_ARMED',
          reasonCode: 'buy_confirmed_target_already_exited',
          commands: [buildCopytradeCommand('SUBMIT_EXIT', 'buy_confirmed_target_already_exited')],
        };
      }
      return {
        nextState: 'FOLLOWER_OPEN',
        reasonCode: 'buy_confirmed_success',
        commands: [buildCopytradeCommand('PROMOTE_OPEN', 'buy_confirmed_success')],
      };
    case 'BUY_TX_CONFIRMED_FAILED':
      return {
        nextState: 'FOLLOWER_EXIT_FAILED_TERMINAL',
        reasonCode: 'buy_confirmed_failed',
        commands: [buildCopytradeCommand('MARK_TERMINAL_FAILURE', 'buy_confirmed_failed')],
      };
    case 'TARGET_FULL_EXIT_VERIFIED':
      return {
        nextState: 'FOLLOWER_EXIT_ARMED',
        reasonCode: 'target_full_exit_verified',
        commands: [buildCopytradeCommand('ARM_EXIT', 'target_full_exit_verified')],
      };
    case 'EXIT_SUBMIT_REQUESTED':
      return {
        nextState: 'FOLLOWER_EXIT_SUBMITTING',
        reasonCode: 'exit_submit_requested',
        commands: [buildCopytradeCommand('SUBMIT_EXIT', 'exit_submit_requested')],
      };
    case 'EXIT_TX_ACCEPTED':
      return {
        nextState: 'FOLLOWER_EXIT_AWAITING_CONFIRMATION',
        reasonCode: 'exit_tx_accepted',
        commands: [buildCopytradeCommand('EMIT_NOTIFICATION', 'exit_tx_accepted')],
      };
    case 'EXIT_TX_CONFIRMED_SUCCESS':
      if ((context.openPositionCount || 0) > 0) {
        return {
          nextState: 'FOLLOWER_CLOSED',
          reasonCode: 'exit_confirmed_success',
          commands: [buildCopytradeCommand('CLOSE_LEDGER', 'exit_confirmed_success')],
        };
      }
      return {
        nextState: 'FOLLOWER_CLOSED_BEFORE_OPEN',
        reasonCode: 'exit_confirmed_closed_before_open',
        commands: [buildCopytradeCommand('CLOSE_LEDGER', 'exit_confirmed_closed_before_open')],
      };
    case 'EXIT_TX_CONFIRMED_FAILED':
      if (event.retryable) {
        return {
          nextState: 'FOLLOWER_EXIT_FAILED_RETRYABLE',
          reasonCode: 'exit_confirmed_failed_retryable',
          commands: [buildCopytradeCommand('MARK_RETRYABLE_FAILURE', 'exit_confirmed_failed_retryable')],
        };
      }
      return {
        nextState: 'FOLLOWER_EXIT_FAILED_TERMINAL',
        reasonCode: 'exit_confirmed_failed_terminal',
        commands: [buildCopytradeCommand('MARK_TERMINAL_FAILURE', 'exit_confirmed_failed_terminal')],
      };
    case 'RETRY_TICK':
      return {
        nextState: state === 'FOLLOWER_EXIT_FAILED_RETRYABLE' ? 'FOLLOWER_EXIT_SUBMITTING' : state,
        reasonCode: state === 'FOLLOWER_EXIT_FAILED_RETRYABLE' ? 'retry_tick_submit_exit' : 'retry_tick_noop',
        commands: [
          buildCopytradeCommand(
            state === 'FOLLOWER_EXIT_FAILED_RETRYABLE' ? 'SUBMIT_EXIT' : 'NOOP',
            state === 'FOLLOWER_EXIT_FAILED_RETRYABLE' ? 'retry_tick_submit_exit' : 'retry_tick_noop',
          ),
        ],
      };
    case 'TARGET_SELL_DETECTED':
    case 'RECONCILE_TICK':
    default:
      return {
        nextState: state,
        reasonCode: `${event.type.toLowerCase()}_noop`,
        commands: [buildCopytradeCommand('NOOP', `${event.type.toLowerCase()}_noop`)],
      };
  }
}
