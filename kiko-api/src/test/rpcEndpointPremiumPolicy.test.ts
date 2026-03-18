import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';

describe('rpc endpoint premium policy (cheap strategy)', () => {
  test('cheap strategy keeps public endpoints first', () => {
    const endpoints = getRpcEndpointsWithStrategy('bsc', 'cheap', 'https://paid.example/rpc');
    assert.ok(endpoints.length > 0);
    assert.equal(endpoints[0].type, 'public_free');
  });

  test('cheap strategy still includes premium endpoints as fallback', () => {
    const endpoints = getRpcEndpointsWithStrategy('bsc', 'cheap', 'https://paid.example/rpc');
    assert.ok(endpoints.length > 0);
    assert.ok(endpoints.some((endpoint) => endpoint.type === 'premium'));
  });
});
