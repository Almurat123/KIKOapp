import { executeSolanaSwap } from '../../services/solanaExecutor.js';
import { solanaLaunchpadSwapService } from '../../services/solanaLaunchpadSwapService.js';
import { findTokenOnAnyChain } from '../../services/ai/tokenDetector.js';
import { normalizeSolanaTokenAddress } from '../../services/solanaSwap.js';
import { toWei } from '../../services/zeroEx.js';
import { getSolanaTokenMetadata } from '../../utils/solanaToken.js';

type SolanaExecuteMethod = 'solana_launchpad' | 'solana_pumpswap_fast' | 'jupiter_aggregator';

export interface SolanaExecuteInstantParams {
    userId: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    slippageBps: number;
    accessToken: string;
}

type SolanaExecuteInstantDeps = {
    executeSolanaSwap: typeof executeSolanaSwap;
    findTokenOnAnyChain: typeof findTokenOnAnyChain;
    getSolanaTokenMetadata: typeof getSolanaTokenMetadata;
    normalizeSolanaTokenAddress: typeof normalizeSolanaTokenAddress;
    solanaLaunchpadSwapService: typeof solanaLaunchpadSwapService;
    toWei: typeof toWei;
};

const defaultDeps: SolanaExecuteInstantDeps = {
    executeSolanaSwap,
    findTokenOnAnyChain,
    getSolanaTokenMetadata,
    normalizeSolanaTokenAddress,
    solanaLaunchpadSwapService,
    toWei,
};

const SOLANA_TOKEN_SYMBOLS: Record<string, string> = {
    SOL: 'So11111111111111111111111111111111111111112',
    WSOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

export function resolveSolanaTokenAddress(symbolOrAddress: string): string {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(symbolOrAddress)) {
        return symbolOrAddress;
    }

    const upperSymbol = symbolOrAddress.toUpperCase();
    return SOLANA_TOKEN_SYMBOLS[upperSymbol] || symbolOrAddress;
}

async function executeSolanaInstantWithDeps(
    params: SolanaExecuteInstantParams,
    deps: SolanaExecuteInstantDeps
): Promise<{ txHash: string; method: SolanaExecuteMethod }> {
    const resolvedTokenIn = resolveSolanaTokenAddress(params.tokenIn);
    const resolvedTokenOut = resolveSolanaTokenAddress(params.tokenOut);
    const usdcMint = deps.normalizeSolanaTokenAddress('USDC');
    const usdtMint = deps.normalizeSolanaTokenAddress('USDT');
    const solMint = deps.normalizeSolanaTokenAddress('SOL');

    console.log('[Swap Execute Instant] Resolved Solana tokens:', {
        tokenInOriginal: params.tokenIn,
        tokenInResolved: resolvedTokenIn,
        tokenOutOriginal: params.tokenOut,
        tokenOutResolved: resolvedTokenOut,
    });

    const tokenInMetadata = await deps.getSolanaTokenMetadata(resolvedTokenIn);
    const tokenInDecimals = tokenInMetadata?.decimals || 9;
    const amountInAtomic = deps.toWei(params.amountIn, tokenInDecimals);

    const isStableOut = resolvedTokenOut === usdcMint || resolvedTokenOut === usdtMint;
    const isNativeOut = resolvedTokenOut === solMint;

    console.log('[Swap Execute Instant] Solana swap path (swap-card mode)', {
        isStableOut,
        isNativeOut,
    });

    const tokenInfo = await deps.findTokenOnAnyChain(resolvedTokenOut);
    const launchpadProvider = tokenInfo?.launchpad?.provider || null;

    console.log('[Swap Execute Instant] Solana token launchpad:', launchpadProvider);

    if (launchpadProvider === 'pumpfun' || launchpadProvider === 'bonkfun') {
        const txHash = await deps.solanaLaunchpadSwapService.fastSwap({
            userId: params.userId,
            mint: resolvedTokenOut,
            amount: amountInAtomic,
            isBuy: true,
            provider: launchpadProvider === 'pumpfun' ? 'pumpfun' : 'bonkfun',
            slippageBps: params.slippageBps,
            feeContext: 'swap',
        });

        return {
            txHash,
            method: 'solana_launchpad',
        };
    }

    if (launchpadProvider === 'pumpswap') {
        const txHash = await deps.executeSolanaSwap({
            userId: params.userId,
            tokenInMint: resolvedTokenIn,
            tokenOutMint: resolvedTokenOut,
            amountIn: amountInAtomic,
            slippageBps: params.slippageBps,
            feeContext: 'swap',
            accessToken: params.accessToken,
            waitForConfirmation: false,
            executionMode: 'turbo',
            launchpadProvider: 'pumpswap'
        });

        return {
            txHash,
            method: 'solana_pumpswap_fast',
        };
    }

    console.log('[Swap Execute Instant] Standard Solana token, using Jupiter aggregator...');

    const tokenOutMetadata = await deps.getSolanaTokenMetadata(resolvedTokenOut);
    const tokenOutDecimals = tokenOutMetadata?.decimals || 9;

    console.log('[Swap Execute Instant] Token metadata:', {
        tokenIn: resolvedTokenIn,
        tokenInDecimals,
        tokenOut: resolvedTokenOut,
        tokenOutDecimals,
    });

    const txHash = await deps.executeSolanaSwap({
        userId: params.userId,
        tokenInMint: resolvedTokenIn,
        tokenOutMint: resolvedTokenOut,
        amountIn: amountInAtomic,
        slippageBps: params.slippageBps,
        feeContext: 'swap',
        accessToken: params.accessToken,
        executionMode: 'normal',
    });

    return {
        txHash,
        method: 'jupiter_aggregator',
    };
}

export async function handleSolanaExecuteInstant(
    params: SolanaExecuteInstantParams,
    reply: { send: (payload: unknown) => unknown }
) {
    const result = await executeSolanaInstantWithDeps(params, defaultDeps);
    return reply.send({
        success: true,
        data: result,
    });
}

export const __solanaExecuteInstantTest = {
    executeSolanaInstantWithDeps,
    resolveSolanaTokenAddress,
};
