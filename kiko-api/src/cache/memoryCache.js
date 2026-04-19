"use strict";
/**
 * In-Memory Cache Layer
 *
 * Purpose: Eliminate Railway PostgreSQL network latency (400-2000ms per query)
 * by caching frequently accessed data in local memory.
 *
 * Data Flow:
 * 1. Background Job fetches from external API
 * 2. Saves to PostgreSQL (persistent storage)
 * 3. Updates memory cache (fast access)
 * 4. API routes read from memory cache (instant)
 *
 * On Server Restart:
 * - Memory cache is empty
 * - First request triggers cache population from PostgreSQL
 * - Subsequent requests read from memory (instant)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_TTL = exports.CACHE_KEYS = exports.memoryCache = void 0;
var MemoryCache = /** @class */ (function () {
    function MemoryCache() {
        this.cache = new Map();
    }
    /**
     * Get item from memory cache
     */
    MemoryCache.prototype.get = function (key) {
        var entry = this.cache.get(key);
        if (!entry)
            return null;
        // Check if expired
        if (entry.ttl > 0 && Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    };
    /**
     * Set item in memory cache
     * @param ttl Time to live in milliseconds (0 = never expires)
     */
    MemoryCache.prototype.set = function (key, data, ttl) {
        if (ttl === void 0) { ttl = 0; }
        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        });
    };
    /**
     * Delete item from memory cache
     */
    MemoryCache.prototype.delete = function (key) {
        this.cache.delete(key);
    };
    /**
     * Check if key exists and is not expired
     */
    MemoryCache.prototype.has = function (key) {
        return this.get(key) !== null;
    };
    /**
     * Clear all items from cache
     */
    MemoryCache.prototype.clear = function () {
        this.cache.clear();
    };
    /**
     * Get cache stats
     */
    MemoryCache.prototype.stats = function () {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    };
    return MemoryCache;
}());
// Singleton instance
exports.memoryCache = new MemoryCache();
// Cache keys for standardization
exports.CACHE_KEYS = {
    CHAINS: 'chains',
    PROTOCOLS: 'protocols',
    MARKET_OVERVIEW: 'marketOverview',
    TRENDING_TOKENS: 'trendingTokens',
    TRENDING_CASTS: 'trendingCasts',
    TRENDING_TOKENS_BY_CHAIN: function (chain) { return "trendingTokens:".concat(chain); },
};
// Default TTL values (in milliseconds)
exports.CACHE_TTL = {
    CHAINS: 24 * 60 * 60 * 1000, // 24 hours
    PROTOCOLS: 24 * 60 * 60 * 1000, // 24 hours
    MARKET_OVERVIEW: 24 * 60 * 60 * 1000, // 24 hours
    TRENDING_TOKENS: 5 * 60 * 1000, // 5 minutes
    TRENDING_CASTS: 10 * 60 * 1000, // 10 minutes
};
