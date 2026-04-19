"use strict";
/**
 * Gecko Terminal API Service (Enhanced)
 * Documentation: https://docs.geckoterminal.com/
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchTokens = searchTokens;
exports.getTokenDetails = getTokenDetails;
exports.getTrendingTokens = getTrendingTokens;
exports.getPoolsByDex = getPoolsByDex;
exports.getCandlestickData = getCandlestickData;
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var ethers_1 = require("ethers");
var GECKO_TERMINAL_BASE_URL = 'https://api.geckoterminal.com/api/v2';
var unifiedApiService_js_1 = require("../config/unifiedApiService.js");
var GeckoTerminalError = /** @class */ (function (_super) {
    __extends(GeckoTerminalError, _super);
    function GeckoTerminalError(message, type, code, data) {
        var _this = _super.call(this, message) || this;
        _this.message = message;
        _this.type = type;
        _this.code = code;
        _this.data = data;
        _this.name = 'GeckoTerminalError';
        return _this;
    }
    return GeckoTerminalError;
}(Error));
/**
 * Chain to Trust Wallet blockchain name mapping
 * Used to construct fallback image URLs from Trust Wallet assets
 */
var CHAIN_TO_TRUSTWALLET = {
    'eth': 'ethereum',
    'ethereum': 'ethereum',
    'bsc': 'smartchain',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'polygon': 'polygon',
    'optimism': 'optimism',
    'avalanche': 'avalanche',
};
/**
 * Get fallback image URL from Trust Wallet assets
 * Format: https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{address}/logo.png
 */
