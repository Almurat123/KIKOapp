import test from 'node:test';
import assert from 'node:assert/strict';

import { runCopytradeBuyConfirmationFlow } from '../buy/buyConfirmationCoordinator.js';

test('buy confirmation coordinator persists awaiting observation when shared observer stays uncertain', async () => {
  const calls: any[] = [];
  let transitioned = false;

  const result = await runCopytradeBuyConfirmationFlow({
    chainId: 8453,
    txHash: '0xbuy',
    tokenAddress: '0xtoken',
    timeoutMs: 10_000,
    pollMs: 1_000,
    orderId: 'order-1',
    onTransition: async () => {
      transitioned = true;
      return 'confirmed_success';
    },
  }, {
    observeCanonicalOrderState: async () => ({
      order: { id: 'order-1', lifecycleState: 'BUY_AWAITING_FINALITY', metadata: {} } as any,
      confirmation: {
        success: false,
        kind: 'uncertain',
        reason: 'shared_confirmation_timeout',
        visible: true,
        resolvedTxHash: '0xbuy',
      },
      resolvedState: 'BUY_AWAITING_FINALITY',
      resolvedTxHash: '0xbuy',
      visible: true,
      final: false,
      reasonCode: 'order_observation_uncertain',
    }),
    scheduleCanonicalOrderObservation: async (params) => {
      calls.push(params);
      return null as any;
    },
    scheduleLateBuyConfirmationRecovery: () => {
      calls.push({ kind: 'late_recovery' });
    },
  });

  assert.equal(result, 'scheduled_late_recovery');
  assert.equal(transitioned, false);
  assert.equal(calls.some((entry) => entry.kind === 'buy' && entry.orderId === 'order-1'), true);
});

test('buy confirmation coordinator falls back to legacy wait when canonical order id is unavailable', async () => {
  let transitioned = false;

  const result = await runCopytradeBuyConfirmationFlow({
    chainId: 8453,
    txHash: '0xbuy',
    tokenAddress: '0xtoken',
    timeoutMs: 10_000,
    pollMs: 1_000,
    onTransition: async () => {
      transitioned = true;
      return 'confirmed_success';
    },
  }, {
    waitForCopytradeBuyConfirmation: async () => ({
      success: true,
      kind: 'confirmed_success',
      visible: true,
      resolvedTxHash: '0xbuy',
    }),
  });

  assert.equal(result, 'completed');
  assert.equal(transitioned, true);
});
