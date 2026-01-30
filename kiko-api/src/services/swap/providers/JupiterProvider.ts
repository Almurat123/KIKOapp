/**
 * Jupiter Aggregator Provider (Solana)
 * Wraps existing Jupiter/Solana swap logic
 */

import { BaseSwapProvider } from './BaseProvider.js';
import { SwapQuote, SwapRequest } from '../types.js';
import { getSolanaQuote } from '../../solanaSwap.js';
import { getTokenInfo } from '../../tokenService.js';

export class JupiterProvider extends BaseSwapProvider {
    readonly name = 'jupiter';
    readonly supportedChains = [900];

    async getQuote(request: SwapRequest): Promise<SwapQuote | null> {
        try {
            const WSOL = 'So11111111111111111111111111111111111111112';

            // Use provided mints from request
            const tokenInMint = request.tokenIn;
            const tokenOutMint = request.tokenOut;

            // Fetch actual decimals
            const tokenInInfo = await getTokenInfo(tokenInMint, 900);
            const decimals = tokenInInfo?.decimals ?? (request.isSell ? 6 : 9);
            const amountInLamports = Math.floor(parseFloat(request.amountIn) * Math.pow(10, decimals)).toString();

            const jupiterQuote = await getSolanaQuote(
                tokenInMint,
                tokenOutMint,
                amountInLamports,
                request.slippageBps || 100,
                'auto',
                request.walletAddress,
                undefined,
                request.feeContext
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
