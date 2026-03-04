import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { handleCopytradeStateEvent } from '../services/copytrade-v2/state/copytradeStateMachine.js';

describe('copytrade state machine', () => {
  test('buy confirmed success promotes open when target has not exited', () => {
    const decision = handleCopytradeStateEvent(
      {
        currentState: 'FOLLOWER_BUY_AWAITING_CONFIRMATION',
        openPositionCount: 0,
        targetFullExitVerified: false,
      },
      { type: 'BUY_TX_CONFIRMED_SUCCESS' },
    );

    assert.equal(decision.nextState, 'FOLLOWER_OPEN');
    assert.equal(decision.reasonCode, 'buy_confirmed_success');
    assert.deepEqual(decision.commands.map((entry) => entry.type), ['PROMOTE_OPEN']);
  });

  test('buy confirmed success arms exit when target already full-exited', () => {
    const decision = handleCopytradeStateEvent(
      {
        currentState: 'FOLLOWER_BUY_AWAITING_CONFIRMATION',
        openPositionCount: 0,
        targetFullExitVerified: true,
      },
      { type: 'BUY_TX_CONFIRMED_SUCCESS' },
    );

    assert.equal(decision.nextState, 'FOLLOWER_EXIT_ARMED');
    assert.equal(decision.reasonCode, 'buy_confirmed_target_already_exited');
    assert.deepEqual(decision.commands.map((entry) => entry.type), ['SUBMIT_EXIT']);
  });

  test('target full exit verified arms sell flow', () => {
    const decision = handleCopytradeStateEvent(
      {
        currentState: 'FOLLOWER_OPEN',
        openPositionCount: 1,
        targetFullExitVerified: true,
      },
      { type: 'TARGET_FULL_EXIT_VERIFIED' },
    );

    assert.equal(decision.nextState, 'FOLLOWER_EXIT_ARMED');
    assert.equal(decision.reasonCode, 'target_full_exit_verified');
    assert.deepEqual(decision.commands.map((entry) => entry.type), ['ARM_EXIT']);
  });

  test('retryable exit failure re-enters submit on retry tick', () => {
    const decision = handleCopytradeStateEvent(
      {
        currentState: 'FOLLOWER_EXIT_FAILED_RETRYABLE',
        openPositionCount: 1,
      },
      { type: 'RETRY_TICK' },
    );

    assert.equal(decision.nextState, 'FOLLOWER_EXIT_SUBMITTING');
    assert.equal(decision.reasonCode, 'retry_tick_submit_exit');
    assert.deepEqual(decision.commands.map((entry) => entry.type), ['SUBMIT_EXIT']);
  });

  test('exit success without open positions closes before open', () => {
    const decision = handleCopytradeStateEvent(
      {
        currentState: 'FOLLOWER_EXIT_AWAITING_CONFIRMATION',
        openPositionCount: 0,
      },
      { type: 'EXIT_TX_CONFIRMED_SUCCESS' },
    );

    assert.equal(decision.nextState, 'FOLLOWER_CLOSED_BEFORE_OPEN');
    assert.equal(decision.reasonCode, 'exit_confirmed_closed_before_open');
    assert.deepEqual(decision.commands.map((entry) => entry.type), ['CLOSE_LEDGER']);
  });
});
