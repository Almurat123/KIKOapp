/**
 * Jupiter Aggregator Provider (Solana)
 * Wraps the Jupiter Metis/Swap default routing path.
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
            // Use provided mints from request
            const tokenInMint = request.tokenIn;
            const tokenOutMint = request.tokenOut;

            // Fetch actual decimals for both legs to avoid quote/output conversion drift.
            const [tokenInInfo, tokenOutInfo] = await Promise.all([
                getTokenInfo(tokenInMint, 900),
                getTokenInfo(tokenOutMint, 900),
            ]);
            const inDecimals = Number.isInteger(tokenInInfo?.decimals)
                ? Number(tokenInInfo?.decimals)
                : (request.isSell ? 6 : 9);
            const outDecimals = Number.isInteger(tokenOutInfo?.decimals)
                ? Number(tokenOutInfo?.decimals)
                : 9;
            const amountInHuman = Number.parseFloat(String(request.amountIn || '0'));
            if (!Number.isFinite(amountInHuman) || amountInHuman <= 0) return null;
            const amountInLamports = Math.floor(amountInHuman * Math.pow(10, inDecimals)).toString();
            const feeContext = request.feeContext === 'copy_trade' ? 'copyTrade' : request.feeContext;

            const jupiterQuote = await getSolanaQuote(
                tokenInMint,
                tokenOutMint,
                amountInLamports,
                request.slippageBps || 100,
                'auto',
                request.walletAddress,
                undefined,
                feeContext
            );

            if (!jupiterQuote) {
                return null;
            }

            const quote: SwapQuote = {
                provider: this.name,
                amountInBase: amountInLamports,
                amountOutBase: jupiterQuote.outAmount,
                amountOutHuman: (Number(jupiterQuote.outAmount) / Math.pow(10, outDecimals)).toString(),
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
