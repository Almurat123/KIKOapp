import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExitAttempts } from '../exit/executor.js';
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
