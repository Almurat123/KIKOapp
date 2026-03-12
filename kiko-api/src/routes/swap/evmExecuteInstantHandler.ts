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
import { MainSwapService, type MainSwapResult } from '../../services/MainSwapService.js';

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
}

type TokenMetadata = {
    symbol?: string | null;
    decimals?: number | null;
};

type SwapHistoryRecord = {
    id: string;
    userId: string;
    tokenInUsd?: number | null;
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
    trackSwap: typeof trackSwap;
};

const NATIVE_TOKEN_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

function toDec(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(n)) return null;
    return String(n);
}

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
    trackSwap,
};

async function executeEvmInstantWithDeps(
    params: EvmExecuteInstantParams,
    deps: EvmExecuteInstantDeps
): Promise<{ txHash: string; tradeId: string; status: 'SUCCESS'; amountOut: string | null }> {
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
        deps.getTokenPriceUSD(actualTokenIn, params.chainId),
        deps.getTokenPriceUSD(actualTokenOut, params.chainId),
    ]);

    const persistedUserSettings = await deps.getUserSettings(params.userId);
    const effectiveUserSettings = {
        swapMethod: persistedUserSettings?.swapMethod || 'allowance_trade',
        fastSwapMode: persistedUserSettings?.fastSwapMode === true,
        mevProtection: persistedUserSettings?.mevProtection !== false,
    };

    const swapResult = await deps.executeSwap({
        userId: params.userId,
        walletAddress: params.walletAddress,
        accessToken: params.accessToken,
        tokenIn: actualTokenIn,
        tokenOut: actualTokenOut,
        amountIn: resolvedAmountIn,
        chainId: params.chainId,
        slippageBps: params.slippageBps,
        mode: 'swap-card',
        messageId: params.transactionMessageId,
        userSettings: effectiveUserSettings,
    });

    if (!swapResult.success) {
        const rawError = swapResult.error || 'Swap execution failed';
        const insufficientMatch = /insufficient_native_balance_precheck:\s*have=([0-9.]+)\s*required=([0-9.]+)/i.exec(rawError);
        if (insufficientMatch) {
            throw new AppError(
                400,
                `Insufficient native balance for amount + gas. Have ${insufficientMatch[1]}, require ${insufficientMatch[2]}.`,
                'INSUFFICIENT_NATIVE_BALANCE'
            );
        }
        throw new AppError(500, rawError, 'SWAP_FAILED');
    }

    const txHash = swapResult.txHash!;
    const amountInUsd = tokenInUsd ? parseFloat(resolvedAmountIn) * tokenInUsd : 0;
    const amountOutUsd = tokenOutUsd && swapResult.amountOut
        ? parseFloat(swapResult.amountOut) * tokenOutUsd
        : 0;

    const tradeRecord = await deps.createSwapHistory({
        userId: params.userId,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: resolvedAmountIn,
        amountInUsd,
        amountOut: swapResult.amountOut || null,
        amountOutUsd,
        tokenInSymbol: tokenInMetadata?.symbol || params.tokenIn.slice(0, 6).toUpperCase(),
        tokenOutSymbol: tokenOutMetadata?.symbol || params.tokenOut.slice(0, 6).toUpperCase(),
        chainId: params.chainId,
        txHash,
        slippageBps: params.slippageBps,
    });

    deps.trackSwap(tradeRecord.userId, tradeRecord.tokenInUsd || 0);

    return {
        txHash,
        tradeId: tradeRecord.id,
        status: 'SUCCESS',
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
};
