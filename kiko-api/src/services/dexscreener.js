"use strict";
/**
 * DexScreener API Service
 * Documentation: https://docs.dexscreener.com/
 *
 * Free API with rate limit ~300 requests/minute
 * Used as fallback for GeckoTerminal
 */
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
exports.getTokenInfo = void 0;
exports.searchTokens = searchTokens;
exports.getTokenDetails = getTokenDetails;
exports.getTokenPairsByAddress = getTokenPairsByAddress;
exports.getTokenPairAddress = getTokenPairAddress;
exports.getTrendingTokensByChain = getTrendingTokensByChain;
exports.getCandlestickData = getCandlestickData;
exports.getTrendingTokensPremium = getTrendingTokensPremium;
var DEXSCREENER_BASE_URL = 'https://api.dexscreener.com/latest/dex';
var DEXSCREENER_TOKEN_PROFILES_URL = 'https://api.dexscreener.com/token-profiles/latest/v1';
var DEXSCREENER_TOKEN_BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/top/v1';
// Import TokenSearchResult type for compatibility with GeckoTerminal
var geckoTerminal_js_1 = require("./geckoTerminal.js");
var ethers_1 = require("ethers");
var dexscreenerWS_js_1 = require("./dexscreenerWS.js");
var trendingScore_js_1 = require("./trendingScore.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var unifiedApiService_js_1 = require("../config/unifiedApiService.js");
/**
 * Chain ID mapping for DexScreener API
 */
var CHAIN_ID_MAP = {
    'eth': 'ethereum',
    'ethereum': 'ethereum',
    'bsc': 'bsc',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'polygon': 'polygon',
    'avalanche': 'avalanche',
    'solana': 'solana',
};
var NETWORK_MAP = {
    'ethereum': 'eth',
    'bsc': 'bsc',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'polygon': 'polygon',
    'avalanche': 'avax',
    'solana': 'solana',
};
/**
 * Tokens to exclude from trending lists
 * Includes: native tokens, wrapped tokens, stablecoins
 */
var EXCLUDED_TOKEN_SYMBOLS = new Set([
    // Native & Wrapped tokens
    'ETH', 'WETH', 'WBTC', 'BTC',
    'BNB', 'WBNB',
    'SOL', 'WSOL',
    'MATIC', 'WMATIC', 'POL',
    'AVAX', 'WAVAX',
    'FTM', 'WFTM',
    'OP',
    'ARB',
    // Stablecoins
    'USDT', 'USDC', 'USDC.e', 'USDbC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'USDP', 'GUSD', 'sUSD', 'USDD', 'PYUSD',
    'EURC', 'EURS',
    // Wrapped/Bridged assets
    'cbETH', 'stETH', 'wstETH', 'rETH', 'frxETH', 'sfrxETH', 'cbBTC', 'tBTC',
    // Common LP/receipt tokens
    'aUSDC', 'aUSDT', 'cUSDC', 'cUSDT',
]);
// Some tokens have unique addresses we should also filter
var EXCLUDED_TOKEN_ADDRESSES = new Set([
    // ETH zero address placeholder
    '0x0000000000000000000000000000000000000000',
    // Base WETH
    '0x4200000000000000000000000000000000000006',
    // Base USDbC
    '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
    // Base USDC
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    // Base cbBTC
    '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
    // Ethereum WETH
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    // Ethereum USDC
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    // Ethereum USDT
    '0xdac17f958d2ee523a2206206994597c13d831ec7',
    // BSC WBNB
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    // BSC BUSD
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
].map(function (a) { return a.toLowerCase(); }));
/**
 * Chain to Trust Wallet blockchain name mapping for fallback images
 */
var CHAIN_TO_TRUSTWALLET = {
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'bsc': 'smartchain',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'polygon': 'polygon',
    'optimism': 'optimism',
    'avalanche': 'avalanche',
};
/**
 * Get fallback image URL from Trust Wallet assets
 */
function getTrustWalletImageUrl(chainId, address) {
    var twChain = CHAIN_TO_TRUSTWALLET[chainId.toLowerCase()];
    if (!twChain || !address)
        return undefined;
    var evmChains = new Set(['ethereum', 'eth', 'bsc', 'base', 'arbitrum', 'polygon', 'optimism', 'avalanche']);
    var normalizedAddress = address;
    if (evmChains.has(chainId.toLowerCase())) {
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
    var safePath = trimmed.replace(/^\/+/, '');
    return "https://cdn.dexscreener.com/cms/images/".concat(safePath);
}
/**
 * Search for tokens
 */
function searchTokens(query) {
    return __awaiter(this, void 0, void 0, function () {
        var url, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    url = "".concat(DEXSCREENER_BASE_URL, "/search?q=").concat(encodeURIComponent(query));
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({ url: url })];
                case 1:
                    data = _a.sent();
                    if (!data.pairs || !Array.isArray(data.pairs)) {
                        return [2 /*return*/, []];
                    }
                    return [2 /*return*/, data.pairs.map(function (pair) {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                            var chainId = pair.chainId || '';
                            var network = NETWORK_MAP[chainId.toLowerCase()] || chainId.toLowerCase();
                            return {
                                address: ((_a = pair.baseToken) === null || _a === void 0 ? void 0 : _a.address) || '',
                                name: ((_b = pair.baseToken) === null || _b === void 0 ? void 0 : _b.name) || '',
                                symbol: ((_c = pair.baseToken) === null || _c === void 0 ? void 0 : _c.symbol) || '',
                                chainId: chainId,
                                network: network,
                                price: parseFloat(pair.priceUsd || '0'),
                                priceChange24h: parseFloat(((_d = pair.priceChange) === null || _d === void 0 ? void 0 : _d.h24) || '0'),
                                volume24h: parseFloat(((_e = pair.volume) === null || _e === void 0 ? void 0 : _e.h24) || '0'),
                                liquidity: parseFloat(((_f = pair.liquidity) === null || _f === void 0 ? void 0 : _f.usd) || '0'),
                                fdv: pair.fdv ? parseFloat(pair.fdv) : undefined,
                                poolAddress: pair.pairAddress, // Critical for charts
                                imageUrl: normalizeImageUrl((_g = pair.info) === null || _g === void 0 ? void 0 : _g.imageUrl) || getTrustWalletImageUrl(chainId, ((_h = pair.baseToken) === null || _h === void 0 ? void 0 : _h.address) || ''),
                                socials: (_j = pair.info) === null || _j === void 0 ? void 0 : _j.socials,
                                websites: (_k = pair.info) === null || _k === void 0 ? void 0 : _k.websites,
                            };
                        })];
                case 2:
                    error_1 = _a.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error searching tokens on DexScreener', { error: error_1.message, query: query });
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get token details by address
 * Returns token info and the most liquid pair address
 */
function getTokenDetails(chainId, address) {
    return __awaiter(this, void 0, void 0, function () {
        var url, data, normalizedChain_1, chainPairs, candidatePairs, pair, network, error_2;
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 2, , 3]);
                    url = "".concat(DEXSCREENER_BASE_URL, "/tokens/").concat(address);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Fetching token details from DexScreener', { url: url });
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            timeout: 10000
                        })];
                case 1:
                    data = _j.sent();
                    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'No pairs found for token on DexScreener', { address: address });
                        return [2 /*return*/, null];
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Pairs found for token', { count: data.pairs.length, address: address });
                    normalizedChain_1 = CHAIN_ID_MAP[chainId.toLowerCase()] || chainId.toLowerCase();
                    chainPairs = data.pairs.filter(function (p) { return String((p === null || p === void 0 ? void 0 : p.chainId) || '').toLowerCase() === normalizedChain_1; });
                    candidatePairs = chainPairs.length > 0 ? chainPairs : data.pairs;
                    pair = candidatePairs.sort(function (a, b) { var _a, _b; return parseFloat(((_a = b.liquidity) === null || _a === void 0 ? void 0 : _a.usd) || '0') - parseFloat(((_b = a.liquidity) === null || _b === void 0 ? void 0 : _b.usd) || '0'); })[0];
                    network = NETWORK_MAP[chainId.toLowerCase()] || chainId.toLowerCase();
                    return [2 /*return*/, {
                            address: address,
                            name: ((_a = pair.baseToken) === null || _a === void 0 ? void 0 : _a.name) || '',
                            symbol: ((_b = pair.baseToken) === null || _b === void 0 ? void 0 : _b.symbol) || '',
                            chainId: chainId,
                            network: network,
                            price: parseFloat(pair.priceUsd || '0'),
                            priceChange24h: parseFloat(((_c = pair.priceChange) === null || _c === void 0 ? void 0 : _c.h24) || '0'),
                            volume24h: parseFloat(((_d = pair.volume) === null || _d === void 0 ? void 0 : _d.h24) || '0'),
                            liquidity: parseFloat(((_e = pair.liquidity) === null || _e === void 0 ? void 0 : _e.usd) || '0'),
                            fdv: pair.fdv ? parseFloat(pair.fdv) : undefined,
                            poolAddress: pair.pairAddress,
                            pairCreatedAt: pair.pairCreatedAt, // Pool creation timestamp
                            imageUrl: normalizeImageUrl((_f = pair.info) === null || _f === void 0 ? void 0 : _f.imageUrl) || getTrustWalletImageUrl(chainId, address), // Token logo
                            socials: ((_g = pair.info) === null || _g === void 0 ? void 0 : _g.socials) || [], // Twitter, Discord links
                            websites: ((_h = pair.info) === null || _h === void 0 ? void 0 : _h.websites) || [], // Official websites
                        }];
                case 2:
                    error_2 = _j.sent();
                    if (error_2.name === 'AbortError') {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener request timeout', { address: address });
                    }
                    else {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching token details on DexScreener', { address: address, error: error_2.message });
                    }
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Alias for getTokenDetails to match common naming convention
 */
exports.getTokenInfo = getTokenDetails;
/**
 * Get all pools/pairs for a token on a specific chain.
 * Uses DexScreener official token-pairs endpoint.
 */
function getTokenPairsByAddress(chainId, tokenAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedChain, url, data, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    normalizedChain = CHAIN_ID_MAP[chainId.toLowerCase()] || chainId.toLowerCase();
                    url = "https://api.dexscreener.com/token-pairs/v1/".concat(normalizedChain, "/").concat(tokenAddress);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'KiKo/1.0'
                            },
                            timeout: 10000
                        })];
                case 1:
                    data = _a.sent();
                    if (!Array.isArray(data) || data.length === 0)
                        return [2 /*return*/, []];
                    return [2 /*return*/, data
                            .map(function (p) {
                            var _a, _b, _c, _d;
                            return ({
                                pairAddress: String((p === null || p === void 0 ? void 0 : p.pairAddress) || ''),
                                pairCreatedAt: Number((p === null || p === void 0 ? void 0 : p.pairCreatedAt) || 0) || undefined,
                                chainId: typeof (p === null || p === void 0 ? void 0 : p.chainId) === 'string' ? p.chainId : undefined,
                                dexId: typeof (p === null || p === void 0 ? void 0 : p.dexId) === 'string' ? p.dexId : undefined,
                                liquidityUsd: Number(((_a = p === null || p === void 0 ? void 0 : p.liquidity) === null || _a === void 0 ? void 0 : _a.usd) || 0) || undefined,
                                volume24h: Number(((_b = p === null || p === void 0 ? void 0 : p.volume) === null || _b === void 0 ? void 0 : _b.h24) || 0) || undefined,
                                baseTokenAddress: typeof ((_c = p === null || p === void 0 ? void 0 : p.baseToken) === null || _c === void 0 ? void 0 : _c.address) === 'string' ? p.baseToken.address : undefined,
                                quoteTokenAddress: typeof ((_d = p === null || p === void 0 ? void 0 : p.quoteToken) === null || _d === void 0 ? void 0 : _d.address) === 'string' ? p.quoteToken.address : undefined,
                            });
                        })
                            .filter(function (p) { return !!p.pairAddress; })];
                case 2:
                    error_3 = _a.sent();
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener token-pairs fetch failed', {
                        chain: chainId,
                        tokenAddress: tokenAddress,
                        error: (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || String(error_3)
                    });
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get pair address for a token (for use with Gecko Terminal chart API)
 * Returns the pair address of the most liquid pair
 */
