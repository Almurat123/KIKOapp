import test from 'node:test';
import assert from 'node:assert/strict';
import { __targetWalletTrackingTest } from '../targetWalletTrackingService.js';

test('bootstrap history dedupe keeps one row per txHash and prefers richer decoded rows', () => {
  const txs = [
    {
      txHash: '0xabc',
      txType: 'TRANSFER_OUT',
      tokenAddress: null,
      amount: '0',
      valueUsd: null,
      blockTimestamp: new Date('2026-03-18T16:11:59.000Z'),
      source: 'target_history',
    },
    {
      txHash: '0xabc',
      txType: 'TARGET_BUY',
      tokenAddress: '0xae58',
      tokenInAddress: '0xeeee',
      tokenOutAddress: '0xae58',
      amount: '123',
      amountIn: '100',
      amountOut: '123',
      valueUsd: 42,
      valueInUsd: 42,
      parseReason: 'history_decode_buy',
      blockTimestamp: new Date('2026-03-18T16:11:59.000Z'),
      source: 'target_history',
    },
    {
      txHash: '0xdef',
      txType: 'TARGET_BUY',
      tokenAddress: '0xbeef',
      amount: '1',
      valueUsd: 1,
      blockTimestamp: new Date('2026-03-18T16:12:04.000Z'),
      source: 'target_history',
    }
  ];

  const deduped = __targetWalletTrackingTest.dedupeBootstrapWalletTransactions(txs as any);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0]?.txHash, '0xdef');
  const abc = deduped.find((row: any) => row.txHash === '0xabc');
  assert.equal(abc?.txType, 'TARGET_BUY');
  assert.equal(abc?.tokenOutAddress, '0xae58');
  assert.equal(abc?.parseReason, 'history_decode_buy');
});