function getTrustWalletImageUrl(network, address) {
    var twChain = CHAIN_TO_TRUSTWALLET[network.toLowerCase()];
    if (!twChain || !address)
        return undefined;
    var evmChains = new Set(['eth', 'ethereum', 'bsc', 'base', 'arbitrum', 'polygon', 'optimism', 'avalanche']);
    var normalizedAddress = address;
    if (evmChains.has(network.toLowerCase())) {
        try {
            normalizedAddress = (0, ethers_1.getAddress)(address);
        }
        catch (_a) {
            normalizedAddress = address;
        }
    }
    return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/".concat(twChain, "/assets/").concat(normalizedAddress, "/logo.png");
}
function normalizeImageUrl(url) {
    if (!url)
        return undefined;
    var trimmed = url.trim();
    if (!trimmed)
        return undefined;
    if (trimmed.startsWith('ipfs://')) {
        return "https://ipfs.io/ipfs/".concat(trimmed.slice('ipfs://'.length));
    }
    if (trimmed.startsWith('//')) {
        return "https:".concat(trimmed);
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    return undefined;
}
/**
 * Search for tokens
 * Gecko Terminal search endpoint returns pools, we extract unique tokens from pools
 */
function searchTokens(query, network) {
    return __awaiter(this, void 0, void 0, function () {
        var endpoint, data, tokenMap, _i, _a, item, attributes, baseToken, quoteToken, tokenAddress, existing, currentLiquidity, existingLiquidity, priceChange, priceChange5m, priceChange1h, priceChange6h, priceChange24h, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    endpoint = "/search/pools?query=".concat(encodeURIComponent(query));
                    return [4 /*yield*/, (0, unifiedApiService_js_1.callGeckoTerminal)(endpoint)];
                case 1:
                    data = _c.sent();
                    if (!data.data || !Array.isArray(data.data)) {
                        return [2 /*return*/, []];
                    }
                    tokenMap = new Map();
                    for (_i = 0, _a = data.data; _i < _a.length; _i++) {
                        item = _a[_i];
                        attributes = item.attributes || {};
                        baseToken = attributes.base_token || {};
                        quoteToken = attributes.quote_token || {};
                        tokenAddress = baseToken.address;
                        if (!tokenAddress)
                            continue;
                        // Skip if already added (prefer pools with higher liquidity)
                        if (tokenMap.has(tokenAddress.toLowerCase())) {
                            existing = tokenMap.get(tokenAddress.toLowerCase());
                            currentLiquidity = attributes.reserve_in_usd || 0;
                            existingLiquidity = existing.liquidity || 0;
                            // Keep the one with higher liquidity
                            if (currentLiquidity <= existingLiquidity)
                                continue;
                        }
                        priceChange = attributes.price_change_percentage || {};
                        priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
                            ? parseFloat(String(priceChange.m5))
                            : undefined;
                        priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
                            ? parseFloat(String(priceChange.h1))
                            : undefined;
                        priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
                            ? parseFloat(String(priceChange.h6))
                            : undefined;
                        priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
                            ? parseFloat(String(priceChange.h24))
                            : undefined;
                        tokenMap.set(tokenAddress.toLowerCase(), {
                            address: tokenAddress,
                            name: baseToken.name || '',
                            symbol: baseToken.symbol || '',
                            network: attributes.network || network || '',
                            price: attributes.base_token_price_usd,
                            priceChange5m: priceChange5m,
                            priceChange1h: priceChange1h,
                            priceChange6h: priceChange6h,
                            priceChange24h: priceChange24h,
                            volume24h: (_b = attributes.volume_usd) === null || _b === void 0 ? void 0 : _b.h24,
                            liquidity: attributes.reserve_in_usd,
                            fdv: attributes.fdv_usd,
                        });
                    }
                    return [2 /*return*/, Array.from(tokenMap.values())];
                case 2:
                    error_1 = _c.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error searching tokens on GeckoTerminal', {
                        query: query,
                        error: error_1.message
                    });
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Simple in-memory cache to prevent redundant API calls (1 min TTL)
var tokenCache = new Map();
var CACHE_TTL_MS = 60 * 1000;
/**
 * Get token details by address
 * First try to get token info, then get pool data for price/volume
 */
function getTokenDetails(network_1, address_1) {
    return __awaiter(this, arguments, void 0, function (network, address, priority) {
        var startTime, cacheKey, cached, networkMap, geckoNetwork, isSolana, poolsEndpoint, poolsData, included, pools, bestPool, attributes, poolId, relationships, baseTokenRelData, quoteTokenRelData, isBaseToken, isQuoteToken, targetTokenId_1, tokenMeta, poolAddress, parts, priceChange, priceChange5m, priceChange1h, priceChange6h, priceChange24h, tokenPrice, duration, parseNumber, result, error_2, duration;
        var _a, _b, _c, _d, _e, _f;
        if (priority === void 0) { priority = 'normal'; }
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    startTime = Date.now();
                    cacheKey = "".concat(network, ":").concat(address.toLowerCase());
                    // Check cache
                    if (tokenCache.has(cacheKey)) {
                        cached = tokenCache.get(cacheKey);
                        if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
                            // console.log(`[GeckoTerminal] Cache hit for ${address}`); // Optional debug
                            return [2 /*return*/, cached.data];
                        }
                    }
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, , 4]);
                    networkMap = {
                        'sol': 'solana',
                        'solana': 'solana',
                        'eth': 'eth',
                        'ethereum': 'eth',
                        'bsc': 'bsc',
                        'base': 'base',
                        'arbitrum': 'arbitrum',
                        'optimism': 'optimism',
                        'polygon': 'polygon',
                        'avax': 'avalanche',
                        'avalanche': 'avalanche',
                        'fantom': 'fantom',
                    };
                    geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();
                    isSolana = geckoNetwork === 'solana' || network.toLowerCase() === 'sol';
                    if (isSolana) {
                        // Validate Solana address format (base58, typically 32-44 chars)
                        if (!address || address.length < 32 || address.length > 44) {
                        }
                    }
                    poolsEndpoint = "/networks/".concat(geckoNetwork, "/tokens/").concat(address, "/pools?include=base_token,quote_token");
                    return [4 /*yield*/, (0, unifiedApiService_js_1.callGeckoTerminal)(poolsEndpoint, {
                            headers: { 'Accept': 'application/json' },
                        }, undefined, priority)];
                case 2:
                    poolsData = _g.sent();
                    if (!poolsData.data || !Array.isArray(poolsData.data) || poolsData.data.length === 0) {
                        return [2 /*return*/, null];
                    }
                    included = poolsData.included || [];
                    pools = poolsData.data.sort(function (a, b) {
                        var _a, _b;
                        var liquidityA = ((_a = a.attributes) === null || _a === void 0 ? void 0 : _a.reserve_in_usd) || 0;
                        var liquidityB = ((_b = b.attributes) === null || _b === void 0 ? void 0 : _b.reserve_in_usd) || 0;
                        return liquidityB - liquidityA;
                    });
                    bestPool = pools[0];
                    attributes = bestPool.attributes || {};
                    poolId = bestPool.id;
                    relationships = bestPool.relationships || {};
                    baseTokenRelData = (_a = relationships.base_token) === null || _a === void 0 ? void 0 : _a.data;
                    quoteTokenRelData = (_b = relationships.quote_token) === null || _b === void 0 ? void 0 : _b.data;
                    isBaseToken = (_c = baseTokenRelData === null || baseTokenRelData === void 0 ? void 0 : baseTokenRelData.id) === null || _c === void 0 ? void 0 : _c.toLowerCase().endsWith(address.toLowerCase());
                    isQuoteToken = (_d = quoteTokenRelData === null || quoteTokenRelData === void 0 ? void 0 : quoteTokenRelData.id) === null || _d === void 0 ? void 0 : _d.toLowerCase().endsWith(address.toLowerCase());
                    targetTokenId_1 = isBaseToken ? baseTokenRelData === null || baseTokenRelData === void 0 ? void 0 : baseTokenRelData.id : quoteTokenRelData === null || quoteTokenRelData === void 0 ? void 0 : quoteTokenRelData.id;
                    tokenMeta = ((_e = included.find(function (item) { return item.id === targetTokenId_1; })) === null || _e === void 0 ? void 0 : _e.attributes) || {};
                    poolAddress = void 0;
                    if (attributes.address) {
                        poolAddress = attributes.address;
                    }
                    else if (poolId && poolId.includes('_')) {
                        parts = poolId.split('_');
                        if (parts.length >= 2) {
                            // For Solana, the address is everything after the first underscore
                            // For other networks, it might be different
                            poolAddress = parts.slice(1).join('_');
                            // For Solana, validate the extracted address format
                            if (isSolana && poolAddress) {
                                if (poolAddress.length < 32 || poolAddress.length > 44) {
                                }
                            }
                        }
                    }
                    else if (poolId) {
                        // Some networks might use poolId directly as address
                        poolAddress = poolId;
                    }
                    else {
                    }
                    priceChange = attributes.price_change_percentage || {};
                    priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
                        ? parseFloat(String(priceChange.m5))
                        : undefined;
                    priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
                        ? parseFloat(String(priceChange.h1))
                        : undefined;
                    priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
                        ? parseFloat(String(priceChange.h6))
                        : undefined;
                    priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
                        ? parseFloat(String(priceChange.h24))
                        : undefined;
                    tokenPrice = void 0;
                    // Priority 1: token_price_usd (always correct for the queried token)
                    if (attributes.token_price_usd !== undefined && attributes.token_price_usd !== null) {
                        tokenPrice = parseFloat(String(attributes.token_price_usd));
                    }
                    // Priority 2: Check if queried token is quote token
                    else if (isQuoteToken && attributes.quote_token_price_usd !== undefined && attributes.quote_token_price_usd !== null) {
                        tokenPrice = parseFloat(String(attributes.quote_token_price_usd));
                    }
                    // Priority 3: Check if queried token is base token
                    else if (isBaseToken && attributes.base_token_price_usd !== undefined && attributes.base_token_price_usd !== null) {
                        tokenPrice = parseFloat(String(attributes.base_token_price_usd));
                    }
                    // Priority 4: Fallback to quote_token_price_usd (for stablecoins like USDC)
                    else if (attributes.quote_token_price_usd !== undefined && attributes.quote_token_price_usd !== null) {
                        tokenPrice = parseFloat(String(attributes.quote_token_price_usd));
                    }
                    // Priority 5: Last resort - base_token_price_usd (may be wrong)
                    else if (attributes.base_token_price_usd !== undefined && attributes.base_token_price_usd !== null) {
                        tokenPrice = parseFloat(String(attributes.base_token_price_usd));
                    }
                    else {
                    }
                    duration = Date.now() - startTime;
                    parseNumber = function (val) {
                        if (val === null || val === undefined)
                            return undefined;
                        var num = parseFloat(String(val));
                        return isNaN(num) ? undefined : num;
                    };
                    result = {
                        address: address,
                        name: tokenMeta.name || '',
                        symbol: tokenMeta.symbol || '',
                        network: network, // Keep original network name for consistency
                        poolAddress: poolAddress,
                        poolId: poolId,
                        price: tokenPrice,
                        priceChange5m: priceChange5m,
                        priceChange1h: priceChange1h,
                        priceChange6h: priceChange6h,
                        priceChange24h: priceChange24h,
                        volume24h: parseNumber((_f = attributes.volume_usd) === null || _f === void 0 ? void 0 : _f.h24),
                        liquidity: parseNumber(attributes.reserve_in_usd),
                        fdv: parseNumber(attributes.fdv_usd),
                    };
                    // Update cache
                    tokenCache.set(cacheKey, { data: result, timestamp: Date.now() });
                    return [2 /*return*/, result];
                case 3:
                    error_2 = _g.sent();
                    duration = Date.now() - startTime;
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Minimum liquidity threshold to filter out spam/fake tokens
 * Tokens with less than $10,000 liquidity are likely spam or manipulation
 */
var MIN_LIQUIDITY_USD = 10000;
/**
 * Get trending tokens for a network
 * Uses GeckoTerminal's trending_pools endpoint for quality data
 * Filters out low-liquidity tokens to avoid spam/manipulation
 *
 * @param network - Network identifier (eth, base, bsc, arbitrum, etc.)
 * @param limit - Maximum number of tokens to return
 * @param duration - Trending duration: '5m', '1h', '6h', '24h' (default: '24h')
 */
function getTrendingTokens() {
    return __awaiter(this, arguments, void 0, function (network, limit, duration, minLiquidityUsd, maxPages) {
        var networkMap, geckoNetwork, tokenMap, page, endpoint, data, tokenMapById, _i, _a, includedItem, _b, _c, item, attributes, relationships, baseToken, baseTokenId, tokenAddress, liquidity, existing, existingLiquidity, priceChange, priceChange5m, priceChange1h, priceChange6h, priceChange24h, imageUrl, txns, buys24h, sells24h, txns24h, tokens, result, error_3;
        var _d, _e, _f, _g, _h, _j;
        if (network === void 0) { network = 'eth'; }
        if (limit === void 0) { limit = 50; }
        if (duration === void 0) { duration = '24h'; }
        if (minLiquidityUsd === void 0) { minLiquidityUsd = MIN_LIQUIDITY_USD; }
        if (maxPages === void 0) { maxPages = 5; }
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    _k.trys.push([0, 6, , 7]);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Fetching trending tokens', { network: network, limit: limit, duration: duration, minLiquidityUsd: minLiquidityUsd });
                    networkMap = {
                        'eth': 'eth',
                        'ethereum': 'eth',
                        'bsc': 'bsc',
                        'solana': 'solana',
                        'base': 'base',
                        'arbitrum': 'arbitrum',
                        'optimism': 'optimism',
                        'polygon': 'polygon',
                        'avax': 'avalanche',
                        'avalanche': 'avalanche',
                    };
                    geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();
                    tokenMap = new Map();
                    page = 1;
                    _k.label = 1;
                case 1:
                    if (!(page <= maxPages && tokenMap.size < limit)) return [3 /*break*/, 5];
                    endpoint = "/networks/".concat(geckoNetwork, "/trending_pools?page=").concat(page, "&include=base_token&duration=").concat(duration);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Requesting trending page", { page: page, duration: duration, endpoint: endpoint });
                    return [4 /*yield*/, (0, unifiedApiService_js_1.callGeckoTerminal)(endpoint)];
                case 2:
                    data = _k.sent();
                    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "No more pools on page", { page: page });
                        return [3 /*break*/, 5]; // No more data
                    }
                    tokenMapById = new Map();
                    if (data.included && Array.isArray(data.included)) {
                        for (_i = 0, _a = data.included; _i < _a.length; _i++) {
                            includedItem = _a[_i];
                            if (includedItem.type === 'token' && includedItem.id) {
                                tokenMapById.set(includedItem.id, includedItem.attributes || {});
                            }
                        }
                    }
                    // Process pools from this page
                    for (_b = 0, _c = data.data; _b < _c.length; _b++) {
                        item = _c[_b];
                        if (tokenMap.size >= limit)
                            break; // We have enough tokens
                        attributes = item.attributes || {};
                        relationships = item.relationships || {};
                        baseToken = null;
                        if ((_e = (_d = relationships.base_token) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.id) {
                            baseTokenId = relationships.base_token.data.id;
                            baseToken = tokenMapById.get(baseTokenId);
                            if (!baseToken)
                                continue;
                        }
                        else {
                            continue;
                        }
                        tokenAddress = baseToken.address;
                        if (!tokenAddress)
                            continue;
                        liquidity = parseFloat(attributes.reserve_in_usd) || 0;
                        if (liquidity < minLiquidityUsd) {
                            logger_js_1.logger.throttled(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Skipping low liquidity token", { symbol: baseToken.symbol, liquidity: liquidity });
                            continue;
                        }
                        // Skip if already added (prefer pools with higher liquidity for same token)
                        if (tokenMap.has(tokenAddress.toLowerCase())) {
                            existing = tokenMap.get(tokenAddress.toLowerCase());
                            existingLiquidity = existing.liquidity || 0;
                            // Keep the one with higher liquidity
                            if (liquidity <= existingLiquidity)
                                continue;
                        }
                        priceChange = attributes.price_change_percentage || {};
                        priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
                            ? parseFloat(String(priceChange.m5))
                            : undefined;
                        priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
                            ? parseFloat(String(priceChange.h1))
                            : undefined;
                        priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
                            ? parseFloat(String(priceChange.h6))
                            : undefined;
                        priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
                            ? parseFloat(String(priceChange.h24))
                            : undefined;
                        imageUrl = normalizeImageUrl(baseToken.image_url) || getTrustWalletImageUrl(geckoNetwork, tokenAddress);
                        txns = attributes.transactions || {};
                        buys24h = ((_f = txns.h24) === null || _f === void 0 ? void 0 : _f.buys) || 0;
                        sells24h = ((_g = txns.h24) === null || _g === void 0 ? void 0 : _g.sells) || 0;
                        txns24h = buys24h + sells24h;
                        tokenMap.set(tokenAddress.toLowerCase(), {
                            address: tokenAddress,
                            name: baseToken.name || '',
                            symbol: baseToken.symbol || '',
                            network: geckoNetwork,
                            imageUrl: imageUrl,
                            poolAddress: attributes.address || (((_h = item.id) === null || _h === void 0 ? void 0 : _h.includes('_')) ? item.id.split('_').slice(1).join('_') : item.id),
                            poolId: item.id,
                            poolCreatedAt: attributes.pool_created_at,
                            price: attributes.base_token_price_usd,
                            priceChange5m: priceChange5m,
                            priceChange1h: priceChange1h,
                            priceChange6h: priceChange6h,
                            priceChange24h: priceChange24h,
                            volume24h: (_j = attributes.volume_usd) === null || _j === void 0 ? void 0 : _j.h24,
                            txns24h: txns24h,
                            buys24h: buys24h,
                            sells24h: sells24h,
                            liquidity: attributes.reserve_in_usd,
                            fdv: attributes.fdv_usd,
                        });
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Processed page", { page: page, poolCount: data.data.length, uniqueTokensSoFar: tokenMap.size });
                    if (!(page < maxPages && tokenMap.size < limit)) return [3 /*break*/, 4];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200); })];
                case 3:
                    _k.sent();
                    _k.label = 4;
                case 4:
                    page++;
                    return [3 /*break*/, 1];
                case 5:
                    tokens = Array.from(tokenMap.values());
                    result = tokens.slice(0, limit);
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Trending tokens fetch complete", {
                        network: network,
                        count: result.length,
                        limit: limit
                    });
                    return [2 /*return*/, result];
                case 6:
                    error_3 = _k.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching trending tokens', {
                        network: network,
                        error: error_3.message
                    });
                    // Security: Stack trace logging removed in production
                    return [2 /*return*/, []];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * DEX ID mapping for different chains
 * Used to construct the correct DEX ID for GeckoTerminal API
 */
