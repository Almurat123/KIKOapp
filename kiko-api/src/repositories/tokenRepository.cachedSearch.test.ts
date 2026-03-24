import test from 'node:test';
import assert from 'node:assert/strict';
import { findCachedTrendingToken, searchCachedTrendingTokens } from './tokenRepository.js';
import type { TokenSearchResult } from '../services/geckoTerminal.js';

const BASE_TOKENS: TokenSearchResult[] = [
    {
        address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
        name: 'Virtual Protocol',
        symbol: 'VIRTUAL',
        network: 'base',
        price: 1.23,
        liquidity: 100000,
        volume24h: 500000,
        rank: 3 as any,
    } as TokenSearchResult,
    {
        address: '0x1111111111111111111111111111111111111111',
        name: 'Aerodrome',
        symbol: 'AERO',
        network: 'base',
        price: 0.5,
        liquidity: 90000,
        volume24h: 300000,
        rank: 10 as any,
    } as TokenSearchResult,
];

test('findCachedTrendingToken resolves exact symbol matches from cached token-page data', async () => {
    const result = await findCachedTrendingToken('virtual', 'base', {
        getTrendingTokens: async (chain?: string) => chain === 'base' ? BASE_TOKENS : [],
    });

    assert.ok(result);
    assert.equal(result?.address, '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b');
    assert.equal(result?.symbol, 'VIRTUAL');
    assert.equal(result?.network, 'base');
});

test('searchCachedTrendingTokens resolves exact token-name matches from cached token-page data', async () => {
    const results = await searchCachedTrendingTokens('Virtual Protocol', 'base', 5, {
        getTrendingTokens: async (chain?: string) => chain === 'base' ? BASE_TOKENS : [],
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.symbol, 'VIRTUAL');
});

test('searchCachedTrendingTokens ranks exact symbol matches above partial name matches', async () => {
    const results = await searchCachedTrendingTokens('aero', 'base', 5, {
        getTrendingTokens: async (chain?: string) => chain === 'base'
            ? [
                ...BASE_TOKENS,
                {
                    address: '0x2222222222222222222222222222222222222222',
                    name: 'Aerobud',
                    symbol: 'BUD',
                    network: 'base',
                    rank: 1 as any,
                } as TokenSearchResult,
            ]
            : [],
    });

    assert.equal(results[0]?.symbol, 'AERO');
});
