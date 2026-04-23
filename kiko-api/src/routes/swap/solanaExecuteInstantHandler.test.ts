import assert from 'node:assert/strict';
import test from 'node:test';

import { __solanaExecuteInstantTest } from './solanaExecuteInstantHandler.js';

test('solana instant handler returns pending status for launchpad path', async () => {
    const result = await __solanaExecuteInstantTest.executeSolanaInstantWithDeps(
        {
            userId: 'user-1',
            tokenIn: 'SOL',
            tokenOut: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            amountIn: '1',
            slippageBps: 100,
            accessToken: 'token',
        },
        {
            executeSolanaSwap: async () => {
                throw new Error('should not use standard aggregator path');
            },
            findTokenOnAnyChain: async () => ({ launchpad: { provider: 'pumpfun' } }) as any,
            getSolanaTokenMetadata: async () => ({ decimals: 9 }) as any,
            normalizeSolanaTokenAddress: (value: string) => value === 'SOL'
                ? 'So11111111111111111111111111111111111111112'
                : value,
            solanaLaunchpadSwapService: {
                fastSwap: async () => 'launchpad-tx-hash',
            } as any,
            toWei: () => '1000000000',
        }
    );

    assert.equal(result.method, 'solana_launchpad');
    assert.equal(result.status, 'PENDING');
    assert.equal(result.txHash, 'launchpad-tx-hash');
});

test('solana instant handler returns pending status for pumpswap fast path', async () => {
    const result = await __solanaExecuteInstantTest.executeSolanaInstantWithDeps(
        {
            userId: 'user-1',
            tokenIn: 'SOL',
            tokenOut: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            amountIn: '1',
            slippageBps: 100,
            accessToken: 'token',
        },
        {
            executeSolanaSwap: async () => 'pumpswap-tx-hash',
            findTokenOnAnyChain: async () => ({ launchpad: { provider: 'pumpswap' } }) as any,
            getSolanaTokenMetadata: async () => ({ decimals: 9 }) as any,
            normalizeSolanaTokenAddress: (value: string) => value === 'SOL'
                ? 'So11111111111111111111111111111111111111112'
                : value,
            solanaLaunchpadSwapService: {
                fastSwap: async () => {
                    throw new Error('should not use launchpad fast swap');
                },
            } as any,
            toWei: () => '1000000000',
        }
    );

    assert.equal(result.method, 'solana_pumpswap_fast');
    assert.equal(result.status, 'PENDING');
    assert.equal(result.txHash, 'pumpswap-tx-hash');
});

test('solana instant handler returns pending status for jupiter path', async () => {
    const result = await __solanaExecuteInstantTest.executeSolanaInstantWithDeps(
        {
            userId: 'user-1',
            tokenIn: 'SOL',
            tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            amountIn: '1',
            slippageBps: 100,
            accessToken: 'token',
        },
        {
            executeSolanaSwap: async () => 'jupiter-tx-hash',
            findTokenOnAnyChain: async () => ({ launchpad: { provider: null } }) as any,
            getSolanaTokenMetadata: async () => ({ decimals: 6 }) as any,
            normalizeSolanaTokenAddress: (value: string) => value === 'SOL'
                ? 'So11111111111111111111111111111111111111112'
                : value,
            solanaLaunchpadSwapService: {
                fastSwap: async () => {
                    throw new Error('should not use launchpad fast swap');
                },
            } as any,
            toWei: () => '1000000000',
        }
    );

    assert.equal(result.method, 'jupiter_aggregator');
    assert.equal(result.status, 'PENDING');
    assert.equal(result.txHash, 'jupiter-tx-hash');
});
