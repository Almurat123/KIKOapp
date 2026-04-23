import { AppError } from '../../middleware/errorHandler.js';
import prisma from '../../db/prisma.js';
import { trackSwap } from '../../services/userActivityService.js';
import {
    getTokenPriceUSD,
    getZeroExTokenMetadata,
    getNativeTokenAddress,
    toWei,
} from '../../services/zeroEx.js';
import {
    resolveTokenAddress,
    isNativeToken,
    getKnownTokenDecimals,
} from '../../services/tokens.js';
import { callRpc } from '../../services/rpcManager.js';
import { getTransactionReceipt } from '../../services/rpcManager.js';
import { MainSwapService, type MainSwapResult } from '../../services/MainSwapService.js';
import type { NativeBalanceEvidence } from '../../services/swap/nativeBalanceEvidence.js';

export interface EvmExecuteInstantParams {
    userId: string;
    walletAddress: string;
    accessToken: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippageBps: number;
    transactionMessageId?: string;
    executionSource?: 'chat' | 'wallet_page' | 'copytrade' | 'system';
    routePolicy?: 'external_only' | 'legacy_allowed';
    nativeBalanceEvidence?: NativeBalanceEvidence;
}

type TokenMetadata = {
    symbol?: string | null;
    decimals?: number | null;
};

type SwapHistoryRecord = {
    id: string;
    userId: string;
    tokenInUsd?: number | null;
    status?: string | null;
    txHash?: string | null;
};

type RuntimeUserSettings = {
    swapMethod?: 'allowance_trade' | 'wallet_sign' | null;
    fastSwapMode?: boolean | null;
    mevProtection?: boolean | null;
};

type EvmExecuteInstantDeps = {
    getTokenPriceUSD: typeof getTokenPriceUSD;
    getZeroExTokenMetadata: typeof getZeroExTokenMetadata;
    getNativeTokenAddress: typeof getNativeTokenAddress;
    toWei: typeof toWei;
    resolveTokenAddress: typeof resolveTokenAddress;
    isNativeToken: typeof isNativeToken;
    getKnownTokenDecimals: typeof getKnownTokenDecimals;
    callRpc: typeof callRpc;
    executeSwap: (params: Parameters<typeof MainSwapService.executeSwap>[0]) => Promise<MainSwapResult>;
    getUserSettings: (userId: string) => Promise<RuntimeUserSettings | null>;
    createSwapHistory: (args: {
        userId: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        amountInUsd: number;
        amountOut: string | null;
        amountOutUsd: number;
        tokenInSymbol: string;
        tokenOutSymbol: string;
        chainId: number;
        txHash: string;
        slippageBps: number;
    }) => Promise<SwapHistoryRecord>;
    createPendingSwapHistory: (args: {
        userId: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        amountInUsd: number;
        tokenInSymbol: string;
        tokenOutSymbol: string;
        chainId: number;
        slippageBps: number;
    }) => Promise<SwapHistoryRecord>;
    updateSwapHistory: (tradeId: string, args: {
        status: 'pending' | 'success' | 'failed';
        txHash?: string | null;
        amountOut?: string | null;
        amountOutUsd?: number | null;
        error?: string | null;
        confirmedAt?: Date | null;
    }) => Promise<void>;
    scheduleTradeSettlement: (params: {
        tradeId: string;
        txHash: string;
        chainId: number;
        userId: string;
        amountInUsd: number;
        amountOut: string | null;
        amountOutUsd: number;
        updateSwapHistory: EvmExecuteInstantDeps['updateSwapHistory'];
        trackSwap: EvmExecuteInstantDeps['trackSwap'];
    }) => void;
    trackSwap: typeof trackSwap;
};

type InstantExecutionOutcome = {
    historyStatus: 'pending' | 'success' | 'failed';
    responseStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
    confirmedAt?: Date;
    shouldScheduleSettlement: boolean;
};

const NATIVE_TOKEN_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const SWAP_AUX_PRICE_TIMEOUT_MS = 2_500;

