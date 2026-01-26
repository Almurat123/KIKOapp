import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainSlug, CHAINS } from '../config/chainConfig.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { getTokenDetails } from './geckoTerminal.js';
import { getTokenMetadata } from './rpcService.js';

/**
 * Token Service
 * Centralized source of truth for token information (decimals, price, liquidity)
 */

// Cache with LRU eviction to prevent memory leaks
const tokenInfoCache = new LRUCache<string, { data: any, timestamp: number }>({
    max: 500,
    ttl: 10 * 60 * 1000, // 10 minutes max life
});

const CACHE_TTL = 30 * 1000; // 30 seconds standard refresh
const NATIVE_CACHE_TTL = 60 * 60 * 1000; // 1 hour for natives

// Define Native Tokens statically to avoid re-allocation
const EVM_NATIVE_WRAPPED = Object.values(CHAINS).map(c => c.wrappedNativeAddress.toLowerCase());
const NATIVE_TOKENS = new Set([
    SOLANA_CONFIG.TOKENS.SOL.toLowerCase(),
    ...EVM_NATIVE_WRAPPED
]);

export async function getTokenInfo(tokenAddress: string, chainId: number, options: { verbose?: boolean; forceRefresh?: boolean } = { verbose: true, forceRefresh: false }): Promise<any> {
    const { verbose, forceRefresh } = options;
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;

    const isNative = NATIVE_TOKENS.has(tokenAddress.toLowerCase());
    const ttl = isNative ? NATIVE_CACHE_TTL : CACHE_TTL;

    // 1. Check Cache
    if (!forceRefresh) {
        const cached = tokenInfoCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < ttl)) {
            if (!isNative && verbose) {
                logger.debug(LogCode.CACHE_HIT, `Cache hit for token info`, { symbol: cached.data.symbol, token: tokenAddress });
            }
            return cached.data;
        }
    }

    const chainSlug = getChainSlug(chainId);
    const dsSlug = chainSlug.dexScreener;
    const gtSlug = chainSlug.geckoTerminal;

    // --- STEP 0: Request Jitter ---
    // Add a random delay to prevent synchronized burst blocks
    // Reduced jitter if cached data was stale but close
    const jitter = Math.floor(Math.random() * 200) + 100; // 100-300ms
    await new Promise(resolve => setTimeout(resolve, jitter));

    if (verbose) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching token information', { token: tokenAddress, chainId, jitterMs: jitter });
    }

    // --- STEP 1: Try DexScreener (Primary) ---
    const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const MAX_RETRIES = 3;
    let dsError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let timeoutId: NodeJS.Timeout | undefined;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(dsUrl, {
                headers: { 'Connection': 'close', 'Accept': 'application/json' },
                signal: controller.signal
            });

            if (res.status === 429) {
                logger.warn(LogCode.API_RATE_LIMIT, 'DexScreener rate limited', { token: tokenAddress, attempt });
                throw new Error('429');
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Non-JSON response');
            }

            const data = await res.json() as any;
            if (data.pairs && data.pairs.length > 0) {
                // Step 1: Filter by correct chain only
                const chainPairs = data.pairs.filter((p: any) => p.chainId === dsSlug);

                if (chainPairs.length === 0) {
                    logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener: No pairs found on target chain', {
                        token: tokenAddress,
                        chainId,
                        dsSlug,
                        availableChains: data.pairs.map((p: any) => p.chainId).slice(0, 5)
                    });
                    break; // Move to fallback APIs
                }

                // Step 2: Select pair with highest liquidity
                const pair = chainPairs.reduce((best: any, current: any) => {
                    const bestLiq = best.liquidity?.usd || 0;
                    const currentLiq = current.liquidity?.usd || 0;
                    return currentLiq > bestLiq ? current : best;
                });

                const successResult = {
                    price: parseFloat(pair.priceUsd),
                    symbol: pair.baseToken.symbol,
                    name: pair.baseToken.name,
                    decimals: 18, // DexScreener defaults to 18, consider improving later if API adds it
                    liquidity: pair.liquidity?.usd || 0,
                    volume24h: pair.volume?.h24 || 0,
                    fdv: pair.fdv || 0,
                    marketCap: pair.fdv || 0,
                    pairCreatedAt: pair.pairCreatedAt,
                    socials: pair.info?.socials || [],
                    websites: pair.info?.websites || [],
                    provider: 'dexscreener'
                };
                logger.debug(LogCode.API_FETCH_SUCCESS, 'Successfully fetched token info from DexScreener', {
                    symbol: successResult.symbol,
                    price: successResult.price,
                    liquidity: successResult.liquidity
                });

                // Cache Result
                tokenInfoCache.set(cacheKey, { data: successResult, timestamp: Date.now() });
                return successResult;
            }

            // If no pairs found, don't retry dexscreener
            logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener: No liquid pairs found for token', { token: tokenAddress });
            break;

        } catch (e: any) {
            dsError = e;
            if (attempt < MAX_RETRIES && (e.message === '429' || e.name === 'AbortError')) {
                const wait = 1000 * Math.pow(2, attempt - 1);
                logger.debug(LogCode.API_TIMEOUT, 'Retrying DexScreener fetch', { waitMs: wait, attempt });
                await new Promise(resolve => setTimeout(resolve, wait));
                continue;
            }
            break;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    // --- STEP 2: Try GeckoTerminal (Fallback) ---
    logger.debug(LogCode.API_FETCH_SUCCESS, 'DexScreener insufficient, attempting GeckoTerminal fallback', { token: tokenAddress });
    try {
        const gtData = await getTokenDetails(gtSlug, tokenAddress);
        if (gtData) {
            const result = {
                price: gtData.price || 0,
                symbol: gtData.symbol || 'UNKNOWN',
                name: gtData.name || 'Unknown Token',
                decimals: gtData.decimals || 18,
                liquidity: gtData.liquidity || 0,
                volume24h: gtData.volume24h || 0,
                fdv: gtData.fdv || 0,
                marketCap: gtData.marketCap || gtData.fdv || 0,
                pairCreatedAt: gtData.poolCreatedAt ? new Date(gtData.poolCreatedAt).getTime() : Date.now(),
                socials: gtData.socials || [],
                websites: gtData.websites || [],
                provider: 'geckoterminal'
            };
            logger.debug(LogCode.API_FETCH_SUCCESS, 'Successfully fetched token info from GeckoTerminal', { symbol: result.symbol, price: result.price });
            return result;
        }
    } catch (gtErr: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'GeckoTerminal fallback failed', { token: tokenAddress, error: gtErr.message });
    }

    // --- STEP 3: Try ZORA API (For Base chain launchpad tokens) ---
    if (chainId === 8453) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Attempting Zora API fallback for Base token', { token: tokenAddress });
        try {
            const zoraUrl = `https://api-sdk.zora.engineering/coin?address=${tokenAddress}&chain=8453`;
            const zoraRes = await fetch(zoraUrl, {
                headers: { 'Accept': 'application/json' }
            });

            if (zoraRes.ok) {
                const zoraData = await zoraRes.json() as any;
                if (zoraData && zoraData.tokenPrice) {
                    const result = {
                        price: parseFloat(zoraData.tokenPrice.priceInUsdc),
                        symbol: zoraData.symbol,
                        name: zoraData.name,
                        decimals: 18,
                        liquidity: parseFloat(zoraData.marketCap) * 0.1, // Proxy
                        volume24h: parseFloat(zoraData.volume24h),
                        fdv: parseFloat(zoraData.marketCap),
                        marketCap: parseFloat(zoraData.marketCap),
                        provider: 'zora'
                    };
                    logger.debug(LogCode.API_FETCH_SUCCESS, 'Successfully fetched token info from Zora', { symbol: result.symbol, price: result.price });
                    return result;
                }
            }
        } catch (e: any) {
            logger.debug(LogCode.API_FETCH_FAILED, 'Zora API fallback failed', { token: tokenAddress, error: e.message });
        }
    }

    // --- STEP 4: Force RPC Fallback (The "Must Proceed" Layer) ---
    // If all APIs fail (rate limits/downtime), we MUST fetch on-chain metadata
    // so that trading execution (which depends on decimals) doesn't fail.
    try {
        logger.warn(LogCode.API_FETCH_FAILED, 'All APIs failed, attempting on-chain RPC fallback', { token: tokenAddress });

        // This uses viem/ethers to call calling decimals() symbol() name()
        const rpcData = await getTokenMetadata(chainId, tokenAddress);

        const result = {
            price: 0, // Price unknown, but trading can proceed
            symbol: rpcData.symbol,
            name: rpcData.name,
            decimals: rpcData.decimals,
            liquidity: 0,
            volume24h: 0,
            fdv: 0,
            marketCap: 0,
            provider: 'rpc'
        };

        logger.info(LogCode.API_FETCH_SUCCESS, 'Recovered token metadata via RPC', { symbol: result.symbol, decimals: result.decimals });

        // Cache this fallback data but with short TTL so we retry APIs soon
        tokenInfoCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;

    } catch (rpcErr: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Critical: RPC fallback also failed', { token: tokenAddress, error: rpcErr.message });
    }

    logger.error(LogCode.API_FETCH_FAILED, 'All token info data sources failed', { token: tokenAddress, lastError: dsError?.message });
    return null;
}
