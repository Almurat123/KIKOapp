/**
 * 0x API Provider
 * Wraps existing zeroEx service into new provider interface
 */

import { BaseSwapProvider } from './BaseProvider.js';
import { SwapQuote, SwapRequest } from '../types.js';
import { toBaseUnits, fromBaseUnits } from '../utils.js';
import { getZeroExQuote, getZeroExTokenMetadata } from '../../zeroEx.js';

export class ZeroExProvider extends BaseSwapProvider {
    readonly name = '0x';
    readonly supportedChains = [1, 8453, 56, 42161, 10, 137, 43114, 250];

    async getQuote(request: SwapRequest): Promise<SwapQuote | null> {
        try {
            // Get token metadata for decimals
            const [tokenInMeta, tokenOutMeta] = await Promise.all([
                getZeroExTokenMetadata(request.tokenIn, request.chainId),
                getZeroExTokenMetadata(request.tokenOut, request.chainId)
            ]);

            const tokenInDecimals = tokenInMeta?.decimals || 18;
            const tokenOutDecimals = tokenOutMeta?.decimals || 18;

            // Convert amount to base units
            const sellAmount = toBaseUnits(request.amountIn, tokenInDecimals);

            // Call existing 0x service
            const zeroExQuote = await getZeroExQuote(
                request.tokenIn,
                request.tokenOut,
                sellAmount,
                request.chainId,
                request.slippageBps || 50,
                request.walletAddress
            );

            if (!zeroExQuote) {
                return null;
            }

            // Convert to our standard format
            const quote: SwapQuote = {
                provider: this.name,
                amountInBase: sellAmount,
                amountOutBase: zeroExQuote.buyAmount,
                amountOutHuman: fromBaseUnits(zeroExQuote.buyAmount, tokenOutDecimals),
                priceImpact: typeof zeroExQuote.estimatedPriceImpact === 'number' ? zeroExQuote.estimatedPriceImpact : parseFloat(zeroExQuote.estimatedPriceImpact || '0'),
                gasEstimate: zeroExQuote.gas,
                to: zeroExQuote.to || '',
                data: zeroExQuote.data || '',
                value: zeroExQuote.value || '0',
                allowanceTarget: zeroExQuote.allowanceTarget,
                metadata: {
                    tokenInDecimals,
                    tokenOutDecimals,
                    sources: zeroExQuote.sources
                }
            };

            this.logQuote(quote, request);
            return quote;

        } catch (error) {
            return this.handleError(error, 'getQuote');
        }
    }
}
