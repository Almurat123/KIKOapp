"use strict";
/**
 * Token Data Refresh Job
 * Runs periodically to fetch and store trending tokens for multiple chains
 *
 * Supported chains: Ethereum, Base, BSC, Arbitrum
 * Uses GeckoTerminal (free) as primary source, DexScreener as fallback
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
exports.enrichLaunchMultiplesOnDemand = enrichLaunchMultiplesOnDemand;
exports.setGeckoBackoff = setGeckoBackoff;
exports.refreshSingleChain = refreshSingleChain;
exports.getSupportedChains = getSupportedChains;
exports.startTokenDataJobs = startTokenDataJobs;
var node_cron_1 = require("node-cron");
var dexscreener_js_1 = require("../services/dexscreener.js");
var tokenRepository_js_1 = require("../repositories/tokenRepository.js");
var memoryCache_js_1 = require("../cache/memoryCache.js");
var trendingValidation_js_1 = require("../services/trendingValidation.js");
var launchpadDetector_js_1 = require("../services/ai/launchpadDetector.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var p_limit_1 = require("p-limit");
var cacheClient_js_1 = require("../cache/cacheClient.js");
var onChainPriceService_js_1 = require("../services/onChainPriceService.js");
var launchpadMultipleService_js_1 = require("../services/launchpadMultipleService.js");
var prisma_js_1 = require("../db/prisma.js");
var runtimeActivityService_js_1 = require("../services/runtimeActivityService.js");
/**
 * Supported chains configuration
 * PRIMARY: High-volume chains refreshed every 5 minutes
 * SECONDARY: Low-volume chains refreshed every 4 hours
 */
var PRIMARY_CHAINS = [
    { id: 'eth', name: 'Ethereum', geckoNetwork: 'eth' },
    { id: 'solana', name: 'Solana', geckoNetwork: 'solana' },
    { id: 'base', name: 'Base', geckoNetwork: 'base' },
    { id: 'bsc', name: 'BSC', geckoNetwork: 'bsc' },
];
var SECONDARY_CHAINS = [
    { id: 'arbitrum', name: 'Arbitrum', geckoNetwork: 'arbitrum' },
    { id: 'optimism', name: 'Optimism', geckoNetwork: 'optimism' },
    { id: 'polygon', name: 'Polygon', geckoNetwork: 'polygon_pos' },
];
var SUPPORTED_CHAINS = __spreadArray(__spreadArray([], PRIMARY_CHAINS, true), SECONDARY_CHAINS, true);
// Refresh intervals
var PRIMARY_REFRESH_INTERVAL_MINUTES = 5; // Main chains: every 5 minutes
var SECONDARY_REFRESH_INTERVAL_HOURS = 4; // Secondary chains: every 4 hours
// Delay between chains (串行执行，避免并发)
var PRIMARY_CHAIN_DELAY_MS = 30000; // 30 seconds between primary chains
var SECONDARY_CHAIN_DELAY_MS = 60000; // 60 seconds between secondary chains
// Number of tokens to fetch per chain
var TOKENS_PER_CHAIN = 100;
var LAUNCHPAD_DETECT_CONCURRENCY = Math.max(1, Number(process.env.LAUNCHPAD_DETECT_CONCURRENCY || '2'));
var LAUNCH_MULTIPLE_ENRICH_ENABLED = true;
var LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN = Math.max(16, Number(process.env.LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN || '48'));
var BASE_DOPPLER_VERIFY_BUDGET_PER_RUN = Math.max(8, Number(process.env.BASE_DOPPLER_VERIFY_BUDGET_PER_RUN || '24'));
var BASE_DOPPLER_VERIFY_CONCURRENCY = Math.max(1, Number(process.env.BASE_DOPPLER_VERIFY_CONCURRENCY || '2'));
var TOKEN_META_CACHE_TTL_SECONDS = Math.max(60 * 60, Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || "".concat(6 * 60 * 60)));
var LAUNCHPAD_CLEAR_FAIL_THRESHOLD = Math.max(2, Number(process.env.LAUNCHPAD_CLEAR_FAIL_THRESHOLD || '3'));
var LAUNCHPAD_CLEAR_FAIL_TTL_SECONDS = Math.max(5 * 60, Number(process.env.LAUNCHPAD_CLEAR_FAIL_TTL_SECONDS || "".concat(30 * 60)));
var LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN = Math.max(4, Number(process.env.LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN || '12'));
var LAUNCHPAD_CREATOR_DISCOVERY_BUDGET_PER_RUN = Math.max(2, Number(process.env.LAUNCHPAD_CREATOR_DISCOVERY_BUDGET_PER_RUN || '6'));
/**
 * Token refresh should not stop completely when the app is idle.
 * Primary chains keep a 5 minute cadence while users are active, but
 * fall back to a 30 minute cadence when there has been no recent traffic.
 */
