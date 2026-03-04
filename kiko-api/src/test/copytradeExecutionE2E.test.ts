import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from '@prisma/client/runtime/library.js';

import prisma from '../db/prisma.js';
import { finalizeCopytradeBuyPosition } from '../services/copytrade-v2/positions/positionPersistence.js';
import {
  armPendingAttributedPositionsForMirrorSell,
  upsertPendingAttributedPosition,
} from '../services/copytrade-v2/positions/pendingAttributedPositionLedger.js';
import { resolveBuyConfirmationPromotionAction } from '../services/copytrade-v2/positions/buySellRaceCoordinator.js';
import { resolvePositionLedgerSnapshot } from '../services/copytrade-v2/positions/positionLedgerResolver.js';
import { buildEvmExitAttributionSnapshotFromResolvedInputs } from '../services/copytrade-v2/exit/exitAttributionSnapshotBuilder.js';
import { buildEvmExitPlanFromSnapshot } from '../services/copytrade-v2/exit/planner.js';
import { persistSuccessfulExit } from '../services/copytrade-v2/exit/persistence.js';
import {
  cleanupCopytradeExecutionFixture,
  createCopytradeExecutionFixture,
  makeAddress,
  makeTxHash,
} from './helpers/copytradeExecutionHarness.js';

const BASE_CHAIN_ID = 8453;
const TOKEN = '0xf30bf00edd0c22db54c9274b90d2a4c21fc09b07';

afterEach(() => {
  mock.restoreAll();
});

