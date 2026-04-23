import assert from 'node:assert/strict';
import test from 'node:test';

import { __evmExecuteInstantTest } from './evmExecuteInstantHandler.js';
import { AppError } from '../../middleware/errorHandler.js';
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

test('executeEvmInstantWithDeps does not block swap execution on slow USD price lookups', async () => {
    const { deps, calls } = buildDeps({
        getTokenPriceUSD: async () => await new Promise<number>((resolve) => {
            setTimeout(() => resolve(1), 10_000);
        }),
        executeSwap: async () => ({
            success: true,
            txHash: '0xslowprice',
            amountOut: '42',
            txLifecycle: {
                status: 'visible_pending',
                txHash: '0xslowprice',
                attempts: 1,
                chainId: 56,
            },
            metadata: { provider: '0x', mode: 'swap-card' },
        } satisfies MainSwapResult),
    });

    const startedAt = Date.now();
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
    const elapsedMs = Date.now() - startedAt;

    assert.equal(result.status, 'PENDING');
    assert.equal(calls.scheduleTradeSettlement, 1);
    assert.equal(calls.updateSwapHistory.length, 1);
    assert.equal(calls.updateSwapHistory[0][1].status, 'pending');
    assert.ok(elapsedMs < 4_000, `expected execution to continue without waiting 10s for prices, got ${elapsedMs}ms`);
});

test('executeEvmInstantWithDeps forwards native balance evidence into swap execution context', async () => {
    let capturedParams: any = null;
    const { deps } = buildDeps({
        executeSwap: async (params: any) => {
            capturedParams = params;
            return {
                success: true,
                txHash: '0xevidence',
                amountOut: '7',
                txLifecycle: {
                    status: 'visible_pending',
                    txHash: '0xevidence',
                    attempts: 1,
                    chainId: 8453,
                },
                metadata: { provider: '0x', mode: 'allowance' },
            } satisfies MainSwapResult;
        },
    });

    await __evmExecuteInstantTest.executeEvmInstantWithDeps({
        userId: 'u1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        accessToken: 'token',
        tokenIn: 'ETH',
        tokenOut: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        amountIn: '0.001',
        chainId: 8453,
        slippageBps: 50,
        transactionMessageId: 'msg1',
        executionSource: 'chat',
        routePolicy: 'external_only',
        nativeBalanceEvidence: {
            chainId: 8453,
            walletAddress: '0x1111111111111111111111111111111111111111',
            balanceWei: '38235470000000000',
            observedAtMs: Date.now(),
            source: 'main_swap_native_precheck',
        },
    }, deps);

    assert.equal(
        capturedParams?.executionContext?.nativeBalanceEvidence?.balanceWei,
        '38235470000000000',
    );
});

test('executeEvmInstantWithDeps surfaces execution rejections as business conflicts instead of 500s', async () => {
    const { deps, calls } = buildDeps({
        executeSwap: async () => ({
            success: false,
            reasonCode: 'execution_reverted',
            userMessage: 'The swap transaction reverted on-chain before settlement.',
            error: 'Transaction reverted: 0x0',
            txHash: '0xreverted',
            metadata: { provider: '0x', mode: 'swap-card' },
        } satisfies MainSwapResult),
    });

    await assert.rejects(
        __evmExecuteInstantTest.executeEvmInstantWithDeps({
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
        }, deps),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 409);
            assert.equal(error.message, 'The swap transaction reverted on-chain before settlement.');
            return true;
        }
    );

    assert.equal(calls.updateSwapHistory.length, 1);
    assert.equal(calls.updateSwapHistory[0][1].status, 'failed');
    assert.equal(calls.updateSwapHistory[0][1].txHash, '0xreverted');
});

test('executeEvmInstantWithDeps surfaces approval-quote mismatches as retryable business conflicts', async () => {
    const { deps, calls } = buildDeps({
        executeSwap: async () => ({
            success: false,
            reasonCode: 'approval_quote_mismatch',
            userMessage: 'The swap route changed after token approval, so no swap transaction was sent. Please retry with a fresh quote.',
            error: 'Swap failed: The route changed after token approval, so no swap transaction was sent. Please retry to get a fresh quote.',
            txHash: '0xapproval',
            metadata: { provider: '0x', mode: 'swap-card' },
        } satisfies MainSwapResult),
    });

    await assert.rejects(
        __evmExecuteInstantTest.executeEvmInstantWithDeps({
            userId: 'u1',
            walletAddress: '0x1111111111111111111111111111111111111111',
            accessToken: 'token',
            tokenIn: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            tokenOut: 'BNB',
            amountIn: '4.797005',
            chainId: 8453,
            slippageBps: 1000,
            executionSource: 'wallet_page',
            routePolicy: 'legacy_allowed',
        }, deps),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.statusCode, 409);
            assert.equal(error.message, 'The swap route changed after token approval, so no swap transaction was sent. Please retry with a fresh quote.');
            return true;
        }
    );

    assert.equal(calls.updateSwapHistory.length, 1);
    assert.equal(calls.updateSwapHistory[0][1].status, 'failed');
    assert.equal(calls.updateSwapHistory[0][1].txHash, '0xapproval');
});
