/**
 * ⚠️ DEPRECATED - Use MainSwapService instead
 * 
 * This file is deprecated and will be removed in a future release.
 * All callers should migrate to MainSwapService.executeSwap() for:
 * - Unified swap execution across all platforms
 * - Consistent fee handling (0.5% for swap, 1% for copy_trade)
 * - Launchpad token routing
 * - Better logging and error handling
 * 
 * Direct Swap Executor Service - REFACTORED
 * Now uses the new unified SwapRouter
 */

import { swapRouter } from './swap/index.js';
import { SwapRequest } from './swap/types.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT } from '../config/tokenRegistry.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export interface DirectSwapParams {
    sessionId: string;
    userId: string;
    accessToken: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippage?: number;
}

export interface DirectSwapResult {
    success: boolean;
    txHash?: string;
    amountOut?: string;
    error?: string;
    method: string;
}

/**
 * ⚠️ DEPRECATED - Use MainSwapService instead
 * Execute a swap directly using the new SwapRouter
 * 
 * Migration: Call mainSwapService.executeSwap() instead
 */
export async function executeDirectSwap(params: DirectSwapParams): Promise<DirectSwapResult> {
    logger.warn(LogCode.SYS_INFO, '⚠️ DEPRECATED: directSwapExecutor.executeDirectSwap() called - migrate to MainSwapService', {
        caller: new Error().stack?.split('\n')[2],
        tokenIn: params.tokenIn.slice(0, 10),
        tokenOut: params.tokenOut.slice(0, 10)
    });
    console.log('[DirectSwap] ⚡ Executing swap via SwapRouter:', {
        tokenIn: params.tokenIn.slice(0, 10) + '...',
        tokenOut: params.tokenOut.slice(0, 10) + '...',
        amount: params.amountIn,
        chain: params.chainId
    });

    // CRITICAL FIX: Normalize native token inputs (ETH, BNB -> 0xEeeee...)
    // 0x API and Kyber require the specific native address, not the symbol.
    let normalizedTokenIn = params.tokenIn;
    let normalizedTokenOut = params.tokenOut;
    const isSolana = params.chainId === 900 || params.chainId === 101;

    if (isSolana) {
        if (normalizedTokenIn === 'SOL') normalizedTokenIn = SOLANA_NATIVE_MINT;
        if (normalizedTokenOut === 'SOL') normalizedTokenOut = SOLANA_NATIVE_MINT;
    } else {
        // EVM chains - normalize BOTH tokenIn and tokenOut
        if (['ETH', 'BNB', 'MATIC', 'AVAX'].includes(normalizedTokenIn.toUpperCase())) {
            normalizedTokenIn = NATIVE_TOKEN_ADDRESS;
        }
        if (['ETH', 'BNB', 'MATIC', 'AVAX'].includes(normalizedTokenOut.toUpperCase())) {
            normalizedTokenOut = NATIVE_TOKEN_ADDRESS;
        }
    }

    // Update params reference for downstream logic
    const actualTokenIn = normalizedTokenIn;
    const actualTokenOut = normalizedTokenOut;

    // Detect if this is a sell operation
    // A swap is a "sell" if tokenIn is a specific token (not native)
    // A swap is a "sell" if tokenIn is a specific token (not native)
    const isNativeIn = isSolana
        ? (actualTokenIn === SOLANA_NATIVE_MINT)
        : (actualTokenIn.toLowerCase() === NATIVE_TOKEN_ADDRESS);

    // If it's not native in, and it's a token-address-like input, it's likely a sell
    const isSell = !isNativeIn &&
        ((actualTokenIn.startsWith('0x') && actualTokenIn.length > 20) ||
            (!actualTokenIn.startsWith('0x') && actualTokenIn.length >= 32));

    // Build request for SwapRouter
    const request: SwapRequest = {
        userId: params.userId,
        walletAddress: params.walletAddress,
        tokenIn: actualTokenIn,
        tokenOut: actualTokenOut,  // ✅ FIXED: Use normalized tokenOut
        amountIn: params.amountIn,
        chainId: params.chainId,
        slippageBps: Math.round((params.slippage || 3) * 100),
        feeContext: 'swap',
        isSell
    };

    try {
        // Execute via SwapRouter
        const result = await swapRouter.swap(request);

        if (result.success) {
            console.log('[DirectSwap] ✅ Swap successful:', result.txHash);
            return {
                success: true,
                txHash: result.txHash,
                amountOut: result.amountOut,
                method: result.provider
            };
        } else {
            console.error('[DirectSwap] ❌ Swap failed:', result.error);

            // AUTO-SLIPPAGE RETRY LOGIC (Moved here because swapRouter catches errors)
            // If error is execution reverted, and we haven't retried with high slippage yet
            const errorMessage = result.error?.toLowerCase() || '';
            const isRevert = errorMessage.includes('reverted') || errorMessage.includes('execution failed');
            const currentSlippage = params.slippage || 3;

            if (isRevert && currentSlippage < 10) {
                console.log('[DirectSwap] 🔄 Transaction reverted. Retrying with AUTO-SLIPPAGE (10%)...');

                // Recursive call with higher slippage
                return executeDirectSwap({
                    ...params,
                    slippage: 10 // Boost to 10%
                });
            }

            return {
                success: false,
                error: result.error,
                method: result.provider || 'failed'
            };
        }
    } catch (error: any) {
        console.error('[DirectSwap] ❌ Unexpected error:', error);

        // AUTO-SLIPPAGE RETRY LOGIC
        // If error is execution reverted, and we haven't retried with high slippage yet
        const errorMessage = error.message?.toLowerCase() || '';
        const isRevert = errorMessage.includes('reverted') || errorMessage.includes('execution failed');
        const currentSlippage = params.slippage || 3;

        if (isRevert && currentSlippage < 10) {
            console.log('[DirectSwap] 🔄 Transaction reverted. Retrying with AUTO-SLIPPAGE (10%)...');

            // Recursive call with higher slippage
            // We limit this to one retry by checking if slippage is already >= 10
            return executeDirectSwap({
                ...params,
                slippage: 10 // Boost to 10%
            });
        }

        return {
            success: false,
            error: error.message || 'Unknown error',
            method: 'failed'
        };
    }
}
