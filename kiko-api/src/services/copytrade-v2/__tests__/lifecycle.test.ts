import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLifecycleTransition, type CopytradeLifecycleState } from '../contracts/lifecycle.js';

test('lifecycle: accepts canonical buy path transitions', () => {
  let state: CopytradeLifecycleState = 'DETECTED';

  const t1 = resolveLifecycleTransition({ current: state, event: 'VALIDATE' });
  assert.equal(t1.accepted, true);
  state = t1.next;

  const t2 = resolveLifecycleTransition({ current: state, event: 'BUY_SUBMIT' });
  assert.equal(t2.accepted, true);
  state = t2.next;

  const t3 = resolveLifecycleTransition({ current: state, event: 'BUY_ACCEPT' });
  assert.equal(t3.accepted, true);
  state = t3.next;

  const t4 = resolveLifecycleTransition({ current: state, event: 'BUY_CONFIRM_OPEN' });
  assert.equal(t4.accepted, true);
  assert.equal(t4.next, 'BUY_CONFIRMED_OPEN');
});

test('lifecycle: rejects invalid transition', () => {
  const decision = resolveLifecycleTransition({
    current: 'DETECTED',
    event: 'EXIT_SUBMIT',
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, 'invalid_transition');
  assert.equal(decision.next, 'DETECTED');
});

test('lifecycle: supports retry flow from failed_retryable', () => {
  const decision = resolveLifecycleTransition({
    current: 'FAILED_RETRYABLE',
    event: 'RETRY',
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.next, 'VALIDATED');
});
