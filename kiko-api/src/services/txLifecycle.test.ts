import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTxLifecycleSendAccepted,
  isTxLifecycleTerminal,
  toTxLifecycleFailureMessage
} from './txLifecycle.js';

test('isTxLifecycleSendAccepted accepts visible/broadcasted/confirmed-success', () => {
  assert.equal(isTxLifecycleSendAccepted({
    status: 'broadcasted_unseen',
    txHash: '0xabc',
    attempts: 1,
    chainId: 8453
  }), true);
  assert.equal(isTxLifecycleSendAccepted({
    status: 'visible_pending',
    txHash: '0xabc',
    attempts: 1,
    chainId: 8453
  }), true);
  assert.equal(isTxLifecycleSendAccepted({
    status: 'confirmed_success',
    txHash: '0xabc',
    attempts: 1,
    chainId: 8453
  }), true);
});

test('isTxLifecycleSendAccepted rejects missing hash and failed states', () => {
  assert.equal(isTxLifecycleSendAccepted({
    status: 'broadcasted_unseen',
    attempts: 1,
    chainId: 8453
  }), false);
  assert.equal(isTxLifecycleSendAccepted({
    status: 'confirmed_failed',
    txHash: '0xabc',
    attempts: 1,
    chainId: 8453
  }), false);
  assert.equal(isTxLifecycleSendAccepted({
    status: 'dropped_timeout',
    txHash: '0xabc',
    attempts: 1,
    chainId: 8453
  }), false);
});

test('terminal and failure message helpers', () => {
  assert.equal(isTxLifecycleTerminal('confirmed_success'), true);
  assert.equal(isTxLifecycleTerminal('confirmed_failed'), true);
  assert.equal(isTxLifecycleTerminal('dropped_timeout'), true);
  assert.equal(isTxLifecycleTerminal('visible_pending'), false);

  assert.equal(toTxLifecycleFailureMessage({
    status: 'dropped_timeout',
    attempts: 2,
    chainId: 8453
  }), 'tx_lifecycle_dropped_timeout');
  assert.equal(toTxLifecycleFailureMessage({
    status: 'confirmed_failed',
    attempts: 2,
    chainId: 8453,
    lastRpcError: 'execution reverted'
  }), 'tx_lifecycle_confirmed_failed:execution reverted');
});
