import { ethers } from 'ethers';
import { getZeroExQuote } from './zeroEx.js';
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
    excludeDex?: string; // Exclude this DEX from selection (for retry)
    feeContext?: 'swap' | 'copyTrade' | 'copy_trade' | 'launchpad';
    isSell?: boolean;
    executionMode?: 'safe' | 'balanced' | 'turbo';
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

    return getBestQuoteInternal(params);
}

async function getBestQuoteInternal(params: BestQuoteParams): Promise<{ best: QuoteResult, quotes: QuoteResult[] }> {
    const {
        tokenIn, tokenOut, actualTokenIn, actualTokenOut,
        amountInBase, amountInHuman,
        tokenInDecimals, tokenOutDecimals,
        chainId, slippageBps, userAddress, refPrice, affiliateFee
    } = params;

    const quotes: QuoteResult[] = [];
    const turboMode = params.executionMode === 'turbo';
    const TURBO_ZEROEX_WAIT_MS = Math.max(80, Number(process.env.QUOTE_TURBO_ZEROEX_WAIT_MS || 700));
    const TURBO_GRACE_WAIT_MS = Math.max(0, Number(process.env.QUOTE_TURBO_GRACE_WAIT_MS || 180));
    const TURBO_TOTAL_WAIT_MS = Math.max(TURBO_ZEROEX_WAIT_MS, Number(process.env.QUOTE_TURBO_TOTAL_WAIT_MS || 1600));

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

        // SANITY CHECK: If impact is > 10% and < 0 (profit?), likely refPrice is wrong
        // Legitimate slippage is usually 0.5-3%, not 4-5%+ on major pairs
        // For low-liquidity/new tokens, impact can be higher but > 10% suggests bad refPrice
        if (Math.abs(impact) > 10) {
            console.warn('[QuoteService] Price impact > 10%, refPrice likely unreliable. Returning null.', {
                impact,
                refPrice,
                quotePrice
            });
            return null;
        }

        return impact;
    };

    // 1. 0x Aggregator
    const fetchZeroEx = async (): Promise<QuoteResult | null> => {
        try {
            // For quote-only requests (no userAddress), we can still get prices
            // For actual swap execution, userAddress is REQUIRED
            const isQuoteOnly = !userAddress;
            const q = await getZeroExQuote(
                actualTokenIn,
                actualTokenOut,
                amountInBase,
                chainId,
                slippageBps,
                userAddress,
                affiliateFee,
                isQuoteOnly // Price quote only if no user address
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

                return {
                    dex: '0x',
                    dexName: '0x Aggregator',
                    amountOut: amountOutHuman,
                    amountOutBase: q.buyAmount,
                    // CRITICAL FIX: Use q.gas (actual gas from API) instead of q.estimatedGas (which doesn't exist)
                    // If gas is missing, use a reasonable default of 250000 (not 150000 which is too low)
                    gasEstimate: q.gas ? parseInt(q.gas) : 250000,
                    priceImpact: impactVsMkt ?? parseFloat(q.estimatedPriceImpact || '0') * 100,
                    priceImpactVsMkt: impactVsMkt ?? null,
                    path: [tokenIn, tokenOut],
                    router: q.to || '',
                    data: q.data || '',
                    to: q.to || '',
                    value: q.value || '0',
                    allowanceTarget: q.allowanceTarget || q.issues?.allowance?.spender || '',
                    deadline: Math.floor(Date.now() / 1000) + 600,
                    tokenInDecimals,
                    tokenOutDecimals,
                };
            }
            return null;
        } catch (err) {
            console.warn('[QuoteService] 0x failed', err);
            return null;
        }
    };

    // 2. KyberSwap
    const fetchKyber = async (): Promise<QuoteResult | null> => {
        try {
            // Kyber requires recipient address - skip if not provided
            if (!userAddress) return null;

            const kyberQuote = await getKyberQuote(
                actualTokenIn,
                actualTokenOut,
                amountInBase,
                chainId,
                slippageBps,
                userAddress,
                params.feeContext,
                params.isSell
            );

            if (kyberQuote) {
                // Use ethers for accurate decimal formatting
                const humanOut = ethers.formatUnits(kyberQuote.amountOut || '0', tokenOutDecimals);
                const impactVsMkt = calcImpactVsMkt(parseFloat(humanOut));

                return {
                    dex: 'kyber',
                    dexName: 'KyberSwap',
                    amountOut: humanOut,
                    amountOutBase: kyberQuote.amountOutBase || kyberQuote.amountOut,
                    // Use actual gas from Kyber, fallback to 300000 (not 200000 which is too low for large swaps)
                    gasEstimate: kyberQuote.gas ? parseInt(String(kyberQuote.gas)) : 300000,
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
                };
            }
            return null;
        } catch (err) {
            console.warn('[QuoteService] Kyber failed', err);
            return null;
        }
    };

    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
        let timer: NodeJS.Timeout | null = null;
        try {
            return await Promise.race([
                promise,
                new Promise<null>((resolve) => {
                    timer = setTimeout(() => resolve(null), timeoutMs);
                })
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    };

    if (turboMode) {
        const zeroExPromise = fetchZeroEx();
        const kyberPromise = fetchKyber();
        const startMs = Date.now();

        const zeroExFast = await withTimeout(zeroExPromise, TURBO_ZEROEX_WAIT_MS);
        if (zeroExFast) {
            quotes.push(zeroExFast);
            const kyberGrace = await withTimeout(kyberPromise, TURBO_GRACE_WAIT_MS);
            if (kyberGrace) quotes.push(kyberGrace);
            console.log('[QuoteService] Turbo quote mode fast-return', {
                picked: '0x_fast',
                elapsedMs: Date.now() - startMs,
                graceWaitMs: TURBO_GRACE_WAIT_MS,
                chainId: params.chainId
            });
        } else {
            const remaining = Math.max(0, TURBO_TOTAL_WAIT_MS - (Date.now() - startMs));
            const [zeroExSlow, kyberSlow] = await Promise.all([
                withTimeout(zeroExPromise, remaining),
                withTimeout(kyberPromise, remaining)
            ]);
            if (zeroExSlow) quotes.push(zeroExSlow);
            if (kyberSlow) quotes.push(kyberSlow);
            console.log('[QuoteService] Turbo quote mode fallback-wait', {
                elapsedMs: Date.now() - startMs,
                totalWaitMs: TURBO_TOTAL_WAIT_MS,
                chainId: params.chainId
            });
        }
    } else {
        // Standard mode keeps full quote race semantics.
        const [zeroExQuote, kyberQuote] = await Promise.all([fetchZeroEx(), fetchKyber()]);
        if (zeroExQuote) quotes.push(zeroExQuote);
        if (kyberQuote) quotes.push(kyberQuote);
    }

    if (!quotes.length) {
        return { best: null as any, quotes: [] };
    }

    // CRITICAL: Exclude failed DEX on retry
    // Filter out the excluded DEX before selection logic
    const availableQuotes = params.excludeDex
        ? quotes.filter(q => q.dex !== params.excludeDex)
        : quotes;

    if (params.excludeDex) {
        console.log('[QuoteService] Excluding DEX on retry:', {
            excluded: params.excludeDex,
            available: availableQuotes.map(q => q.dex).join(', ')
        });
    }

    // CRITICAL: Prefer 0x over KyberSwap for execution reliability
    // 0x has been proven to execute reliably; KyberSwap quotes well but often reverts
    // EXCEPTION: On Base chain, prefer Kyber due to 0x allowance-holder execution issues
    // Only use KyberSwap if 0x is unavailable or significantly worse (>10% difference)
    const zeroExQuote = availableQuotes.find(q => q.dex === '0x');
    const kyberQuote = availableQuotes.find(q => q.dex === 'kyber');

    if (zeroExQuote && kyberQuote) {
        const zeroExAmount = BigInt(zeroExQuote.amountOutBase || '0');
        const kyberAmount = BigInt(kyberQuote.amountOutBase || '0');

        // Calculate percentage difference
        const percentDiff = kyberAmount > 0n && zeroExAmount > 0n
            ? Math.abs(Number((kyberAmount - zeroExAmount) * 100n / zeroExAmount))
            : 0;

        console.log('[QuoteService] Quote comparison:', {
            '0x_amount': zeroExQuote.amountOut,
            'kyber_amount': kyberQuote.amountOut,
            'kyber_advantage_pct': percentDiff.toFixed(2),
            chainId: params.chainId
        });

        // CRITICAL FIX: Prefer 0x for ALL chains including Base
        // Previous logic: Base preferred Kyber due to "0x allowance-holder issues"
        // Reality: Kyber transactions are reverting frequently on Base
        // 0x allowance-holder is more reliable despite initial concerns

        // If 0x advantage or near-equal (< 2% difference), prefer 0x for reliability
        const zeroExAdvantage = zeroExAmount > kyberAmount;
        const nearEqual = percentDiff < 2;

        if (zeroExAdvantage || nearEqual) {
            console.log('[QuoteService] Preferring 0x for reliability', {
                reason: zeroExAdvantage ? '0x has better price' : 'prices within 2%',
                percentDiff: percentDiff.toFixed(2)
            });
            return { best: zeroExQuote, quotes };
        }

        // Only use Kyber if it's significantly better (>= 2% advantage)
        if (percentDiff >= 2) {
            console.log('[QuoteService] Using Kyber due to significant price advantage', {
                advantage: percentDiff.toFixed(2) + '%'
            });
            return { best: kyberQuote, quotes };
        }
    }

    if (!availableQuotes.length) {
        // If an excluded DEX caused empty results, fall back to any quote we have.
        if (params.excludeDex && quotes.length) {
            console.warn('[QuoteService] Excluded DEX left no quotes; falling back to any available quote', {
                excluded: params.excludeDex,
                available: quotes.map(q => q.dex).join(', ')
            });
            return { best: quotes[0], quotes };
        }
        return { best: null as any, quotes };
    }

    // Otherwise sort by highest return from available quotes
    availableQuotes.sort((a, b) => {
        const valA = BigInt(a.amountOutBase || '0');
        const valB = BigInt(b.amountOutBase || '0');
        return valA > valB ? -1 : 1; // Descending
    });

    return { best: availableQuotes[0], quotes };
}