var DEX_ID_MAP = {
    'base': {
        'uniswap': 'uniswap-v3-base',
        'uniswap_v3': 'uniswap-v3-base',
        'uniswap-v3': 'uniswap-v3-base',
        'aerodrome': 'aerodrome-base',
        'pancakeswap': 'pancakeswap-v3-base',
    },
    'eth': {
        'uniswap': 'uniswap_v3',
        'uniswap_v3': 'uniswap_v3',
        'uniswap-v3': 'uniswap_v3',
        'sushiswap': 'sushiswap',
    },
    'arbitrum': {
        'uniswap': 'uniswap-v3-arbitrum',
        'uniswap_v3': 'uniswap-v3-arbitrum',
        'uniswap-v3': 'uniswap-v3-arbitrum',
        'camelot': 'camelot-v3',
    },
    'solana': {
        'raydium': 'raydium',
        'orca': 'orca',
        'meteora': 'meteora',
    },
    'bsc': {
        'pancakeswap': 'pancakeswap-v3-bsc',
        'uniswap': 'uniswap-v3-bsc',
    },
};
/**
 * Get pools for a specific DEX on a network
 * Uses GeckoTerminal's /networks/{network}/dexes/{dex}/pools endpoint
 *
 * @param network - Network identifier (eth, base, bsc, arbitrum, solana)
 * @param dex - DEX identifier (uniswap, pancakeswap, raydium, etc.)
 * @param limit - Maximum number of tokens to return
 * @param sortBy - Sort option: 'h24_volume_usd_desc' or 'h24_tx_count_desc'
 */
