import assert from 'node:assert/strict';
import test from 'node:test';

import { dispatchCopyTradeIfReady } from '../ingress/copyTradeFastDispatcher.js';

const swap = {
  txHash: '0xabc',
  tokenIn: '0xtokenin',
  tokenOut: '0xtokenout',
  amountIn: '1',
  amountOut: '2',
} as any;

test('fast dispatcher suppresses locally adjudicated self-order before enqueue', async () => {
  let marked = false;
  let enqueued = false;

  const accepted = await dispatchCopyTradeIfReady({
    chainId: 56,
    txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    targetWallet: '0xtarget',
    swap,
    source: 'pending_prefetch',
  }, {
    getAdjudicatedSnapshot() {
      return {
        orderId: 'order-1',
        chainId: 56,
        canonicalTxHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        allTxHashes: ['0x1111111111111111111111111111111111111111111111111111111111111111'],
      } as any;
    },
    async hydrateSharedAdjudicatedSnapshot() {
      return null;
    },
    async tryMarkCopyTradeIngressEnqueued() {
      marked = true;
      return { accepted: true, state: null } as any;
    },
    async enqueueCopyTradeTask() {
      enqueued = true;
      return true;
    },
  });

  assert.equal(accepted, false);
  assert.equal(marked, false);
  assert.equal(enqueued, false);
});

test('fast dispatcher suppresses shared adjudicated self-order before enqueue', async () => {
  let marked = false;
  let enqueued = false;

  const accepted = await dispatchCopyTradeIfReady({
    chainId: 56,
    txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    targetWallet: '0xtarget',
    swap,
    source: 'process_tx_pending_prefetch',
  }, {
    getAdjudicatedSnapshot() {
      return null;
    },
    async hydrateSharedAdjudicatedSnapshot() {
      return {
        orderId: 'order-2',
        chainId: 56,
        canonicalTxHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        allTxHashes: ['0x2222222222222222222222222222222222222222222222222222222222222222'],
      } as any;
    },
    async tryMarkCopyTradeIngressEnqueued() {
      marked = true;
      return { accepted: true, state: null } as any;
    },
    async enqueueCopyTradeTask() {
      enqueued = true;
      return true;
    },
  });

  assert.equal(accepted, false);
  assert.equal(marked, false);
  assert.equal(enqueued, false);
});

test('fast dispatcher enqueues non-self tx normally', async () => {
  let marked = false;
  let enqueued = false;

  const accepted = await dispatchCopyTradeIfReady({
    chainId: 56,
    txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
    targetWallet: '0xtarget',
    swap,
    source: 'pending_prefetch',
  }, {
    getAdjudicatedSnapshot() {
      return null;
    },
    async hydrateSharedAdjudicatedSnapshot() {
      return null;
    },
    async tryMarkCopyTradeIngressEnqueued() {
      marked = true;
      return { accepted: true, state: null } as any;
    },
    async enqueueCopyTradeTask() {
      enqueued = true;
      return true;
    },
  });

  assert.equal(accepted, true);
  assert.equal(marked, true);
  assert.equal(enqueued, true);
});
