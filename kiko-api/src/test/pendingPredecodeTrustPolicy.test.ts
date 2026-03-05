import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getPendingPredecodeSource,
  isPendingPredecodeTrusted,
} from '../services/copytrade-v2/ingress/pendingPredecodeTrustPolicy.js';

describe('pending predecode trust policy', () => {
  test('accepts confirmed pending_prefetch sources', () => {
    const snapshot = {
      timing: {
        source: 'pending_prefetch',
      },
    };
    assert.equal(getPendingPredecodeSource(snapshot), 'pending_prefetch');
    assert.equal(isPendingPredecodeTrusted(snapshot), true);
  });

  test('rejects provisional pending calldata source', () => {
    const snapshot = {
      timing: {
        source: 'pending_calldata_predecoded',
      },
    };
    assert.equal(getPendingPredecodeSource(snapshot), 'pending_calldata_predecoded');
    assert.equal(isPendingPredecodeTrusted(snapshot), false);
  });

  test('rejects missing source', () => {
    assert.equal(isPendingPredecodeTrusted(null), false);
    assert.equal(isPendingPredecodeTrusted({}), false);
  });
});