function resolveSwapFailureStatusCode(reasonCode?: string, message?: string): number {
    const normalizedReason = String(reasonCode || '').toLowerCase();
    const normalizedMessage = String(message || '').toLowerCase();

    if (
        normalizedReason === 'invalid_token'
        || normalizedReason === 'unsupported_token_or_chain'
        || normalizedReason === 'insufficient_balance'
        || normalizedMessage.includes('insufficient native balance')
    ) {
        return 400;
    }

    if (
        normalizedReason === 'rpc_unavailable'
        || normalizedMessage.includes('all rpc endpoints failed')
    ) {
        return 503;
    }

    if (
        normalizedReason === 'execution_reverted'
        || normalizedReason === 'execution_rejected'
        || normalizedReason === 'slippage_exceeded'
        || normalizedReason === 'quote_unavailable'
        || normalizedMessage.includes('transaction reverted')
    ) {
        return 409;
    }

    return 500;
}

function resolveInstantExecutionOutcome(params: {
    requireConfirmedTx: boolean;
    swapResult: MainSwapResult;
}): InstantExecutionOutcome {
    const lifecycleStatus = params.swapResult.txLifecycle?.status || null;
    const confirmedSuccess = lifecycleStatus === 'confirmed_success';
    const confirmedFailed = lifecycleStatus === 'confirmed_failed';

    if (confirmedFailed) {
        return {
            historyStatus: 'failed',
            responseStatus: 'FAILED',
            shouldScheduleSettlement: false,
        };
    }

    if (params.requireConfirmedTx || confirmedSuccess) {
        return {
            historyStatus: 'success',
            responseStatus: 'SUCCESS',
            confirmedAt: new Date(),
            shouldScheduleSettlement: false,
        };
    }

    return {
        historyStatus: 'pending',
        responseStatus: 'PENDING',
        shouldScheduleSettlement: true,
    };
}

function toDec(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(n)) return null;
    return String(n);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return await new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(fallback);
        }, timeoutMs);

        promise
            .then((value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            })
            .catch(() => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(fallback);
            });
    });
}

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: verified
// Why: wallet-page instant swaps were blocking on auxiliary USD pricing before tx broadcast.
// Debug Goal: slow pricing providers must not delay quote-to-send execution.
// Search Tags: wallet swap stuck submitting before tx price lookup blocks execution
// Invariants:
// - Missing USD annotations must not prevent creating a pending trade or sending the swap.
// - Slow token USD lookups degrade to null/0 metadata instead of blocking execution.
// Failure Modes:
// - Swap UI sits on submitting for tens of seconds before tx hash appears.
// - Price source outage looks like swap execution failure.

