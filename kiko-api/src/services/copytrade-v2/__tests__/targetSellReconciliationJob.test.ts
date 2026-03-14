import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOrphanRecoveryMarkers,
  resolveRecentTargetSellSignals,
  shouldSkipOrphanRecoveryResidual,
} from '../reconcile/targetSellReconciliationJob.js';

test('recent target sell signals resolve sold token from tokenInAddress for swaps', () => {
  const [signal] = resolveRecentTargetSellSignals([{
    walletAddress: '0x1234567890123456789012345678901234567890',
    chainId: 56,
    txHash: '0xabc',
    txType: 'TARGET_TOKEN_SWAP',
    tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    tokenInAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    tokenSymbol: 'AAA',
    tokenInSymbol: 'BBB',
    amountIn: '1000000000000000000',
    blockTimestamp: new Date('2026-03-11T07:32:44.000Z'),
  }]);

  assert.equal(signal.tokenAddress, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(signal.tokenSymbol, 'BBB');
  assert.equal(signal.amountIn, '1000000000000000000');
});

test('recent target sell signals dedupe repeated webhook rows by tx hash and keep the latest timestamp', () => {
  const signals = resolveRecentTargetSellSignals([
    {
      walletAddress: '0x1234567890123456789012345678901234567890',
      chainId: 56,
      txHash: '0xabc',
      txType: 'TARGET_SELL',
      tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      tokenInAddress: null,
      tokenSymbol: 'AAA',
      tokenInSymbol: null,
      amountIn: '1000000000000000000',
      blockTimestamp: new Date('2026-03-11T07:31:00.000Z'),
    },
    {
      walletAddress: '0x1234567890123456789012345678901234567890',
      chainId: 56,
      txHash: '0xabc',
      txType: 'TARGET_SELL',
      tokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      tokenInAddress: null,
      tokenSymbol: 'AAA',
      tokenInSymbol: null,
      amountIn: '1000000000000000000',
      blockTimestamp: new Date('2026-03-11T07:32:00.000Z'),
    },
  ]);

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.blockTimestamp.toISOString(), '2026-03-11T07:32:00.000Z');
});

test('orphan recovery markers produce invalid entry tx hash and stable leader marker', () => {
  const markers = buildOrphanRecoveryMarkers('0xAbC123');

  assert.equal(markers.entryTxHash, 'RECOVERED_ONCHAIN_0xabc123');
  assert.equal(markers.leaderTxHash, 'ORPHAN_RECOVERY_0xabc123');
});

test('orphan recovery residual guard skips tiny follower tails after near-full exit', () => {
  const skipped = shouldSkipOrphanRecoveryResidual({
    followerBalanceRaw: 1_000_000000000000000n,
    targetSellAmountRaw: 100_000_000000000000000n,
    skipRatioBps: 500,
  });

  assert.equal(skipped, true);
});

test('orphan recovery residual guard keeps materially large follower balances eligible', () => {
  const skipped = shouldSkipOrphanRecoveryResidual({
    followerBalanceRaw: 20_000_000000000000000n,
    targetSellAmountRaw: 100_000_000000000000000n,
    skipRatioBps: 500,
  });

  assert.equal(skipped, false);
});
