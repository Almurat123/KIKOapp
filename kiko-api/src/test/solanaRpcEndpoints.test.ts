import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';

describe('Solana RPC endpoints', () => {
  test('includes primary RPC url and excludes known unusable public endpoints', () => {
    const primary = 'https://primary-sol.example/rpc';
    const endpoints = getRpcEndpointsWithStrategy('solana', 'cheap', primary);
    const urls = endpoints.map((item) => item.url);

    assert.ok(urls.includes(primary));
    assert.ok(urls.includes('https://api.mainnet-beta.solana.com'));
    assert.ok(urls.includes('https://solana.api.pocket.network'));
    assert.equal(urls.includes('https://solana-rpc.publicnode.com'), false);
    assert.equal(urls.includes('https://rpc.ankr.com/solana'), false);
    assert.equal(urls.includes('https://solana.drpc.org'), false);
  });
});
