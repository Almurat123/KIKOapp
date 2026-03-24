import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTokenInfoLookup } from './tokenInfo.js';

test('resolveTokenInfoLookup maps cached token symbols to contract addresses before external lookup', async () => {
    const result = await resolveTokenInfoLookup({
        identifier: 'virtual',
        chain: 'base',
    }, {
        findCachedTrendingToken: async () => ({
            address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
            symbol: 'VIRTUAL',
            name: 'Virtual Protocol',
            network: 'base',
        }),
    });

    assert.equal(result.resolvedAddress, '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b');
    assert.equal(result.cachedToken?.symbol, 'VIRTUAL');
});

test('resolveTokenInfoLookup leaves real token addresses unchanged', async () => {
    const result = await resolveTokenInfoLookup({
        identifier: '0x4200000000000000000000000000000000000006',
        chain: 'base',
    }, {
        findCachedTrendingToken: async () => {
            throw new Error('should not be called');
        },
    });

    assert.equal(result.resolvedAddress, '0x4200000000000000000000000000000000000006');
    assert.equal(result.cachedToken, null);
});
