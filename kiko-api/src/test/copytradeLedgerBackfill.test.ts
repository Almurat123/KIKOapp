import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import prisma from '../db/prisma.js';
import { syncCopytradeLedgerFromLegacy } from '../services/copytrade-v2/ledger/copytradeLedgerRepository.js';
import { createCopytradeExecutionFixture, cleanupCopytradeExecutionFixture, makeTxHash } from './helpers/copytradeExecutionHarness.js';

const CHAIN_ID = 8453;
const TOKEN = '0x1f30bf00edd0c22db54c9274b90d2a4c21fc09b07';

const cleanupQueue: Array<{ userId: string; configId: string; txHashes: string[] }> = [];

afterEach(async () => {
  while (cleanupQueue.length > 0) {
    const entry = cleanupQueue.pop();
    if (!entry) continue;
    await cleanupCopytradeExecutionFixture({
      userIds: [entry.userId],
      configIds: [entry.configId],
      txHashes: entry.txHashes,
    });
  }
});

describe('copytrade ledger backfill', () => {
  test('backfills physical ledger from legacy position, pending lot, and target sell history', async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const fixture = await createCopytradeExecutionFixture({
      seed: `ledger-backfill-${unique}`,
      targetWallet: `0x${unique.replace(/[^a-f0-9]/gi, '').padEnd(40, '1').slice(0, 40)}`,
      tokenAddress: TOKEN,
      chainId: CHAIN_ID,
    });
    const targetSellTxHash = makeTxHash(`ledger-target-sell-${unique}`);
    cleanupQueue.push({
      userId: fixture.userId,
      configId: fixture.configId,
      txHashes: [targetSellTxHash],
    });

    const position = await prisma.position.create({
      data: {
        userId: fixture.userId,
        configId: fixture.configId,
        tokenAddress: TOKEN,
        tokenSymbol: 'LEDGER',
        chainId: CHAIN_ID,
        entryPrice: 1,
        entryAmount: '1000',
        entryAmountExact: '1000',
        entryAmountDec: '1000',
        entryTxHash: makeTxHash(`ledger-follower-buy-${unique}`),
        leaderTxHash: makeTxHash(`ledger-leader-buy-${unique}`),
        entryUsdValue: 100,
        status: 'pending',
      },
    });

    await prisma.pendingAttributedPosition.create({
      data: {
        userId: fixture.userId,
        positionId: position.id,
        chainId: CHAIN_ID,
        tokenAddress: TOKEN,
        entryTxHash: position.entryTxHash,
        expectedAmountRaw: '1000',
        expectedAmountDec: '1000',
        status: 'sell_armed',
        reasonCode: 'test_pending_lot',
        targetSellTxHash,
      },
    });

    await prisma.walletTransaction.create({
      data: {
        walletAddress: fixture.targetWallet.toLowerCase(),
        chain: 'base',
        chainId: CHAIN_ID,
        txHash: targetSellTxHash,
        txType: 'TARGET_SELL',
        tokenAddress: TOKEN.toLowerCase(),
        blockTimestamp: new Date(),
      },
    });

    const snapshot = await syncCopytradeLedgerFromLegacy({
      positionId: position.id,
      targetWallet: fixture.targetWallet,
      lifecycleState: 'FOLLOWER_EXIT_ARMED',
      targetFullExitVerified: true,
      targetSellTxHash,
      lastExecutionState: 'target_full_exit_verified',
      lastExecutionReasonCode: 'strict_full_exit_reconciled',
    });

    assert.ok(snapshot);
    const ledger = await prisma.copytradePositionLedger.findUnique({
      where: { positionIdLegacy: position.id },
    });
    assert.ok(ledger);
    assert.equal(ledger?.lifecycleState, 'FOLLOWER_EXIT_ARMED');
    assert.equal(ledger?.targetFullExitVerified, true);
    assert.equal(ledger?.pendingOwnedAmountRaw, '1000');
    assert.equal(ledger?.effectiveOwnedAmountRaw, '1000');
    assert.equal(ledger?.targetSellTxHash, targetSellTxHash);
  });
});
