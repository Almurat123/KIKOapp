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

test('webhook extracts relayer-attributed tracked wallets from full tx calldata', () => {
  const candidates = __webhookTest.collectEvmCalldataCandidates(
    '0xfd3ad6d4'
    + '0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed'
    + '000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    + '000000000000000000000000b82efeab033c15a48e93771b584470948cb55b07'
  );

  assert.deepEqual(candidates, [
    '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xb82efeab033c15a48e93771b584470948cb55b07',
  ]);

  const fullTxCandidates = __webhookTest.collectEvmFullTxCandidates({
    from: '0x8151aac95fcec7c3ca82557c43da5ac2276f3cb9',
    to: '0x6b6e87d2cc438c287a5550a8732c302454e4382b',
    input: '0xfd3ad6d4'
      + '0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed'
      + '000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      + '000000000000000000000000b82efeab033c15a48e93771b584470948cb55b07'
  });

  assert.equal(fullTxCandidates.includes('0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed'), true);
  assert.equal(fullTxCandidates.includes('0x8151aac95fcec7c3ca82557c43da5ac2276f3cb9'), true);
});

test('source tx.from skip is bypassed for relayer-attributed wallets only', () => {
  assert.equal(__webhookTest.shouldSkipWalletForSourceBinding({
    isSolanaItems: false,
    sourceTxFrom: '0x8151aac95fcec7c3ca82557c43da5ac2276f3cb9',
    trackedWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
    relayerAttributedWallets: new Set(['0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed']),
  }), false);

  assert.equal(__webhookTest.shouldSkipWalletForSourceBinding({
    isSolanaItems: false,
    sourceTxFrom: '0x8151aac95fcec7c3ca82557c43da5ac2276f3cb9',
    trackedWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
    relayerAttributedWallets: new Set(),
  }), true);
});
