/**
 * Base Swap Provider
 * Abstract class that all swap providers extend
 */

import { SwapProvider, SwapRequest, SwapQuote } from '../types.js';
import { parseSwapError } from '../utils.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

export abstract class BaseSwapProvider implements SwapProvider {
    abstract readonly name: string;
    abstract readonly supportedChains: number[];

    /**
     * Get a quote for a swap
     * Subclasses must implement this
     */
    abstract getQuote(request: SwapRequest): Promise<SwapQuote | null>;

    /**
     * Check if provider supports a token on a chain
     * Default implementation just checks if chain is supported
     */
    async supportsToken(token: string, chainId: number): Promise<boolean> {
        return this.supportedChains.includes(chainId);
    }

    /**
     * Handle errors in a consistent way
     */
    protected handleError(error: any, context: string): null {
        const errorMsg = parseSwapError(error);
        logger.warn(LogCode.API_FETCH_FAILED, `${this.name}: ${context} failed`, {
            error: errorMsg,
            provider: this.name
        });
        return null;
    }

    /**
     * Log quote success
     */
    protected logQuote(quote: SwapQuote, request: SwapRequest): void {
        logger.info(LogCode.API_FETCH_SUCCESS, `${this.name}: Quote received`, {
            provider: this.name,
            chainId: request.chainId,
            amountIn: request.amountIn,
            amountOut: quote.amountOutHuman || quote.amountOutBase,
            priceImpact: quote.priceImpact
        });
    }
}
