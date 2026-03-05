import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNonceConflictDecision } from '../trading-flow/nonceConflictPolicy.js';

test('nonce policy: BSC nonce conflict uses mode-differentiated delays', () => {
  const error = new Error('nonce too low');

  const turbo = resolveNonceConflictDecision({
    error,
    chainId: 56,
    mode: 'turbo',
  });
  const normal = resolveNonceConflictDecision({
    error,
    chainId: 56,
    mode: 'normal',
  });
  const safety = resolveNonceConflictDecision({
    error,
    chainId: 56,
    mode: 'safety',
  });

  assert.equal(turbo.matched, true);
  assert.equal(normal.matched, true);
  assert.equal(safety.matched, true);
  assert.equal(turbo.retryDelayMs < normal.retryDelayMs, true);
  assert.equal(normal.retryDelayMs < safety.retryDelayMs, true);
  assert.equal(turbo.hint, 'nonce_too_low');
});

test('nonce policy: non-BSC chain does not trigger nonce strategy', () => {
  const decision = resolveNonceConflictDecision({
    error: new Error('nonce too low'),
    chainId: 8453,
    mode: 'normal',
  });

  assert.equal(decision.matched, false);
});
