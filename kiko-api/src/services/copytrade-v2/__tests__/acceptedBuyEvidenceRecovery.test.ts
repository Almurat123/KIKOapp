import assert from 'node:assert/strict';
import test from 'node:test';

import { reportSendAccepted } from '../../order-runtime/adjudicator/service.js';
import { evaluateCopytradeBuyAcceptedInflight } from '../buy/copytradeBuyAcceptedInflight.js';
import { shouldAbortCopytradeBuyRetry } from '../buy/copytradeBuyRetryGuard.js';
import { scheduleLateBuySubmissionAdoption } from '../buy/lateBuySubmissionAdoption.js';

test('copytrade buy retry guard resolves accepted tx hash from adjudicated order evidence', () => {
  const orderId = `order-accepted-${Date.now()}`;
  const txHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  reportSendAccepted({
    chainId: 8453,
    txHash,
    orderId,
    source: 'privy_sendtx',
  });

  const decision = shouldAbortCopytradeBuyRetry({
    chainId: 8453,
    runtimeContext: {
      orderId,
      chainId: 8453,
      userId: 'user-accepted',
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

  assert.equal(decision.shouldAbortRetry, true);
  assert.equal(decision.txHash, txHash);
});

test('copytrade accepted inflight resolves adopted tx from adjudicated order evidence', () => {
  const orderId = `order-inflight-${Date.now()}`;
  const txHash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  reportSendAccepted({
    chainId: 8453,
    txHash,
    orderId,
    source: 'privy_sendtx',
  });

  const decision = evaluateCopytradeBuyAcceptedInflight({
    mode: 'copytrade',
    isBuyDirection: true,
    chainId: 8453,
    runtimeContext: {
      orderId,
      chainId: 8453,
      userId: 'user-inflight',
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

  assert.equal(decision.adoptAcceptedTx, true);
  assert.equal(decision.blockAdditionalSend, true);
  assert.equal(decision.txHash, txHash);
});

test('late buy submission adoption resolves accepted tx by order-bound adjudicated evidence', async () => {
  const orderId = `order-late-${Date.now()}`;
  const txHash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

  const adopted = await new Promise<{ txHash: string; txLifecycleStatus: string }>((outerResolve, outerReject) => {
    const keepAlive = setInterval(() => undefined, 25);
    const resolve = (value: { txHash: string; txLifecycleStatus: string }) => {
      clearInterval(keepAlive);
      outerResolve(value);
    };
    const reject = (error: Error) => {
      clearInterval(keepAlive);
      outerReject(error);
    };
    scheduleLateBuySubmissionAdoption({
      chainId: 8453,
      runtimeContext: {
        orderId,
        chainId: 8453,
        userId: 'user-late',
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
      pollMs: 20,
      maxWaitMs: 400,
      onAdopt: async (resolved) => resolve({
        txHash: resolved.txHash,
        txLifecycleStatus: resolved.txLifecycleStatus,
      }),
      onExhausted: async (resolution) => reject(new Error(`unexpected_exhausted:${resolution.reasonCode}`)),
    });

    setTimeout(() => {
      reportSendAccepted({
        chainId: 8453,
        txHash,
        orderId,
        source: 'privy_sendtx',
      });
    }, 40);
  });

  assert.equal(adopted.txHash, txHash);
  assert.equal(adopted.txLifecycleStatus, 'broadcasted_unseen');
});
