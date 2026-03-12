import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEvmExitPlanFromSnapshot } from '../services/copytrade-v2/exit/planner.js';
import { buildForcedExitSwapPlan } from '../services/copytrade-v2/recovery/forcedExitPlanner.js';
import type { ExitAttributionSnapshot } from '../services/copytrade-v2/exit/exitSnapshotTypes.js';

function makeSnapshot(overrides: Partial<ExitAttributionSnapshot> = {}): ExitAttributionSnapshot {
  return {
    tokenAddress: '0xtoken',
    chainId: 8453,
    walletAddress: '0xwallet',
    isMirrorSell: true,
    hasValidPrice: false,
    decimals: 0,
    balanceRaw: 1000n,
    balanceUsd: 0,
    treatAsEmptyOrDust: false,
    balanceRead: {
      status: 'success',
      value: 1000n,
      reasonCode: 'EXIT_BALANCE_CONFIRMED',
      attemptCount: 1,
      lastError: null,
      providerSource: 'unit-test',
    },
    positions: [{ id: 'pos-1', tokenAddress: '0xtoken', status: 'pending', entryTxHash: 'PENDING_1' }],
    pendingLots: [],
    latestTargetSellTxHash: '0xsell',
    targetFullExitVerified: false,
    targetFullExitReasonCode: null,
    targetSellRatioBps: 2500,
    targetSellRatioReasonCode: 'RATIO_RESOLVED',
    attribution: {
      eligiblePositions: [],
      sellAmountRaw: 0n,
      reasonCode: 'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
      metrics: {
        openPositionCount: 0,
        pendingPositionCount: 1,
        pendingLotCount: 1,
        onChainBalanceRaw: '1000',
        attributedAmountRaw: '0',
        sellAmountRaw: '0',
        hasExternalBalance: false,
      },
      hasExternalBalance: false,
    },
    ...overrides,
  };
}

describe('mirror sell planner ratio', () => {
  test('uses target sell ratio with balance fallback when pending expected amount is unavailable', () => {
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: '0xtoken',
      chainId: 8453,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 0 },
      universalSlippageBps: 500,
      executionMode: 'normal' as any,
      targetWallet: '0xtarget',
      snapshot: makeSnapshot(),
    });

    assert.equal(plan.kind, 'swap');
    if (plan.kind !== 'swap') return;
    assert.equal(plan.attributedBalance, 250n);
    assert.equal(plan.amountInHuman, '250');
    assert.equal(plan.attributedReasonCode, 'FULL_BALANCE_FALLBACK');
    assert.equal(plan.attributionMetrics?.mirrorTargetSellRatioBps, 2500);
  });

  test('forced full exit uses full on-chain balance without intentional dust', () => {
    const forced = buildForcedExitSwapPlan({
      userId: 'user-1',
      tokenAddress: '0xtoken',
      chainId: 8453,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 0 },
      universalSlippageBps: 500,
      executionMode: 'normal' as any,
      targetWallet: '0xtarget',
      snapshot: makeSnapshot({
        positions: [{ id: 'pos-open', tokenAddress: '0xtoken', status: 'open', entryTxHash: '0xentry' }],
        targetFullExitVerified: true,
      }),
      reasonCode: 'target_full_exit_verified',
    });

    assert.equal(forced.attributedBalance, 1000n);
    assert.equal(forced.amountInHuman, '1000');
    assert.equal(forced.attributionMetrics?.forcedExitSellRaw, '1000');
  });
});
