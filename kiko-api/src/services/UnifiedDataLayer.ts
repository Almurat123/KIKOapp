/**
 * Unified Data Layer
 * 
 * 统一的数据获取层 - 所有数据获取都经过这里
 * 
 * 核心原则：
 * 1. 自动缓存 - 获取的数据自动缓存到 TradeContext
 * 2. 智能复用 - 如果 context 中有数据，直接返回
 * 3. 批量获取 - 支持一次获取多个 token 信息
 * 4. 透明传递 - 下游函数可以直接使用缓存数据
 */

import { TradeContext, TokenData, TokenBalance, QuoteData, getTradeContext } from './TradeContext.js';
import { getTokenInfo as getTokenInfoFromService } from './tokenService.js';
import { getTokenDetails as getDexTokenDetails } from './dexscreener.js';
import { getTokenDetails as getGeckoTokenDetails } from './geckoTerminal.js';
import { getTokenBalances } from './alchemy.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainSlug } from '../config/chainConfig.js';

// ============================================================================
// Token 数据获取
// ============================================================================

/**
 * 获取 Token 信息 (上下文感知)
 * 
 * @param address Token 地址
 * @param chainId 链 ID
 * @param context TradeContext 或 ToolContext
 * @returns TokenData 或 null
 */
export async function getTokenData(
    address: string,
    chainId: number,
    context?: TradeContext | any
): Promise<TokenData | null> {
    // 获取或创建上下文
    const ctx = context instanceof TradeContext 
        ? context 
        : context ? getTradeContext(context) : null;
    
    // 如果有上下文，尝试从缓存获取
    if (ctx) {
        const cached = ctx.getToken(address, chainId);
        if (cached) {
            logger.debug(LogCode.CACHE_HIT, 'getTokenData: cache hit', { 
                symbol: cached.symbol, 
                source: 'TradeContext' 
            });
            return cached;
        }
    }
    
    // 缓存未命中，获取数据
    try {
        const rawData = await getTokenInfoFromService(address, chainId, { verbose: false });
        
        if (!rawData) return null;
        
        const tokenData: TokenData = {
            address: rawData.address || address,
            symbol: rawData.symbol || 'UNKNOWN',
            name: rawData.name || rawData.symbol || 'Unknown Token',
            decimals: rawData.decimals || 18,
            price: rawData.price || rawData.priceUsd,
            priceUsd: rawData.priceUsd || rawData.price,
            liquidity: rawData.liquidity,
            marketCap: rawData.marketCap,
            chainId,
            launchpad: rawData.launchpad,
            isNative: rawData.isNative,
            fetchedAt: Date.now(),
        };
        
        // 缓存到上下文
        if (ctx) {
            ctx.setToken(tokenData);
        }
        
        return tokenData;
        
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'getTokenData failed', { 
            address, chainId, error: error.message 
        });
        return null;
    }
}

/**
 * 批量获取 Token 信息 (并行 + 缓存)
 */
export async function getTokenDataBatch(
    tokens: Array<{ address: string; chainId: number }>,
    context?: TradeContext | any
): Promise<Map<string, TokenData>> {
    const ctx = context instanceof TradeContext 
        ? context 
        : context ? getTradeContext(context) : null;
    
    const results = new Map<string, TokenData>();
    const toFetch: Array<{ address: string; chainId: number }> = [];
    
    // 先检查缓存
    for (const token of tokens) {
        const key = `${token.chainId}:${token.address.toLowerCase()}`;
        
        if (ctx) {
            const cached = ctx.getToken(token.address, token.chainId);
            if (cached) {
                results.set(key, cached);
                continue;
            }
        }
        
        toFetch.push(token);
    }
    
    // 批量获取未缓存的
    if (toFetch.length > 0) {
        const fetchPromises = toFetch.map(t => 
            getTokenData(t.address, t.chainId, ctx)
                .then(data => ({ ...t, data }))
                .catch(() => ({ ...t, data: null }))
        );
        
        const fetched = await Promise.all(fetchPromises);
        
        for (const item of fetched) {
            if (item.data) {
                const key = `${item.chainId}:${item.address.toLowerCase()}`;
                results.set(key, item.data);
            }
        }
    }
    
    logger.debug(LogCode.SYS_INFO, 'getTokenDataBatch completed', {
        requested: tokens.length,
        cached: tokens.length - toFetch.length,
        fetched: toFetch.length,
        success: results.size
    });
    
    return results;
}

