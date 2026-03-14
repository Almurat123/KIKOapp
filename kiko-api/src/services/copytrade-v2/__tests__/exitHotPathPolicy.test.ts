import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FAST_EXIT_INTENT_RETRY_MS,
  ORACLE_EXIT_INTENT_RETRY_MS,
  STANDARD_EXIT_INTENT_RETRY_MS,
  hasIntentContext,
  resolveExitIntentRetryDelayMs,
} from '../exit/exitHotPathPolicy.js';

test('intent context detection requires a non-empty intent id', () => {
  assert.equal(hasIntentContext(undefined), false);
  assert.equal(hasIntentContext({}), false);
  assert.equal(hasIntentContext({ intentId: '   ' }), false);
  assert.equal(hasIntentContext({ intentId: 'intent-1' }), true);
});

test('lock contention uses fast retry cadence', () => {
  assert.equal(
    resolveExitIntentRetryDelayMs({ reasonCode: 'token_exit_lock_contended' }),
    FAST_EXIT_INTENT_RETRY_MS
  );
});

test('oracle uncertainty uses oracle retry cadence', () => {
  assert.equal(
    resolveExitIntentRetryDelayMs({ reasonCode: 'EXIT_BALANCE_RPC_UNCERTAIN' }),
    ORACLE_EXIT_INTENT_RETRY_MS
  );
});

test('generic execution failure uses standard retry cadence', () => {
  assert.equal(
    resolveExitIntentRetryDelayMs({ reasonCode: 'fresh_quote_allowance_change' }),
    STANDARD_EXIT_INTENT_RETRY_MS
  );
});

test('explicit retryAfterMs wins over derived policy', () => {
  assert.equal(
    resolveExitIntentRetryDelayMs({ reasonCode: 'token_exit_lock_contended', retryAfterMs: 1234 }),
    1234
  );
});
