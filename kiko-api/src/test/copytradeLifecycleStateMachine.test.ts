import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCopyTradeDelay } from '../services/copytrade/timing/copyTradeTimingModel.js';
import { reconcileOpenPositionsForExit } from '../services/copytrade/exit/openPositionReconciliation.js';
import { buildEvmExitAttributionSnapshotFromResolvedInputs } from '../services/copytrade/exit/exitAttributionSnapshotBuilder.js';
import { buildEvmExitPlanFromSnapshot } from '../services/copytrade/exit/planner.js';
import type { PendingAttributedPositionLotLike } from '../services/copytrade/positions/pendingAttributedPositionLedger.js';
import type { ExitSnapshotPosition } from '../services/copytrade/exit/exitSnapshotTypes.js';

const BASE_CHAIN_ID = 8453;
const TOKEN = '0xf30bf00edd0c22db54c9274b90d2a4c21fc09b07';
const FOLLOWER_WALLET = '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B';

type LifecyclePosition = Omit<ExitSnapshotPosition, 'status'> & {
  userId: string;
  status?: 'pending' | 'open' | 'closed';
};

function createPosition(params: {
  id: string;
  status: 'pending' | 'open' | 'closed';
  entryTxHash?: string | null;
  entryAmountExact?: string | null;
  entryAmountDec?: string | null;
}): LifecyclePosition {
  return {
    id: params.id,
    userId: 'user-1',
    tokenAddress: TOKEN,
    status: params.status,
    entryTxHash: params.entryTxHash ?? '0xbuy',
    entryAmountExact: params.entryAmountExact ?? null,
    entryAmountDec: params.entryAmountDec ?? null,
  };
}

function createPendingLot(params: {
  id: string;
  positionId: string;
  status: 'armed' | 'sell_armed';
  expectedAmountRaw?: string | null;
  targetSellTxHash?: string | null;
}): PendingAttributedPositionLotLike {
  return {
    id: params.id,
    positionId: params.positionId,
    userId: 'user-1',
    chainId: BASE_CHAIN_ID,
    tokenAddress: TOKEN,
    entryTxHash: '0xbuy',
    expectedAmountRaw: params.expectedAmountRaw ?? null,
    status: params.status,
    targetSellTxHash: params.targetSellTxHash ?? null,
  };
}

class CopytradeLifecycleHarness {
  positions: LifecyclePosition[] = [];
  pendingLots: PendingAttributedPositionLotLike[] = [];
  followerBalanceRaw = 0n;

  evaluateIngress(nowMs: number) {
    return evaluateCopyTradeDelay(
      {
        chainId: BASE_CHAIN_ID,
        firstSeenAt: 1_000,
        swapReadyAt: 1_200,
        dispatchEligibleAt: 1_200,
        enqueuedAt: 1_220,
        source: 'webhook_decode',
      },
      true,
      {
        maxDelayMs: 12_000,
        hardMaxDelayMs: 180_000,
      },
      nowMs,
    );
  }

  addPendingBuy(params: {
    positionId: string;
    rawAmount?: string | null;
    humanAmount?: string | null;
  }) {
    this.positions.push(createPosition({
      id: params.positionId,
      status: 'pending',
      entryAmountExact: params.rawAmount ?? null,
      entryAmountDec: params.humanAmount ?? null,
    }));
    this.pendingLots.push(createPendingLot({
      id: `lot:${params.positionId}`,
      positionId: params.positionId,
      status: 'armed',
      expectedAmountRaw: params.rawAmount ?? null,
    }));
  }

  confirmBuy(positionId: string) {
    this.positions = this.positions.map((position) => (
      position.id === positionId
        ? { ...position, status: 'open' }
        : position
    ));
  }

  markTargetFullSell(txHash: string) {
    this.pendingLots = this.pendingLots.map((lot) => ({
      ...lot,
      status: 'sell_armed',
      targetSellTxHash: txHash,
    }));
  }

  buildMirrorSellPlan() {
    const reconciled = reconcileOpenPositionsForExit(this.positions, TOKEN, BASE_CHAIN_ID);
    const snapshot = buildEvmExitAttributionSnapshotFromResolvedInputs({
      tokenAddress: TOKEN,
      chainId: BASE_CHAIN_ID,
      walletAddress: FOLLOWER_WALLET,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1, symbol: 'FELIX' },
      decimals: 18,
      onChainBalanceRaw: this.followerBalanceRaw,
      balanceRead: {
        status: 'success',
        value: this.followerBalanceRaw,
        reasonCode: this.followerBalanceRaw > 0n ? 'EXIT_BALANCE_CONFIRMED_POSITIVE' : 'EXIT_BALANCE_CONFIRMED_ZERO',
        attemptCount: 1,
        lastError: null,
        providerSource: 'test',
      },
      positions: reconciled.matchedPositions,
      pendingLots: this.pendingLots,
    });
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: TOKEN,
      chainId: BASE_CHAIN_ID,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1, symbol: 'FELIX' },
      universalSlippageBps: 500,
      executionMode: 'turbo',
      targetWallet: '0xtarget',
      snapshot,
    });
    return { reconciled, snapshot, plan };
  }
}

