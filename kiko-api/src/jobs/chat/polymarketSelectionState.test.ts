import assert from 'node:assert/strict';
import test from 'node:test';
import {
    extractPolymarketSelectionState,
    mergePolymarketSelectionState,
    resolvePolymarketSelectionMatch,
} from './polymarketSelectionState.js';

test('extractPolymarketSelectionState captures coin up/down candidates with outcomes', () => {
    const state = extractPolymarketSelectionState('get_polymarket_coin_updown_markets', {
        current_time_et_strict: '2026-03-26 01:58:03',
        markets: [
            {
                title: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                slug: 'btc-updown-5m-1',
                live: true,
                orderable: true,
                window: { start_et: '2026-03-26 01:55:00', end_et: '2026-03-26 02:00:00' },
                market: {
                    id: '305787',
                    question: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                    slug: 'btc-updown-5m-1',
                    conditionId: 'condition-1',
                    outcomes: [
                        { name: 'Up', token_id: 'token-up' },
                        { name: 'Down', token_id: 'token-down' },
                    ],
                },
            },
        ],
        current_candidate: {
            id: '305787',
            title: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
            slug: 'btc-updown-5m-1',
        },
    });

    assert.ok(state);
    assert.equal(state?.candidates.length, 1);
    assert.equal(state?.currentCandidate?.marketId, '305787');
    assert.equal(state?.currentCandidate?.outcomes[0]?.tokenId, 'token-up');
});

test('resolvePolymarketSelectionMatch recovers authoritative token from question and outcome', () => {
    const state = extractPolymarketSelectionState('get_polymarket_coin_updown_markets', {
        markets: [
            {
                title: 'Bitcoin Up or Down - March 27, 3:20AM-3:25AM ET',
                slug: 'btc-updown-5m-2',
                market: {
                    id: '305999',
                    question: 'Bitcoin Up or Down - March 27, 3:20AM-3:25AM ET',
                    slug: 'btc-updown-5m-2',
                    conditionId: 'condition-2',
                    outcomes: [
                        { name: 'Up', token_id: 'real-up-token' },
                        { name: 'Down', token_id: 'real-down-token' },
                    ],
                },
            },
        ],
        primary_candidate: {
            id: '305999',
            title: 'Bitcoin Up or Down - March 27, 3:20AM-3:25AM ET',
            slug: 'btc-updown-5m-2',
        },
    });

    const match = resolvePolymarketSelectionMatch(state, {
        question: 'Bitcoin Up or Down - March 27, 3:20AM-3:25AM ET',
        outcome: 'Up',
        tokenId: 'bitcoin-updown-march-27-320-325am-et-up',
    });

    assert.deepEqual(match, {
        question: 'Bitcoin Up or Down - March 27, 3:20AM-3:25AM ET',
        outcome: 'Up',
        tokenId: 'real-up-token',
        marketId: '305999',
        marketSlug: 'btc-updown-5m-2',
        conditionId: 'condition-2',
    });
});

test('mergePolymarketSelectionState preserves prepared selection over discovery-only state', () => {
    const discovery = extractPolymarketSelectionState('get_polymarket_coin_updown_markets', {
        markets: [
            {
                title: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                slug: 'btc-updown-5m-1',
                market: {
                    id: '305787',
                    question: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                    slug: 'btc-updown-5m-1',
                    conditionId: 'condition-1',
                    outcomes: [{ name: 'Down', token_id: 'token-down' }],
                },
            },
        ],
    });
    const prepared = extractPolymarketSelectionState('prepare_polymarket_bet', {
        selection: {
            question: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
            outcome: 'Down',
            token_id: 'token-down',
            resolved_token_id: 'token-down',
            amount_usd: 1,
        },
        authoritative_resolution: {
            market_id: '305787',
            market_slug: 'btc-updown-5m-1',
            condition_id: 'condition-1',
        },
    });

    const merged = mergePolymarketSelectionState(discovery, prepared);
    assert.equal(merged?.preparedSelection?.tokenId, 'token-down');
    assert.equal(merged?.candidates.length, 1);
});