describe('copytrade execution ledger E2E', () => {
  test('ledger snapshot merges pending lot and target sell history into one sellable fact set', async () => {
    const targetWallet = makeAddress('ledger-target').toLowerCase();
    const fixture = await createCopytradeExecutionFixture({
      seed: 'ledger-snapshot',
      targetWallet,
      tokenAddress: TOKEN,
      chainId: BASE_CHAIN_ID,
    });
    const txHash = makeTxHash('ledger-buy');
    const targetSellTxHash = makeTxHash('ledger-target-sell');

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
          entryTxHash: 'PENDING_LEDGER',
          entryUsdValue: 100,
          status: 'pending',
        },
      });

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
        entryTxHash: txHash,
        leaderTxHash: makeTxHash('leader-buy'),
        entryUsdValue: 100,
        status: 'pending',
      });

      await upsertPendingAttributedPosition({
        positionId: pending.id,
        userId: fixture.userId,
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        entryTxHash: txHash,
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

      const ledger = await resolvePositionLedgerSnapshot({
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        targetWallet,
        positionIds: [pending.id],
      });

      assert.equal(ledger.positions.length, 1);
      assert.equal(ledger.pendingLots.length, 1);
      assert.equal(ledger.latestTargetSellTxHash, targetSellTxHash);
      assert.equal(ledger.lifecyclePhase, 'pending_only');
    } finally {
      await cleanupCopytradeExecutionFixture({
        userIds: [fixture.userId],
        configIds: [fixture.configId],
        txHashes: [txHash, targetSellTxHash],
      });
    }
  });

  test('pending buy can be armed, sold, consumed, and remain closed before open on later confirmation', async () => {
    const targetWallet = makeAddress('exec-target').toLowerCase();
    const fixture = await createCopytradeExecutionFixture({
      seed: 'execution-cycle',
      targetWallet,
      tokenAddress: TOKEN,
      chainId: BASE_CHAIN_ID,
    });
    const txHash = makeTxHash('exec-buy');
    const leaderTxHash = makeTxHash('exec-leader-buy');
    const targetSellTxHash = makeTxHash('exec-target-sell');
    const exitTxHash = makeTxHash('exec-exit');

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
          entryTxHash: 'PENDING_EXEC',
          entryUsdValue: 100,
          status: 'pending',
        },
      });

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
        entryTxHash: txHash,
        leaderTxHash,
        entryUsdValue: 100,
        status: 'pending',
      });

      await upsertPendingAttributedPosition({
        positionId: pending.id,
        userId: fixture.userId,
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        entryTxHash: txHash,
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
        tokenAddress: TOKEN,
        chainId: BASE_CHAIN_ID,
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
      assert.equal(ledger.pendingLots[0]?.status, 'sell_armed');

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
      assert.equal(snapshot.attribution.reasonCode, 'ATTRIBUTED_AMOUNT_RESOLVED');
      assert.equal(snapshot.attribution.sellAmountRaw, 2500000000000000000000n);

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

      const positionForPersistence = await prisma.position.findUniqueOrThrow({
        where: { id: pending.id },
        select: {
          id: true,
          entryPrice: true,
          entryUsdValue: true,
          entryAmountExact: true,
          entryAmountDec: true,
          exitRetryCount: true,
          tokenAddress: true,
          entryTxHash: true,
        },
      });

      await persistSuccessfulExit({
        positions: [{
          ...positionForPersistence,
          entryAmountDec: positionForPersistence.entryAmountDec as Decimal | null,
        }],
        txHash: exitTxHash,
        exitReason: 'mirror_sell',
        balance: 2500000000000000000000n,
        decimals: 18,
        exitPrice: 1,
      });

      const updatedPosition = await prisma.position.findUniqueOrThrow({
        where: { id: pending.id },
        select: { status: true, exitTxHash: true, exitReason: true },
      });
      assert.equal(updatedPosition.status, 'closed');
      assert.equal(updatedPosition.exitTxHash, exitTxHash);

      const updatedLedger = await resolvePositionLedgerSnapshot({
        chainId: BASE_CHAIN_ID,
        tokenAddress: TOKEN,
        targetWallet,
        positionIds: [pending.id],
      });
      assert.equal(updatedLedger.pendingLots[0]?.status, 'consumed');
      assert.equal(updatedLedger.lifecyclePhase, 'closed_only');

      const promotion = await resolveBuyConfirmationPromotionAction({
        positionId: pending.id,
      });
      assert.equal(promotion.action, 'closed_before_open');
      assert.equal(promotion.exitTxHash, exitTxHash);
    } finally {
      await cleanupCopytradeExecutionFixture({
        userIds: [fixture.userId],
        configIds: [fixture.configId],
        txHashes: [txHash, leaderTxHash, targetSellTxHash, exitTxHash],
      });
    }
  });

  test('planner forces exit for orphan mirror sell when target full exit is verified', () => {
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: TOKEN,
      chainId: BASE_CHAIN_ID,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1 },
      universalSlippageBps: 500,
      executionMode: 'normal',
      targetWallet: makeAddress('target'),
      snapshot: {
        tokenAddress: TOKEN,
        chainId: BASE_CHAIN_ID,
        walletAddress: makeAddress('wallet'),
        isMirrorSell: true,
        hasValidPrice: true,
        decimals: 18,
        balanceRaw: 1000n,
        balanceUsd: 1,
        treatAsEmptyOrDust: false,
        balanceRead: {
          status: 'success',
          value: 1000n,
          reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
          attemptCount: 1,
          lastError: null,
          providerSource: 'test',
        },
        positions: [{
          id: 'pos-1',
          tokenAddress: TOKEN,
          status: 'open',
          entryTxHash: 'MANUAL_BROKEN',
        }],
        pendingLots: [],
        latestTargetSellTxHash: makeTxHash('target-sell'),
        targetFullExitVerified: true,
        targetFullExitReasonCode: 'TARGET_FULL_EXIT_CONFIRMED',
        attribution: {
          eligiblePositions: [],
          sellAmountRaw: 0n,
          reasonCode: 'NO_CONFIRMED_POSITIONS',
          metrics: {},
          hasExternalBalance: false,
        },
      },
    });

    assert.equal(plan.kind, 'swap');
    assert.equal(plan.attributedReasonCode, 'FORCED_FULL_EXIT_FROM_LEDGER');
  });
});
