import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { submitCopytradeBuy, submitCopytradeExit } from '../services/copytrade-v2/execution/copytradeExecutionFacade.js';
import {
  getCapturedSwapExecutions,
  installCopytradeExecutionPortHarness,
  queueSwapExecutionResult,
  resetCopytradeExecutionPortHarness,
} from './helpers/copytradeExecutionPortHarness.js';
import { makeAddress, makeTxHash } from './helpers/copytradeExecutionHarness.js';

afterEach(() => {
  resetCopytradeExecutionPortHarness();
});

describe('copytrade execution facade', () => {
  test('maps accepted but unseen buy into awaiting_visibility lifecycle', async () => {
    installCopytradeExecutionPortHarness();
    const txHash = makeTxHash('facade-buy-unseen');
    queueSwapExecutionResult({
      success: true,
      txHash,
      txLifecycle: {
        status: 'broadcasted_unseen',
        txHash,
        attempts: 1,
        chainId: 8453,
      },
      metadata: {
        provider: 'test-port',
      },
    } as any);

    const result = await submitCopytradeBuy({
      userId: 'did:facade:buy',
      walletAddress: makeAddress('facade-buy'),
      tokenIn: 'ETH',
      tokenOut: makeAddress('facade-token'),
      amountIn: '0.1',
      chainId: 8453,
      slippageBps: 500,
      mode: 'copytrade',
    } as any);

    assert.equal(result.lifecycle.state, 'awaiting_visibility');
    assert.equal(result.lifecycle.accepted, true);
    assert.equal(result.swapResult.txHash, txHash);
    assert.equal(getCapturedSwapExecutions().length, 1);
  });

  test('maps retryable exit failure and preserves exit request contract', async () => {
    installCopytradeExecutionPortHarness();
    queueSwapExecutionResult({
      success: false,
      error: 'router_unavailable',
      metadata: {
        provider: 'test-port',
      },
    } as any);

    const request = {
      userId: 'did:facade:exit',
      walletAddress: makeAddress('facade-exit'),
      tokenIn: makeAddress('facade-token-in'),
      tokenOut: 'ETH',
      amountIn: '123.45',
      chainId: 56,
      slippageBps: 900,
      mode: 'copytrade',
      executionContext: {
        executionStep: 'sell_external_primary',
      },
    } as any;
    const result = await submitCopytradeExit(request);

    assert.equal(result.lifecycle.state, 'retryable_failure');
    assert.equal(result.lifecycle.terminal, false);
    assert.equal(getCapturedSwapExecutions()[0]?.request.amountIn, '123.45');
    assert.equal(getCapturedSwapExecutions()[0]?.request.executionContext?.executionStep, 'sell_external_primary');
  });
});
