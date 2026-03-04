import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldDeferStrongRpcMonitoring } from '../services/copytrade/buy/preConfirmationRpcPolicy.js';

describe('preConfirmationRpcPolicy', () => {
  test('defers strong rpc monitoring for newly created positions', () => {
    const recent = new Date(Date.now() - 30_000);
    assert.equal(shouldDeferStrongRpcMonitoring(recent, Date.now()), true);
  });

  test('allows strong rpc monitoring after the defer window', () => {
    const old = new Date(Date.now() - 5 * 60_000);
    assert.equal(shouldDeferStrongRpcMonitoring(old, Date.now()), false);
  });
});