var TOKEN_IDLE_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
function resolveChainId(chainId) {
    if (chainId === 'eth')
        return 1;
    if (chainId === 'base')
        return 8453;
    if (chainId === 'bsc')
        return 56;
    if (chainId === 'arbitrum')
        return 42161;
    if (chainId === 'optimism')
        return 10;
    if (chainId === 'polygon')
        return 137;
    return null;
}
function pickVerifyTargets(rows, budget) {
    if (rows.length <= budget)
        return rows;
    var windowSizeMs = 5 * 60 * 1000; // rotate with refresh cadence
    var cursor = Math.floor(Date.now() / windowSizeMs);
    var start = (cursor * budget) % rows.length;
    var end = start + budget;
    if (end <= rows.length)
        return rows.slice(start, end);
    return __spreadArray(__spreadArray([], rows.slice(start), true), rows.slice(0, end - rows.length), true);
}
function detectBySuffix(chainId, address) {
    var lower = address.toLowerCase();
    if ((chainId === 'base' || chainId === 'eth') && lower.endsWith('b07'))
        return 'clanker';
    if (chainId === 'bsc' && (lower.endsWith('4444') || lower.endsWith('ffff')))
        return 'four.meme';
    if (chainId === 'bsc' && (lower.endsWith('8888') || lower.endsWith('7777')))
        return 'flap';
    if (chainId === 'solana' && lower.endsWith('pump'))
        return 'pump.fun';
    if (chainId === 'solana' && lower.endsWith('bonk'))
        return 'bonk.fun';
    return null;
}
function normalizeLaunchpadProvider(provider) {
    if (!provider)
        return null;
    if (provider === 'pumpfun')
        return 'pump.fun';
    if (provider === 'pumpswap')
        return 'pump.swap';
    if (provider === 'bonkfun')
        return 'bonk.fun';
    if (provider === 'fourmeme')
        return 'four.meme';
    if (provider === 'flaunch.gg')
        return 'flaunch';
    if (provider === 'creator.bid')
        return 'creatorbid';
    if (provider === 'doppler finance' || provider === 'dopplerfinance')
        return 'doppler';
    return provider;
}
function sanitizeCreatorForLaunchpad(token) {
    if (String(token.launchpad || '').toLowerCase() !== 'flap')
        return;
    delete token.creatorAddress;
    delete token.creatorUrl;
    delete token.creatorLabel;
}
function initialPoolCacheKey(chainId, address) {
    return "token:initial_pool:v2:".concat(chainId, ":").concat(address.toLowerCase());
}
function initialPoolLegacyCacheKey(chainId, address) {
    return "initial_pool:".concat(chainId, ":").concat(address.toLowerCase());
}
function tokenMetaCacheKey(chainId, address) {
    return "token:meta:v2:".concat(chainId, ":").concat(address.toLowerCase());
}
function tokenMetaLegacyCacheKey(chainId, address) {
    return "token:meta:v1:".concat(chainId, ":").concat(address.toLowerCase());
}
function tokenMetaCompatV2Key(chainId, address) {
    return "token_meta_v2:".concat(chainId, ":").concat(address.toLowerCase());
}
function tokenMetaCompatV1Key(chainId, address) {
    return "token_meta:".concat(chainId, ":").concat(address.toLowerCase());
}
function launchpadClearFailKey(chainId, address) {
    return "launchpad:clear_fail:v1:".concat(chainId, ":").concat(address.toLowerCase());
}
function nativeUsdMissCacheKey(chainId, date) {
    return "native_usd_miss:".concat(chainId, ":").concat(date);
}
function fetchJson(options) {
    return __awaiter(this, void 0, void 0, function () {
        var url, headers, _a, method, body, _b, timeout, controller, timer, resp, data;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    url = options.url, headers = options.headers, _a = options.method, method = _a === void 0 ? 'GET' : _a, body = options.body, _b = options.timeout, timeout = _b === void 0 ? 10000 : _b;
                    controller = new AbortController();
                    timer = setTimeout(function () { return controller.abort(); }, timeout);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, , 4, 5]);
                    return [4 /*yield*/, fetch(url, {
                            method: method,
                            headers: headers,
                            body: body ? JSON.stringify(body) : undefined,
                            signal: controller.signal,
                        })];
                case 2:
                    resp = _c.sent();
                    if (!resp.ok) {
                        throw new Error("fetchJson failed: ".concat(resp.status, " ").concat(resp.statusText, " URL=").concat(url));
                    }
                    return [4 /*yield*/, resp.json()];
                case 3:
                    data = _c.sent();
                    return [2 /*return*/, data];
                case 4:
                    clearTimeout(timer);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
var historicalNativeUsdByDate = new Map();
var missingHistoricalNativeUsdUntil = new Map();
var NATIVE_USD_MISS_TTL_SECONDS = Math.max(30 * 60, Number(process.env.NATIVE_USD_MISS_TTL_SECONDS || "".concat(6 * 60 * 60)));
function getCoinbaseSymbolByChainId(chainId) {
    if (chainId === 56)
        return 'BNB';
    if (chainId === 137)
        return 'MATIC';
    if (chainId === 900)
        return 'SOL';
    if ([1, 10, 8453, 42161].includes(chainId))
        return 'ETH';
    return null;
}
function toUtcDate(tsSec) {
    var d = new Date(Math.max(0, tsSec) * 1000);
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var day = String(d.getUTCDate()).padStart(2, '0');
    return "".concat(y, "-").concat(m, "-").concat(day);
}
function getNativeUsdOnDate(chainId, tsSec) {
    return __awaiter(this, void 0, void 0, function () {
        var spot, symbol, spot, date, key, now, missingUntil, rawMiss, redisUntil, _a, cached, url, data, px, _b, until, _c, _d, until, _e, ageSec, spot, _f;
        var _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    if (!(!Number.isFinite(Number(tsSec)) || Number(tsSec) <= 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, onChainPriceService_js_1.getNativeTokenPriceUsd)(chainId)];
                case 1:
                    spot = _h.sent();
                    return [2 /*return*/, Number.isFinite(spot) && spot > 0 ? spot : null];
                case 2:
                    symbol = getCoinbaseSymbolByChainId(chainId);
                    if (!!symbol) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, onChainPriceService_js_1.getNativeTokenPriceUsd)(chainId)];
                case 3:
                    spot = _h.sent();
                    return [2 /*return*/, Number.isFinite(spot) && spot > 0 ? spot : null];
                case 4:
                    date = toUtcDate(Number(tsSec));
                    key = "".concat(chainId, ":").concat(date);
                    now = Date.now();
                    missingUntil = missingHistoricalNativeUsdUntil.get(key) || 0;
                    if (missingUntil > now)
                        return [2 /*return*/, null];
                    _h.label = 5;
                case 5:
                    _h.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(nativeUsdMissCacheKey(chainId, date))];
                case 6:
                    rawMiss = _h.sent();
                    redisUntil = Number(rawMiss || 0);
                    if (Number.isFinite(redisUntil) && redisUntil > now) {
                        missingHistoricalNativeUsdUntil.set(key, redisUntil);
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 8];
                case 7:
                    _a = _h.sent();
                    return [3 /*break*/, 8];
                case 8:
                    cached = historicalNativeUsdByDate.get(key);
                    if (Number.isFinite(cached || NaN) && (cached || 0) > 0)
                        return [2 /*return*/, Number(cached)];
                    _h.label = 9;
                case 9:
                    _h.trys.push([9, 20, , 25]);
                    url = "https://api.coinbase.com/v2/prices/".concat(symbol, "-USD/spot?date=").concat(date);
                    return [4 /*yield*/, fetchJson({
                            url: url,
                            headers: { Accept: 'application/json', 'User-Agent': 'KiKo/1.0' },
                        })];
                case 10:
                    data = _h.sent();
                    px = Number(((_g = data === null || data === void 0 ? void 0 : data.data) === null || _g === void 0 ? void 0 : _g.amount) || 0);
                    if (!(Number.isFinite(px) && px > 0)) return [3 /*break*/, 15];
                    historicalNativeUsdByDate.set(key, px);
                    missingHistoricalNativeUsdUntil.delete(key);
                    _h.label = 11;
                case 11:
                    _h.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(nativeUsdMissCacheKey(chainId, date), '0', 1)];
                case 12:
                    _h.sent();
                    return [3 /*break*/, 14];
                case 13:
                    _b = _h.sent();
                    return [3 /*break*/, 14];
                case 14: return [2 /*return*/, px];
                case 15:
                    until = now + NATIVE_USD_MISS_TTL_SECONDS * 1000;
                    missingHistoricalNativeUsdUntil.set(key, until);
                    _h.label = 16;
                case 16:
                    _h.trys.push([16, 18, , 19]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(nativeUsdMissCacheKey(chainId, date), String(until), NATIVE_USD_MISS_TTL_SECONDS)];
                case 17:
                    _h.sent();
                    return [3 /*break*/, 19];
                case 18:
                    _c = _h.sent();
                    return [3 /*break*/, 19];
                case 19: return [3 /*break*/, 25];
                case 20:
                    _d = _h.sent();
                    until = now + NATIVE_USD_MISS_TTL_SECONDS * 1000;
                    missingHistoricalNativeUsdUntil.set(key, until);
                    _h.label = 21;
                case 21:
                    _h.trys.push([21, 23, , 24]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(nativeUsdMissCacheKey(chainId, date), String(until), NATIVE_USD_MISS_TTL_SECONDS)];
                case 22:
                    _h.sent();
                    return [3 /*break*/, 24];
                case 23:
                    _e = _h.sent();
                    return [3 /*break*/, 24];
                case 24: return [3 /*break*/, 25];
                case 25:
                    ageSec = Math.abs(Date.now() / 1000 - Number(tsSec));
                    if (!(ageSec <= 48 * 3600)) return [3 /*break*/, 32];
                    return [4 /*yield*/, (0, onChainPriceService_js_1.getNativeTokenPriceUsd)(chainId)];
                case 26:
                    spot = _h.sent();
                    if (!(Number.isFinite(spot) && spot > 0)) return [3 /*break*/, 31];
                    historicalNativeUsdByDate.set(key, spot);
                    missingHistoricalNativeUsdUntil.delete(key);
                    _h.label = 27;
                case 27:
                    _h.trys.push([27, 29, , 30]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(nativeUsdMissCacheKey(chainId, date), '0', 1)];
                case 28:
                    _h.sent();
                    return [3 /*break*/, 30];
                case 29:
                    _f = _h.sent();
                    return [3 /*break*/, 30];
                case 30: return [2 /*return*/, spot];
                case 31: return [3 /*break*/, 33];
                case 32:
                    console.warn("[getNativeUsdOnDate] Coinbase historical price unavailable for ".concat(symbol, " on ").concat(date, ", age=").concat((ageSec / 3600).toFixed(0), "h \u2014 skipping spot fallback to avoid baseline corruption"));
                    _h.label = 33;
                case 33: return [2 /*return*/, null];
            }
        });
    });
}
function readTokenMetaCache(chainId, address) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, fromLegacy, parsed, cacheVersion, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(tokenMetaCacheKey(chainId, address))];
                case 1:
                    raw = _b.sent();
                    fromLegacy = false;
                    if (!!raw) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(tokenMetaLegacyCacheKey(chainId, address))];
                case 2:
                    raw = _b.sent();
                    fromLegacy = !!raw;
                    _b.label = 3;
                case 3:
                    if (!!raw) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(tokenMetaCompatV2Key(chainId, address))];
                case 4:
                    raw = _b.sent();
                    fromLegacy = !!raw;
                    _b.label = 5;
                case 5:
                    if (!!raw) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(tokenMetaCompatV1Key(chainId, address))];
                case 6:
                    raw = _b.sent();
                    fromLegacy = !!raw;
                    _b.label = 7;
                case 7:
                    if (!raw)
                        return [2 /*return*/, null];
                    parsed = JSON.parse(raw);
                    if (!parsed || typeof parsed !== 'object')
                        return [2 /*return*/, null];
                    cacheVersion = Number((parsed === null || parsed === void 0 ? void 0 : parsed.cacheVersion) || 0);
                    if (fromLegacy || cacheVersion < 2) {
                        return [2 /*return*/, {
                                creatorAddress: parsed.creatorAddress,
                                creatorUrl: parsed.creatorUrl,
                                creatorLabel: parsed.creatorLabel,
                                updatedAt: parsed.updatedAt,
                            }];
                    }
                    return [2 /*return*/, parsed];
                case 8:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function writeTokenMetaCache(chainId, address, meta) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!meta.creatorAddress && !meta.creatorUrl && !meta.creatorLabel && !Number.isFinite(meta.launchMultiple || NaN))
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(tokenMetaCacheKey(chainId, address), JSON.stringify({
                            cacheVersion: 2,
                            creatorAddress: meta.creatorAddress,
                            creatorUrl: meta.creatorUrl,
                            creatorLabel: meta.creatorLabel,
                            launchMultiple: meta.launchMultiple,
                            updatedAt: Date.now(),
                        }), TOKEN_META_CACHE_TTL_SECONDS)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function cacheInitialPoolSnapshots(chainId, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var sourceRank, estimateInitialLiquidity, limiter;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sourceRank = function (source) {
                        if (source === 'clanker_launch_model')
                            return 2;
                        if (source === 'trending_first_seen')
                            return 1;
                        return 0;
                    };
                    estimateInitialLiquidity = function (token) { return __awaiter(_this, void 0, void 0, function () {
                        var current, fallbackValue, addressLower, isClankerByLaunchpad, isClankerBySuffix, createdSec, ts, ethUsd, nativeUsd, c1, c2, band1, band2, normalizedC1, normalizedC2, target, chosen;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    current = Number(token.liquidity || 0);
                                    fallbackValue = Number.isFinite(current) && current > 0 ? current : undefined;
                                    addressLower = String(token.address || '').toLowerCase();
                                    isClankerByLaunchpad = String(token.launchpad || '').toLowerCase() === 'clanker';
                                    isClankerBySuffix = chainId === 'base' && addressLower.endsWith('b07');
                                    if (!(chainId === 'base' && (isClankerByLaunchpad || isClankerBySuffix))) return [3 /*break*/, 4];
                                    createdSec = token.poolCreatedAt ? Math.floor(Date.parse(token.poolCreatedAt) / 1000) : 0;
                                    ts = createdSec > 0 ? createdSec : Math.floor(Date.now() / 1000);
                                    return [4 /*yield*/, getNativeUsdOnDate(8453, ts)];
                                case 1:
                                    ethUsd = _a.sent();
                                    if (!(!Number.isFinite(Number(ethUsd || 0)) || Number(ethUsd || 0) <= 0)) return [3 /*break*/, 3];
                                    return [4 /*yield*/, (0, onChainPriceService_js_1.getNativeTokenPriceUsd)(8453)];
                                case 2:
                                    ethUsd = _a.sent();
                                    _a.label = 3;
                                case 3:
                                    if (Number.isFinite(Number(ethUsd || 0)) && Number(ethUsd || 0) > 0) {
                                        nativeUsd = Number(ethUsd || 0);
                                        c1 = 10 * nativeUsd;
                                        c2 = 20 * nativeUsd;
                                        band1 = 34000;
                                        band2 = 68000;
                                        normalizedC1 = Math.abs(c1 - band1) <= Math.abs(c1 - band2) ? band1 : band2;
                                        normalizedC2 = Math.abs(c2 - band1) <= Math.abs(c2 - band2) ? band1 : band2;
                                        target = Number.isFinite(current) && current > 0 ? current : normalizedC1;
                                        chosen = Math.abs(target - normalizedC1) <= Math.abs(target - normalizedC2) ? normalizedC1 : normalizedC2;
                                        if (Number.isFinite(chosen) && chosen > 0) {
                                            return [2 /*return*/, { value: chosen, source: 'clanker_launch_model' }];
                                        }
                                    }
                                    // If ETH USD is unavailable, keep a deterministic clanker fallback.
                                    return [2 /*return*/, { value: 34000, source: 'clanker_launch_model' }];
                                case 4: return [2 /*return*/, { value: fallbackValue, source: 'trending_first_seen' }];
                            }
                        });
                    }); };
                    limiter = (0, p_limit_1.default)(12);
                    return [4 /*yield*/, Promise.all(tokens.map(function (token) { return limiter(function () { return __awaiter(_this, void 0, void 0, function () {
                            var address, poolAddress, poolCreatedAt, key, existing, existingParsed, estimated, payload, oldRank, newRank, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 6, , 7]);
                                        address = String(token.address || '').toLowerCase();
                                        if (!address)
                                            return [2 /*return*/];
                                        poolAddress = String(token.poolAddress || '').trim();
                                        poolCreatedAt = typeof token.poolCreatedAt === 'string' ? token.poolCreatedAt : undefined;
                                        if (!poolAddress && !poolCreatedAt)
                                            return [2 /*return*/];
                                        key = initialPoolCacheKey(chainId, address);
                                        return [4 /*yield*/, (0, cacheClient_js_1.get)(key)];
                                    case 1:
                                        existing = _b.sent();
                                        if (!!existing) return [3 /*break*/, 3];
                                        return [4 /*yield*/, (0, cacheClient_js_1.get)(initialPoolLegacyCacheKey(chainId, address))];
                                    case 2:
                                        existing = _b.sent();
                                        _b.label = 3;
                                    case 3:
                                        existingParsed = null;
                                        if (existing) {
                                            try {
                                                existingParsed = JSON.parse(existing);
                                            }
                                            catch (_c) { }
                                        }
                                        return [4 /*yield*/, estimateInitialLiquidity(token)];
                                    case 4:
                                        estimated = _b.sent();
                                        payload = {
                                            initialPoolAddress: poolAddress || undefined,
                                            initialPoolCreatedAt: poolCreatedAt || undefined,
                                            initialLiquidityUsd: Number.isFinite(Number(estimated.value || 0)) && Number(estimated.value || 0) > 0
                                                ? Number(estimated.value || 0)
                                                : undefined,
                                            capturedAt: Date.now(),
                                            source: estimated.source,
                                        };
                                        if (existingParsed) {
                                            oldRank = sourceRank(String((existingParsed === null || existingParsed === void 0 ? void 0 : existingParsed.source) || ''));
                                            newRank = sourceRank(payload.source);
                                            // Keep better source. For same rank, preserve older snapshot.
                                            if (newRank < oldRank)
                                                return [2 /*return*/];
                                            if (newRank === oldRank)
                                                return [2 /*return*/];
                                        }
                                        return [4 /*yield*/, (0, cacheClient_js_1.set)(key, JSON.stringify(payload), 30 * 24 * 60 * 60)];
                                    case 5:
                                        _b.sent();
                                        return [3 /*break*/, 7];
                                    case 6:
                                        _a = _b.sent();
                                        return [3 /*break*/, 7];
                                    case 7: return [2 /*return*/];
                                }
                            });
                        }); }); }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function pickCreatorAddress(detected) {
    var _a, _b, _c, _d;
    var root = (detected === null || detected === void 0 ? void 0 : detected.data) || {};
    var nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
        ? root.data
        : null;
    var data = nested ? __assign(__assign({}, root), nested) : root;
    var candidates = [
        data.creatorAddress,
        data.creator,
        data.creator_address,
        data.userAddress,
        data.user_address,
        data.walletAddress,
        data.sentientWalletAddress,
        data.wallet_address,
        data.account,
        data.accountAddress,
        data.account_address,
        data.msg_sender,
        data.deployer,
        data.deployerAddress,
        data.deployer_address,
        data.owner,
        data.ownerAddress,
        data.owner_address,
        data.requestor,
        data.createdBy,
        data.created_by,
        data.creatorWallet,
        data.creator_wallet,
        data.dev,
        data.devWallet,
        data.developer,
        data.teamAddress,
        data.launcher,
        data.launcherAddress,
        data.launcher_address,
        data.teamWallet,
        data.team_wallet,
        data.requestorAddress,
        data.requestorWallet,
        data.creator_wallet,
        data.creatorWalletAddress,
        data.creatorPublicKey,
        data.creator_pubkey,
        data.mint_authority,
        data.mintAuthority,
        data.updateAuthority,
        data.update_authority,
        data.devAddress,
        (_a = data.creatorProfile) === null || _a === void 0 ? void 0 : _a.address,
        (_b = data.profile) === null || _b === void 0 ? void 0 : _b.address,
        (_c = data.user) === null || _c === void 0 ? void 0 : _c.address,
        (_d = data.author) === null || _d === void 0 ? void 0 : _d.address,
    ];
    var evmLike = /0x[a-fA-F0-9]{40}/;
    var solLike = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    var isIgnored = function (value) {
        var v = value.trim().toLowerCase();
        if (!v)
            return true;
        if (v === '0x0000000000000000000000000000000000000000')
            return true;
        if (v === '0x000000000000000000000000000000000000dead')
            return true;
        return false;
    };
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var raw = candidates_1[_i];
        if (typeof raw !== 'string')
            continue;
        var value = raw.trim();
        if ((evmLike.test(value) || solLike.test(value)) && !isIgnored(value))
            return value;
    }
    // Last-resort deep scan for address-like values in nested payloads.
    var stack = [data];
    var seen = new Set();
    while (stack.length > 0) {
        var cur = stack.pop();
        if (!cur || typeof cur !== 'object' || seen.has(cur))
            continue;
        seen.add(cur);
        if (Array.isArray(cur)) {
            for (var _e = 0, cur_1 = cur; _e < cur_1.length; _e++) {
                var item = cur_1[_e];
                stack.push(item);
            }
            continue;
        }
        for (var _f = 0, _g = Object.entries(cur); _f < _g.length; _f++) {
            var _h = _g[_f], key = _h[0], value = _h[1];
            if (typeof value === 'string') {
                var trimmed = value.trim();
                var keyHint = key.toLowerCase();
                if ((keyHint.includes('creator') || keyHint.includes('owner') || keyHint.includes('deploy') || keyHint.includes('author')) &&
                    (evmLike.test(trimmed) || solLike.test(trimmed)) && !isIgnored(trimmed)) {
                    return trimmed;
                }
            }
            else if (value && typeof value === 'object') {
                stack.push(value);
            }
        }
    }
    return undefined;
}
function pickCreatorUrl(detected) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    var root = (detected === null || detected === void 0 ? void 0 : detected.data) || {};
    var nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
        ? root.data
        : null;
    var data = nested ? __assign(__assign({}, root), nested) : root;
    var socials = data.socials || {};
    var directCandidates = [
        (_a = data.social_context) === null || _a === void 0 ? void 0 : _a.messageId,
        (_b = data.social_context) === null || _b === void 0 ? void 0 : _b.message_id,
        (_c = data.social_context) === null || _c === void 0 ? void 0 : _c.x,
        (_d = data.social_context) === null || _d === void 0 ? void 0 : _d.twitter,
        (_e = data.social_context) === null || _e === void 0 ? void 0 : _e.farcaster,
        (_f = data.social_context) === null || _f === void 0 ? void 0 : _f.website,
        data.creatorUrl,
        data.creator_url,
        data.profileUrl,
        data.profile_url,
        socials.x,
        socials.twitter,
        socials.TWITTER,
        socials.farcaster,
        socials.warpcast,
        socials.telegram,
        socials.website,
        data.twitter,
        data.twitterUrl,
        data.twitter_url,
        data.x,
        data.xUrl,
        data.website,
        data.websiteUrl,
        data.telegram,
        data.telegramUrl,
        data.telegram_url,
        data.farcasterUrl,
        data.farcaster_url,
        data.castUrl,
        data.cast_url,
        (_g = data.creatorProfile) === null || _g === void 0 ? void 0 : _g.url,
        (_h = data.social_context) === null || _h === void 0 ? void 0 : _h.url,
        (_j = data.social_context) === null || _j === void 0 ? void 0 : _j.profile,
        (_k = data.social_context) === null || _k === void 0 ? void 0 : _k.link,
        data.webUrl,
        data.twitterUrl,
        data.telegramUrl,
    ];
    var toUrl = function (raw) {
        if (!raw || typeof raw !== 'string')
            return undefined;
        var trimmed = raw.trim();
        if (!trimmed)
            return undefined;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
            return trimmed;
        if (trimmed.startsWith('@'))
            return "https://x.com/".concat(trimmed.slice(1));
        return undefined;
    };
    var isX = function (url) {
        try {
            var u = new URL(url);
            return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
        }
        catch (_a) {
            return false;
        }
    };
    var isFarcaster = function (url) {
        try {
            var u = new URL(url);
            return u.hostname.includes('warpcast.com') || u.hostname.includes('farcaster');
        }
        catch (_a) {
            return false;
        }
    };
    var normalizedUrls = directCandidates
        .map(function (raw) { return toUrl(raw); })
        .filter(function (u) { return !!u; });
    var xUrl = normalizedUrls.find(isX);
    if (xUrl)
        return xUrl;
    var farcasterUrl = normalizedUrls.find(isFarcaster);
    if (farcasterUrl)
        return farcasterUrl;
    var websiteUrl = normalizedUrls.find(function (u) { return !isX(u) && !isFarcaster(u); });
    if (websiteUrl)
        return websiteUrl;
    var xHandle = ((_o = (_m = (_l = data.creatorProfile) === null || _l === void 0 ? void 0 : _l.socialAccounts) === null || _m === void 0 ? void 0 : _m.twitter) === null || _o === void 0 ? void 0 : _o.username)
        || ((_r = (_q = (_p = data.creatorProfile) === null || _p === void 0 ? void 0 : _p.socialAccounts) === null || _q === void 0 ? void 0 : _q.x) === null || _r === void 0 ? void 0 : _r.username)
        || data.twitter
        || data.xUsername
        || ((_s = data.social_context) === null || _s === void 0 ? void 0 : _s.x_handle)
        || ((_t = data.social_context) === null || _t === void 0 ? void 0 : _t.twitter_handle);
    if (typeof xHandle === 'string' && xHandle.trim()) {
        return "https://x.com/".concat(xHandle.replace(/^@/, ''));
    }
    var farcasterUsername = ((_w = (_v = (_u = data.creatorProfile) === null || _u === void 0 ? void 0 : _u.socialAccounts) === null || _v === void 0 ? void 0 : _v.farcaster) === null || _w === void 0 ? void 0 : _w.username)
        || data.farcaster
        || ((_x = data.social_context) === null || _x === void 0 ? void 0 : _x.farcaster);
    if (typeof farcasterUsername === 'string' && farcasterUsername.trim()) {
        return "https://warpcast.com/".concat(farcasterUsername.replace(/^@/, ''));
    }
    var requestorFid = Number(data.requestor_fid || data.requestorFid || 0);
    if (Number.isFinite(requestorFid) && requestorFid > 0) {
        return "https://warpcast.com/~/profiles/".concat(requestorFid);
    }
    return undefined;
}
function pickCreatorLabel(detected, creatorUrl, creatorAddress) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    var root = (detected === null || detected === void 0 ? void 0 : detected.data) || {};
    var nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
        ? root.data
        : null;
    var data = nested ? __assign(__assign({}, root), nested) : root;
    var socials = data.socials || {};
    var isDigits = function (v) { return !!v && /^\d+$/.test(v); };
    var cleanHandle = function (v) {
        if (!v || typeof v !== 'string')
            return undefined;
        var s = v.trim().replace(/^@/, '');
        if (!s)
            return undefined;
        if (/^https?:\/\//i.test(s))
            return undefined;
        return s;
    };
    var xHandle = cleanHandle(((_c = (_b = (_a = data.creatorProfile) === null || _a === void 0 ? void 0 : _a.socialAccounts) === null || _b === void 0 ? void 0 : _b.twitter) === null || _c === void 0 ? void 0 : _c.username)
        || ((_f = (_e = (_d = data.creatorProfile) === null || _d === void 0 ? void 0 : _d.socialAccounts) === null || _e === void 0 ? void 0 : _e.x) === null || _f === void 0 ? void 0 : _f.username)
        || data.twitterUsername
        || data.twitter
        || data.xUsername
        || socials.twitter
        || socials.x
        || ((_g = data.social_context) === null || _g === void 0 ? void 0 : _g.twitter)
        || ((_h = data.social_context) === null || _h === void 0 ? void 0 : _h.x)
        || ((_j = data.social_context) === null || _j === void 0 ? void 0 : _j.x_handle)
        || data.creatorHandle);
    if (xHandle && !isDigits(xHandle)) {
        return "@".concat(xHandle);
    }
    var farcasterHandle = cleanHandle(((_m = (_l = (_k = data.creatorProfile) === null || _k === void 0 ? void 0 : _k.socialAccounts) === null || _l === void 0 ? void 0 : _l.farcaster) === null || _m === void 0 ? void 0 : _m.username)
        || data.farcasterUsername
        || data.farcaster
        || ((_o = data.social_context) === null || _o === void 0 ? void 0 : _o.farcaster)
        || ((_p = data.social_context) === null || _p === void 0 ? void 0 : _p.handle));
    if (farcasterHandle && !isDigits(farcasterHandle)) {
        return "@".concat(farcasterHandle);
    }
    if (creatorUrl) {
        try {
            var u = new URL(creatorUrl);
            var path = u.pathname.replace(/\/+$/, '');
            var last = path.split('/').filter(Boolean).pop();
            var parts = path.split('/').filter(Boolean);
            var host = u.hostname.replace(/^www\./, '');
            var isX = host.includes('x.com') || host.includes('twitter.com');
            if (isX) {
                // x.com/{user}/status/{id} => use {user}, not status id
                var xUser = (parts[0] || '').replace(/^@/, '');
                var reserved = new Set([
                    'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
                    'notifications', 'settings', 'tos', 'privacy', 'status'
                ]);
                if (xUser && !reserved.has(xUser.toLowerCase())) {
                    return "@".concat(xUser.replace(/^@/, ''));
                }
                // For x.com/i/status/... and other reserved paths, keep platform label.
                return 'X post';
            }
            if (u.hostname.includes('warpcast.com') && path.includes('/~/profiles/')) {
                return 'Farcaster';
            }
            if (last) {
                if (u.hostname.includes('warpcast.com'))
                    return 'Farcaster';
                return host || last;
            }
        }
        catch (_s) {
            // ignore malformed url
        }
    }
    var socialId = typeof ((_q = data.social_context) === null || _q === void 0 ? void 0 : _q.id) === 'string' ? data.social_context.id.trim() : '';
    var fid = Number(data.requestor_fid || data.requestorFid || (isDigits(socialId) ? socialId : 0));
    if (Number.isFinite(fid) && fid > 0) {
        return 'Farcaster';
    }
    var preferred = [
        data.creatorLabel,
        data.creator_label,
        (_r = data.creatorProfile) === null || _r === void 0 ? void 0 : _r.handle,
        socials.handle,
    ];
    for (var _i = 0, preferred_1 = preferred; _i < preferred_1.length; _i++) {
        var raw = preferred_1[_i];
        if (typeof raw !== 'string')
            continue;
        var value = raw.trim();
        if (!value)
            continue;
        if (isDigits(value))
            continue;
        if (/^@?(i|status)$/i.test(value))
            continue;
        return value.startsWith('@') ? value : "@".concat(value);
    }
    return creatorAddress;
}
function pickCreatorMeta(detected) {
    var _a, _b, _c, _d;
    var provider = typeof (detected === null || detected === void 0 ? void 0 : detected.provider) === 'string' ? detected.provider.toLowerCase() : '';
    var root = (detected === null || detected === void 0 ? void 0 : detected.data) || {};
    var nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
        ? root.data
        : null;
    var merged = nested ? __assign(__assign({}, root), nested) : root;
    // flap policy: provider does not expose reliable creator identity.
    if (provider === 'flap') {
        return {};
    }
    // four.meme strict creator policy:
    // 1) use social URL (twitter/x/messageId) first
    // 2) fallback to userAddress
    if (provider === 'fourmeme') {
        var twitterUrlRaw = [
            merged === null || merged === void 0 ? void 0 : merged.twitterUrl,
            merged === null || merged === void 0 ? void 0 : merged.twitter,
            merged === null || merged === void 0 ? void 0 : merged.xUrl,
            merged === null || merged === void 0 ? void 0 : merged.x,
            merged === null || merged === void 0 ? void 0 : merged.creatorUrl,
            (_a = merged === null || merged === void 0 ? void 0 : merged.social_context) === null || _a === void 0 ? void 0 : _a.messageId,
            (_b = merged === null || merged === void 0 ? void 0 : merged.social_context) === null || _b === void 0 ? void 0 : _b.message_id,
            (_c = merged === null || merged === void 0 ? void 0 : merged.social_context) === null || _c === void 0 ? void 0 : _c.twitter,
            (_d = merged === null || merged === void 0 ? void 0 : merged.social_context) === null || _d === void 0 ? void 0 : _d.x,
        ].find(function (v) { return typeof v === 'string' && !!String(v).trim(); });
        var twitterUrl = typeof twitterUrlRaw === 'string' ? twitterUrlRaw.trim() : '';
        var creatorAddress_1 = pickCreatorAddress(detected);
        if (twitterUrl) {
            var creatorLabel_1;
            try {
                var u = new URL(twitterUrl);
                if (u.hostname.includes('x.com') || u.hostname.includes('twitter.com')) {
                    var user = (u.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
                    var reserved = new Set([
                        'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
                        'notifications', 'settings', 'tos', 'privacy', 'status'
                    ]);
                    if (user && !reserved.has(user.toLowerCase())) {
                        creatorLabel_1 = "@".concat(user.replace(/^@/, ''));
                    }
                }
            }
            catch (_e) {
                // keep raw fallback when url is malformed
            }
            return {
                creatorAddress: creatorAddress_1,
                creatorUrl: twitterUrl,
                creatorLabel: creatorLabel_1 || 'X post'
            };
        }
        return {
            creatorAddress: creatorAddress_1,
            creatorUrl: undefined,
            creatorLabel: creatorAddress_1
        };
    }
    // pump.fun strict creator policy:
    // 1) use creatorUrl first (twitter/telegram/etc)
    // 2) fallback to creatorAddress
    if (provider === 'pumpfun') {
        var creatorAddress_2 = pickCreatorAddress(detected);
        var creatorUrl_1 = pickCreatorUrl(detected);
        if (creatorUrl_1) {
            var labelFromUrl = pickCreatorLabel(detected, creatorUrl_1, creatorAddress_2);
            return {
                creatorAddress: creatorAddress_2,
                creatorUrl: creatorUrl_1,
                creatorLabel: labelFromUrl || creatorUrl_1
            };
        }
        return {
            creatorAddress: creatorAddress_2,
            creatorUrl: undefined,
            creatorLabel: creatorAddress_2
        };
    }
    var creatorAddress = pickCreatorAddress(detected);
    var creatorUrl = pickCreatorUrl(detected);
    var creatorLabel = pickCreatorLabel(detected, creatorUrl, creatorAddress);
    var addressLike = function (value) { return !!value && (/^0x[a-f0-9]{40}$/i.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)); };
    if (creatorLabel && addressLike(creatorLabel)) {
        creatorLabel = undefined;
    }
    return { creatorAddress: creatorAddress, creatorUrl: creatorUrl, creatorLabel: creatorLabel };
}
function isFidLabel(value) {
    return typeof value === 'string' && /^fid:\d+$/i.test(value.trim());
}
function isWeakCreatorLabel(value) {
    if (typeof value !== 'string')
        return false;
    var v = value.trim();
    if (!v)
        return false;
    return /^fid:\d+$/i.test(v) || /^@?\d+$/.test(v) || /^@?(i|status)$/i.test(v);
}
function isXUrl(value) {
    if (!value || typeof value !== 'string')
        return false;
    try {
        var u = new URL(value);
        return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
    }
    catch (_a) {
        return false;
    }
}
function pickDexCreatorMetaFromToken(token) {
    var _a, _b;
    var socials = Array.isArray(token === null || token === void 0 ? void 0 : token.socials) ? token.socials : [];
    var websites = Array.isArray(token === null || token === void 0 ? void 0 : token.websites) ? token.websites : [];
    var firstByType = function () {
        var types = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            types[_i] = arguments[_i];
        }
        var wanted = new Set(types.map(function (t) { return t.toLowerCase(); }));
        for (var _a = 0, socials_1 = socials; _a < socials_1.length; _a++) {
            var row = socials_1[_a];
            if (!row || typeof row.url !== 'string' || !row.url.trim())
                continue;
            var t = String(row.type || '').toLowerCase();
            if (wanted.has(t))
                return row.url.trim();
        }
        return undefined;
    };
    var parseXHandle = function (url) {
        if (!url)
            return undefined;
        try {
            var u = new URL(url);
            if (!(u.hostname.includes('x.com') || u.hostname.includes('twitter.com')))
                return undefined;
            var user = (u.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
            var reserved = new Set([
                'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
                'notifications', 'settings', 'tos', 'privacy', 'status'
            ]);
            if (!user || reserved.has(user.toLowerCase()))
                return undefined;
            return "@".concat(user.replace(/^@/, ''));
        }
        catch (_a) {
            return undefined;
        }
    };
    var parseWarpcastHandle = function (url) {
        if (!url)
            return undefined;
        try {
            var u = new URL(url);
            if (!u.hostname.includes('warpcast.com'))
                return undefined;
            var parts = u.pathname.split('/').filter(Boolean);
            if (!parts.length)
                return undefined;
            if (parts[0] === '~' && parts[1] === 'profiles' && parts[2])
                return 'Farcaster';
            var user = parts[0];
            if (!user)
                return undefined;
            return "@".concat(user.replace(/^@/, ''));
        }
        catch (_a) {
            return undefined;
        }
    };
    var xUrl = firstByType('twitter', 'x');
    if (xUrl) {
        return {
            creatorUrl: xUrl,
            creatorLabel: parseXHandle(xUrl) || xUrl
        };
    }
    var farcasterUrl = firstByType('farcaster', 'warpcast');
    if (farcasterUrl) {
        return {
            creatorUrl: farcasterUrl,
            creatorLabel: parseWarpcastHandle(farcasterUrl) || farcasterUrl
        };
    }
    var websiteUrl = firstByType('website') || ((_b = (_a = websites.find(function (w) { return typeof (w === null || w === void 0 ? void 0 : w.url) === 'string' && !!w.url.trim(); })) === null || _a === void 0 ? void 0 : _a.url) === null || _b === void 0 ? void 0 : _b.trim());
    if (websiteUrl) {
        return {
            creatorUrl: websiteUrl,
            creatorLabel: websiteUrl
        };
    }
    return {};
}
function enrichLaunchpadsForTrending(chainId, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var evmChainId, isSolana, persistLaunchpad, _i, _a, token, deterministic, persistLimiter_1, flapCandidates, verifyTargets, limiter_1, unresolved, chainVerifyBudget, verifyTargets, limiter_2, unresolved, verifyTargets, limiter_3, chainIdNum, backfillCandidates, backfillTargets, backfillLimiter;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (tokens.length === 0)
                        return [2 /*return*/];
                    evmChainId = resolveChainId(chainId);
                    isSolana = chainId === 'solana';
                    persistLaunchpad = function (token, source) { return __awaiter(_this, void 0, void 0, function () {
                        var normalizedLaunchpad, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 6, , 7]);
                                    sanitizeCreatorForLaunchpad(token);
                                    normalizedLaunchpad = normalizeLaunchpadProvider(token.launchpad || null);
                                    return [4 /*yield*/, (0, tokenRepository_js_1.saveTokenLaunchpadProfile)(chainId, token.address, {
                                            launchpad: normalizedLaunchpad,
                                            creatorAddress: token.creatorAddress,
                                            creatorUrl: token.creatorUrl,
                                            creatorLabel: token.creatorLabel,
                                            source: source,
                                        })];
                                case 1:
                                    _b.sent();
                                    if (!(normalizedLaunchpad !== undefined)) return [3 /*break*/, 3];
                                    return [4 /*yield*/, prisma_js_1.default.trendingToken.updateMany({
                                            where: { chain: chainId, address: token.address.toLowerCase() },
                                            data: { launchpad: normalizedLaunchpad || null }
                                        })];
                                case 2:
                                    _b.sent();
                                    _b.label = 3;
                                case 3:
                                    if (!(token.creatorAddress || token.creatorUrl || token.creatorLabel)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, (0, tokenRepository_js_1.saveTrendingTokenCreator)(chainId, token.address, {
                                            creatorAddress: token.creatorAddress,
                                            creatorUrl: token.creatorUrl,
                                            creatorLabel: token.creatorLabel,
                                        })];
                                case 4:
                                    _b.sent();
                                    _b.label = 5;
                                case 5: return [3 /*break*/, 7];
                                case 6:
                                    _a = _b.sent();
                                    return [3 /*break*/, 7];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); };
                    // Warm from metadata cache first (keeps creator/multiple stable across DB reloads)
                    return [4 /*yield*/, Promise.all(tokens.map(function (token) { return __awaiter(_this, void 0, void 0, function () {
                            var cached;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, readTokenMetaCache(chainId, token.address)];
                                    case 1:
                                        cached = _a.sent();
                                        if (!cached)
                                            return [2 /*return*/];
                                        if (!token.creatorAddress && cached.creatorAddress)
                                            token.creatorAddress = cached.creatorAddress;
                                        if (!token.creatorUrl && cached.creatorUrl)
                                            token.creatorUrl = cached.creatorUrl;
                                        if (!token.creatorLabel && cached.creatorLabel)
                                            token.creatorLabel = cached.creatorLabel;
                                        sanitizeCreatorForLaunchpad(token);
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    // Warm from metadata cache first (keeps creator/multiple stable across DB reloads)
                    _b.sent();
                    // Step 1: deterministic suffix detection
                    for (_i = 0, _a = tokens; _i < _a.length; _i++) {
                        token = _a[_i];
                        token.launchpad =
                            detectBySuffix(chainId, token.address)
                                || undefined;
                        sanitizeCreatorForLaunchpad(token);
                    }
                    deterministic = tokens.filter(function (t) { return !!t.launchpad; });
                    if (!(deterministic.length > 0)) return [3 /*break*/, 3];
                    persistLimiter_1 = (0, p_limit_1.default)(10);
                    return [4 /*yield*/, Promise.all(deterministic.map(function (token) { return persistLimiter_1(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, persistLaunchpad(token, 'deterministic_pattern')];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }); }))];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    if (!(chainId === 'bsc')) return [3 /*break*/, 5];
                    flapCandidates = tokens.filter(function (t) { return t.launchpad === 'flap' && t.address.startsWith('0x'); });
                    if (!(flapCandidates.length > 0)) return [3 /*break*/, 5];
                    verifyTargets = pickVerifyTargets(flapCandidates, Math.min(LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN, 60));
                    limiter_1 = (0, p_limit_1.default)(LAUNCHPAD_DETECT_CONCURRENCY);
                    return [4 /*yield*/, Promise.all(verifyTargets.map(function (token) { return limiter_1(function () { return __awaiter(_this, void 0, void 0, function () {
                            var detected, creatorMeta, _a;
                            var _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 5, , 6]);
                                        return [4 /*yield*/, (0, launchpadDetector_js_1.detectLaunchpadToken)(token.address, 56, { mode: 'cheap' })];
                                    case 1:
                                        detected = _c.sent();
                                        if (!detected || detected.provider !== 'flap') {
                                            token.launchpad = undefined;
                                            return [2 /*return*/];
                                        }
                                        creatorMeta = pickCreatorMeta(detected);
                                        token.creatorAddress = creatorMeta.creatorAddress;
                                        token.creatorUrl = creatorMeta.creatorUrl;
                                        token.creatorLabel = creatorMeta.creatorLabel;
                                        sanitizeCreatorForLaunchpad(token);
                                        return [4 /*yield*/, writeTokenMetaCache(chainId, token.address, {
                                                creatorAddress: token.creatorAddress,
                                                creatorUrl: token.creatorUrl,
                                                creatorLabel: token.creatorLabel,
                                                launchMultiple: token.launchMultiple
                                            })];
                                    case 2:
                                        _c.sent();
                                        return [4 /*yield*/, persistLaunchpad(token, 'detector_flap')];
                                    case 3:
                                        _c.sent();
                                        return [4 /*yield*/, (0, cacheClient_js_1.del)(launchpadClearFailKey(chainId, token.address)).catch(function () { return undefined; })];
                                    case 4:
                                        _c.sent();
                                        if (!token.imageUrl && typeof ((_b = detected === null || detected === void 0 ? void 0 : detected.data) === null || _b === void 0 ? void 0 : _b.imageUrl) === 'string') {
                                            token.imageUrl = detected.data.imageUrl;
                                        }
                                        return [3 /*break*/, 6];
                                    case 5:
                                        _a = _c.sent();
                                        return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); }); }))];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    if (!evmChainId) return [3 /*break*/, 7];
                    unresolved = tokens.filter(function (t) { return !t.launchpad && t.address.startsWith('0x'); });
                    if (!(unresolved.length > 0)) return [3 /*break*/, 7];
                    chainVerifyBudget = chainId === 'base'
                        ? Math.min(LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN, BASE_DOPPLER_VERIFY_BUDGET_PER_RUN)
                        : LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN;
                    verifyTargets = pickVerifyTargets(unresolved, chainVerifyBudget);
                    if (unresolved.length > verifyTargets.length) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Launchpad verify budget applied', {
                            chain: chainId,
                            unresolved: unresolved.length,
                            verifying: verifyTargets.length
                        });
                    }
                    limiter_2 = (0, p_limit_1.default)(BASE_DOPPLER_VERIFY_CONCURRENCY);
                    return [4 /*yield*/, Promise.all(verifyTargets.map(function (token) { return limiter_2(function () { return __awaiter(_this, void 0, void 0, function () {
                            var detected, normalized, creatorMeta, _a;
                            var _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 5, , 6]);
                                        return [4 /*yield*/, (0, launchpadDetector_js_1.detectLaunchpadToken)(token.address, evmChainId, {
                                                mode: 'full',
                                                forceRefresh: true
                                            })];
                                    case 1:
                                        detected = _c.sent();
                                        normalized = normalizeLaunchpadProvider((detected === null || detected === void 0 ? void 0 : detected.provider) || null);
                                        if (normalized)
                                            token.launchpad = normalized;
                                        creatorMeta = pickCreatorMeta(detected);
                                        token.creatorAddress = creatorMeta.creatorAddress;
                                        token.creatorUrl = creatorMeta.creatorUrl;
                                        token.creatorLabel = creatorMeta.creatorLabel;
                                        return [4 /*yield*/, writeTokenMetaCache(chainId, token.address, {
                                                creatorAddress: token.creatorAddress,
                                                creatorUrl: token.creatorUrl,
                                                creatorLabel: token.creatorLabel,
                                                launchMultiple: token.launchMultiple
                                            })];
                                    case 2:
                                        _c.sent();
                                        return [4 /*yield*/, persistLaunchpad(token, 'detector_base')];
                                    case 3:
                                        _c.sent();
                                        return [4 /*yield*/, (0, cacheClient_js_1.del)(launchpadClearFailKey(chainId, token.address)).catch(function () { return undefined; })];
                                    case 4:
                                        _c.sent();
                                        if (!token.imageUrl && typeof ((_b = detected === null || detected === void 0 ? void 0 : detected.data) === null || _b === void 0 ? void 0 : _b.imageUrl) === 'string') {
                                            token.imageUrl = detected.data.imageUrl;
                                        }
                                        return [3 /*break*/, 6];
                                    case 5:
                                        _a = _c.sent();
                                        return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); }); }))];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7:
                    if (!isSolana) return [3 /*break*/, 9];
                    unresolved = tokens.filter(function (t) { return !t.launchpad && !t.address.startsWith('0x'); });
                    if (!(unresolved.length > 0)) return [3 /*break*/, 9];
                    verifyTargets = pickVerifyTargets(unresolved, LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN);
                    limiter_3 = (0, p_limit_1.default)(LAUNCHPAD_DETECT_CONCURRENCY);
                    return [4 /*yield*/, Promise.all(verifyTargets.map(function (token) { return limiter_3(function () { return __awaiter(_this, void 0, void 0, function () {
                            var detected, normalized, creatorMeta, _a;
                            var _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 5, , 6]);
                                        return [4 /*yield*/, (0, launchpadDetector_js_1.detectLaunchpadToken)(token.address, undefined, {
                                                mode: 'full',
                                                forceRefresh: true,
                                                requireCreator: true
                                            })];
                                    case 1:
                                        detected = _c.sent();
                                        normalized = normalizeLaunchpadProvider((detected === null || detected === void 0 ? void 0 : detected.provider) || null);
                                        if (!normalized)
                                            return [2 /*return*/];
                                        token.launchpad = normalized;
                                        creatorMeta = pickCreatorMeta(detected);
                                        token.creatorAddress = creatorMeta.creatorAddress;
                                        token.creatorUrl = creatorMeta.creatorUrl;
                                        token.creatorLabel = creatorMeta.creatorLabel;
                                        return [4 /*yield*/, writeTokenMetaCache(chainId, token.address, {
                                                creatorAddress: token.creatorAddress,
                                                creatorUrl: token.creatorUrl,
                                                creatorLabel: token.creatorLabel,
                                                launchMultiple: token.launchMultiple
                                            })];
                                    case 2:
                                        _c.sent();
                                        return [4 /*yield*/, persistLaunchpad(token, 'detector_solana')];
                                    case 3:
                                        _c.sent();
                                        return [4 /*yield*/, (0, cacheClient_js_1.del)(launchpadClearFailKey(chainId, token.address)).catch(function () { return undefined; })];
                                    case 4:
                                        _c.sent();
                                        if (!token.imageUrl && typeof ((_b = detected === null || detected === void 0 ? void 0 : detected.data) === null || _b === void 0 ? void 0 : _b.imageUrl) === 'string') {
                                            token.imageUrl = detected.data.imageUrl;
                                        }
                                        return [3 /*break*/, 6];
                                    case 5:
                                        _a = _c.sent();
                                        return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); }); }))];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9:
                    chainIdNum = evmChainId;
                    if (!chainIdNum && !isSolana)
                        return [2 /*return*/];
                    backfillCandidates = tokens.filter(function (t) {
                        if (!t.launchpad)
                            return false;
                        var missingCreator = !t.creatorAddress && !t.creatorUrl && !t.creatorLabel;
                        var weakCreator = isWeakCreatorLabel(t.creatorLabel) && !isXUrl(t.creatorUrl);
                        if (!missingCreator && !weakCreator)
                            return false;
                        return isSolana ? !t.address.startsWith('0x') : t.address.startsWith('0x');
                    });
                    if (backfillCandidates.length === 0)
                        return [2 /*return*/];
                    backfillTargets = pickVerifyTargets(backfillCandidates, Math.min(LAUNCHPAD_CREATOR_BACKFILL_BUDGET_PER_RUN, LAUNCHPAD_API_VERIFY_BUDGET_PER_RUN));
                    backfillLimiter = (0, p_limit_1.default)(Math.max(2, Math.floor(LAUNCHPAD_DETECT_CONCURRENCY / 2)));
                    return [4 /*yield*/, Promise.all(backfillTargets.map(function (token) { return backfillLimiter(function () { return __awaiter(_this, void 0, void 0, function () {
                            var detected, suffixLaunchpad, hasCreator, currentLaunchpad, isNonDeterministicLaunchpad, failKey, strikes, normalized, creatorMeta, currentLabel, currentUrl, shouldUpgradeFromWeak, launchpadTag, shouldUseDexCreatorFallback, dexFallback, _a;
                            var _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 9, , 10]);
                                        return [4 /*yield*/, (0, launchpadDetector_js_1.detectLaunchpadToken)(token.address, chainIdNum || undefined, {
                                                mode: 'full',
                                                requireCreator: true,
                                                forceRefresh: false,
                                            })];
                                    case 1:
                                        detected = _c.sent();
                                        if (!!detected) return [3 /*break*/, 5];
                                        suffixLaunchpad = detectBySuffix(chainId, token.address);
                                        hasCreator = !!token.creatorAddress || !!token.creatorUrl || !!token.creatorLabel;
                                        currentLaunchpad = String(token.launchpad || '').toLowerCase();
                                        isNonDeterministicLaunchpad = !!currentLaunchpad
                                            && !['clanker', 'four.meme', 'flap', 'pump.fun', 'bonk.fun'].includes(currentLaunchpad);
                                        if (!(!suffixLaunchpad && !hasCreator && isNonDeterministicLaunchpad)) return [3 /*break*/, 4];
                                        failKey = launchpadClearFailKey(chainId, token.address);
                                        return [4 /*yield*/, (0, cacheClient_js_1.incrBy)(failKey, 1, LAUNCHPAD_CLEAR_FAIL_TTL_SECONDS).catch(function () { return 1; })];
                                    case 2:
                                        strikes = _c.sent();
                                        if (!(strikes >= LAUNCHPAD_CLEAR_FAIL_THRESHOLD)) return [3 /*break*/, 4];
                                        token.launchpad = undefined;
                                        return [4 /*yield*/, persistLaunchpad({
                                                address: token.address,
                                                launchpad: null,
                                                creatorAddress: undefined,
                                                creatorUrl: undefined,
                                                creatorLabel: undefined,
                                            }, 'detector_backfill_clear')];
                                    case 3:
                                        _c.sent();
                                        _c.label = 4;
                                    case 4: return [2 /*return*/];
                                    case 5:
                                        if (!token.launchpad) {
                                            normalized = normalizeLaunchpadProvider(detected.provider || null);
                                            if (normalized)
                                                token.launchpad = normalized;
                                        }
                                        creatorMeta = pickCreatorMeta(detected);
                                        currentLabel = token.creatorLabel;
                                        currentUrl = token.creatorUrl;
                                        shouldUpgradeFromWeak = isWeakCreatorLabel(currentLabel) && !isXUrl(currentUrl) && (isXUrl(creatorMeta.creatorUrl) || (typeof creatorMeta.creatorLabel === 'string' && creatorMeta.creatorLabel.startsWith('@')));
                                        if (creatorMeta.creatorAddress && !token.creatorAddress)
                                            token.creatorAddress = creatorMeta.creatorAddress;
                                        if (creatorMeta.creatorUrl && (!token.creatorUrl || shouldUpgradeFromWeak)) {
                                            token.creatorUrl = creatorMeta.creatorUrl;
                                        }
                                        if (creatorMeta.creatorLabel && (!token.creatorLabel || shouldUpgradeFromWeak)) {
                                            token.creatorLabel = creatorMeta.creatorLabel;
                                        }
                                        launchpadTag = String(token.launchpad || '').toLowerCase();
                                        shouldUseDexCreatorFallback = (chainId === 'solana' && launchpadTag === 'bonk.fun') ||
                                            (chainId === 'bsc' && launchpadTag === 'four.meme');
                                        if (shouldUseDexCreatorFallback) {
                                            dexFallback = pickDexCreatorMetaFromToken(token);
                                            if (dexFallback.creatorUrl && !token.creatorUrl) {
                                                token.creatorUrl = dexFallback.creatorUrl;
                                            }
                                            if (dexFallback.creatorLabel && !token.creatorLabel) {
                                                token.creatorLabel = dexFallback.creatorLabel;
                                            }
                                        }
                                        if (!token.imageUrl && typeof ((_b = detected === null || detected === void 0 ? void 0 : detected.data) === null || _b === void 0 ? void 0 : _b.imageUrl) === 'string') {
                                            token.imageUrl = detected.data.imageUrl;
                                        }
                                        return [4 /*yield*/, writeTokenMetaCache(chainId, token.address, {
                                                creatorAddress: token.creatorAddress,
                                                creatorUrl: token.creatorUrl,
                                                creatorLabel: token.creatorLabel,
                                                launchMultiple: token.launchMultiple
                                            })];
                                    case 6:
                                        _c.sent();
                                        return [4 /*yield*/, persistLaunchpad(token, 'detector_backfill')];
                                    case 7:
                                        _c.sent();
                                        return [4 /*yield*/, (0, cacheClient_js_1.del)(launchpadClearFailKey(chainId, token.address)).catch(function () { return undefined; })];
                                    case 8:
                                        _c.sent();
                                        return [3 /*break*/, 10];
                                    case 9:
                                        _a = _c.sent();
                                        return [3 /*break*/, 10];
                                    case 10: return [2 /*return*/];
                                }
                            });
                        }); }); }))];
                case 10:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function enrichLaunchMultiplesForTrending(chainId, _geckoNetwork, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!LAUNCH_MULTIPLE_ENRICH_ENABLED)
                        return [2 /*return*/];
                    if (!Array.isArray(tokens) || tokens.length === 0)
                        return [2 /*return*/];
                    return [4 /*yield*/, Promise.all(tokens.map(function (token) { return __awaiter(_this, void 0, void 0, function () {
                            var multiple;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        multiple = (0, launchpadMultipleService_js_1.computeLaunchpadMultiple)(chainId, token.launchpad, token.price);
                                        if (!multiple) {
                                            delete token.launchMultiple;
                                            return [2 /*return*/];
                                        }
                                        token.launchMultiple = multiple;
                                        return [4 /*yield*/, writeTokenMetaCache(chainId, token.address, {
                                                creatorAddress: token.creatorAddress,
                                                creatorUrl: token.creatorUrl,
                                                creatorLabel: token.creatorLabel,
                                                launchMultiple: multiple
                                            })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var onDemandMultipleInFlight = new Map();
function enrichLaunchMultiplesOnDemand(chainId, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var key, existing, task;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!LAUNCH_MULTIPLE_ENRICH_ENABLED)
                        return [2 /*return*/];
                    if (!Array.isArray(tokens) || tokens.length === 0)
                        return [2 /*return*/];
                    key = "".concat(chainId, ":on_demand");
                    existing = onDemandMultipleInFlight.get(key);
                    if (!existing) return [3 /*break*/, 2];
                    return [4 /*yield*/, existing.catch(function () { return undefined; })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    task = (function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, enrichLaunchMultiplesForTrending(chainId, chainId, tokens)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })().finally(function () {
                        onDemandMultipleInFlight.delete(key);
                    });
                    onDemandMultipleInFlight.set(key, task);
                    return [4 /*yield*/, task];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Global rate limiter to prevent API abuse
var apiRateLimiter = {
    geckoTerminal: { lastCall: 0, minInterval: 5000, backoffUntil: 0 }, // 5s minimum interval
    dexScreener: { lastCall: 0, minInterval: 2000 } // 2s minimum interval
};
/**
 * Check if GeckoTerminal is currently in backoff period
 */
function isGeckoBackoffActive() {
    return Date.now() < apiRateLimiter.geckoTerminal.backoffUntil;
}
/**
 * Set GeckoTerminal backoff period (called when 429 is detected)
 */
function setGeckoBackoff(durationMs) {
    apiRateLimiter.geckoTerminal.backoffUntil = Date.now() + durationMs;
}
/**
 * Refresh trending tokens for a single chain
 * Tries GeckoTerminal first, falls back to DexScreener if needed
 */
var node_crypto_1 = require("node:crypto");
/**
 * Refresh trending tokens for a single chain
 * Uses DexScreener Premium (WebSocket) as primary source for accurate trending
 */
// In-memory lock to prevent concurrent refreshes for the same chain
// This prevents race conditions where multiple jobs/API calls try to delete/insert for the same chain simultaneously
var refreshLocks = new Map();
var refreshPrimaryChainsInProgress = false;
var refreshPrimaryChainsStartedAt = 0;
var lastTokenRefreshAt = 0;
var LAUNCHPAD_ENRICH_TIMEOUT_MS = Math.max(10000, Number(process.env.LAUNCHPAD_ENRICH_TIMEOUT_MS || '25000'));
var LAUNCH_MULTIPLE_ENRICH_TIMEOUT_MS = Math.max(20000, Number(process.env.LAUNCH_MULTIPLE_ENRICH_TIMEOUT_MS || '90000'));
function runWithTimeout(task, timeoutMs, label) {
    return __awaiter(this, void 0, void 0, function () {
        var timeoutId, timeoutPromise, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    timeoutId = null;
                    timeoutPromise = new Promise(function (resolve) {
                        timeoutId = setTimeout(function () { return resolve({ kind: 'timeout' }); }, timeoutMs);
                    });
                    return [4 /*yield*/, Promise.race([
                            task.then(function (value) { return ({ kind: 'ok', value: value }); }).catch(function (error) { return ({ kind: 'error', error: error }); }),
                            timeoutPromise
                        ])];
                case 1:
                    result = _a.sent();
                    if (timeoutId)
                        clearTimeout(timeoutId);
                    if (result && result.kind === 'timeout') {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "".concat(label, " timed out"), { timeoutMs: timeoutMs });
                        return [2 /*return*/, null];
                    }
                    if (result && result.kind === 'error') {
                        throw result.error;
                    }
                    return [2 /*return*/, result.value];
            }
        });
    });
}
function refreshChainTokens(chain_1) {
    return __awaiter(this, arguments, void 0, function (chain, force) {
        var lockKey, lockValue, hasDistributedLock, REFRESH_5M_MS, lastUpdate, now, dexDelay_1, disableGeckoFill, tokens_1, beforeCount, removed, existing, _i, _a, token, savedTokens, error_1, cachedTokens, cacheKey, redisCacheKey, error_2, runLaunchpadEnrichment, runLaunchMultipleEnrichment, error_3, error_4, error_5;
        var _this = this;
        if (force === void 0) { force = false; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // Check if a refresh is already in progress for this chain
                    if (refreshLocks.get(chain.id)) {
                        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.SYS_INFO, "Skipping refresh for ".concat(chain.name, " - update already in progress"));
                        return [2 /*return*/];
                    }
                    // Acquire lock
                    refreshLocks.set(chain.id, true);
                    lockKey = "lock:tokenJob:refresh:".concat(chain.id);
                    lockValue = (0, node_crypto_1.randomUUID)();
                    hasDistributedLock = false;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 27, 28, 31]);
                    return [4 /*yield*/, (0, cacheClient_js_1.acquireLock)(lockKey, 240, lockValue)];
                case 2:
                    // Distributed lock (prevents multiple replicas from hammering external APIs)
                    // TTL slightly less than cron interval.
                    hasDistributedLock = _b.sent();
                    if (!hasDistributedLock) {
                        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.SYS_INFO, "Skipping refresh for ".concat(chain.name, " - another instance holds the lock"));
                        return [2 /*return*/];
                    }
                    REFRESH_5M_MS = 4.5 * 60 * 1000;
                    if (!!force) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, tokenRepository_js_1.getLastUpdateTime)(chain.id)];
                case 3:
                    lastUpdate = _b.sent();
                    if (lastUpdate && (Date.now() - lastUpdate.getTime()) < REFRESH_5M_MS) {
                        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.SYS_INFO, "Tokens for ".concat(chain.name, " are fresh, skipping API call"));
                        return [2 /*return*/];
                    }
                    _b.label = 4;
                case 4:
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Fetching trending tokens for ".concat(chain.name, " via DexScreener Premium..."));
                    now = Date.now();
                    dexDelay_1 = apiRateLimiter.dexScreener.minInterval - (now - apiRateLimiter.dexScreener.lastCall);
                    if (!(dexDelay_1 > 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, dexDelay_1); })];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6:
                    apiRateLimiter.dexScreener.lastCall = Date.now();
                    disableGeckoFill = chain.id === 'base' || chain.id === 'bsc';
                    return [4 /*yield*/, (0, dexscreener_js_1.getTrendingTokensPremium)(chain.id, 100, { disableGeckoFill: disableGeckoFill })];
                case 7:
                    tokens_1 = _b.sent();
                    // Note: GeckoTerminal fallback removed
                    // GeckoTerminal is only used for pool price/time data, not token metadata
                    // DexScreener provides more complete token data including imageUrl
                    if (tokens_1.length === 0) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "No tokens found for ".concat(chain.name));
                        return [2 /*return*/];
                    }
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Got ".concat(tokens_1.length, " trending tokens for ").concat(chain.name));
                    beforeCount = tokens_1.length;
                    tokens_1 = tokens_1.filter(function (t) { return (0, trendingValidation_js_1.validateTrendingTokenForListing)(chain.id, t).ok; });
                    removed = beforeCount - tokens_1.length;
                    if (removed > 0) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "Filtered out ".concat(removed, " invalid tokens for ").concat(chain.name));
                    }
                    return [4 /*yield*/, (0, tokenRepository_js_1.getTrendingTokens)(chain.id, TOKENS_PER_CHAIN)];
                case 8:
                    existing = _b.sent();
                    if (existing.length >= 70 && tokens_1.length < 50) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "New list too small (".concat(tokens_1.length, ") for ").concat(chain.name, "; keeping existing (").concat(existing.length, ")"));
                        return [2 /*return*/];
                    }
                    // Fast deterministic hinting before DB write (cheap, no external calls).
                    for (_i = 0, _a = tokens_1; _i < _a.length; _i++) {
                        token = _a[_i];
                        if (token.launchpad)
                            continue;
                        token.launchpad =
                            detectBySuffix(chain.id, token.address)
                                || undefined;
                    }
                    // Capture initial pool snapshot once per token (address/time/liquidity-at-first-seen).
                    return [4 /*yield*/, cacheInitialPoolSnapshots(chain.id, tokens_1)];
                case 9:
                    // Capture initial pool snapshot once per token (address/time/liquidity-at-first-seen).
                    _b.sent();
                    savedTokens = [];
                    _b.label = 10;
                case 10:
                    _b.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, (0, tokenRepository_js_1.saveTrendingTokens)(chain.id, tokens_1)];
                case 11:
                    savedTokens = _b.sent();
                    return [3 /*break*/, 13];
                case 12:
                    error_1 = _b.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, "Failed to save trending tokens for ".concat(chain.name), {
                        error: error_1 instanceof Error ? error_1.message : String(error_1)
                    });
                    return [3 /*break*/, 13];
                case 13:
                    cachedTokens = savedTokens.length > 0 ? savedTokens : tokens_1;
                    // Memory cache is already updated inside saveTrendingTokens() with merged creator/launchpad data.
                    // Only update cache here if saveTrendingTokens failed (savedTokens is empty).
                    if (savedTokens.length === 0) {
                        cacheKey = memoryCache_js_1.CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain.id);
                        memoryCache_js_1.memoryCache.set(cacheKey, cachedTokens, memoryCache_js_1.CACHE_TTL.TRENDING_TOKENS);
                    }
                    redisCacheKey = "trending:live:".concat(chain.id, ":5m");
                    _b.label = 14;
                case 14:
                    _b.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(redisCacheKey, JSON.stringify(cachedTokens), 600)];
                case 15:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 16:
                    error_2 = _b.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Failed to write cache for ".concat(chain.name), {
                        error: error_2 instanceof Error ? error_2.message : String(error_2)
                    });
                    return [3 /*break*/, 17];
                case 17:
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, "Saved ".concat(cachedTokens.length, " tokens for ").concat(chain.name, " to DB + cache"));
                    runLaunchpadEnrichment = function () { return __awaiter(_this, void 0, void 0, function () {
                        var result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, runWithTimeout(enrichLaunchpadsForTrending(chain.id, tokens_1), LAUNCHPAD_ENRICH_TIMEOUT_MS, "Launchpad enrichment for ".concat(chain.name))];
                                case 1:
                                    result = _a.sent();
                                    if (result === null)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, (0, tokenRepository_js_1.saveTrendingTokens)(chain.id, tokens_1)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    runLaunchMultipleEnrichment = function () { return __awaiter(_this, void 0, void 0, function () {
                        var result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!LAUNCH_MULTIPLE_ENRICH_ENABLED)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, runWithTimeout(enrichLaunchMultiplesForTrending(chain.id, chain.geckoNetwork, tokens_1), LAUNCH_MULTIPLE_ENRICH_TIMEOUT_MS, "Launch multiple enrichment for ".concat(chain.name))];
                                case 1:
                                    result = _a.sent();
                                    if (result === null)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, (0, tokenRepository_js_1.saveTrendingTokens)(chain.id, tokens_1)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    if (!force) return [3 /*break*/, 25];
                    _b.label = 18;
                case 18:
                    _b.trys.push([18, 20, , 21]);
                    return [4 /*yield*/, runLaunchpadEnrichment()];
                case 19:
                    _b.sent();
                    return [3 /*break*/, 21];
                case 20:
                    error_3 = _b.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Launchpad enrichment failed for ".concat(chain.name), {
                        error: error_3 instanceof Error ? error_3.message : String(error_3)
                    });
                    return [3 /*break*/, 21];
                case 21:
                    _b.trys.push([21, 23, , 24]);
                    return [4 /*yield*/, runLaunchMultipleEnrichment()];
                case 22:
                    _b.sent();
                    return [3 /*break*/, 24];
                case 23:
                    error_4 = _b.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Launch multiple enrichment failed for ".concat(chain.name), {
                        error: error_4 instanceof Error ? error_4.message : String(error_4)
                    });
                    return [3 /*break*/, 24];
                case 24: return [3 /*break*/, 26];
                case 25:
                    // Cron mode: keep refresh latency low and run enrichments in background.
                    void runLaunchpadEnrichment().catch(function (error) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Launchpad enrichment failed for ".concat(chain.name), {
                            error: error instanceof Error ? error.message : String(error)
                        });
                    });
                    void runLaunchMultipleEnrichment().catch(function (error) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Launch multiple enrichment failed for ".concat(chain.name), {
                            error: error instanceof Error ? error.message : String(error)
                        });
                    });
                    _b.label = 26;
                case 26: return [3 /*break*/, 31];
                case 27:
                    error_5 = _b.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, "Error refreshing ".concat(chain.name), { error: error_5 instanceof Error ? error_5.message : error_5 });
                    return [3 /*break*/, 31];
                case 28:
                    if (!hasDistributedLock) return [3 /*break*/, 30];
                    return [4 /*yield*/, (0, cacheClient_js_1.releaseLock)(lockKey, lockValue)];
                case 29:
                    _b.sent();
                    _b.label = 30;
                case 30:
                    // Release lock
                    refreshLocks.set(chain.id, false);
                    return [7 /*endfinally*/];
                case 31: return [2 /*return*/];
            }
        });
    });
}
function shouldRunTokenRefresh(now) {
    if (now === void 0) { now = Date.now(); }
    if ((0, runtimeActivityService_js_1.hasRecentEndUserActivity)(now)) {
        return true;
    }
    return (now - lastTokenRefreshAt) >= TOKEN_IDLE_REFRESH_INTERVAL_MS;
}
/**
 * Refresh primary chains (ETH, Solana, Base, BSC)
 * Called every 5 minutes
 */
