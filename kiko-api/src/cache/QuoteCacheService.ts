/**
 * Quote Cache Service
 * 缓存 Quote 数据，避免同一批用户重复请求 aggregator
 * 
 * 策略：
 * 1. 同一个 token pair + 相近金额 = 复用 quote
 * 2. 按比例调整 amountOut
 * 3. 5秒 TTL（quote 有效期短）
 */

import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

interface CachedQuote {
    quote: any;
    baseAmountIn: string; // 基准输入金额 (wei)
    baseAmountOut: string; // 基准输出金额 (wei)
    timestamp: number;
    hitCount: number;
}

// Quote 缓存 (key: chainId:tokenIn:tokenOut)
const quoteCache = new LRUCache<string, CachedQuote>({
    max: 100,
    ttl: 5 * 1000, // 5秒 TTL（quote 快速过期）
});

// 允许复用的金额偏差范围
const AMOUNT_TOLERANCE = 0.3; // 30% 偏差内可复用

/**
 * 生成缓存 key
 */
function getCacheKey(chainId: number, tokenIn: string, tokenOut: string): string {
    return `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
}

/**
 * 检查金额是否在可复用范围内
 */
function isAmountInRange(cachedAmount: string, requestAmount: string): boolean {
    const cached = BigInt(cachedAmount);
    const request = BigInt(requestAmount);
    
    if (cached === 0n) return false;
    
    // 计算比例
    const ratio = Number(request) / Number(cached);
    
    // 在 70% - 130% 范围内可复用
    return ratio >= (1 - AMOUNT_TOLERANCE) && ratio <= (1 + AMOUNT_TOLERANCE);
}

/**
 * 按比例调整 quote 输出金额
 */
function scaleQuoteAmountOut(cachedQuote: CachedQuote, requestAmountIn: string): string {
    const cached = BigInt(cachedQuote.baseAmountIn);
    const request = BigInt(requestAmountIn);
    const cachedOut = BigInt(cachedQuote.baseAmountOut);
    
    if (cached === 0n) return cachedQuote.baseAmountOut;
    
    // 按比例计算: newOut = cachedOut * (requestIn / cachedIn)
    const scaledOut = (cachedOut * request) / cached;
    
    return scaledOut.toString();
}

/**
 * 尝试从缓存获取 Quote
 * @returns 缓存的 quote 或 null
 */
export function getCachedQuote(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountInBase: string
): { quote: any; scaledAmountOut: string } | null {
    const cacheKey = getCacheKey(chainId, tokenIn, tokenOut);
    const cached = quoteCache.get(cacheKey);
    
    if (!cached) {
        return null;
    }
    
    // 检查金额是否在可复用范围
    if (!isAmountInRange(cached.baseAmountIn, amountInBase)) {
        logger.debug(LogCode.CACHE_MISS, 'Quote cache: amount out of range', {
            cached: cached.baseAmountIn,
            request: amountInBase
        });
        return null;
    }
    
    // 按比例调整输出金额
    const scaledAmountOut = scaleQuoteAmountOut(cached, amountInBase);
    
    // 更新命中计数
    cached.hitCount++;
    
    logger.info(LogCode.CACHE_HIT, '⚡ Quote cache hit!', {
        cacheKey,
        hitCount: cached.hitCount,
        age: Date.now() - cached.timestamp,
        savedRequest: true
    });
    
    return {
        quote: cached.quote,
        scaledAmountOut
    };
}

/**
 * 缓存 Quote
 */
export function setCachedQuote(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountInBase: string,
    amountOutBase: string,
    quote: any
): void {
    const cacheKey = getCacheKey(chainId, tokenIn, tokenOut);
    
    quoteCache.set(cacheKey, {
        quote,
        baseAmountIn: amountInBase,
        baseAmountOut: amountOutBase,
        timestamp: Date.now(),
        hitCount: 0
    });
    
    logger.debug(LogCode.SYS_INFO, 'Quote cached', {
        cacheKey,
        amountIn: amountInBase,
        amountOut: amountOutBase
    });
}

/**
 * 获取缓存统计
 */
export function getQuoteCacheStats() {
    let totalHits = 0;
    
    for (const [_, value] of quoteCache.entries()) {
        totalHits += value.hitCount;
    }
    
    return {
        size: quoteCache.size,
        totalHits,
        maxSize: 100
    };
}

/**
 * 清除特定 token pair 的缓存
 */
export function invalidateQuoteCache(chainId: number, tokenIn: string, tokenOut: string): void {
    const cacheKey = getCacheKey(chainId, tokenIn, tokenOut);
    quoteCache.delete(cacheKey);
}

/**
 * 清除所有缓存
 */
export function clearQuoteCache(): void {
    quoteCache.clear();
}
