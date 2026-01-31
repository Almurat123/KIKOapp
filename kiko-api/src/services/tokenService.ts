import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainSlug, CHAINS } from '../config/chainConfig.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { getTokenDetails } from './geckoTerminal.js';
import { getTokenMetadata } from './rpcService.js';
import { fetchJson, ApiPriority } from '../config/unifiedApiService.js';
import { cacheHub } from '../cache/DataCacheHub.js'; // 🔗 连接缓存中心

/**
 * Token Service
 * Centralized source of truth for token information (decimals, price, liquidity)
 * 🔗 连接到 DataCacheHub 统一缓存链
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

export async function getTokenInfo(
    tokenAddress: string,
    chainId: number,
    options: { verbose?: boolean; forceRefresh?: boolean; priority?: ApiPriority } = { verbose: true, forceRefresh: false, priority: 'normal' }
): Promise<any> {
    const { verbose = true, forceRefresh = false, priority = 'normal' } = options;

    // 如果强制刷新，直接从 API 获取
    if (forceRefresh) {
        return fetchTokenInfoFromAPIs(tokenAddress, chainId, verbose, priority);
    }

    // 🔗 通过缓存中心获取（统一缓存链）
    return cacheHub.getTokenInfo(tokenAddress, chainId, async () => {
        // 缓存未命中时的获取逻辑
        return fetchTokenInfoFromAPIs(tokenAddress, chainId, verbose, priority);
    });
}

/**
 * 从 API 获取 Token 信息（内部函数）
 * @param priority - 'high' for Copy Trade (skips rate limits)
 */
async function fetchTokenInfoFromAPIs(tokenAddress: string, chainId: number, verbose: boolean, priority: ApiPriority = 'normal'): Promise<any> {
    const chainSlug = getChainSlug(chainId);
    const dsSlug = chainSlug.dexScreener;
    const gtSlug = chainSlug.geckoTerminal;

    // --- STEP 0: Request Jitter ---
    // Add a random delay to prevent synchronized burst blocks
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
        try {
            const data = await fetchJson({
                url: dsUrl,
                headers: { 'Connection': 'close', 'Accept': 'application/json' },
                timeout: 8000,
                retry: { retries: 0 } // Handle retries manually
            }) as any;

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
                return successResult;
            }

            // If no pairs found, don't retry dexscreener
            logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener: No liquid pairs found for token', { token: tokenAddress });
            break;

        } catch (e: any) {
            dsError = e;
            if (attempt < MAX_RETRIES && (e.message?.includes('429') || e.name === 'AbortError')) {
                const wait = 1000 * Math.pow(2, attempt - 1);
                logger.debug(LogCode.API_TIMEOUT, 'Retrying DexScreener fetch', { waitMs: wait, attempt });
                await new Promise(resolve => setTimeout(resolve, wait));
                continue;
            }
            break;
        }
    }

    // --- STEP 2: Try GeckoTerminal (Fallback) ---
    logger.debug(LogCode.API_FETCH_SUCCESS, 'DexScreener insufficient, attempting GeckoTerminal fallback', { token: tokenAddress });
    try {
        const gtData = await getTokenDetails(gtSlug, tokenAddress, priority);
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
            const zoraData = await fetchJson({
                url: zoraUrl,
                headers: { 'Accept': 'application/json' }
            }) as any;

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
        } catch (e: any) {
            logger.debug(LogCode.API_FETCH_FAILED, 'Zora API fallback failed', { token: tokenAddress, error: e.message });
        }
    }

    // --- STEP 4: Try On-Chain RPC (Price + Liquidity Fallback) ---
    // If all APIs fail, try to fetch price and liquidity directly from chain
    try {
        logger.warn(LogCode.API_FETCH_FAILED, 'All APIs failed, attempting on-chain price fetch via RPC', { token: tokenAddress });

        const { getOnChainPrice } = await import('./onChainPriceService.js');
        const onChainData = await getOnChainPrice(tokenAddress, chainId);

        if (onChainData && onChainData.price > 0) {
            // Also fetch metadata for symbol/name/decimals
            const rpcMetadata = await getTokenMetadata(chainId, tokenAddress);

            const result = {
                price: onChainData.price,
                symbol: rpcMetadata.symbol,
                name: rpcMetadata.name,
                decimals: rpcMetadata.decimals,
                liquidity: 0, // Liquidity not available via RPC, must use API
                volume24h: 0, // Not available on-chain
                fdv: onChainData.marketCap,
                marketCap: onChainData.marketCap,
                pairCreatedAt: Date.now(),
                socials: [],
                websites: [],
                provider: `rpc-${onChainData.dexName}`
            };

            logger.info(LogCode.API_FETCH_SUCCESS, 'Successfully fetched price via on-chain RPC', {
                symbol: result.symbol,
                price: result.price,
                marketCap: result.marketCap,
                dex: onChainData.dexName,
                note: 'Liquidity unavailable - use API for liquidity data'
            });

            // Cache this data with short TTL (30s) since it's RPC-based
            return result;
        }
    } catch (onChainErr: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'On-chain price fetch failed', { token: tokenAddress, error: onChainErr.message });
    }

    // --- STEP 5: Last Resort - Metadata Only ---
    // If even on-chain price fetch fails, return metadata only (for execution to proceed with price=0)
    try {
        logger.warn(LogCode.API_FETCH_FAILED, 'Price unavailable, fetching metadata only', { token: tokenAddress });

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
        return result;

    } catch (rpcErr: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Critical: RPC fallback also failed', { token: tokenAddress, error: rpcErr.message });
    }

    logger.error(LogCode.API_FETCH_FAILED, 'All token info data sources failed', { token: tokenAddress, lastError: dsError?.message });
    return null;
}