function refreshPrimaryChains() {
    return __awaiter(this, arguments, void 0, function (force) {
        var startTime, i, chain, duration;
        if (force === void 0) { force = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (refreshPrimaryChainsInProgress) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Skipping primary chain refresh - previous run still in progress', {
                            force: force,
                            runningForSec: Math.round((Date.now() - refreshPrimaryChainsStartedAt) / 1000),
                        });
                        return [2 /*return*/];
                    }
                    refreshPrimaryChainsInProgress = true;
                    refreshPrimaryChainsStartedAt = Date.now();
                    lastTokenRefreshAt = refreshPrimaryChainsStartedAt;
                    startTime = refreshPrimaryChainsStartedAt;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 7, 8]);
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < PRIMARY_CHAINS.length)) return [3 /*break*/, 6];
                    chain = PRIMARY_CHAINS[i];
                    return [4 /*yield*/, refreshChainTokens(chain, force)];
                case 3:
                    _a.sent();
                    if (!(i < PRIMARY_CHAINS.length - 1)) return [3 /*break*/, 5];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, PRIMARY_CHAIN_DELAY_MS); })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 2];
                case 6:
                    duration = ((Date.now() - startTime) / 1000).toFixed(1);
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, "Refreshed ".concat(PRIMARY_CHAINS.length, " primary chains in ").concat(duration, "s"));
                    return [3 /*break*/, 8];
                case 7:
                    refreshPrimaryChainsInProgress = false;
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Refresh secondary chains (Arbitrum, Optimism, Polygon)
 * Called every 4 hours
 */
