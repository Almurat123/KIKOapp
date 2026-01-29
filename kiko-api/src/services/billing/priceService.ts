import { env } from '../../config/env.js';
import { fetchJson } from '../../config/unifiedApiService.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

type DexPair = {
    chainId?: string;
    priceUsd?: string;
    liquidity?: { usd?: string | number };
    pairAddress?: string;
};

type PriceQuote = {
    priceUsd: number;
    liquidityUsd: number;
    pairAddress?: string;
    fetchedAt: number;
    source: 'dexscreener';
};

let cachedQuote: PriceQuote | null = null;

function isFresh(quote: PriceQuote | null): boolean {
    if (!quote) return false;
    const ttlMs = env.billing.priceCacheTtlSec * 1000;
    return Date.now() - quote.fetchedAt <= ttlMs;
}

export async function getBillingTokenPriceUsd(): Promise<PriceQuote> {
    if (isFresh(cachedQuote)) {
        return cachedQuote as PriceQuote;
    }

    if (!env.billing.tokenAddress) {
        throw new Error('Billing token address is not configured.');
    }

    const chainSlug = 'base';
    const url = `https://api.dexscreener.com/tokens/v1/${chainSlug}/${env.billing.tokenAddress}`;

    const pairs = await fetchJson<DexPair[]>({ url, timeout: 15000 });
    if (!pairs || pairs.length === 0) {
        throw new Error('DexScreener returned no pairs for billing token.');
    }

    const eligiblePairs = pairs
        .filter(pair => (pair.chainId || '').toLowerCase() === chainSlug)
        .map(pair => ({
            priceUsd: parseFloat(pair.priceUsd || '0'),
            liquidityUsd: typeof pair.liquidity?.usd === 'string'
                ? parseFloat(pair.liquidity.usd)
                : Number(pair.liquidity?.usd || 0),
            pairAddress: pair.pairAddress
        }))
        .filter(pair => Number.isFinite(pair.priceUsd) && Number.isFinite(pair.liquidityUsd));

    if (eligiblePairs.length === 0) {
        throw new Error('DexScreener returned no eligible Base pairs for billing token.');
    }

    const bestPair = eligiblePairs.sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0];
    if (bestPair.liquidityUsd < env.billing.minLiquidityUsd || bestPair.priceUsd <= 0) {
        logger.warn(LogCode.API_FETCH_FAILED, 'DexScreener price rejected (low liquidity or zero price)', {
            liquidityUsd: bestPair.liquidityUsd,
            priceUsd: bestPair.priceUsd
        });
        throw new Error('DexScreener price rejected due to low liquidity or zero price.');
    }

    cachedQuote = {
        priceUsd: bestPair.priceUsd,
        liquidityUsd: bestPair.liquidityUsd,
        pairAddress: bestPair.pairAddress,
        fetchedAt: Date.now(),
        source: 'dexscreener'
    };

    return cachedQuote;
}
