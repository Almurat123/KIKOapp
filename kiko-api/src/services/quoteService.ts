import { ethers } from 'ethers';
import { getZeroExQuote } from './zeroEx.js';
import { getKyberQuote } from './kyberAggregator.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ZeroExAffiliateFee } from './zeroEx.js';
import { getProviderReliability } from './copytrade-v2/learning/quoteReliability.js';

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
    approvalKind?: 'permit2_24h' | 'exact_approve_fallback';
    requiresTypedSignature?: boolean;
    permit2Payload?: {
        domain: Record<string, any>;
        types: Record<string, any>;
        primaryType: string;
        message: Record<string, any>;
    } | null;
    permit2Spender?: string | null;
    permit2Expiry?: number | null;
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
    executionMode?: 'safe' | 'normal' | 'turbo';
    preferPermit2?: boolean;
    skipCache?: boolean;
}

const quoteBundleCache = new Map<string, { value: { best: QuoteResult; quotes: QuoteResult[] }; ts: number }>();
const inflightQuoteBundle = new Map<string, Promise<{ best: QuoteResult; quotes: QuoteResult[] }>>();
const QUOTE_CACHE_TTL_MS = Math.max(120, Number(process.env.QUOTE_CACHE_TTL_MS || '1200'));
const QUOTE_CACHE_TTL_TURBO_MS = Math.max(80, Number(process.env.QUOTE_CACHE_TTL_TURBO_MS || '600'));
const QUOTE_CACHE_MAX = Math.max(256, Number(process.env.QUOTE_CACHE_MAX || '3000'));
const QUOTE_TURBO_SELL_FAST_WAIT_MS = Math.max(80, Number(process.env.QUOTE_TURBO_SELL_FAST_WAIT_MS || '240'));
const QUOTE_TURBO_SELL_SECONDARY_WAIT_MS = Math.max(80, Number(process.env.QUOTE_TURBO_SELL_SECONDARY_WAIT_MS || '220'));

function buildQuoteCacheKey(params: BestQuoteParams): string {
    const amountInBase = String(params.amountInBase || '0').toLowerCase();
    return [
        params.chainId,
        String(params.actualTokenIn || '').toLowerCase(),
        String(params.actualTokenOut || '').toLowerCase(),
        amountInBase,
        params.slippageBps,
        String(params.userAddress || '').toLowerCase() || 'quote_only',
        params.executionMode || 'normal',
        params.preferPermit2 === false ? 'permit2_off' : 'permit2_on',
        params.excludeDex || 'none',
        params.isSell ? 'sell' : 'buy',
        params.feeContext || 'swap'
    ].join(':');
}

function getQuoteCacheTtlMs(params: BestQuoteParams): number {
    return params.executionMode === 'turbo' ? QUOTE_CACHE_TTL_TURBO_MS : QUOTE_CACHE_TTL_MS;
}

function getCachedQuoteBundle(key: string, ttlMs: number): { best: QuoteResult; quotes: QuoteResult[] } | null {
    const hit = quoteBundleCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > ttlMs) {
        quoteBundleCache.delete(key);
        return null;
    }
    return hit.value;
}

function setCachedQuoteBundle(key: string, value: { best: QuoteResult; quotes: QuoteResult[] }): void {
    if (quoteBundleCache.size >= QUOTE_CACHE_MAX) {
        const now = Date.now();
        for (const [cacheKey, hit] of quoteBundleCache.entries()) {
            if (now - hit.ts > QUOTE_CACHE_TTL_MS) quoteBundleCache.delete(cacheKey);
        }
        if (quoteBundleCache.size >= QUOTE_CACHE_MAX) {
            const keysToDelete = Array.from(quoteBundleCache.keys()).slice(0, Math.floor(QUOTE_CACHE_MAX * 0.2));
            for (const cacheKey of keysToDelete) quoteBundleCache.delete(cacheKey);
        }
    }
    quoteBundleCache.set(key, { value, ts: Date.now() });
}

/**
 * Fetch quotes from multiple aggregators and return the best one
 */
export async function getBestQuote(params: BestQuoteParams): Promise<{ best: QuoteResult, quotes: QuoteResult[] }> {
    const key = buildQuoteCacheKey(params);
    const ttlMs = getQuoteCacheTtlMs(params);
    if (!params.skipCache) {
        const cached = getCachedQuoteBundle(key, ttlMs);
        if (cached) return cached;

        const inflight = inflightQuoteBundle.get(key);
        if (inflight) return await inflight;
    }

    const task = getBestQuoteInternal(params)
        .then((result) => {
            if (result?.best && result?.quotes?.length) {
                setCachedQuoteBundle(key, result);
            }
            return result;
        })
        .finally(() => {
            const current = inflightQuoteBundle.get(key);
            if (current === task) inflightQuoteBundle.delete(key);
        });

    if (!params.skipCache) {
        inflightQuoteBundle.set(key, task);
    }
    return await task;
}

export const __testOnly = {
    buildQuoteCacheKey,
};

