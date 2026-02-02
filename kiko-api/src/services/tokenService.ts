import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainSlug, CHAINS } from '../config/chainConfig.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { getTokenDetails } from './geckoTerminal.js';
import { getTokenMetadata } from './rpcService.js';
import { fetchJson, ApiPriority } from '../config/unifiedApiService.js';
import { cacheHub } from '../cache/DataCacheHub.js'; // 🔗 连接缓存中心
import { getDexPrice } from './dexPriceService.js'; // 🔗 DEX 价格 fallback

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
 * 仅从 API 获取 Liquidity 和 Volume 数据（RPC 无法获取）
 * 用于混合策略：RPC 获取 price，API 补充 liquidity
 */
async function getLiquidityData(
    tokenAddress: string,
    chainId: number,
    priority: ApiPriority = 'normal'
): Promise<{ liquidity: number; volume24h: number; fdv?: number } | null> {
    const chainSlug = getChainSlug(chainId);
    const dsSlug = chainSlug.dexScreener;
    const gtSlug = chainSlug.geckoTerminal;

    // --- STEP 1: Try DexScreener (Primary) ---
    try {
        const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
        const data = await fetchJson({
            url: dsUrl,
            headers: { 'Connection': 'close', 'Accept': 'application/json' },
            timeout: 5000
        }) as any;

        if (data.pairs && data.pairs.length > 0) {
            const chainPairs = data.pairs.filter((p: any) => p.chainId === dsSlug);
            if (chainPairs.length > 0) {
                // Select pair with highest liquidity
                const pair = chainPairs.reduce((best: any, current: any) => {
                    const bestLiq = best.liquidity?.usd || 0;
                    const currentLiq = current.liquidity?.usd || 0;
                    return currentLiq > bestLiq ? current : best;
                });

                return {
                    liquidity: pair.liquidity?.usd || 0,
                    volume24h: pair.volume?.h24 || 0,
                    fdv: pair.fdv || 0
                };
            }
        }
    } catch (dsErr: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener liquidity fetch failed', {
            token: tokenAddress,
            error: dsErr.message
        });
    }

    // --- STEP 2: Try GeckoTerminal (Fallback) ---
    try {
        const gtData = await getTokenDetails(gtSlug, tokenAddress, priority);
        if (gtData) {
            return {
                liquidity: gtData.liquidity || 0,
                volume24h: gtData.volume24h || 0,
                fdv: gtData.fdv || gtData.marketCap || 0
            };
        }
    } catch (gtErr: any) {
        logger.debug(LogCode.API_FETCH_FAILED, 'GeckoTerminal liquidity fetch failed', {
            token: tokenAddress,
            error: gtErr.message
        });
    }

    logger.warn(LogCode.API_FETCH_FAILED, 'All API liquidity sources failed', { token: tokenAddress });
    return null; // 无 liquidity 数据
}

/**
 * 从 API 获取 Token 信息（内部函数）
 * 🚀 HYBRID STRATEGY: RPC (price) + API (liquidity) 并行获取
 * @param priority - 'high' for Copy Trade (skips rate limits)
 */