function getTokenPairAddress(network, tokenAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var chainId_1, url, data, chainPairs, bestPair, pairAddress, error_4;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Fetching pair address from DexScreener', { tokenAddress: tokenAddress, network: network });
                    chainId_1 = CHAIN_ID_MAP[network.toLowerCase()] || network.toLowerCase();
                    url = "".concat(DEXSCREENER_BASE_URL, "/tokens/").concat(tokenAddress);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'DexScreener request URL', { url: url });
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        })];
                case 1:
                    data = _b.sent();
                    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'No pairs found for token during pair address lookup', { tokenAddress: tokenAddress, network: network });
                        return [2 /*return*/, null];
                    }
                    chainPairs = data.pairs.filter(function (p) { var _a; return ((_a = p.chainId) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === chainId_1.toLowerCase(); });
                    if (chainPairs.length === 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'No pairs found for specific chain during lookup', { chainName: chainId_1, tokenAddress: tokenAddress });
                        return [2 /*return*/, null];
                    }
                    bestPair = chainPairs.sort(function (a, b) { var _a, _b; return parseFloat(((_a = b.liquidity) === null || _a === void 0 ? void 0 : _a.usd) || '0') - parseFloat(((_b = a.liquidity) === null || _b === void 0 ? void 0 : _b.usd) || '0'); })[0];
                    pairAddress = bestPair.pairAddress;
                    if (!pairAddress) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Pair address not found in DexScreener pair data', { tokenAddress: tokenAddress });
                        return [2 /*return*/, null];
                    }
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Pair address found successfully', {
                        pairAddress: pairAddress,
                        liquidityUsd: parseFloat(((_a = bestPair.liquidity) === null || _a === void 0 ? void 0 : _a.usd) || '0')
                    });
                    return [2 /*return*/, pairAddress];
                case 2:
                    error_4 = _b.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching pair address on DexScreener', { tokenAddress: tokenAddress, error: error_4.message });
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get trending/popular tokens for a specific chain
 * Uses DexScreener's token-boosts endpoint and filters by chain
 * Returns TokenSearchResult[] for compatibility with GeckoTerminal
 */