async function getBestQuoteInternal(params: BestQuoteParams): Promise<{ best: QuoteResult, quotes: QuoteResult[] }> {
    const {
        tokenIn, tokenOut, actualTokenIn, actualTokenOut,
        amountInBase, amountInHuman,
        tokenInDecimals, tokenOutDecimals,
        chainId, slippageBps, userAddress, refPrice, affiliateFee
    } = params;

    const quotes: QuoteResult[] = [];
    const turboMode = params.executionMode === 'turbo';
    const feeContext = String(params.feeContext || '').toLowerCase();
    const isCopytradeFeeContext = feeContext === 'copytrade' || feeContext === 'copy_trade';
    const isCopytradeBuy = isCopytradeFeeContext && !params.isSell;
    const TURBO_TOTAL_WAIT_MS = Math.max(100, Number(process.env.QUOTE_TURBO_TOTAL_WAIT_MS || 1600));

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
                isQuoteOnly, // Price quote only if no user address
                params.preferPermit2 !== false
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
                    approvalKind: q.approvalKind || 'exact_approve_fallback',
                    requiresTypedSignature: q.requiresTypedSignature || false,
                    permit2Payload: q.permit2Payload || null,
                    permit2Spender: q.permit2Spender || null,
                    permit2Expiry: q.permit2Expiry || (q.approvalKind === 'permit2_24h' ? Math.floor(Date.now() / 1000) + 24 * 60 * 60 : null),
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
        const safeZeroEx = zeroExPromise.then((q) => q || null);
        const safeKyber = kyberPromise.then((q) => q || null);

        const toSourceResult = (source: '0x' | 'kyber', q: Promise<QuoteResult | null>) =>
            q.then((quote) => quote ? { source, quote } : null).catch(() => null);

        const quickResult = await Promise.race([
            toSourceResult('0x', safeZeroEx),
            toSourceResult('kyber', safeKyber),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), QUOTE_TURBO_SELL_FAST_WAIT_MS))
        ]);
        if (quickResult?.quote) {
            if (!quotes.some((q) => q.dex === quickResult.source)) {
                quotes.push(quickResult.quote);
            }
        }

        if (params.isSell) {
            // For sell: return fast on the first arrived quote to avoid long hold,
            // then wait briefly for the alternate provider as a hedge.
            const elapsedMs = Date.now() - startMs;
            const secondaryWaitMs = Math.max(
                0,
                Math.min(
                    QUOTE_TURBO_SELL_SECONDARY_WAIT_MS,
                    Math.max(0, TURBO_TOTAL_WAIT_MS - elapsedMs)
                )
            );
            if (secondaryWaitMs > 0) {
                const [zeroExSell, kyberSell] = await Promise.all([
                    withTimeout(safeZeroEx, secondaryWaitMs),
                    withTimeout(safeKyber, secondaryWaitMs),
                ]);
                if (zeroExSell && !quotes.some((q) => q.dex === '0x')) quotes.push(zeroExSell);
                if (kyberSell && !quotes.some((q) => q.dex === 'kyber')) quotes.push(kyberSell);
            } else if (quickResult == null) {
                const [zeroExSell, kyberSell] = await Promise.all([
                    withTimeout(safeZeroEx, TURBO_TOTAL_WAIT_MS),
                    withTimeout(safeKyber, TURBO_TOTAL_WAIT_MS),
                ]);
                if (zeroExSell) quotes.push(zeroExSell);
                if (kyberSell) quotes.push(kyberSell);
            }
            const gotZeroEx = quotes.some((quote) => quote.dex === '0x');
            const gotKyber = quotes.some((quote) => quote.dex === 'kyber');
            console.log('[QuoteService] Turbo sell dual-quote resolved', {
                elapsedMs: Date.now() - startMs,
                chainId: params.chainId,
                got0x: gotZeroEx,
                gotKyber: gotKyber,
            });
        } else {
            // Turbo buy: still parallel, but no first-arrival bias.
            // Wait within a bounded window and compare all returned quotes.
            const [zeroExBuy, kyberBuy] = await Promise.all([
                withTimeout(zeroExPromise, TURBO_TOTAL_WAIT_MS),
                withTimeout(kyberPromise, TURBO_TOTAL_WAIT_MS)
            ]);
            if (zeroExBuy) quotes.push(zeroExBuy);
            if (kyberBuy) quotes.push(kyberBuy);
            console.log('[QuoteService] Turbo buy dual-quote window resolved', {
                elapsedMs: Date.now() - startMs,
                totalWaitMs: TURBO_TOTAL_WAIT_MS,
                chainId: params.chainId,
                copytradeBuy: isCopytradeBuy,
                got0x: Boolean(zeroExBuy),
                gotKyber: Boolean(kyberBuy)
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

        // Selection is handled later by reliability-adjusted scoring.
        console.log('[QuoteService] Deferring winner selection to reliability scorer', {
            percentDiff: percentDiff.toFixed(2)
        });
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
    const scored = await Promise.all(availableQuotes.map(async (q) => {
        const reliability = await getProviderReliability({
            chainId: params.chainId,
            tokenIn: actualTokenIn,
            tokenOut: actualTokenOut,
            provider: q.dex
        }).catch(() => ({ scoreBps: 10000, sampleCount: 0, updatedAt: Date.now() }));
        const rawOut = BigInt(q.amountOutBase || '0');
        const adjustedOut = rawOut * BigInt(Math.max(1000, Math.min(20000, Number(reliability.scoreBps || 10000)))) / 10000n;
        return {
            quote: q,
            rawOut,
            adjustedOut,
            reliabilityScoreBps: reliability.scoreBps,
            reliabilitySampleCount: reliability.sampleCount
        };
    }));
    scored.sort((a, b) => {
        if (a.adjustedOut === b.adjustedOut) {
            return a.rawOut > b.rawOut ? -1 : 1;
        }
        return a.adjustedOut > b.adjustedOut ? -1 : 1;
    });
    const selected = scored[0];
    if (selected) {
        console.log('[QuoteService] Reliability-adjusted winner', {
            dex: selected.quote.dex,
            rawOut: selected.rawOut.toString(),
            adjustedOut: selected.adjustedOut.toString(),
            reliabilityScoreBps: selected.reliabilityScoreBps,
            reliabilitySampleCount: selected.reliabilitySampleCount
        });
    }
    return { best: selected.quote, quotes };
}
