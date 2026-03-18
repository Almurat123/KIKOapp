import test from 'node:test';
import assert from 'node:assert/strict';

import { getRpcPurposeProfile } from '../purpose.js';

test('critical rpc purposes allow exhaustive failover', () => {
  assert.equal(getRpcPurposeProfile('tx_visibility').allowExhaustiveFailover, true);
  assert.equal(getRpcPurposeProfile('trade_execution').allowExhaustiveFailover, true);
});

test('background rpc purposes stay bounded', () => {
  assert.equal(getRpcPurposeProfile('polling_background').allowExhaustiveFailover, false);
  assert.equal(getRpcPurposeProfile('interactive_read').allowExhaustiveFailover, false);
});