function getTrendingTokensByChain(chainId_2) {
    return __awaiter(this, arguments, void 0, function (chainId, limit, duration) {
        var dexScreenerChainId, durationMap, timeKey, tokenCandidates, boostsData, _i, boostsData_1, item, e_1, CHAIN_SEARCH_TERMS, searchTerms, searchPromises, searchResults, _a, searchResults_1, pairs, _b, pairs_1, pair, tokenAddress, existing, boostFetchCount, _c, _d, _e, addr, candidate, details, scoredTokens, _f, _g, candidate, p, volume, txns, liquidity, priceChange, name_1, symbol, address, imageUrl, price, fdv, poolAddress, volumeScore, txnsScore, liquidityScore, isBoosted, boostMultiplier, priceChange5m, priceChange1h, priceChange6h, poolCreatedAt, buys24h, sells24h, totalScore, error_5;
        var _this = this;
        var _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
        if (limit === void 0) { limit = 50; }
        if (duration === void 0) { duration = '5m'; }
        return __generator(this, function (_3) {
            switch (_3.label) {
                case 0:
                    _3.trys.push([0, 10, , 11]);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Fetching trending tokens from DexScreener', { chainName: chainId, duration: duration });
                    dexScreenerChainId = CHAIN_ID_MAP[chainId.toLowerCase()] || chainId.toLowerCase();
                    durationMap = {
                        '5m': 'm5',
                        '1h': 'h1',
                        '6h': 'h6',
                        '24h': 'h24'
                    };
                    timeKey = durationMap[duration] || 'h24';
                    tokenCandidates = new Map();
                    _3.label = 1;
                case 1:
                    _3.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({ url: DEXSCREENER_TOKEN_BOOSTS_URL })];
                case 2:
                    boostsData = _3.sent();
                    if (Array.isArray(boostsData)) {
                        for (_i = 0, boostsData_1 = boostsData; _i < boostsData_1.length; _i++) {
                            item = boostsData_1[_i];
                            if (((_h = item.chainId) === null || _h === void 0 ? void 0 : _h.toLowerCase()) === dexScreenerChainId && item.tokenAddress) {
                                tokenCandidates.set(item.tokenAddress.toLowerCase(), { address: item.tokenAddress, type: 'boost' });
                            }
                        }
                    }
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _3.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Failed to fetch boosts from DexScreener', { error: e_1.message });
                    return [3 /*break*/, 4];
                case 4:
                    CHAIN_SEARCH_TERMS = {
                        'ethereum': ['uniswap', 'sushiswap', 'curve', 'WETH', 'USDC', 'USDT',],
                        'solana': ['pumpswap', 'raydium', 'orca', 'jupiter', 'meteora', 'SOL', 'USDC', 'USDT',],
                        'bsc': ['pancakeswap', 'WBNB', 'USDT', 'CAKE', 'BUSD',],
                        'base': ['uniswap', 'aerodrome', 'WETH', 'USDC', 'Zora'],
                        'arbitrum': ['uniswap', 'sushiswap', 'gmx', 'WETH', 'USDC', 'ARB', 'GMX',],
                        'optimism': ['uniswap', 'velodrome', 'WETH', 'USDC', 'OP', 'VELO',],
                        'polygon': ['uniswap', 'quickswap', 'sushiswap', 'WMATIC', 'USDC', 'USDT',],
                    };
                    searchTerms = CHAIN_SEARCH_TERMS[dexScreenerChainId] || ['WETH', 'USDC', 'USDT'];
                    searchPromises = searchTerms.map(function (term) { return __awaiter(_this, void 0, void 0, function () {
                        var searchUrl, data, e_2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    searchUrl = "".concat(DEXSCREENER_BASE_URL, "/search?q=").concat(term);
                                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({ url: searchUrl })];
                                case 1:
                                    data = _a.sent();
                                    return [2 /*return*/, data.pairs || []];
                                case 2:
                                    e_2 = _a.sent();
                                    return [2 /*return*/, []];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(searchPromises)];
                case 5:
                    searchResults = _3.sent();
                    // Process search results
                    for (_a = 0, searchResults_1 = searchResults; _a < searchResults_1.length; _a++) {
                        pairs = searchResults_1[_a];
                        for (_b = 0, pairs_1 = pairs; _b < pairs_1.length; _b++) {
                            pair = pairs_1[_b];
                            if (((_j = pair.chainId) === null || _j === void 0 ? void 0 : _j.toLowerCase()) !== dexScreenerChainId)
                                continue;
                            tokenAddress = (_k = pair.baseToken) === null || _k === void 0 ? void 0 : _k.address;
                            if (!tokenAddress)
                                continue;
                            // If already exists, we might have better data now (full pair data)
                            // Use the pair data directly if available
                            if (!tokenCandidates.has(tokenAddress.toLowerCase())) {
                                tokenCandidates.set(tokenAddress.toLowerCase(), { address: tokenAddress, pairData: pair, type: 'search' });
                            }
                            else {
                                existing = tokenCandidates.get(tokenAddress.toLowerCase());
                                if (!existing.pairData) {
                                    existing.pairData = pair;
                                }
                            }
                        }
                    }
                    boostFetchCount = 0;
                    _c = 0, _d = tokenCandidates.entries();
                    _3.label = 6;
                case 6:
                    if (!(_c < _d.length)) return [3 /*break*/, 9];
                    _e = _d[_c], addr = _e[0], candidate = _e[1];
                    if (!(!candidate.pairData && candidate.type === 'boost' && boostFetchCount < 10)) return [3 /*break*/, 8];
                    return [4 /*yield*/, getTokenPairData(dexScreenerChainId, candidate.address)];
                case 7:
                    details = _3.sent();
                    if (details) {
                        candidate.pairData = details; // This is TokenSearchResult, slightly different shape but contains key metrics
                        // We need to normalize or re-fetch pair specific data if we want strict scoring
                        // getTokenPairData internally fetches /tokens/{addr} which returns pairs.
                        // Ideally we want the raw pair data.
                    }
                    boostFetchCount++;
                    _3.label = 8;
                case 8:
                    _c++;
                    return [3 /*break*/, 6];
                case 9:
                    scoredTokens = [];
                    for (_f = 0, _g = tokenCandidates.values(); _f < _g.length; _f++) {
                        candidate = _g[_f];
                        p = candidate.pairData;
                        if (!p)
                            continue;
                        volume = 0;
                        txns = 0;
                        liquidity = 0;
                        priceChange = 0;
                        name_1 = '';
                        symbol = '';
                        address = candidate.address;
                        imageUrl = '';
                        price = 0;
                        fdv = 0;
                        poolAddress = '';
                        if (p.baseToken) { // Raw pair structure
                            volume = parseFloat(((_l = p.volume) === null || _l === void 0 ? void 0 : _l[timeKey]) || '0');
                            txns = (((_o = (_m = p.txns) === null || _m === void 0 ? void 0 : _m[timeKey]) === null || _o === void 0 ? void 0 : _o.buys) || 0) + (((_q = (_p = p.txns) === null || _p === void 0 ? void 0 : _p[timeKey]) === null || _q === void 0 ? void 0 : _q.sells) || 0);
                            liquidity = parseFloat(((_r = p.liquidity) === null || _r === void 0 ? void 0 : _r.usd) || '0');
                            priceChange = parseFloat(((_s = p.priceChange) === null || _s === void 0 ? void 0 : _s[timeKey]) || '0');
                            name_1 = p.baseToken.name;
                            symbol = p.baseToken.symbol;
                            imageUrl = ((_t = p.info) === null || _t === void 0 ? void 0 : _t.imageUrl) || '';
                            price = parseFloat(p.priceUsd || '0');
                            fdv = parseFloat(p.fdv || '0');
                            poolAddress = p.pairAddress;
                        }
                        else { // TokenSearchResult structure (fallback)
                            // Note: TokenSearchResult largely assumes 24h, but we can try to find fields if they existed
                            // For now, if enrichment returned limited data, we might be stuck with 24h fallback or need to extend TokenSearchResult
                            // But raw pair data (from search) is rich, so most candidates will have full fields.
                            volume = typeof p.volume24h === 'number' ? p.volume24h : parseFloat(p.volume24h || '0');
                            txns = 0; // We might lose txns in TokenSearchResult interface currently
                            liquidity = typeof p.liquidity === 'number' ? p.liquidity : parseFloat(p.liquidity || '0');
                            priceChange = typeof p.priceChange24h === 'number' ? p.priceChange24h : parseFloat(p.priceChange24h || '0');
                            name_1 = p.name;
                            symbol = p.symbol;
                            imageUrl = p.imageUrl;
                            price = p.price;
                            fdv = p.fdv;
                            poolAddress = p.poolAddress;
                        }
                        // Fallback image
                        imageUrl = normalizeImageUrl(imageUrl) || getTrustWalletImageUrl(dexScreenerChainId, address) || '';
                        volumeScore = Math.log10(volume + 1) * 40;
                        txnsScore = Math.log10(txns + 1) * 20;
                        liquidityScore = Math.log10(liquidity + 1) * 10;
                        isBoosted = candidate.type === 'boost';
                        boostMultiplier = isBoosted ? 1.2 : 1.0;
                        // Spam filter
                        if (liquidity < 1000)
                            continue; // Filter out ultra-low liquidity dust
                        priceChange5m = void 0;
                        priceChange1h = void 0;
                        priceChange6h = void 0;
                        poolCreatedAt = void 0;
                        buys24h = 0;
                        sells24h = 0;
                        if (p.baseToken) { // Raw pair structure - extract all fields
                            priceChange5m = ((_u = p.priceChange) === null || _u === void 0 ? void 0 : _u.m5) !== undefined ? parseFloat(p.priceChange.m5) : undefined;
                            priceChange1h = ((_v = p.priceChange) === null || _v === void 0 ? void 0 : _v.h1) !== undefined ? parseFloat(p.priceChange.h1) : undefined;
                            priceChange6h = ((_w = p.priceChange) === null || _w === void 0 ? void 0 : _w.h6) !== undefined ? parseFloat(p.priceChange.h6) : undefined;
                            poolCreatedAt = p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : undefined;
                            buys24h = ((_y = (_x = p.txns) === null || _x === void 0 ? void 0 : _x.h24) === null || _y === void 0 ? void 0 : _y.buys) || 0;
                            sells24h = ((_0 = (_z = p.txns) === null || _z === void 0 ? void 0 : _z.h24) === null || _0 === void 0 ? void 0 : _0.sells) || 0;
                        }
                        totalScore = (volumeScore + txnsScore + liquidityScore) * boostMultiplier;
                        scoredTokens.push({
                            address: address,
                            name: name_1,
                            symbol: symbol,
                            network: NETWORK_MAP[dexScreenerChainId] || chainId,
                            price: price,
                            priceChange5m: priceChange5m,
                            priceChange1h: priceChange1h,
                            priceChange6h: priceChange6h,
                            priceChange24h: priceChange,
                            volume24h: volume,
                            txns24h: txns,
                            buys24h: buys24h,
                            sells24h: sells24h,
                            liquidity: liquidity,
                            fdv: fdv,
                            imageUrl: imageUrl,
                            poolAddress: poolAddress,
                            poolCreatedAt: poolCreatedAt,
                            socials: (_1 = p.info) === null || _1 === void 0 ? void 0 : _1.socials,
                            websites: (_2 = p.info) === null || _2 === void 0 ? void 0 : _2.websites,
                            score: totalScore
                        });
                    }
                    // 5. Sort by Score
                    scoredTokens.sort(function (a, b) { return b.score - a.score; });
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Processed DexScreener trending candidates', {
                        candidates: tokenCandidates.size,
                        limit: limit
                    });
                    return [2 /*return*/, scoredTokens.slice(0, limit)];
                case 10:
                    error_5 = _3.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching trending tokens from DexScreener', { error: error_5.message, chainName: chainId });
                    return [2 /*return*/, []];
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * Helper function to get token pair data and convert to TokenSearchResult
 */
function getTokenPairData(chainId, tokenAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var url, data, chainPairs, pair, error_6;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 2, , 3]);
                    url = "".concat(DEXSCREENER_BASE_URL, "/tokens/").concat(tokenAddress);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({ url: url })];
                case 1:
                    data = _g.sent();
                    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
                        return [2 /*return*/, null];
                    }
                    chainPairs = data.pairs.filter(function (p) { var _a; return ((_a = p.chainId) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === chainId.toLowerCase(); });
                    if (chainPairs.length === 0)
                        return [2 /*return*/, null];
                    pair = chainPairs.sort(function (a, b) { var _a, _b; return parseFloat(((_a = b.liquidity) === null || _a === void 0 ? void 0 : _a.usd) || '0') - parseFloat(((_b = a.liquidity) === null || _b === void 0 ? void 0 : _b.usd) || '0'); })[0];
                    return [2 /*return*/, {
                            address: tokenAddress,
                            name: ((_a = pair.baseToken) === null || _a === void 0 ? void 0 : _a.name) || '',
                            symbol: ((_b = pair.baseToken) === null || _b === void 0 ? void 0 : _b.symbol) || '',
                            network: NETWORK_MAP[chainId] || chainId,
                            imageUrl: normalizeImageUrl((_c = pair.info) === null || _c === void 0 ? void 0 : _c.imageUrl) || getTrustWalletImageUrl(chainId, tokenAddress),
                            price: parseFloat(pair.priceUsd || '0') || undefined,
                            priceChange24h: parseFloat(((_d = pair.priceChange) === null || _d === void 0 ? void 0 : _d.h24) || '0') || undefined,
                            volume24h: parseFloat(((_e = pair.volume) === null || _e === void 0 ? void 0 : _e.h24) || '0') || undefined,
                            liquidity: parseFloat(((_f = pair.liquidity) === null || _f === void 0 ? void 0 : _f.usd) || '0') || undefined,
                            fdv: pair.fdv ? parseFloat(pair.fdv) : undefined,
                        }];
                case 2:
                    error_6 = _g.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get candlestick/OHLCV data from DexScreener
 * DexScreener provides price history in their pair data
 * Note: DexScreener has limited historical data compared to Gecko Terminal
 * Returns data in the same format as Gecko Terminal for consistency
 */
function getCandlestickData(network_1, pairAddress_1) {
    return __awaiter(this, arguments, void 0, function (network, pairAddress, timeframe, limit) {
        var startTime, REQUEST_TIMEOUT, chainId, url, data, pair, priceHistory, currentPrice, now, result, timeframeMs, intervalMs, candles, _i, priceHistory_1, item, timestamp, price, candleTime, candle, sortedCandles, candlesToProcess, _loop_1, _a, candlesToProcess_1, _b, candleTime, candleData, deduplicated, seenTimes, i, duration, error_7, duration;
        if (timeframe === void 0) { timeframe = 'h1'; }
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    startTime = Date.now();
                    REQUEST_TIMEOUT = 30000;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Fetching candlestick data from DexScreener', {
                        network: network,
                        pairAddress: pairAddress,
                        timeframe: timeframe,
                        limit: limit
                    });
                    // Validate inputs
                    if (!network || !pairAddress) {
                        throw new Error('Network and pairAddress are required');
                    }
                    if (limit < 1 || limit > 1000) {
                        limit = Math.max(1, Math.min(1000, limit));
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener limit adjusted', { limit: limit });
                    }
                    chainId = CHAIN_ID_MAP[network.toLowerCase()] || network.toLowerCase();
                    url = "".concat(DEXSCREENER_BASE_URL, "/pairs/").concat(chainId, "/").concat(pairAddress);
                    console.log("[DexScreener] Request URL: ".concat(url));
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            headers: {
                                'Accept': 'application/json'
                            },
                            timeout: REQUEST_TIMEOUT
                        })];
                case 2:
                    data = _c.sent();
                    if (!data)
                        return [2 /*return*/, []]; // fetchJson returns null on failure if not thrown properly? Or typically throws.
                    pair = null;
                    if (data.pair) {
                        pair = data.pair;
                    }
                    else if (data.pairs && Array.isArray(data.pairs) && data.pairs.length > 0) {
                        // Get the most liquid pair
                        pair = data.pairs.sort(function (a, b) { var _a, _b; return parseFloat(((_a = b.liquidity) === null || _a === void 0 ? void 0 : _a.usd) || '0') - parseFloat(((_b = a.liquidity) === null || _b === void 0 ? void 0 : _b.usd) || '0'); })[0];
                    }
                    if (!pair) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'No pair data found on DexScreener', { pairAddress: pairAddress, network: network });
                        return [2 /*return*/, []];
                    }
                    priceHistory = [];
                    if (pair.priceHistory && Array.isArray(pair.priceHistory)) {
                        priceHistory = pair.priceHistory;
                    }
                    else {
                        currentPrice = parseFloat(pair.priceUsd || '0');
                        if (currentPrice > 0) {
                            now = Date.now();
                            // Create a simple candle from current price
                            priceHistory = [[now, currentPrice]];
                            logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'No price history on DexScreener, using current price', { currentPrice: currentPrice });
                        }
                        else {
                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'No price history or current price available on DexScreener', { pairAddress: pairAddress });
                            return [2 /*return*/, []];
                        }
                    }
                    if (!Array.isArray(priceHistory) || priceHistory.length === 0) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Empty price history on DexScreener', { pairAddress: pairAddress });
                        return [2 /*return*/, []];
                    }
                    result = [];
                    timeframeMs = {
                        'm1': 60 * 1000,
                        'm5': 5 * 60 * 1000,
                        'm15': 15 * 60 * 1000,
                        'm30': 30 * 60 * 1000,
                        'h1': 60 * 60 * 1000,
                        'h4': 4 * 60 * 60 * 1000,
                        'h6': 6 * 60 * 60 * 1000,
                        'h12': 12 * 60 * 60 * 1000,
                        'd1': 24 * 60 * 60 * 1000,
                        '24h': 24 * 60 * 60 * 1000,
                    };
                    intervalMs = timeframeMs[timeframe.toLowerCase()] || 60 * 60 * 1000;
                    candles = new Map();
                    for (_i = 0, priceHistory_1 = priceHistory; _i < priceHistory_1.length; _i++) {
                        item = priceHistory_1[_i];
                        timestamp = void 0;
                        price = void 0;
                        // Handle different price history formats
                        if (Array.isArray(item) && item.length >= 2) {
                            // Format: [timestamp, price]
                            timestamp = item[0];
                            price = item[1];
                        }
                        else if (typeof item === 'object' && item.timestamp && item.price) {
                            // Format: { timestamp, price }
                            timestamp = item.timestamp;
                            price = item.price;
                        }
                        else {
                            continue;
                        }
                        // Validate data
                        if (typeof timestamp !== 'number' || typeof price !== 'number' || isNaN(price) || isNaN(timestamp)) {
                            continue;
                        }
                        // Convert timestamp to milliseconds if it's in seconds
                        if (timestamp < 1e12) {
                            timestamp = timestamp * 1000;
                        }
                        candleTime = Math.floor(timestamp / intervalMs) * intervalMs;
                        if (!candles.has(candleTime)) {
                            candles.set(candleTime, { prices: [], timestamps: [] });
                        }
                        candle = candles.get(candleTime);
                        candle.prices.push(price);
                        candle.timestamps.push(timestamp);
                    }
                    sortedCandles = Array.from(candles.entries()).sort(function (a, b) { return a[0] - b[0]; });
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Grouped price points into candles', {
                        pricePoints: priceHistory.length,
                        candles: sortedCandles.length,
                        timeframe: timeframe
                    });
                    candlesToProcess = sortedCandles.length <= limit
                        ? sortedCandles
                        : sortedCandles.slice(-limit);
                    _loop_1 = function (candleTime, candleData) {
                        if (candleData.prices.length === 0)
                            return "continue";
                        var prices = candleData.prices.filter(function (p) { return isFinite(p) && p > 0; });
                        if (prices.length === 0)
                            return "continue";
                        // Sort prices by timestamp to get correct open/close
                        var priceWithTime = candleData.prices.map(function (p, i) { return ({
                            price: p,
                            time: candleData.timestamps[i] || candleTime,
                        }); }).filter(function (p) { return isFinite(p.price) && p.price > 0; })
                            .sort(function (a, b) { return a.time - b.time; });
                        if (priceWithTime.length === 0)
                            return "continue";
                        var open_1 = priceWithTime[0].price;
                        var close_1 = priceWithTime[priceWithTime.length - 1].price;
                        var high = Math.max.apply(Math, priceWithTime.map(function (p) { return p.price; }));
                        var low = Math.min.apply(Math, priceWithTime.map(function (p) { return p.price; }));
                        // Validate OHLC
                        if (high < low || high < Math.max(open_1, close_1) || low > Math.min(open_1, close_1)) {
                            // Auto-correct
                            var maxPrice = Math.max(open_1, high, low, close_1);
                            var minPrice = Math.min(open_1, high, low, close_1);
                            var correctedHigh = Math.max(high, maxPrice);
                            var correctedLow = Math.min(low, minPrice);
                            if (correctedHigh < correctedLow)
                                return "continue";
                            result.push({
                                time: Math.floor(candleTime / 1000), // Unix timestamp in seconds
                                open: open_1,
                                high: correctedHigh,
                                low: correctedLow,
                                close: close_1,
                                volume: 0, // DexScreener price history doesn't include volume
                            });
                        }
                        else {
                            result.push({
                                time: Math.floor(candleTime / 1000), // Unix timestamp in seconds
                                open: open_1,
                                high: high,
                                low: low,
                                close: close_1,
                                volume: 0, // DexScreener price history doesn't include volume
                            });
                        }
                    };
                    // Validate and normalize candles
                    for (_a = 0, candlesToProcess_1 = candlesToProcess; _a < candlesToProcess_1.length; _a++) {
                        _b = candlesToProcess_1[_a], candleTime = _b[0], candleData = _b[1];
                        _loop_1(candleTime, candleData);
                    }
                    // Sort by time to ensure chronological order
                    result.sort(function (a, b) { return a.time - b.time; });
                    deduplicated = [];
                    seenTimes = new Set();
                    for (i = result.length - 1; i >= 0; i--) {
                        if (!seenTimes.has(result[i].time)) {
                            seenTimes.add(result[i].time);
                            deduplicated.unshift(result[i]);
                        }
                    }
                    duration = Date.now() - startTime;
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Generated candles from price points', {
                        count: deduplicated.length,
                        sourcePoints: priceHistory.length,
                        requested: limit,
                        durationMs: duration
                    });
                    if (deduplicated.length === 0 && priceHistory.length > 0) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Failed to generate candles from price points', { count: priceHistory.length });
                    }
                    // Return all if we have fewer than requested, otherwise take the most recent
                    if (deduplicated.length <= limit) {
                        return [2 /*return*/, deduplicated];
                    }
                    return [2 /*return*/, deduplicated.slice(-limit)];
                case 3:
                    error_7 = _c.sent();
                    duration = Date.now() - startTime;
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching candlestick data on DexScreener', { durationMs: duration, error: error_7.message });
                    // Security: Stack trace logging removed in production
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get high-quality trending tokens using DexScreener's boost + pair data
 * This provides better quality than trending_pools from GeckoTerminal
 *
 * Algorithm:
 * 1. Fetch token boosts (most actively boosted tokens - indicates real interest)
 * 2. Filter by requested chainId
 * 3. Batch enrich with pair data (volume, price, liquidity, txns)
 * 4. Apply quality filters (min liquidity $5000, min volume $1000)
 * 5. Return sorted by boost score + volume weighted
 *
 * @param chainId - Chain to filter by (e.g., 'solana', 'ethereum', 'base')
 * @param limit - Maximum number of tokens to return (default 50)
 */
