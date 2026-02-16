import type { TokenSearchResult } from './api';

// Constants for weighting
const WEIGHTS = {
    VOLUME_24H: 0.30,
    ACTIVITY_RECENT: 0.25,
    PRICE_CHANGE: 0.20,
    UNIQUE_TRADERS: 0.15,
    LIQUIDITY: 0.10,
};

// Thresholds for normalization (based on typical "hot" token values)
const REFERENCE_VALUES = {
    VOLUME_HIGH: 1_000_000,    // $1M volume is considered high
    TXNS_HIGH: 1_000,          // 1000 txns is high
    PRICE_CHANGE_HIGH: 50,     // 50% change is high
    MAKERS_HIGH: 500,          // 500 unique makers is high
    LIQUIDITY_HIGH: 500_000,   // $500k liquidity is high
};

export interface TrendingMetrics {
    volume24h: number;
    txns24h: number;
    priceChange24h: number;
    makers?: number;
    liquidity: number;
    // Ormi Enhanced Metrics
    uniqueHolders?: number;
    realVolume?: number;
}

/**
 * Calculate trending score (0-100) based on DexScreener-like algorithm
 */
export function calculateTrendingScore(metrics: TrendingMetrics): number {
    const {
        volume24h,
        txns24h,
        priceChange24h,
        makers = 0,
        liquidity,
        uniqueHolders
    } = metrics;

    // Use uniqueHolders from Ormi if available, otherwise fallback to makers estimate
    const effectiveUniqueTraders = uniqueHolders || makers;

    // Normalize each factor to 0-1 range (clamped)
    const normVolume = Math.min(volume24h / REFERENCE_VALUES.VOLUME_HIGH, 1);
    const normTxns = Math.min(txns24h / REFERENCE_VALUES.TXNS_HIGH, 1);
    const normPriceChange = Math.min(Math.abs(priceChange24h) / REFERENCE_VALUES.PRICE_CHANGE_HIGH, 1);
    const normMakers = Math.min(effectiveUniqueTraders / REFERENCE_VALUES.MAKERS_HIGH, 1);
    const normLiquidity = Math.min(liquidity / REFERENCE_VALUES.LIQUIDITY_HIGH, 1);

    // Calculate weighted score
    const score =
        (normVolume * WEIGHTS.VOLUME_24H) +
        (normTxns * WEIGHTS.ACTIVITY_RECENT) +
        (normPriceChange * WEIGHTS.PRICE_CHANGE) +
        (normMakers * WEIGHTS.UNIQUE_TRADERS) +
        (normLiquidity * WEIGHTS.LIQUIDITY);

    return Math.round(score * 100);
}

// Local Storage Keys
const CACHE_KEY_PREFIX = 'kiko_trending_tokens_v2_';
const CACHE_TTL_MS = 1 * 60 * 1000; // 1 minute (reduced for fresher data)
const ENABLE_LOCAL_TRENDING_CACHE = false;

export interface CachedData {
    tokens: TokenSearchResult[];
    timestamp: number;
}

export type TrendingTimeframe = '5m' | '1h' | '24h';

function cacheKey(chain: string, timeframe?: TrendingTimeframe): string {
    // Backward-compatible: if timeframe is omitted, behave like old key.
    return timeframe ? `${CACHE_KEY_PREFIX}${chain}:${timeframe}` : `${CACHE_KEY_PREFIX}${chain}`;
}

/**
 * Save tokens to local storage with timestamp
 */
export function saveToCache(chain: string, tokens: TokenSearchResult[], timeframe?: TrendingTimeframe) {
    if (!ENABLE_LOCAL_TRENDING_CACHE) return;
    const key = cacheKey(chain, timeframe);
    const data: CachedData = {
        tokens,
        timestamp: Date.now(),
    };
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.warn('[TrendingService] Failed to save to localStorage:', error);
    }
}

/**
 * Load tokens from local storage if valid
 */
export function loadFromCache(chain: string, timeframe?: TrendingTimeframe): TokenSearchResult[] | null {
    if (!ENABLE_LOCAL_TRENDING_CACHE) return null;
    const key = cacheKey(chain, timeframe);
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const data: CachedData = JSON.parse(item);
        const age = Date.now() - data.timestamp;

        if (age < CACHE_TTL_MS) {
            // console.log(`[TrendingService] Loaded ${chain} tokens from cache (${age}ms old)`);
            return data.tokens;
        }
        return null; // Expired
    } catch (error) {
        console.warn('[TrendingService] Failed to load from localStorage:', error);
        return null;
    }
}

export function clearTrendingLocalCache() {
    try {
        const keysToDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const k = localStorage.key(i);
            if (k && k.startsWith(CACHE_KEY_PREFIX)) keysToDelete.push(k);
        }
        keysToDelete.forEach((k) => localStorage.removeItem(k));
    } catch {
        // ignore storage errors
    }
}

/**
 * Sort tokens by trending score
 */
export function sortTokensByTrending(tokens: TokenSearchResult[]): TokenSearchResult[] {
    return [...tokens].sort((a, b) => {
        const scoreA = calculateTrendingScore({
            volume24h: a.volume24h || 0,
            txns24h: a.txns24h || 0,
            priceChange24h: a.priceChange24h || 0,
            liquidity: Number(a.liquidity) || 0,
            // makers not always available in api result yet, assume 0 or proportional to txns
            makers: (a.txns24h || 0) / 2
        });

        const scoreB = calculateTrendingScore({
            volume24h: b.volume24h || 0,
            txns24h: b.txns24h || 0,
            priceChange24h: b.priceChange24h || 0,
            liquidity: Number(b.liquidity) || 0,
            makers: (b.txns24h || 0) / 2
        });

        return scoreB - scoreA;
    });
}
