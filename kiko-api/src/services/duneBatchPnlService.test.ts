import test from 'node:test';
import assert from 'node:assert/strict';
import {
    __testOnlyDuneBatchPnl,
    getBatchWalletPortfolioPnlFromDune,
    getBatchWalletTokenPnlFromDune,
} from './duneBatchPnlService.js';

test('buildBatchTokenPnlSql embeds all wallets in a single VALUES clause', () => {
    const sql = __testOnlyDuneBatchPnl.buildBatchTokenPnlSql(
        ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'],
        'ethereum',
        30,
        '0x3333333333333333333333333333333333333333'
    );

    assert.match(sql, /WITH input_wallets\(wallet_address\) AS/);
    assert.match(sql, /\('0x1111111111111111111111111111111111111111'\),/);
    assert.match(sql, /\('0x2222222222222222222222222222222222222222'\)/);
    assert.match(sql, /lower\('0x3333333333333333333333333333333333333333'\)/);
});

test('getBatchWalletTokenPnlFromDune returns one result per requested wallet', async () => {
    const rows = [
        {
            wallet_address: '0x1111111111111111111111111111111111111111',
            blockchain: 'ethereum',
            token_address: '0x3333333333333333333333333333333333333333',
            token_symbol: 'TEST',
            total_buy_usd: '120',
            total_sell_usd: '180',
            realized_pnl_usd: '60',
            profit_pct: '50',
        },
    ];

    const result = await getBatchWalletTokenPnlFromDune(
        [
            '0x1111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222',
        ],
        'eth',
        30,
        '0x3333333333333333333333333333333333333333',
        {
            apiKey: 'test-key',
            createClient: () => ({
                exec: {
                    executeSql: async () => ({ execution_id: 'exec-1', state: 'QUERY_STATE_PENDING' as any }),
                    getExecutionStatus: async () => ({ state: 'QUERY_STATE_COMPLETED' as any }),
                    getExecutionResults: async () => ({
                        result: {
                            rows,
                            metadata: { total_row_count: rows.length },
                        },
                        next_offset: rows.length,
                    }),
                },
            }),
            sleep: async () => undefined,
            now: () => Date.now(),
        }
    );

    assert.equal(result.length, 2);
    assert.equal(result[0].walletAddress, '0x1111111111111111111111111111111111111111');
    assert.equal(result[0].realizedPnlUsd, 60);
    assert.equal(result[1].walletAddress, '0x2222222222222222222222222222222222222222');
    assert.equal(result[1].realizedPnlUsd, 0);
});

test('getBatchWalletPortfolioPnlFromDune filters quote tokens and preserves zero-trade wallets', async () => {
    const rows = [
        {
            wallet_address: '0x1111111111111111111111111111111111111111',
            blockchain: 'ethereum',
            token_address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            token_symbol: 'MEME',
            total_buy_usd: '100',
            total_sell_usd: '250',
            realized_pnl_usd: '150',
            profit_pct: '150',
        },
        {
            wallet_address: '0x1111111111111111111111111111111111111111',
            blockchain: 'ethereum',
            token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            token_symbol: 'USDC',
            total_buy_usd: '1000',
            total_sell_usd: '1000',
            realized_pnl_usd: '0',
            profit_pct: '0',
        },
    ];

    const result = await getBatchWalletPortfolioPnlFromDune(
        [
            '0x1111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222',
        ],
        'ethereum',
        30,
        {
            apiKey: 'test-key',
            createClient: () => ({
                exec: {
                    executeSql: async () => ({ execution_id: 'exec-2', state: 'QUERY_STATE_PENDING' as any }),
                    getExecutionStatus: async () => ({ state: 'QUERY_STATE_COMPLETED' as any }),
                    getExecutionResults: async () => ({
                        result: {
                            rows,
                            metadata: { total_row_count: rows.length },
                        },
                        next_offset: rows.length,
                    }),
                },
            }),
            sleep: async () => undefined,
            now: () => Date.now(),
        }
    );

    assert.equal(result.length, 2);
    assert.equal(result[0].walletAddress, '0x1111111111111111111111111111111111111111');
    assert.equal(result[0].totalBuyUsd, 100);
    assert.equal(result[0].realizedPnlUsd, 150);
    assert.equal(result[0].totalTrades, 1);
    assert.equal(result[1].walletAddress, '0x2222222222222222222222222222222222222222');
    assert.equal(result[1].realizedPnlUsd, 0);
    assert.equal(result[1].totalTrades, 0);
});
