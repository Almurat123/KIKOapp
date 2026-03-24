import test from 'node:test';
import assert from 'node:assert/strict';

import { __prepareSwapTest } from './prepareSwap.js';

test('resolveSocketRecoverySearchStartMs uses original request start time when it predates socket recovery', () => {
  const requestStartedAt = 1_000_000;
  const recoveryStartedAt = 1_030_000;

  const result = __prepareSwapTest.resolveSocketRecoverySearchStartMs({
    requestStartedAt,
    recoveryStartedAt,
    lookbackMs: 5_000,
  });

  assert.equal(result, 995_000);
});

test('buildSocketRecoveryResult keeps recovered pending trades pending in the UI', () => {
  const result = __prepareSwapTest.buildSocketRecoveryResult({
    currentData: {
      amountOut: '0.1',
      tokenInSymbol: 'VIRTUAL',
      tokenOutSymbol: 'ETH',
    },
    recentSwap: {
      id: 'trade-1',
      txHash: '0xabc123',
      status: 'pending',
      tokenOutAmount: '0.2',
    },
    args: {
      amount_in: '1',
      token_in: 'VIRTUAL',
      token_out: 'ETH',
    },
  });

  assert.equal(result.completionData.status, 'pending');
  assert.equal(result.completionData.isLoading, true);
  assert.equal(result.toolResult.mode, 'pending');
  assert.equal(result.toolResult.data.status, 'pending');
});

test('buildSocketRecoveryResult marks confirmed trades as success', () => {
  const result = __prepareSwapTest.buildSocketRecoveryResult({
    currentData: {
      amountOut: '0.1',
      tokenInSymbol: 'VIRTUAL',
      tokenOutSymbol: 'ETH',
    },
    recentSwap: {
      id: 'trade-2',
      txHash: '0xdef456',
      status: 'success',
      tokenOutAmount: '0.3',
    },
    args: {
      amount_in: '1',
      token_in: 'VIRTUAL',
      token_out: 'ETH',
    },
  });

  assert.equal(result.completionData.status, 'success');
  assert.equal(result.completionData.isLoading, false);
  assert.equal(result.toolResult.mode, 'executed');
  assert.equal(result.toolResult.data.status, 'success');
});
