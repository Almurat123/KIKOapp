/**
 * Kyber Aggregator Provider
 * Wraps existing kyberAggregator service
 */

import { BaseSwapProvider } from './BaseProvider.js';
import { SwapQuote, SwapRequest } from '../types.js';
import { toBaseUnits, fromBaseUnits } from '../utils.js';
import { getKyberQuote } from '../../kyberAggregator.js';
import { getZeroExTokenMetadata } from '../../zeroEx.js';

export class KyberProvider extends BaseSwapProvider {
    readonly name = 'kyber';
    readonly supportedChains = [1, 8453, 56, 42161, 10, 137, 43114];

    async getQuote(request: SwapRequest): Promise<SwapQuote | null> {
        try {
            // Get token metadata
            const [tokenInMeta, tokenOutMeta] = await Promise.all([
                getZeroExTokenMetadata(request.tokenIn, request.chainId),
                getZeroExTokenMetadata(request.tokenOut, request.chainId)
            ]);

            const tokenInDecimals = tokenInMeta?.decimals || 18;
            const tokenOutDecimals = tokenOutMeta?.decimals || 18;

            const sellAmount = toBaseUnits(request.amountIn, tokenInDecimals);

            // Call existing Kyber service
            const kyberQuote = await getKyberQuote(
                request.tokenIn,
                request.tokenOut,
                sellAmount,
                request.chainId,
                request.slippageBps || 50,
                request.walletAddress,
                request.feeContext,
                request.isSell
            );

            if (!kyberQuote) {
                return null;
            }

            const quote: SwapQuote = {
                provider: this.name,
                amountInBase: sellAmount,
                amountOutBase: kyberQuote.amountOut,
                amountOutHuman: fromBaseUnits(kyberQuote.amountOut, tokenOutDecimals),
                priceImpact: kyberQuote.priceImpact || 0,
                gasEstimate: kyberQuote.gas,
                to: kyberQuote.routerAddress,
                data: kyberQuote.data,
                value: kyberQuote.value || '0',
                allowanceTarget: kyberQuote.routerAddress,
                metadata: {
                    tokenInDecimals,
                    tokenOutDecimals
                }
            };

            this.logQuote(quote, request);
            return quote;

        } catch (error) {
            return this.handleError(error, 'getQuote');
        }
    }
}
