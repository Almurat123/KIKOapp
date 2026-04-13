import { ethers } from 'ethers';
import { getZeroExQuote } from './zeroEx.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ZeroExAffiliateFee } from './zeroEx.js';
import { getProviderReliability } from './copytrade-v2/learning/quoteReliability.js';
import type { QuoteDex } from './MainSwapService.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Mira Chen
// Reason: Quote selection must not silently revive removed aggregators; 0x is now the only EVM quote provider owner in this layer.
// Goal: Reject any Kyber inputs early and keep quote ranking, caching, and retry behavior 0x-only.
// Owns: EVM quote selection policy, cache key composition, and provider pinning for swap fallbacks.
// Does Not Own: Token metadata hydration, direct swap execution, or non-EVM quote systems.
// Design Language:
// - Hard-reject removed aggregators instead of aliasing them.
// - Keep retry/fallback logic constrained to supported providers only.
// - Forbidden local patch patterns: silent provider remapping, hidden Kyber fallback, or cross-layer alias compatibility.
// Document Provenance:
// - Source: repository runtime audit of Kyber removal plan
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: 0x-only quote routing and unsupported-aggregator rejection
// - Verification: verified in code
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-13-kyber-0x-only-removal.md
// - system-journal/owner-map/backend-swap-validation.md
// - system-journal/conflicts.md

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
    sellQuotePolicy?: 'fast_window' | 'bounded_deadline' | 'first_executable';
    allowedDexes?: QuoteDex[];
    zeroExQuoteTimeoutMs?: number;
    preferredDexes?: QuoteDex[];
}

const quoteBundleCache = new Map<string, { value: { best: QuoteResult; quotes: QuoteResult[] }; ts: number }>();
const inflightQuoteBundle = new Map<string, Promise<{ best: QuoteResult; quotes: QuoteResult[] }>>();
const QUOTE_CACHE_TTL_MS = Math.max(120, Number(process.env.QUOTE_CACHE_TTL_MS || '1200'));
const QUOTE_CACHE_TTL_TURBO_MS = Math.max(80, Number(process.env.QUOTE_CACHE_TTL_TURBO_MS || '600'));
const QUOTE_CACHE_MAX = Math.max(256, Number(process.env.QUOTE_CACHE_MAX || '3000'));
const QUOTE_TURBO_SELL_FAST_WAIT_MS = Math.max(80, Number(process.env.QUOTE_TURBO_SELL_FAST_WAIT_MS || '240'));
const QUOTE_TURBO_SELL_SECONDARY_WAIT_MS = Math.max(80, Number(process.env.QUOTE_TURBO_SELL_SECONDARY_WAIT_MS || '220'));
const QUOTE_TURBO_SELL_FIRST_EXECUTABLE_WAIT_MS = Math.max(200, Number(process.env.QUOTE_TURBO_SELL_FIRST_EXECUTABLE_WAIT_MS || '900'));
const QUOTE_PREFERRED_SELL_PROVIDER_MAX_BPS_DRIFT = Math.max(
    0,
    Number(process.env.QUOTE_PREFERRED_SELL_PROVIDER_MAX_BPS_DRIFT || '125')
);

function ensureZeroOnlyDexSelection(params: {
    allowedDexes?: Array<string | QuoteDex>;
    preferredDexes?: Array<string | QuoteDex>;
    excludeDex?: string;
}): void {
    const hasKyber = (values?: Array<string | QuoteDex>) => (values || []).some((dex) => String(dex || '').toLowerCase() === 'kyber');
    if (hasKyber(params.allowedDexes) || hasKyber(params.preferredDexes) || String(params.excludeDex || '').toLowerCase() === 'kyber') {
        throw new AppError(400, 'Kyber is no longer supported. Use 0x only.', 'UNSUPPORTED_DEX');
    }
}

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
        params.sellQuotePolicy || 'fast_window',
        params.preferPermit2 === false ? 'permit2_off' : 'permit2_on',
        params.excludeDex || 'none',
        params.isSell ? 'sell' : 'buy',
        params.feeContext || 'swap',
        params.allowedDexes?.slice().sort().join(',') || 'all',
        params.zeroExQuoteTimeoutMs || 'default'
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
    ensureZeroOnlyDexSelection,
    resolveTurboSellWaitStrategy,
    selectPreferredSellQuote,
};