function getPoolsByDex() {
    return __awaiter(this, arguments, void 0, function (network, dex, limit, sortBy) {
        var networkMap, geckoNetwork, dexLower, networkDexMap, dexId, tokenMap, maxPages, page, url, data, e_1, tokenMapById, _i, _a, includedItem, _b, _c, item, attributes, relationships, baseToken, baseTokenId, tokenAddress, liquidity, existing, existingLiquidity, priceChange, priceChange5m, priceChange1h, priceChange6h, priceChange24h, imageUrl, txns, buys24h, sells24h, txns24h, tokens, error_4;
        var _d, _e, _f, _g, _h;
        if (network === void 0) { network = 'base'; }
        if (dex === void 0) { dex = 'uniswap'; }
        if (limit === void 0) { limit = 50; }
        if (sortBy === void 0) { sortBy = 'h24_volume_usd_desc'; }
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 9, , 10]);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Fetching pools by DEX', { dex: dex, network: network, limit: limit });
                    networkMap = {
                        'eth': 'eth',
                        'ethereum': 'eth',
                        'bsc': 'bsc',
                        'solana': 'solana',
                        'base': 'base',
                        'arbitrum': 'arbitrum',
                        'optimism': 'optimism',
                        'polygon': 'polygon',
                        'avax': 'avalanche',
                        'avalanche': 'avalanche',
                    };
                    geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();
                    dexLower = dex.toLowerCase();
                    networkDexMap = DEX_ID_MAP[geckoNetwork] || {};
                    dexId = networkDexMap[dexLower] || dexLower;
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Using DEX ID for network", { dexId: dexId, geckoNetwork: geckoNetwork });
                    tokenMap = new Map();
                    maxPages = 3;
                    page = 1;
                    _j.label = 1;
                case 1:
                    if (!(page <= maxPages && tokenMap.size < limit)) return [3 /*break*/, 8];
                    url = "".concat(GECKO_TERMINAL_BASE_URL, "/networks/").concat(geckoNetwork, "/dexes/").concat(dexId, "/pools?page=").concat(page, "&include=base_token&sort=").concat(sortBy);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Requesting DEX pools page", { page: page, url: url });
                    data = void 0;
                    _j.label = 2;
                case 2:
                    _j.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({ url: url })];
                case 3:
                    data = _j.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _j.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, "API error on DEX pools page", { page: page, error: e_1.message });
                    return [3 /*break*/, 8];
                case 5:
                    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "No more DEX pools on page", { page: page });
                        return [3 /*break*/, 8];
                    }
                    tokenMapById = new Map();
                    if (data.included && Array.isArray(data.included)) {
                        for (_i = 0, _a = data.included; _i < _a.length; _i++) {
                            includedItem = _a[_i];
                            if (includedItem.type === 'token' && includedItem.id) {
                                tokenMapById.set(includedItem.id, includedItem.attributes || {});
                            }
                        }
                    }
                    // Process pools from this page
                    for (_b = 0, _c = data.data; _b < _c.length; _b++) {
                        item = _c[_b];
                        if (tokenMap.size >= limit)
                            break;
                        attributes = item.attributes || {};
                        relationships = item.relationships || {};
                        baseToken = null;
                        if ((_e = (_d = relationships.base_token) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.id) {
                            baseTokenId = relationships.base_token.data.id;
                            baseToken = tokenMapById.get(baseTokenId);
                            if (!baseToken)
                                continue;
                        }
                        else {
                            continue;
                        }
                        tokenAddress = baseToken.address;
                        if (!tokenAddress)
                            continue;
                        liquidity = parseFloat(attributes.reserve_in_usd) || 0;
                        if (liquidity < MIN_LIQUIDITY_USD) {
                            continue;
                        }
                        // Skip if already added (prefer pools with higher liquidity)
                        if (tokenMap.has(tokenAddress.toLowerCase())) {
                            existing = tokenMap.get(tokenAddress.toLowerCase());
                            existingLiquidity = existing.liquidity || 0;
                            if (liquidity <= existingLiquidity)
                                continue;
                        }
                        priceChange = attributes.price_change_percentage || {};
                        priceChange5m = priceChange.m5 !== undefined && priceChange.m5 !== null
                            ? parseFloat(String(priceChange.m5))
                            : undefined;
                        priceChange1h = priceChange.h1 !== undefined && priceChange.h1 !== null
                            ? parseFloat(String(priceChange.h1))
                            : undefined;
                        priceChange6h = priceChange.h6 !== undefined && priceChange.h6 !== null
                            ? parseFloat(String(priceChange.h6))
                            : undefined;
                        priceChange24h = priceChange.h24 !== undefined && priceChange.h24 !== null
                            ? parseFloat(String(priceChange.h24))
                            : undefined;
                        imageUrl = normalizeImageUrl(baseToken.image_url) || getTrustWalletImageUrl(geckoNetwork, tokenAddress);
                        txns = attributes.transactions || {};
                        buys24h = ((_f = txns.h24) === null || _f === void 0 ? void 0 : _f.buys) || 0;
                        sells24h = ((_g = txns.h24) === null || _g === void 0 ? void 0 : _g.sells) || 0;
                        txns24h = buys24h + sells24h;
                        tokenMap.set(tokenAddress.toLowerCase(), {
                            address: tokenAddress,
                            name: baseToken.name || '',
                            symbol: baseToken.symbol || '',
                            network: geckoNetwork,
                            imageUrl: imageUrl,
                            poolCreatedAt: attributes.pool_created_at,
                            price: attributes.base_token_price_usd,
                            priceChange5m: priceChange5m,
                            priceChange1h: priceChange1h,
                            priceChange6h: priceChange6h,
                            priceChange24h: priceChange24h,
                            volume24h: (_h = attributes.volume_usd) === null || _h === void 0 ? void 0 : _h.h24,
                            txns24h: txns24h,
                            buys24h: buys24h,
                            sells24h: sells24h,
                            liquidity: attributes.reserve_in_usd,
                            fdv: attributes.fdv_usd,
                        });
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "DEX pools processed page", { page: page, poolCount: data.data.length, uniqueTokensSoFar: tokenMap.size });
                    if (!(page < maxPages && tokenMap.size < limit)) return [3 /*break*/, 7];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200); })];
                case 6:
                    _j.sent();
                    _j.label = 7;
                case 7:
                    page++;
                    return [3 /*break*/, 1];
                case 8:
                    tokens = Array.from(tokenMap.values());
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'DEX tokens fetch complete', {
                        network: network,
                        dex: dex,
                        count: tokens.length
                    });
                    return [2 /*return*/, tokens.slice(0, limit)];
                case 9:
                    error_4 = _j.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching pools by DEX', {
                        network: network,
                        dex: dex,
                        error: error_4.message
                    });
                    return [2 /*return*/, []];
                case 10: return [2 /*return*/];
            }
        });
    });
}
/**
 * Aggregate candles to a different timeframe
 * e.g., aggregate minute candles to 5-minute or 15-minute candles
 */
