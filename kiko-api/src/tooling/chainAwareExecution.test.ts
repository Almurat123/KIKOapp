import test from 'node:test';
import assert from 'node:assert/strict';

import {
    maybeRetryChainAwareToolExecution,
    prepareChainAwareToolExecution,
} from './chainAwareExecution.js';

const FULL_ADDRESS = '0x5b2b43089a2a1750dd320a9fe07fcb016b8b4444';
const TRUNCATED_ADDRESS = '0x5b2b43089a2a1750dd320a9fe07fcb016b8b444';

test('prepareChainAwareToolExecution repairs a broken token address from snapshot and uses detected chain', async () => {
    const prepared = await prepareChainAwareToolExecution(
        'get_token_info',
        { address: TRUNCATED_ADDRESS, chain: 'base' },
        {
            analysisChain: 'base',
            analysisChainId: 8453,
            analysisTokenAddress: FULL_ADDRESS,
            __snapshot: {
                requestedTokenAddresses: [FULL_ADDRESS],
            },
        },
        {
            findTokenOnAnyChain: async (address) => {
                assert.equal(address, FULL_ADDRESS);
                return {
                    address,
                    symbol: 'BAP',
                    name: 'Binance Ai Pro',
                    chainId: 56,
                    chainName: 'BSC',
                };
            },
        },
    );

    assert.equal(prepared.args.address, FULL_ADDRESS);
    assert.equal(prepared.args.chain, 'bsc');
    assert.equal(prepared.args.chain_id, 56);
    assert.equal(prepared.meta.attemptedChain, 'base');
    assert.equal(prepared.meta.requestTokenAddress, undefined);
    assert.equal(prepared.meta.canonicalTokenAddress, FULL_ADDRESS);
});

test('prepareChainAwareToolExecution lets detected token chain override stale analysis chain', async () => {
    const prepared = await prepareChainAwareToolExecution(
        'get_early_buyers',
        { address: FULL_ADDRESS },
        {
            analysisChain: 'base',
            analysisChainId: 8453,
            analysisTokenAddress: FULL_ADDRESS,
            __snapshot: {
                requestedTokenAddresses: [FULL_ADDRESS],
            },
        },
        {
            findTokenOnAnyChain: async () => ({
                address: FULL_ADDRESS,
                symbol: 'BAP',
                name: 'Binance Ai Pro',
                chainId: 56,
                chainName: 'BSC',
            }),
        },
    );

    assert.equal(prepared.args.chain, 'bsc');
    assert.equal(prepared.args.chain_id, 56);
});

test('prepareChainAwareToolExecution injects snapshot token_address for analyze_wallet_pnl_batch without adding address', async () => {
    const prepared = await prepareChainAwareToolExecution(
        'analyze_wallet_pnl_batch',
        {
            addresses: ['0x1111111111111111111111111111111111111111'],
            chain: 'base',
        },
        {
            analysisChain: 'base',
            analysisChainId: 8453,
            analysisTokenAddress: FULL_ADDRESS,
            __snapshot: {
                requestedTokenAddresses: [FULL_ADDRESS],
            },
        },
        {
            findTokenOnAnyChain: async (address) => {
                assert.equal(address, FULL_ADDRESS);
                return {
                    address,
                    symbol: 'BAP',
                    name: 'Binance Ai Pro',
                    chainId: 56,
                    chainName: 'BSC',
                };
            },
        },
    );

    assert.equal(prepared.args.token_address, FULL_ADDRESS);
    assert.equal(prepared.args.address, undefined);
    assert.equal(prepared.args.chain, 'bsc');
    assert.equal(prepared.args.chain_id, 56);
    assert.equal(prepared.meta.requestTokenAddress, undefined);
    assert.equal(prepared.meta.canonicalTokenAddress, FULL_ADDRESS);
});

test('maybeRetryChainAwareToolExecution retries on detected token chain when initial result looks like a wrong-chain miss', async () => {
    const retried = await maybeRetryChainAwareToolExecution<any>(
        'get_token_info',
        { address: FULL_ADDRESS, chain: 'base', chain_id: 8453 },
        {},
        { error: 'Token not found on GeckoTerminal or DexScreener' },
        {
            explicitChainInput: true,
            attemptedChain: 'base',
            attemptedChainId: 8453,
            requestTokenAddress: FULL_ADDRESS,
            canonicalTokenAddress: FULL_ADDRESS,
        },
        async (nextArgs) => ({
            source: 'DexScreener',
            chain: nextArgs.chain,
            chain_id: nextArgs.chain_id,
        }),
        {
            findTokenOnAnyChain: async () => ({
                address: FULL_ADDRESS,
                symbol: 'BAP',
                name: 'Binance Ai Pro',
                chainId: 56,
                chainName: 'BSC',
            }),
        },
    );

    assert.equal((retried as any).chain, 'bsc');
    assert.equal((retried as any).chain_id, 56);
    assert.deepEqual((retried as any).chainResolution, {
        status: 'auto_corrected',
        reason: 'wrong_chain_candidate_detected',
        attemptedChain: 'base',
        attemptedChainId: 8453,
        resolvedChain: 'bsc',
        resolvedChainId: 56,
    });
});
