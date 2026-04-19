"use strict";
/**
 * Data Cache Hub - 统一缓存中心
 * 所有模块通过这个 Hub 访问缓存数据，避免重复查询
 *
 * 架构：
 * - Token Info Cache (价格、流动性、市值)
 * - Native Price Cache (ETH/BNB/SOL 价格)
 * - User Settings Cache (用户配置)
 * - Config Cache (Copy Trade 配置)
 *
 * 特性：
 * - 自动刷新
 * - 订阅通知
 * - 内存优化
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheHub = void 0;
var lru_cache_1 = require("lru-cache");
var events_1 = require("events");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
// ==================== 缓存实例 ====================
var DataCacheHub = /** @class */ (function (_super) {
    __extends(DataCacheHub, _super);
    function DataCacheHub() {
        var _this = _super.call(this) || this;
        // 缓存配置
        _this.TOKEN_CACHE_TTL = 30 * 1000; // 30秒
        _this.NATIVE_PRICE_TTL = 60 * 60 * 1000; // 1小时
        _this.TOKEN_PRICE_SNAPSHOT_TTL = 30 * 1000; // 30秒
        _this.USER_SETTINGS_TTL = 5 * 60 * 1000; // 5分钟
        _this.CONFIG_CACHE_TTL = 60 * 1000; // 1分钟
        // 初始化缓存
        _this.tokenCache = new lru_cache_1.LRUCache({
            max: 1000,
            ttl: _this.TOKEN_CACHE_TTL,
        });
        _this.nativePriceCache = new Map();
        _this.tokenInflight = new Map();
        _this.nativePriceInflight = new Map();
        _this.tokenPriceSnapshotCache = new lru_cache_1.LRUCache({
            max: 2000,
            ttl: _this.TOKEN_PRICE_SNAPSHOT_TTL,
        });
        _this.userSettingsCache = new lru_cache_1.LRUCache({
            max: 500,
            ttl: _this.USER_SETTINGS_TTL,
        });
        _this.configCache = new lru_cache_1.LRUCache({
            max: 200,
            ttl: _this.CONFIG_CACHE_TTL,
        });
        // 启动清理定时器
        _this.startCleanupTimer();
        return _this;
    }
    DataCacheHub.getInstance = function () {
        if (!DataCacheHub.instance) {
            DataCacheHub.instance = new DataCacheHub();
        }
        return DataCacheHub.instance;
    };
    // ==================== Token Info 缓存 ====================
    DataCacheHub.prototype.tokenPriceSnapshotKey = function (tokenAddress, chainId) {
        return "".concat(chainId, ":").concat(tokenAddress.toLowerCase());
    };
    /**
     * 获取 Token 信息（从缓存或回调函数）
     */
    DataCacheHub.prototype.getTokenInfo = function (tokenAddress, chainId, fetchFn) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, inflight, promise;
            var _this = this;
            return __generator(this, function (_a) {
                cacheKey = "".concat(chainId, ":").concat(tokenAddress.toLowerCase());
                cached = this.tokenCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < this.TOKEN_CACHE_TTL) {
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_HIT, 'Token cache hit', {
                        token: tokenAddress,
                        age: Date.now() - cached.timestamp
                    });
                    return [2 /*return*/, cached];
                }
                inflight = this.tokenInflight.get(cacheKey);
                if (inflight) {
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_HIT, 'Token cache inflight reuse', {
                        token: tokenAddress,
                        chainId: chainId,
                    });
                    return [2 /*return*/, inflight];
                }
                // 缓存未命中，调用获取函数
                logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_MISS, 'Token cache miss, fetching...', { token: tokenAddress });
                promise = (function () { return __awaiter(_this, void 0, void 0, function () {
                    var data, cacheData;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, fetchFn()];
                            case 1:
                                data = _a.sent();
                                if (data) {
                                    cacheData = __assign(__assign({}, data), { timestamp: Date.now() });
                                    this.tokenCache.set(cacheKey, cacheData);
                                    // 触发缓存更新事件
                                    this.emit('tokenUpdated', { chainId: chainId, tokenAddress: tokenAddress, data: cacheData });
                                }
                                return [2 /*return*/, data];
                        }
                    });
                }); })().finally(function () {
                    _this.tokenInflight.delete(cacheKey);
                });
                this.tokenInflight.set(cacheKey, promise);
                return [2 /*return*/, promise];
            });
        });
    };
    /**
     * 批量预热 Token 缓存
     */
    DataCacheHub.prototype.warmupTokens = function (tokens, fetchFn) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.CACHE_HIT, "\uD83D\uDD25 Warming up ".concat(tokens.length, " tokens"), { count: tokens.length });
                        return [4 /*yield*/, Promise.allSettled(tokens.map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                var data, cacheKey, err_1;
                                var address = _b.address, chainId = _b.chainId;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            _c.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, fetchFn(address, chainId)];
                                        case 1:
                                            data = _c.sent();
                                            if (data) {
                                                cacheKey = "".concat(chainId, ":").concat(address.toLowerCase());
                                                this.tokenCache.set(cacheKey, __assign(__assign({}, data), { timestamp: Date.now() }));
                                            }
                                            return [3 /*break*/, 3];
                                        case 2:
                                            err_1 = _c.sent();
                                            logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_MISS, 'Warmup failed for token', { address: address });
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DataCacheHub.prototype.getTokenPriceSnapshot = function (tokenAddress, chainId) {
        var _a, _b, _c;
        var key = this.tokenPriceSnapshotKey(tokenAddress, chainId);
        var cached = this.tokenPriceSnapshotCache.get(key);
        if (!cached)
            return null;
        if (!(Number.isFinite(cached.price) && cached.price > 0))
            return null;
        return {
            price: cached.price,
            provider: cached.provider,
            symbol: cached.symbol,
            decimals: cached.decimals,
            priceValidationReason: (_a = cached.priceValidationReason) !== null && _a !== void 0 ? _a : null,
            referencePrice: (_b = cached.referencePrice) !== null && _b !== void 0 ? _b : null,
            referenceProvider: (_c = cached.referenceProvider) !== null && _c !== void 0 ? _c : null,
            priceFallbackUsed: Boolean(cached.priceFallbackUsed),
        };
    };
    DataCacheHub.prototype.setTokenPriceSnapshot = function (tokenAddress, chainId, input) {
        if (!(Number.isFinite(input.price) && input.price > 0))
            return;
        var key = this.tokenPriceSnapshotKey(tokenAddress, chainId);
        this.tokenPriceSnapshotCache.set(key, {
            price: input.price,
            provider: String(input.provider || 'unknown'),
            symbol: input.symbol ? String(input.symbol) : undefined,
            decimals: Number.isFinite(Number(input.decimals)) ? Number(input.decimals) : undefined,
            priceValidationReason: input.priceValidationReason ? String(input.priceValidationReason) : null,
            referencePrice: Number.isFinite(Number(input.referencePrice)) && Number(input.referencePrice) > 0 ? Number(input.referencePrice) : null,
            referenceProvider: input.referenceProvider ? String(input.referenceProvider) : null,
            priceFallbackUsed: Boolean(input.priceFallbackUsed),
            timestamp: Date.now(),
        });
    };
    // ==================== Native Price 缓存 ====================
    /**
     * 获取 Native Token 价格（ETH/BNB/SOL）
     */
    DataCacheHub.prototype.getNativePrice = function (chainId, fetchFn) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, inflight, promise;
            var _this = this;
            return __generator(this, function (_a) {
                cached = this.nativePriceCache.get(chainId);
                if (cached && Date.now() - cached.timestamp < this.NATIVE_PRICE_TTL) {
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_HIT, 'Native price cache hit', { chainId: chainId, price: cached.price });
                    return [2 /*return*/, cached.price];
                }
                inflight = this.nativePriceInflight.get(chainId);
                if (inflight) {
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_HIT, 'Native price inflight reuse', { chainId: chainId });
                    return [2 /*return*/, inflight];
                }
                // 缓存未命中
                logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_MISS, 'Native price cache miss, fetching...', { chainId: chainId });
                promise = (function () { return __awaiter(_this, void 0, void 0, function () {
                    var price;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, fetchFn()];
                            case 1:
                                price = _a.sent();
                                if (price > 0) {
                                    this.nativePriceCache.set(chainId, { price: price, timestamp: Date.now() });
                                    this.emit('nativePriceUpdated', { chainId: chainId, price: price });
                                }
                                return [2 /*return*/, price];
                        }
                    });
                }); })().finally(function () {
                    _this.nativePriceInflight.delete(chainId);
                });
                this.nativePriceInflight.set(chainId, promise);
                return [2 /*return*/, promise];
            });
        });
    };
    /**
     * 批量预热 Native 价格
     */
    DataCacheHub.prototype.warmupNativePrices = function (chainIds, fetchFn) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.CACHE_HIT, "\uD83D\uDD25 Warming up native prices for ".concat(chainIds.length, " chains"), { chainIds: chainIds });
                        return [4 /*yield*/, Promise.allSettled(chainIds.map(function (chainId) { return __awaiter(_this, void 0, void 0, function () {
                                var price, err_2;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, fetchFn(chainId)];
                                        case 1:
                                            price = _a.sent();
                                            if (price > 0) {
                                                this.nativePriceCache.set(chainId, { price: price, timestamp: Date.now() });
                                            }
                                            return [3 /*break*/, 3];
                                        case 2:
                                            err_2 = _a.sent();
                                            logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_MISS, 'Warmup failed for native price', { chainId: chainId });
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // ==================== User Settings 缓存 ====================
    /**
     * 获取用户设置
     */
    DataCacheHub.prototype.getUserSettings = function (userId, fetchFn) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cached = this.userSettingsCache.get(userId);
                        if (cached && Date.now() - cached.timestamp < this.USER_SETTINGS_TTL) {
                            return [2 /*return*/, cached.settings];
                        }
                        return [4 /*yield*/, fetchFn()];
                    case 1:
                        settings = _a.sent();
                        if (settings) {
                            this.userSettingsCache.set(userId, { settings: settings, timestamp: Date.now() });
                        }
                        return [2 /*return*/, settings];
                }
            });
        });
    };
    /**
     * 批量预热用户设置
     */
    DataCacheHub.prototype.warmupUserSettings = function (userIds, fetchFn) {
        return __awaiter(this, void 0, void 0, function () {
            var settingsMap;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.CACHE_HIT, "\uD83D\uDD25 Warming up ".concat(userIds.length, " user settings"), { count: userIds.length });
                        settingsMap = new Map();
                        return [4 /*yield*/, Promise.allSettled(userIds.map(function (userId) { return __awaiter(_this, void 0, void 0, function () {
                                var settings, err_3;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, fetchFn(userId)];
                                        case 1:
                                            settings = _a.sent();
                                            if (settings) {
                                                this.userSettingsCache.set(userId, { settings: settings, timestamp: Date.now() });
                                                settingsMap.set(userId, settings);
                                            }
                                            return [3 /*break*/, 3];
                                        case 2:
                                            err_3 = _a.sent();
                                            logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_MISS, 'Warmup failed for user settings', { userId: userId });
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, settingsMap];
                }
            });
        });
    };
    // ==================== Copy Trade Config 缓存 ====================
    /**
     * 获取 Copy Trade 配置
     */
    DataCacheHub.prototype.getCopyTradeConfigs = function (targetWallet, chainId, fetchFn) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey, cached, configs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = "".concat(targetWallet.toLowerCase(), ":").concat(chainId);
                        cached = this.configCache.get(cacheKey);
                        if (cached && Date.now() - cached.timestamp < this.CONFIG_CACHE_TTL) {
                            logger_js_1.logger.debug(logRegistry_js_1.LogCode.CACHE_HIT, 'Config cache hit', { wallet: targetWallet, count: cached.configs.length });
                            return [2 /*return*/, cached.configs];
                        }
                        return [4 /*yield*/, fetchFn()];
                    case 1:
                        configs = _a.sent();
                        if (configs) {
                            this.configCache.set(cacheKey, { configs: configs, timestamp: Date.now() });
                        }
                        return [2 /*return*/, configs];
                }
            });
        });
    };
    // ==================== 缓存管理 ====================
    /**
     * 清除特定 Token 缓存
     */
    DataCacheHub.prototype.invalidateToken = function (tokenAddress, chainId) {
        var cacheKey = "".concat(chainId, ":").concat(tokenAddress.toLowerCase());
        this.tokenCache.delete(cacheKey);
        this.emit('tokenInvalidated', { chainId: chainId, tokenAddress: tokenAddress });
    };
    /**
     * 清除所有缓存
     */
    DataCacheHub.prototype.clearAll = function () {
        this.tokenCache.clear();
        this.nativePriceCache.clear();
        this.tokenInflight.clear();
        this.nativePriceInflight.clear();
        this.tokenPriceSnapshotCache.clear();
        this.userSettingsCache.clear();
        this.configCache.clear();
        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_STARTUP, 'All caches cleared');
    };
    /**
     * 获取缓存统计
     */
    DataCacheHub.prototype.getStats = function () {
        return {
            tokens: {
                size: this.tokenCache.size,
                max: this.tokenCache.max,
            },
            tokenPriceSnapshots: {
                size: this.tokenPriceSnapshotCache.size,
                max: this.tokenPriceSnapshotCache.max,
            },
            nativePrices: this.nativePriceCache.size,
            userSettings: {
                size: this.userSettingsCache.size,
                max: this.userSettingsCache.max,
            },
            configs: {
                size: this.configCache.size,
                max: this.configCache.max,
            }
        };
    };
    /**
     * 启动定时清理
     */
    DataCacheHub.prototype.startCleanupTimer = function () {
        var _this = this;
        setInterval(function () {
            var now = Date.now();
            // 清理过期的 Native Price
            for (var _i = 0, _a = _this.nativePriceCache.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], chainId = _b[0], data = _b[1];
                if (now - data.timestamp > _this.NATIVE_PRICE_TTL) {
                    _this.nativePriceCache.delete(chainId);
                }
            }
            // LRU Cache 会自动清理，这里只记录统计
            var stats = _this.getStats();
            if (stats.tokens.size > 0 || stats.nativePrices > 0) {
                logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_STARTUP, 'Cache stats', stats);
            }
        }, 60 * 1000); // 每分钟清理一次
    };
    return DataCacheHub;
}(events_1.EventEmitter));
// 导出单例
exports.cacheHub = DataCacheHub.getInstance();
