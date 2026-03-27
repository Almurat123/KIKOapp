import assert from 'node:assert/strict';
import test from 'node:test';
import { __testOnly } from './tokenAnalysisTools.js';

test('resolveEarlyBuyerExpansionMode defaults to fast path', () => {
    const result = __testOnly.resolveEarlyBuyerExpansionMode({});
    assert.deepEqual(result, {
        includeTradeProgression: false,
        includeTokenPnl: false,
        mode: 'fast_path',
    });
});

test('resolveEarlyBuyerExpansionMode enables expanded mode only for explicit enrichment flags', () => {
    assert.deepEqual(__testOnly.resolveEarlyBuyerExpansionMode({ include_trade_progression: true }), {
        includeTradeProgression: true,
        includeTokenPnl: false,
        mode: 'expanded',
    });
    assert.deepEqual(__testOnly.resolveEarlyBuyerExpansionMode({ include_token_pnl: true }), {
        includeTradeProgression: false,
        includeTokenPnl: true,
        mode: 'expanded',
    });
});

test('resolveEarlyBuyerFollowUpCapabilities requires a separate batch query when current rows lack token PnL coverage', () => {
    assert.deepEqual(__testOnly.resolveEarlyBuyerFollowUpCapabilities({
        chain: 'bsc',
        includeTokenPnl: false,
        tokenPnlPopulatedCount: 0,
    }), {
        directProfitRanking: 'not_available_from_current_rows',
        batchWalletPnlFollowup: 'requires_separate_batch_query',
    });
});

test('resolveEarlyBuyerFollowUpCapabilities exposes direct profit ranking only when current rows contain token PnL', () => {
    assert.deepEqual(__testOnly.resolveEarlyBuyerFollowUpCapabilities({
        chain: 'bsc',
        includeTokenPnl: true,
        tokenPnlPopulatedCount: 3,
    }), {
        directProfitRanking: 'ready_from_current_rows',
        batchWalletPnlFollowup: 'requires_separate_batch_query',
    });
});

test('resolveEarlyBuyerFollowUpCapabilities marks wallet PnL follow-up unsupported on solana', () => {
    assert.deepEqual(__testOnly.resolveEarlyBuyerFollowUpCapabilities({
        chain: 'solana',
        includeTokenPnl: false,
        tokenPnlPopulatedCount: 0,
    }), {
        directProfitRanking: 'not_available_from_current_rows',
        batchWalletPnlFollowup: 'unsupported',
    });
});