// ============================================================================
// 钱包余额获取
// ============================================================================

/**
 * 获取钱包余额 (上下文感知)
 */
export async function getWalletBalances(
    walletAddress: string,
    chainId: number,
    context?: TradeContext | any,
    options: { forceRefresh?: boolean } = {}
): Promise<TokenBalance[]> {
    const ctx = context instanceof TradeContext 
        ? context 
        : context ? getTradeContext(context) : null;
    
    // 检查上下文缓存 (30秒内有效)
    if (ctx && ctx.wallet && !options.forceRefresh) {
        const age = Date.now() - (ctx.wallet.fetchedAt || 0);
        if (age < 30000 && ctx.wallet.tokens.size > 0) {
            logger.debug(LogCode.CACHE_HIT, 'getWalletBalances: cache hit', {
                tokenCount: ctx.wallet.tokens.size,
                ageMs: age
            });
            return Array.from(ctx.wallet.tokens.values());
        }
    }
    
    // 获取新数据
    try {
        // 将 chainId 转换为链名称
        const chainMap: Record<number, string> = {
            1: 'eth',
            8453: 'base',
            56: 'bsc',
            137: 'polygon',
            42161: 'arbitrum',
            10: 'optimism',
        };
        const chain = chainMap[chainId] || 'eth';
        
        const rawBalances = await getTokenBalances(walletAddress, chain);
        
        const balances: TokenBalance[] = rawBalances.map((b: any) => ({
            address: b.contractAddress || b.address,
            symbol: b.symbol,
            balance: b.balance,
            balanceFormatted: b.formatted || b.balance,
            decimals: b.decimals,
            valueUsd: b.value || b.valueUsd,
        }));
        
        // 缓存到上下文
        if (ctx) {
            ctx.setWalletBalances(balances);
        }
        
        return balances;
        
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'getWalletBalances failed', { 
            wallet: walletAddress.slice(0, 10), 
            chainId, 
            error: error.message 
        });
        return [];
    }
}

/**
 * 获取特定 Token 余额
 */
export async function getTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    chainId: number,
    context?: TradeContext | any
): Promise<TokenBalance | null> {
    const ctx = context instanceof TradeContext 
        ? context 
        : context ? getTradeContext(context) : null;
    
    // 先检查上下文缓存
    if (ctx) {
        const cached = ctx.getBalance(tokenAddress);
        if (cached) {
            logger.debug(LogCode.CACHE_HIT, 'getTokenBalance: cache hit', {
                symbol: cached.symbol,
                balance: cached.balanceFormatted
            });
            return cached;
        }
    }
    
    // 获取完整余额列表
    const balances = await getWalletBalances(walletAddress, chainId, ctx);
    
    // 查找目标 token
    return balances.find((b: TokenBalance) => 
        b.address.toLowerCase() === tokenAddress.toLowerCase()
    ) || null;
}

// ============================================================================
// Quote 获取
// ============================================================================

/**
 * 获取最佳报价 (上下文感知)
 * 
 * 注意: 这是一个简化版本，完整的 quote 获取需要更多参数
 * 实际使用时应该调用 quoteService.getBestQuote 并传入完整参数
 */
