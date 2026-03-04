import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRetryTerminalization } from '../services/copytrade-v2/retry/retryTerminalizationPolicy.js';

describe('retry terminalization policy', () => {
  test('terminalizes deterministic not sellable retries after threshold', () => {
    const decision = resolveRetryTerminalization({
      isRetryAttempt: true,
      attributedReasonCode: 'NO_CONFIRMED_POSITIONS',
      existingRetryCount: 2,
    });

    assert.ok(decision);
    assert.equal(decision?.shouldTerminalize, true);
    assert.match(decision?.reasonCode || '', /deterministic_not_sellable_terminalized/);
  });
});
