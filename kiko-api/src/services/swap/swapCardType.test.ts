import test from 'node:test';
import assert from 'node:assert/strict';

import { inferSwapCardType } from './swapCardType.js';

test('inferSwapCardType marks quote asset to non-quote token as buy', () => {
    assert.equal(inferSwapCardType({
        tokenIn: 'USDC',
        tokenOut: '0x1111111111111111111111111111111111111111',
        tokenOutSymbol: 'KIKO',
        chainId: 8453,
    }), 'buy');

    assert.equal(inferSwapCardType({
        tokenIn: 'BNB',
        tokenOut: '0x2222222222222222222222222222222222222222',
        tokenOutSymbol: 'MEME',
        chainId: 56,
    }), 'buy');
});

test('inferSwapCardType marks non-quote token to quote asset as sell', () => {
    assert.equal(inferSwapCardType({
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenInSymbol: 'KIKO',
        tokenOut: 'ETH',
        chainId: 8453,
    }), 'sell');

    assert.equal(inferSwapCardType({
        tokenIn: '0x2222222222222222222222222222222222222222',
        tokenInSymbol: 'MEME',
        tokenOut: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        chainId: 8453,
    }), 'sell');
});

test('inferSwapCardType keeps quote-to-quote and token-to-token trades as swap', () => {
    assert.equal(inferSwapCardType({
        tokenIn: 'ETH',
        tokenOut: 'USDC',
        chainId: 8453,
    }), 'swap');

    assert.equal(inferSwapCardType({
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenInSymbol: 'KIKO',
        tokenOut: '0x2222222222222222222222222222222222222222',
        tokenOutSymbol: 'MEME',
        chainId: 8453,
    }), 'swap');
});

test('prepareSwap test export uses the shared swap card type inference', async () => {
    const { __prepareSwapTest } = await import('../../skills/SwapSkill/tools/prepareSwap.js');

    assert.equal(__prepareSwapTest.inferSwapCardType({
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenInSymbol: 'KIKO',
        tokenOut: 'USDC',
        chainId: 8453,
    }), 'sell');
});