function resolveTurboSellWaitStrategy(params: {
    hasQuickQuote: boolean;
    elapsedMs: number;
    totalWaitMs: number;
    sellQuotePolicy?: 'fast_window' | 'bounded_deadline' | 'first_executable';
}): { mode: 'secondary_window' | 'bounded_deadline' | 'deadline_full' | 'first_executable' | 'none'; waitMs: number } {
    const totalWaitMs = Math.max(0, Number(params.totalWaitMs || 0));
    const elapsedMs = Math.max(0, Number(params.elapsedMs || 0));
    const remainingMs = Math.max(0, totalWaitMs - elapsedMs);
    if ((params.sellQuotePolicy || 'fast_window') === 'first_executable') {
        if (params.hasQuickQuote) {
            const waitMs = Math.max(0, Math.min(QUOTE_TURBO_SELL_SECONDARY_WAIT_MS, remainingMs));
            return waitMs > 0
                ? { mode: 'secondary_window', waitMs }
                : { mode: 'none', waitMs: 0 };
        }
        const waitMs = Math.max(0, Math.min(QUOTE_TURBO_SELL_FIRST_EXECUTABLE_WAIT_MS, remainingMs || QUOTE_TURBO_SELL_FIRST_EXECUTABLE_WAIT_MS));
        return waitMs > 0
            ? { mode: 'first_executable', waitMs }
            : { mode: 'none', waitMs: 0 };
    }
    if ((params.sellQuotePolicy || 'fast_window') === 'bounded_deadline') {
        if (params.hasQuickQuote) {
            const waitMs = Math.max(0, Math.min(QUOTE_TURBO_SELL_SECONDARY_WAIT_MS, remainingMs));
            return waitMs > 0
                ? { mode: 'secondary_window', waitMs }
                : { mode: 'none', waitMs: 0 };
        }
        return remainingMs > 0
            ? { mode: 'bounded_deadline', waitMs: remainingMs }
            : { mode: 'none', waitMs: 0 };
    }
    if (!params.hasQuickQuote) {
        return totalWaitMs > 0
            ? { mode: 'deadline_full', waitMs: totalWaitMs }
            : { mode: 'none', waitMs: 0 };
    }
    const waitMs = Math.max(0, Math.min(QUOTE_TURBO_SELL_SECONDARY_WAIT_MS, remainingMs));
    return waitMs > 0
        ? { mode: 'secondary_window', waitMs }
        : { mode: 'none', waitMs: 0 };
}

function selectPreferredSellQuote(params: {
    scoredQuotes: Array<{
        quote: QuoteResult;
        rawOut: bigint;
        adjustedOut: bigint;
        reliabilityScoreBps: number;
        reliabilitySampleCount: number;
    }>;
    preferredDexes?: QuoteDex[];
}) {
    if (!params.scoredQuotes.length) return null;
    const selected = params.scoredQuotes[0];
    const preferredDexes = (params.preferredDexes || []).filter(Boolean);
    if (!preferredDexes.length) return selected;

    for (const dex of preferredDexes) {
        const preferred = params.scoredQuotes.find((entry) => entry.quote.dex === dex);
        if (!preferred) continue;
        const allowedDrift = (selected.rawOut * BigInt(QUOTE_PREFERRED_SELL_PROVIDER_MAX_BPS_DRIFT)) / 10_000n;
        if (preferred.rawOut + allowedDrift >= selected.rawOut) {
            return preferred;
        }
    }
    return selected;
}

