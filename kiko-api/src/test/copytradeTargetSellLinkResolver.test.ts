import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import prisma from '../db/prisma.js';
import { resolveTargetSellLink } from '../services/copytrade/reconcile/copytradeTargetSellLinkResolver.js';
import { cleanupCopytradeExecutionFixture, createCopytradeExecutionFixture, makeTxHash } from './helpers/copytradeExecutionHarness.js';

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

describe('copytrade target sell link resolver', () => {
  test('links target sell from leader buy anchor even when position created after target sell', async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const fixture = await createCopytradeExecutionFixture({
      seed: `target-link-${unique}`,
      chainId: 8453,
      tokenAddress: `0x${unique.replace(/[^a-f0-9]/gi, '').padEnd(40, 'a').slice(0, 40)}`,
      targetWallet: `0x${unique.replace(/[^a-f0-9]/gi, '').padEnd(40, 'b').slice(0, 40)}`,
    });
    const leaderBuyTxHash = makeTxHash(`leader-buy-${unique}`);
    const targetSellTxHash = makeTxHash(`target-sell-${unique}`);
    cleanupQueue.push({
      userId: fixture.userId,
      configId: fixture.configId,
      txHashes: [leaderBuyTxHash, targetSellTxHash],
    });

    const buyAt = new Date(Date.now() - 10_000);
    const sellAt = new Date(Date.now() - 5_000);
    const positionCreatedAt = new Date(Date.now() - 1_000);

    await prisma.walletTransaction.createMany({
      data: [
        {
          walletAddress: fixture.targetWallet.toLowerCase(),
          chain: 'base',
          chainId: 8453,
          txHash: leaderBuyTxHash,
          txType: 'TARGET_BUY',
          tokenAddress: fixture.tokenAddress.toLowerCase(),
          blockTimestamp: buyAt,
        },
        {
          walletAddress: fixture.targetWallet.toLowerCase(),
          chain: 'base',
          chainId: 8453,
          txHash: targetSellTxHash,
          txType: 'TARGET_SELL',
          tokenAddress: fixture.tokenAddress.toLowerCase(),
          blockTimestamp: sellAt,
        },
      ],
    });

    const linked = await resolveTargetSellLink({
      targetWallet: fixture.targetWallet,
      chainId: 8453,
      tokenAddress: fixture.tokenAddress,
      leaderBuyTxHash,
      positionCreatedAt,
    });

    assert.equal(linked.txHash, targetSellTxHash);
    assert.equal(linked.reasonCode, 'TARGET_SELL_LINKED_FROM_LEADER_BUY');
  });
});
