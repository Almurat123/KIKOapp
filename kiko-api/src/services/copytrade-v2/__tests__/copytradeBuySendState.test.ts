import assert from 'node:assert/strict';
import test from 'node:test';

import { reportSendAccepted } from '../../order-runtime/adjudicator/service.js';
import { evaluateCopytradeBuySendState } from '../buy/copytradeBuySendState.js';

test('copytrade buy send state allows fallback when there is no send evidence', () => {
  const decision = evaluateCopytradeBuySendState({
    mode: 'copytrade',
    isBuyDirection: true,
    chainId: 8453,
    runtimeContext: {
      orderId: `order-no-send-${Date.now()}`,
      chainId: 8453,
      userId: 'user-no-send',
      walletAddress: '0x1234567890123456789012345678901234567890',
      side: 'buy',
      mode: 'copytrade',
      state: 'created',
      reasonCode: 'visibility_timeout',
      relatedTxHashes: [],
      route: {},
      timing: { createdAt: Date.now() },
      attempts: [],
      fallbackUsed: false,
      metadata: {},
      lastLifecycle: {
        status: 'dropped_timeout',
        chainId: 8453,
        attempts: 1,
      },
    },
  });

  assert.equal(decision.sendState, 'no_send_evidence');
  assert.equal(decision.allowFallback, true);
  assert.equal(decision.blockAdditionalSend, false);
});

test('copytrade buy send state adopts adjudicated accepted tx evidence by order id', () => {
  const orderId = `order-send-adopted-${Date.now()}`;
  const txHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  reportSendAccepted({
    chainId: 8453,
    txHash,
    orderId,
    source: 'privy_sendtx',
  });

  const decision = evaluateCopytradeBuySendState({
    mode: 'copytrade',
    isBuyDirection: true,
    chainId: 8453,
    runtimeContext: {
      orderId,
      chainId: 8453,
      userId: 'user-send-adopted',
      walletAddress: '0x1234567890123456789012345678901234567890',
      side: 'buy',
      mode: 'copytrade',
      state: 'rpc_uncertain',
      reasonCode: 'pending_visibility',
      relatedTxHashes: [],
      route: {},
      timing: { createdAt: Date.now() },
      attempts: [],
      fallbackUsed: false,
      metadata: {},
    },
  });

  assert.equal(decision.sendState, 'send_adopted');
  assert.equal(decision.allowFallback, false);
  assert.equal(decision.blockAdditionalSend, true);
  assert.equal(decision.adoptAcceptedTx, true);
  assert.equal(decision.txHash, txHash);
});
