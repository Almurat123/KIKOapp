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
import { decideLaunchpadOraclePrice, decideValidatedMarketPrice, isLaunchpadOracleSource } from './pricing/launchpadOraclePolicy.js';

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
): Promise<{ liquidity: number; volume24h: number; fdv?: number; priceUsd?: number; symbol?: string; name?: string } | null> {
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
                    fdv: pair.fdv || 0,
                    priceUsd: Number(pair.priceUsd || 0) || undefined,
                    symbol: pair.baseToken?.symbol || undefined,
                    name: pair.baseToken?.name || undefined
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

    const liquidityPromise = isSolana
        ? Promise.resolve(null)
        : getLiquidityData(tokenAddress, chainId, priority);

    const metaPromise = getTokenMetadata(chainId, tokenAddress, { rpcStrategy });

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
    const rpcDexName = rpc && typeof rpc === 'object' && 'dexName' in rpc ? String(rpc.dexName || '') : undefined;

    // 🛡️ MERGE STRATEGY: Use best data from each source
    let price = rpc?.price || 0;
    let marketCap = rpc?.marketCap || liq?.fdv || 0;
    let liquidity = liq?.liquidity || 0;
    let volume24h = liq?.volume24h || 0;
    let symbol = meta?.symbol || 'UNKNOWN';
    let name = meta?.name || 'Unknown Token';
    let decimals = meta?.decimals || 18;
    let provider = 'rpc+api';
    let priceValidationReason: string | undefined;
    let referencePrice: number | undefined;
    let referenceProvider: string | undefined;
    let priceFallbackUsed = false;

    // If RPC is unavailable but DexScreener has pair price, use it before full failure.
    if (!isSolana && (price <= 0 || isNaN(price)) && liq?.priceUsd && liq.priceUsd > 0) {
        price = liq.priceUsd;
        provider = 'dexscreener-liquidity';
    }

    let dexValidatorPrice = 0;
    if (price > 0 && !isSolana) {
        try {
            const dexChainId = isSolana ? 'solana' : chainId;
            const timeoutMs = fastMode ? 500 : 900;
            dexValidatorPrice = await Promise.race([
                getDexPrice(tokenAddress, dexChainId),
                new Promise<number>((resolve) => setTimeout(() => resolve(0), timeoutMs))
            ]);
        } catch {
            dexValidatorPrice = 0;
        }
    }

    if (price > 0 && isLaunchpadOracleSource({ chainId, dexName: rpcDexName, provider })) {
        const decision = decideLaunchpadOraclePrice({
            chainId,
            rpcPriceUsd: price,
            rpcDexName,
            provider,
            liquidityPriceUsd: liq?.priceUsd,
            dexPriceUsd: dexValidatorPrice
        });

        price = decision.finalPriceUsd;
        provider = decision.finalProvider;
        referencePrice = decision.referencePriceUsd;
        referenceProvider = decision.referenceProvider;
        priceValidationReason = decision.reasonCode;
        priceFallbackUsed = decision.fallbackUsed;
        if (decision.fallbackUsed) {
            if (liq?.fdv && liq.fdv > 0) {
                marketCap = liq.fdv;
            } else if (rpc?.marketCap && rpc?.price) {
                marketCap = rpc.marketCap * (price / rpc.price);
            }
        }

        if (decision.fallbackUsed) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Launchpad oracle price overridden by validated market reference', {
                token: tokenAddress,
                chainId,
                rpcDexName,
                rpcPriceUsd: rpc?.price,
                selectedPriceUsd: price,
                referencePriceUsd: referencePrice,
                referenceProvider,
                reasonCode: priceValidationReason,
                deviationRatio: decision.deviationRatio
            });
        }
    } else if (price > 0) {
        const decision = decideValidatedMarketPrice({
            rpcPriceUsd: price,
            provider,
            liquidityPriceUsd: liq?.priceUsd,
            dexPriceUsd: dexValidatorPrice
        });
        price = decision.finalPriceUsd;
        provider = decision.finalProvider;
        referencePrice = decision.referencePriceUsd;
        referenceProvider = decision.referenceProvider;
        priceValidationReason = decision.reasonCode;
        priceFallbackUsed = decision.fallbackUsed;
        if (decision.fallbackUsed) {
            if (liq?.fdv && liq.fdv > 0) {
                marketCap = liq.fdv;
            } else if (rpc?.marketCap && rpc?.price) {
                marketCap = rpc.marketCap * (price / rpc.price);
            }
            logger.warn(LogCode.API_FETCH_FAILED, 'RPC market price overridden by external validator', {
                token: tokenAddress,
                chainId,
                rpcDexName,
                rpcPriceUsd: rpc?.price,
                selectedPriceUsd: price,
                referencePriceUsd: referencePrice,
                referenceProvider,
                reasonCode: priceValidationReason,
                deviationRatio: decision.deviationRatio
            });
        }
    }

    // 🛡️ FALLBACK: External API first (Jupiter v2 / 0x), RPC was already attempted above
    // For Solana: Jupiter Price API v2 → Raydium (via getDexPrice)
    // For EVM:    0x API (via getDexPrice)
    if (price <= 0 || isNaN(price)) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Primary price failed, falling back to external DEX API', {
            token: tokenAddress,
            chain: isSolana ? 'solana' : chainId,
            rpcPrice: rpc?.price
        });

        const dexChainId = isSolana ? 'solana' : chainId;

        const tryDex = async () => {
            const dexPrice = await getDexPrice(tokenAddress, dexChainId);
            return dexPrice > 0 ? dexPrice : null;
        };

        // Fast-mode: race against timeout so TP/SL loop doesn't stall
        if (fastMode) {
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 800));
            const winner = await Promise.race([tryDex(), timeout]);
            if (typeof winner === 'number') {
                price = winner;
                provider = isSolana ? 'jupiter-dex' : '0x-dex';
            }
        } else {
            // Non-fast: give it a full attempt (no timeout race)
            try {
                const dexPrice = await getDexPrice(tokenAddress, dexChainId);
                if (dexPrice > 0) {
                    price = dexPrice;
                    provider = isSolana ? 'jupiter-dex' : '0x-dex';
                    logger.info(LogCode.API_FETCH_SUCCESS, 'Fallback: Got price from external DEX API', {
                        token: tokenAddress.slice(0, 10),
                        price,
                        provider
                    });
                }
            } catch (dexErr: any) {
                logger.error(LogCode.API_FETCH_FAILED, 'External DEX API fallback also failed', {
                    token: tokenAddress,
                    error: dexErr.message
                });
            }
        }
    }

    // Final validation
    if (price <= 0 || isNaN(price)) {
        if (isSolana) {
            logger.warn(LogCode.API_FETCH_FAILED, 'No valid Solana price from token service (caller may derive swap-implied fallback)', {
                token: tokenAddress,
                rpcResult: rpc,
                liquidityResult: liq
            });
        } else {
            logger.error(LogCode.API_FETCH_FAILED, 'Critical: No valid price data available', {
                token: tokenAddress,
                rpcResult: rpc,
                liquidityResult: liq
            });
        }
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
        provider,
        priceValidationReason,
        referencePrice,
        referenceProvider,
        priceFallbackUsed,
        rpcDexName
    };

    logger.info(LogCode.API_FETCH_SUCCESS, '✅ Hybrid fetch complete', {
        symbol: result.symbol,
        price: result.price,
        liquidity: result.liquidity,
        provider: result.provider,
        priceValidationReason: result.priceValidationReason,
        priceFallbackUsed: result.priceFallbackUsed
    });

    return result;
}
