/**
 * RPC Response Cache Service
 * 缓存只读 RPC 响应以减少重复调用
 * 
 * [Logic]: 大多数 eth_call 请求是可缓存的只读查询
 * [Ref]: 减少 Alchemy 调用量，降低账单费用
 * [Risk]: 价格敏感数据的 TTL 需要足够短以避免过期数据
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// ============================================================================
// TYPES
// ============================================================================

interface RpcCacheEntry {
    result: any;
    timestamp: number;
    ttlMs: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    size: number;
}

// ============================================================================
// CACHE STORAGE
// ============================================================================

const cache = new Map<string, RpcCacheEntry>();
const stats: CacheStats = { hits: 0, misses: 0, size: 0 };

// Maximum cache entries to prevent memory bloat
const MAX_CACHE_ENTRIES = 10000;

// ============================================================================
// TTL CONFIGURATION (毫秒)
// ============================================================================

/**
 * 方法级别的 TTL 配置
 * [Logic]: 不同类型的数据有不同的有效期
 * [Risk]: TTL 太长会导致陈旧数据，太短会降低缓存效果
 */
const METHOD_TTL_MS: Record<string, number> = {
    // EVM 方法
    'eth_call': 5000,              // 5秒 - 合约调用 (价格敏感)
    'eth_blockNumber': 12000,      // 12秒 - 约1个区块
    'eth_gasPrice': 10000,         // 10秒 - Gas 价格
    'eth_getBlockByNumber': 60000, // 60秒 - 区块数据不变
    'eth_chainId': 300000,         // 5分钟 - 链ID不变

    // Solana 方法
    'getAccountInfo': 30000,       // 30秒 - 账户信息
    'getBalance': 10000,           // 10秒 - 余额
    'getSlot': 5000,               // 5秒 - 当前 slot
    'getTokenAccountsByOwner': 30000, // 30秒 - 代币账户
};

// 默认 TTL
const DEFAULT_TTL_MS = 5000;

// 不可缓存的方法 (有副作用或实时性要求高)
const NON_CACHEABLE_METHODS = new Set([
    'eth_sendRawTransaction',
    'eth_sendTransaction',
    'eth_estimateGas',
    'eth_getTransactionReceipt',
    'eth_getTransactionByHash',
    'sendTransaction',
    'simulateTransaction',
]);

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * 生成缓存键
 * [Logic]: 基于 chainId + method + params 的唯一标识
 */
export function buildCacheKey(chainId: number | string, method: string, params: any[]): string {
    const normalizedChain = typeof chainId === 'string' ? chainId : chainId.toString();

    // 对 params 进行稳定的序列化
    let paramsStr: string;
    try {
        paramsStr = JSON.stringify(params);
    } catch {
        // 如果序列化失败，使用空字符串使其不缓存
        paramsStr = `_unstable_${Date.now()}`;
    }

    return `${normalizedChain}:${method}:${paramsStr}`;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * 检查方法是否可缓存
 */
export function isCacheable(method: string): boolean {
    return !NON_CACHEABLE_METHODS.has(method);
}

/**
 * 获取方法的 TTL
 */
export function getTtlForMethod(method: string): number {
    return METHOD_TTL_MS[method] ?? DEFAULT_TTL_MS;
}

/**
 * 从缓存获取结果
 * @returns 缓存的结果，或 null 如果未命中
 */
export function getCachedRpc(cacheKey: string): any | null {
    const entry = cache.get(cacheKey);

    if (!entry) {
        stats.misses++;
        return null;
    }

    const now = Date.now();

    // 检查是否过期
    if (now - entry.timestamp > entry.ttlMs) {
        cache.delete(cacheKey);
        stats.misses++;
        stats.size = cache.size;
        return null;
    }

    stats.hits++;
    return entry.result;
}

/**
 * 设置缓存结果
 */
export function setCachedRpc(cacheKey: string, result: any, ttlMs: number): void {
    // 防止缓存过大
    if (cache.size >= MAX_CACHE_ENTRIES) {
        evictOldestEntries();
    }

    cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        ttlMs
    });

    stats.size = cache.size;
}

/**
 * 清理过期条目
 */
function evictOldestEntries(): void {
    const now = Date.now();
    let evicted = 0;

    // 首先删除过期条目
    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > entry.ttlMs) {
            cache.delete(key);
            evicted++;
        }
    }

    // 如果仍然超过限制，删除最老的 10%
    if (cache.size >= MAX_CACHE_ENTRIES) {
        const toDelete = Math.floor(MAX_CACHE_ENTRIES * 0.1);
        const keys = Array.from(cache.keys()).slice(0, toDelete);
        keys.forEach(key => cache.delete(key));
        evicted += toDelete;
    }

    if (evicted > 0) {
        logger.debug(LogCode.SYS_INFO, 'RPC cache eviction', { evicted, remaining: cache.size });
    }
}

// ============================================================================
// STATS & MONITORING
// ============================================================================

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): CacheStats & { hitRate: string } {
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) + '%' : '0%';

    return {
        ...stats,
        hitRate
    };
}

/**
 * 清空缓存 (主要用于测试)
 */
export function clearCache(): void {
    cache.clear();
    stats.hits = 0;
    stats.misses = 0;
    stats.size = 0;
}

/**
 * 定期日志报告 (可选启用)
 */
let statsInterval: NodeJS.Timeout | null = null;

export function startStatsLogging(intervalMs: number = 60000): void {
    if (statsInterval) return;

    statsInterval = setInterval(() => {
        const s = getCacheStats();
        if (s.hits > 0 || s.misses > 0) {
            logger.info(LogCode.SYS_INFO, 'RPC cache stats', {
                hits: s.hits,
                misses: s.misses,
                hitRate: s.hitRate,
                size: s.size
            });
        }
    }, intervalMs);
}

export function stopStatsLogging(): void {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}
