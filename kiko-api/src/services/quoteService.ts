import { ethers } from 'ethers';
import { getZeroExQuote, getDefaultTakerAddress } from './zeroEx.js';
import { getKyberQuote } from './kyberAggregator.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ZeroExAffiliateFee } from './zeroEx.js';

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
    affiliateFee?: ZeroExAffiliateFee;
}

/**
 * Fetch quotes from multiple aggregators and return the best one
 */
export async function getBestQuote(params: BestQuoteParams): Promise<{ best: QuoteResult, quotes: QuoteResult[] }> {
    const {
        tokenIn, tokenOut, actualTokenIn, actualTokenOut,
        amountInBase, amountInHuman,
        tokenInDecimals, tokenOutDecimals,
        chainId, slippageBps, userAddress, refPrice, affiliateFee
    } = params;

    const quotes: QuoteResult[] = [];

    // Helper to calc price impact vs market
    const calcImpactVsMkt = (amountOutHuman: number): number | null => {
        if (!refPrice || !Number.isFinite(refPrice)) return null;
        if (!amountInHuman || amountInHuman <= 0) return null;
        const quotePrice = amountOutHuman / params.amountInHuman;
        if (!Number.isFinite(quotePrice) || quotePrice <= 0) return null;

        const impact = ((quotePrice - refPrice) / refPrice) * 100;

        // DEBUG: Log price impact calculation details
        console.log('[QuoteService] calcImpactVsMkt:', {
            amountIn: params.amountInHuman,
            amountOut: amountOutHuman,
            quotePrice,
            refPrice,
            tokenInUsd: params.refPrice ? 'available' : 'N/A',
            impact,
            formula: `((${quotePrice} - ${refPrice}) / ${refPrice}) * 100 = ${impact}`
        });

        // SANITY CHECK: If impact is absurdly high (> 50%), the refPrice is likely wrong
        // This happens with low-liquidity tokens where price data is unreliable
        // Return null to fall back to 0x API's estimatedPriceImpact (or 0 if unavailable)
        if (Math.abs(impact) > 50) {
            console.warn('[QuoteService] Price impact > 50%, refPrice likely unreliable. Returning null.');
            return null;
        }

        return impact;
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
                takerAddress,
                affiliateFee
            );

            if (q) {
                // Use ethers for accurate decimal formatting
                const amountOutHuman = ethers.formatUnits(q.buyAmount, tokenOutDecimals);
                const impactVsMkt = calcImpactVsMkt(parseFloat(amountOutHuman));

                // DEBUG: Log raw 0x API price impact value
                console.log('[QuoteService] 0x API estimatedPriceImpact:', {
                    raw: q.estimatedPriceImpact,
                    parsed: parseFloat(q.estimatedPriceImpact || '0'),
                    multipliedBy100: parseFloat(q.estimatedPriceImpact || '0') * 100,
                    impactVsMkt,
                    willUse: impactVsMkt ?? parseFloat(q.estimatedPriceImpact || '0') * 100
                });

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
            // Kyber integration currently doesn't expose a reliable integrator-fee mechanism here.
            // If platform fee is requested, prefer 0x so we can actually collect it.
            if (affiliateFee && affiliateFee.buyTokenPercentageFeeBps > 0) return;

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
