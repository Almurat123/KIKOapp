"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.saveTrendingTokenCreator = saveTrendingTokenCreator;
exports.saveTokenLaunchpadProfile = saveTokenLaunchpadProfile;
exports.saveTrendingTokens = saveTrendingTokens;
exports.getTrendingTokens = getTrendingTokens;
exports.searchCachedTrendingTokens = searchCachedTrendingTokens;
exports.findCachedTrendingToken = findCachedTrendingToken;
exports.getLastUpdateTime = getLastUpdateTime;
var prisma_js_1 = require("../db/prisma.js");
var memoryCache_js_1 = require("../cache/memoryCache.js");
var trendingValidation_js_1 = require("../services/trendingValidation.js");
var launchpadMultipleService_js_1 = require("../services/launchpadMultipleService.js");
var cacheClient_js_1 = require("../cache/cacheClient.js");
var client_1 = require("@prisma/client");
var TRENDING_SAVE_TX_MAX_WAIT_MS = Math.max(1000, Number(process.env.TRENDING_SAVE_TX_MAX_WAIT_MS || '10000'));
var TRENDING_SAVE_TX_TIMEOUT_MS = Math.max(10000, Number(process.env.TRENDING_SAVE_TX_TIMEOUT_MS || '30000'));
var TRENDING_SAVE_BATCH_SIZE = Math.max(25, Number(process.env.TRENDING_SAVE_BATCH_SIZE || '120'));
var ENABLE_TRENDING_REDIS_METADATA = String(process.env.ENABLE_TRENDING_REDIS_METADATA || '').toLowerCase() === 'true';
var SEARCHABLE_TRENDING_CHAINS = ['eth', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'solana'];
function hasPositiveLiquidity(token) {
    return typeof token.liquidity !== 'number' || token.liquidity > 0;
}
function shouldKeepListedToken(token) {
    return hasPositiveLiquidity(token) && (0, trendingValidation_js_1.hasMeaningfulActivity)(token);
}
function toOptionalNumber(value) {
    if (value === null || value === undefined)
        return undefined;
    var n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
function normalizeSearchText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^\$/g, '')
        .replace(/[^a-z0-9]/g, '');
}
function scoreTrendingTokenMatch(query, token) {
    var rawQuery = String(query || '').trim();
    var normalizedQuery = normalizeSearchText(rawQuery);
    if (!normalizedQuery)
        return -1;
    var address = String(token.address || '').trim().toLowerCase();
    var symbol = String(token.symbol || '').trim();
    var name = String(token.name || '').trim();
    var normalizedSymbol = normalizeSearchText(symbol);
    var normalizedName = normalizeSearchText(name);
    if (address && rawQuery.toLowerCase() === address)
        return 1000;
    if (normalizedQuery === normalizedSymbol)
        return 950;
    if (normalizedQuery === normalizedName)
        return 900;
    if (normalizedSymbol.startsWith(normalizedQuery))
        return 750;
    if (normalizedName.startsWith(normalizedQuery))
        return 700;
    if (normalizedSymbol.includes(normalizedQuery))
        return 550;
    if (normalizedName.includes(normalizedQuery))
        return 500;
    return -1;
}
function dedupeTokenSearchResults(tokens) {
    var seen = new Set();
    var next = [];
    for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
        var token = tokens_1[_i];
        var key = "".concat(String(token.network || '').toLowerCase(), ":").concat(String(token.address || '').toLowerCase());
        if (seen.has(key))
            continue;
        seen.add(key);
        next.push(token);
    }
    return next;
}
function isFidLabel(value) {
    return typeof value === 'string' && /^fid:\d+$/i.test(value.trim());
}
function isXUrl(value) {
    if (!value || typeof value !== 'string')
        return false;
    try {
        var u = new URL(value);
        var host = u.hostname.replace(/^www\./, '').toLowerCase();
        return host.includes('x.com') || host.includes('twitter.com');
    }
    catch (_a) {
        return false;
    }
}
function isAddressLike(value) {
    if (!value || typeof value !== 'string')
        return false;
    var v = value.trim();
    return /^0x[a-fA-F0-9]{40}$/.test(v) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}