export async function getSwapQuote(
    params: {
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
        slippage?: number;
        tokenInDecimals?: number;
        tokenOutDecimals?: number;
    },
    context?: TradeContext | any
): Promise<QuoteData | null> {
    const ctx = context instanceof TradeContext 
        ? context 
        : context ? getTradeContext(context) : null;
    
    // 检查缓存的 quote (必须匹配参数)
    if (ctx) {
        const cached = ctx.getQuote();
        if (cached && 
            cached.amountIn === params.amountIn) {
            logger.debug(LogCode.CACHE_HIT, 'getSwapQuote: cache hit', {
                dex: cached.dex,
                amountOut: cached.amountOut
            });
            return cached;
        }
    }
    
    // 简化版: 返回 null，实际使用需要完整参数调用 getBestQuote
    // 这里不直接调用 getBestQuote 因为它需要更多计算后的参数
    logger.debug(LogCode.SYS_INFO, 'getSwapQuote: needs full params, skipping simplified fetch');
    return null;
}

/**
 * 缓存外部获取的 quote 到上下文
 */
export function cacheQuote(
    quote: {
        dex: string;
        amountIn: string;
        amountOut: string;
        minAmountOut?: string;
        priceImpact?: number;
        gasEstimate?: number;
        route?: string[];
        to?: string;
        data?: string;
        value?: string;
    },
    context?: TradeContext | any
): void {
    const ctx = context instanceof TradeContext 
        ? context 
        : context ? getTradeContext(context) : null;
    
    if (!ctx) return;
    
    const quoteData: Omit<QuoteData, 'fetchedAt' | 'expiresAt'> = {
        dex: quote.dex,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        minAmountOut: quote.minAmountOut || quote.amountOut,
        priceImpact: quote.priceImpact || 0,
        gasEstimate: quote.gasEstimate || 0,
        route: quote.route,
        txData: quote.to ? {
            to: quote.to,
            data: quote.data || '',
            value: quote.value || '0',
        } : undefined,
    };
    
    ctx.setQuote(quoteData, 30000);
}

// ============================================================================
// 便捷函数：一次性获取交易所需全部数据
// ============================================================================

export interface SwapDataBundle {
    tokenIn: TokenData | null;
    tokenOut: TokenData | null;
    balance: TokenBalance | null;
    quote: QuoteData | null;
    context: TradeContext;
}

/**
 * 获取交易所需的全部数据 (并行获取，自动缓存)
 * 
 * 这是推荐的入口函数 - 一次调用获取所有数据
 */
export async function getSwapDataBundle(
    params: {
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
    },
    context?: TradeContext | any
): Promise<SwapDataBundle> {
    const ctx = context instanceof TradeContext 
        ? context 
        : TradeContext.create({
            walletAddress: params.walletAddress,
            chainId: params.chainId,
            ...(context || {}),
        });
    
    logger.info(LogCode.SYS_INFO, 'getSwapDataBundle: fetching all swap data', {
        contextId: ctx.id,
        tokenIn: params.tokenIn.slice(0, 10),
        tokenOut: params.tokenOut.slice(0, 10),
    });
    
    // 并行获取所有数据
    const [tokenIn, tokenOut, balance, quote] = await Promise.all([
        getTokenData(params.tokenIn, params.chainId, ctx),
        getTokenData(params.tokenOut, params.chainId, ctx),
        getTokenBalance(params.walletAddress, params.tokenIn, params.chainId, ctx),
        getSwapQuote({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            chainId: params.chainId,
        }, ctx),
    ]);
    
    logger.info(LogCode.SYS_INFO, 'getSwapDataBundle: completed', {
        contextId: ctx.id,
        hasTokenIn: !!tokenIn,
        hasTokenOut: !!tokenOut,
        hasBalance: !!balance,
        hasQuote: !!quote,
        contextSummary: ctx.toSummary(),
    });
    
    return {
        tokenIn,
        tokenOut,
        balance,
        quote,
        context: ctx,
    };
}

// ============================================================================
// 导出
// ============================================================================

export default {
    getTokenData,
    getTokenDataBatch,
    getWalletBalances,
    getTokenBalance,
    getSwapQuote,
    getSwapDataBundle,
};
