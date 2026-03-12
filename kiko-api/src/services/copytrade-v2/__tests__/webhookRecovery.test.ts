import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { __webhookTest } from '../../../routes/webhook.js';

afterEach(() => {
  __webhookTest.resetForTest();
});

test('EVM no-swap decode schedules receipt recovery instead of only logging', () => {
  let captured: any = null;
  __webhookTest.setScheduleReceiptRecoveryForTest((chainId, txHash, trackedWallets, detectedAt) => {
    captured = { chainId, txHash, trackedWallets, detectedAt };
  });

  __webhookTest.handleEvmDecodedWithoutSwaps({
    chainId: 56,
    txHash: '0xnoswap',
    trackedWallets: ['0xwallet1', '0xwallet2'],
    detectedAt: 12345,
  });

  assert.deepEqual(captured, {
    chainId: 56,
    txHash: '0xnoswap',
    trackedWallets: ['0xwallet1', '0xwallet2'],
    detectedAt: 12345,
  });
});

test('process-tx receipt timeout schedules recovery instead of surfacing a hard failure', () => {
  let captured: any = null;
  __webhookTest.setScheduleReceiptRecoveryForTest((chainId, txHash, trackedWallets, detectedAt) => {
    captured = { chainId, txHash, trackedWallets, detectedAt };
  });

  assert.equal(__webhookTest.isRecoverableProcessTxFetchTimeout(new Error('timeout_receipt_fetch_900ms')), true);
  assert.equal(__webhookTest.isRecoverableProcessTxFetchTimeout(new Error('timeout_tx_fetch_900ms')), true);
  assert.equal(__webhookTest.isRecoverableProcessTxFetchTimeout(new Error('rpc_failure')), false);

  const result = __webhookTest.handleProcessTxFetchTimeout({
    chainId: 8453,
    txHash: '0xtimeout',
    wallet: '0xwallet1',
    detectedAt: 67890,
  });

  assert.deepEqual(captured, {
    chainId: 8453,
    txHash: '0xtimeout',
    trackedWallets: ['0xwallet1'],
    detectedAt: 67890,
  });
  assert.deepEqual(result, {
    success: true,
    skipped: true,
    reason: 'receipt_recovery_scheduled',
  });
});
