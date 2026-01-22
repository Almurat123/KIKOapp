/**
 * Jupiter Aggregator Provider (Solana)
 * Wraps existing Jupiter/Solana swap logic
 */

import { BaseSwapProvider } from './BaseProvider.js';
import { SwapQuote, SwapRequest } from '../types.js';
import { getSolanaQuote } from '../../solanaSwap.js';

export class JupiterProvider extends BaseSwapProvider {
    readonly name = 'jupiter';
    readonly supportedChains = [900, 101, -1];

    async getQuote(request: SwapRequest): Promise<SwapQuote | null> {
        try {
            const WSOL = 'So11111111111111111111111111111111111111112';

            // Determine mints based on sell/buy
            const tokenInMint = request.isSell ? request.tokenIn : WSOL;
            const tokenOutMint = request.isSell ? WSOL : request.tokenOut;

            // For Solana, amount is usually in lamports/smallest unit
            // Assume input is already in correct units or convert
            const decimals = request.isSell ? 6 : 9; // Simplified
            const amountInLamports = Math.floor(parseFloat(request.amountIn) * Math.pow(10, decimals)).toString();

            const jupiterQuote = await getSolanaQuote(
                tokenInMint,
                tokenOutMint,
                amountInLamports,
                request.slippageBps || 100,
                'auto',
                request.walletAddress
            );

            if (!jupiterQuote) {
                return null;
            }

            const quote: SwapQuote = {
                provider: this.name,
                amountInBase: amountInLamports,
                amountOutBase: jupiterQuote.outAmount,
                amountOutHuman: (parseInt(jupiterQuote.outAmount) / Math.pow(10, 9)).toString(),
                priceImpact: parseFloat(jupiterQuote.priceImpact || '0'),
                to: '', // Solana doesn't use 'to' address
                data: '', // Handled by solanaExecutor
                value: '0',
                metadata: {
                    tokenInMint,
                    tokenOutMint,
                    routePlan: jupiterQuote.routePlan
                }
            };

            this.logQuote(quote, request);
            return quote;

        } catch (error) {
            return this.handleError(error, 'getQuote');
        }
    }
}