function refreshSecondaryChains() {
    return __awaiter(this, arguments, void 0, function (force) {
        var startTime, i, chain, duration;
        if (force === void 0) { force = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = Date.now();
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < SECONDARY_CHAINS.length)) return [3 /*break*/, 5];
                    chain = SECONDARY_CHAINS[i];
                    return [4 /*yield*/, refreshChainTokens(chain, force)];
                case 2:
                    _a.sent();
                    if (!(i < SECONDARY_CHAINS.length - 1)) return [3 /*break*/, 4];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, SECONDARY_CHAIN_DELAY_MS); })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 1];
                case 5:
                    duration = ((Date.now() - startTime) / 1000).toFixed(1);
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, "Refreshed ".concat(SECONDARY_CHAINS.length, " secondary chains in ").concat(duration, "s"));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Refresh a single chain (for targeted refresh)
 */
function refreshSingleChain(chainId_1) {
    return __awaiter(this, arguments, void 0, function (chainId, force) {
        var chain, before, after;
        if (force === void 0) { force = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chain = SUPPORTED_CHAINS.find(function (c) { return c.id === chainId; });
                    if (!chain) {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, "Unknown chain: ".concat(chainId));
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, (0, tokenRepository_js_1.getLastUpdateTime)(chain.id)];
                case 1:
                    before = _a.sent();
                    return [4 /*yield*/, refreshChainTokens(chain, force)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, tokenRepository_js_1.getLastUpdateTime)(chain.id)];
                case 3:
                    after = _a.sent();
                    if (!after)
                        return [2 /*return*/, false];
                    if (!before)
                        return [2 /*return*/, true];
                    return [2 /*return*/, after.getTime() > before.getTime()];
            }
        });
    });
}
/**
 * Get list of supported chains
 */
