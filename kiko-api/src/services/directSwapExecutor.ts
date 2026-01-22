/**
 * Direct Swap Executor Service - REFACTORED
 * Now uses the new unified SwapRouter
 */

import { swapRouter } from './swap/index.js';
import { SwapRequest } from './swap/types.js';

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
 * Execute a swap directly using the new SwapRouter
 */
export async function executeDirectSwap(params: DirectSwapParams): Promise<DirectSwapResult> {
    console.log('[DirectSwap] ⚡ Executing swap via SwapRouter:', {
        tokenIn: params.tokenIn.slice(0, 10) + '...',
        tokenOut: params.tokenOut.slice(0, 10) + '...',
        amount: params.amountIn,
        chain: params.chainId
    });

    // Detect if this is a sell operation
    const isEvmToken = params.tokenIn.startsWith('0x') &&
        params.tokenIn !== '0x0000000000000000000000000000000000000000';
    const isSolanaToken = !params.tokenIn.startsWith('0x') &&
        params.tokenIn.length >= 32 && params.tokenIn.length <= 44;

    const isEvmSell = isEvmToken &&
        (params.tokenOut.toUpperCase() === 'ETH' ||
            params.tokenOut.toUpperCase() === 'BNB' ||
            params.tokenOut === '0x0000000000000000000000000000000000000000' ||
            params.tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');

    const isSolanaSell = isSolanaToken &&
        (params.tokenOut.toUpperCase() === 'SOL' || params.tokenOut.toUpperCase() === 'WSOL');

    const isSell = isEvmSell || isSolanaSell;

    // Build request for SwapRouter
    const request: SwapRequest = {
        userId: params.userId,
        walletAddress: params.walletAddress,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
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
            return {
                success: false,
                error: result.error,
                method: result.provider || 'failed'
            };
        }
    } catch (error: any) {
        console.error('[DirectSwap] ❌ Unexpected error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
            method: 'failed'
        };
    }
}