function getTrendingTokensPremium(chainId_2) {
    return __awaiter(this, arguments, void 0, function (chainId, limit, options) {
        var startTime, normalizedChainId, trendingAddresses, wsAddressCount, isWSAvailable, useWebSocket, QUALITY_MIN_LIQ_USD, QUALITY_MIN_VOL_USD, wsError_1, MIN_WS_ADDRESSES, chainBoosts, boostsResponse, boostsData, e_3, ORGANIC_SEARCH_TERMS, searchTerms, organicTokenAddresses, _i, searchTerms_1, searchTerm, searchUrl, searchData, _a, _b, pair, volume, liquidity, baseAddr, e_4, boostedAddrs, fallbackAddresses, preMergeWsCount, tokensToEnrich, enrichedTokensMap, batchSize, i, batch, addressesParam, pairUrl, pairResponse, pairData, _c, pairData_1, pair, baseTokenAddr, currentLiquidity, existing, existingLiquidity, imageUrl, volume24h, priceChange24h, symbol, batchError_1, scored, finalTokens, existingAddresses, fallbackTokens, _d, fallbackTokens_1, token, fallbackError_1, geckoTokens, _e, geckoTokens_1, token, geckoError_1, duration, error_8, duration;
        var _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8;
        if (limit === void 0) { limit = 50; }
        return __generator(this, function (_9) {
            switch (_9.label) {
                case 0:
                    startTime = Date.now();
                    normalizedChainId = CHAIN_ID_MAP[chainId.toLowerCase()] || chainId.toLowerCase();
                    _9.label = 1;
                case 1:
                    _9.trys.push([1, 35, , 36]);
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Fetching premium trending tokens', { chain: normalizedChainId, limit: limit });
                    trendingAddresses = [];
                    wsAddressCount = 0;
                    isWSAvailable = (0, dexscreenerWS_js_1.isWSSupportedChain)(normalizedChainId);
                    useWebSocket = isWSAvailable;
                    QUALITY_MIN_LIQ_USD = 1000;
                    QUALITY_MIN_VOL_USD = 200;
                    if (!useWebSocket) return [3 /*break*/, 5];
                    _9.label = 2;
                case 2:
                    _9.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, dexscreenerWS_js_1.fetchTrendingAddresses)({
                            chain: normalizedChainId,
                            timeFrame: 'm5',
                            rankBy: 'trendingScoreM5'
                        })];
                case 3:
                    // Use 5m trending by default for "Live Trending"
                    trendingAddresses = _9.sent();
                    wsAddressCount = trendingAddresses.length;
                    if (wsAddressCount > 0) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.WTC_SWAP_DETECTED, 'WS addresses discovered', { wsCount: wsAddressCount, chain: normalizedChainId });
                    }
                    else {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'WS returned 0 addresses', { chain: normalizedChainId });
                    }
                    return [3 /*break*/, 5];
                case 4:
                    wsError_1 = _9.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener Premium WebSocket fetch failed', { error: wsError_1.message });
                    return [3 /*break*/, 5];
                case 5:
                    MIN_WS_ADDRESSES = 20;
                    if (!(trendingAddresses.length < MIN_WS_ADDRESSES)) return [3 /*break*/, 19];
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Using fallback discovery (Boosts + Organic search)', { wsAddressCount: trendingAddresses.length });
                    chainBoosts = [];
                    _9.label = 6;
                case 6:
                    _9.trys.push([6, 10, , 11]);
                    return [4 /*yield*/, fetch(DEXSCREENER_TOKEN_BOOSTS_URL)];
                case 7:
                    boostsResponse = _9.sent();
                    if (!boostsResponse.ok) return [3 /*break*/, 9];
                    return [4 /*yield*/, boostsResponse.json()];
                case 8:
                    boostsData = _9.sent();
                    chainBoosts = boostsData.filter(function (boost) { var _a; return ((_a = boost.chainId) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === normalizedChainId; });
                    _9.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    e_3 = _9.sent();
                    return [3 /*break*/, 11];
                case 11:
                    ORGANIC_SEARCH_TERMS = {
                        'base': ['uniswap', 'aerodrome', 'base', 'weth', 'usdc', 'zora'],
                        'ethereum': ['uniswap', 'ethereum', 'weth', 'usdc', 'usdt'],
                        'solana': ['raydium', 'jupiter', 'pump', 'sol', 'usdc'],
                        'bsc': ['pancakeswap', 'bnb', 'wbnb', 'usdt', 'busd'],
                        'arbitrum': ['uniswap', 'gmx', 'arbitrum', 'weth', 'usdc'],
                        'optimism': ['uniswap', 'velodrome', 'optimism', 'op', 'usdc'],
                        'polygon': ['uniswap', 'quickswap', 'polygon', 'matic', 'usdc', 'usdt'],
                    };
                    searchTerms = ORGANIC_SEARCH_TERMS[normalizedChainId] || ['uniswap', 'weth', 'usdc'];
                    organicTokenAddresses = new Set();
                    _i = 0, searchTerms_1 = searchTerms;
                    _9.label = 12;
                case 12:
                    if (!(_i < searchTerms_1.length)) return [3 /*break*/, 18];
                    searchTerm = searchTerms_1[_i];
                    _9.label = 13;
                case 13:
                    _9.trys.push([13, 16, , 17]);
                    searchUrl = "".concat(DEXSCREENER_BASE_URL, "/search?q=").concat(searchTerm);
                    return [4 /*yield*/, fetch(searchUrl)];
                case 14: return [4 /*yield*/, (_9.sent()).json()];
                case 15:
                    searchData = _9.sent();
                    if (searchData.pairs) {
                        for (_a = 0, _b = searchData.pairs; _a < _b.length; _a++) {
                            pair = _b[_a];
                            if (((_f = pair.chainId) === null || _f === void 0 ? void 0 : _f.toLowerCase()) !== normalizedChainId)
                                continue;
                            volume = parseFloat(((_g = pair.volume) === null || _g === void 0 ? void 0 : _g.h24) || '0');
                            liquidity = parseFloat(((_h = pair.liquidity) === null || _h === void 0 ? void 0 : _h.usd) || '0');
                            if (volume > 500000 || (liquidity > 100000 && volume > 50000)) {
                                baseAddr = (_k = (_j = pair.baseToken) === null || _j === void 0 ? void 0 : _j.address) === null || _k === void 0 ? void 0 : _k.toLowerCase();
                                if (baseAddr)
                                    organicTokenAddresses.add(baseAddr);
                            }
                        }
                    }
                    return [3 /*break*/, 17];
                case 16:
                    e_4 = _9.sent();
                    return [3 /*break*/, 17];
                case 17:
                    _i++;
                    return [3 /*break*/, 12];
                case 18:
                    boostedAddrs = chainBoosts.map(function (b) { var _a; return (_a = b.tokenAddress) === null || _a === void 0 ? void 0 : _a.toLowerCase(); });
                    fallbackAddresses = __spreadArray([], new Set(__spreadArray(__spreadArray([], boostedAddrs, true), Array.from(organicTokenAddresses), true)), true).filter(Boolean);
                    preMergeWsCount = trendingAddresses.length;
                    trendingAddresses = __spreadArray([], new Set(__spreadArray(__spreadArray([], trendingAddresses, true), fallbackAddresses, true)), true);
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Merged addresses', {
                        wsOriginal: wsAddressCount,
                        boostCount: chainBoosts.length,
                        organicCount: organicTokenAddresses.size,
                        fallbackTotal: fallbackAddresses.length,
                        mergedTotal: trendingAddresses.length
                    });
                    _9.label = 19;
                case 19:
                    if (trendingAddresses.length === 0) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'No trending tokens discovered for chain', { chain: normalizedChainId });
                        return [2 /*return*/, getTrendingTokensByChain(chainId, limit, '6h')];
                    }
                    tokensToEnrich = trendingAddresses.slice(0, Math.min(limit * 3, 150));
                    enrichedTokensMap = new Map();
                    batchSize = 30;
                    i = 0;
                    _9.label = 20;
                case 20:
                    if (!(i < tokensToEnrich.length)) return [3 /*break*/, 26];
                    batch = tokensToEnrich.slice(i, i + batchSize);
                    addressesParam = batch.join(',');
                    _9.label = 21;
                case 21:
                    _9.trys.push([21, 24, , 25]);
                    pairUrl = "https://api.dexscreener.com/tokens/v1/".concat(normalizedChainId, "/").concat(addressesParam);
                    return [4 /*yield*/, fetch(pairUrl)];
                case 22:
                    pairResponse = _9.sent();
                    if (!pairResponse.ok)
                        return [3 /*break*/, 25];
                    return [4 /*yield*/, pairResponse.json()];
                case 23:
                    pairData = _9.sent();
                    if (!Array.isArray(pairData))
                        return [3 /*break*/, 25];
                    for (_c = 0, pairData_1 = pairData; _c < pairData_1.length; _c++) {
                        pair = pairData_1[_c];
                        baseTokenAddr = (_m = (_l = pair.baseToken) === null || _l === void 0 ? void 0 : _l.address) === null || _m === void 0 ? void 0 : _m.toLowerCase();
                        if (!baseTokenAddr)
                            continue;
                        currentLiquidity = parseFloat(((_o = pair.liquidity) === null || _o === void 0 ? void 0 : _o.usd) || '0');
                        existing = enrichedTokensMap.get(baseTokenAddr);
                        existingLiquidity = typeof (existing === null || existing === void 0 ? void 0 : existing.liquidity) === 'string'
                            ? parseFloat(existing.liquidity)
                            : ((existing === null || existing === void 0 ? void 0 : existing.liquidity) || 0);
                        if (!existing || currentLiquidity > existingLiquidity) {
                            imageUrl = normalizeImageUrl((_p = pair.info) === null || _p === void 0 ? void 0 : _p.imageUrl);
                            volume24h = parseFloat(((_q = pair.volume) === null || _q === void 0 ? void 0 : _q.h24) || '0');
                            priceChange24h = parseFloat(((_r = pair.priceChange) === null || _r === void 0 ? void 0 : _r.h24) || '0');
                            symbol = ((_s = pair.baseToken) === null || _s === void 0 ? void 0 : _s.symbol) || 'UNKNOWN';
                            // Filter out native tokens, wrapped tokens, and stablecoins
                            if (EXCLUDED_TOKEN_SYMBOLS.has(symbol.toUpperCase()) || EXCLUDED_TOKEN_ADDRESSES.has(baseTokenAddr)) {
                                continue;
                            }
                            // Quality filter (looser when WS is available for Base/BSC to reduce Gecko fallback + rate limit risk)
                            if (currentLiquidity < QUALITY_MIN_LIQ_USD && volume24h < QUALITY_MIN_VOL_USD)
                                continue;
                            enrichedTokensMap.set(baseTokenAddr, {
                                address: ((_t = pair.baseToken) === null || _t === void 0 ? void 0 : _t.address) || baseTokenAddr,
                                name: ((_u = pair.baseToken) === null || _u === void 0 ? void 0 : _u.name) || 'Unknown',
                                symbol: ((_v = pair.baseToken) === null || _v === void 0 ? void 0 : _v.symbol) || 'UNKNOWN',
                                network: normalizedChainId,
                                price: parseFloat(pair.priceUsd || '0'),
                                priceChange24h: priceChange24h,
                                volume24h: volume24h,
                                liquidity: currentLiquidity,
                                fdv: parseFloat(pair.fdv || '0'),
                                poolAddress: pair.pairAddress,
                                poolCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
                                imageUrl: imageUrl || getTrustWalletImageUrl(normalizedChainId, baseTokenAddr),
                                txns24h: (((_x = (_w = pair.txns) === null || _w === void 0 ? void 0 : _w.h24) === null || _x === void 0 ? void 0 : _x.buys) || 0) + (((_z = (_y = pair.txns) === null || _y === void 0 ? void 0 : _y.h24) === null || _z === void 0 ? void 0 : _z.sells) || 0),
                                buys24h: ((_1 = (_0 = pair.txns) === null || _0 === void 0 ? void 0 : _0.h24) === null || _1 === void 0 ? void 0 : _1.buys) || 0,
                                sells24h: ((_3 = (_2 = pair.txns) === null || _2 === void 0 ? void 0 : _2.h24) === null || _3 === void 0 ? void 0 : _3.sells) || 0,
                                priceChange5m: parseFloat(((_4 = pair.priceChange) === null || _4 === void 0 ? void 0 : _4.m5) || '0'),
                                priceChange1h: parseFloat(((_5 = pair.priceChange) === null || _5 === void 0 ? void 0 : _5.h1) || '0'),
                                priceChange6h: parseFloat(((_6 = pair.priceChange) === null || _6 === void 0 ? void 0 : _6.h6) || '0'),
                                socials: (_7 = pair.info) === null || _7 === void 0 ? void 0 : _7.socials,
                                websites: (_8 = pair.info) === null || _8 === void 0 ? void 0 : _8.websites,
                            });
                        }
                    }
                    return [3 /*break*/, 25];
                case 24:
                    batchError_1 = _9.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener Premium Batch fetch error', { error: batchError_1.message });
                    return [3 /*break*/, 25];
                case 25:
                    i += batchSize;
                    return [3 /*break*/, 20];
                case 26:
                    scored = Array.from(enrichedTokensMap.values()).map(function (t) { return ({
                        token: t,
                        score: (0, trendingScore_js_1.computeTrendingScore)(t),
                    }); });
                    scored.sort(function (a, b) {
                        if (b.score !== a.score)
                            return b.score - a.score;
                        var bLiq = typeof b.token.liquidity === 'number' ? b.token.liquidity : 0;
                        var aLiq = typeof a.token.liquidity === 'number' ? a.token.liquidity : 0;
                        return bLiq - aLiq;
                    });
                    finalTokens = scored.map(function (s) { return s.token; }).slice(0, limit);
                    if (!(finalTokens.length < limit)) return [3 /*break*/, 34];
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Filling enriched tokens to limit', { current: finalTokens.length, target: limit });
                    existingAddresses = new Set(finalTokens.map(function (t) { return t.address.toLowerCase(); }));
                    _9.label = 27;
                case 27:
                    _9.trys.push([27, 29, , 30]);
                    return [4 /*yield*/, getTrendingTokensByChain(chainId, limit * 2, '6h')];
                case 28:
                    fallbackTokens = _9.sent();
                    for (_d = 0, fallbackTokens_1 = fallbackTokens; _d < fallbackTokens_1.length; _d++) {
                        token = fallbackTokens_1[_d];
                        if (finalTokens.length >= limit)
                            break;
                        if (!existingAddresses.has(token.address.toLowerCase())) {
                            finalTokens.push(token);
                            existingAddresses.add(token.address.toLowerCase());
                        }
                    }
                    return [3 /*break*/, 30];
                case 29:
                    fallbackError_1 = _9.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener Premium fill error', { error: fallbackError_1.message });
                    return [3 /*break*/, 30];
                case 30:
                    if (!(finalTokens.length < limit && !(options === null || options === void 0 ? void 0 : options.disableGeckoFill))) return [3 /*break*/, 34];
                    _9.label = 31;
                case 31:
                    _9.trys.push([31, 33, , 34]);
                    return [4 /*yield*/, (0, geckoTerminal_js_1.getTrendingTokens)(chainId, limit * 2, '5m', 1000, 10)];
                case 32:
                    geckoTokens = _9.sent();
                    for (_e = 0, geckoTokens_1 = geckoTokens; _e < geckoTokens_1.length; _e++) {
                        token = geckoTokens_1[_e];
                        if (finalTokens.length >= limit)
                            break;
                        if (!existingAddresses.has(token.address.toLowerCase())) {
                            finalTokens.push(token);
                            existingAddresses.add(token.address.toLowerCase());
                        }
                    }
                    return [3 /*break*/, 34];
                case 33:
                    geckoError_1 = _9.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener Premium Gecko fill error', { error: geckoError_1.message });
                    return [3 /*break*/, 34];
                case 34:
                    duration = Date.now() - startTime;
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Premium trending tokens fetch complete', {
                        count: finalTokens.length,
                        chain: normalizedChainId,
                        durationMs: duration,
                        source: wsAddressCount >= 20 ? 'WebSocket' : 'Fallback',
                        wsOriginal: wsAddressCount
                    });
                    // Step 6: Optional symbol de-dupe (only if we still have >= limit).
                    // Keeping duplicates is better for "always return 100" and closer to Dex raw pair lists.
                    if (finalTokens.length > limit) {
                        finalTokens = finalTokens.slice(0, limit);
                    }
                    return [2 /*return*/, finalTokens];
                case 35:
                    error_8 = _9.sent();
                    duration = Date.now() - startTime;
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener Premium Global error', { durationMs: duration, error: error_8.message });
                    return [2 /*return*/, getTrendingTokensByChain(chainId, limit, '6h')];
                case 36: return [2 /*return*/];
            }
        });
    });
}