const defaultDeps: EvmExecuteInstantDeps = {
    getTokenPriceUSD,
    getZeroExTokenMetadata,
    getNativeTokenAddress,
    toWei,
    resolveTokenAddress,
    isNativeToken,
    getKnownTokenDecimals,
    callRpc,
    executeSwap: (params) => MainSwapService.executeSwap(params),
    getUserSettings: async (userId) => {
        const settings = await prisma.userSettings.findUnique({
            where: { userId },
            select: {
                swapMethod: true,
                fastSwapMode: true,
                mevProtection: true,
            }
        });
        if (!settings) return null;
        return {
            swapMethod: settings.swapMethod === 'wallet_sign' ? 'wallet_sign' : 'allowance_trade',
            fastSwapMode: settings.fastSwapMode === true,
            mevProtection: settings.mevProtection !== false,
        };
    },
    createSwapHistory: async ({
        userId,
        tokenIn,
        tokenOut,
        amountIn,
        amountInUsd,
        amountOut,
        amountOutUsd,
        tokenInSymbol,
        tokenOutSymbol,
        chainId,
        txHash,
        slippageBps,
    }) => prisma.swapHistory.create({
        data: {
            user: { connect: { privyDid: userId } },
            tokenInAddress: tokenIn,
            tokenInSymbol,
            tokenInAmount: amountIn,
            tokenInAmountDec: toDec(amountIn),
            tokenInUsd: amountInUsd,
            tokenInUsdDec: toDec(amountInUsd),
            tokenOutAddress: tokenOut,
            tokenOutSymbol,
            tokenOutAmount: amountOut,
            tokenOutAmountDec: toDec(amountOut),
            tokenOutUsd: amountOutUsd,
            tokenOutUsdDec: toDec(amountOutUsd),
            chainId,
            txHash,
            status: 'success',
            source: 'fast_swap',
            slippageBps,
            confirmedAt: new Date(),
        }
    }),
    createPendingSwapHistory: async ({
        userId,
        tokenIn,
        tokenOut,
        amountIn,
        amountInUsd,
        tokenInSymbol,
        tokenOutSymbol,
        chainId,
        slippageBps,
    }) => prisma.swapHistory.create({
        data: {
            user: { connect: { privyDid: userId } },
            tokenInAddress: tokenIn,
            tokenInSymbol,
            tokenInAmount: amountIn,
            tokenInAmountDec: toDec(amountIn),
            tokenInUsd: amountInUsd,
            tokenInUsdDec: toDec(amountInUsd),
            tokenOutAddress: tokenOut,
            tokenOutSymbol,
            chainId,
            status: 'pending',
            source: 'fast_swap',
            slippageBps,
        }
    }),
    updateSwapHistory: async (tradeId, {
        status,
        txHash,
        amountOut,
        amountOutUsd,
        error,
        confirmedAt,
    }) => {
        await prisma.swapHistory.update({
            where: { id: tradeId },
            data: {
                status,
                txHash: txHash ?? undefined,
                tokenOutAmount: amountOut ?? undefined,
                tokenOutAmountDec: toDec(amountOut),
                tokenOutUsd: amountOutUsd ?? undefined,
                tokenOutUsdDec: toDec(amountOutUsd),
                failureReason: error ?? undefined,
                confirmedAt: confirmedAt ?? undefined,
            }
        });
    },
    scheduleTradeSettlement: (params) => {
        schedulePendingTradeSettlement(params);
    },
    trackSwap,
};

async function waitForEvmTradeSettlement(
    chainId: number,
    txHash: string,
    timeoutMs = 120_000,
    pollMs = 3_000
): Promise<{ status: 'success' | 'failed' | 'pending'; error?: string }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const receipt = await getTransactionReceipt(chainId, txHash);
            if (receipt) {
                const status = receipt.status;
                const isSuccess = status === '0x1' || status === 1 || status === true;
                return isSuccess
                    ? { status: 'success' }
                    : { status: 'failed', error: 'Transaction failed on-chain' };
            }
        } catch (error) {
            console.warn('[Swap Execute Instant] Background settlement poll failed:', error);
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    return { status: 'pending', error: 'Transaction settlement polling timed out' };
}

function schedulePendingTradeSettlement(params: {
    tradeId: string;
    txHash: string;
    chainId: number;
    userId: string;
    amountInUsd: number;
    amountOut: string | null;
    amountOutUsd: number;
    updateSwapHistory: EvmExecuteInstantDeps['updateSwapHistory'];
    trackSwap: EvmExecuteInstantDeps['trackSwap'];
}): void {
    setTimeout(() => {
        void (async () => {
            const outcome = await waitForEvmTradeSettlement(params.chainId, params.txHash);
            if (outcome.status === 'success') {
                await params.updateSwapHistory(params.tradeId, {
                    status: 'success',
                    txHash: params.txHash,
                    amountOut: params.amountOut,
                    amountOutUsd: params.amountOutUsd,
                    confirmedAt: new Date(),
                });
                params.trackSwap(params.userId, params.amountInUsd);
                return;
            }
            if (outcome.status === 'failed') {
                await params.updateSwapHistory(params.tradeId, {
                    status: 'failed',
                    txHash: params.txHash,
                    amountOut: params.amountOut,
                    amountOutUsd: params.amountOutUsd,
                    error: outcome.error || 'Transaction failed on-chain',
                });
            }
        })().catch((error) => {
            console.warn('[Swap Execute Instant] Failed to persist async trade settlement:', error);
        });
    }, 0);
}