function shouldReplaceCreatorUrl(existing, incoming) {
    if (!incoming)
        return false;
    if (!existing)
        return true;
    if (isXUrl(existing))
        return false;
    if (isXUrl(incoming))
        return true;
    return false;
}
function shouldReplaceCreatorLabel(existing, incoming) {
    if (!incoming)
        return false;
    if (!existing)
        return true;
    var lowQualityExisting = /^@?(i|status)$/i.test(existing.trim());
    if (lowQualityExisting)
        return true;
    if (isFidLabel(existing) && !isFidLabel(incoming))
        return true;
    if (isAddressLike(existing) && !isAddressLike(incoming))
        return true;
    return false;
}
function normalizeCreatorPresentation(creatorUrl, creatorLabel) {
    var label = typeof creatorLabel === 'string' ? creatorLabel.trim() : '';
    var isFid = /^fid:\d+$/i.test(label);
    var isAtDigits = /^@\d+$/.test(label);
    var isAddr = isAddressLike(label);
    var isLowQualityXLabel = /^@?(i|status)$/i.test(label);
    if (!creatorUrl || typeof creatorUrl !== 'string') {
        if (isFid) {
            return {
                creatorUrl: undefined,
                creatorLabel: 'Farcaster',
            };
        }
        if (isAtDigits) {
            return {
                creatorUrl: undefined,
                creatorLabel: undefined,
            };
        }
        if (isLowQualityXLabel) {
            return {
                creatorUrl: undefined,
                creatorLabel: 'X post',
            };
        }
        return {
            creatorUrl: creatorUrl || undefined,
            creatorLabel: label || undefined,
        };
    }
    try {
        var u = new URL(creatorUrl);
        var host = u.hostname.replace(/^www\./, '').toLowerCase();
        var parts = u.pathname.split('/').filter(Boolean);
        var isX = host.includes('x.com') || host.includes('twitter.com');
        var isWarpcast = host.includes('warpcast.com') || host.includes('farcaster');
        if (isX) {
            var first = (parts[0] || '').replace(/^@/, '');
            var reserved = new Set(['i', 'intent', 'share', 'home', 'explore', 'search', 'messages', 'notifications', 'settings', 'tos', 'privacy', 'status']);
            var labelHandle = label.replace(/^@/, '').toLowerCase();
            var labelIsReservedHandle = !!labelHandle && reserved.has(labelHandle);
            if (first && !reserved.has(first.toLowerCase())) {
                return { creatorUrl: creatorUrl, creatorLabel: "@".concat(first) };
            }
            if (!label || isFid || isAtDigits || isAddr || labelIsReservedHandle) {
                return { creatorUrl: creatorUrl, creatorLabel: 'X post' };
            }
            return { creatorUrl: creatorUrl, creatorLabel: label };
        }
        if (isWarpcast) {
            if (!label || isFid || isAtDigits || isAddr) {
                return { creatorUrl: creatorUrl, creatorLabel: 'Farcaster' };
            }
            return { creatorUrl: creatorUrl, creatorLabel: label };
        }
    }
    catch (_a) {
        // ignore malformed url
    }
    return {
        creatorUrl: creatorUrl,
        creatorLabel: label || undefined,
    };
}
function chunkArray(items, size) {
    var chunks = [];
    for (var i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
function tokenMetaCacheKey(chain, address) {
    return "token:meta:v2:".concat(chain, ":").concat(address.toLowerCase());
}
function tokenMetaLegacyCacheKey(chain, address) {
    return "token:meta:v1:".concat(chain, ":").concat(address.toLowerCase());
}
function initialPoolCacheKey(chain, address) {
    return "token:initial_pool:v2:".concat(chain, ":").concat(address.toLowerCase());
}
function buildAddressVariants(addresses) {
    var out = new Set();
    for (var _i = 0, addresses_1 = addresses; _i < addresses_1.length; _i++) {
        var raw = addresses_1[_i];
        var v = String(raw || '').trim();
        if (!v)
            continue;
        out.add(v);
        out.add(v.toLowerCase());
    }
    return Array.from(out);
}
function launchpadCacheKey(chain, address) {
    var chainId = chain === 'base' ? 8453 : chain === 'bsc' ? 56 : chain === 'solana' ? 900 : 'any';
    return "launchpad:decision:v3:".concat(chainId, ":").concat(address.toLowerCase());
}
function parseLaunchpadCacheData(raw) {
    try {
        var parsed = JSON.parse(raw);
        var root = (parsed === null || parsed === void 0 ? void 0 : parsed.data) || {};
        var nested = (root && typeof root === 'object' && root.data && typeof root.data === 'object')
            ? root.data
            : null;
        return (nested ? __assign(__assign({}, root), nested) : root);
    }
    catch (_a) {
        return null;
    }
}
function parseLaunchpadProvider(raw) {
    try {
        var parsed = JSON.parse(raw);
        var provider = typeof (parsed === null || parsed === void 0 ? void 0 : parsed.provider) === 'string' ? parsed.provider.trim().toLowerCase() : '';
        if (!provider)
            return undefined;
        return normalizeLaunchpadTag(provider);
    }
    catch (_a) {
        return undefined;
    }
}
function loadLaunchpadDecisionCacheMap(chain, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var out, keysByAddress, _i, tokens_2, token, address, keyEntries, keyList, rows, byKey, _a, keyEntries_1, _b, address, key, raw, _c;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    out = new Map();
                    if (!Array.isArray(tokens) || tokens.length === 0)
                        return [2 /*return*/, out];
                    keysByAddress = new Map();
                    for (_i = 0, tokens_2 = tokens; _i < tokens_2.length; _i++) {
                        token = tokens_2[_i];
                        address = String(token.address || '').toLowerCase();
                        if (!address)
                            continue;
                        keysByAddress.set(address, launchpadCacheKey(chain, address));
                    }
                    keyEntries = Array.from(keysByAddress.entries());
                    if (keyEntries.length === 0)
                        return [2 /*return*/, out];
                    if (!(0, cacheClient_js_1.isRedisAvailable)()) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.all(keyEntries.map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var raw, _c;
                            var address = _b[0], key = _b[1];
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _d.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, (0, cacheClient_js_1.get)(key)];
                                    case 1:
                                        raw = _d.sent();
                                        if (raw)
                                            out.set(address, raw);
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _c = _d.sent();
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    _d.sent();
                    return [2 /*return*/, out];
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    keyList = keyEntries.map(function (_a) {
                        var key = _a[1];
                        return key;
                    });
                    return [4 /*yield*/, prisma_js_1.default.cache.findMany({
                            where: {
                                key: { in: keyList },
                                OR: [
                                    { expiresAt: null },
                                    { expiresAt: { gt: new Date() } }
                                ]
                            },
                            select: { key: true, value: true }
                        })];
                case 3:
                    rows = _d.sent();
                    byKey = new Map(rows.map(function (r) { return [r.key, r.value]; }));
                    for (_a = 0, keyEntries_1 = keyEntries; _a < keyEntries_1.length; _a++) {
                        _b = keyEntries_1[_a], address = _b[0], key = _b[1];
                        raw = byKey.get(key);
                        if (raw)
                            out.set(address, raw);
                    }
                    return [3 /*break*/, 5];
                case 4:
                    _c = _d.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, out];
            }
        });
    });
}
function pickCreatorAddressFromLaunchpadCache(raw) {
    var _a, _b, _c, _d, _e;
    try {
        var data = parseLaunchpadCacheData(raw);
        if (!data)
            return undefined;
        var candidates = [
            data.creatorAddress,
            data.creator,
            data.creator_address,
            data.userAddress,
            data.user_address,
            data.walletAddress,
            data.sentientWalletAddress,
            data.msg_sender,
            data.requestorAddress,
            data.creator_wallet,
            data.creatorWalletAddress,
            data.creatorPublicKey,
            data.mintAuthority,
            data.updateAuthority,
            data.devAddress,
            data.owner,
            data.ownerAddress,
            (_a = data.status) === null || _a === void 0 ? void 0 : _a.owner,
            data.deployer,
            data.deployerAddress,
            (_b = data.creatorProfile) === null || _b === void 0 ? void 0 : _b.address,
            (_c = data.profile) === null || _c === void 0 ? void 0 : _c.address,
            (_d = data.user) === null || _d === void 0 ? void 0 : _d.address,
            (_e = data.author) === null || _e === void 0 ? void 0 : _e.address,
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
            var rawValue = candidates_1[_i];
            if (typeof rawValue !== 'string')
                continue;
            var value = rawValue.trim();
            if ((evmLike.test(value) || solLike.test(value)) && !isIgnored(value))
                return value;
        }
    }
    catch (_f) {
        // ignore parsing errors
    }
    return undefined;
}
function pickCreatorMetaFromLaunchpadCache(raw) {
    var _a, _b, _c, _d;
    var creatorAddress;
    var creatorUrl;
    var creatorLabel;
    try {
        var data = parseLaunchpadCacheData(raw);
        if (!data)
            return {};
        creatorAddress = pickCreatorAddressFromLaunchpadCache(raw);
        var socials = (data.socials || {});
        var urlCandidates = [
            data.creatorUrl,
            data.creator_url,
            data.profileUrl,
            data.profile_url,
            socials.website,
            socials.telegram,
            socials.discord,
            socials.x,
            socials.twitter,
            socials.TWITTER,
            socials.farcaster,
            socials.warpcast,
            (_a = data.social_context) === null || _a === void 0 ? void 0 : _a.url,
            (_b = data.social_context) === null || _b === void 0 ? void 0 : _b.profile,
        ];
        for (var _i = 0, urlCandidates_1 = urlCandidates; _i < urlCandidates_1.length; _i++) {
            var c = urlCandidates_1[_i];
            if (typeof c !== 'string')
                continue;
            var v = c.trim();
            if (v.startsWith('http://') || v.startsWith('https://')) {
                creatorUrl = v;
                break;
            }
            if (v.startsWith('@')) {
                creatorUrl = "https://x.com/".concat(v.slice(1));
                break;
            }
        }
        if (!creatorUrl) {
            var requestorFid = Number(data.requestor_fid || data.requestorFid || 0);
            if (Number.isFinite(requestorFid) && requestorFid > 0) {
                creatorUrl = "https://warpcast.com/~/profiles/".concat(requestorFid);
            }
        }
        var labelCandidates = [
            (_c = data.creatorProfile) === null || _c === void 0 ? void 0 : _c.handle,
            data.creatorHandle,
            (_d = data.social_context) === null || _d === void 0 ? void 0 : _d.id,
            socials.handle,
            data.twitterUsername,
            data.farcasterUsername,
        ];
        for (var _e = 0, labelCandidates_1 = labelCandidates; _e < labelCandidates_1.length; _e++) {
            var c = labelCandidates_1[_e];
            if (typeof c !== 'string')
                continue;
            var v = c.trim();
            if (!v)
                continue;
            var digitsOnly = /^\d+$/.test(v.replace(/^@/, ''));
            var lowQuality = /^@?(i|status)$/i.test(v);
            if (digitsOnly || lowQuality)
                continue;
            creatorLabel = v.startsWith('@') ? v : ((creatorUrl === null || creatorUrl === void 0 ? void 0 : creatorUrl.includes('x.com')) || (creatorUrl === null || creatorUrl === void 0 ? void 0 : creatorUrl.includes('warpcast.com')) ? "@".concat(v) : v);
            break;
        }
        var addressLike = function (value) { return !!value && (/^0x[a-f0-9]{40}$/i.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)); };
        if (creatorLabel && addressLike(creatorLabel))
            creatorLabel = undefined;
    }
    catch (_f) {
        // ignore parsing errors
    }
    return { creatorAddress: creatorAddress, creatorUrl: creatorUrl, creatorLabel: creatorLabel };
}
function pickLaunchpadFromLaunchpadCache(raw) {
    return parseLaunchpadProvider(raw);
}
function sanitizeCreatorLabel(value) {
    if (!value || typeof value !== 'string')
        return undefined;
    var v = value.trim();
    if (!v)
        return undefined;
    if (/^fid:\d+$/i.test(v))
        return undefined;
    if (/^@\d+$/.test(v))
        return undefined;
    if (/^\d+$/.test(v))
        return undefined;
    if (/^@?(i|status)$/i.test(v))
        return undefined;
    return v;
}
var trendingLaunchpadColumnCache = null;
var trendingCreatorColumnCache = null;
var tokenLaunchpadProfileTableCache = null;
var SCHEMA_EXISTS_CACHE_TTL_MS = 10 * 60 * 1000;
var SCHEMA_MISSING_CACHE_TTL_MS = 30 * 1000;
function normalizeLaunchpadTag(value) {
    var v = String(value || '').trim().toLowerCase();
    if (!v)
        return undefined;
    if (v === 'pumpfun')
        return 'pump.fun';
    if (v === 'bonkfun')
        return 'bonk.fun';
    if (v === 'fourmeme')
        return 'four.meme';
    if (v === 'flaunch.gg')
        return 'flaunch';
    if (v === 'creator.bid')
        return 'creatorbid';
    if (v === 'doppler finance' || v === 'dopplerfinance')
        return 'doppler';
    return v;
}
function shouldCarryForwardLaunchpadTag(launchpad, creator) {
    var normalized = normalizeLaunchpadTag(launchpad);
    if (!normalized)
        return false;
    if ((creator === null || creator === void 0 ? void 0 : creator.creatorAddress) || (creator === null || creator === void 0 ? void 0 : creator.creatorUrl) || (creator === null || creator === void 0 ? void 0 : creator.creatorLabel))
        return true;
    // Deterministic/vanity-suffix launchpads can be safely preserved.
    var deterministic = new Set(['clanker', 'four.meme', 'flap', 'pump.fun', 'bonk.fun']);
    return deterministic.has(normalized);
}
function hasTrendingLaunchpadColumn() {
    return __awaiter(this, void 0, void 0, function () {
        var now, ttl, rows, exists, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    now = Date.now();
                    if (trendingLaunchpadColumnCache) {
                        ttl = trendingLaunchpadColumnCache.exists ? SCHEMA_EXISTS_CACHE_TTL_MS : SCHEMA_MISSING_CACHE_TTL_MS;
                        if (now - trendingLaunchpadColumnCache.checkedAt < ttl) {
                            return [2 /*return*/, trendingLaunchpadColumnCache.exists];
                        }
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      SELECT EXISTS (\n        SELECT 1\n        FROM information_schema.columns\n        WHERE table_schema = current_schema()\n          AND table_name = 'TrendingToken'\n          AND column_name = 'launchpad'\n      ) AS \"exists\"\n    "], ["\n      SELECT EXISTS (\n        SELECT 1\n        FROM information_schema.columns\n        WHERE table_schema = current_schema()\n          AND table_name = 'TrendingToken'\n          AND column_name = 'launchpad'\n      ) AS \"exists\"\n    "])))];
                case 2:
                    rows = _c.sent();
                    exists = !!((_b = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _b === void 0 ? void 0 : _b.exists);
                    trendingLaunchpadColumnCache = { checkedAt: now, exists: exists };
                    return [2 /*return*/, exists];
                case 3:
                    _a = _c.sent();
                    // Safe default: assume missing to avoid runtime failures.
                    trendingLaunchpadColumnCache = { checkedAt: now, exists: false };
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function hasTrendingCreatorColumns() {
    return __awaiter(this, void 0, void 0, function () {
        var now, ttl, rows, exists, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    now = Date.now();
                    if (trendingCreatorColumnCache) {
                        ttl = trendingCreatorColumnCache.exists ? SCHEMA_EXISTS_CACHE_TTL_MS : SCHEMA_MISSING_CACHE_TTL_MS;
                        if (now - trendingCreatorColumnCache.checkedAt < ttl) {
                            return [2 /*return*/, trendingCreatorColumnCache.exists];
                        }
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      SELECT EXISTS (\n        SELECT 1\n        FROM information_schema.columns\n        WHERE table_schema = current_schema()\n          AND table_name = 'TrendingToken'\n          AND column_name = 'creator_address'\n      ) AS \"exists\"\n    "], ["\n      SELECT EXISTS (\n        SELECT 1\n        FROM information_schema.columns\n        WHERE table_schema = current_schema()\n          AND table_name = 'TrendingToken'\n          AND column_name = 'creator_address'\n      ) AS \"exists\"\n    "])))];
                case 2:
                    rows = _c.sent();
                    exists = !!((_b = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _b === void 0 ? void 0 : _b.exists);
                    trendingCreatorColumnCache = { checkedAt: now, exists: exists };
                    return [2 /*return*/, exists];
                case 3:
                    _a = _c.sent();
                    // Safe default: assume missing to avoid runtime failures.
                    trendingCreatorColumnCache = { checkedAt: now, exists: false };
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function hasTokenLaunchpadProfileTable() {
    return __awaiter(this, void 0, void 0, function () {
        var now, ttl, rows, exists, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    now = Date.now();
                    if (tokenLaunchpadProfileTableCache) {
                        ttl = tokenLaunchpadProfileTableCache.exists ? SCHEMA_EXISTS_CACHE_TTL_MS : SCHEMA_MISSING_CACHE_TTL_MS;
                        if (now - tokenLaunchpadProfileTableCache.checkedAt < ttl) {
                            return [2 /*return*/, tokenLaunchpadProfileTableCache.exists];
                        }
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      SELECT EXISTS (\n        SELECT 1\n        FROM information_schema.tables\n        WHERE table_schema = current_schema()\n          AND table_name = 'TokenLaunchpadProfile'\n      ) AS \"exists\"\n    "], ["\n      SELECT EXISTS (\n        SELECT 1\n        FROM information_schema.tables\n        WHERE table_schema = current_schema()\n          AND table_name = 'TokenLaunchpadProfile'\n      ) AS \"exists\"\n    "])))];
                case 2:
                    rows = _c.sent();
                    exists = !!((_b = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _b === void 0 ? void 0 : _b.exists);
                    tokenLaunchpadProfileTableCache = { checkedAt: now, exists: exists };
                    return [2 /*return*/, exists];
                case 3:
                    _a = _c.sent();
                    tokenLaunchpadProfileTableCache = { checkedAt: now, exists: false };
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function isMissingLaunchpadColumnError(error) {
    var _a;
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError))
        return false;
    if (error.code !== 'P2022')
        return false;
    var col = String(((_a = error.meta) === null || _a === void 0 ? void 0 : _a.column) || '').toLowerCase();
    return col.includes('launchpad');
}
function isMissingCreatorColumnError(error) {
    var _a;
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError))
        return false;
    if (error.code !== 'P2022')
        return false;
    var col = String(((_a = error.meta) === null || _a === void 0 ? void 0 : _a.column) || '').toLowerCase();
    return col.includes('creator_address') || col.includes('creator_url') || col.includes('creator_label');
}
function saveTrendingTokenCreator(chain, address, creator) {
    return __awaiter(this, void 0, void 0, function () {
        var lower, canWriteProfile, canWriteCreator, existing, updateData, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    if (!creator.creatorAddress && !creator.creatorUrl && !creator.creatorLabel)
                        return [2 /*return*/];
                    lower = address.toLowerCase();
                    return [4 /*yield*/, hasTokenLaunchpadProfileTable()];
                case 1:
                    canWriteProfile = _a.sent();
                    if (!canWriteProfile) return [3 /*break*/, 4];
                    // Normalize historical mixed-case duplicates to avoid split-brain profile reads.
                    return [4 /*yield*/, prisma_js_1.default.tokenLaunchpadProfile.deleteMany({
                            where: {
                                chain: chain,
                                address: { in: [address, lower] },
                                NOT: { address: lower },
                            },
                        })];
                case 2:
                    // Normalize historical mixed-case duplicates to avoid split-brain profile reads.
                    _a.sent();
                    return [4 /*yield*/, prisma_js_1.default.tokenLaunchpadProfile.upsert({
                            where: { chain_address: { chain: chain, address: lower } },
                            update: {
                                creatorAddress: creator.creatorAddress || undefined,
                                creatorUrl: creator.creatorUrl || undefined,
                                creatorLabel: creator.creatorLabel || undefined,
                                lastCheckedAt: new Date(),
                                verifiedAt: new Date(),
                                lastError: null,
                            },
                            create: {
                                chain: chain,
                                address: lower,
                                creatorAddress: creator.creatorAddress || undefined,
                                creatorUrl: creator.creatorUrl || undefined,
                                creatorLabel: creator.creatorLabel || undefined,
                                source: 'launchpad_detector',
                                verifiedAt: new Date(),
                                lastCheckedAt: new Date(),
                            },
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [4 /*yield*/, hasTrendingCreatorColumns()];
                case 5:
                    canWriteCreator = _a.sent();
                    if (!canWriteCreator)
                        return [2 /*return*/];
                    return [4 /*yield*/, prisma_js_1.default.trendingToken.findFirst({
                            where: {
                                chain: chain,
                                address: { in: [lower, address] },
                            },
                            select: { address: true, creatorAddress: true, creatorUrl: true, creatorLabel: true },
                        })];
                case 6:
                    existing = _a.sent();
                    if (!existing)
                        return [2 /*return*/];
                    updateData = {};
                    if (!existing.creatorAddress && creator.creatorAddress)
                        updateData.creatorAddress = creator.creatorAddress;
                    if (shouldReplaceCreatorUrl(existing.creatorUrl, creator.creatorUrl))
                        updateData.creatorUrl = creator.creatorUrl || null;
                    if (shouldReplaceCreatorLabel(existing.creatorLabel, creator.creatorLabel))
                        updateData.creatorLabel = creator.creatorLabel || null;
                    if (Object.keys(updateData).length === 0)
                        return [2 /*return*/];
                    // Non-throwing update: row may be deleted/reinserted by refresh transaction between read and write.
                    return [4 /*yield*/, prisma_js_1.default.trendingToken.updateMany({
                            where: { chain: chain, address: existing.address },
                            data: updateData,
                        })];
                case 7:
                    // Non-throwing update: row may be deleted/reinserted by refresh transaction between read and write.
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _a.sent();
                    if (isMissingCreatorColumnError(error_1)) {
                        trendingCreatorColumnCache = { checkedAt: Date.now(), exists: false };
                        return [2 /*return*/];
                    }
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function saveTokenLaunchpadProfile(chain, address, profile) {
    return __awaiter(this, void 0, void 0, function () {
        var lower, canWriteProfile, normalizedLaunchpad, creatorLabel, hasCreatorMeta, source, isExplicitClear, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    lower = address.toLowerCase();
                    return [4 /*yield*/, hasTokenLaunchpadProfileTable()];
                case 1:
                    canWriteProfile = _b.sent();
                    if (!canWriteProfile)
                        return [2 /*return*/];
                    // Normalize historical mixed-case duplicates to avoid stale row wins.
                    return [4 /*yield*/, prisma_js_1.default.tokenLaunchpadProfile.deleteMany({
                            where: {
                                chain: chain,
                                address: { in: [address, lower] },
                                NOT: { address: lower },
                            },
                        })];
                case 2:
                    // Normalize historical mixed-case duplicates to avoid stale row wins.
                    _b.sent();
                    normalizedLaunchpad = profile.launchpad === null
                        ? null
                        : normalizeLaunchpadTag(profile.launchpad);
                    creatorLabel = sanitizeCreatorLabel(profile.creatorLabel);
                    hasCreatorMeta = !!profile.creatorAddress || !!profile.creatorUrl || !!creatorLabel;
                    source = profile.source || 'launchpad_detector';
                    isExplicitClear = normalizedLaunchpad === null && !hasCreatorMeta && source.includes('clear');
                    if (!normalizedLaunchpad && !hasCreatorMeta && !isExplicitClear) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma_js_1.default.tokenLaunchpadProfile.upsert({
                            where: { chain_address: { chain: chain, address: lower } },
                            update: {
                                launchpad: normalizedLaunchpad,
                                creatorAddress: profile.creatorAddress || undefined,
                                creatorUrl: profile.creatorUrl || undefined,
                                creatorLabel: creatorLabel || undefined,
                                source: source,
                                verifiedAt: new Date(),
                                lastCheckedAt: new Date(),
                                lastError: null,
                            },
                            create: {
                                chain: chain,
                                address: lower,
                                launchpad: normalizedLaunchpad,
                                creatorAddress: profile.creatorAddress || undefined,
                                creatorUrl: profile.creatorUrl || undefined,
                                creatorLabel: creatorLabel || undefined,
                                source: source,
                                verifiedAt: new Date(),
                                lastCheckedAt: new Date(),
                            },
                        })];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function saveTrendingTokens(chain, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var mergedTokens_1, canWriteLaunchpad_1, canWriteCreator_1, listedTokens, cacheKey, error_2;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    mergedTokens_1 = [];
                    return [4 /*yield*/, hasTrendingLaunchpadColumn()];
                case 1:
                    canWriteLaunchpad_1 = _a.sent();
                    return [4 /*yield*/, hasTrendingCreatorColumns()];
                case 2:
                    canWriteCreator_1 = _a.sent();
                    return [4 /*yield*/, (0, prisma_js_1.withRetry)(function () { return __awaiter(_this, void 0, void 0, function () {
                            var seenAddresses, uniqueTokens, addressList;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        seenAddresses = new Set();
                                        uniqueTokens = tokens.filter(function (token) {
                                            if (!token.address)
                                                return false;
                                            var addr = token.address.toLowerCase();
                                            if (seenAddresses.has(addr))
                                                return false;
                                            seenAddresses.add(addr);
                                            return true;
                                        });
                                        addressList = uniqueTokens.map(function (token) { return token.address.toLowerCase(); });
                                        mergedTokens_1 = uniqueTokens;
                                        // Use a transaction to ensure atomicity
                                        return [4 /*yield*/, prisma_js_1.default.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var existingRows, _a, existingPoolCreatedAt, existingCreatorData, _i, existingRows_1, row, addr, mappedRows, batches, _b, batches_1, batch;
                                                return __generator(this, function (_c) {
                                                    switch (_c.label) {
                                                        case 0:
                                                            if (!(addressList.length > 0)) return [3 /*break*/, 2];
                                                            return [4 /*yield*/, tx.trendingToken.findMany({
                                                                    where: {
                                                                        chain: chain,
                                                                        address: { in: addressList },
                                                                    },
                                                                    select: {
                                                                        address: true,
                                                                        poolCreatedAt: true,
                                                                        launchpad: true,
                                                                        creatorAddress: true,
                                                                        creatorUrl: true,
                                                                        creatorLabel: true,
                                                                    },
                                                                })];
                                                        case 1:
                                                            _a = _c.sent();
                                                            return [3 /*break*/, 3];
                                                        case 2:
                                                            _a = [];
                                                            _c.label = 3;
                                                        case 3:
                                                            existingRows = _a;
                                                            existingPoolCreatedAt = new Map();
                                                            existingCreatorData = new Map();
                                                            for (_i = 0, existingRows_1 = existingRows; _i < existingRows_1.length; _i++) {
                                                                row = existingRows_1[_i];
                                                                addr = row.address.toLowerCase();
                                                                if (row.poolCreatedAt instanceof Date) {
                                                                    existingPoolCreatedAt.set(addr, row.poolCreatedAt);
                                                                }
                                                                if (row.creatorAddress || row.creatorUrl || row.creatorLabel || row.launchpad) {
                                                                    existingCreatorData.set(addr, {
                                                                        launchpad: row.launchpad,
                                                                        creatorAddress: row.creatorAddress,
                                                                        creatorUrl: row.creatorUrl,
                                                                        creatorLabel: row.creatorLabel,
                                                                    });
                                                                }
                                                            }
                                                            mergedTokens_1 = uniqueTokens.map(function (token) {
                                                                var addr = token.address.toLowerCase();
                                                                var existing = existingPoolCreatedAt.get(addr);
                                                                var incoming = token.poolCreatedAt ? new Date(token.poolCreatedAt) : null;
                                                                var incomingValid = incoming instanceof Date && Number.isFinite(incoming.getTime());
                                                                var poolCreatedAt = incomingValid ? incoming : existing || null;
                                                                if (incomingValid && existing && incoming.getTime() > existing.getTime()) {
                                                                    // Keep earliest known creation time (pool creation shouldn't move forward)
                                                                    poolCreatedAt = existing;
                                                                }
                                                                // Preserve previously-discovered creator/launchpad data when incoming has none
                                                                var existingCreator = existingCreatorData.get(addr);
                                                                var merged = __assign(__assign({}, token), { poolCreatedAt: poolCreatedAt ? poolCreatedAt.toISOString() : undefined });
                                                                if (existingCreator) {
                                                                    if (!merged.launchpad
                                                                        && existingCreator.launchpad
                                                                        && shouldCarryForwardLaunchpadTag(existingCreator.launchpad, existingCreator)) {
                                                                        merged.launchpad = normalizeLaunchpadTag(existingCreator.launchpad);
                                                                    }
                                                                    if (!merged.creatorAddress && existingCreator.creatorAddress)
                                                                        merged.creatorAddress = existingCreator.creatorAddress;
                                                                    if (!merged.creatorUrl && existingCreator.creatorUrl)
                                                                        merged.creatorUrl = existingCreator.creatorUrl;
                                                                    if (!merged.creatorLabel && existingCreator.creatorLabel)
                                                                        merged.creatorLabel = existingCreator.creatorLabel;
                                                                }
                                                                return merged;
                                                            });
                                                            if (!(addressList.length > 0)) return [3 /*break*/, 5];
                                                            return [4 /*yield*/, tx.trendingToken.deleteMany({
                                                                    where: {
                                                                        chain: chain,
                                                                        address: { notIn: addressList }
                                                                    }
                                                                })];
                                                        case 4:
                                                            _c.sent();
                                                            return [3 /*break*/, 7];
                                                        case 5: return [4 /*yield*/, tx.trendingToken.deleteMany({
                                                                where: { chain: chain }
                                                            })];
                                                        case 6:
                                                            _c.sent();
                                                            _c.label = 7;
                                                        case 7:
                                                            if (!(mergedTokens_1.length > 0)) return [3 /*break*/, 11];
                                                            mappedRows = mergedTokens_1.map(function (token, index) {
                                                                var _a, _b, _c, _d, _e, _f, _g, _h;
                                                                var baseData = {
                                                                    chain: chain,
                                                                    address: token.address.toLowerCase(),
                                                                    name: token.name,
                                                                    symbol: token.symbol,
                                                                    imageUrl: token.imageUrl || null,
                                                                    poolCreatedAt: token.poolCreatedAt ? new Date(token.poolCreatedAt) : null,
                                                                    price: (_a = toOptionalNumber(token.price)) !== null && _a !== void 0 ? _a : null,
                                                                    priceChange5m: (_b = toOptionalNumber(token.priceChange5m)) !== null && _b !== void 0 ? _b : null,
                                                                    priceChange1h: (_c = toOptionalNumber(token.priceChange1h)) !== null && _c !== void 0 ? _c : null,
                                                                    priceChange6h: (_d = toOptionalNumber(token.priceChange6h)) !== null && _d !== void 0 ? _d : null,
                                                                    priceChange24h: (_e = toOptionalNumber(token.priceChange24h)) !== null && _e !== void 0 ? _e : null,
                                                                    volume24h: (_f = toOptionalNumber(token.volume24h)) !== null && _f !== void 0 ? _f : null,
                                                                    liquidity: (_g = toOptionalNumber(token.liquidity)) !== null && _g !== void 0 ? _g : null,
                                                                    fdv: (_h = toOptionalNumber(token.fdv)) !== null && _h !== void 0 ? _h : null,
                                                                    rank: index + 1,
                                                                };
                                                                if (canWriteLaunchpad_1) {
                                                                    baseData.launchpad = normalizeLaunchpadTag(token.launchpad) || null;
                                                                }
                                                                if (canWriteCreator_1) {
                                                                    baseData.creatorAddress = token.creatorAddress || null;
                                                                    baseData.creatorUrl = token.creatorUrl || null;
                                                                    baseData.creatorLabel = token.creatorLabel || null;
                                                                }
                                                                return baseData;
                                                            });
                                                            batches = chunkArray(mappedRows, Math.min(TRENDING_SAVE_BATCH_SIZE, 80));
                                                            _b = 0, batches_1 = batches;
                                                            _c.label = 8;
                                                        case 8:
                                                            if (!(_b < batches_1.length)) return [3 /*break*/, 11];
                                                            batch = batches_1[_b];
                                                            return [4 /*yield*/, Promise.all(batch.map(function (row) {
                                                                    return tx.trendingToken.upsert({
                                                                        where: {
                                                                            chain_address: {
                                                                                chain: chain,
                                                                                address: row.address,
                                                                            }
                                                                        },
                                                                        update: row,
                                                                        create: row,
                                                                    });
                                                                }))];
                                                        case 9:
                                                            _c.sent();
                                                            _c.label = 10;
                                                        case 10:
                                                            _b++;
                                                            return [3 /*break*/, 8];
                                                        case 11: return [2 /*return*/];
                                                    }
                                                });
                                            }); }, {
                                                maxWait: TRENDING_SAVE_TX_MAX_WAIT_MS,
                                                timeout: TRENDING_SAVE_TX_TIMEOUT_MS,
                                            })];
                                    case 1:
                                        // Use a transaction to ensure atomicity
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _a.sent();
                    listedTokens = mergedTokens_1.filter(function (t) { return shouldKeepListedToken(t); });
                    cacheKey = memoryCache_js_1.CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
                    memoryCache_js_1.memoryCache.set(cacheKey, listedTokens, memoryCache_js_1.CACHE_TTL.TRENDING_TOKENS);
                    console.log("Saved ".concat(listedTokens.length, "/").concat(mergedTokens_1.length, " trending tokens for ").concat(chain, " to database and memory cache"));
                    return [2 /*return*/, listedTokens];
                case 4:
                    error_2 = _a.sent();
                    if (isMissingLaunchpadColumnError(error_2)) {
                        // Refresh cache and retry once without launchpad writes.
                        trendingLaunchpadColumnCache = { checkedAt: Date.now(), exists: false };
                        return [2 /*return*/, saveTrendingTokens(chain, tokens)];
                    }
                    if (isMissingCreatorColumnError(error_2)) {
                        trendingCreatorColumnCache = { checkedAt: Date.now(), exists: false };
                        return [2 /*return*/, saveTrendingTokens(chain, tokens)];
                    }
                    console.error('Error saving trending tokens:', error_2);
                    throw error_2;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get trending tokens from cache or database
 * Returns TokenSearchResult[] (without chain and rank) for API compatibility
 */
function getTrendingTokens() {
    return __awaiter(this, arguments, void 0, function (chain, limit, opts) {
        var cacheKey, cached, canReadLaunchpad, canReadCreator, fetchLimit, result, _a, tokens, canReadProfile, addresses, profiles, byAddress, _i, profiles_1, p, key, deterministicLaunchpads, _b, tokens_3, token, profile, profileLaunchpad, tokenLaunchpad, profileTs, profileAgeMs, isProfileStale, hasProfileCreator, _c, _d, tokens_4, token, multiple, rawByAddress, _e, tokens_5, token, raw, cachedLaunchpad, creator, listedTokens, _f, listedTokens_1, token, normalized, error_3;
        var _this = this;
        if (chain === void 0) { chain = 'eth'; }
        if (limit === void 0) { limit = 50; }
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 18, , 19]);
                    cacheKey = memoryCache_js_1.CACHE_KEYS.TRENDING_TOKENS_BY_CHAIN(chain);
                    cached = (opts === null || opts === void 0 ? void 0 : opts.bypassMemoryCache) ? null : memoryCache_js_1.memoryCache.get(cacheKey);
                    return [4 /*yield*/, hasTrendingLaunchpadColumn()];
                case 1:
                    canReadLaunchpad = _g.sent();
                    return [4 /*yield*/, hasTrendingCreatorColumns()];
                case 2:
                    canReadCreator = _g.sent();
                    fetchLimit = Math.max(limit, 120);
                    if (!(!cached || cached.length === 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, prisma_js_1.default.trendingToken.findMany({
                            where: { chain: chain },
                            orderBy: { rank: 'asc' },
                            take: fetchLimit,
                            select: __assign(__assign({ address: true, name: true, symbol: true, imageUrl: true, poolCreatedAt: true, price: true, priceChange5m: true, priceChange1h: true, priceChange6h: true, priceChange24h: true, volume24h: true, liquidity: true, fdv: true }, (canReadLaunchpad ? { launchpad: true } : {})), (canReadCreator ? { creatorAddress: true, creatorUrl: true, creatorLabel: true } : {})),
                        })];
                case 3:
                    _a = _g.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = [];
                    _g.label = 5;
                case 5:
                    result = _a;
                    tokens = (cached && cached.length > 0)
                        ? cached
                            .slice(0, limit)
                            .map(function (t) { return (__assign({}, t)); })
                        : result.map(function (row) { return ({
                            address: row.address,
                            name: row.name,
                            symbol: row.symbol,
                            network: chain, // Derive from chain parameter since not stored in DB
                            imageUrl: row.imageUrl || undefined,
                            poolCreatedAt: row.poolCreatedAt
                                ? row.poolCreatedAt.toISOString()
                                : undefined,
                            price: toOptionalNumber(row.price),
                            priceChange5m: toOptionalNumber(row.priceChange5m),
                            priceChange1h: toOptionalNumber(row.priceChange1h),
                            priceChange6h: toOptionalNumber(row.priceChange6h),
                            priceChange24h: toOptionalNumber(row.priceChange24h),
                            volume24h: toOptionalNumber(row.volume24h),
                            liquidity: toOptionalNumber(row.liquidity),
                            fdv: toOptionalNumber(row.fdv),
                            launchpad: normalizeLaunchpadTag(row.launchpad),
                            creatorAddress: row.creatorAddress || undefined,
                            creatorUrl: row.creatorUrl || undefined,
                            creatorLabel: row.creatorLabel || undefined,
                        }); });
                    _g.label = 6;
                case 6:
                    _g.trys.push([6, 10, , 11]);
                    return [4 /*yield*/, hasTokenLaunchpadProfileTable()];
                case 7:
                    canReadProfile = _g.sent();
                    if (!(canReadProfile && tokens.length > 0)) return [3 /*break*/, 9];
                    addresses = buildAddressVariants(tokens.map(function (t) { return t.address; }));
                    return [4 /*yield*/, prisma_js_1.default.tokenLaunchpadProfile.findMany({
                            where: { chain: chain, address: { in: addresses } },
                            orderBy: { updatedAt: 'desc' },
                            select: {
                                address: true,
                                launchpad: true,
                                creatorAddress: true,
                                creatorUrl: true,
                                creatorLabel: true,
                                source: true,
                                lastCheckedAt: true,
                                updatedAt: true,
                            },
                        })];
                case 8:
                    profiles = _g.sent();
                    byAddress = new Map();
                    for (_i = 0, profiles_1 = profiles; _i < profiles_1.length; _i++) {
                        p = profiles_1[_i];
                        key = p.address.toLowerCase();
                        if (!byAddress.has(key))
                            byAddress.set(key, p);
                    }
                    deterministicLaunchpads = new Set(['clanker', 'four.meme', 'flap', 'pump.fun', 'bonk.fun']);
                    for (_b = 0, tokens_3 = tokens; _b < tokens_3.length; _b++) {
                        token = tokens_3[_b];
                        profile = byAddress.get(token.address.toLowerCase());
                        if (!profile)
                            continue;
                        profileLaunchpad = normalizeLaunchpadTag(profile.launchpad);
                        tokenLaunchpad = normalizeLaunchpadTag(token.launchpad);
                        profileTs = profile.lastCheckedAt || profile.updatedAt || null;
                        profileAgeMs = profileTs ? (Date.now() - profileTs.getTime()) : Number.POSITIVE_INFINITY;
                        isProfileStale = Number.isFinite(profileAgeMs) && profileAgeMs > 24 * 60 * 60 * 1000;
                        hasProfileCreator = !!profile.creatorAddress || !!profile.creatorUrl || !!profile.creatorLabel;
                        // If profile explicitly has no launchpad and no creator metadata, clear stale non-deterministic tags
                        // from TrendingToken rows (e.g. historical false-positive doppler labels).
                        if (!profileLaunchpad && tokenLaunchpad) {
                            if (!hasProfileCreator && !deterministicLaunchpads.has(tokenLaunchpad)) {
                                delete token.launchpad;
                            }
                        }
                        // Fill missing launchpad from persisted profile when TrendingToken row has no tag.
                        // This unblocks capsules for tokens detected asynchronously by background verifier.
                        if (!token.launchpad) {
                            if (profileLaunchpad && !(isProfileStale && !hasProfileCreator)) {
                                token.launchpad = profileLaunchpad;
                            }
                        }
                        if (!token.creatorAddress && profile.creatorAddress)
                            token.creatorAddress = profile.creatorAddress;
                        if (shouldReplaceCreatorUrl(token.creatorUrl, profile.creatorUrl))
                            token.creatorUrl = profile.creatorUrl;
                        if (shouldReplaceCreatorLabel(token.creatorLabel, profile.creatorLabel))
                            token.creatorLabel = profile.creatorLabel;
                    }
                    _g.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    _c = _g.sent();
                    return [3 /*break*/, 11];
                case 11:
                    // Launch multiple from fixed launchpad start prices (non-launchpad tokens stay empty).
                    for (_d = 0, tokens_4 = tokens; _d < tokens_4.length; _d++) {
                        token = tokens_4[_d];
                        multiple = (0, launchpadMultipleService_js_1.computeLaunchpadMultiple)(chain, token.launchpad, token.price);
                        if (multiple) {
                            token.launchMultiple = multiple;
                        }
                        else {
                            delete token.launchMultiple;
                        }
                    }
                    if (!(!(opts === null || opts === void 0 ? void 0 : opts.lightweight) && ENABLE_TRENDING_REDIS_METADATA)) return [3 /*break*/, 15];
                    return [4 /*yield*/, Promise.all(tokens.map(function (token) { return __awaiter(_this, void 0, void 0, function () {
                            var raw, fromLegacy, meta, multiple, cacheVersion, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 4, , 5]);
                                        return [4 /*yield*/, (0, cacheClient_js_1.get)(tokenMetaCacheKey(chain, token.address))];
                                    case 1:
                                        raw = _b.sent();
                                        fromLegacy = false;
                                        if (!!raw) return [3 /*break*/, 3];
                                        return [4 /*yield*/, (0, cacheClient_js_1.get)(tokenMetaLegacyCacheKey(chain, token.address))];
                                    case 2:
                                        raw = _b.sent();
                                        fromLegacy = !!raw;
                                        _b.label = 3;
                                    case 3:
                                        if (!raw)
                                            return [2 /*return*/];
                                        meta = JSON.parse(raw);
                                        if ((meta === null || meta === void 0 ? void 0 : meta.creatorAddress) && !token.creatorAddress)
                                            token.creatorAddress = meta.creatorAddress;
                                        if (shouldReplaceCreatorUrl(token.creatorUrl, meta === null || meta === void 0 ? void 0 : meta.creatorUrl))
                                            token.creatorUrl = meta === null || meta === void 0 ? void 0 : meta.creatorUrl;
                                        if (shouldReplaceCreatorLabel(token.creatorLabel, meta === null || meta === void 0 ? void 0 : meta.creatorLabel))
                                            token.creatorLabel = meta === null || meta === void 0 ? void 0 : meta.creatorLabel;
                                        // Preserve fixed-launchpad multiple as source of truth; only backfill if absent.
                                        if (!Number.isFinite(Number(token.launchMultiple || 0))) {
                                            multiple = Number((meta === null || meta === void 0 ? void 0 : meta.launchMultiple) || 0);
                                            cacheVersion = Number((meta === null || meta === void 0 ? void 0 : meta.cacheVersion) || 0);
                                            if (!fromLegacy && cacheVersion >= 2 && Number.isFinite(multiple) && multiple > 0 && multiple <= 200000) {
                                                token.launchMultiple = multiple;
                                            }
                                        }
                                        return [3 /*break*/, 5];
                                    case 4:
                                        _a = _b.sent();
                                        return [3 /*break*/, 5];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 12:
                    _g.sent();
                    return [4 /*yield*/, Promise.all(tokens.map(function (token) { return __awaiter(_this, void 0, void 0, function () {
                            var raw, meta, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, (0, cacheClient_js_1.get)(initialPoolCacheKey(chain, token.address))];
                                    case 1:
                                        raw = _b.sent();
                                        if (!raw)
                                            return [2 /*return*/];
                                        meta = JSON.parse(raw);
                                        if (meta === null || meta === void 0 ? void 0 : meta.initialPoolAddress)
                                            token.initialPoolAddress = meta.initialPoolAddress;
                                        if (meta === null || meta === void 0 ? void 0 : meta.initialPoolCreatedAt)
                                            token.initialPoolCreatedAt = meta.initialPoolCreatedAt;
                                        // Reuse initial-pool snapshot as enrichment hint for on-demand baseline fill.
                                        if (!token.poolAddress && (meta === null || meta === void 0 ? void 0 : meta.initialPoolAddress))
                                            token.poolAddress = meta.initialPoolAddress;
                                        if (!token.poolCreatedAt && (meta === null || meta === void 0 ? void 0 : meta.initialPoolCreatedAt))
                                            token.poolCreatedAt = meta.initialPoolCreatedAt;
                                        if (Number.isFinite(Number((meta === null || meta === void 0 ? void 0 : meta.initialLiquidityUsd) || 0)) && Number((meta === null || meta === void 0 ? void 0 : meta.initialLiquidityUsd) || 0) > 0) {
                                            token.initialLiquidityUsd = Number(meta === null || meta === void 0 ? void 0 : meta.initialLiquidityUsd);
                                        }
                                        if (meta === null || meta === void 0 ? void 0 : meta.source)
                                            token.initialPoolSource = meta.source;
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _a = _b.sent();
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 13:
                    _g.sent();
                    return [4 /*yield*/, Promise.all(tokens.map(function (token) { return __awaiter(_this, void 0, void 0, function () {
                            var raw, cachedLaunchpad, creator, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if (token.creatorAddress && token.creatorUrl)
                                            return [2 /*return*/];
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, (0, cacheClient_js_1.get)(launchpadCacheKey(chain, token.address))];
                                    case 2:
                                        raw = _b.sent();
                                        if (!raw)
                                            return [2 /*return*/];
                                        if (!token.launchpad) {
                                            cachedLaunchpad = pickLaunchpadFromLaunchpadCache(raw);
                                            if (cachedLaunchpad)
                                                token.launchpad = cachedLaunchpad;
                                        }
                                        creator = pickCreatorMetaFromLaunchpadCache(raw);
                                        if (creator.creatorAddress && !token.creatorAddress)
                                            token.creatorAddress = creator.creatorAddress;
                                        if (shouldReplaceCreatorUrl(token.creatorUrl, creator.creatorUrl))
                                            token.creatorUrl = creator.creatorUrl;
                                        if (shouldReplaceCreatorLabel(token.creatorLabel, creator.creatorLabel))
                                            token.creatorLabel = creator.creatorLabel;
                                        return [3 /*break*/, 4];
                                    case 3:
                                        _a = _b.sent();
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 14:
                    _g.sent();
                    _g.label = 15;
                case 15:
                    if (!((opts === null || opts === void 0 ? void 0 : opts.lightweight) || !ENABLE_TRENDING_REDIS_METADATA)) return [3 /*break*/, 17];
                    return [4 /*yield*/, loadLaunchpadDecisionCacheMap(chain, tokens)];
                case 16:
                    rawByAddress = _g.sent();
                    for (_e = 0, tokens_5 = tokens; _e < tokens_5.length; _e++) {
                        token = tokens_5[_e];
                        try {
                            raw = rawByAddress.get(String(token.address || '').toLowerCase());
                            if (!raw)
                                continue;
                            if (!token.launchpad) {
                                cachedLaunchpad = pickLaunchpadFromLaunchpadCache(raw);
                                if (cachedLaunchpad)
                                    token.launchpad = cachedLaunchpad;
                            }
                            creator = pickCreatorMetaFromLaunchpadCache(raw);
                            if (creator.creatorAddress && !token.creatorAddress)
                                token.creatorAddress = creator.creatorAddress;
                            if (shouldReplaceCreatorUrl(token.creatorUrl, creator.creatorUrl))
                                token.creatorUrl = creator.creatorUrl;
                            if (shouldReplaceCreatorLabel(token.creatorLabel, creator.creatorLabel))
                                token.creatorLabel = creator.creatorLabel;
                        }
                        catch (_h) {
                            // ignore launchpad cache parse/read errors
                        }
                    }
                    _g.label = 17;
                case 17:
                    listedTokens = tokens.filter(shouldKeepListedToken);
                    for (_f = 0, listedTokens_1 = listedTokens; _f < listedTokens_1.length; _f++) {
                        token = listedTokens_1[_f];
                        normalized = normalizeCreatorPresentation(token.creatorUrl, token.creatorLabel);
                        if (normalized.creatorUrl !== undefined)
                            token.creatorUrl = normalized.creatorUrl;
                        if (normalized.creatorLabel !== undefined)
                            token.creatorLabel = normalized.creatorLabel;
                    }
                    if (tokens.length > 0) {
                        memoryCache_js_1.memoryCache.set(cacheKey, listedTokens, memoryCache_js_1.CACHE_TTL.TRENDING_TOKENS);
                    }
                    return [2 /*return*/, listedTokens.slice(0, limit)];
                case 18:
                    error_3 = _g.sent();
                    if (isMissingLaunchpadColumnError(error_3)) {
                        trendingLaunchpadColumnCache = { checkedAt: Date.now(), exists: false };
                        return [2 /*return*/, getTrendingTokens(chain, limit)];
                    }
                    if (isMissingCreatorColumnError(error_3)) {
                        trendingCreatorColumnCache = { checkedAt: Date.now(), exists: false };
                        return [2 /*return*/, getTrendingTokens(chain, limit)];
                    }
                    console.error('Error getting trending tokens:', error_3);
                    return [2 /*return*/, []];
                case 19: return [2 /*return*/];
            }
        });
    });
}
function searchCachedTrendingTokens(query_1, chain_1) {
    return __awaiter(this, arguments, void 0, function (query, chain, limit, deps) {
        var sanitizedQuery, loadTrendingTokens, aliasToChain, normalizedChain, chains, trendingSets, scored;
        if (limit === void 0) { limit = 10; }
        if (deps === void 0) { deps = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sanitizedQuery = String(query || '').trim();
                    if (!sanitizedQuery)
                        return [2 /*return*/, []];
                    loadTrendingTokens = deps.getTrendingTokens || getTrendingTokens;
                    aliasToChain = {
                        ethereum: 'eth',
                        binance: 'bsc',
                    };
                    normalizedChain = chain
                        ? (aliasToChain[String(chain).trim().toLowerCase()] || String(chain).trim().toLowerCase())
                        : undefined;
                    chains = normalizedChain
                        ? [normalizedChain]
                        : __spreadArray([], SEARCHABLE_TRENDING_CHAINS, true);
                    return [4 /*yield*/, Promise.all(chains.map(function (item) { return loadTrendingTokens(item, 120).catch(function () { return []; }); }))];
                case 1:
                    trendingSets = _a.sent();
                    scored = trendingSets.flatMap(function (tokens, idx) {
                        var network = chains[idx];
                        return tokens
                            .map(function (token) {
                            var score = scoreTrendingTokenMatch(sanitizedQuery, token);
                            if (score < 0)
                                return null;
                            var rankBoost = Math.max(0, 200 - Number(token.rank || 999));
                            return {
                                token: __assign(__assign({}, token), { network: token.network || network }),
                                score: score + rankBoost,
                            };
                        })
                            .filter(function (item) { return Boolean(item); });
                    });
                    scored.sort(function (left, right) {
                        if (right.score !== left.score)
                            return right.score - left.score;
                        return Number(left.token.rank || 999999) - Number(right.token.rank || 999999);
                    });
                    return [2 /*return*/, dedupeTokenSearchResults(scored.map(function (item) { return item.token; })).slice(0, Math.max(1, limit))];
            }
        });
    });
}
function findCachedTrendingToken(query, chain, deps) {
    return __awaiter(this, void 0, void 0, function () {
        var results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, searchCachedTrendingTokens(query, chain, 1, deps)];
                case 1:
                    results = _a.sent();
                    return [2 /*return*/, results[0] || null];
            }
        });
    });
}
/**
 * Get last update time for trending tokens on a specific chain
 */
function getLastUpdateTime(chain) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma_js_1.default.trendingToken.aggregate({
                            where: { chain: chain },
                            _max: { updatedAt: true }
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result._max.updatedAt || null];
                case 2:
                    error_4 = _a.sent();
                    console.error('[TokenRepo] Error getting last update time:', error_4);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3;
