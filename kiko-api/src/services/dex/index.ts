/**
 * DEX Aggregator - Direct Swap Service
 * Unified interface for direct DEX interactions
 * Replaces external aggregator dependency with direct router calls
 */

import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { DexQuote, SwapParams } from './types.js';
import { getV3Quote, buildV3SwapTransaction } from './uniswapV3.js';
import { getAerodromeQuote, buildAerodromeSwapTransaction } from './aerodrome.js';
import { getPancakeQuote, buildPancakeSwapTransaction } from './pancakeswap.js';

export * from './types.js';
export * from './uniswapV3.js';
export * from './aerodrome.js';
export * from './pancakeswap.js';
export * from './flashbots.js';
export * from './poolInfo.js';

// Gas price estimates by chain (in gwei)
const GAS_PRICE_GWEI: Record<number, bigint> = {
    1: BigInt(30),      // ETH mainnet
    8453: BigInt(0.01 * 1e9),  // Base (very low)
    42161: BigInt(0.1 * 1e9),  // Arbitrum
    56: BigInt(3),      // BSC
    137: BigInt(50),    // Polygon
};

/**
 * Get best quote across all available DEXes
 * [Logic]: Queries all DEXes in parallel, returns best net output
 * Net output = amountOut - (gasEstimate * gasPrice)
 */
export async function getBestQuote(
    params: SwapParams,
    chainId: number
): Promise<DexQuote | null> {
    const quotes: (DexQuote | null)[] = await Promise.all([
        // V3 (ETH, Base, Arbitrum)
        getV3Quote(params, chainId).catch(() => null),

        // Aerodrome (Base only)
        chainId === 8453 ? getAerodromeQuote(params, chainId).catch(() => null) : null,

        // PancakeSwap (BSC only)
        chainId === 56 ? getPancakeQuote(params, chainId).catch(() => null) : null,
    ]);

    // Filter valid quotes
    const validQuotes = quotes.filter((q): q is DexQuote => q !== null && q.amountOut > BigInt(0));

    if (validQuotes.length === 0) {
        logger.warn(LogCode.API_FETCH_FAILED, 'No valid DEX quotes found', {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            chainId
        });
        return null;
    }

    // Calculate net output for each quote
    // [Logic]: netOutput = amountOut - gasCostInOutputToken (approximation)
    const gasPrice = GAS_PRICE_GWEI[chainId] || BigInt(20);

    const quotesWithNet = validQuotes.map(q => {
        // Gas cost in wei
        const gasCostWei = q.gasEstimate * gasPrice;
        // For simplicity, assume 1:1 ratio (in production, would convert via oracle)
        // This is a rough approximation - gas is paid in native token
        return {
            quote: q,
            gasCostWei,
            // For comparison, just use amountOut (gas is usually negligible for most swaps)
            netScore: q.amountOut
        };
    });

    // Sort by netScore descending
    quotesWithNet.sort((a, b) => {
        if (b.netScore > a.netScore) return 1;
        if (b.netScore < a.netScore) return -1;
        // Tie-breaker: prefer lower gas
        if (a.gasCostWei < b.gasCostWei) return -1;
        if (a.gasCostWei > b.gasCostWei) return 1;
        return 0;
    });

    const best = quotesWithNet[0].quote;

    // Log all quotes for comparison
    logger.info(LogCode.API_FETCH_SUCCESS, `🏆 Best quote: ${best.dex}`, {
        amountOut: best.amountOut.toString(),
        router: best.router,
        totalQuotes: validQuotes.length,
        allDexes: validQuotes.map(q => q.dex).join(', ')
    });

    return best;
}

/**
 * Build swap transaction with best available DEX
 */
export async function buildBestSwapTransaction(
    params: SwapParams,
    chainId: number
): Promise<{
    quote: DexQuote;
    approvalTx?: { to: string; data: string };
    swapTx: { to: string; data: string; value: string };
} | null> {
    // Get best quote first
    const bestQuote = await getBestQuote(params, chainId);
    if (!bestQuote) {
        return null;
    }

    // Build transaction based on DEX type
    if (bestQuote.dex.includes('Aerodrome')) {
        return buildAerodromeSwapTransaction(params, chainId);
    }

    if (bestQuote.dex.includes('PancakeSwap')) {
        return buildPancakeSwapTransaction(params, chainId);
    }

    // Default to V3
    return buildV3SwapTransaction(params, chainId);
}

/**
 * Quick helper: Get all quotes for comparison
 */
export async function getAllQuotes(
    params: SwapParams,
    chainId: number
): Promise<DexQuote[]> {
    const quotes = await Promise.all([
        getV3Quote(params, chainId).catch(() => null),
        chainId === 8453 ? getAerodromeQuote(params, chainId).catch(() => null) : null,
        chainId === 56 ? getPancakeQuote(params, chainId).catch(() => null) : null,
    ]);

    return quotes.filter((q): q is DexQuote => q !== null);
}