function aggregateCandles(candles, targetTimeframe, sourceTimeframe) {
    if (candles.length === 0) {
        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Empty input candles array for aggregation");
        return [];
    }
    // Calculate aggregation ratio
    var timeframeSeconds = {
        'm1': 60, 'm5': 300, 'm15': 900, 'm30': 1800,
        'h1': 3600, 'h4': 14400, 'h6': 21600, 'h12': 43200,
        'd1': 86400, '24h': 86400,
    };
    var sourceSeconds = {
        'minute': 60, 'hour': 3600, 'day': 86400,
    };
    var targetSeconds = timeframeSeconds[targetTimeframe] || 3600;
    var sourceIntervalSeconds = sourceSeconds[sourceTimeframe] || 3600;
    var ratio = Math.floor(targetSeconds / sourceIntervalSeconds);
    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Aggregating candles", {
        count: candles.length,
        from: sourceTimeframe,
        to: targetTimeframe,
        ratio: ratio
    });
    if (ratio <= 1) {
        // No aggregation needed, but still return a copy
        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "No aggregation needed", { count: candles.length });
        return __spreadArray([], candles, true);
    }
    var aggregated = [];
    var grouped = new Map();
    // Validate and normalize input candles first
    var validCandles = candles
        .filter(function (c) {
        if (!c || typeof c.time === 'undefined') {
            return false;
        }
        var candleTime = typeof c.time === 'number' ? c.time : new Date(c.time).getTime() / 1000;
        if (isNaN(candleTime) || !isFinite(candleTime)) {
            return false;
        }
        if (typeof c.open === 'undefined' || typeof c.high === 'undefined' ||
            typeof c.low === 'undefined' || typeof c.close === 'undefined') {
            return false;
        }
        return isFinite(c.open) && isFinite(c.high) && isFinite(c.low) && isFinite(c.close) &&
            c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0;
    })
        .map(function (c) { return ({
        time: typeof c.time === 'number' ? Math.floor(c.time) : Math.floor(new Date(c.time).getTime() / 1000),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: (c.volume !== undefined && c.volume !== null && isFinite(c.volume)) ? Number(c.volume) : 0,
    }); })
        .sort(function (a, b) { return a.time - b.time; }); // Sort by time first
    if (validCandles.length === 0) {
        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "No valid candles found after pre-aggregation validation");
        return [];
    }
    // Group candles by target interval with proper alignment
    // For example, 5-minute candles should align to :00, :05, :10, :15, etc.
    for (var _i = 0, validCandles_1 = validCandles; _i < validCandles_1.length; _i++) {
        var candle = validCandles_1[_i];
        // Calculate aligned group time
        var groupTime = void 0;
        if (targetSeconds < 3600) {
            // Minute-based: align to minute boundaries (e.g., 5min -> 00:00, 00:05, 00:10)
            var candleDate = new Date(candle.time * 1000);
            var minutes = candleDate.getUTCMinutes();
            var alignedMinutes = Math.floor(minutes / (targetSeconds / 60)) * (targetSeconds / 60);
            candleDate.setUTCMinutes(alignedMinutes, 0, 0);
            groupTime = Math.floor(candleDate.getTime() / 1000);
        }
        else if (targetSeconds < 86400) {
            // Hour-based: align to hour boundaries (e.g., 4h -> 00:00, 04:00, 08:00)
            var candleDate = new Date(candle.time * 1000);
            var hours = candleDate.getUTCHours();
            var alignedHours = Math.floor(hours / (targetSeconds / 3600)) * (targetSeconds / 3600);
            candleDate.setUTCHours(alignedHours, 0, 0, 0);
            groupTime = Math.floor(candleDate.getTime() / 1000);
        }
        else {
            // Day-based: align to day boundaries (00:00:00 UTC)
            var candleDate = new Date(candle.time * 1000);
            candleDate.setUTCHours(0, 0, 0, 0);
            groupTime = Math.floor(candleDate.getTime() / 1000);
        }
        if (!grouped.has(groupTime)) {
            grouped.set(groupTime, []);
        }
        grouped.get(groupTime).push(candle);
    }
    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Grouped valid candles into time groups", { sourceCount: validCandles.length, groupCount: grouped.size });
    // Aggregate each group with improved precision
    for (var _a = 0, _b = Array.from(grouped.entries()).sort(function (a, b) { return a[0] - b[0]; }); _a < _b.length; _a++) {
        var _c = _b[_a], groupTime = _c[0], groupCandles = _c[1];
        if (groupCandles.length === 0)
            continue;
        // Sort candles within group by time (should already be sorted, but ensure it)
        var sorted = groupCandles.sort(function (a, b) { return a.time - b.time; });
        // Use first candle's open and last candle's close
        var open_1 = sorted[0].open;
        var close_1 = sorted[sorted.length - 1].close;
        // High and low from all candles in the group (more accurate)
        var high = sorted[0].high;
        var low = sorted[0].low;
        var volume = 0;
        for (var _d = 0, sorted_1 = sorted; _d < sorted_1.length; _d++) {
            var candle = sorted_1[_d];
            // High is the maximum high across all candles
            if (candle.high > high) {
                high = candle.high;
            }
            // Low is the minimum low across all candles
            if (candle.low < low) {
                low = candle.low;
            }
            // Volume is the sum of all volumes
            volume += candle.volume || 0;
        }
        // Final validation: ensure high >= low
        if (high < low) {
            logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, "Invalid OHLC values detected", { time: groupTime, high: high, low: low });
            high = Math.max(high, Math.max(open_1, close_1));
            low = Math.min(low, Math.min(open_1, close_1));
        }
        // Ensure high >= max(open, close) and low <= min(open, close)
        var maxPrice = Math.max(open_1, close_1);
        var minPrice = Math.min(open_1, close_1);
        if (high < maxPrice) {
            high = maxPrice;
        }
        if (low > minPrice) {
            low = minPrice;
        }
        aggregated.push({
            time: groupTime,
            open: open_1,
            high: high,
            low: low,
            close: close_1,
            volume: volume,
        });
    }
    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Aggregated candles successfully", { sourceCount: validCandles.length, aggregatedCount: aggregated.length });
    // Final sort by time to ensure chronological order
    aggregated.sort(function (a, b) { return a.time - b.time; });
    // Check for gaps in aggregated data
    if (aggregated.length > 1) {
        var gaps = [];
        for (var i = 1; i < aggregated.length; i++) {
            var timeDiff = aggregated[i].time - aggregated[i - 1].time;
            if (timeDiff > targetSeconds * 1.5) {
                gaps.push(timeDiff);
            }
        }
        if (gaps.length > 0) {
            logger_js_1.logger.throttled(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Detected gaps in aggregated candlestick data", { gapCount: gaps.length, maxGapSecs: Math.max.apply(Math, gaps) });
        }
    }
    return aggregated;
}
/**
 * Get K-line/candlestick data
 * Returns validated OHLCV data array
 */
