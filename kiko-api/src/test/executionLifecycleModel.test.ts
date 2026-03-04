import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createOrderRuntimeContext, recordLifecycleOnOrder } from '../services/order-runtime/context.js';
import { resolveExecutionLifecycleSnapshot } from '../services/swap/lifecycle/executionLifecycleModel.js';

describe('execution lifecycle model', () => {
  test('maps broadcasted unseen lifecycle to awaiting_visibility', () => {
    const runtimeContext = createOrderRuntimeContext({
      userId: 'did:test',
      walletAddress: '0x123',
      chainId: 8453,
      mode: 'copytrade',
      side: 'buy',
    });
    recordLifecycleOnOrder(runtimeContext, {
      status: 'broadcasted_unseen',
      txHash: '0xabc',
      attempts: 1,
      chainId: 8453,
    });

    const snapshot = resolveExecutionLifecycleSnapshot({ runtimeContext });
    assert.equal(snapshot.state, 'awaiting_visibility');
    assert.equal(snapshot.accepted, true);
    assert.equal(snapshot.confirmed, false);
  });

  test('maps confirmed success to terminal confirmed_success', () => {
    const snapshot = resolveExecutionLifecycleSnapshot({
      txLifecycle: {
        status: 'confirmed_success',
        txHash: '0xdef',
        attempts: 1,
        chainId: 8453,
      },
    });
    assert.equal(snapshot.state, 'confirmed_success');
    assert.equal(snapshot.terminal, true);
    assert.equal(snapshot.confirmed, true);
  });
});