async function fetchTokenInfoFromAPIs(tokenAddress: string, chainId: number, verbose: boolean, priority: ApiPriority = 'normal'): Promise<any> {
    const chainSlug = getChainSlug(chainId);
    const gtSlug = chainSlug.geckoTerminal;

    // 🚀 HYBRID STRATEGY: RPC/Jupiter (price) + API (liquidity)
    // ⚠️ Solana (chainId 900): Uses Jupiter API instead of RPC
    const isSolana = chainId === 900;

    if (verbose) {
        logger.debug(LogCode.API_FETCH_SUCCESS, isSolana ? '📡 Jupiter API Strategy (Solana)' : '🚀 Hybrid Strategy (EVM): RPC + API', {
            token: tokenAddress,
            chainId
        });
    }

    // 🚀 PARALLEL EXECUTION: RPC/Jupiter (price) + API (liquidity) + Metadata
    const [rpcData, liquidityData, metadata] = await Promise.allSettled([
        // 1. Price: RPC (EVM) or Jupiter API (Solana)
        isSolana ? (async () => {
            const { getSolanaTokenInfo } = await import('./solanaOnChainPriceService.js');
            return getSolanaTokenInfo(tokenAddress);
        })() : (async () => {
            const { getOnChainPrice } = await import('./onChainPriceService.js');
            return getOnChainPrice(tokenAddress, chainId);
        })(),

        // 2. API: Get liquidity data (~200ms, may hit rate limit)
        getLiquidityData(tokenAddress, chainId, priority),

        // 3. RPC/API: Get token metadata (~50ms, Solana uses API fallback)
        isSolana ? Promise.resolve({ symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 9 }) : getTokenMetadata(chainId, tokenAddress)
    ]);

    // Extract results
    const rpc = rpcData.status === 'fulfilled' ? rpcData.value : null;
    const liq = liquidityData.status === 'fulfilled' ? liquidityData.value : null;
    const meta = metadata.status === 'fulfilled' ? metadata.value : null;

    // 🛡️ MERGE STRATEGY: Use best data from each source
    let price = rpc?.price || 0;
    let marketCap = rpc?.marketCap || liq?.fdv || 0;
    let liquidity = liq?.liquidity || 0;
    let volume24h = liq?.volume24h || 0;
    let symbol = meta?.symbol || 'UNKNOWN';
    let name = meta?.name || 'Unknown Token';
    let decimals = meta?.decimals || 18;
    let provider = 'rpc+api';

    // 🛡️ FALLBACK: If RPC price failed, try full API fetch as last resort
    if (price <= 0 || isNaN(price)) {
        logger.warn(LogCode.API_FETCH_FAILED, 'RPC price failed, falling back to full API fetch', {
            token: tokenAddress,
            rpcPrice: rpc?.price
        });

        try {
            // Try GeckoTerminal for complete data
            const gtData = await getTokenDetails(gtSlug, tokenAddress, priority);
            if (gtData && gtData.price && gtData.price > 0) {
                price = gtData.price;
                symbol = gtData.symbol || symbol;
                name = gtData.name || name;
                decimals = gtData.decimals || decimals;
                liquidity = liquidity || gtData.liquidity || 0;  // Keep API liquidity if we have it
                volume24h = volume24h || gtData.volume24h || 0;
                marketCap = (gtData.marketCap || gtData.fdv || marketCap) as number;
                provider = 'geckoterminal';

                logger.info(LogCode.API_FETCH_SUCCESS, 'Fallback: Got price from GeckoTerminal', {
                    symbol,
                    price
                });
            }
        } catch (gtErr: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'GeckoTerminal fallback failed', {
                token: tokenAddress,
                error: gtErr.message
            });
        }

        // 🔗 FINAL FALLBACK: Try DEX price (0x for EVM, Jupiter for Solana)
        if (price <= 0 || isNaN(price)) {
            try {
                const dexChainId = isSolana ? 'solana' : chainId;
                const dexPrice = await getDexPrice(tokenAddress, dexChainId);
                if (dexPrice > 0) {
                    price = dexPrice;
                    provider = isSolana ? 'jupiter-dex' : '0x-dex';
                    logger.info(LogCode.API_FETCH_SUCCESS, 'Fallback: Got price from DEX aggregator', {
                        token: tokenAddress.slice(0, 10),
                        price,
                        provider
                    });
                }
            } catch (dexErr: any) {
                logger.error(LogCode.API_FETCH_FAILED, 'DEX price fallback also failed', {
                    token: tokenAddress,
                    error: dexErr.message
                });
            }
        }
    }

    // Final validation
    if (price <= 0 || isNaN(price)) {
        logger.error(LogCode.API_FETCH_FAILED, 'Critical: No valid price data available', {
            token: tokenAddress,
            rpcResult: rpc,
            liquidityResult: liq
        });
        return null;
    }

    const result = {
        price,
        symbol,
        name,
        decimals,
        liquidity,
        volume24h,
        fdv: marketCap,
        marketCap,
        pairCreatedAt: Date.now(),
        socials: [],
        websites: [],
        provider
    };

    logger.info(LogCode.API_FETCH_SUCCESS, '✅ Hybrid fetch complete', {
        symbol: result.symbol,
        price: result.price,
        liquidity: result.liquidity,
        provider: result.provider
    });

    return result;
}

