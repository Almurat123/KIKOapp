import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainSlug, CHAINS } from '../config/chainConfig.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
// GeckoTerminal disabled for copytrade latency/limits; use DexScreener + RPC only.
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
    options: {
        verbose?: boolean;
        forceRefresh?: boolean;
        priority?: ApiPriority;
        rpcStrategy?: 'fast' | 'cheap';
        fastMode?: boolean;
    } = { verbose: true, forceRefresh: false, priority: 'normal' }
): Promise<any> {
    const { verbose = true, forceRefresh = false, priority = 'normal', rpcStrategy = 'cheap', fastMode = false } = options;

    // 如果强制刷新，直接从 API 获取
    if (forceRefresh) {
        return fetchTokenInfoFromAPIs(tokenAddress, chainId, verbose, priority, rpcStrategy, fastMode);
    }

    // 🔗 通过缓存中心获取（统一缓存链）
    return cacheHub.getTokenInfo(tokenAddress, chainId, async () => {
        // 缓存未命中时的获取逻辑
        return fetchTokenInfoFromAPIs(tokenAddress, chainId, verbose, priority, rpcStrategy, fastMode);
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

    logger.warn(LogCode.API_FETCH_FAILED, 'All API liquidity sources failed', { token: tokenAddress });
    return null; // 无 liquidity 数据
}

/**
 * 从 API 获取 Token 信息（内部函数）
 * 🚀 HYBRID STRATEGY: RPC (price) + API (liquidity) 并行获取
 * @param priority - 'high' for Copy Trade (skips rate limits)
 */
async function fetchTokenInfoFromAPIs(
    tokenAddress: string,
    chainId: number,
    verbose: boolean,
    priority: ApiPriority = 'normal',
    rpcStrategy: 'fast' | 'cheap' = 'cheap',
    fastMode: boolean = false
): Promise<any> {
    const chainSlug = getChainSlug(chainId);
    // GeckoTerminal disabled for speed/limits; keep DexScreener + RPC only.

    // 🚀 HYBRID STRATEGY: RPC/Jupiter (price) + API (liquidity)
    // ⚠️ Solana (chainId 900): Uses Jupiter API instead of RPC
    const isSolana = chainId === 900;

    const shouldUseOnChainRpc = isSolana || fastMode || priority === 'high' || rpcStrategy === 'fast';
    if (verbose) {
        logger.debug(LogCode.API_FETCH_SUCCESS, isSolana ? '📡 Jupiter API Strategy (Solana)' : '🚀 Hybrid Strategy (EVM): adaptive RPC + API', {
            token: tokenAddress,
            chainId,
            onChainRpcEnabled: shouldUseOnChainRpc
        });
    }

    // 🚀 PARALLEL EXECUTION: (optional) RPC/Jupiter + API (liquidity) + Metadata
    const rpcPromise = shouldUseOnChainRpc
        ? (isSolana
            ? (async () => {
                const { getSolanaTokenInfo } = await import('./solanaOnChainPriceService.js');
                return getSolanaTokenInfo(tokenAddress);
            })()
            : (async () => {
                const { getOnChainPrice } = await import('./onChainPriceService.js');
                return getOnChainPrice(tokenAddress, chainId, { rpcStrategy });
            })())
        : Promise.resolve(null);

    const liquidityPromise = getLiquidityData(tokenAddress, chainId, priority);

    const metaPromise = isSolana
        ? Promise.resolve({ symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 9 })
        : getTokenMetadata(chainId, tokenAddress, { rpcStrategy });

    const [rpcData, metadata] = await Promise.allSettled([rpcPromise, metaPromise]);

    let liquidityData: PromiseSettledResult<any> | null = null;
    if (fastMode) {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 300));
        const liqWinner = await Promise.race([liquidityPromise, timeout]);
        liquidityData = { status: 'fulfilled', value: liqWinner } as PromiseFulfilledResult<any>;
    } else {
        liquidityData = await Promise.resolve(liquidityPromise)
            .then((value) => ({ status: 'fulfilled', value } as PromiseFulfilledResult<any>))
            .catch((reason) => ({ status: 'rejected', reason } as PromiseRejectedResult));
    }

    // Extract results
    const rpc = rpcData.status === 'fulfilled' ? rpcData.value : null;
    const liq = liquidityData && liquidityData.status === 'fulfilled' ? liquidityData.value : null;
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

        const tryDex = async () => {
            const dexChainId = isSolana ? 'solana' : chainId;
            const dexPrice = await getDexPrice(tokenAddress, dexChainId);
            return dexPrice > 0 ? dexPrice : null;
        };

        if (fastMode) {
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 800));
            const winner = await Promise.race([tryDex(), timeout]);
            if (typeof winner === 'number') {
                price = winner;
                provider = isSolana ? 'jupiter-dex' : '0x-dex';
            }
        } else {
            // No GeckoTerminal fallback in non-fast mode
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
