import test from 'node:test';
import assert from 'node:assert/strict';

import { __transactionCardStateTest } from './transactionCardState';

test('mergeTransactionCardData prevents success from being overwritten by a late failure', () => {
  const result = __transactionCardStateTest.mergeTransactionCardData(
    {
      status: 'success',
      txHash: '0xabc',
      isLoading: false,
      message: 'done',
    },
    {
      status: 'failed',
      errorMessage: 'Connection lost during transaction',
      isLoading: false,
    }
  );

  assert.equal(result.status, 'success');
  assert.equal(result.txHash, '0xabc');
  assert.equal(result.errorMessage, undefined);
});

test('mergeTransactionCardData allows success to correct an earlier failure', () => {
  const result = __transactionCardStateTest.mergeTransactionCardData(
    {
      status: 'failed',
      errorMessage: 'Connection lost during transaction',
      isLoading: false,
    },
    {
      status: 'success',
      txHash: '0xdef',
      isLoading: false,
    }
  );

  assert.equal(result.status, 'success');
  assert.equal(result.txHash, '0xdef');
  assert.equal(result.errorMessage, undefined);
});

test('mergeTransactionCardData keeps pending verification from downgrading pending tx hash state only when stronger state exists', () => {
  const result = __transactionCardStateTest.mergeTransactionCardData(
    {
      status: 'pending',
      txHash: '0xghi',
      isLoading: true,
    },
    {
      status: 'sending',
      isLoading: true,
    }
  );

  assert.equal(result.status, 'pending');
  assert.equal(result.txHash, '0xghi');
});