function getSupportedChains() {
    return SUPPORTED_CHAINS.map(function (c) { return c.id; });
}
/**
 * Initialize and start cron jobs
 */
function startTokenDataJobs() {
    // Primary chains: Every 5 minutes
    node_cron_1.default.schedule("*/".concat(PRIMARY_REFRESH_INTERVAL_MINUTES, " * * * *"), function () {
        if (!shouldRunTokenRefresh())
            return;
        void refreshPrimaryChains();
    }, {
        timezone: 'UTC',
    });
    // Secondary chains: Every 4 hours
    node_cron_1.default.schedule("0 */".concat(SECONDARY_REFRESH_INTERVAL_HOURS, " * * *"), function () {
        if (!shouldRunTokenRefresh())
            return;
        void refreshSecondaryChains();
    }, {
        timezone: 'UTC',
    });
    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, "Scheduled: Primary chains every ".concat(PRIMARY_REFRESH_INTERVAL_MINUTES, "min (").concat(PRIMARY_CHAINS.map(function (c) { return c.name; }).join(', '), ")"));
    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, "Scheduled: Secondary chains every ".concat(SECONDARY_REFRESH_INTERVAL_HOURS, "h (").concat(SECONDARY_CHAINS.map(function (c) { return c.name; }).join(', '), ")"));
    // Run initial refresh on startup (with delay for services to be ready)
    setTimeout(function () {
        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Starting initial token refresh...');
        void refreshPrimaryChains(); // Start with primary chains
        // Secondary chains will wait for their scheduled time
    }, 30000); // Wait 30 seconds for services to be ready
}
