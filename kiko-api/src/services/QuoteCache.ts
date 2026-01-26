/**
 * Quote Cache Manager
 * Pre-warm and cache quotes for instant swaps
 */

import { QuoteResult } from './quoteService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

interface CachedQuote {
    quote: QuoteResult;
    timestamp: number;
    chainId: number;
}

class QuoteCacheClass {
    private cache: Map<string, CachedQuote> = new Map();
    private readonly TTL = 10000; // 10 seconds TTL for quotes
    
    /**
     * Get cached quote if fresh
     */
    get(tokenIn: string, tokenOut: string, chainId: number): QuoteResult | null {
        const key = this.getKey(tokenIn, tokenOut, chainId);
        const cached = this.cache.get(key);
        
        if (!cached) return null;
        
        const age = Date.now() - cached.timestamp;
        if (age > this.TTL) {
            this.cache.delete(key);
            return null;
        }
        
        logger.info(LogCode.API_FETCH_SUCCESS, 'Quote cache HIT', {
            tokenIn: tokenIn.slice(0, 10),
            tokenOut: tokenOut.slice(0, 10),
            age: `${age}ms`,
            dex: cached.quote.dexName
        });
        
        return cached.quote;
    }
    
    /**
     * Store quote in cache
     */
    set(tokenIn: string, tokenOut: string, chainId: number, quote: QuoteResult): void {
        const key = this.getKey(tokenIn, tokenOut, chainId);
        this.cache.set(key, {
            quote,
            timestamp: Date.now(),
            chainId
        });
        
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Quote cached', {
            tokenIn: tokenIn.slice(0, 10),
            tokenOut: tokenOut.slice(0, 10),
            dex: quote.dexName
        });
    }
    
    /**
     * Invalidate all quotes older than TTL
     */
    cleanup(): void {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.TTL) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.debug(LogCode.SYS_ERROR, 'Quote cache cleanup', { removed: cleaned });
        }
    }
    
    /**
     * Pre-warm quotes for common pairs
     */
    async preWarm(pairs: Array<{ tokenIn: string; tokenOut: string; chainId: number; amountIn: string }>): Promise<void> {
        logger.info(LogCode.API_FETCH_SUCCESS, 'Pre-warming quote cache', { count: pairs.length });
        
        // Import getBestQuote dynamically to avoid circular dependency
        const { getBestQuote } = await import('./quoteService.js');
        
        const results = await Promise.allSettled(
            pairs.map(async ({ tokenIn, tokenOut, chainId, amountIn }) => {
                try {
                    const { best } = await getBestQuote({
                        tokenIn,
                        tokenOut,
                        actualTokenIn: tokenIn,
                        actualTokenOut: tokenOut,
                        amountInBase: amountIn,
                        amountInHuman: 0.001, // Dummy amount for pre-warming
                        tokenInDecimals: 18,
                        tokenOutDecimals: 18,
                        chainId,
                        slippageBps: 50,
                        userAddress: undefined,
                        refPrice: null,
                        affiliateFee: undefined
                    });
                    
                    if (best) {
                        this.set(tokenIn, tokenOut, chainId, best);
                    }
                } catch (error: any) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Quote pre-warm failed', {
                        tokenIn: tokenIn.slice(0, 10),
                        error: error.message
                    });
                }
            })
        );
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        logger.info(LogCode.API_FETCH_SUCCESS, 'Quote cache pre-warmed', {
            total: pairs.length,
            succeeded,
            failed: pairs.length - succeeded
        });
    }
    
    private getKey(tokenIn: string, tokenOut: string, chainId: number): string {
        return `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
    }
}

export const QuoteCache = new QuoteCacheClass();

// Cleanup every 30 seconds
setInterval(() => {
    QuoteCache.cleanup();
}, 30000);

// Pre-warm popular pairs on Base every 2 minutes
const POPULAR_PAIRS_BASE = [
    { 
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
        tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        chainId: 8453,
        amountIn: '1000000000000000' // 0.001 ETH
    },
    {
        tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
        chainId: 8453,
        amountIn: '1000000' // 1 USDC
    }
];

setInterval(() => {
    QuoteCache.preWarm(POPULAR_PAIRS_BASE).catch(err => {
        logger.warn(LogCode.SYS_ERROR, 'Quote pre-warm failed', { error: err.message });
    });
}, 120000); // Every 2 minutes