async function getBestQuoteInternal(params: BestQuoteParams): Promise<{ best: QuoteResult, quotes: QuoteResult[] }> {
    ensureZeroOnlyDexSelection(params);
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
    const allowedDexSet = params.allowedDexes?.length
        ? new Set(params.allowedDexes)
        : null;

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
        if (allowedDexSet && !allowedDexSet.has('0x')) return null;
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
                params.preferPermit2 !== false,
                params.zeroExQuoteTimeoutMs
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
        const startMs = Date.now();
        const safeZeroEx = zeroExPromise.then((q) => q || null);

        const enabledSources: Array<'0x'> = [];
        if (!allowedDexSet || allowedDexSet.has('0x')) enabledSources.push('0x');
        const toSourceResult = (source: '0x', q: Promise<QuoteResult | null>) =>
            q.then((quote) => quote ? { source, quote } : null).catch(() => null);

        const quickRace: Array<Promise<{ source: '0x'; quote: QuoteResult } | null>> = [
            new Promise<null>((resolve) => setTimeout(() => resolve(null), QUOTE_TURBO_SELL_FAST_WAIT_MS))
        ];
        if (enabledSources.includes('0x')) quickRace.push(toSourceResult('0x', safeZeroEx));
        const quickResult = await Promise.race(quickRace);
        if (quickResult?.quote) {
            if (!quotes.some((q) => q.dex === quickResult.source)) {
                quotes.push(quickResult.quote);
            }
        }

        if (params.isSell) {
            // For sell: copytrade exits should prefer execution completeness over an ultra-short race window.
            const waitStrategy = resolveTurboSellWaitStrategy({
                hasQuickQuote: quotes.length > 0,
                elapsedMs: Date.now() - startMs,
                totalWaitMs: TURBO_TOTAL_WAIT_MS,
                sellQuotePolicy: params.sellQuotePolicy,
            });
            if (waitStrategy.waitMs > 0) {
                const zeroExSell = enabledSources.includes('0x') ? await withTimeout(safeZeroEx, waitStrategy.waitMs) : null;
                if (zeroExSell && !quotes.some((q) => q.dex === '0x')) quotes.push(zeroExSell);
            }
            const gotZeroEx = quotes.some((quote) => quote.dex === '0x');
            console.log('[QuoteService] Turbo sell dual-quote resolved', {
                elapsedMs: Date.now() - startMs,
                chainId: params.chainId,
                got0x: gotZeroEx,
                sellQuotePolicy: params.sellQuotePolicy || 'fast_window',
                waitStrategy: waitStrategy.mode,
            });
        } else {
            // Turbo buy: still parallel, but no first-arrival bias.
            // Wait within a bounded window and compare all returned quotes.
            const zeroExBuy = enabledSources.includes('0x') ? await withTimeout(zeroExPromise, TURBO_TOTAL_WAIT_MS) : null;
            if (zeroExBuy) quotes.push(zeroExBuy);
            console.log('[QuoteService] Turbo buy dual-quote window resolved', {
                elapsedMs: Date.now() - startMs,
                totalWaitMs: TURBO_TOTAL_WAIT_MS,
                chainId: params.chainId,
                copytradeBuy: isCopytradeBuy,
                got0x: Boolean(zeroExBuy)
            });
        }
    } else {
        // Standard mode keeps full quote race semantics.
        const zeroExQuote = (!allowedDexSet || allowedDexSet.has('0x')) ? await fetchZeroEx() : null;
        if (zeroExQuote) quotes.push(zeroExQuote);
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

    const zeroExQuote = availableQuotes.find(q => q.dex === '0x');

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
    const selected = params.isSell
        ? selectPreferredSellQuote({
            scoredQuotes: scored,
            preferredDexes: params.preferredDexes,
        })
        : scored[0];
    if (selected) {
        console.log('[QuoteService] Reliability-adjusted winner', {
            dex: selected.quote.dex,
            rawOut: selected.rawOut.toString(),
            adjustedOut: selected.adjustedOut.toString(),
            reliabilityScoreBps: selected.reliabilityScoreBps,
            reliabilitySampleCount: selected.reliabilitySampleCount
        });
        return { best: selected.quote, quotes };
    }
    return { best: null as any, quotes };
}
