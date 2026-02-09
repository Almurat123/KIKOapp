import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTargetRealizedPnl, type TargetBuySellRow } from './targetWalletPnl.js';

const OPTS = {
  minTxUsd: 0.000001,
  maxTxUsd: 250000,
};

function at(ts: string): Date {
  return new Date(ts);
}

test('realized pnl: buy $30 then full sell $100 => +$70 profit', () => {
  const rows: TargetBuySellRow[] = [
    {
      id: 1,
      txType: 'TARGET_BUY',
      tokenAddress: '0xabc',
      amount: '10',
      valueUsd: 30,
      blockTimestamp: at('2026-02-01T00:00:00Z'),
    },
    {
      id: 2,
      txType: 'TARGET_SELL',
      tokenAddress: '0xabc',
      amount: '10',
      valueUsd: 100,
      blockTimestamp: at('2026-02-01T01:00:00Z'),
    },
  ];

  const agg = calculateTargetRealizedPnl(rows, OPTS);
  assert.equal(agg.targetRealizedProfitUsd, 70);
  assert.equal(agg.targetRealizedLossUsd, 0);
  assert.equal(agg.targetRealizedPnlUsd, 70);
});

test('realized pnl: buy $30 then full sell $15 => -$15 loss', () => {
  const rows: TargetBuySellRow[] = [
    {
      id: 1,
      txType: 'TARGET_BUY',
      tokenAddress: '0xabc',
      amount: '10',
      valueUsd: 30,
      blockTimestamp: at('2026-02-01T00:00:00Z'),
    },
    {
      id: 2,
      txType: 'TARGET_SELL',
      tokenAddress: '0xabc',
      amount: '10',
      valueUsd: 15,
      blockTimestamp: at('2026-02-01T01:00:00Z'),
    },
  ];

  const agg = calculateTargetRealizedPnl(rows, OPTS);
  assert.equal(agg.targetRealizedProfitUsd, 0);
  assert.equal(agg.targetRealizedLossUsd, 15);
  assert.equal(agg.targetRealizedPnlUsd, -15);
});

test('partial sell realizes only matched portion', () => {
  const rows: TargetBuySellRow[] = [
    {
      id: 1,
      txType: 'TARGET_BUY',
      tokenAddress: '0xabc',
      amount: '10',
      valueUsd: 30,
      blockTimestamp: at('2026-02-01T00:00:00Z'),
    },
    {
      id: 2,
      txType: 'TARGET_SELL',
      tokenAddress: '0xabc',
      amount: '5',
      valueUsd: 20,
      blockTimestamp: at('2026-02-01T01:00:00Z'),
    },
  ];

  const agg = calculateTargetRealizedPnl(rows, OPTS);
  // Cost for 5 units = 15, proceeds = 20
  assert.equal(agg.targetRealizedPnlUsd, 5);
  assert.equal(agg.targetRealizedProfitUsd, 5);
  assert.equal(agg.targetRealizedLossUsd, 0);
});

test('sell with no matched buy does not pollute realized pnl (airdrop/spam transfer style)', () => {
  const rows: TargetBuySellRow[] = [
    {
      id: 1,
      txType: 'TARGET_SELL',
      tokenAddress: '0xabc',
      amount: '1000',
      valueUsd: 8000000, // over threshold, should be ignored
      blockTimestamp: at('2026-02-01T00:00:00Z'),
    },
    {
      id: 2,
      txType: 'TARGET_SELL',
      tokenAddress: '0xabc',
      amount: '1000',
      valueUsd: 100, // valid usd but unmatched qty
      blockTimestamp: at('2026-02-01T01:00:00Z'),
    },
  ];

  const agg = calculateTargetRealizedPnl(rows, OPTS);
  assert.equal(agg.targetRealizedPnlUsd, 0);
  assert.equal(agg.targetRealizedProfitUsd, 0);
  assert.equal(agg.targetRealizedLossUsd, 0);
  assert.equal(agg.ignoredTxCount, 1);
  assert.equal(agg.unmatchedSellCount, 1);
});
