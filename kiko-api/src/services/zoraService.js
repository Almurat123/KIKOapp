"use strict";
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
exports.zoraService = exports.ZoraService = exports.BASE_PLATFORM_REFERRER = exports.ZORA_CREATOR_COIN_HOOKS = void 0;
var zoraSdk = require("@zoralabs/coins-sdk");
var _a = zoraSdk, getCoin = _a.getCoin, getProfile = _a.getProfile, setApiKey = _a.setApiKey, getCoinsTopGainers = _a.getCoinsTopGainers, getCoinsTopVolume24h = _a.getCoinsTopVolume24h, getCoinsNew = _a.getCoinsNew, getCreatorCoins = _a.getCreatorCoins, getProfileBalances = _a.getProfileBalances, getProfileSocial = _a.getProfileSocial;
var ethers_1 = require("ethers");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var unifiedApiService_js_1 = require("../config/unifiedApiService.js");
var platformFeeService_js_1 = require("./platformFeeService.js");
var CHAIN_ID = 8453; // Base Mainnet
var ZORA_SDK_BASE_URL = "https://api-sdk.zora.engineering";
// Hook Addresses for Coin Classification
// Note: These are known hook addresses, but new ones may be added
exports.ZORA_CREATOR_COIN_HOOKS = [
    "0xd61A675F8a0c67A73DC3B54FB7318B4D91409040", // Original Creator Coin Hook
    "0xc8d077444625eb300a427a6dfb2b1dbf9b159040", // Newer Creator Coin Hook (e.g., Jesse's)
    "0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040", // New Creator Coin Hook (e.g. Jacob's)
];
exports.BASE_PLATFORM_REFERRER = "0x55c88bb05602da94fce8feadc1cbebf5b72c2453";
var ZoraService = /** @class */ (function () {
    function ZoraService() {
        // In-memory cache for current refresh cycle (avoids duplicate API calls)
        this.coinCache = new Map();
        this.profileCache = new Map();
        this.coinErrorBackoff = new Map();
        // Initialize API key if available in environment
        var apiKey = process.env.ZORA_API_KEY;
        if (apiKey && typeof setApiKey === 'function') {
            setApiKey(apiKey);
            logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_STARTUP, 'Zora SDK initialized with API Key');
        }
    }
    ZoraService.prototype.getTradeReferrer = function (feeContext, bpsOverride) {
        var fee = (0, platformFeeService_js_1.getPlatformFee)(feeContext || 'swap', bpsOverride);
        if (fee.bps <= 0)
            return undefined;
        return (0, platformFeeService_js_1.isValidEvmAddress)(fee.evmRecipient) ? fee.evmRecipient : undefined;
    };
    ZoraService.prototype.createTradeCallWithReferrer = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var referrer, apiKey, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (params.slippage && params.slippage > 1) {
                            throw new Error("Slippage must be less than 1, max 0.99");
                        }
                        if (params.amountIn === BigInt(0)) {
                            throw new Error("Amount in must be greater than 0");
                        }
                        referrer = this.getTradeReferrer(params.feeContext, params.feeBpsOverride);
                        apiKey = process.env.ZORA_API_KEY;
                        return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                                url: "".concat(ZORA_SDK_BASE_URL, "/quote"),
                                method: 'POST',
                                headers: __assign({ 'Content-Type': 'application/json' }, (apiKey ? { 'api-key': apiKey } : {})),
                                body: JSON.stringify({
                                    tokenIn: params.sell,
                                    tokenOut: params.buy,
                                    amountIn: params.amountIn.toString(),
                                    slippage: params.slippage,
                                    chainId: CHAIN_ID,
                                    sender: params.sender,
                                    recipient: params.recipient || params.sender,
                                    signatures: params.signatures,
                                    permitActiveSeconds: params.permitActiveSeconds,
                                    referrer: referrer
                                })
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response) {
                            throw new Error('Quote failed');
                        }
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Get a coin by its contract address using the SDK
     */
    ZoraService.prototype.getCoinByAddress = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var key, backoffUntil, cached, response, token, coinType, hookAddress_1, isBaseAppCoin, coin, error_1, key;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        _m.trys.push([0, 2, , 3]);
                        key = address.toLowerCase();
                        backoffUntil = this.coinErrorBackoff.get(key) || 0;
                        if (Date.now() < backoffUntil) {
                            return [2 /*return*/, null];
                        }
                        cached = this.coinCache.get(key);
                        if (cached !== undefined) {
                            return [2 /*return*/, cached];
                        }
                        return [4 /*yield*/, getCoin({
                                address: address,
                                chain: CHAIN_ID,
                            })];
                    case 1:
                        response = _m.sent();
                        token = (_a = response.data) === null || _a === void 0 ? void 0 : _a.zora20Token;
                        if (!token) {
                            this.coinCache.set(key, null);
                            return [2 /*return*/, null];
                        }
                        coinType = 'UNKNOWN';
                        hookAddress_1 = (_c = (_b = token.uniswapV4PoolKey) === null || _b === void 0 ? void 0 : _b.hookAddress) === null || _c === void 0 ? void 0 : _c.toLowerCase();
                        if (hookAddress_1) {
                            // console.log(`[ZoraService] Inspecting Hook for ${token.symbol}: ${hookAddress}`);
                        }
                        if (hookAddress_1 && exports.ZORA_CREATOR_COIN_HOOKS.some(function (h) { return h.toLowerCase() === hookAddress_1; })) {
                            coinType = 'CREATOR';
                        }
                        else if (hookAddress_1) {
                            logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'Zora UNKNOWN HOOK detected', { symbol: token.symbol, address: address, hookAddress: hookAddress_1 });
                        }
                        isBaseAppCoin = ((_d = token.platformReferrerAddress) === null || _d === void 0 ? void 0 : _d.toLowerCase()) === exports.BASE_PLATFORM_REFERRER.toLowerCase();
                        coin = {
                            id: token.id,
                            name: token.name,
                            symbol: token.symbol,
                            address: token.address,
                            chainId: CHAIN_ID,
                            coinType: coinType,
                            isBaseAppCoin: isBaseAppCoin,
                            tokenUri: token.tokenUri || undefined,
                            createdAt: token.createdAt || '',
                            marketCap: token.marketCap || '0',
                            volume24h: token.volume24h || '0',
                            description: token.description || undefined,
                            totalSupply: token.totalSupply || undefined,
                            totalVolume: token.totalVolume || undefined,
                            mediaContent: {
                                previewImage: {
                                    small: ((_f = (_e = token.mediaContent) === null || _e === void 0 ? void 0 : _e.previewImage) === null || _f === void 0 ? void 0 : _f.small) || undefined,
                                    medium: ((_h = (_g = token.mediaContent) === null || _g === void 0 ? void 0 : _g.previewImage) === null || _h === void 0 ? void 0 : _h.medium) || undefined
                                },
                                originalUri: ((_j = token.mediaContent) === null || _j === void 0 ? void 0 : _j.originalUri) || undefined
                            },
                            uniqueHolders: token.uniqueHolders || 0,
                            creatorAddress: token.creatorAddress || '',
                            creatorProfile: token.creatorProfile ? {
                                handle: token.creatorProfile.handle || undefined,
                                avatar: ((_l = (_k = token.creatorProfile.avatar) === null || _k === void 0 ? void 0 : _k.previewImage) === null || _l === void 0 ? void 0 : _l.medium) || undefined,
                                socialAccounts: token.creatorProfile.socialAccounts ? {
                                    twitter: token.creatorProfile.socialAccounts.twitter ? {
                                        username: token.creatorProfile.socialAccounts.twitter.username || '',
                                        displayName: token.creatorProfile.socialAccounts.twitter.displayName || '',
                                        followerCount: token.creatorProfile.socialAccounts.twitter.followerCount || 0
                                    } : undefined,
                                    farcaster: token.creatorProfile.socialAccounts.farcaster ? {
                                        username: token.creatorProfile.socialAccounts.farcaster.username || '',
                                        id: token.creatorProfile.socialAccounts.farcaster.id || '',
                                    } : undefined
                                } : undefined
                            } : undefined,
                            tokenPrice: token.tokenPrice ? {
                                priceInUsdc: token.tokenPrice.priceInUsdc || '0',
                                priceInPoolToken: token.tokenPrice.priceInPoolToken || '0'
                            } : undefined
                        };
                        // Cache successful result
                        this.coinCache.set(key, coin);
                        this.coinErrorBackoff.delete(key);
                        return [2 /*return*/, coin];
                    case 2:
                        error_1 = _m.sent();
                        key = address.toLowerCase();
                        this.coinErrorBackoff.set(key, Date.now() + 30000);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a user's profile including Creator Coin and Social Accounts
     * Uses official SDK getProfile function
     */
    ZoraService.prototype.getUserProfile = function (identifier) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, profile, response, response, result, error_2;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 5, , 6]);
                        cached = this.profileCache.get(identifier.toLowerCase());
                        if (cached !== undefined) {
                            return [2 /*return*/, cached];
                        }
                        profile = void 0;
                        if (!(typeof getProfileSocial === 'function')) return [3 /*break*/, 2];
                        return [4 /*yield*/, getProfileSocial({ query: { identifier: identifier } })];
                    case 1:
                        response = _f.sent();
                        profile = (_a = response.data) === null || _a === void 0 ? void 0 : _a.profile;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, getProfile({ identifier: identifier })];
                    case 3:
                        response = _f.sent();
                        profile = (_b = response.data) === null || _b === void 0 ? void 0 : _b.profile;
                        _f.label = 4;
                    case 4:
                        if (!profile) {
                            this.profileCache.set(identifier.toLowerCase(), null);
                            return [2 /*return*/, null];
                        }
                        result = {
                            handle: profile.handle || undefined,
                            displayName: profile.displayName || undefined,
                            bio: profile.bio || undefined,
                            avatar: ((_c = profile.avatar) === null || _c === void 0 ? void 0 : _c.medium) || ((_e = (_d = profile.avatar) === null || _d === void 0 ? void 0 : _d.previewImage) === null || _e === void 0 ? void 0 : _e.medium) || undefined,
                            socialAccounts: profile.socialAccounts ? {
                                twitter: profile.socialAccounts.twitter ? {
                                    username: profile.socialAccounts.twitter.username || '',
                                    displayName: profile.socialAccounts.twitter.displayName || '',
                                    followerCount: profile.socialAccounts.twitter.followerCount
                                } : undefined,
                                farcaster: profile.socialAccounts.farcaster ? {
                                    username: profile.socialAccounts.farcaster.username || '',
                                    displayName: profile.socialAccounts.farcaster.displayName || '',
                                    followerCount: profile.socialAccounts.farcaster.followerCount,
                                    id: profile.socialAccounts.farcaster.id
                                } : undefined,
                                instagram: profile.socialAccounts.instagram ? {
                                    username: profile.socialAccounts.instagram.username || '',
                                    displayName: profile.socialAccounts.instagram.displayName || '',
                                    followerCount: profile.socialAccounts.instagram.followerCount
                                } : undefined,
                                tiktok: profile.socialAccounts.tiktok ? {
                                    username: profile.socialAccounts.tiktok.username || '',
                                    displayName: profile.socialAccounts.tiktok.displayName || '',
                                    followerCount: profile.socialAccounts.tiktok.followerCount
                                } : undefined
                            } : undefined,
                            creatorCoin: profile.creatorCoin ? {
                                address: profile.creatorCoin.address,
                                marketCap: profile.creatorCoin.marketCap || '0',
                                marketCapDelta24h: profile.creatorCoin.marketCapDelta24h
                            } : undefined
                        };
                        this.profileCache.set(identifier.toLowerCase(), result);
                        return [2 /*return*/, result];
                    case 5:
                        error_2 = _f.sent();
                        this.profileCache.set(identifier.toLowerCase(), null);
                        return [2 /*return*/, null];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all Zora coin balances for a user
     * Docs: https://docs.zora.co/coins/sdk/queries/profile#getprofilebalances
     */
    ZoraService.prototype.getUserBalances = function (walletAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var timeoutPromise, response, profile, edges, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        if (typeof getProfileBalances !== 'function')
                            return [2 /*return*/, []];
                        timeoutPromise = new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error('Timeout')); }, 10000);
                        });
                        return [4 /*yield*/, Promise.race([
                                getProfileBalances({ identifier: walletAddress, count: 50 }),
                                timeoutPromise
                            ])];
                    case 1:
                        response = _b.sent();
                        profile = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.profile;
                        if (!profile || !profile.coinBalances)
                            return [2 /*return*/, []];
                        edges = profile.coinBalances.edges || [];
                        return [2 /*return*/, Array.isArray(edges) ? edges.map(function (edge) { return edge.node || edge; }) : []];
                    case 2:
                        error_3 = _b.sent();
                        if (error_3.message === 'Timeout') {
                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_TIMEOUT, 'Timeout fetching Zora balances', { walletAddress: walletAddress });
                        }
                        else {
                            logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching Zora balances', { walletAddress: walletAddress, error: error_3.message });
                        }
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get top gainers from Zora
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcoinstopgainers
     */
    ZoraService.prototype.getTopGainers = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var response, edges, error_4;
            var _a, _b;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        if (typeof getCoinsTopGainers !== 'function')
                            return [2 /*return*/, []];
                        return [4 /*yield*/, getCoinsTopGainers({ count: limit })];
                    case 1:
                        response = _c.sent();
                        edges = ((_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.exploreList) === null || _b === void 0 ? void 0 : _b.edges) || [];
                        return [2 /*return*/, Array.isArray(edges) ? edges.map(function (edge) { return edge.node; }) : []];
                    case 2:
                        error_4 = _c.sent();
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching Zora top gainers', { error: error_4.message });
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get coins with highest 24h volume
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcoinstopvolume24h
     */
    ZoraService.prototype.getTopVolume24h = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var response, edges, error_5;
            var _a, _b;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        if (typeof getCoinsTopVolume24h !== 'function')
                            return [2 /*return*/, []];
                        return [4 /*yield*/, getCoinsTopVolume24h({ count: limit })];
                    case 1:
                        response = _c.sent();
                        edges = ((_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.exploreList) === null || _b === void 0 ? void 0 : _b.edges) || [];
                        return [2 /*return*/, Array.isArray(edges) ? edges.map(function (edge) { return edge.node; }) : []];
                    case 2:
                        error_5 = _c.sent();
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching Zora top volume', { error: error_5.message });
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get newly created coins
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcoinsnew
     */
    ZoraService.prototype.getNewCoins = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var response, edges, error_6;
            var _a, _b;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        if (typeof getCoinsNew !== 'function')
                            return [2 /*return*/, []];
                        return [4 /*yield*/, getCoinsNew({ count: limit })];
                    case 1:
                        response = _c.sent();
                        edges = ((_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.exploreList) === null || _b === void 0 ? void 0 : _b.edges) || [];
                        return [2 /*return*/, Array.isArray(edges) ? edges.map(function (edge) { return edge.node; }) : []];
                    case 2:
                        error_6 = _c.sent();
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching Zora new coins', { error: error_6.message });
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get coins launched by new creators
     * Docs: https://docs.zora.co/coins/sdk/queries/explore#getcreatorcoins
     */
    ZoraService.prototype.getNewCreatorCoins = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var response, edges, error_7;
            var _a, _b;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        if (typeof getCreatorCoins !== 'function')
                            return [2 /*return*/, []];
                        return [4 /*yield*/, getCreatorCoins({ count: limit })];
                    case 1:
                        response = _c.sent();
                        edges = ((_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.exploreList) === null || _b === void 0 ? void 0 : _b.edges) || [];
                        return [2 /*return*/, Array.isArray(edges) ? edges.map(function (edge) { return edge.node; }) : []];
                    case 2:
                        error_7 = _c.sent();
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching Zora new creator coins', { error: error_7.message });
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get combined list of new coins from both "New Coins" (all types) and "Creator Coins" (new creators).
     * This ensures we cover both:
     * 1. New creators launching their first coin (getCreatorCoins)
     * 2. Existing creators launching new coins (getNewCoins - filtered)
     */
    ZoraService.prototype.getCombinedNewCoins = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var _a, newCoins, creatorCoins, coinMap_1, error_8;
            if (limit === void 0) { limit = 20; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.all([
                                this.getNewCoins(limit),
                                this.getNewCreatorCoins(limit)
                            ])];
                    case 1:
                        _a = _b.sent(), newCoins = _a[0], creatorCoins = _a[1];
                        coinMap_1 = new Map();
                        // Add all coins to map
                        __spreadArray(__spreadArray([], newCoins, true), creatorCoins, true).forEach(function (coin) {
                            if (coin && coin.address) {
                                coinMap_1.set(coin.address.toLowerCase(), coin);
                            }
                        });
                        // Convert back to array
                        return [2 /*return*/, Array.from(coinMap_1.values())];
                    case 2:
                        error_8 = _b.sent();
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Error fetching combined Zora coins', { error: error_8.message });
                        // Fallback: try at least one source if the combined failed (though unlikely if specific methods handle errors)
                        // Since individual methods catch errors and return [], we likely just got strict [] here if both failed.
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clear in-memory caches (call at start of each refresh cycle)
     */
    ZoraService.prototype.clearCache = function () {
        this.coinCache.clear();
        this.profileCache.clear();
        this.coinErrorBackoff.clear();
    };
    /**
     * Get a user's Creator Coin (if they have one)
     * Uses getUserProfile and then fetches full coin details
     */
    ZoraService.prototype.getUserCreatorCoin = function (userAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var profile, error_9;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.getUserProfile(userAddress)];
                    case 1:
                        profile = _b.sent();
                        if (!((_a = profile === null || profile === void 0 ? void 0 : profile.creatorCoin) === null || _a === void 0 ? void 0 : _a.address)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.getCoinByAddress(profile.creatorCoin.address)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3: return [2 /*return*/, null];
                    case 4:
                        error_9 = _b.sent();
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Zora Creator Coin Error', { userAddress: userAddress, error: error_9.message });
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Format market cap as USD string
     */
    ZoraService.prototype.formatMarketCap = function (marketCap) {
        var value = parseFloat(marketCap);
        if (isNaN(value) || value === 0)
            return '';
        if (value >= 1000000000) {
            return "$".concat((value / 1000000000).toFixed(1), "B");
        }
        else if (value >= 1000000) {
            return "$".concat((value / 1000000).toFixed(1), "M");
        }
        else if (value >= 1000) {
            return "$".concat((value / 1000).toFixed(1), "K");
        }
        else {
            return "$".concat(value.toFixed(0));
        }
    };
    /**
     * Build a buy transaction call (ETH -> Token)
     */
    ZoraService.prototype.buildBuyTransactionCall = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createTradeCallWithReferrer({
                            sell: { type: "eth" },
                            buy: { type: "erc20", address: params.tokenAddress },
                            amountIn: ethers_1.ethers.parseEther(params.amountInEth),
                            sender: params.sender,
                            slippage: params.slippage || 0.05,
                            feeContext: params.feeContext,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Build a sell transaction call (Token -> ETH)
     */
    ZoraService.prototype.buildSellTransactionCall = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createTradeCallWithReferrer({
                            sell: { type: "erc20", address: params.tokenAddress },
                            buy: { type: "eth" },
                            amountIn: BigInt(params.amountInToken), // Smallest unit
                            sender: params.sender,
                            slippage: params.slippage || 0.05,
                            feeContext: params.feeContext,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return ZoraService;
}());
exports.ZoraService = ZoraService;
exports.zoraService = new ZoraService();
