import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyExitIntentExecutionError,
  resolveSameJobRetryDelayMs,
  __testOnly,
} from '../exit/exitIntentExecutionPolicy.js';
import { ExitHotPathDeferredError } from '../exit/exitHotPathPolicy.js';

test('classifyExitIntentExecutionError keeps deferred hot-path errors on requeue path', () => {
  const result = classifyExitIntentExecutionError(new ExitHotPathDeferredError('token_exit_lock_contended', 400));
  assert.equal(result.sameJobRetry, false);
  assert.equal(result.reasonCode, 'token_exit_lock_contended');
});

test('classifyExitIntentExecutionError marks network failures as same-job retryable', () => {
  const result = classifyExitIntentExecutionError(new Error('Network failure on attempt 2, retrying in 900ms'));
  assert.equal(result.sameJobRetry, true);
  assert.match(result.reasonCode, /transient_network_retry/);
  assert.equal(result.queueRetryAllowed, true);
});

test('resolveSameJobRetryDelayMs returns bounded progressive delays', () => {
  assert.equal(resolveSameJobRetryDelayMs(1), __testOnly.SAME_JOB_TRANSIENT_RETRY_DELAYS_MS[0]);
  assert.equal(resolveSameJobRetryDelayMs(2), __testOnly.SAME_JOB_TRANSIENT_RETRY_DELAYS_MS[1]);
  assert.equal(resolveSameJobRetryDelayMs(99), __testOnly.SAME_JOB_TRANSIENT_RETRY_DELAYS_MS.at(-1));
});

test('classifyExitIntentExecutionError marks insufficient gas as terminal archive', () => {
  const result = classifyExitIntentExecutionError(new Error('insufficient funds for gas * price + value'));
  assert.equal(result.sameJobRetry, false);
  assert.equal(result.queueRetryAllowed, false);
  assert.equal(result.archivePosition, true);
  assert.equal(result.reasonCode, 'exit_blocked_insufficient_gas');
});
