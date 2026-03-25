import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeWalletTokenTrades } from './tokenAnalysis.js';

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

