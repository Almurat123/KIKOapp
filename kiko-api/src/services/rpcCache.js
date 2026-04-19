"use strict";
/**
 * RPC Response Cache Service
 * 缓存只读 RPC 响应以减少重复调用
 *
 * [Logic]: 大多数 eth_call 请求是可缓存的只读查询
 * [Ref]: 减少 Alchemy 调用量，降低账单费用
 * [Risk]: 价格敏感数据的 TTL 需要足够短以避免过期数据
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCacheKey = buildCacheKey;
exports.isCacheable = isCacheable;
exports.getTtlForMethod = getTtlForMethod;
exports.getCachedRpc = getCachedRpc;
exports.setCachedRpc = setCachedRpc;
exports.getCacheStats = getCacheStats;
exports.clearCache = clearCache;
exports.startStatsLogging = startStatsLogging;
exports.stopStatsLogging = stopStatsLogging;
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
// ============================================================================
// CACHE STORAGE
// ============================================================================
var cache = new Map();
var stats = { hits: 0, misses: 0, size: 0 };
// Maximum cache entries to prevent memory bloat
var MAX_CACHE_ENTRIES = 10000;
// ============================================================================
// TTL CONFIGURATION (毫秒)
// ============================================================================
/**
 * 方法级别的 TTL 配置
 * [Logic]: 不同类型的数据有不同的有效期
 * [Risk]: TTL 太长会导致陈旧数据，太短会降低缓存效果
 */
var METHOD_TTL_MS = {
    // EVM 方法
    'eth_call': 5000, // 5秒 - 合约调用 (价格敏感)
    'eth_blockNumber': 12000, // 12秒 - 约1个区块
    'eth_gasPrice': 10000, // 10秒 - Gas 价格
    'eth_getBlockByNumber': 60000, // 60秒 - 区块数据不变
    'eth_chainId': 300000, // 5分钟 - 链ID不变
    // Solana 方法
    'getAccountInfo': 30000, // 30秒 - 账户信息
    'getBalance': 10000, // 10秒 - 余额
    'getSlot': 5000, // 5秒 - 当前 slot
    'getTokenAccountsByOwner': 30000, // 30秒 - 代币账户
};
// 默认 TTL
var DEFAULT_TTL_MS = 5000;
// 不可缓存的方法 (有副作用或实时性要求高)
var NON_CACHEABLE_METHODS = new Set([
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
function buildCacheKey(chainId, method, params) {
    var normalizedChain = typeof chainId === 'string' ? chainId : chainId.toString();
    // 对 params 进行稳定的序列化
    var paramsStr;
    try {
        paramsStr = JSON.stringify(params);
    }
    catch (_a) {
        // 如果序列化失败，使用空字符串使其不缓存
        paramsStr = "_unstable_".concat(Date.now());
    }
    return "".concat(normalizedChain, ":").concat(method, ":").concat(paramsStr);
}
// ============================================================================
// CACHE OPERATIONS
// ============================================================================
/**
 * 检查方法是否可缓存
 */
function isCacheable(method) {
    return !NON_CACHEABLE_METHODS.has(method);
}
/**
 * 获取方法的 TTL
 */
function getTtlForMethod(method) {
    var _a;
    return (_a = METHOD_TTL_MS[method]) !== null && _a !== void 0 ? _a : DEFAULT_TTL_MS;
}
/**
 * 从缓存获取结果
 * @returns 缓存的结果，或 null 如果未命中
 */
function getCachedRpc(cacheKey) {
    var entry = cache.get(cacheKey);
    if (!entry) {
        stats.misses++;
        return null;
    }
    var now = Date.now();
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
function setCachedRpc(cacheKey, result, ttlMs) {
    // 防止缓存过大
    if (cache.size >= MAX_CACHE_ENTRIES) {
        evictOldestEntries();
    }
    cache.set(cacheKey, {
        result: result,
        timestamp: Date.now(),
        ttlMs: ttlMs
    });
    stats.size = cache.size;
}
/**
 * 清理过期条目
 */
function evictOldestEntries() {
    var now = Date.now();
    var evicted = 0;
    // 首先删除过期条目
    for (var _i = 0, _a = cache.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], entry = _b[1];
        if (now - entry.timestamp > entry.ttlMs) {
            cache.delete(key);
            evicted++;
        }
    }
    // 如果仍然超过限制，删除最老的 10%
    if (cache.size >= MAX_CACHE_ENTRIES) {
        var toDelete = Math.floor(MAX_CACHE_ENTRIES * 0.1);
        var keys = Array.from(cache.keys()).slice(0, toDelete);
        keys.forEach(function (key) { return cache.delete(key); });
        evicted += toDelete;
    }
    if (evicted > 0) {
        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'RPC cache eviction', { evicted: evicted, remaining: cache.size });
    }
}
// ============================================================================
// STATS & MONITORING
// ============================================================================
/**
 * 获取缓存统计信息
 */
function getCacheStats() {
    var total = stats.hits + stats.misses;
    var hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) + '%' : '0%';
    return __assign(__assign({}, stats), { hitRate: hitRate });
}
/**
 * 清空缓存 (主要用于测试)
 */
function clearCache() {
    cache.clear();
    stats.hits = 0;
    stats.misses = 0;
    stats.size = 0;
}
/**
 * 定期日志报告 (可选启用)
 */
var statsInterval = null;
function startStatsLogging(intervalMs) {
    if (intervalMs === void 0) { intervalMs = 60000; }
    if (statsInterval)
        return;
    statsInterval = setInterval(function () {
        var s = getCacheStats();
        if (s.hits > 0 || s.misses > 0) {
            logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'RPC cache stats', {
                hits: s.hits,
                misses: s.misses,
                hitRate: s.hitRate,
                size: s.size
            });
        }
    }, intervalMs);
}
function stopStatsLogging() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}