describe('copytrade lifecycle state machine', () => {
  test('ingress dispatch, confirmed buy, and full mirror sell form a sellable closed loop', () => {
    const harness = new CopytradeLifecycleHarness();
    const delay = harness.evaluateIngress(4_000);
    assert.equal(delay.skip, false);

    harness.addPendingBuy({
      positionId: 'pos-normal',
      rawAmount: '100000000000000000000',
      humanAmount: '100',
    });
    harness.confirmBuy('pos-normal');
    harness.markTargetFullSell('0xtargetsell');
    harness.followerBalanceRaw = 100000000000000000000n;

    const { snapshot, plan } = harness.buildMirrorSellPlan();
    assert.equal(snapshot.attribution.reasonCode, 'ATTRIBUTED_AMOUNT_RESOLVED');
    assert.equal(snapshot.attribution.sellAmountRaw, 100000000000000000000n);
    assert.equal(plan.kind, 'swap');
    if (plan.kind === 'swap') {
      assert.equal(plan.attributedBalance, 100000000000000000000n);
      assert.equal(plan.attributedReasonCode, 'ATTRIBUTED_AMOUNT_RESOLVED');
    }
  });

  test('target sells before buy confirmation and the pending lot survives into post-confirm mirror sell', () => {
    const harness = new CopytradeLifecycleHarness();
    harness.addPendingBuy({
      positionId: 'pos-race',
      rawAmount: '42000000000000000000',
      humanAmount: '42',
    });
    harness.markTargetFullSell('0xtargetsell-race');
    harness.confirmBuy('pos-race');
    harness.followerBalanceRaw = 42000000000000000000n;

    const { snapshot, plan } = harness.buildMirrorSellPlan();
    assert.equal(snapshot.attribution.reasonCode, 'ATTRIBUTED_AMOUNT_RESOLVED');
    assert.equal(snapshot.attribution.sellAmountRaw, 42000000000000000000n);
    assert.equal(plan.kind, 'swap');
    if (plan.kind === 'swap') {
      assert.equal(plan.attributedReasonCode, 'ATTRIBUTED_AMOUNT_RESOLVED');
    }
  });

  test('open position with missing amount still becomes sellable when shared snapshot consumes its armed pending lot', () => {
    const harness = new CopytradeLifecycleHarness();
    harness.positions.push(createPosition({
      id: 'pos-promoted-open',
      status: 'open',
      entryTxHash: '0xbuy-confirmed',
      entryAmountExact: null,
      entryAmountDec: null,
    }));
    harness.pendingLots.push(createPendingLot({
      id: 'lot-promoted-open',
      positionId: 'pos-promoted-open',
      status: 'sell_armed',
      expectedAmountRaw: '17140876501720000000000',
      targetSellTxHash: '0xtargetsell-promoted',
    }));
    harness.followerBalanceRaw = 17140876501720000000000n;

    const { snapshot, plan } = harness.buildMirrorSellPlan();
    assert.equal(snapshot.attribution.reasonCode, 'PENDING_ATTRIBUTED_AMOUNT_RESOLVED');
    assert.equal(snapshot.attribution.sellAmountRaw, 17140876501720000000000n);
    assert.equal(snapshot.attribution.pendingAttributedLotIds?.[0], 'lot-promoted-open');
    assert.equal(plan.kind, 'swap');
  });

  test('live path and retry path consume the same snapshot result instead of recomputing divergent sell amounts', () => {
    const harness = new CopytradeLifecycleHarness();
    harness.positions.push(createPosition({
      id: 'pos-retry',
      status: 'open',
      entryTxHash: '0xbuy-confirmed',
      entryAmountExact: null,
      entryAmountDec: null,
    }));
    harness.pendingLots.push(createPendingLot({
      id: 'lot-retry',
      positionId: 'pos-retry',
      status: 'sell_armed',
      expectedAmountRaw: '9000000000000000000',
      targetSellTxHash: '0xtargetsell-retry',
    }));
    harness.followerBalanceRaw = 9000000000000000000n;

    const live = harness.buildMirrorSellPlan();
    const retry = harness.buildMirrorSellPlan();

    assert.equal(live.snapshot.attribution.sellAmountRaw, retry.snapshot.attribution.sellAmountRaw);
    assert.equal(live.snapshot.attribution.reasonCode, retry.snapshot.attribution.reasonCode);
    assert.equal(live.plan.kind, 'swap');
    assert.equal(retry.plan.kind, 'swap');
    if (live.plan.kind === 'swap' && retry.plan.kind === 'swap') {
      assert.deepEqual(live.plan.pendingAttributedLotIds, retry.plan.pendingAttributedLotIds);
      assert.equal(live.plan.attributedBalance, retry.plan.attributedBalance);
    }
  });
});
