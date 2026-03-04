import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluatePositionAttributionIntegrity } from '../services/copytrade/positions/positionAttributionIntegrityGate.js';

describe('position attribution integrity gate', () => {
  test('requires repair when no exact amount, no decimal amount, and ledger has no owned amount', () => {
    const decision = evaluatePositionAttributionIntegrity({
      entryAmountExact: null,
      entryAmountDec: '0',
      ledger: {
        metrics: {
          effectiveOwnedAmountRaw: 0n,
        },
      },
    });

    assert.equal(decision.repairRequired, true);
    assert.equal(decision.reasonCode, 'integrity_missing_entry_attribution');
  });

  test('treats zero-like decimal strings as missing attribution', () => {
    const decision = evaluatePositionAttributionIntegrity({
      entryAmountExact: null,
      entryAmountDec: '0.000000000000000000',
      ledger: {
        metrics: {
          effectiveOwnedAmountRaw: 0n,
        },
      },
    });

    assert.equal(decision.repairRequired, true);
    assert.equal(decision.reasonCode, 'integrity_missing_entry_attribution');
  });

  test('passes when ledger already has effective owned amount', () => {
    const decision = evaluatePositionAttributionIntegrity({
      entryAmountExact: null,
      entryAmountDec: '0',
      ledger: {
        metrics: {
          effectiveOwnedAmountRaw: 100n,
        },
      },
    });

    assert.equal(decision.repairRequired, false);
  });
});
