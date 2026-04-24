import test from 'node:test';
import assert from 'node:assert/strict';
import { __testOnlyDunePnl } from './dunePnlService.js';

test('buildSummaryFromTradeRows computes realized PNL with FIFO lots and carry-in cost basis', () => {
    const rows = [
        {
            token_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            token_symbol: 'MEME',
            side: 'buy',
            token_amount: 10,
            amount_usd: 100,
            in_window: false,
            block_time: '2026-03-01T00:00:00Z',
            block_number: 1,
            tx_hash: '0x1',
            evt_index: 1,
        },
        {
            token_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            token_symbol: 'MEME',
            side: 'buy',
            token_amount: 10,
            amount_usd: 200,
            in_window: true,
            block_time: '2026-04-01T00:00:00Z',
            block_number: 2,
            tx_hash: '0x2',
            evt_index: 1,
        },
        {
            token_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            token_symbol: 'MEME',
            side: 'sell',
            token_amount: 15,
            amount_usd: 450,
            in_window: true,
            block_time: '2026-04-02T00:00:00Z',
            block_number: 3,
            tx_hash: '0x3',
            evt_index: 1,
        },
    ];

    const summary = __testOnlyDunePnl.buildSummaryFromTradeRows('0xwallet', 'base', rows, 123);

    assert.equal(summary.totalBoughtUsd, 200);
    assert.equal(summary.totalSoldUsd, 450);
    assert.equal(summary.totalRealizedPnlUsd, 250);
    assert.equal(summary.totalRealizedProfitUsd, 250);
    assert.equal(summary.totalTrades, 1);
    assert.equal(summary.profitableTrades, 1);
    assert.equal(summary.tokens[0].remainingAmount, 5);
    assert.equal(summary.tokens[0].remainingCostUsd, 100);
    assert.equal(summary.tokens[0].costBasisComplete, true);
});

test('buildSummaryFromTradeRows excludes sell-only tokens with incomplete cost basis', () => {
    const rows = [
        {
            token_address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            token_symbol: 'OLD',
            side: 'sell',
            token_amount: 5,
            amount_usd: 50,
            in_window: true,
            block_time: '2026-04-02T00:00:00Z',
            block_number: 3,
            tx_hash: '0x3',
            evt_index: 1,
        },
    ];

    const summary = __testOnlyDunePnl.buildSummaryFromTradeRows('0xwallet', 'base', rows, 123);

    assert.equal(summary.totalRealizedPnlUsd, 0);
    assert.equal(summary.totalSoldUsd, 0);
    assert.equal(summary.totalTrades, 0);
    assert.equal(summary.tokens.length, 1);
    assert.equal(summary.tokens[0].soldUsd, 50);
    assert.equal(summary.tokens[0].costBasisComplete, false);
    assert.equal(summary.tokens[0].profitPct, null);
});

