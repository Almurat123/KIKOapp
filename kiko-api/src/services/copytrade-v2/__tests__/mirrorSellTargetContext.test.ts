import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveMirrorSellTargetContext,
  __mirrorSellTargetContextTest,
} from '../exit/mirrorSellTargetContext.js';

test('buildMirrorSellTargetContextKey is stable for the same mirror-sell cohort', () => {
  const key = __mirrorSellTargetContextTest.buildMirrorSellTargetContextKey({
    targetWallet: '0x2CD32Fb42748774FAfde72d8607F16ccc5F5C0ed',
    chainId: 8453,
    tokenAddress: '0xbEA8d811778525F84D771BcEbC5E20eb64A94b07',
    leaderBuyTxHash: '0xleader',
    anchorTimestampMs: 1_741_996_800_000,
  });

  assert.equal(
    key,
    'copytrade_mirror_sell_target_context:8453:0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed:0xbea8d811778525f84d771bcebc5e20eb64a94b07:0xleader:1741996800000'
  );
});

test('resolveMirrorSellTargetContext shares resolved target state through cache wrapper', async () => {
  let producerRuns = 0;
  const cache = new Map<string, unknown>();

  const resultA = await resolveMirrorSellTargetContext(
    {
      targetWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
      chainId: 8453,
      tokenAddress: '0xbea8d811778525f84d771bcebc5e20eb64a94b07',
      leaderBuyTxHash: '0xleader',
      positionCreatedAt: new Date('2026-03-15T05:33:30.000Z'),
      latestTargetSellTxHash: null,
    },
    {
      withScopedCache: async ({ key, producer }) => {
        if (cache.has(key)) {
          return cache.get(key) as any;
        }
        producerRuns += 1;
        const value = await producer();
        cache.set(key, value);
        return value;
      },
      verifyTargetFullExit: async () => ({
        isFullExit: true,
        reasonCode: 'TARGET_FULL_EXIT_CONFIRMED',
        remainingBalanceRaw: '0',
        decimals: 18,
        dustThresholdRaw: '1000000000000',
      }),
      resolveTargetSellLink: async () => ({
        txHash: '0xsell',
        blockTimestamp: new Date('2026-03-15T05:33:30.500Z'),
        reasonCode: 'TARGET_SELL_LINKED_FROM_LEADER_BUY',
      }),
      resolveMirrorSellRatioContext: async () => ({
        ratioBps: 10_000,
        reasonCode: 'RATIO_RESOLVED',
      }),
    },
  );

  const resultB = await resolveMirrorSellTargetContext(
    {
      targetWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
      chainId: 8453,
      tokenAddress: '0xbea8d811778525f84d771bcebc5e20eb64a94b07',
      leaderBuyTxHash: '0xleader',
      positionCreatedAt: new Date('2026-03-15T05:33:30.000Z'),
      latestTargetSellTxHash: null,
    },
    {
      withScopedCache: async ({ key, producer }) => {
        if (cache.has(key)) {
          return cache.get(key) as any;
        }
        producerRuns += 1;
        const value = await producer();
        cache.set(key, value);
        return value;
      },
      verifyTargetFullExit: async () => {
        throw new Error('producer should not rerun');
      },
      resolveTargetSellLink: async () => {
        throw new Error('producer should not rerun');
      },
      resolveMirrorSellRatioContext: async () => {
        throw new Error('producer should not rerun');
      },
    },
  );

  assert.equal(producerRuns, 1);
  assert.deepEqual(resultA, {
    latestTargetSellTxHash: '0xsell',
    targetFullExitVerified: true,
    targetFullExitReasonCode: 'TARGET_FULL_EXIT_CONFIRMED',
    targetSellRatioBps: 10_000,
    targetSellRatioReasonCode: 'RATIO_RESOLVED',
  });
  assert.deepEqual(resultB, resultA);
});
