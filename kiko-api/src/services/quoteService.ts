import { ethers } from 'ethers';
import { getZeroExQuote, getDefaultTakerAddress } from './zeroEx.js';
import { getKyberQuote } from './kyberAggregator.js';
import { AppError } from '../middleware/errorHandler.js';

export interface QuoteResult {
    dex: string;
    dexName: string;
    amountOut: string;      // Human readable
    amountOutBase: string;  // Wei / Base units
    gasEstimate: number;
    priceImpact: number;
    path: string[];
    router: string;
    data: string;
    to: string;
    value: string;
    allowanceTarget: string;
    deadline: number;
    tokenInDecimals: number;
    tokenOutDecimals: number;
    priceImpactVsMkt?: number | null;
}

export interface BestQuoteParams {
    tokenIn: string;
    tokenOut: string;
    actualTokenIn: string;
    actualTokenOut: string;
    amountInBase: string; // wei
    amountInHuman: number;
    tokenInDecimals: number;
    tokenOutDecimals: number;
    chainId: number;
    slippageBps: number;
    userAddress?: string;
    refPrice?: number | null; // USD price ratio for price impact calc
}

/**
 * Fetch quotes from multiple aggregators and return the best one
 */
export async function getBestQuote(params: BestQuoteParams): Promise<{ best: QuoteResult, quotes: QuoteResult[] }> {
    const {
        tokenIn, tokenOut, actualTokenIn, actualTokenOut,
        amountInBase, amountInHuman,
        tokenInDecimals, tokenOutDecimals,
        chainId, slippageBps, userAddress, refPrice
    } = params;

    const quotes: QuoteResult[] = [];

    // Helper to calc price impact vs market
    const calcImpactVsMkt = (amountOutHuman: number): number | null => {
        if (!refPrice || !Number.isFinite(refPrice)) return null;
        if (!amountInHuman || amountInHuman <= 0) return null;
        const quotePrice = amountOutHuman / params.amountInHuman;
        if (!Number.isFinite(quotePrice) || quotePrice <= 0) return null;
        return ((quotePrice - refPrice) / refPrice) * 100;
    };

    // 1. 0x Aggregator
    const fetchZeroEx = async () => {
        try {
            const takerAddress = userAddress || getDefaultTakerAddress(chainId);
            const q = await getZeroExQuote(
                actualTokenIn,
                actualTokenOut,
                amountInBase,
                chainId,
                slippageBps,
                takerAddress
            );

            if (q) {
                // Use ethers for accurate decimal formatting
                const amountOutHuman = ethers.formatUnits(q.buyAmount, tokenOutDecimals);
                const impactVsMkt = calcImpactVsMkt(parseFloat(amountOutHuman));

                quotes.push({
                    dex: '0x',
                    dexName: '0x Aggregator',
                    amountOut: amountOutHuman,
                    amountOutBase: q.buyAmount,
                    gasEstimate: q.estimatedGas ? parseInt(q.estimatedGas) : 150000,
                    priceImpact: impactVsMkt ?? parseFloat(q.estimatedPriceImpact || '0') * 100,
                    priceImpactVsMkt: impactVsMkt ?? null,
                    path: [tokenIn, tokenOut],
                    router: q.to || '',
                    data: q.data || '',
                    to: q.to || '',
                    value: q.value || '0',
                    allowanceTarget: q.allowanceTarget || '',
                    deadline: Math.floor(Date.now() / 1000) + 600,
                    tokenInDecimals,
                    tokenOutDecimals,
                });
            }
        } catch (err) {
            console.warn('[QuoteService] 0x failed', err);
        }
    };

    // 2. KyberSwap
    const fetchKyber = async () => {
        try {
            const kyberQuote = await getKyberQuote(
                actualTokenIn,
                actualTokenOut,
                amountInBase,
                chainId,
                slippageBps,
                userAddress || getDefaultTakerAddress(chainId) || ''
            );

            if (kyberQuote) {
                // Use ethers for accurate decimal formatting
                const humanOut = ethers.formatUnits(kyberQuote.amountOut || '0', tokenOutDecimals);
                const impactVsMkt = calcImpactVsMkt(parseFloat(humanOut));

                quotes.push({
                    dex: 'kyber',
                    dexName: 'KyberSwap',
                    amountOut: humanOut,
                    amountOutBase: kyberQuote.amountOutBase || kyberQuote.amountOut,
                    gasEstimate: kyberQuote.gas || 200000,
                    priceImpact: impactVsMkt ?? kyberQuote.priceImpact ?? 0,
                    priceImpactVsMkt: impactVsMkt ?? null,
                    path: [tokenIn, tokenOut],
                    router: kyberQuote.routerAddress || kyberQuote.to,
                    data: kyberQuote.data,
                    to: kyberQuote.to || kyberQuote.routerAddress,
                    value: kyberQuote.value || '0',
                    allowanceTarget: kyberQuote.allowanceTarget || kyberQuote.routerAddress,
                    deadline: Math.floor(Date.now() / 1000) + 600,
                    tokenInDecimals,
                    tokenOutDecimals,
                });
            }
        } catch (err) {
            console.warn('[QuoteService] Kyber failed', err);
        }
    };

    // Parallel fetch
    await Promise.all([fetchZeroEx(), fetchKyber()]);

    if (!quotes.length) {
        return { best: null as any, quotes: [] };
    }

    // Sort by highest return
    quotes.sort((a, b) => {
        const valA = BigInt(a.amountOutBase || '0');
        const valB = BigInt(b.amountOutBase || '0');
        return valA > valB ? -1 : 1; // Descending
    });

    return { best: quotes[0], quotes };
}
