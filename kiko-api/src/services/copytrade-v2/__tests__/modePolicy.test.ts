import assert from 'node:assert/strict';
import test from 'node:test';
import { DefaultCopytradeModeResolver } from '../policies/modePolicyResolver.js';

test('mode policy: turbo is aggressive', () => {
  const resolver = new DefaultCopytradeModeResolver();
  const policy = resolver.resolve('turbo');
  assert.equal(policy.requireConfirmedTx, false);
  assert.equal(policy.allowAggressiveFallback, true);
  assert.equal(policy.maxRetries, 2);
});

test('mode policy: safety is strict', () => {
  const resolver = new DefaultCopytradeModeResolver();
  const policy = resolver.resolve('safety');
  assert.equal(policy.requireConfirmedTx, true);
  assert.equal(policy.allowAggressiveFallback, false);
  assert.equal(policy.maxRetries, 1);
  assert.equal(policy.minSignalConfidence >= 0.75, true);
});
