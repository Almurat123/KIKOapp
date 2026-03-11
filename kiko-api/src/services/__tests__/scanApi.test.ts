import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveScanChainConfig } from '../scanApi.js';

test('scan api resolves ethereum aliases to ethereum config', () => {
  assert.equal(resolveScanChainConfig('eth')?.id, 1);
  assert.equal(resolveScanChainConfig('ethereum')?.id, 1);
});

test('scan api resolves bnb aliases to bsc config', () => {
  assert.equal(resolveScanChainConfig('bnb')?.id, 56);
  assert.equal(resolveScanChainConfig('bsc')?.id, 56);
});

test('scan api resolves short aliases for arbitrum and optimism', () => {
  assert.equal(resolveScanChainConfig('arb')?.id, 42161);
  assert.equal(resolveScanChainConfig('op')?.id, 10);
});
