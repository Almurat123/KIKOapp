import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCopyTradeIngressState,
  markCopyTradeIngressConfirmed,
  markCopyTradeIngressFirstSeen,
  markCopyTradeIngressSwapReady,
  tryMarkCopyTradeIngressEnqueued,
  updateCopyTradeIngressState,
} from '../services/copytrade-v2/ingress/copyTradeIngressState.js';

const BASE_CHAIN_ID = 8453;

function uniqueTxHash(seed: string): string {
  return `0x${Buffer.from(`${seed}:${Date.now()}:${Math.random()}`).toString('hex').padEnd(64, '0').slice(0, 64)}`;
}

describe('copyTradeIngressState monotonic merge', () => {
  test('later writes cannot move timing anchors forward or clear accepted enqueue evidence', async () => {
    const txHash = uniqueTxHash('ingress-monotonic');

    await markCopyTradeIngressFirstSeen(BASE_CHAIN_ID, txHash, 1_000, 'pending');
    await markCopyTradeIngressConfirmed(BASE_CHAIN_ID, txHash, 1_500, 'webhook');
    await markCopyTradeIngressSwapReady(BASE_CHAIN_ID, txHash, 1_800, 'decode');
    const enqueued = await tryMarkCopyTradeIngressEnqueued(BASE_CHAIN_ID, txHash, 2_000, 'dispatcher');
    assert.equal(enqueued.accepted, true);

    await updateCopyTradeIngressState(BASE_CHAIN_ID, txHash, {
      firstSeenAt: 5_000,
      confirmedSeenAt: 5_500,
      swapReadyAt: 5_800,
      executionEnqueuedAt: 6_000,
      sourceFlags: { late_writer: true },
    });

    const state = await getCopyTradeIngressState(BASE_CHAIN_ID, txHash);
    assert.equal(state?.firstSeenAt, 1_000);
    assert.equal(state?.confirmedSeenAt, 1_500);
    assert.equal(state?.swapReadyAt, 1_800);
    assert.equal(state?.executionEnqueuedAt, 2_000);
    assert.equal(state?.sourceFlags?.pending, true);
    assert.equal(state?.sourceFlags?.webhook, true);
    assert.equal(state?.sourceFlags?.decode, true);
    assert.equal(state?.sourceFlags?.dispatcher, true);
    assert.equal(state?.sourceFlags?.late_writer, true);
  });
});
