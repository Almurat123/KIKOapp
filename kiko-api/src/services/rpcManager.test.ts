import test from 'node:test';
import assert from 'node:assert/strict';
import { __rpcManagerTest } from './rpcManager.js';

test('createStableRequestKey is deterministic for object key order', () => {
  const keyA = __rpcManagerTest.createStableRequestKey(8453, 'eth_call', [{ b: 2, a: 1 }]);
  const keyB = __rpcManagerTest.createStableRequestKey(8453, 'eth_call', [{ a: 1, b: 2 }]);
  assert.equal(keyA, keyB);
});

test('createStableRequestKey handles bigint payload', () => {
  const key = __rpcManagerTest.createStableRequestKey(1, 'eth_getBalance', ['0xabc', 123n]);
  assert.equal(typeof key, 'string');
  assert.ok(key.includes('bigint:123'));
});

test('tryGetRawTxHash normalizes raw tx input', () => {
  const hashA = __rpcManagerTest.tryGetRawTxHash('0x1234abcd');
  const hashB = __rpcManagerTest.tryGetRawTxHash('1234ABCD');
  assert.equal(hashA, hashB);
  assert.ok(hashA?.startsWith('0x'));
});

test('shouldTreatSendRawErrorAsKnown identifies idempotent sendRaw errors', () => {
  assert.equal(__rpcManagerTest.shouldTreatSendRawErrorAsKnown('already known'), true);
  assert.equal(__rpcManagerTest.shouldTreatSendRawErrorAsKnown('Known transaction'), true);
  assert.equal(__rpcManagerTest.shouldTreatSendRawErrorAsKnown('nonce too low'), false);
  assert.equal(__rpcManagerTest.shouldTreatSendRawErrorAsKnown('execution reverted'), false);
});

test('method backoff increases on failure and clears on success', () => {
  __rpcManagerTest.resetRuntimeStateForTest();

  const first = __rpcManagerTest.markMethodFailureForTest(8453, 'eth_getTransactionReceipt');
  const second = __rpcManagerTest.markMethodFailureForTest(8453, 'eth_getTransactionReceipt');
  assert.ok(first.failures === 1);
  assert.ok(second.failures === 2);
  assert.ok(second.cooldownUntil >= first.cooldownUntil);

  const active = __rpcManagerTest.getMethodBackoff(8453, 'eth_getTransactionReceipt');
  assert.ok(active && active.failures === 2);

  __rpcManagerTest.markMethodSuccessForTest(8453, 'eth_getTransactionReceipt');
  const cleared = __rpcManagerTest.getMethodBackoff(8453, 'eth_getTransactionReceipt');
  assert.equal(cleared, null);
});

test('getEndpointAttemptBudget applies cooldown cap', () => {
  const normal = __rpcManagerTest.getEndpointAttemptBudget('eth_call', 'normal', 8, false);
  const cooldown = __rpcManagerTest.getEndpointAttemptBudget('eth_call', 'normal', 8, true);
  assert.ok(normal >= cooldown);
  assert.equal(cooldown, 1);
});

test('getEndpointAttemptBudget can force exhaustive failover', () => {
  const budget = __rpcManagerTest.getEndpointAttemptBudget('eth_call', 'critical', 7, true, true);
  assert.equal(budget, 7);
});

test('getMethodConcurrencyLimit lowers limit during cooldown', () => {
  const normal = __rpcManagerTest.getMethodConcurrencyLimit('eth_call', 'normal', false);
  const cooldown = __rpcManagerTest.getMethodConcurrencyLimit('eth_call', 'normal', true);
  assert.ok(normal > cooldown);
  assert.ok(cooldown >= 1);
});
