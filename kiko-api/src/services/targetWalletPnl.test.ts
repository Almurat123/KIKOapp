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

test('fifo multi-sell from one buy: 1 ETH->1000, then 200->0.5 ETH, 800->1.5 ETH', () => {
  const rows: TargetBuySellRow[] = [
    {
      id: 1,
      txType: 'TARGET_BUY',
      tokenAddress: '0xabc',
      amount: '1000',
      valueUsd: 2000, // 1 ETH assumed $2000
      blockTimestamp: at('2026-02-01T00:00:00Z'),
    },
    {
      id: 2,
      txType: 'TARGET_SELL',
      tokenAddress: '0xabc',
      amount: '200',
      valueUsd: 1000, // 0.5 ETH assumed $2000
      blockTimestamp: at('2026-02-01T00:01:00Z'),
    },
    {
      id: 3,
      txType: 'TARGET_SELL',
      tokenAddress: '0xabc',
      amount: '800',
      valueUsd: 3000, // 1.5 ETH assumed $2000
      blockTimestamp: at('2026-02-01T00:02:00Z'),
    },
  ];

  const agg = calculateTargetRealizedPnl(rows, OPTS);
  assert.equal(agg.buyCount, 1);
  assert.equal(agg.sellCount, 2);
  // Cost basis: 1000 * $2 = $2000
  // Proceeds: $1000 + $3000 = $4000
  // Realized PnL: +$2000
  assert.equal(agg.targetRealizedPnlUsd, 2000);
  assert.equal(agg.targetRealizedProfitUsd, 2000);
  assert.equal(agg.targetRealizedLossUsd, 0);
  assert.equal(agg.unmatchedSellCount, 0);
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
