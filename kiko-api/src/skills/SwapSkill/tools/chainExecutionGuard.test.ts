import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSwapExecutionChain } from './chainExecutionGuard.js';

test('validateSwapExecutionChain blocks execution when connected chain does not match requested trade chain', async () => {
    const result = await validateSwapExecutionChain({
        token_in: 'ETH',
        token_out: 'USDC',
        chain_id: 56,
    }, {
        chainId: 8453,
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'CHAIN_SWITCH_REQUIRED');
    assert.match(result.error, /Call switch_wallet_chain first/i);
});

test('validateSwapExecutionChain blocks execution while a chain switch is still pending confirmation', async () => {
    const result = await validateSwapExecutionChain({
        token_in: 'ETH',
        token_out: 'USDC',
        chain_id: 56,
    }, {
        chainId: 8453,
        pendingChainSwitch: {
            targetChainId: 56,
            targetChainName: 'BNB Chain',
            status: 'pending',
        },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'CHAIN_SWITCH_REQUIRED');
    assert.match(result.error, /pending confirmation/i);
});

test('validateSwapExecutionChain blocks execution when recent user history explicitly requested another chain', async () => {
    const result = await validateSwapExecutionChain({
        token_in: 'BNB',
        token_out: 'CAKE',
        chain_id: 8453,
    }, {
        chainId: 8453,
        __snapshot: {
            history: [
                { role: 'user', content: 'buy CAKE on BSC' },
                { role: 'assistant', content: '' },
                { role: 'user', content: 'yes continue' },
            ],
            requestedTokenAddresses: [],
            requestedTokenSymbols: ['CAKE', 'BNB'],
        },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'REQUESTED_CHAIN_MISMATCH');
    assert.match(result.error, /user requested BNB Chain/i);
});

test('validateSwapExecutionChain allows execution when connected chain and requested chain are aligned', async () => {
    const result = await validateSwapExecutionChain({
        token_in: 'BNB',
        token_out: 'CAKE',
        chain_id: 56,
    }, {
        chainId: 56,
        __snapshot: {
            history: [
                { role: 'user', content: 'buy CAKE on BSC' },
            ],
            requestedTokenAddresses: [],
            requestedTokenSymbols: ['CAKE', 'BNB'],
        },
    });

    assert.deepEqual(result, { ok: true });
});

test('validateSwapExecutionChain allows Polymarket Polygon collateral swaps without chain switch prompts', async () => {
    const result = await validateSwapExecutionChain({
        token_in: 'USDC',
        token_out: 'USDC.e',
        chain_id: 137,
    }, {
        chainId: 8453,
        pendingChainSwitch: {
            targetChainId: 56,
            targetChainName: 'BNB Chain',
            status: 'pending',
        },
    });

    assert.deepEqual(result, { ok: true });
});
