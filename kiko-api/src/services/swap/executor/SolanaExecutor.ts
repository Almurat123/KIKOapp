/**
 * Solana Transaction Executor
 * Handles Solana transaction execution with proper confirmation waiting
 */

import { SwapExecutor, SwapQuote, SwapRequest, SwapResult } from '../types.js';
import { parseSwapError } from '../utils.js';
import { executeSolanaSwap } from '../../solanaExecutor.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

export class SolanaExecutor implements SwapExecutor {
    private readonly SOLANA_CHAINS = [900, 101, -1];

    supportsChain(chainId: number): boolean {
        return this.SOLANA_CHAINS.includes(chainId);
    }

    async execute(
        userId: string,
        quote: SwapQuote,
        request: SwapRequest
    ): Promise<SwapResult> {
        try {
            logger.info(LogCode.EXE_TX_BROADCAST, `Executing ${quote.provider} Solana swap`, {
                provider: quote.provider
            });

            // Extract Solana-specific data from quote metadata
            const tokenInMint = quote.metadata?.tokenInMint || request.tokenIn;
            const tokenOutMint = quote.metadata?.tokenOutMint || request.tokenOut;
            const slippageBps = request.slippageBps || 100;

            const txHash = await executeSolanaSwap({
                userId,
                tokenInMint,
                tokenOutMint,
                amountIn: quote.amountInBase,
                slippageBps,
                feeContext: (request.feeContext || 'swap') as any
            });

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Solana transaction confirmed', {
                txHash,
                provider: quote.provider
            });

            return {
                success: true,
                txHash,
                amountOut: quote.amountOutHuman || quote.amountOutBase,
                provider: quote.provider,
                confirmed: true
            };

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Solana swap failed', {
                error: error.message,
                provider: quote.provider
            });

            return {
                success: false,
                error: parseSwapError(error),
                provider: quote.provider,
                confirmed: false
            };
        }
    }
}
