import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import prisma from '../db/prisma.js';
import { executeSwapViaPort } from '../services/swap/swapExecutionPort.js';
import { createOrderRuntimeContext, recordLifecycleOnOrder } from '../services/order-runtime/context.js';
import { createExitOrderRuntimeContext } from '../services/copytrade-v2/exit/runtime.js';
import { executeEvmExitPlan } from '../services/copytrade-v2/exit/executor.js';
import { finalizeCopytradeBuyPosition } from '../services/copytrade-v2/positions/positionPersistence.js';
import {
  armPendingAttributedPositionsForMirrorSell,
  listPendingAttributedPositions,
  upsertPendingAttributedPosition,
} from '../services/copytrade-v2/positions/pendingAttributedPositionLedger.js';
import { resolvePositionLedgerSnapshot } from '../services/copytrade-v2/positions/positionLedgerResolver.js';
import { buildEvmExitAttributionSnapshotFromResolvedInputs } from '../services/copytrade-v2/exit/exitAttributionSnapshotBuilder.js';
import { buildEvmExitPlanFromSnapshot } from '../services/copytrade-v2/exit/planner.js';
import { persistSuccessfulExit } from '../services/copytrade-v2/exit/persistence.js';
import { resolveBuyConfirmationPromotionAction } from '../services/copytrade-v2/positions/buySellRaceCoordinator.js';
import {
  cleanupCopytradeExecutionFixture,
  createCopytradeExecutionFixture,
  makeAddress,
  makeTxHash,
} from './helpers/copytradeExecutionHarness.js';
import {
  getCapturedSwapExecutions,
  installCopytradeExecutionPortHarness,
  queueSwapExecutionResult,
  resetCopytradeExecutionPortHarness,
} from './helpers/copytradeExecutionPortHarness.js';

const BASE_CHAIN_ID = 8453;
const TOKEN = '0xf30bf00edd0c22db54c9274b90d2a4c21fc09b07';
const WETH = 'ETH';

function buildSwapResult(params: {
  userId: string;
  walletAddress: string;
  chainId: number;
  side: 'buy' | 'sell';
  txHash: string;
  tokenIn: string;
  tokenOut: string;
  amountOut?: string;
}) {
  const runtimeContext = createOrderRuntimeContext({
    userId: params.userId,
    walletAddress: params.walletAddress,
    chainId: params.chainId,
    side: params.side,
    mode: 'copytrade',
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
  });
  recordLifecycleOnOrder(runtimeContext, {
    status: 'confirmed_success',
    txHash: params.txHash,
    attempts: 1,
    chainId: params.chainId,
  });
  return {
    success: true as const,
    txHash: params.txHash,
    amountOut: params.amountOut,
    txLifecycle: {
      status: 'confirmed_success' as const,
      txHash: params.txHash,
      attempts: 1,
      chainId: params.chainId,
    },
    runtimeContext,
    metadata: {
      provider: 'test-port',
      mode: 'copytrade' as const,
      txLifecycleStatus: 'confirmed_success' as const,
    },
  };
}

afterEach(() => {
  resetCopytradeExecutionPortHarness();
});

