import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExitAttempts, resolveAttemptFinality } from '../exit/executor.js';
import { createExitOrderRuntimeContext } from '../exit/runtime.js';
import type { EvmExitSwapPlan } from '../exit/types.js';

function makePlan(sellRoutePolicy: EvmExitSwapPlan['sellRoutePolicy']): EvmExitSwapPlan {
  return {
    kind: 'swap',
    userId: 'user-1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    tokenAddress: '0x2222222222222222222222222222222222222222',
    chainId: 56,
    exitReason: 'mirror_sell',
    tokenInfo: { symbol: 'END', decimals: 18, price: 1 },
    balance: 1n,
    decimals: 18,
    balanceUsd: 1,
    attributedBalance: 1n,
    amountInHuman: '1',
    retryAmountInHuman: '1',
    initialSlippageBps: 1500,
    retrySlippageBps: 2000,
    executionMode: 'turbo',
    sellRoutePolicy,
    runtimeContext: createExitOrderRuntimeContext({
      userId: 'user-1',
      walletAddress: '0x1111111111111111111111111111111111111111',
      chainId: 56,
      tokenAddress: '0x2222222222222222222222222222222222222222',
      exitReason: 'mirror_sell',
      targetWallet: '0x3333333333333333333333333333333333333333',
    }),
    positions: [],
    pendingAttributedLotIds: [],
    latestTargetSellTxHash: null,
    attributedReasonCode: 'ATTRIBUTED_AMOUNT_RESOLVED',
    attributionMetrics: {},
    hasExternalBalance: false,
  };
}

test('external-primary exit retries stay on external path', () => {
  const attempts = buildExitAttempts(makePlan('external_primary'));

  assert.equal(attempts.some((attempt) => attempt.sellRoutePolicy === 'direct_primary'), false);
  assert.equal(attempts.some((attempt) => attempt.executionStep === 'sell_direct_fallback'), false);
  assert.equal(attempts.length, 5);
});

test('direct-primary exit retries still include direct fallback steps', () => {
  const attempts = buildExitAttempts(makePlan('direct_primary'));

  assert.equal(attempts.some((attempt) => attempt.executionStep === 'sell_direct_fallback'), true);
  assert.equal(attempts.some((attempt) => attempt.sellRoutePolicy === 'direct_primary'), true);
});

test('direct-only exit retries never include external retry steps', () => {
  const attempts = buildExitAttempts(makePlan('direct_only'));

  assert.equal(attempts.some((attempt) => attempt.sellRoutePolicy === 'external_primary'), false);
  assert.equal(attempts.some((attempt) => attempt.executionStep === 'sell_external_retry_aggressive'), false);
  assert.equal(attempts.every((attempt) => attempt.sellRoutePolicy === 'direct_only'), true);
});

test('exit finality trusts requireConfirmedTx swap success with canonical tx hash', () => {
  const plan = makePlan('direct_only');

  const finality = resolveAttemptFinality({
    plan,
    txHash: '0x876752c9d5f8899057c7c32ccb22f640af0a4a9c19dcb05de1e01562fdbf5eb0',
    runtimeContext: plan.runtimeContext,
    swapSuccess: true,
  });

  assert.equal(finality.finalityState, 'confirmed_success');
  assert.equal(finality.finalityReasonCode, 'swap_result_success_require_confirmed');
  assert.equal(finality.txHash, '0x876752c9d5f8899057c7c32ccb22f640af0a4a9c19dcb05de1e01562fdbf5eb0');
});

test('exit finality keeps explicit failed lifecycle above swap success', () => {
  const plan = makePlan('direct_only');

  const finality = resolveAttemptFinality({
    plan,
    txHash: '0x876752c9d5f8899057c7c32ccb22f640af0a4a9c19dcb05de1e01562fdbf5eb0',
    runtimeContext: plan.runtimeContext,
    txLifecycle: {
      status: 'confirmed_failed',
      lastRpcError: 'receipt_status_0',
    },
    swapSuccess: true,
  });

  assert.equal(finality.finalityState, 'confirmed_failed');
  assert.equal(finality.finalityReasonCode, 'receipt_status_0');
});