function getCandlestickData(network_1, pairAddress_1) {
    return __awaiter(this, arguments, void 0, function (network, pairAddress, timeframe, limit) {
        /**
         * Validate and normalize a single OHLCV candle
         * Returns normalized candle or null if invalid
         */
        function validateAndNormalizeCandle(item, index, previousCandle) {
            // Validate item format
            if (!Array.isArray(item) || item.length < 6) {
                return null;
            }
            var time = item[0], open = item[1], high = item[2], low = item[3], close = item[4], volume = item[5];
            // Validate data types
            if (typeof time !== 'number' || !isFinite(time) ||
                typeof open !== 'number' || !isFinite(open) ||
                typeof high !== 'number' || !isFinite(high) ||
                typeof low !== 'number' || !isFinite(low) ||
                typeof close !== 'number' || !isFinite(close) ||
                (volume !== undefined && volume !== null && (typeof volume !== 'number' || !isFinite(volume)))) {
                return null;
            }
            // Validate time is reasonable (Unix timestamp in seconds)
            // Should be between 2000-01-01 and 2100-01-01
            if (time < 946684800 || time > 4102444800) {
                return null;
            }
            // Validate prices are positive
            if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
                return null;
            }
            // Validate volume is non-negative
            var normalizedVolume = (volume !== undefined && volume !== null && isFinite(volume)) ? volume : 0;
            if (normalizedVolume < 0) {
                return null;
            }
            // Strict OHLC validation and correction
            var maxPrice = Math.max(open, high, low, close);
            var minPrice = Math.min(open, high, low, close);
            // High must be >= max(open, close, low)
            var correctedHigh = Math.max(high, maxPrice);
            // Low must be <= min(open, close, high)
            var correctedLow = Math.min(low, minPrice);
            // Final validation: high must be >= low
            if (correctedHigh < correctedLow - 0.00000001) {
                return null;
            }
            // Detect abnormal price movements (>50% change from previous candle)
            if (previousCandle) {
                var prevClose = previousCandle.close;
                var priceChange = Math.abs((close - prevClose) / prevClose);
                // If price change is >50%, mark as suspicious but don't reject
                // (could be legitimate market movement)
                if (priceChange > 0.5) {
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, "Large price movement detected in candle", { index: index, changePct: (priceChange * 100).toFixed(2), prevClose: prevClose, close: close });
                }
            }
            // Normalize time to integer (Unix seconds)
            var normalizedTime = Math.floor(time);
            return {
                time: normalizedTime,
                open: open,
                high: correctedHigh,
                low: correctedLow,
                close: close,
                volume: normalizedVolume,
            };
        }
        var startTime, networkMap, timeframeMap, geckoNetwork, geckoTimeframe, originalTimeframe, timeframeMultiplier, multiplier, adjustedLimit, url, response, data_1, error_5, errorText, errorMessage, errorJson, data, responseStr, ohlcvList, retryLimits, _i, retryLimits_1, retryLimit, retryUrl, retryData, e_2, retryOhlcvList, result_1, i, item, time, open_2, high, low, close_2, volume, correctedHigh, correctedLow, maxPrice, minPrice, aggregatedResult, retryError_1, result, seenTimes, invalidCount, duplicateCount, _loop_1, i, gaps, i, timeDiff, expectedInterval, aggregatedResult, duration_1, finalAggregated, finalResult, duration, error_6, duration;
        var _this = this;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (timeframe === void 0) { timeframe = 'h1'; }
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    startTime = Date.now();
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 20, , 21]);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Starting candlestick data fetch', { network: network, pairAddress: pairAddress, timeframe: timeframe, limit: limit });
                    // Validate inputs
                    if (!network || !pairAddress) {
                        throw new Error('Network and pairAddress are required');
                    }
                    if (limit < 1 || limit > 1000) {
                        limit = Math.max(1, Math.min(1000, limit));
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, "Candlestick limit adjusted", { limit: limit });
                    }
                    networkMap = {
                        'sol': 'solana', 'solana': 'solana',
                        'eth': 'eth', 'ethereum': 'eth',
                        'bsc': 'bsc', 'base': 'base',
                        'arbitrum': 'arbitrum', 'optimism': 'optimism',
                        'polygon': 'polygon',
                        'avax': 'avalanche', 'avalanche': 'avalanche',
                        'fantom': 'fantom',
                    };
                    timeframeMap = {
                        'm1': 'minute', 'm5': 'minute', 'm15': 'minute', 'm30': 'minute',
                        'h1': 'hour', 'h4': 'hour', 'h6': 'hour', 'h12': 'hour',
                        'd1': 'day', '24h': 'day',
                        'minute': 'minute', 'hour': 'hour', 'day': 'day',
                    };
                    geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();
                    geckoTimeframe = timeframeMap[timeframe.toLowerCase()] || timeframe.toLowerCase();
                    if (!geckoTimeframe || !['minute', 'hour', 'day'].includes(geckoTimeframe)) {
                        throw new Error("Invalid timeframe: ".concat(timeframe, " (must be m1/m5/m15/m30/h1/h4/h6/h12/d1/24h)"));
                    }
                    originalTimeframe = timeframe.toLowerCase();
                    timeframeMultiplier = {
                        'm1': 1, 'm5': 5, 'm15': 15, 'm30': 30,
                        'h1': 1, 'h4': 4, 'h6': 6, 'h12': 12,
                        'd1': 1, '24h': 1,
                    };
                    multiplier = timeframeMultiplier[originalTimeframe] || 1;
                    adjustedLimit = limit * multiplier;
                    if (geckoTimeframe === 'minute') {
                        // For minute timeframes, be more aggressive to get enough data
                        // m1: request at least 200-500 candles (many tokens have limited history)
                        // m5: need 5x more = 1000-2500 candles (but cap at 2000)
                        // m15: need 15x more = 3000-7500 candles (but cap at 2000 for API limits)
                        if (originalTimeframe === 'm1') {
                            adjustedLimit = Math.min(Math.max(limit, 200), 500);
                        }
                        else if (originalTimeframe === 'm5') {
                            // For m5, we need 5x more minute candles to get 200 m5 candles
                            // Request more data to account for sparse data
                            adjustedLimit = Math.min(Math.max(limit * 6, 1000), 2500); // Request 2500 minutes to get ~200 m5 candles
                        }
                        else if (originalTimeframe === 'm15') {
                            // For m15, we need 15x more minute candles to get 200 m15 candles
                            // Request more data to account for sparse data and ensure we get enough aggregated candles
                            adjustedLimit = Math.min(Math.max(limit * 20, 2000), 3000); // Request 3000 minutes to get ~200 m15 candles
                        }
                        else {
                            adjustedLimit = Math.min(Math.max(adjustedLimit, 200), 2000);
                        }
                    }
                    else if (geckoTimeframe === 'hour') {
                        // For hour timeframes
                        // h1: request 200-500 candles
                        // h4: need 4x more = 800-2000 candles
                        if (originalTimeframe === 'h1') {
                            adjustedLimit = Math.min(Math.max(limit, 200), 500);
                        }
                        else if (originalTimeframe === 'h4') {
                            // For h4, we need 4x more hour candles to get 200 h4 candles
                            adjustedLimit = Math.min(Math.max(limit * 4, 400), 2000);
                        }
                        else {
                            adjustedLimit = Math.min(Math.max(adjustedLimit, 200), 2000);
                        }
                        adjustedLimit = Math.min(Math.max(adjustedLimit, 100), 365);
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick limit calculation", { requested: limit, multiplier: multiplier, adjusted: adjustedLimit });
                    // CRITICAL: Gecko Terminal API has a maximum limit of 1000
                    // Cap adjustedLimit to prevent 400 Bad Request errors
                    if (adjustedLimit > 1000) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, "Adjusted limit exceeds API maximum, capping at 1000", { adjustedLimit: adjustedLimit });
                        adjustedLimit = 1000;
                    }
                    url = "".concat(GECKO_TERMINAL_BASE_URL, "/networks/").concat(geckoNetwork, "/pools/").concat(pairAddress, "/ohlcv/").concat(geckoTimeframe, "?limit=").concat(adjustedLimit);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick request URL", { url: url });
                    response = void 0;
                    _l.label = 2;
                case 2:
                    _l.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'KiKo/1.0',
                            },
                        })];
                case 3:
                    data_1 = _l.sent();
                    // Legacy code expected a Response object, but we now have data directly.
                    // We'll mock a response structure for minimal code change or refactor deeply.
                    // Refactoring deeply to use 'data' directly is better.
                    response = { ok: true, json: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, data_1];
                        }); }); }, status: 200 };
                    return [3 /*break*/, 5];
                case 4:
                    error_5 = _l.sent();
                    if (error_5 instanceof GeckoTerminalError) {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, "GeckoTerminal error during candlestick fetch", { type: error_5.type, message: error_5.message });
                        if (error_5.type === 'network' || error_5.type === 'timeout') {
                            // Network/timeout errors should be thrown to allow fallback to DexScreener
                            throw error_5;
                        }
                    }
                    else {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Unexpected error during candlestick fetch", { error: error_5.message });
                        throw new GeckoTerminalError("Unexpected error: ".concat(error_5.message), 'network', undefined, error_5);
                    }
                    // For API errors, return empty array
                    return [2 /*return*/, []];
                case 5:
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick response status", { status: response.status, statusText: response.statusText });
                    if (!!response.ok) return [3 /*break*/, 7];
                    return [4 /*yield*/, response.text().catch(function () { return ''; })];
                case 6:
                    errorText = _l.sent();
                    errorMessage = "Gecko Terminal API error ".concat(response.status, ": ").concat(response.statusText);
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, errorMessage, { url: url });
                    // Try to parse error as JSON for more details
                    try {
                        errorJson = JSON.parse(errorText);
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, "API error JSON details", { errorJson: errorJson });
                    }
                    catch (e) {
                        // Not JSON, already logged as text
                    }
                    // Throw API error to allow fallback to DexScreener
                    throw new GeckoTerminalError(errorMessage, 'api', response.status, { responseText: errorText });
                case 7: return [4 /*yield*/, response.json()];
                case 8:
                    data = _l.sent();
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick response structure", {
                        hasData: !!(data === null || data === void 0 ? void 0 : data.data),
                        count: ((_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.attributes) === null || _b === void 0 ? void 0 : _b.ohlcv_list) === null || _c === void 0 ? void 0 : _c.length) || 0
                    });
                    responseStr = JSON.stringify(data);
                    if (responseStr.length > 1000) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick response preview", { preview: responseStr.substring(0, 1000) });
                    }
                    else {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick full response", { data: data });
                    }
                    // Validate response structure
                    if (!data || typeof data !== 'object') {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Invalid response format from GeckoTerminal", { type: typeof data });
                        return [2 /*return*/, []];
                    }
                    if (!(data === null || data === void 0 ? void 0 : data.data) || !((_d = data === null || data === void 0 ? void 0 : data.data) === null || _d === void 0 ? void 0 : _d.attributes)) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Missing data.attributes in response", { data: responseStr.substring(0, 200) });
                        return [2 /*return*/, []];
                    }
                    ohlcvList = data.data.attributes.ohlcv_list;
                    if (!Array.isArray(ohlcvList)) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "ohlcv_list is not an array", { type: typeof ohlcvList });
                        return [2 /*return*/, []];
                    }
                    if (!(ohlcvList.length === 0)) return [3 /*break*/, 19];
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Empty ohlcv_list for pool", { pairAddress: pairAddress, network: geckoNetwork, timeframe: geckoTimeframe });
                    if (!(geckoTimeframe === 'minute')) return [3 /*break*/, 18];
                    retryLimits = originalTimeframe === 'm1'
                        ? [100, 50, 25, 10, 5, 1] // More aggressive retries for m1
                        : originalTimeframe === 'm5' || originalTimeframe === 'm15'
                            ? [500, 200, 100, 50, 25, 10] // For m5/m15, try larger limits first
                            : [200, 100, 50, 25, 10];
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "No data with initial limit, attempting retries with smaller limits", { adjustedLimit: adjustedLimit, retryLimits: retryLimits });
                    _i = 0, retryLimits_1 = retryLimits;
                    _l.label = 9;
                case 9:
                    if (!(_i < retryLimits_1.length)) return [3 /*break*/, 17];
                    retryLimit = retryLimits_1[_i];
                    if (retryLimit >= adjustedLimit)
                        return [3 /*break*/, 16];
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Retrying candlestick fetch with smaller limit", { retryLimit: retryLimit, originalTimeframe: originalTimeframe });
                    retryUrl = "".concat(GECKO_TERMINAL_BASE_URL, "/networks/").concat(geckoNetwork, "/pools/").concat(pairAddress, "/ohlcv/").concat(geckoTimeframe, "?limit=").concat(retryLimit);
                    _l.label = 10;
                case 10:
                    _l.trys.push([10, 15, , 16]);
                    retryData = void 0;
                    _l.label = 11;
                case 11:
                    _l.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: retryUrl,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'KiKo/1.0',
                            }
                        })];
                case 12:
                    retryData = _l.sent();
                    return [3 /*break*/, 14];
                case 13:
                    e_2 = _l.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Retry with smaller limit failed", { retryLimit: retryLimit, error: e_2.message });
                    return [3 /*break*/, 16];
                case 14:
                    if (((_f = (_e = retryData === null || retryData === void 0 ? void 0 : retryData.data) === null || _e === void 0 ? void 0 : _e.attributes) === null || _f === void 0 ? void 0 : _f.ohlcv_list) && Array.isArray(retryData.data.attributes.ohlcv_list) && retryData.data.attributes.ohlcv_list.length > 0) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Retry successful with smaller limit", { retryLimit: retryLimit, count: retryData.data.attributes.ohlcv_list.length });
                        retryOhlcvList = retryData.data.attributes.ohlcv_list;
                        result_1 = [];
                        for (i = 0; i < retryOhlcvList.length; i++) {
                            item = retryOhlcvList[i];
                            if (!Array.isArray(item) || item.length < 6)
                                continue;
                            time = item[0], open_2 = item[1], high = item[2], low = item[3], close_2 = item[4], volume = item[5];
                            if (typeof time !== 'number' || isNaN(time) ||
                                typeof open_2 !== 'number' || isNaN(open_2) ||
                                typeof high !== 'number' || isNaN(high) ||
                                typeof low !== 'number' || isNaN(low) ||
                                typeof close_2 !== 'number' || isNaN(close_2) ||
                                typeof volume !== 'number' || isNaN(volume)) {
                                continue;
                            }
                            correctedHigh = high;
                            correctedLow = low;
                            maxPrice = Math.max(open_2, high, low, close_2);
                            minPrice = Math.min(open_2, high, low, close_2);
                            if (high < maxPrice - 0.00000001) {
                                correctedHigh = maxPrice;
                            }
                            if (low > minPrice + 0.00000001) {
                                correctedLow = minPrice;
                            }
                            if (correctedHigh < correctedLow - 0.00000001) {
                                continue;
                            }
                            result_1.push({
                                time: time,
                                open: open_2,
                                high: correctedHigh,
                                low: correctedLow,
                                close: close_2,
                                volume: volume || 0,
                            });
                        }
                        if (result_1.length > 0) {
                            logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Processed valid retry candles", { count: result_1.length });
                            // For m1, return directly without aggregation
                            if (originalTimeframe === 'm1') {
                                // Return all if we have less than requested
                                if (result_1.length <= limit) {
                                    return [2 /*return*/, result_1];
                                }
                                return [2 /*return*/, result_1.slice(-limit)];
                            }
                            // For other timeframes, aggregate if needed
                            if (originalTimeframe !== geckoTimeframe && result_1.length > 0) {
                                aggregatedResult = aggregateCandles(result_1, originalTimeframe, geckoTimeframe);
                                // Return all if we have less than requested
                                if (aggregatedResult.length <= limit) {
                                    return [2 /*return*/, aggregatedResult];
                                }
                                return [2 /*return*/, aggregatedResult.slice(-limit)];
                            }
                            // Return all if we have less than requested
                            if (result_1.length <= limit) {
                                return [2 /*return*/, result_1];
                            }
                            return [2 /*return*/, result_1.slice(-limit)];
                        }
                        else {
                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Retry returned data but no valid candles found", { retryLimit: retryLimit });
                        }
                    }
                    else {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Retry returned no data", { retryLimit: retryLimit });
                    }
                    return [3 /*break*/, 16];
                case 15:
                    retryError_1 = _l.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Retry attempt error", { retryLimit: retryLimit, error: retryError_1.message });
                    return [3 /*break*/, 16];
                case 16:
                    _i++;
                    return [3 /*break*/, 9];
                case 17:
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "All retry attempts failed for timeframe", { timeframe: originalTimeframe });
                    _l.label = 18;
                case 18: return [2 /*return*/, []];
                case 19:
                    result = [];
                    seenTimes = new Set();
                    invalidCount = 0;
                    duplicateCount = 0;
                    _loop_1 = function (i) {
                        var item = ohlcvList[i];
                        var previousCandle = result.length > 0 ? result[result.length - 1] : undefined;
                        var normalized = validateAndNormalizeCandle(item, i, previousCandle);
                        if (!normalized) {
                            invalidCount++;
                            return "continue";
                        }
                        // Deduplicate by time (keep the latest one if duplicates exist)
                        if (seenTimes.has(normalized.time)) {
                            duplicateCount++;
                            // Replace existing candle with same time (keep the latest)
                            var existingIndex = result.findIndex(function (c) { return c.time === normalized.time; });
                            if (existingIndex >= 0) {
                                result[existingIndex] = normalized;
                            }
                            return "continue";
                        }
                        seenTimes.add(normalized.time);
                        result.push(normalized);
                    };
                    for (i = 0; i < ohlcvList.length; i++) {
                        _loop_1(i);
                    }
                    // Sort by time to ensure chronological order
                    result.sort(function (a, b) { return a.time - b.time; });
                    // Check for data gaps and continuity
                    if (result.length > 1) {
                        gaps = [];
                        for (i = 1; i < result.length; i++) {
                            timeDiff = result[i].time - result[i - 1].time;
                            expectedInterval = geckoTimeframe === 'minute' ? 60 :
                                geckoTimeframe === 'hour' ? 3600 : 86400;
                            // If gap is more than 2x expected interval, it's a significant gap
                            if (timeDiff > expectedInterval * 2) {
                                gaps.push(timeDiff);
                            }
                        }
                        if (gaps.length > 0) {
                            logger_js_1.logger.throttled(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Detected data gaps in candlestick response", { gapCount: gaps.length, maxGapSecs: Math.max.apply(Math, gaps) });
                        }
                    }
                    if (invalidCount > 0) {
                        console.warn("[getCandlestickData] Filtered out ".concat(invalidCount, " invalid candles"));
                    }
                    if (duplicateCount > 0) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Found duplicate timestamps", { count: duplicateCount });
                    }
                    // If we need a different interval than what Gecko Terminal provides,
                    // aggregate the data (e.g., m5 from minute data, h4 from hour data)
                    if (originalTimeframe !== geckoTimeframe && result.length > 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Aggregating candles", { from: geckoTimeframe, to: originalTimeframe, count: result.length });
                        aggregatedResult = aggregateCandles(result, originalTimeframe, geckoTimeframe);
                        duration_1 = Date.now() - startTime;
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick aggregation complete", { durationMs: duration_1, count: aggregatedResult.length });
                        finalAggregated = void 0;
                        if (aggregatedResult.length <= limit) {
                            // Return all aggregated candles if we have fewer than requested
                            finalAggregated = aggregatedResult;
                            logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Returning aggregated candles", { count: finalAggregated.length, requested: limit });
                        }
                        else {
                            // Take the most recent candles if we have more than requested
                            finalAggregated = aggregatedResult.slice(-limit);
                        }
                        if (finalAggregated.length < limit * 0.5 && result.length > finalAggregated.length) {
                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Aggregation resulted in few candles", {
                                count: finalAggregated.length,
                                requested: limit,
                                sourceCount: result.length,
                                first: (_g = result[0]) === null || _g === void 0 ? void 0 : _g.time,
                                last: (_h = result[result.length - 1]) === null || _h === void 0 ? void 0 : _h.time
                            });
                        }
                        if (finalAggregated.length === 0) {
                            logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Aggregation resulted in 0 candles", { sourceCount: result.length });
                        }
                        return [2 /*return*/, finalAggregated];
                    }
                    finalResult = void 0;
                    if (result.length <= limit) {
                        // Return all candles if we have fewer than requested (token has limited history)
                        finalResult = result;
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Returning all candles", { count: finalResult.length, requested: limit });
                    }
                    else {
                        // Take the most recent candles if we have more than requested
                        finalResult = result.slice(-limit);
                    }
                    duration = Date.now() - startTime;
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Candlestick data fetch complete", {
                        count: finalResult.length,
                        durationMs: duration,
                        requested: limit
                    });
                    if (invalidCount > 0) {
                        console.warn("[getCandlestickData] Filtered out ".concat(invalidCount, " invalid candles"));
                    }
                    if (finalResult.length < limit * 0.5) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Only few candles returned", {
                            count: finalResult.length,
                            requested: limit,
                            timeSpanHours: finalResult.length > 0 ? (((_j = finalResult[finalResult.length - 1]) === null || _j === void 0 ? void 0 : _j.time) - ((_k = finalResult[0]) === null || _k === void 0 ? void 0 : _k.time)) / 3600 : 0
                        });
                    }
                    return [2 /*return*/, finalResult];
                case 20:
                    error_6 = _l.sent();
                    duration = Date.now() - startTime;
                    console.error("[getCandlestickData] \u2717 Error after ".concat(duration, "ms:"), error_6.message);
                    console.error("[getCandlestickData] Error type:", error_6.constructor.name);
                    console.error("[getCandlestickData] Stack:", error_6.stack);
                    console.error("[getCandlestickData] Input was: network=".concat(network, ", pairAddress=").concat(pairAddress, ", timeframe=").concat(timeframe, ", limit=").concat(limit));
                    // Re-throw the error so the caller can handle it
                    throw error_6;
                case 21: return [2 /*return*/];
            }
        });
    });
}