describe('copytrade executeSwap boundary E2E', () => {
  test('EVM exit executor retries through shared execution port and preserves sell request contract', async () => {
    installCopytradeExecutionPortHarness();

    queueSwapExecutionResult({
      success: false,
      error: 'primary_exit_failed',
      metadata: {
        provider: 'test-port',
        mode: 'copytrade',
      },
    });
    queueSwapExecutionResult(
      buildSwapResult({
        userId: 'did:exec-port:retry',
        walletAddress: makeAddress('retry-wallet'),
        chainId: BASE_CHAIN_ID,
        side: 'sell',
        txHash: makeTxHash('retry-success'),
        tokenIn: TOKEN,
        tokenOut: WETH,
      }),
    );

    const plan = {
      kind: 'swap' as const,
      userId: 'did:exec-port:retry',
      walletAddress: makeAddress('retry-wallet'),
      tokenAddress: TOKEN,
      chainId: BASE_CHAIN_ID,
      exitReason: 'mirror_sell' as const,
      tokenInfo: { price: 1, symbol: 'FELIX' },
      balance: 2500000000000000000000n,
      decimals: 18,
      balanceUsd: 100,
      attributedBalance: 2500000000000000000000n,
      amountInHuman: '2500',
      retryAmountInHuman: '2475',
      initialSlippageBps: 500,
      retrySlippageBps: 900,
      executionMode: 'turbo' as const,
      sellRoutePolicy: 'external_primary' as const,
      runtimeContext: createExitOrderRuntimeContext({
        userId: 'did:exec-port:retry',
        walletAddress: makeAddress('retry-wallet'),
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        exitReason: 'mirror_sell',
        targetWallet: makeAddress('retry-target'),
      }),
      positions: [],
      pendingAttributedLotIds: [],
      attributedReasonCode: 'ATTRIBUTED_AMOUNT_RESOLVED' as const,
      attributionMetrics: { source: 'test' },
      hasExternalBalance: false,
    };

    const result = await executeEvmExitPlan(plan);
    assert.equal(result.success, true);
    assert.equal(result.txHash, makeTxHash('retry-success'));

    const captured = getCapturedSwapExecutions();
    assert.equal(captured.length, 2);
    assert.equal(captured[0]?.request.executionContext?.executionStep, 'sell_external_primary');
    assert.equal(captured[1]?.request.executionContext?.executionStep, 'sell_external_retry');
    assert.equal(captured[1]?.request.amountIn, '2475');
    assert.equal(captured[1]?.request.requireConfirmedTx, true);
    assert.equal(captured[1]?.request.tokenIn, TOKEN);
    assert.equal(captured[1]?.request.tokenOut, 'ETH');
  });

  test('buy result from shared execution port flows into pending lot, exit plan, and closed-before-open persistence', async () => {
    installCopytradeExecutionPortHarness();

    const targetWallet = makeAddress('port-target').toLowerCase();
    const fixture = await createCopytradeExecutionFixture({
      seed: 'execute-port-cycle',
      targetWallet,
      tokenAddress: TOKEN,
      chainId: BASE_CHAIN_ID,
    });
    const buyTxHash = makeTxHash('port-buy');
    const leaderTxHash = makeTxHash('port-leader-buy');
    const targetSellTxHash = makeTxHash('port-target-sell');
    const exitTxHash = makeTxHash('port-exit');

    try {
      const pending = await prisma.position.create({
        data: {
          userId: fixture.userId,
          configId: fixture.configId,
          tokenAddress: TOKEN,
          tokenSymbol: 'FELIX',
          chainId: BASE_CHAIN_ID,
          entryPrice: 1,
          entryAmount: '0',
          entryTxHash: 'PENDING_EXECUTE_PORT',
          entryUsdValue: 100,
          status: 'pending',
        },
      });

      queueSwapExecutionResult(
        buildSwapResult({
          userId: fixture.userId,
          walletAddress: fixture.walletAddress,
          chainId: BASE_CHAIN_ID,
          side: 'buy',
          txHash: buyTxHash,
          tokenIn: WETH,
          tokenOut: TOKEN,
          amountOut: '2500',
        }),
      );

      const buyResult = await executeSwapViaPort({
        userId: fixture.userId,
        walletAddress: fixture.walletAddress,
        tokenIn: WETH,
        tokenOut: TOKEN,
        amountIn: '0.1',
        chainId: BASE_CHAIN_ID,
        slippageBps: 500,
        mode: 'copytrade',
        executionContext: {
          executionStep: 'buy_step_1',
          strictReplica: false,
          sellRoutePolicy: 'direct_primary',
          sourceTxHash: leaderTxHash,
        },
        userSettings: {
          fastSwapMode: true,
          copyTradeExecutionMode: 'turbo',
        },
      });

      assert.equal(buyResult.success, true);
      assert.equal(buyResult.amountOut, '2500');

      await finalizeCopytradeBuyPosition({
        pendingPositionId: pending.id,
        userId: fixture.userId,
        configId: fixture.configId,
        tokenAddress: TOKEN,
        tokenSymbol: 'FELIX',
        chainId: BASE_CHAIN_ID,
        entryPrice: 1,
        entryAmount: '100',
        attributedEntryAmountExact: '2500000000000000000000',
        entryTxHash: buyResult.txHash!,
        leaderTxHash,
        entryUsdValue: 100,
        status: 'pending',
      });

      await upsertPendingAttributedPosition({
        positionId: pending.id,
        userId: fixture.userId,
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        entryTxHash: buyResult.txHash!,
        leaderBuyTxHash: leaderTxHash,
        expectedAmountRaw: '2500000000000000000000',
        reasonCode: 'swap_amount_out_base',
      });

      await prisma.walletTransaction.create({
        data: {
          walletAddress: targetWallet,
          chain: 'base',
          txHash: targetSellTxHash,
          txType: 'TARGET_SELL',
          tokenAddress: TOKEN,
          blockTimestamp: new Date(),
          chainId: BASE_CHAIN_ID,
        },
      });

      const armed = await armPendingAttributedPositionsForMirrorSell({
        userId: fixture.userId,
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        positionIds: [pending.id],
        targetSellTxHash,
        reasonCode: 'target_sell_seen_in_history',
      });
      assert.equal(armed, 1);

      const ledger = await resolvePositionLedgerSnapshot({
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        targetWallet,
        positionIds: [pending.id],
      });

      const snapshot = buildEvmExitAttributionSnapshotFromResolvedInputs({
        tokenAddress: TOKEN,
        chainId: BASE_CHAIN_ID,
        walletAddress: fixture.walletAddress,
        exitReason: 'mirror_sell',
        tokenInfo: { price: 1, symbol: 'FELIX' },
        decimals: 18,
        onChainBalanceRaw: 2500000000000000000000n,
        balanceRead: {
          status: 'success',
          value: 2500000000000000000000n,
          reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
          attemptCount: 1,
          lastError: null,
          providerSource: 'test',
        },
        positions: ledger.positions,
        pendingLots: ledger.pendingLots,
      });
      const plan = buildEvmExitPlanFromSnapshot({
        userId: fixture.userId,
        tokenAddress: TOKEN,
        chainId: BASE_CHAIN_ID,
        exitReason: 'mirror_sell',
        tokenInfo: { price: 1, symbol: 'FELIX' },
        universalSlippageBps: 500,
        executionMode: 'turbo',
        targetWallet,
        snapshot,
      });
      assert.equal(plan.kind, 'swap');

      queueSwapExecutionResult(
        buildSwapResult({
          userId: fixture.userId,
          walletAddress: fixture.walletAddress,
          chainId: BASE_CHAIN_ID,
          side: 'sell',
          txHash: exitTxHash,
          tokenIn: TOKEN,
          tokenOut: WETH,
        }),
      );

      const exitResult = await executeEvmExitPlan(plan);
      assert.equal(exitResult.success, true);
      assert.equal(exitResult.txHash, exitTxHash);

      const persisted = await prisma.position.findUniqueOrThrow({
        where: { id: pending.id },
        select: {
          id: true,
          entryPrice: true,
          entryUsdValue: true,
          entryAmountExact: true,
          entryAmountDec: true,
          tokenAddress: true,
          entryTxHash: true,
        },
      });
      await persistSuccessfulExit({
        positions: [persisted],
        txHash: exitTxHash,
        exitReason: 'mirror_sell',
        balance: 2500000000000000000000n,
        decimals: 18,
        exitPrice: 1.1,
      });

      const refreshedPosition = await prisma.position.findUniqueOrThrow({
        where: { id: pending.id },
        select: {
          status: true,
          exitTxHash: true,
          exitReason: true,
        },
      });
      assert.equal(refreshedPosition.status, 'closed');
      assert.equal(refreshedPosition.exitTxHash, exitTxHash);

      const lots = await listPendingAttributedPositions({
        userId: fixture.userId,
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        positionIds: [pending.id],
      });
      assert.equal(lots[0]?.status, 'consumed');
      assert.equal(lots[0]?.exitTxHash, exitTxHash);

      const promotion = await resolveBuyConfirmationPromotionAction({
        positionId: pending.id,
      });
      assert.equal(promotion.action, 'closed_before_open');

      const captured = getCapturedSwapExecutions();
      assert.equal(captured.length, 2);
      assert.equal(captured[0]?.request.executionContext?.executionStep, 'buy_step_1');
      assert.equal(captured[0]?.request.tokenIn, WETH);
      assert.equal(captured[0]?.request.tokenOut, TOKEN);
      assert.equal(captured[1]?.request.executionContext?.executionStep, 'sell_external_primary');
    } finally {
      await cleanupCopytradeExecutionFixture({
        userIds: [fixture.userId],
        configIds: [fixture.configId],
        txHashes: [buyTxHash, targetSellTxHash, exitTxHash],
      });
    }
  });
});
