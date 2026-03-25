import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEarlyBuyerTokenPnl, summarizeWalletTokenTrades } from './tokenAnalysis.js';

test('summarizeWalletTokenTrades picks first buy and first sell for a token', () => {
    const tokenAddress = '0x1111111111111111111111111111111111111111';
    const history = [
        {
            txHash: '0x1',
            txType: 'TRANSFER_IN' as const,
            blockTimestamp: new Date('2026-03-25T00:00:00Z'),
            amount: '100',
            tokenAddress,
            tokenSymbol: 'TKN',
        },
        {
            txHash: '0x2',
            txType: 'BUY' as const,
            blockTimestamp: new Date('2026-03-25T00:01:00Z'),
            amount: '150',
            tokenAddress,
            tokenSymbol: 'TKN',
        },
        {
            txHash: '0x3',
            txType: 'SELL' as const,
            blockTimestamp: new Date('2026-03-25T00:02:00Z'),
            amount: '50',
            tokenAddress,
            tokenSymbol: 'TKN',
        },
        {
            txHash: '0x4',
            txType: 'BUY' as const,
            blockTimestamp: new Date('2026-03-25T00:03:00Z'),
            amount: '25',
            tokenAddress,
            tokenSymbol: 'TKN',
        },
    ];

    const summary = summarizeWalletTokenTrades(history, tokenAddress);

    assert.ok(summary);
    assert.equal(summary?.totalTrades, 4);
    assert.equal(summary?.buyCount, 2);
    assert.equal(summary?.sellCount, 1);
    assert.equal(summary?.firstTrade?.txHash, '0x1');
    assert.equal(summary?.firstBuy?.txHash, '0x2');
    assert.equal(summary?.firstSell?.txHash, '0x3');
    assert.equal(summary?.recentTrades.length, 4);
});

test('resolveEarlyBuyerTokenPnl prefers dune token-level breakdown when available', async () => {
    const tokenAddress = '0x1111111111111111111111111111111111111111';

    const result = await resolveEarlyBuyerTokenPnl(
        '0xwallet',
        tokenAddress,
        'bsc',
        30,
        Promise.resolve({
            getWalletPnlFromDune: async () => ({
                tokens: [
                    {
                        tokenAddress,
                        boughtUsd: 123.45,
                        soldUsd: 456.78,
                        pnlUsd: 333.33,
                        profitPct: 270,
                    },
                ],
            }),
            calculateWalletPnlManual: async () => {
                throw new Error('manual path should not execute when dune token row exists');
            },
        })
    );

    assert.deepEqual(result, {
        source: 'dune',
        coverage: 'token_level_breakdown',
        days: 30,
        totalBuyUsd: 123.45,
        totalSellUsd: 456.78,
        realizedPnlUsd: 333.33,
        unrealizedPnlUsd: null,
        profitPct: 270,
        currentTokenAmount: null,
    });
});

test('resolveEarlyBuyerTokenPnl falls back to manual token breakdown', async () => {
    const tokenAddress = '0x1111111111111111111111111111111111111111';

    const result = await resolveEarlyBuyerTokenPnl(
        '0xwallet',
        tokenAddress,
        'bsc',
        30,
        Promise.resolve({
            getWalletPnlFromDune: async () => ({ tokens: [] }),
            calculateWalletPnlManual: async () => ({
                tokenBreakdown: {
                    [tokenAddress.toLowerCase()]: {
                        totalBuyUsd: 200,
                        totalSellUsd: 350,
                        realizedPnlUsd: 150,
                        totalAmount: 10,
                        totalCostUsd: 100,
                        lastPrice: 12,
                    },
                },
            }),
        })
    );

    assert.deepEqual(result, {
        source: 'manual',
        coverage: 'approx_manual',
        days: 30,
        totalBuyUsd: 200,
        totalSellUsd: 350,
        realizedPnlUsd: 150,
        unrealizedPnlUsd: 20,
        profitPct: 75,
        currentTokenAmount: '10',
    });
});