async function executeEvmInstantWithDeps(
    params: EvmExecuteInstantParams,
    deps: EvmExecuteInstantDeps
): Promise<{ txHash: string; tradeId: string; status: 'SUCCESS' | 'PENDING' | 'FAILED'; amountOut: string | null }> {
    const resolvedTokenIn = deps.resolveTokenAddress(params.tokenIn, params.chainId);
    const resolvedTokenOut = deps.resolveTokenAddress(params.tokenOut, params.chainId);

    const actualTokenIn = deps.isNativeToken(resolvedTokenIn)
        ? NATIVE_TOKEN_PLACEHOLDER
        : resolvedTokenIn;
    const actualTokenOut = deps.isNativeToken(resolvedTokenOut)
        ? NATIVE_TOKEN_PLACEHOLDER
        : resolvedTokenOut;

    const tokenInForMetadata = deps.isNativeToken(resolvedTokenIn)
        ? deps.getNativeTokenAddress(params.chainId)
        : actualTokenIn;
    const tokenOutForMetadata = deps.isNativeToken(resolvedTokenOut)
        ? deps.getNativeTokenAddress(params.chainId)
        : actualTokenOut;

    const [tokenInMetadata, tokenOutMetadata] = await Promise.all([
        deps.getZeroExTokenMetadata(tokenInForMetadata || actualTokenIn, params.chainId) as Promise<TokenMetadata | null>,
        deps.getZeroExTokenMetadata(tokenOutForMetadata || actualTokenOut, params.chainId) as Promise<TokenMetadata | null>,
    ]);

    let tokenInDecimals = tokenInMetadata?.decimals || 18;

    const knownInDecimals = deps.getKnownTokenDecimals(actualTokenIn, params.chainId);
    if (knownInDecimals !== undefined) tokenInDecimals = knownInDecimals;

    let resolvedAmountIn = params.amountIn;

    if (!deps.isNativeToken(actualTokenIn)) {
        try {
            const ownerPadded = params.walletAddress.slice(2).toLowerCase().padStart(64, '0');
            const balanceOfData = `0x70a08231${ownerPadded}`;
            const balanceResult = await deps.callRpc<string>(params.chainId, 'eth_call', [
                { to: actualTokenIn, data: balanceOfData },
                'latest',
            ]);
            const onChainBalanceWei = BigInt(balanceResult || '0x0');
            const requestedAmountWei = BigInt(deps.toWei(resolvedAmountIn, tokenInDecimals));

            if (requestedAmountWei > onChainBalanceWei) {
                const safeBalance = onChainBalanceWei > 1000n ? onChainBalanceWei - 1000n : onChainBalanceWei;
                const divisor = 10n ** BigInt(tokenInDecimals);
                const whole = safeBalance / divisor;
                const remainder = safeBalance % divisor;
                const remainderStr = remainder.toString().padStart(tokenInDecimals, '0');
                resolvedAmountIn = `${whole}.${remainderStr}`;
            }
        } catch (rpcError) {
            console.warn('[Swap Execute Instant] RPC balance check failed, proceeding with original amount:', rpcError);
        }
    }

    const [tokenInUsd, tokenOutUsd] = await Promise.all([
        withTimeout(
            deps.getTokenPriceUSD(actualTokenIn, params.chainId),
            SWAP_AUX_PRICE_TIMEOUT_MS,
            null
        ),
        withTimeout(
            deps.getTokenPriceUSD(actualTokenOut, params.chainId),
            SWAP_AUX_PRICE_TIMEOUT_MS,
            null
        ),
    ]);
    const amountInUsd = tokenInUsd ? parseFloat(resolvedAmountIn) * tokenInUsd : 0;

    const persistedUserSettings = await deps.getUserSettings(params.userId);
    const effectiveUserSettings = {
        swapMethod: persistedUserSettings?.swapMethod || 'allowance_trade',
        fastSwapMode: persistedUserSettings?.fastSwapMode === true,
        mevProtection: persistedUserSettings?.mevProtection !== false,
    };

    const executionMode = params.transactionMessageId ? 'allowance' : 'swap-card';
    const executionSource = params.executionSource || (params.transactionMessageId ? 'chat' : 'wallet_page');
    const routePolicy = params.routePolicy || (params.transactionMessageId ? 'external_only' : 'legacy_allowed');
    const requireConfirmedTx = executionSource === 'copytrade' || executionSource === 'system';

    const tokenInSymbol = tokenInMetadata?.symbol || params.tokenIn.slice(0, 6).toUpperCase();
    const tokenOutSymbol = tokenOutMetadata?.symbol || params.tokenOut.slice(0, 6).toUpperCase();
    const pendingTrade = await deps.createPendingSwapHistory({
        userId: params.userId,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: resolvedAmountIn,
        amountInUsd,
        tokenInSymbol,
        tokenOutSymbol,
        chainId: params.chainId,
        slippageBps: params.slippageBps,
    });

    let swapResult: MainSwapResult;
    try {
        swapResult = await deps.executeSwap({
            userId: params.userId,
            walletAddress: params.walletAddress,
            accessToken: params.accessToken,
            tokenIn: actualTokenIn,
            tokenOut: actualTokenOut,
            amountIn: resolvedAmountIn,
            chainId: params.chainId,
            slippageBps: params.slippageBps,
            mode: executionMode,
            executionSource,
            routePolicy,
            messageId: params.transactionMessageId,
            userSettings: effectiveUserSettings,
            requireConfirmedTx,
            executionContext: params.nativeBalanceEvidence
                ? {
                    nativeBalanceEvidence: params.nativeBalanceEvidence,
                }
                : undefined,
        });
    } catch (error: any) {
        await deps.updateSwapHistory(pendingTrade.id, {
            status: 'failed',
            error: error?.message || 'Swap execution failed',
        });
        throw error;
    }

    if (!swapResult.success) {
        const rawError = swapResult.error || 'Swap execution failed';
        await deps.updateSwapHistory(pendingTrade.id, {
            status: 'failed',
            txHash: swapResult.txHash || null,
            error: swapResult.userMessage || rawError,
        });
        const insufficientMatch = /insufficient_native_balance_precheck:\s*have=([0-9.]+)\s*required=([0-9.]+)/i.exec(rawError);
        if (insufficientMatch) {
            throw new AppError(
                400,
                `Insufficient native balance for amount + gas. Have ${insufficientMatch[1]}, require ${insufficientMatch[2]}.`,
                'INSUFFICIENT_NATIVE_BALANCE'
            );
        }
        throw new AppError(
            resolveSwapFailureStatusCode(swapResult.reasonCode, rawError),
            swapResult.userMessage || rawError,
            swapResult.reasonCode || 'SWAP_FAILED'
        );
    }

    const txHash = swapResult.txHash!;
    const amountOutUsd = tokenOutUsd && swapResult.amountOut
        ? parseFloat(swapResult.amountOut) * tokenOutUsd
        : 0;

    const executionOutcome = resolveInstantExecutionOutcome({
        requireConfirmedTx,
        swapResult,
    });

    await deps.updateSwapHistory(pendingTrade.id, {
        status: executionOutcome.historyStatus,
        txHash,
        amountOut: swapResult.amountOut || null,
        amountOutUsd,
        confirmedAt: executionOutcome.confirmedAt,
    });

    if (executionOutcome.historyStatus === 'success') {
        deps.trackSwap(pendingTrade.userId, pendingTrade.tokenInUsd || 0);
    }

    if (executionOutcome.shouldScheduleSettlement) {
        deps.scheduleTradeSettlement({
            tradeId: pendingTrade.id,
            txHash,
            chainId: params.chainId,
            userId: pendingTrade.userId,
            amountInUsd: pendingTrade.tokenInUsd || 0,
            amountOut: swapResult.amountOut || null,
            amountOutUsd,
            updateSwapHistory: deps.updateSwapHistory,
            trackSwap: deps.trackSwap,
        });
    }

    return {
        txHash,
        tradeId: pendingTrade.id,
        status: executionOutcome.responseStatus,
        amountOut: swapResult.amountOut || null,
    };
}

export async function handleEvmExecuteInstant(
    params: EvmExecuteInstantParams,
    reply: { send: (payload: unknown) => unknown }
) {
    const result = await executeEvmInstantWithDeps(params, defaultDeps);
    return reply.send({
        success: true,
        data: result,
    });
}

export const __evmExecuteInstantTest = {
    executeEvmInstantWithDeps,
    NATIVE_TOKEN_PLACEHOLDER,
    resolveInstantExecutionOutcome,
};
