import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';

describe('Solana RPC endpoints', () => {
  test('cheap strategy keeps public free Solana endpoints ahead of premium fallbacks', () => {
    const primary = 'https://primary-sol.example/rpc';
    const endpoints = getRpcEndpointsWithStrategy('solana', 'cheap', primary);
    const urls = endpoints.map((item) => item.url);
    const types = endpoints.map((item) => item.type);

    assert.ok(urls.includes(primary));
    assert.ok(urls.includes('https://solana-rpc.publicnode.com'));
    assert.ok(urls.includes('https://rpc.ankr.com/solana'));
    assert.ok(urls.includes('https://api.mainnet-beta.solana.com'));
    assert.equal(urls.includes('https://solana.api.pocket.network'), false);
    assert.equal(types[0], 'public_free');
  });
});
