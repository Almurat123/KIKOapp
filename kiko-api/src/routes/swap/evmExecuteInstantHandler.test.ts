import assert from 'node:assert/strict';
import test from 'node:test';

import { __evmExecuteInstantTest } from './evmExecuteInstantHandler.js';
import type { MainSwapResult } from '../../services/MainSwapService.js';
import type { ZeroExTokenMetadata } from '../../services/zeroEx.js';

function buildDeps(overrides: Partial<any> = {}) {
    const calls = {
        scheduleTradeSettlement: 0,
        trackSwap: 0,
        updateSwapHistory: [] as any[],
    };

    const deps = {
        getTokenPriceUSD: async () => 1,
        getZeroExTokenMetadata: async (token: string): Promise<ZeroExTokenMetadata> => ({
            symbol: token === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ? 'BNB' : 'BENJI',
            name: token === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ? 'BNB' : 'BENJI',
            decimals: 18,
            address: token,
        }),
        getNativeTokenAddress: () => '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        toWei: (amount: string | number) => String(amount),
        resolveTokenAddress: (token: string) => token,
        isNativeToken: (token?: string | null) => String(token || '').toUpperCase() === 'BNB' || token === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        getKnownTokenDecimals: () => 18,
        callRpc: async <T>() => '0x0' as T,
        executeSwap: async () => ({
            success: true,
            txHash: '0xabc',
            amountOut: '123',
            metadata: { provider: '0x', mode: 'swap-card' },
        } satisfies MainSwapResult),
        getUserSettings: async () => null,
        createSwapHistory: async () => ({ id: 'unused', userId: 'u1' }),
        createPendingSwapHistory: async () => ({ id: 'trade1', userId: 'u1', tokenInUsd: 1 }),
        updateSwapHistory: async (...args: any[]) => {
            calls.updateSwapHistory.push(args);
        },
        scheduleTradeSettlement: () => {
            calls.scheduleTradeSettlement += 1;
        },
        trackSwap: async () => {
            calls.trackSwap += 1;
        },
        ...overrides,
    };

    return { deps, calls };
}

test('resolveInstantExecutionOutcome treats confirmed chat swaps as terminal success', () => {
    const outcome = __evmExecuteInstantTest.resolveInstantExecutionOutcome({
        requireConfirmedTx: false,
        swapResult: {
            success: true,
            txHash: '0xabc',
            amountOut: '123',
            txLifecycle: {
                status: 'confirmed_success',
                txHash: '0xabc',
                attempts: 1,
                chainId: 56,
            },
            metadata: { provider: '0x', mode: 'swap-card' },
        },
    });

    assert.equal(outcome.historyStatus, 'success');
    assert.equal(outcome.responseStatus, 'SUCCESS');
    assert.equal(outcome.shouldScheduleSettlement, false);
    assert.ok(outcome.confirmedAt instanceof Date);
});

test('executeEvmInstantWithDeps returns SUCCESS for confirmed chat swaps and skips async settlement', async () => {
    const { deps, calls } = buildDeps({
        executeSwap: async () => ({
            success: true,
            txHash: '0xconfirmed',
            amountOut: '5794.55',
            txLifecycle: {
                status: 'confirmed_success',
                txHash: '0xconfirmed',
                attempts: 1,
                chainId: 56,
            },
            metadata: { provider: '0x', mode: 'swap-card' },
        } satisfies MainSwapResult),
    });

    const result = await __evmExecuteInstantTest.executeEvmInstantWithDeps({
        userId: 'u1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        accessToken: 'token',
        tokenIn: 'BNB',
        tokenOut: '0x0bc61768132aa1484e2b09301284b7def78a4444',
        amountIn: '0.001',
        chainId: 56,
        slippageBps: 1000,
        transactionMessageId: 'msg1',
        executionSource: 'chat',
        routePolicy: 'external_only',
    }, deps);

    assert.equal(result.status, 'SUCCESS');
    assert.equal(calls.scheduleTradeSettlement, 0);
    assert.equal(calls.trackSwap, 1);
    assert.equal(calls.updateSwapHistory.length, 1);
    assert.equal(calls.updateSwapHistory[0][1].status, 'success');
});

test('executeEvmInstantWithDeps keeps pending chat swaps pending until settlement', async () => {
    const { deps, calls } = buildDeps({
        executeSwap: async () => ({
            success: true,
            txHash: '0xpending',
            amountOut: '100',
            txLifecycle: {
                status: 'visible_pending',
                txHash: '0xpending',
                attempts: 1,
                chainId: 56,
            },
            metadata: { provider: '0x', mode: 'swap-card' },
        } satisfies MainSwapResult),
    });

    const result = await __evmExecuteInstantTest.executeEvmInstantWithDeps({
        userId: 'u1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        accessToken: 'token',
        tokenIn: 'BNB',
        tokenOut: '0x0bc61768132aa1484e2b09301284b7def78a4444',
        amountIn: '0.001',
        chainId: 56,
        slippageBps: 1000,
        transactionMessageId: 'msg1',
        executionSource: 'chat',
        routePolicy: 'external_only',
    }, deps);

    assert.equal(result.status, 'PENDING');
    assert.equal(calls.scheduleTradeSettlement, 1);
    assert.equal(calls.trackSwap, 0);
    assert.equal(calls.updateSwapHistory.length, 1);
    assert.equal(calls.updateSwapHistory[0][1].status, 'pending');
});
