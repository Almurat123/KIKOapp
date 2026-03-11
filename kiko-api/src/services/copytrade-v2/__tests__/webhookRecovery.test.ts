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
