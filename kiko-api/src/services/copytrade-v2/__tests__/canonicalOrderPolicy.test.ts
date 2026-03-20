import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canExecuteMirrorSellFromPendingExposure,
  resolveCanonicalSellPreemption,
  shouldAwaitBuyConfirmationForMirrorSell,
} from '../orders/canonicalOrderPolicy.js';

test('canonical sell preemption resolves target sell metadata from order', () => {
  const result = resolveCanonicalSellPreemption({
    lifecycleState: 'BUY_SUBMITTING',
    metadata: {
      targetSellTxHash: '0xsell',
      targetSellReasonCode: 'sell_preempted_before_buy_confirm',
    },
  });

  assert.deepEqual(result, {
    shouldMirrorSell: true,
    targetSellTxHash: '0xsell',
    reasonCode: 'sell_preempted_before_buy_confirm',
  });
});

test('mirror sell waits for buy confirmation when position is still broadcasted unseen', () => {
  assert.equal(shouldAwaitBuyConfirmationForMirrorSell({
    exitReason: 'mirror_sell',
    positionStatus: 'broadcasted_unseen',
    canonicalOrderLifecycle: 'BUY_SUBMITTING',
  }), true);
});

test('mirror sell does not wait once open position is ready for exit', () => {
  assert.equal(shouldAwaitBuyConfirmationForMirrorSell({
    exitReason: 'mirror_sell',
    positionStatus: 'open',
    canonicalOrderLifecycle: 'BUY_CONFIRMED_OPEN',
  }), false);
});

test('mirror sell does not wait when sell-preempted order has pending broadcast tx exposure', () => {
  assert.equal(shouldAwaitBuyConfirmationForMirrorSell({
    exitReason: 'mirror_sell',
    positionStatus: 'pending_broadcast',
    canonicalOrderLifecycle: 'EXIT_ARMED',
    entryTxHash: '0xbuy',
  }), false);
});

test('mirror sell can execute from pending broadcast exposure once order is exit-armed', () => {
  assert.equal(canExecuteMirrorSellFromPendingExposure({
    exitReason: 'mirror_sell',
    positionStatus: 'broadcasted_unseen',
    canonicalOrderLifecycle: 'EXIT_ARMED',
    entryTxHash: '0xbuy',
  }), true);
});

test('mirror sell still waits when canonical order is only awaiting buy finality', () => {
  assert.equal(shouldAwaitBuyConfirmationForMirrorSell({
    exitReason: 'mirror_sell',
    positionStatus: 'pending',
    canonicalOrderLifecycle: 'BUY_AWAITING_FINALITY',
    entryTxHash: '0xbuy',
  }), true);
});

test('mirror sell can execute from pending exposure while exit is awaiting finality', () => {
  assert.equal(canExecuteMirrorSellFromPendingExposure({
    exitReason: 'mirror_sell',
    positionStatus: 'pending_broadcast',
    canonicalOrderLifecycle: 'EXIT_AWAITING_FINALITY',
    entryTxHash: '0xbuy',
  }), true);
});
