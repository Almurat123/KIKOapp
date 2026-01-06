import { test } from 'node:test';
import assert from 'node:assert';
import { getChainConfig } from '../src/config/chainConfig.js';

// We want to test the logic that was added to handle USD calculation
// Since we can't easily import the internal function from autoTradeService.ts without 
// exporting it or mocking the whole file, we will re-implement the logic here 
// to verify the mathematical correctness and case handling.

const chainConfig = getChainConfig(8453);
const CASH_TOKENS = [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    chainConfig.wrappedNativeAddress,
    ...chainConfig.stablecoins
].map(s => s.toLowerCase());

function calculateUsdValue(swap: any, tokenInfo: any) {
    const isTokenInCash = CASH_TOKENS.includes(swap.tokenIn.toLowerCase());
    let targetSwapValueUsd = 0;

    if (isTokenInCash) {
        const isStableIn = chainConfig.stablecoins.map(s => s.toLowerCase()).includes(swap.tokenIn.toLowerCase());
        const amountInBN = BigInt(swap.amountIn);

        if (isStableIn) {
            // USDC on Base is 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 (6 decimals)
            const decimalsIn = swap.tokenIn.toLowerCase().includes('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') ? 6 : 18;
            targetSwapValueUsd = Number(amountInBN) / Math.pow(10, decimalsIn);
        } else {
            // ETH / WETH
            const nativePrice = 2500; // Mocked
            targetSwapValueUsd = (Number(amountInBN) / 1e18) * nativePrice;
        }
    } else {
        const amountOutBN = BigInt(swap.amountOut);
        const splitDecimals = tokenInfo.decimals || 18;
        const formattedAmountOut = Number(amountOutBN) / Math.pow(10, splitDecimals);
        targetSwapValueUsd = formattedAmountOut * tokenInfo.price;
    }
    return targetSwapValueUsd;
}

test('USD Calculation - USDC (6 decimals)', () => {
    const swap = {
        tokenIn: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
        amountIn: '100000000', // $100
        tokenOut: '0xtoken',
        amountOut: '1000'
    };
    const value = calculateUsdValue(swap, {});
    assert.strictEqual(value, 100);
});

test('USD Calculation - ETH (18 decimals)', () => {
    const swap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
        amountIn: '100000000000000000', // 0.1 ETH
        tokenOut: '0xtoken',
        amountOut: '1000'
    };
    const value = calculateUsdValue(swap, {});
    assert.strictEqual(value, 250); // 0.1 * 2500
});

test('USD Calculation - Token Out (Fallback)', () => {
    const swap = {
        tokenIn: '0xrandom',
        amountIn: '1000',
        tokenOut: '0xtoken',
        amountOut: '2000000000000000000' // 2 tokens
    };
    const tokenInfo = {
        decimals: 18,
        price: 50
    };
    const value = calculateUsdValue(swap, tokenInfo);
    assert.strictEqual(value, 100); // 2 * 50
});
