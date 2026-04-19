"use strict";
/**
 * Launchpad Detector Service (Backend)
 * Detects tokens from various launchpad platforms
 * Adapted from frontend launchpadDetector.ts
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
exports.getDopplerTokensBatch = getDopplerTokensBatch;
exports.detectLaunchpadToken = detectLaunchpadToken;
var zoraService_js_1 = require("../zoraService.js");
var web3_js_1 = require("@solana/web3.js");
var logger_js_1 = require("../../utils/logger.js");
var logRegistry_js_1 = require("../../config/logRegistry.js");
var solanaConfig_js_1 = require("../../config/solanaConfig.js");
var unifiedApiService_js_1 = require("../../config/unifiedApiService.js");
var rpcManager_js_1 = require("../rpcManager.js");
var cacheClient_js_1 = require("../../cache/cacheClient.js");
var ethers_1 = require("ethers");
var v4Hooks_js_1 = require("../dex/v4Hooks.js");
var LAUNCHPAD_AUTH_PDA = 'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh';
var METADATA_PROGRAM_ID = new web3_js_1.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
function checkLaunchpadAuth(mintAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var connection, mint, pda, info, updateAuth, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    connection = (0, rpcManager_js_1.getSolanaConnection)('cheap', 'normal');
                    mint = new web3_js_1.PublicKey(mintAddress);
                    pda = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()], METADATA_PROGRAM_ID)[0];
                    return [4 /*yield*/, connection.getAccountInfo(pda)];
                case 1:
                    info = _a.sent();
                    if (!info)
                        return [2 /*return*/, false];
                    updateAuth = new web3_js_1.PublicKey(info.data.subarray(1, 33));
                    return [2 /*return*/, updateAuth.toBase58() === LAUNCHPAD_AUTH_PDA];
                case 2:
                    e_1 = _a.sent();
                    // console.warn(`[LaunchpadDetector] Metadata check failed: ${e.message}`);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Simple In-Memory Cache
var DETECTION_CACHE = new Map();
var INFLIGHT_MAP = new Map();
var CACHE_TTL = 5 * 60 * 1000; // 5 minutes
var ZORA_PLATFORM_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
var CLANKER_SUFFIX = 'b07';
var FOURMEME_SUFFIXES = ['4444', 'ffff'];
var FLAP_SUFFIXES = ['8888', '7777'];
var FLAP_PORTAL_BSC_MAINNET = '0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0';
var FLAP_IPFS_GATEWAY = process.env.FLAP_IPFS_GATEWAY || 'https://flap.mypinata.cloud/ipfs/';
var FLAP_PORTAL_ABI = [
    'function getTokenV6(address token) view returns (tuple(uint8 status,uint256 reserve,uint256 circulatingSupply,uint256 price,uint8 tokenVersion,uint256 r,uint256 dexSupplyThresh,address quoteTokenAddress,bool nativeToQuoteSwapEnabled,bytes32 extensionID,uint256 h,uint256 k,uint256 taxRate,address pool,uint256 progress))',
    'function getTokenV5(address token) view returns (tuple(uint8 status,uint256 reserve,uint256 circulatingSupply,uint256 price,uint8 tokenVersion,uint256 r,uint256 dexSupplyThresh,address quoteTokenAddress,bool nativeToQuoteSwapEnabled,bytes32 extensionID,uint256 h,uint256 k))'
];
var FLAP_META_ABI = [
    'function metaURI() view returns (string)',
    'function meta() view returns (string)',
    'function tokenURI() view returns (string)',
    'function name() view returns (string)',
    'function symbol() view returns (string)'
];
var PUMPFUN_FRONTEND_BASES = (process.env.PUMPFUN_FRONTEND_BASES
    ? process.env.PUMPFUN_FRONTEND_BASES.split(',').map(function (v) { return v.trim(); }).filter(Boolean)
    : [
        'https://frontend-api-v3.pump.fun',
        'https://frontend-api-v2.pump.fun',
        'https://frontend-api.pump.fun',
    ]);
var FLAUNCH_API_BASE_URL = (process.env.FLAUNCH_API_BASE_URL || 'https://dev-api.flayerlabs.xyz').replace(/\/+$/, '');
var CREATORBID_API_BASE_URL = (process.env.CREATORBID_API_BASE_URL || 'https://creator.bid').replace(/\/+$/, '');
var DOPPLER_INDEXER_BASES = (process.env.DOPPLER_INDEXER_BASES
    ? process.env.DOPPLER_INDEXER_BASES.split(',').map(function (v) { return v.trim(); }).filter(Boolean)
    : [
        'https://indexer-prod.marble.live/graphql',
        'https://testnet-indexer.doppler.lol/graphql',
    ]);
var DOPPLER_INDEXER_API_KEY = process.env.DOPPLER_INDEXER_API_KEY || process.env.DOPPLER_API_KEY || '';
var DOPPLER_INDEXER_BEARER = process.env.DOPPLER_INDEXER_BEARER || process.env.DOPPLER_BEARER_TOKEN || '';
var UNISWAP_V4_POOL_MANAGER_BY_CHAIN = {
    8453: '0x000000000004444c5dc75cb358380d2e3de08a90',
    1: '0x000000000004444c5dc75cb358380d2e3de08a90'
};
var V4_INIT_EVENT = ethers_1.ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
var v4InitEventInterface = new ethers_1.ethers.Interface([
    'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)'
]);
var PROVIDER_BACKOFF_BASE_MS = Math.max(30000, Number(process.env.LAUNCHPAD_PROVIDER_BACKOFF_BASE_MS || '120000'));
var PROVIDER_BACKOFF_MAX_MS = Math.max(PROVIDER_BACKOFF_BASE_MS, Number(process.env.LAUNCHPAD_PROVIDER_BACKOFF_MAX_MS || '1800000'));
var providerBackoffState = new Map();
var LAUNCHPAD_DECISION_CACHE_PREFIX = 'launchpad:decision:v3';
var LAUNCHPAD_DECISION_STALE_TTL_SECONDS = Math.max(60, Number(process.env.LAUNCHPAD_DECISION_STALE_TTL_SECONDS || '300'));
var LAUNCHPAD_DECISION_CACHE_TTL_SECONDS = Math.max(LAUNCHPAD_DECISION_STALE_TTL_SECONDS, Number(process.env.LAUNCHPAD_DECISION_CACHE_TTL_SECONDS || '1200'));
var LAUNCHPAD_NEGATIVE_CACHE_PREFIX = 'launchpad:negative:v2';
var LAUNCHPAD_NEGATIVE_CACHE_TTL_SECONDS = Math.max(30, Number(process.env.LAUNCHPAD_NEGATIVE_CACHE_TTL_SECONDS || '120'));
var LAUNCHPAD_RETRY_CACHE_PREFIX = 'launchpad:retry:v2';
var LAUNCHPAD_RETRY_CACHE_TTL_SECONDS = Math.max(60, Number(process.env.LAUNCHPAD_RETRY_CACHE_TTL_SECONDS || '600'));
var LAUNCHPAD_RAW_CACHE_PREFIX = 'launchpad:raw:v2';
var LAUNCHPAD_RAW_CACHE_TTL_SECONDS = Math.max(10 * 60, Number(process.env.LAUNCHPAD_RAW_CACHE_TTL_SECONDS || "".concat(2 * 60 * 60)));
var LAUNCHPAD_DECISION_DETECTOR_VERSION = process.env.LAUNCHPAD_DETECTOR_VERSION || 'v3';
var LAUNCHPAD_REFRESH_LOCK_TTL_SECONDS = 15;
var LEGACY_LAUNCHPAD_CACHE_PREFIX = 'launchpad:detected:v2';
var ZORA_INDEX_TTL_MS = 10 * 60 * 1000;
var BASE_DOPPLER_DENYLIST = new Set([
    '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b',
    '0x9eadbe35f3ee3bf3e28180070c429298a1b02f93',
    '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
    '0xf8e76b87ca61d9ecdada87393ab4864c6b3de479',
    '0xef5997c2cf2f6c138196f8a6203afc335206b3c1',
    '0x93918567cdd1bc845be955325a43419a7c56d66f',
    ZORA_PLATFORM_TOKEN
]);
for (var _i = 0, _a = String(process.env.BASE_DOPPLER_DENYLIST || '')
    .split(',')
    .map(function (v) { return v.trim().toLowerCase(); })
    .filter(Boolean); _i < _a.length; _i++) {
    var raw = _a[_i];
    if (/^0x[0-9a-f]{40}$/.test(raw))
        BASE_DOPPLER_DENYLIST.add(raw);
}
var zoraAddressIndexCache = null;
var zoraAddressIndexInflight = null;
function buildDecisionCacheKey(address, chainId) {
    return "".concat(LAUNCHPAD_DECISION_CACHE_PREFIX, ":").concat(chainId || 'any', ":").concat(address.toLowerCase());
}
function buildLegacyDecisionCacheKey(address, chainId) {
    return "".concat(LEGACY_LAUNCHPAD_CACHE_PREFIX, ":").concat(chainId || 'any', ":").concat(address.toLowerCase());
}
function buildNegativeCacheKey(address, chainId) {
    return "".concat(LAUNCHPAD_NEGATIVE_CACHE_PREFIX, ":").concat(chainId || 'any', ":").concat(address.toLowerCase());
}
function buildRetryCacheKey(address, chainId) {
    return "".concat(LAUNCHPAD_RETRY_CACHE_PREFIX, ":").concat(chainId || 'any', ":").concat(address.toLowerCase());
}
function buildRawCacheKey(provider, address, chainId) {
    return "".concat(LAUNCHPAD_RAW_CACHE_PREFIX, ":").concat(provider, ":").concat(chainId || 'any', ":").concat(address.toLowerCase());
}
function buildRefreshLockKey(address, chainId) {
    return "launchpad:refresh:lock:v1:".concat(chainId || 'any', ":").concat(address.toLowerCase());
}
function isLaunchpadProvider(value) {
    return value === 'zora'
        || value === 'fourmeme'
        || value === 'flap'
        || value === 'pumpfun'
        || value === 'pumpswap'
        || value === 'bonkfun'
        || value === 'virtuals'
        || value === 'clanker'
        || value === 'paragraph'
        || value === 'doppler'
        || value === 'flaunch'
        || value === 'creatorbid';
}
function buildDopplerHeaders() {
    var headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (DOPPLER_INDEXER_API_KEY) {
        headers['x-api-key'] = DOPPLER_INDEXER_API_KEY;
    }
    if (DOPPLER_INDEXER_BEARER) {
        headers['Authorization'] = "Bearer ".concat(DOPPLER_INDEXER_BEARER);
    }
    return headers;
}
function hasCreatorInResult(result) {
    var _a, _b, _c;
    if (!result || !result.data || typeof result.data !== 'object')
        return false;
    var data = result.data;
    var candidates = [
        data.creatorAddress,
        data.creator,
        data.creator_address,
        data.userAddress,
        data.user_address,
        data.owner,
        data.ownerAddress,
        data.deployer,
        data.deployerAddress,
        (_a = data === null || data === void 0 ? void 0 : data.creatorProfile) === null || _a === void 0 ? void 0 : _a.address,
        (_b = data === null || data === void 0 ? void 0 : data.profile) === null || _b === void 0 ? void 0 : _b.address,
        (_c = data === null || data === void 0 ? void 0 : data.user) === null || _c === void 0 ? void 0 : _c.address,
    ];
    var evmLike = /0x[a-fA-F0-9]{40}/;
    var solLike = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var raw = candidates_1[_i];
        if (typeof raw !== 'string')
            continue;
        var v = raw.trim();
        if (evmLike.test(v) || solLike.test(v))
            return true;
    }
    return false;
}
function isValidDopplerDecision(address, chainId, data) {
    var _a;
    var lower = address.toLowerCase();
    var hasPool = !!normalizeEvmAddress((data === null || data === void 0 ? void 0 : data.poolAddress) || ((_a = data === null || data === void 0 ? void 0 : data.pool) === null || _a === void 0 ? void 0 : _a.address) || '');
    var isDerc20 = (data === null || data === void 0 ? void 0 : data.isDerc20) === true;
    var isCreatorCoin = (data === null || data === void 0 ? void 0 : data.isCreatorCoin) === true;
    var denylisted = chainId === 8453 && BASE_DOPPLER_DENYLIST.has(lower);
    var ok = !denylisted && (hasPool || isDerc20 || isCreatorCoin);
    return { ok: ok, flags: { hasPool: hasPool, isDerc20: isDerc20, isCreatorCoin: isCreatorCoin, denylisted: denylisted } };
}
function validateCachedDecision(address, chainId, decision) {
    if (decision.version !== 3)
        return { ok: false };
    if (!isLaunchpadProvider(decision.provider))
        return { ok: false };
    var resolvedChainId = Number(decision.chainId || chainId || 0);
    if (!Number.isFinite(resolvedChainId) || resolvedChainId <= 0)
        return { ok: false };
    if (chainId && resolvedChainId !== chainId)
        return { ok: false };
    if (decision.provider === 'doppler') {
        return isValidDopplerDecision(address, resolvedChainId, decision.data || {});
    }
    return { ok: true, validationFlags: decision.validationFlags };
}
function readPersistentLaunchpadDecision(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var key, raw, parsed, validation, now, expiresAt, resolvedChainId, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    key = buildDecisionCacheKey(address, chainId);
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(key)];
                case 1:
                    raw = _b.sent();
                    if (!raw)
                        return [2 /*return*/, null];
                    parsed = JSON.parse(raw);
                    validation = validateCachedDecision(address, chainId, parsed);
                    if (!!validation.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, cacheClient_js_1.del)(key).catch(function () { })];
                case 2:
                    _b.sent();
                    return [2 /*return*/, null];
                case 3:
                    now = Date.now();
                    expiresAt = Number(parsed.expiresAt || 0);
                    if (!(!Number.isFinite(expiresAt) || expiresAt <= now)) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, cacheClient_js_1.del)(key).catch(function () { })];
                case 4:
                    _b.sent();
                    return [2 /*return*/, null];
                case 5:
                    resolvedChainId = Number(parsed.chainId || chainId || 0);
                    return [2 /*return*/, {
                            result: {
                                provider: parsed.provider,
                                data: parsed.data || null,
                                chainId: resolvedChainId
                            },
                            stale: Number(parsed.staleAt || 0) <= now
                        }];
                case 6:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function writePersistentLaunchpadDecision(address, chainId, result) {
    return __awaiter(this, void 0, void 0, function () {
        var now, resolvedChainId, confidence, validationFlags, payload, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    now = Date.now();
                    resolvedChainId = Number(result.chainId || chainId || 0);
                    confidence = result.provider === 'doppler' ? 0.95 : 0.9;
                    validationFlags = result.provider === 'doppler'
                        ? isValidDopplerDecision(address, resolvedChainId, result.data || {}).flags
                        : undefined;
                    payload = {
                        version: 3,
                        provider: result.provider,
                        data: result.data || null,
                        chainId: resolvedChainId,
                        source: ((_b = result.data) === null || _b === void 0 ? void 0 : _b.source) || 'detector',
                        confidence: confidence,
                        detectorVersion: LAUNCHPAD_DECISION_DETECTOR_VERSION,
                        cachedAt: now,
                        staleAt: now + (LAUNCHPAD_DECISION_STALE_TTL_SECONDS * 1000),
                        expiresAt: now + (LAUNCHPAD_DECISION_CACHE_TTL_SECONDS * 1000),
                        validationFlags: validationFlags
                    };
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(buildDecisionCacheKey(address, chainId), JSON.stringify(payload), LAUNCHPAD_DECISION_CACHE_TTL_SECONDS)];
                case 2:
                    _c.sent();
                    // Best effort: scrub legacy decision key to avoid stale v2 resurrection by older fallback readers.
                    return [4 /*yield*/, (0, cacheClient_js_1.del)(buildLegacyDecisionCacheKey(address, chainId)).catch(function () { })];
                case 3:
                    // Best effort: scrub legacy decision key to avoid stale v2 resurrection by older fallback readers.
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _c.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function readNegativeLaunchpadCache(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, parsed, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(buildNegativeCacheKey(address, chainId))];
                case 1:
                    raw = _b.sent();
                    if (!raw)
                        return [2 /*return*/, false];
                    parsed = JSON.parse(raw);
                    return [2 /*return*/, !!(parsed === null || parsed === void 0 ? void 0 : parsed.none)];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function writeNegativeLaunchpadCache(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(buildNegativeCacheKey(address, chainId), JSON.stringify({ none: true, cachedAt: Date.now() }), LAUNCHPAD_NEGATIVE_CACHE_TTL_SECONDS)];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function readRetryLaunchpadCache(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, parsed, until, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(buildRetryCacheKey(address, chainId))];
                case 1:
                    raw = _b.sent();
                    if (!raw)
                        return [2 /*return*/, false];
                    parsed = JSON.parse(raw);
                    until = Number((parsed === null || parsed === void 0 ? void 0 : parsed.until) || 0);
                    return [2 /*return*/, Number.isFinite(until) && until > Date.now()];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function writeRetryLaunchpadCache(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var until, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    until = Date.now() + LAUNCHPAD_RETRY_CACHE_TTL_SECONDS * 1000;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(buildRetryCacheKey(address, chainId), JSON.stringify({ until: until, cachedAt: Date.now() }), LAUNCHPAD_RETRY_CACHE_TTL_SECONDS)];
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
function readRawLaunchpadCache(provider, address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var raw, parsed, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(buildRawCacheKey(provider, address, chainId))];
                case 1:
                    raw = _c.sent();
                    if (!raw)
                        return [2 /*return*/, null];
                    parsed = JSON.parse(raw);
                    return [2 /*return*/, ((_b = parsed === null || parsed === void 0 ? void 0 : parsed.data) !== null && _b !== void 0 ? _b : null)];
                case 2:
                    _a = _c.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function writeRawLaunchpadCache(provider, address, chainId, data) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(buildRawCacheKey(provider, address, chainId), JSON.stringify({ data: data, cachedAt: Date.now() }), LAUNCHPAD_RAW_CACHE_TTL_SECONDS)];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function isRateLimitedError(error) {
    var msg = String((error === null || error === void 0 ? void 0 : error.message) || error || '').toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests');
}
function isProviderBackoffActive(provider) {
    var state = providerBackoffState.get(provider);
    return !!state && Date.now() < state.until;
}
function markProviderRateLimited(provider) {
    var prev = providerBackoffState.get(provider) || { until: 0, strikes: 0 };
    var strikes = Math.min(prev.strikes + 1, 8);
    var duration = Math.min(PROVIDER_BACKOFF_BASE_MS * Math.pow(2, strikes - 1), PROVIDER_BACKOFF_MAX_MS);
    providerBackoffState.set(provider, { until: Date.now() + duration, strikes: strikes });
}
function markProviderHealthy(provider) {
    if (providerBackoffState.has(provider)) {
        providerBackoffState.delete(provider);
    }
}
function hasAnyRelevantBackoff(address, chainId) {
    var isSolana = address.length > 40 && !address.startsWith('0x');
    var isEVM = address.startsWith('0x') && address.length === 42;
    if (isSolana) {
        return isProviderBackoffActive('pumpfun') || isProviderBackoffActive('bonkfun');
    }
    if (!isEVM)
        return false;
    var basePlatforms = (chainId === 8453 || !chainId);
    var clankerPlatforms = (chainId === 8453 || chainId === 1 || !chainId);
    var bscPlatforms = (chainId === 56 || !chainId);
    if (basePlatforms) {
        if (isProviderBackoffActive('zora')
            || isProviderBackoffActive('virtuals')
            || isProviderBackoffActive('paragraph')
            || isProviderBackoffActive('doppler')
            || isProviderBackoffActive('flaunch')
            || isProviderBackoffActive('creatorbid')
            || isProviderBackoffActive('flap')) {
            return true;
        }
    }
    if (clankerPlatforms && isProviderBackoffActive('clanker')) {
        return true;
    }
    if (bscPlatforms && (isProviderBackoffActive('fourmeme') || isProviderBackoffActive('creatorbid'))) {
        return true;
    }
    return false;
}
var paragraphClient = null;
var paragraphClientInited = false;
function getParagraphToken(address) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, sdk, ParagraphAPI, coin, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    if (isProviderBackoffActive('paragraph'))
                        return [2 /*return*/, null];
                    if (!!paragraphClientInited) return [3 /*break*/, 2];
                    paragraphClientInited = true;
                    apiKey = process.env.PARAGRAPH_API_KEY;
                    if (!apiKey) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@paragraph_xyz/sdk'); })];
                case 1:
                    sdk = _b.sent();
                    ParagraphAPI = sdk.ParagraphAPI;
                    if (ParagraphAPI) {
                        paragraphClient = new ParagraphAPI(apiKey);
                    }
                    _b.label = 2;
                case 2:
                    if (!paragraphClient || typeof paragraphClient.getCoinByContract !== 'function') {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, paragraphClient.getCoinByContract(address)];
                case 3:
                    coin = _b.sent();
                    markProviderHealthy('paragraph');
                    return [2 /*return*/, coin || null];
                case 4:
                    error_1 = _b.sent();
                    if (isRateLimitedError(error_1)) {
                        markProviderRateLimited('paragraph');
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'LaunchpadDetector: Paragraph detection failed', {
                        address: address,
                        error: (_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _a === void 0 ? void 0 : _a.slice(0, 120)
                    });
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function getFlaunchToken(address_1) {
    return __awaiter(this, arguments, void 0, function (address, includeDetails) {
        var lower, cachedPayload, tokenAddress_1, token, tokenAddress, details, _a, creatorAddress, payload, error_2;
        var _b, _c;
        if (includeDetails === void 0) { includeDetails = true; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 8, , 9]);
                    if (isProviderBackoffActive('flaunch'))
                        return [2 /*return*/, null];
                    lower = address.toLowerCase();
                    return [4 /*yield*/, readRawLaunchpadCache('flaunch', lower, 8453)];
                case 1:
                    cachedPayload = _d.sent();
                    if (cachedPayload) {
                        tokenAddress_1 = normalizeEvmAddress((cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.tokenAddress)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.address)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.contract_address)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.contractAddress));
                        if (tokenAddress_1 === lower) {
                            markProviderHealthy('flaunch');
                            return [2 /*return*/, __assign(__assign({}, cachedPayload), { source: 'flaunch_api_cache', imageUrl: (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.image) || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.imageUrl) || undefined, creatorAddress: normalizeEvmAddress((cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.ownerAddress)
                                        || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.owner)
                                        || ((_b = cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.status) === null || _b === void 0 ? void 0 : _b.owner)
                                        || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.creatorAddress)
                                        || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.creator)) || undefined })];
                        }
                    }
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: "".concat(FLAUNCH_API_BASE_URL, "/v1/base/tokens/").concat(encodeURIComponent(address)),
                            timeout: 2800,
                            suppressError: true,
                        })];
                case 2:
                    token = _d.sent();
                    tokenAddress = normalizeEvmAddress((token === null || token === void 0 ? void 0 : token.tokenAddress)
                        || (token === null || token === void 0 ? void 0 : token.address)
                        || (token === null || token === void 0 ? void 0 : token.contract_address)
                        || (token === null || token === void 0 ? void 0 : token.contractAddress));
                    if (!tokenAddress || tokenAddress !== lower) {
                        markProviderHealthy('flaunch');
                        return [2 /*return*/, null];
                    }
                    details = null;
                    if (!includeDetails) return [3 /*break*/, 6];
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: "".concat(FLAUNCH_API_BASE_URL, "/v1/base/tokens/").concat(encodeURIComponent(address), "/details"),
                            timeout: 2800,
                            suppressError: true,
                        })];
                case 4:
                    details = _d.sent();
                    return [3 /*break*/, 6];
                case 5:
                    _a = _d.sent();
                    return [3 /*break*/, 6];
                case 6:
                    creatorAddress = normalizeEvmAddress(((_c = details === null || details === void 0 ? void 0 : details.status) === null || _c === void 0 ? void 0 : _c.owner)
                        || (token === null || token === void 0 ? void 0 : token.ownerAddress)
                        || (token === null || token === void 0 ? void 0 : token.owner)
                        || (token === null || token === void 0 ? void 0 : token.creatorAddress)) || undefined;
                    payload = __assign(__assign({}, token), { details: details || undefined, source: 'flaunch_api', imageUrl: (token === null || token === void 0 ? void 0 : token.image) || (token === null || token === void 0 ? void 0 : token.imageUrl) || undefined, creatorAddress: creatorAddress });
                    return [4 /*yield*/, writeRawLaunchpadCache('flaunch', lower, 8453, payload)];
                case 7:
                    _d.sent();
                    markProviderHealthy('flaunch');
                    return [2 /*return*/, payload];
                case 8:
                    error_2 = _d.sent();
                    if (isRateLimitedError(error_2)) {
                        markProviderRateLimited('flaunch');
                    }
                    return [2 /*return*/, null];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function normalizeCreatorBidChainId(value) {
    var parsed = Number(value);
    if (parsed === 8453 || parsed === 56)
        return parsed;
    return null;
}
function getCreatorBidToken(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var lower, requestedChainId, cacheChainId, cachedPayload, _a, _b, tokenAddress, payloadChainId, payload, detectedChainId, twitterUsername, creatorUrl, creatorLabel, normalized, error_3;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 8, , 9]);
                    if (isProviderBackoffActive('creatorbid'))
                        return [2 /*return*/, null];
                    lower = address.toLowerCase();
                    requestedChainId = normalizeCreatorBidChainId(chainId);
                    cacheChainId = requestedChainId || 8453;
                    return [4 /*yield*/, readRawLaunchpadCache('creatorbid', lower, cacheChainId)];
                case 1:
                    _a = (_d.sent());
                    if (_a) return [3 /*break*/, 5];
                    if (!!requestedChainId) return [3 /*break*/, 3];
                    return [4 /*yield*/, readRawLaunchpadCache('creatorbid', lower, 56)];
                case 2:
                    _b = _d.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _b = null;
                    _d.label = 4;
                case 4:
                    _a = (_b);
                    _d.label = 5;
                case 5:
                    cachedPayload = _a;
                    if (cachedPayload) {
                        tokenAddress = normalizeEvmAddress((cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.agentKeyAddress)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.address)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.tokenAddress));
                        payloadChainId = normalizeCreatorBidChainId(cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.chainId);
                        if (tokenAddress === lower
                            && payloadChainId
                            && (!requestedChainId || payloadChainId === requestedChainId)) {
                            markProviderHealthy('creatorbid');
                            return [2 /*return*/, __assign(__assign({}, cachedPayload), { chainId: payloadChainId, source: 'creatorbid_api_cache', agentKeyAddress: lower })];
                        }
                    }
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: "".concat(CREATORBID_API_BASE_URL, "/api/agents/metadata?agentKeyAddress=").concat(encodeURIComponent(address)),
                            timeout: 2800,
                            suppressError: true,
                        })];
                case 6:
                    payload = _d.sent();
                    if (!payload || payload.error) {
                        markProviderHealthy('creatorbid');
                        return [2 /*return*/, null];
                    }
                    detectedChainId = normalizeCreatorBidChainId(payload === null || payload === void 0 ? void 0 : payload.chainId);
                    if (!detectedChainId) {
                        markProviderHealthy('creatorbid');
                        return [2 /*return*/, null];
                    }
                    if (requestedChainId && requestedChainId !== detectedChainId) {
                        markProviderHealthy('creatorbid');
                        return [2 /*return*/, null];
                    }
                    twitterUsername = typeof ((_c = payload === null || payload === void 0 ? void 0 : payload.twitter) === null || _c === void 0 ? void 0 : _c.username) === 'string'
                        ? payload.twitter.username.trim().replace(/^@/, '')
                        : '';
                    creatorUrl = twitterUsername
                        ? "https://x.com/".concat(twitterUsername)
                        : (typeof (payload === null || payload === void 0 ? void 0 : payload.website) === 'string' && payload.website.trim().startsWith('http')
                            ? payload.website.trim()
                            : undefined);
                    creatorLabel = twitterUsername ? "@".concat(twitterUsername) : undefined;
                    normalized = __assign(__assign({}, payload), { chainId: detectedChainId, agentKeyAddress: lower, creatorUrl: creatorUrl, creatorLabel: creatorLabel, imageUrl: (payload === null || payload === void 0 ? void 0 : payload.profilePicture) || (payload === null || payload === void 0 ? void 0 : payload.image) || (payload === null || payload === void 0 ? void 0 : payload.imageUrl) || undefined, source: 'creatorbid_api' });
                    return [4 /*yield*/, writeRawLaunchpadCache('creatorbid', lower, detectedChainId, normalized)];
                case 7:
                    _d.sent();
                    markProviderHealthy('creatorbid');
                    return [2 /*return*/, normalized];
                case 8:
                    error_3 = _d.sent();
                    if (isRateLimitedError(error_3)) {
                        markProviderRateLimited('creatorbid');
                    }
                    return [2 /*return*/, null];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Detect Four.meme token (BSC)
 */
function getFourMemeToken(address) {
    return __awaiter(this, void 0, void 0, function () {
        var url, data, creatorAddress, twitterUrlRaw, twitterUrl, creatorLabel, user, error_4;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    if (isProviderBackoffActive('fourmeme'))
                        return [2 /*return*/, null];
                    url = "https://four.meme/meme-api/v1/private/token/get?address=".concat(encodeURIComponent(address));
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            timeout: 10000,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        })];
                case 1:
                    data = _e.sent();
                    if (data.code === 0 && data.data) {
                        markProviderHealthy('fourmeme');
                        creatorAddress = normalizeEvmAddress(data.data.userAddress
                            || data.data.accountAddress
                            || data.data.ownerAddress
                            || data.data.owner
                            || data.data.creatorAddress
                            || data.data.creator
                            || data.data.deployer) || undefined;
                        twitterUrlRaw = [
                            data.data.twitterUrl,
                            data.data.twitter,
                            data.data.xUrl,
                            data.data.x,
                            (_a = data.data.social_context) === null || _a === void 0 ? void 0 : _a.messageId,
                            (_b = data.data.social_context) === null || _b === void 0 ? void 0 : _b.message_id,
                            (_c = data.data.social_context) === null || _c === void 0 ? void 0 : _c.twitter,
                            (_d = data.data.social_context) === null || _d === void 0 ? void 0 : _d.x,
                        ].find(function (v) { return typeof v === 'string' && !!String(v).trim(); });
                        twitterUrl = typeof twitterUrlRaw === 'string' ? twitterUrlRaw.trim() : undefined;
                        creatorLabel = void 0;
                        if (twitterUrl) {
                            user = extractXUsernameFromUrl(twitterUrl);
                            if (user)
                                creatorLabel = "@".concat(user);
                        }
                        if (!creatorLabel) {
                            // If a social URL exists but no resolvable handle (e.g. x.com/i/status/...),
                            // keep creator display as platform label, not raw address.
                            creatorLabel = twitterUrl ? 'X post' : (creatorAddress || undefined);
                        }
                        return [2 /*return*/, __assign(__assign({}, data.data), { creatorAddress: creatorAddress, 
                                // four.meme creator rule: twitter first, fallback to creator wallet
                                creatorUrl: twitterUrl || undefined, creatorLabel: creatorLabel, createdAt: data.data.createDate ? parseInt(data.data.createDate) : undefined })];
                    }
                    markProviderHealthy('fourmeme');
                    return [2 /*return*/, null];
                case 2:
                    error_4 = _e.sent();
                    if (isRateLimitedError(error_4)) {
                        markProviderRateLimited('fourmeme');
                    }
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Four.meme fetch failed', { address: address, error: error_4.message, cause: error_4.cause });
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function normalizeEvmAddress(value) {
    if (typeof value !== 'string')
        return null;
    var addr = value.trim().toLowerCase();
    return /^0x[0-9a-f]{40}$/.test(addr) ? addr : null;
}
function extractXUsernameFromUrl(raw) {
    if (!raw)
        return null;
    try {
        var u = new URL(raw.trim());
        var host = u.hostname.replace(/^www\./, '').toLowerCase();
        if (!host.includes('x.com') && !host.includes('twitter.com'))
            return null;
        var parts = u.pathname.split('/').filter(Boolean);
        var user = (parts[0] || '').trim().replace(/^@/, '');
        if (!user)
            return null;
        var reserved = new Set([
            'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
            'notifications', 'settings', 'tos', 'privacy', 'status'
        ]);
        if (reserved.has(user.toLowerCase()))
            return null;
        return user;
    }
    catch (_a) {
        return null;
    }
}
function getZoraAddressIndex() {
    return __awaiter(this, void 0, void 0, function () {
        var now;
        var _this = this;
        return __generator(this, function (_a) {
            now = Date.now();
            if (zoraAddressIndexCache && zoraAddressIndexCache.expiry > now) {
                return [2 /*return*/, zoraAddressIndexCache.set];
            }
            if (zoraAddressIndexInflight)
                return [2 /*return*/, zoraAddressIndexInflight];
            zoraAddressIndexInflight = (function () { return __awaiter(_this, void 0, void 0, function () {
                var discovered, _a, topVolume, topGainers, combinedNew, _i, _b, row, addr, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            discovered = new Set();
                            _d.label = 1;
                        case 1:
                            _d.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, Promise.all([
                                    zoraService_js_1.zoraService.getTopVolume24h(120).catch(function () { return []; }),
                                    zoraService_js_1.zoraService.getTopGainers(120).catch(function () { return []; }),
                                    zoraService_js_1.zoraService.getCombinedNewCoins(120).catch(function () { return []; })
                                ])];
                        case 2:
                            _a = _d.sent(), topVolume = _a[0], topGainers = _a[1], combinedNew = _a[2];
                            for (_i = 0, _b = __spreadArray(__spreadArray(__spreadArray([], topVolume, true), topGainers, true), combinedNew, true); _i < _b.length; _i++) {
                                row = _b[_i];
                                addr = normalizeEvmAddress(row === null || row === void 0 ? void 0 : row.address);
                                if (addr)
                                    discovered.add(addr);
                            }
                            markProviderHealthy('zora');
                            return [3 /*break*/, 4];
                        case 3:
                            _c = _d.sent();
                            return [3 /*break*/, 4];
                        case 4:
                            zoraAddressIndexCache = { set: discovered, expiry: Date.now() + ZORA_INDEX_TTL_MS };
                            zoraAddressIndexInflight = null;
                            return [2 /*return*/, discovered];
                    }
                });
            }); })();
            return [2 /*return*/, zoraAddressIndexInflight];
        });
    });
}
function resolveClankerChainId(payload, fallbackChainId) {
    var parsed = Number((payload === null || payload === void 0 ? void 0 : payload.chain_id) || (payload === null || payload === void 0 ? void 0 : payload.chainId) || fallbackChainId || 8453);
    if (parsed === 1 || parsed === 8453)
        return parsed;
    return fallbackChainId === 1 ? 1 : 8453;
}
function getClankerToken(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var lower, cacheChainId, cachedPayload, tokenAddress_2, requestorFid, socialContext, socialCandidates, xUrl, creatorUrl, creatorLabel, user, socialId, apiKey, url, data, payload, tokenAddress, resolvedChainId, requestorFid, socialContext, socialCandidates, xUrl, creatorUrl, creatorLabel, user, socialId, error_5;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 5, , 6]);
                    if (isProviderBackoffActive('clanker'))
                        return [2 /*return*/, null];
                    lower = address.toLowerCase();
                    cacheChainId = chainId === 1 ? 1 : 8453;
                    return [4 /*yield*/, readRawLaunchpadCache('clanker', lower, cacheChainId)];
                case 1:
                    cachedPayload = _e.sent();
                    if (cachedPayload) {
                        tokenAddress_2 = normalizeEvmAddress((cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.contract_address)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.token_address)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.tokenAddress)
                            || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.address)
                            || ((_a = cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.clanker) === null || _a === void 0 ? void 0 : _a.tokenAddress)
                            || ((_b = cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.clanker) === null || _b === void 0 ? void 0 : _b.address));
                        if (tokenAddress_2 === lower) {
                            requestorFid = Number((cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.requestor_fid) || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.requestorFid) || 0);
                            socialContext = (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.social_context) || {};
                            socialCandidates = [
                                socialContext === null || socialContext === void 0 ? void 0 : socialContext.messageId,
                                socialContext === null || socialContext === void 0 ? void 0 : socialContext.message_id,
                                socialContext === null || socialContext === void 0 ? void 0 : socialContext.twitter,
                                socialContext === null || socialContext === void 0 ? void 0 : socialContext.x,
                                socialContext === null || socialContext === void 0 ? void 0 : socialContext.url,
                                socialContext === null || socialContext === void 0 ? void 0 : socialContext.link,
                                socialContext === null || socialContext === void 0 ? void 0 : socialContext.profile,
                                cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.twitter,
                                cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.twitterUrl,
                                cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.x,
                                cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.xUrl,
                            ].filter(function (v) { return typeof v === 'string' && !!v.trim(); });
                            xUrl = socialCandidates.find(function (raw) {
                                try {
                                    var u = new URL(raw.trim());
                                    return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
                                }
                                catch (_a) {
                                    return false;
                                }
                            });
                            creatorUrl = xUrl || (requestorFid > 0 ? "https://warpcast.com/~/profiles/".concat(requestorFid) : undefined);
                            creatorLabel = void 0;
                            if (xUrl) {
                                user = extractXUsernameFromUrl(xUrl);
                                if (user)
                                    creatorLabel = "@".concat(user);
                            }
                            if (!creatorLabel) {
                                socialId = typeof (socialContext === null || socialContext === void 0 ? void 0 : socialContext.id) === 'string' ? socialContext.id.trim() : '';
                                if (socialId)
                                    creatorLabel = /^\d+$/.test(socialId) ? 'Farcaster' : "@".concat(socialId.replace(/^@/, ''));
                            }
                            markProviderHealthy('clanker');
                            return [2 /*return*/, __assign(__assign({}, cachedPayload), { source: 'clanker_api_cache', chain_id: resolveClankerChainId(cachedPayload, cacheChainId), creatorAddress: (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.msg_sender) || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.creator) || undefined, creatorUrl: creatorUrl, creatorLabel: creatorLabel, imageUrl: (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.img_url) || (cachedPayload === null || cachedPayload === void 0 ? void 0 : cachedPayload.image) || undefined })];
                        }
                    }
                    apiKey = process.env.CLANKER_API_KEY;
                    if (!apiKey)
                        return [2 /*return*/, null];
                    url = "https://www.clanker.world/api/get-clanker-by-address?address=".concat(encodeURIComponent(address));
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            timeout: 8000,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'x-api-key': apiKey
                            }
                        })];
                case 2:
                    data = _e.sent();
                    if (!data || data.error)
                        return [2 /*return*/, null];
                    payload = (data && typeof data === 'object' && data.data && typeof data.data === 'object')
                        ? data.data
                        : data;
                    tokenAddress = normalizeEvmAddress((payload === null || payload === void 0 ? void 0 : payload.contract_address)
                        || (payload === null || payload === void 0 ? void 0 : payload.token_address)
                        || (payload === null || payload === void 0 ? void 0 : payload.tokenAddress)
                        || (payload === null || payload === void 0 ? void 0 : payload.address)
                        || ((_c = payload === null || payload === void 0 ? void 0 : payload.clanker) === null || _c === void 0 ? void 0 : _c.tokenAddress)
                        || ((_d = payload === null || payload === void 0 ? void 0 : payload.clanker) === null || _d === void 0 ? void 0 : _d.address));
                    if (!(tokenAddress && tokenAddress === address.toLowerCase())) return [3 /*break*/, 4];
                    resolvedChainId = resolveClankerChainId(payload, cacheChainId);
                    return [4 /*yield*/, writeRawLaunchpadCache('clanker', lower, resolvedChainId, payload)];
                case 3:
                    _e.sent();
                    markProviderHealthy('clanker');
                    requestorFid = Number((payload === null || payload === void 0 ? void 0 : payload.requestor_fid) || (payload === null || payload === void 0 ? void 0 : payload.requestorFid) || 0);
                    socialContext = (payload === null || payload === void 0 ? void 0 : payload.social_context) || {};
                    socialCandidates = [
                        socialContext === null || socialContext === void 0 ? void 0 : socialContext.messageId,
                        socialContext === null || socialContext === void 0 ? void 0 : socialContext.message_id,
                        socialContext === null || socialContext === void 0 ? void 0 : socialContext.twitter,
                        socialContext === null || socialContext === void 0 ? void 0 : socialContext.x,
                        socialContext === null || socialContext === void 0 ? void 0 : socialContext.url,
                        socialContext === null || socialContext === void 0 ? void 0 : socialContext.link,
                        socialContext === null || socialContext === void 0 ? void 0 : socialContext.profile,
                        payload === null || payload === void 0 ? void 0 : payload.twitter,
                        payload === null || payload === void 0 ? void 0 : payload.twitterUrl,
                        payload === null || payload === void 0 ? void 0 : payload.x,
                        payload === null || payload === void 0 ? void 0 : payload.xUrl,
                    ].filter(function (v) { return typeof v === 'string' && !!v.trim(); });
                    xUrl = socialCandidates.find(function (raw) {
                        try {
                            var u = new URL(raw.trim());
                            return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
                        }
                        catch (_a) {
                            return false;
                        }
                    });
                    creatorUrl = xUrl || (requestorFid > 0 ? "https://warpcast.com/~/profiles/".concat(requestorFid) : undefined);
                    creatorLabel = void 0;
                    if (xUrl) {
                        user = extractXUsernameFromUrl(xUrl);
                        if (user)
                            creatorLabel = "@".concat(user);
                    }
                    if (!creatorLabel) {
                        socialId = typeof (socialContext === null || socialContext === void 0 ? void 0 : socialContext.id) === 'string' ? socialContext.id.trim() : '';
                        if (socialId) {
                            creatorLabel = /^\d+$/.test(socialId) ? 'Farcaster' : "@".concat(socialId.replace(/^@/, ''));
                        }
                    }
                    return [2 /*return*/, __assign(__assign({}, payload), { source: 'clanker_api', chain_id: resolvedChainId, creatorAddress: (payload === null || payload === void 0 ? void 0 : payload.msg_sender) || (payload === null || payload === void 0 ? void 0 : payload.creator) || undefined, creatorUrl: creatorUrl, creatorLabel: creatorLabel, imageUrl: (payload === null || payload === void 0 ? void 0 : payload.img_url) || (payload === null || payload === void 0 ? void 0 : payload.image) || undefined })];
                case 4:
                    markProviderHealthy('clanker');
                    return [2 /*return*/, null];
                case 5:
                    error_5 = _e.sent();
                    if (isRateLimitedError(error_5)) {
                        markProviderRateLimited('clanker');
                    }
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getVirtualsToken(address_1) {
    return __awaiter(this, arguments, void 0, function (address, _mode) {
        var lower_1, baseUrl_1, queryByField, settled, rowsA, rowsB, errors, rows, hit, error_6;
        var _this = this;
        var _a;
        if (_mode === void 0) { _mode = 'full'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    if (isProviderBackoffActive('virtuals'))
                        return [2 /*return*/, null];
                    lower_1 = address.toLowerCase();
                    baseUrl_1 = 'https://api2.virtuals.io/api/virtuals';
                    queryByField = function (field) { return __awaiter(_this, void 0, void 0, function () {
                        var url, data;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    url = new URL(baseUrl_1);
                                    url.searchParams.append("filters[".concat(field, "][]"), address);
                                    url.searchParams.append('page', '1');
                                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                                            url: url.toString(),
                                            // Keep provider timeout below global detector timeout to avoid guaranteed null on race.
                                            timeout: 2200,
                                            headers: {
                                                'Accept': 'application/json',
                                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                            }
                                        })];
                                case 1:
                                    data = _a.sent();
                                    return [2 /*return*/, Array.isArray(data === null || data === void 0 ? void 0 : data.data) ? data.data : []];
                            }
                        });
                    }); };
                    return [4 /*yield*/, Promise.allSettled([
                            queryByField('tokenAddress'),
                            queryByField('migrateTokenAddress'),
                        ])];
                case 1:
                    settled = _b.sent();
                    rowsA = settled[0].status === 'fulfilled' ? settled[0].value : [];
                    rowsB = settled[1].status === 'fulfilled' ? settled[1].value : [];
                    errors = settled
                        .filter(function (r) { return r.status === 'rejected'; })
                        .map(function (r) { return r.reason; });
                    if (errors.length === settled.length) {
                        throw errors[0];
                    }
                    if (errors.some(function (e) { return isRateLimitedError(e); })) {
                        markProviderRateLimited('virtuals');
                    }
                    else {
                        markProviderHealthy('virtuals');
                    }
                    rows = __spreadArray(__spreadArray([], rowsA, true), rowsB, true);
                    hit = rows.find(function (row) {
                        var tokenAddress = normalizeEvmAddress(row === null || row === void 0 ? void 0 : row.tokenAddress);
                        var migrateTokenAddress = normalizeEvmAddress(row === null || row === void 0 ? void 0 : row.migrateTokenAddress);
                        var chain = String((row === null || row === void 0 ? void 0 : row.chain) || '').toLowerCase();
                        var onBase = chain === 'base' || chain === '8453';
                        return onBase && (tokenAddress === lower_1 || migrateTokenAddress === lower_1);
                    });
                    if (!hit)
                        return [2 /*return*/, null];
                    markProviderHealthy('virtuals');
                    return [2 /*return*/, {
                            address: hit.tokenAddress || hit.migrateTokenAddress || address,
                            symbol: hit.symbol || 'UNKNOWN',
                            name: hit.name || 'Unknown',
                            lpAddress: hit.lpAddress || undefined,
                            virtualId: hit.id,
                            walletAddress: hit.walletAddress || undefined,
                            sentientWalletAddress: hit.sentientWalletAddress || undefined,
                            socials: hit.socials || undefined,
                            source: 'virtuals_api'
                        }];
                case 2:
                    error_6 = _b.sent();
                    if (isRateLimitedError(error_6)) {
                        markProviderRateLimited('virtuals');
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'LaunchpadDetector: Virtuals detection failed', {
                        address: address,
                        error: (_a = error_6 === null || error_6 === void 0 ? void 0 : error_6.message) === null || _a === void 0 ? void 0 : _a.slice(0, 120)
                    });
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getDopplerToken(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var lower, cid, headers, query, isUsableDopplerHit, cachedHit, _i, DOPPLER_INDEXER_BASES_1, base, url, data, hit, normalizedAddress, e_2, msg, error_7;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 10, , 11]);
                    if (isProviderBackoffActive('doppler'))
                        return [2 /*return*/, null];
                    lower = address.toLowerCase();
                    cid = Number(chainId || 8453);
                    if (cid === 8453 && BASE_DOPPLER_DENYLIST.has(lower))
                        return [2 /*return*/, null];
                    headers = buildDopplerHeaders();
                    query = "query DopplerToken($address: String!, $chainId: Float!) {\n  token(address: $address, chainId: $chainId) {\n    address\n    chainId\n    name\n    symbol\n    image\n    creatorAddress\n    isDerc20\n    isCreatorCoin\n    firstSeenAt\n    pool {\n      address\n      fee\n      volumeUsd\n    }\n  }\n}";
                    isUsableDopplerHit = function (hit) {
                        var _a;
                        if (!hit || typeof hit !== 'object')
                            return false;
                        var hasPool = !!normalizeEvmAddress(((_a = hit === null || hit === void 0 ? void 0 : hit.pool) === null || _a === void 0 ? void 0 : _a.address) || '');
                        var isDerc20 = (hit === null || hit === void 0 ? void 0 : hit.isDerc20) === true;
                        var isCreatorCoin = (hit === null || hit === void 0 ? void 0 : hit.isCreatorCoin) === true;
                        // Strict Doppler signal only: explicit launchpad flags/pool presence.
                        // Do not trust generic creatorAddress because indexer can return broad token matches.
                        return hasPool || isDerc20 || isCreatorCoin;
                    };
                    return [4 /*yield*/, readRawLaunchpadCache('doppler', lower, cid)];
                case 1:
                    cachedHit = _e.sent();
                    if (cachedHit && normalizeEvmAddress(cachedHit === null || cachedHit === void 0 ? void 0 : cachedHit.address) === lower && isUsableDopplerHit(cachedHit)) {
                        markProviderHealthy('doppler');
                        return [2 /*return*/, __assign(__assign({}, cachedHit), { source: 'doppler_graphql_token_cache', creatorAddress: (cachedHit === null || cachedHit === void 0 ? void 0 : cachedHit.creatorAddress) || undefined, creatorUrl: undefined, creatorLabel: undefined, imageUrl: (cachedHit === null || cachedHit === void 0 ? void 0 : cachedHit.image) || undefined, poolAddress: ((_a = cachedHit === null || cachedHit === void 0 ? void 0 : cachedHit.pool) === null || _a === void 0 ? void 0 : _a.address) || undefined })];
                    }
                    _i = 0, DOPPLER_INDEXER_BASES_1 = DOPPLER_INDEXER_BASES;
                    _e.label = 2;
                case 2:
                    if (!(_i < DOPPLER_INDEXER_BASES_1.length)) return [3 /*break*/, 9];
                    base = DOPPLER_INDEXER_BASES_1[_i];
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 7, , 8]);
                    url = String(base || '').replace(/\/+$/, '').endsWith('/graphql')
                        ? String(base || '').replace(/\/+$/, '')
                        : "".concat(String(base || '').replace(/\/+$/, ''), "/graphql");
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            method: 'POST',
                            timeout: 5000,
                            headers: headers,
                            body: JSON.stringify({
                                query: query,
                                variables: {
                                    address: address,
                                    chainId: cid
                                }
                            })
                        })];
                case 4:
                    data = _e.sent();
                    hit = ((_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b.token) || null;
                    normalizedAddress = normalizeEvmAddress(hit === null || hit === void 0 ? void 0 : hit.address);
                    if (!(hit && normalizedAddress === lower && isUsableDopplerHit(hit))) return [3 /*break*/, 6];
                    return [4 /*yield*/, writeRawLaunchpadCache('doppler', lower, cid, hit)];
                case 5:
                    _e.sent();
                    markProviderHealthy('doppler');
                    return [2 /*return*/, __assign(__assign({}, hit), { source: 'doppler_graphql_token', creatorAddress: (hit === null || hit === void 0 ? void 0 : hit.creatorAddress) || undefined, creatorUrl: undefined, creatorLabel: undefined, imageUrl: (hit === null || hit === void 0 ? void 0 : hit.image) || undefined, poolAddress: ((_c = hit === null || hit === void 0 ? void 0 : hit.pool) === null || _c === void 0 ? void 0 : _c.address) || undefined })];
                case 6:
                    markProviderHealthy('doppler');
                    return [3 /*break*/, 8];
                case 7:
                    e_2 = _e.sent();
                    msg = String((e_2 === null || e_2 === void 0 ? void 0 : e_2.message) || '').toLowerCase();
                    if (isRateLimitedError(e_2) || msg.includes('fetch failed') || msg.includes('enotfound')) {
                        markProviderRateLimited('doppler');
                    }
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9: return [2 /*return*/, null];
                case 10:
                    error_7 = _e.sent();
                    if (isRateLimitedError(error_7))
                        markProviderRateLimited('doppler');
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'LaunchpadDetector: Doppler detection failed', {
                        address: address,
                        error: (_d = error_7 === null || error_7 === void 0 ? void 0 : error_7.message) === null || _d === void 0 ? void 0 : _d.slice(0, 120)
                    });
                    return [2 /*return*/, null];
                case 11: return [2 /*return*/];
            }
        });
    });
}
function getDopplerTokensBatch(addresses_1) {
    return __awaiter(this, arguments, void 0, function (addresses, chainId) {
        var result, normalized, headers, query, _i, DOPPLER_INDEXER_BASES_2, base, url, data, items, _a, items_1, item, addr, hasPool, isDerc20, isCreatorCoin, e_3, msg;
        var _b, _c, _d, _e;
        if (chainId === void 0) { chainId = 8453; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    result = new Map();
                    normalized = Array.from(new Set(addresses
                        .map(function (a) { return normalizeEvmAddress(a); })
                        .filter(function (a) { return !!a; }))).filter(function (addr) { return !(Number(chainId) === 8453 && BASE_DOPPLER_DENYLIST.has(addr)); });
                    if (normalized.length === 0)
                        return [2 /*return*/, result];
                    if (isProviderBackoffActive('doppler'))
                        return [2 /*return*/, result];
                    headers = buildDopplerHeaders();
                    query = "query DopplerTokens($chainId: Int!, $addresses: [String!], $limit: Int!) {\n  tokens(where: { chainId: $chainId, address_in: $addresses }, limit: $limit) {\n    items {\n      address\n      chainId\n      name\n      symbol\n      image\n      creatorAddress\n      isDerc20\n      isCreatorCoin\n      firstSeenAt\n      pool {\n        address\n        fee\n        volumeUsd\n      }\n    }\n  }\n}";
                    _i = 0, DOPPLER_INDEXER_BASES_2 = DOPPLER_INDEXER_BASES;
                    _f.label = 1;
                case 1:
                    if (!(_i < DOPPLER_INDEXER_BASES_2.length)) return [3 /*break*/, 10];
                    base = DOPPLER_INDEXER_BASES_2[_i];
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 8, , 9]);
                    url = String(base || '').replace(/\/+$/, '').endsWith('/graphql')
                        ? String(base || '').replace(/\/+$/, '')
                        : "".concat(String(base || '').replace(/\/+$/, ''), "/graphql");
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: url,
                            method: 'POST',
                            timeout: 5000,
                            headers: headers,
                            body: JSON.stringify({
                                query: query,
                                variables: {
                                    chainId: Number(chainId),
                                    addresses: normalized,
                                    limit: Math.max(20, normalized.length + 10)
                                }
                            })
                        })];
                case 3:
                    data = _f.sent();
                    items = Array.isArray((_c = (_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b.tokens) === null || _c === void 0 ? void 0 : _c.items) ? data.data.tokens.items : [];
                    _a = 0, items_1 = items;
                    _f.label = 4;
                case 4:
                    if (!(_a < items_1.length)) return [3 /*break*/, 7];
                    item = items_1[_a];
                    addr = normalizeEvmAddress(item === null || item === void 0 ? void 0 : item.address);
                    if (!addr)
                        return [3 /*break*/, 6];
                    hasPool = !!normalizeEvmAddress(((_d = item === null || item === void 0 ? void 0 : item.pool) === null || _d === void 0 ? void 0 : _d.address) || '');
                    isDerc20 = (item === null || item === void 0 ? void 0 : item.isDerc20) === true;
                    isCreatorCoin = (item === null || item === void 0 ? void 0 : item.isCreatorCoin) === true;
                    if (!(hasPool || isDerc20 || isCreatorCoin))
                        return [3 /*break*/, 6];
                    return [4 /*yield*/, writeRawLaunchpadCache('doppler', addr, chainId, item)];
                case 5:
                    _f.sent();
                    result.set(addr, __assign(__assign({}, item), { source: 'doppler_graphql_batch', creatorAddress: (item === null || item === void 0 ? void 0 : item.creatorAddress) || undefined, creatorUrl: undefined, creatorLabel: undefined, imageUrl: (item === null || item === void 0 ? void 0 : item.image) || undefined, poolAddress: ((_e = item === null || item === void 0 ? void 0 : item.pool) === null || _e === void 0 ? void 0 : _e.address) || undefined }));
                    _f.label = 6;
                case 6:
                    _a++;
                    return [3 /*break*/, 4];
                case 7:
                    markProviderHealthy('doppler');
                    return [2 /*return*/, result];
                case 8:
                    e_3 = _f.sent();
                    msg = String((e_3 === null || e_3 === void 0 ? void 0 : e_3.message) || '').toLowerCase();
                    if (isRateLimitedError(e_3) || msg.includes('fetch failed') || msg.includes('enotfound')) {
                        markProviderRateLimited('doppler');
                    }
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 1];
                case 10: return [2 /*return*/, result];
            }
        });
    });
}
function getDopplerTokenByV4Hook(address, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var cid, poolManager, provider, normalizedAddress, dopplerHooks, latest, window_1, maxScan, topicAddress, minBlock, toBlock, fromBlock, _a, asCurrency0, asCurrency1, logs, _i, logs_1, log, parsed, hook, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 6, , 7]);
                    cid = Number(chainId || 8453);
                    if (cid !== 8453)
                        return [2 /*return*/, null];
                    poolManager = UNISWAP_V4_POOL_MANAGER_BY_CHAIN[cid];
                    if (!poolManager)
                        return [2 /*return*/, null];
                    provider = (0, rpcManager_js_1.getEthersProvider)(cid);
                    normalizedAddress = normalizeEvmAddress(address);
                    if (!normalizedAddress)
                        return [2 /*return*/, null];
                    dopplerHooks = new Set((v4Hooks_js_1.DOPPLER_HOOKS_BY_CHAIN[cid] || []).map(function (h) { return h.toLowerCase(); }));
                    if (dopplerHooks.size === 0)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, provider.getBlockNumber()];
                case 1:
                    latest = _d.sent();
                    window_1 = Math.max(50000, Number(process.env.DOPPLER_V4_SCAN_WINDOW || '120000'));
                    maxScan = Math.max(window_1, Number(process.env.DOPPLER_V4_SCAN_MAX_BLOCKS || '600000'));
                    topicAddress = ethers_1.ethers.zeroPadValue(normalizedAddress, 32).toLowerCase();
                    minBlock = Math.max(0, latest - maxScan);
                    toBlock = latest;
                    _d.label = 2;
                case 2:
                    if (!(toBlock >= minBlock)) return [3 /*break*/, 5];
                    fromBlock = Math.max(minBlock, toBlock - window_1 + 1);
                    return [4 /*yield*/, Promise.all([
                            provider.getLogs({
                                address: poolManager,
                                fromBlock: fromBlock,
                                toBlock: toBlock,
                                topics: [V4_INIT_EVENT, null, topicAddress]
                            }),
                            provider.getLogs({
                                address: poolManager,
                                fromBlock: fromBlock,
                                toBlock: toBlock,
                                topics: [V4_INIT_EVENT, null, null, topicAddress]
                            })
                        ])];
                case 3:
                    _a = _d.sent(), asCurrency0 = _a[0], asCurrency1 = _a[1];
                    logs = __spreadArray(__spreadArray([], asCurrency0, true), asCurrency1, true);
                    if (logs.length === 0)
                        return [3 /*break*/, 4];
                    for (_i = 0, logs_1 = logs; _i < logs_1.length; _i++) {
                        log = logs_1[_i];
                        try {
                            parsed = v4InitEventInterface.parseLog(log);
                            hook = String(((_c = parsed === null || parsed === void 0 ? void 0 : parsed.args) === null || _c === void 0 ? void 0 : _c.hooks) || '').toLowerCase();
                            if (!hook || !dopplerHooks.has(hook))
                                continue;
                            return [2 /*return*/, {
                                    address: normalizedAddress,
                                    source: 'doppler_v4_hook_scan',
                                    hookAddress: hook,
                                    txHash: log.transactionHash,
                                    blockNumber: Number(log.blockNumber || 0),
                                }];
                        }
                        catch (_e) {
                            // Skip malformed/unknown logs
                        }
                    }
                    _d.label = 4;
                case 4:
                    toBlock -= window_1;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, null];
                case 6:
                    _b = _d.sent();
                    return [2 /*return*/, null];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function normalizeMaybeIpfsUri(value) {
    if (typeof value !== 'string')
        return null;
    var raw = value.trim();
    if (!raw)
        return null;
    if (/^https?:\/\//i.test(raw))
        return raw;
    if (raw.startsWith('ipfs://')) {
        return "".concat(FLAP_IPFS_GATEWAY).concat(raw.slice('ipfs://'.length).replace(/^ipfs\//, ''));
    }
    if (/^[a-zA-Z0-9]+$/.test(raw) && raw.length >= 32) {
        return "".concat(FLAP_IPFS_GATEWAY).concat(raw);
    }
    return null;
}
function resolveFlapTokenImage(metaUri) {
    return __awaiter(this, void 0, void 0, function () {
        var metaUrl, metadata, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!metaUri)
                        return [2 /*return*/, null];
                    metaUrl = normalizeMaybeIpfsUri(metaUri);
                    if (!metaUrl)
                        return [2 /*return*/, null];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: metaUrl,
                            timeout: 4000,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        })];
                case 2:
                    metadata = _b.sent();
                    return [2 /*return*/, normalizeMaybeIpfsUri((metadata === null || metadata === void 0 ? void 0 : metadata.image) || (metadata === null || metadata === void 0 ? void 0 : metadata.image_url) || (metadata === null || metadata === void 0 ? void 0 : metadata.logo) || null)];
                case 3:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getFlapToken(address) {
    return __awaiter(this, void 0, void 0, function () {
        var provider, portal, tokenInfo, _a, statusRaw, token, metaUri, name_1, symbol, _b, _c, _d, _e, _f, imageUrl, error_8;
        var _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 25, , 26]);
                    if (isProviderBackoffActive('flap'))
                        return [2 /*return*/, null];
                    provider = (0, rpcManager_js_1.getEthersProvider)(56);
                    portal = new ethers_1.ethers.Contract(FLAP_PORTAL_BSC_MAINNET, FLAP_PORTAL_ABI, provider);
                    tokenInfo = null;
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 3, , 5]);
                    return [4 /*yield*/, portal.getTokenV6(address)];
                case 2:
                    tokenInfo = _j.sent();
                    return [3 /*break*/, 5];
                case 3:
                    _a = _j.sent();
                    return [4 /*yield*/, portal.getTokenV5(address)];
                case 4:
                    tokenInfo = _j.sent();
                    return [3 /*break*/, 5];
                case 5:
                    statusRaw = Number((_h = (_g = tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.status) !== null && _g !== void 0 ? _g : tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo[0]) !== null && _h !== void 0 ? _h : 0);
                    if (!Number.isFinite(statusRaw) || statusRaw <= 0) {
                        markProviderHealthy('flap');
                        return [2 /*return*/, null];
                    }
                    token = new ethers_1.ethers.Contract(address, FLAP_META_ABI, provider);
                    metaUri = null;
                    name_1 = 'Unknown';
                    symbol = 'UNKNOWN';
                    _j.label = 6;
                case 6:
                    _j.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, token.metaURI()];
                case 7:
                    metaUri = _j.sent();
                    return [3 /*break*/, 9];
                case 8:
                    _b = _j.sent();
                    return [3 /*break*/, 9];
                case 9:
                    if (!!metaUri) return [3 /*break*/, 13];
                    _j.label = 10;
                case 10:
                    _j.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, token.meta()];
                case 11:
                    metaUri = _j.sent();
                    return [3 /*break*/, 13];
                case 12:
                    _c = _j.sent();
                    return [3 /*break*/, 13];
                case 13:
                    if (!!metaUri) return [3 /*break*/, 17];
                    _j.label = 14;
                case 14:
                    _j.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, token.tokenURI()];
                case 15:
                    metaUri = _j.sent();
                    return [3 /*break*/, 17];
                case 16:
                    _d = _j.sent();
                    return [3 /*break*/, 17];
                case 17:
                    _j.trys.push([17, 19, , 20]);
                    return [4 /*yield*/, token.name()];
                case 18:
                    name_1 = _j.sent();
                    return [3 /*break*/, 20];
                case 19:
                    _e = _j.sent();
                    return [3 /*break*/, 20];
                case 20:
                    _j.trys.push([20, 22, , 23]);
                    return [4 /*yield*/, token.symbol()];
                case 21:
                    symbol = _j.sent();
                    return [3 /*break*/, 23];
                case 22:
                    _f = _j.sent();
                    return [3 /*break*/, 23];
                case 23: return [4 /*yield*/, resolveFlapTokenImage(metaUri)];
                case 24:
                    imageUrl = _j.sent();
                    markProviderHealthy('flap');
                    return [2 /*return*/, {
                            address: address,
                            name: name_1,
                            symbol: symbol,
                            status: statusRaw,
                            source: 'flap_portal',
                            metaURI: metaUri || undefined,
                            imageUrl: imageUrl || undefined
                        }];
                case 25:
                    error_8 = _j.sent();
                    if (isRateLimitedError(error_8)) {
                        markProviderRateLimited('flap');
                    }
                    return [2 /*return*/, null];
                case 26: return [2 /*return*/];
            }
        });
    });
}
function normalizeSolanaAddress(value) {
    if (typeof value !== 'string')
        return null;
    var v = value.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))
        return null;
    try {
        return new web3_js_1.PublicKey(v).toBase58();
    }
    catch (_a) {
        return null;
    }
}
function pickSolanaCreatorAddress(payload) {
    if (!payload || typeof payload !== 'object')
        return undefined;
    var candidates = [
        payload.creator,
        payload.creatorAddress,
        payload.creator_address,
        payload.creator_wallet,
        payload.creatorWallet,
        payload.user,
        payload.userAddress,
        payload.owner,
        payload.deployer,
        payload.dev,
        payload.teamWallet,
        payload.authority,
        payload.mintAuthority,
        payload.updateAuthority,
    ];
    for (var _i = 0, candidates_2 = candidates; _i < candidates_2.length; _i++) {
        var raw = candidates_2[_i];
        var addr = normalizeSolanaAddress(raw);
        if (addr)
            return addr;
    }
    return undefined;
}
/**
 * Detect Pump.fun token (Solana)
 */
function getPumpFunToken(mintAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedMint, _i, PUMPFUN_FRONTEND_BASES_1, base, data, payload, creatorAddress, twitter, telegram, _a, batchData, row, creatorAddress, twitter, telegram, _b, portalUrl, portalData, portalMint, creatorAddress, twitter, telegram, e_4, raydiumUrl, raydiumData, token, creatorAddress, e_5, error_9;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 16, , 17]);
                    normalizedMint = mintAddress.trim();
                    _i = 0, PUMPFUN_FRONTEND_BASES_1 = PUMPFUN_FRONTEND_BASES;
                    _e.label = 1;
                case 1:
                    if (!(_i < PUMPFUN_FRONTEND_BASES_1.length)) return [3 /*break*/, 9];
                    base = PUMPFUN_FRONTEND_BASES_1[_i];
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: "".concat(base, "/coins/").concat(mintAddress),
                            timeout: 3000,
                            suppressError: true,
                            headers: {
                                'Accept': 'application/json',
                                'Origin': 'https://pump.fun',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            }
                        })];
                case 3:
                    data = _e.sent();
                    if (data && data.mint) {
                        payload = data;
                        creatorAddress = pickSolanaCreatorAddress(payload);
                        twitter = typeof payload.twitter === 'string' ? payload.twitter : undefined;
                        telegram = typeof payload.telegram === 'string' ? payload.telegram : undefined;
                        return [2 /*return*/, __assign(__assign({}, payload), { creatorAddress: creatorAddress, creatorUrl: twitter || telegram || undefined, creatorLabel: typeof payload.username === 'string' ? payload.username : undefined })];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    _a = _e.sent();
                    return [3 /*break*/, 5];
                case 5:
                    _e.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: "".concat(base, "/coins/mints"),
                            method: 'POST',
                            timeout: 3000,
                            suppressError: true,
                            headers: {
                                'Content-Type': 'application/json',
                                'Origin': 'https://pump.fun',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            },
                            body: JSON.stringify([mintAddress])
                        })];
                case 6:
                    batchData = _e.sent();
                    if (Array.isArray(batchData) && batchData.length > 0 && ((_c = batchData[0]) === null || _c === void 0 ? void 0 : _c.mint) === mintAddress) {
                        row = batchData[0];
                        creatorAddress = pickSolanaCreatorAddress(row);
                        twitter = typeof row.twitter === 'string' ? row.twitter : undefined;
                        telegram = typeof row.telegram === 'string' ? row.telegram : undefined;
                        return [2 /*return*/, __assign(__assign({}, row), { creatorAddress: creatorAddress, creatorUrl: twitter || telegram || undefined, creatorLabel: typeof row.username === 'string' ? row.username : undefined })];
                    }
                    return [3 /*break*/, 8];
                case 7:
                    _b = _e.sent();
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 1];
                case 9:
                    _e.trys.push([9, 11, , 12]);
                    portalUrl = "https://pumpportal.fun/api/data/token-info?ca=".concat(mintAddress);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: portalUrl,
                            timeout: 3000,
                            suppressError: true
                        })];
                case 10:
                    portalData = _e.sent();
                    portalMint = String((portalData === null || portalData === void 0 ? void 0 : portalData.mint) || (portalData === null || portalData === void 0 ? void 0 : portalData.address) || '').trim();
                    if (portalMint && portalMint === normalizedMint) {
                        creatorAddress = pickSolanaCreatorAddress(portalData);
                        twitter = typeof portalData.twitter === 'string' ? portalData.twitter : undefined;
                        telegram = typeof portalData.telegram === 'string' ? portalData.telegram : undefined;
                        return [2 /*return*/, __assign(__assign({}, portalData), { creatorAddress: creatorAddress, creatorUrl: twitter || telegram || undefined, creatorLabel: typeof portalData.username === 'string' ? portalData.username : undefined })];
                    }
                    return [3 /*break*/, 12];
                case 11:
                    e_4 = _e.sent();
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'LaunchpadDetector: PumpPortal fallback failed');
                    return [3 /*break*/, 12];
                case 12:
                    _e.trys.push([12, 14, , 15]);
                    raydiumUrl = "https://api-v3.raydium.io/mint/ids?mints=".concat(mintAddress);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: raydiumUrl,
                            timeout: 3000,
                            suppressError: true
                        })];
                case 13:
                    raydiumData = _e.sent();
                    if (raydiumData.success && ((_d = raydiumData.data) === null || _d === void 0 ? void 0 : _d[0])) {
                        token = raydiumData.data[0];
                        // STRICT FILTER: Ensure the token from Raydium is actually a Pump.fun token
                        // Pump.fun Program ID: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
                        if (token.programId === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P') {
                            creatorAddress = pickSolanaCreatorAddress(token);
                            return [2 /*return*/, __assign(__assign({}, token), { mint: mintAddress, name: token.name, symbol: token.symbol, image_uri: token.logoURI, decimals: token.decimals, creatorAddress: creatorAddress })];
                        }
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'LaunchpadDetector: Raydium fallback Program ID mismatch', { mintAddress: mintAddress, programId: token.programId });
                    }
                    return [3 /*break*/, 15];
                case 14:
                    e_5 = _e.sent();
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/, null];
                case 16:
                    error_9 = _e.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Pump.fun fetch failed', { mintAddress: mintAddress, error: error_9.message });
                    return [2 /*return*/, null];
                case 17: return [2 /*return*/];
            }
        });
    });
}
/**
 * Detect Raydium token (Solana)
 */
function getRaydiumToken(mintAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, raydiumUrl, data, t, isLaunchLabProgram, hasPlatformId, creatorAddress, poolsByMintUrl, poolData, rows, migratedLaunchLabPool, creatorAddress, _a, isLaunchpad, creatorAddress, e_6, error_10;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 11, , 12]);
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    };
                    raydiumUrl = "https://api-v3.raydium.io/mint/ids?mints=".concat(mintAddress);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 9, , 10]);
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: raydiumUrl,
                            timeout: 3000,
                            headers: headers
                        })];
                case 2:
                    data = _d.sent();
                    if (!(data.success && ((_b = data.data) === null || _b === void 0 ? void 0 : _b[0]))) return [3 /*break*/, 8];
                    t = data.data[0];
                    isLaunchLabProgram = t.programId === 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';
                    hasPlatformId = !!t.platformId || !!t.platform || (t.extensions && (t.extensions.platform === 'launchlab' || t.extensions.platform === 'bonkfun'));
                    if (isLaunchLabProgram || hasPlatformId) {
                        creatorAddress = pickSolanaCreatorAddress(t);
                        return [2 /*return*/, __assign(__assign({}, t), { mint: mintAddress, name: t.name, symbol: t.symbol, image_uri: t.logoURI, decimals: t.decimals, isBonkFun: true, creatorAddress: creatorAddress })];
                    }
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, 5, , 6]);
                    poolsByMintUrl = "https://api-v3.raydium.io/pools/info/mint?mint1=".concat(mintAddress, "&poolType=all&poolSortField=default&sortType=desc&pageSize=20&page=1");
                    return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                            url: poolsByMintUrl,
                            timeout: 3000,
                            suppressError: true,
                            headers: headers
                        })];
                case 4:
                    poolData = _d.sent();
                    rows = Array.isArray((_c = poolData === null || poolData === void 0 ? void 0 : poolData.data) === null || _c === void 0 ? void 0 : _c.data) ? poolData.data.data : [];
                    migratedLaunchLabPool = rows.find(function (row) {
                        var _a, _b;
                        if (!row || row.launchMigratePool !== true)
                            return false;
                        var mintA = (_a = row === null || row === void 0 ? void 0 : row.mintA) === null || _a === void 0 ? void 0 : _a.address;
                        var mintB = (_b = row === null || row === void 0 ? void 0 : row.mintB) === null || _b === void 0 ? void 0 : _b.address;
                        return mintA === mintAddress || mintB === mintAddress;
                    });
                    if (migratedLaunchLabPool) {
                        creatorAddress = pickSolanaCreatorAddress(t) || pickSolanaCreatorAddress(migratedLaunchLabPool);
                        return [2 /*return*/, __assign(__assign({}, t), { mint: mintAddress, name: t.name, symbol: t.symbol, image_uri: t.logoURI, decimals: t.decimals, isBonkFun: true, source: 'raydium_pool_migration', poolId: migratedLaunchLabPool.id, creatorAddress: creatorAddress })];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    _a = _d.sent();
                    return [3 /*break*/, 6];
                case 6:
                    // 3) Fallback: check LaunchLab auth PDA on metadata
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'LaunchpadDetector: Token missing API indicators, checking on-chain auth', { mintAddress: mintAddress });
                    return [4 /*yield*/, checkLaunchpadAuth(mintAddress)];
                case 7:
                    isLaunchpad = _d.sent();
                    if (isLaunchpad) {
                        creatorAddress = pickSolanaCreatorAddress(t);
                        return [2 /*return*/, __assign(__assign({}, t), { mint: mintAddress, name: t.name, symbol: t.symbol, image_uri: t.logoURI, decimals: t.decimals, isBonkFun: true, creatorAddress: creatorAddress })];
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'LaunchpadDetector: Raydium token missing indicators and Auth mismatch', { mintAddress: mintAddress });
                    return [2 /*return*/, null];
                case 8: return [3 /*break*/, 10];
                case 9:
                    e_6 = _d.sent();
                    return [3 /*break*/, 10];
                case 10: 
                // No non-official fallback here by design.
                // For Bonk/LaunchLab detection we only trust Raydium official signals + on-chain authority checks.
                return [2 /*return*/, null];
                case 11:
                    error_10 = _d.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'LaunchpadDetector: Solana detection failed', { mintAddress: mintAddress, error: error_10.message });
                    return [2 /*return*/, null];
                case 12: return [2 /*return*/];
            }
        });
    });
}
/**
 * Detect launchpad token from any platform
 */
function detectLaunchpadToken(address_1, chainId_1) {
    return __awaiter(this, arguments, void 0, function (address, chainId, options) {
        var mode, cacheKey, needsCreator, forceRefresh, useNegativeCache, cached, persistent, _a, _b, _c, inflightKey, existing, doDetect, promise;
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    mode = options.mode || 'full';
                    cacheKey = "".concat(chainId || 'any', ":").concat(mode, ":").concat(address.toLowerCase());
                    needsCreator = !!options.requireCreator;
                    forceRefresh = !!options.forceRefresh;
                    useNegativeCache = Number(chainId || 0) !== 8453;
                    cached = DETECTION_CACHE.get(cacheKey);
                    if (!forceRefresh && cached && cached.expiry > Date.now()) {
                        if (!needsCreator || hasCreatorInResult(cached.result)) {
                            return [2 /*return*/, cached.result];
                        }
                    }
                    if (!!forceRefresh) return [3 /*break*/, 2];
                    return [4 /*yield*/, readPersistentLaunchpadDecision(address, chainId)];
                case 1:
                    _a = _d.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = null;
                    _d.label = 3;
                case 3:
                    persistent = _a;
                    if (persistent === null || persistent === void 0 ? void 0 : persistent.result) {
                        if (!needsCreator || hasCreatorInResult(persistent.result)) {
                            DETECTION_CACHE.set(cacheKey, { result: persistent.result, expiry: Date.now() + CACHE_TTL });
                            if (persistent.stale) {
                                void refreshLaunchpadDecisionInBackground(address, chainId, __assign(__assign({}, options), { forceRefresh: true }), cacheKey);
                            }
                            return [2 /*return*/, persistent.result];
                        }
                    }
                    _b = !forceRefresh;
                    if (!_b) return [3 /*break*/, 5];
                    return [4 /*yield*/, readRetryLaunchpadCache(address, chainId)];
                case 4:
                    _b = (_d.sent());
                    _d.label = 5;
                case 5:
                    if (_b) {
                        DETECTION_CACHE.set(cacheKey, { result: null, expiry: Date.now() + Math.min(CACHE_TTL, 60000) });
                        return [2 /*return*/, null];
                    }
                    _c = !forceRefresh && useNegativeCache;
                    if (!_c) return [3 /*break*/, 7];
                    return [4 /*yield*/, readNegativeLaunchpadCache(address, chainId)];
                case 6:
                    _c = (_d.sent());
                    _d.label = 7;
                case 7:
                    if (_c) {
                        DETECTION_CACHE.set(cacheKey, { result: null, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, null];
                    }
                    inflightKey = "".concat(chainId !== null && chainId !== void 0 ? chainId : 'any', ":").concat(mode, ":").concat(needsCreator ? 'creator' : 'no_creator', ":").concat(address.toLowerCase());
                    if (!forceRefresh) {
                        existing = INFLIGHT_MAP.get(inflightKey);
                        if (existing)
                            return [2 /*return*/, existing];
                    }
                    doDetect = function () { return __awaiter(_this, void 0, void 0, function () {
                        var globalTimeoutMs, timeoutId, timeoutPromise, timerLabel, result, err_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    globalTimeoutMs = mode === 'cheap' ? 1500 : 6000;
                                    timeoutId = null;
                                    timeoutPromise = new Promise(function (resolve) {
                                        timeoutId = setTimeout(function () {
                                            logger_js_1.logger.info(logRegistry_js_1.LogCode.API_TIMEOUT, 'LaunchpadDetector: Global timeout reached', { address: address });
                                            resolve(null);
                                        }, globalTimeoutMs);
                                    });
                                    timerLabel = "launchpad_det_".concat(address);
                                    logger_js_1.logger.startTimer(timerLabel);
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 11, , 12]);
                                    return [4 /*yield*/, Promise.race([
                                            handleDetection(address, chainId, cacheKey, options),
                                            timeoutPromise
                                        ])];
                                case 2:
                                    result = _a.sent();
                                    if (timeoutId)
                                        clearTimeout(timeoutId);
                                    if (!result) return [3 /*break*/, 6];
                                    return [4 /*yield*/, writePersistentLaunchpadDecision(address, chainId, result)];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, cacheClient_js_1.del)(buildNegativeCacheKey(address, chainId)).catch(function () { })];
                                case 4:
                                    _a.sent();
                                    return [4 /*yield*/, (0, cacheClient_js_1.del)(buildRetryCacheKey(address, chainId)).catch(function () { })];
                                case 5:
                                    _a.sent();
                                    return [3 /*break*/, 10];
                                case 6:
                                    if (!hasAnyRelevantBackoff(address, chainId)) return [3 /*break*/, 8];
                                    return [4 /*yield*/, writeRetryLaunchpadCache(address, chainId)];
                                case 7:
                                    _a.sent();
                                    return [3 /*break*/, 10];
                                case 8:
                                    if (!useNegativeCache) return [3 /*break*/, 10];
                                    return [4 /*yield*/, writeNegativeLaunchpadCache(address, chainId)];
                                case 9:
                                    _a.sent();
                                    _a.label = 10;
                                case 10:
                                    logger_js_1.logger.endTimer(timerLabel, logRegistry_js_1.LogCode.AI_LAUNCHPAD_DETECTED, { address: address, chainId: chainId, found: !!result }, 'debug');
                                    return [2 /*return*/, result];
                                case 11:
                                    err_1 = _a.sent();
                                    if (timeoutId)
                                        clearTimeout(timeoutId);
                                    throw err_1;
                                case 12: return [2 /*return*/];
                            }
                        });
                    }); };
                    promise = doDetect().finally(function () {
                        INFLIGHT_MAP.delete(inflightKey);
                    });
                    INFLIGHT_MAP.set(inflightKey, promise);
                    return [2 /*return*/, promise];
            }
        });
    });
}
function refreshLaunchpadDecisionInBackground(address, chainId, options, cacheKey) {
    return __awaiter(this, void 0, void 0, function () {
        var lockKey, lockValue, locked, useNegativeCache, detected, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    lockKey = buildRefreshLockKey(address, chainId);
                    lockValue = "".concat(Date.now(), ":").concat(Math.random().toString(16).slice(2));
                    return [4 /*yield*/, (0, cacheClient_js_1.setIfNotExists)(lockKey, lockValue, LAUNCHPAD_REFRESH_LOCK_TTL_SECONDS)];
                case 1:
                    locked = _b.sent();
                    if (!locked)
                        return [2 /*return*/];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 12, 13, 15]);
                    useNegativeCache = Number(chainId || 0) !== 8453;
                    return [4 /*yield*/, handleDetection(address, chainId, cacheKey, __assign(__assign({}, options), { forceRefresh: true }))];
                case 3:
                    detected = _b.sent();
                    if (!detected) return [3 /*break*/, 7];
                    return [4 /*yield*/, writePersistentLaunchpadDecision(address, chainId, detected)];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, (0, cacheClient_js_1.del)(buildNegativeCacheKey(address, chainId)).catch(function () { })];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, (0, cacheClient_js_1.del)(buildRetryCacheKey(address, chainId)).catch(function () { })];
                case 6:
                    _b.sent();
                    return [2 /*return*/];
                case 7:
                    if (!hasAnyRelevantBackoff(address, chainId)) return [3 /*break*/, 9];
                    return [4 /*yield*/, writeRetryLaunchpadCache(address, chainId)];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 11];
                case 9:
                    if (!useNegativeCache) return [3 /*break*/, 11];
                    return [4 /*yield*/, writeNegativeLaunchpadCache(address, chainId)];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11: return [3 /*break*/, 15];
                case 12:
                    _a = _b.sent();
                    return [3 /*break*/, 15];
                case 13: return [4 /*yield*/, (0, cacheClient_js_1.del)(lockKey).catch(function () { })];
                case 14:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 15: return [2 /*return*/];
            }
        });
    });
}
function handleDetection(address, chainId, cacheKey, options) {
    return __awaiter(this, void 0, void 0, function () {
        var isSolana, isEVM, lowerAddress, cheapMode, result, _a, pumpResult, rayResult, completeFlag, hasPumpAmmSignal, isPumpSwap, provider, basePlatforms, creatorBidPlatforms, clankerPlatforms, bscPlatforms, fourmemeResult, result, _b, result, flapResult, result, _c, result, clankerResult, result, _d, zoraResult, twitter, farcaster, creatorUrl, creatorLabel, result, _e, inferredChainId, result, result, creatorBidFast, result, flaunchFast, result, virtualFast, result, zoraResult, result, e_7, zoraIndex, result, _f, allowDopplerHookFallback, withProviderTimeout, _g, virtualsResult, dopplerResult, paragraphResult, flaunchResult, creatorBidResult, clankerResult, dopplerByHook, result, result, result, detectedChainId, result, result, result, result, creatorBidResult, result, _h, fourmemeResult, result, e_8;
        var _this = this;
        var _j, _k, _l, _m, _o, _p, _q;
        return __generator(this, function (_r) {
            switch (_r.label) {
                case 0:
                    isSolana = address.length > 40 && !address.startsWith('0x');
                    isEVM = address.startsWith('0x') && address.length === 42;
                    lowerAddress = address.toLowerCase();
                    cheapMode = (options.mode || 'full') === 'cheap' && !options.requireCreator;
                    if (!isSolana && !isEVM) {
                        return [2 /*return*/, null];
                    }
                    if (!isSolana) return [3 /*break*/, 2];
                    // Fast suffix detection first (cheap and deterministic for launchpad mints)
                    if (lowerAddress.endsWith('pump') && !options.requireCreator) {
                        result = {
                            provider: 'pumpfun',
                            data: { mint: address, source: 'suffix' },
                            chainId: solanaConfig_js_1.SOLANA_CONFIG.CHAIN_ID
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [4 /*yield*/, Promise.all([
                            getPumpFunToken(address).catch(function () { return null; }),
                            getRaydiumToken(address).catch(function () { return null; })
                        ])];
                case 1:
                    _a = _r.sent(), pumpResult = _a[0], rayResult = _a[1];
                    // Priority 1: Pump.fun / PumpSwap
                    if (pumpResult) {
                        completeFlag = Boolean((pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.complete) === true || (pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.bonding_curve_complete) === true);
                        hasPumpAmmSignal = Boolean(normalizeSolanaAddress(pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.amm_pool)
                            || normalizeSolanaAddress(pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.ammPool)
                            || normalizeSolanaAddress(pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.pool)
                            || normalizeSolanaAddress(pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.pool_id)
                            || String((pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.dex) || '').toLowerCase().includes('pump')
                            || String((pumpResult === null || pumpResult === void 0 ? void 0 : pumpResult.market_type) || '').toLowerCase().includes('amm'));
                        isPumpSwap = completeFlag && hasPumpAmmSignal;
                        provider = isPumpSwap ? 'pumpswap' : 'pumpfun';
                        DETECTION_CACHE.set(cacheKey, { result: { provider: provider, data: pumpResult, chainId: solanaConfig_js_1.SOLANA_CONFIG.CHAIN_ID }, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, { provider: provider, data: pumpResult, chainId: solanaConfig_js_1.SOLANA_CONFIG.CHAIN_ID }];
                    }
                    // Priority 2: BonkFun (LaunchLab tokens on Raydium)
                    if (rayResult) {
                        DETECTION_CACHE.set(cacheKey, { result: { provider: 'bonkfun', data: rayResult, chainId: solanaConfig_js_1.SOLANA_CONFIG.CHAIN_ID }, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, { provider: 'bonkfun', data: rayResult, chainId: solanaConfig_js_1.SOLANA_CONFIG.CHAIN_ID }];
                    }
                    return [2 /*return*/, null]; // Not found on either
                case 2:
                    if (!isEVM) return [3 /*break*/, 44];
                    basePlatforms = (chainId === 8453 || !chainId);
                    creatorBidPlatforms = (chainId === 8453 || chainId === 56 || !chainId);
                    clankerPlatforms = (chainId === 8453 || chainId === 1 || !chainId);
                    bscPlatforms = (chainId === 56 || !chainId);
                    if (!(bscPlatforms && FOURMEME_SUFFIXES.some(function (s) { return lowerAddress.endsWith(s); }))) return [3 /*break*/, 7];
                    if (!(!cheapMode && (options.requireCreator || (options.mode || 'full') === 'full'))) return [3 /*break*/, 6];
                    _r.label = 3;
                case 3:
                    _r.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, getFourMemeToken(address)];
                case 4:
                    fourmemeResult = _r.sent();
                    if (fourmemeResult) {
                        result = {
                            provider: 'fourmeme',
                            data: __assign(__assign({}, fourmemeResult), { vanitySuffix: lowerAddress.endsWith('ffff') ? 'ffff' : '4444' }),
                            chainId: 56
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    _b = _r.sent();
                    return [3 /*break*/, 6];
                case 6:
                    if (!options.requireCreator) {
                        result = {
                            provider: 'fourmeme',
                            data: {
                                address: address,
                                source: 'suffix',
                                vanitySuffix: lowerAddress.endsWith('ffff') ? 'ffff' : '4444'
                            },
                            chainId: 56
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    _r.label = 7;
                case 7:
                    if (!(bscPlatforms && FLAP_SUFFIXES.some(function (s) { return lowerAddress.endsWith(s); }))) return [3 /*break*/, 12];
                    if (!!cheapMode) return [3 /*break*/, 11];
                    _r.label = 8;
                case 8:
                    _r.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, getFlapToken(address)];
                case 9:
                    flapResult = _r.sent();
                    if (flapResult) {
                        result = {
                            provider: 'flap',
                            data: __assign(__assign({}, flapResult), { vanitySuffix: lowerAddress.endsWith('7777') ? '7777' : '8888' }),
                            chainId: 56
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [3 /*break*/, 11];
                case 10:
                    _c = _r.sent();
                    return [3 /*break*/, 11];
                case 11:
                    if (!options.requireCreator) {
                        result = {
                            provider: 'flap',
                            data: { address: address, source: 'suffix' },
                            chainId: 56
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    _r.label = 12;
                case 12:
                    if (!(clankerPlatforms && lowerAddress.endsWith(CLANKER_SUFFIX))) return [3 /*break*/, 21];
                    if (!!cheapMode) return [3 /*break*/, 16];
                    _r.label = 13;
                case 13:
                    _r.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, getClankerToken(address, chainId)];
                case 14:
                    clankerResult = _r.sent();
                    if (clankerResult) {
                        result = {
                            provider: 'clanker',
                            data: clankerResult,
                            chainId: resolveClankerChainId(clankerResult, chainId),
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [3 /*break*/, 16];
                case 15:
                    _d = _r.sent();
                    return [3 /*break*/, 16];
                case 16:
                    if (!(!cheapMode && basePlatforms && !isProviderBackoffActive('zora'))) return [3 /*break*/, 20];
                    _r.label = 17;
                case 17:
                    _r.trys.push([17, 19, , 20]);
                    return [4 /*yield*/, zoraService_js_1.zoraService.getCoinByAddress(address)];
                case 18:
                    zoraResult = _r.sent();
                    if (zoraResult) {
                        twitter = (_l = (_k = (_j = zoraResult.creatorProfile) === null || _j === void 0 ? void 0 : _j.socialAccounts) === null || _k === void 0 ? void 0 : _k.twitter) === null || _l === void 0 ? void 0 : _l.username;
                        farcaster = (_p = (_o = (_m = zoraResult.creatorProfile) === null || _m === void 0 ? void 0 : _m.socialAccounts) === null || _o === void 0 ? void 0 : _o.farcaster) === null || _p === void 0 ? void 0 : _p.username;
                        creatorUrl = twitter
                            ? "https://x.com/".concat(String(twitter).replace(/^@/, ''))
                            : (farcaster ? "https://warpcast.com/".concat(String(farcaster).replace(/^@/, '')) : undefined);
                        creatorLabel = ((_q = zoraResult.creatorProfile) === null || _q === void 0 ? void 0 : _q.handle)
                            ? "@".concat(String(zoraResult.creatorProfile.handle).replace(/^@/, ''))
                            : undefined;
                        result = {
                            provider: 'clanker',
                            data: {
                                address: address,
                                source: 'clanker_suffix_zora_creator_fallback',
                                creatorAddress: zoraResult.creatorAddress || undefined,
                                creatorUrl: creatorUrl,
                                creatorLabel: creatorLabel,
                            },
                            chainId: 8453
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [3 /*break*/, 20];
                case 19:
                    _e = _r.sent();
                    return [3 /*break*/, 20];
                case 20:
                    if (!options.requireCreator) {
                        inferredChainId = chainId === 1 ? 1 : 8453;
                        result = {
                            provider: 'clanker',
                            data: { address: address, source: 'suffix_fallback' },
                            chainId: inferredChainId
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    _r.label = 21;
                case 21:
                    // Check for ZORA platform token first (lightning check)
                    if (address.toLowerCase() === ZORA_PLATFORM_TOKEN) {
                        result = {
                            provider: 'zora',
                            data: { symbol: 'ZORA', name: 'Zora', address: ZORA_PLATFORM_TOKEN },
                            chainId: 8453
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    // Soft mode: stop here for EVM. Keep it deterministic/cache-only.
                    if (cheapMode) {
                        return [2 /*return*/, null];
                    }
                    if (!(creatorBidPlatforms && !isProviderBackoffActive('creatorbid'))) return [3 /*break*/, 23];
                    return [4 /*yield*/, Promise.race([
                            getCreatorBidToken(address, chainId).catch(function () { return null; }),
                            new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, 1800); }),
                        ])];
                case 22:
                    creatorBidFast = _r.sent();
                    if (creatorBidFast) {
                        result = {
                            provider: 'creatorbid',
                            data: creatorBidFast,
                            chainId: normalizeCreatorBidChainId(creatorBidFast === null || creatorBidFast === void 0 ? void 0 : creatorBidFast.chainId) || 8453
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    _r.label = 23;
                case 23:
                    if (!(basePlatforms && !isProviderBackoffActive('flaunch'))) return [3 /*break*/, 25];
                    return [4 /*yield*/, Promise.race([
                            getFlaunchToken(address, false).catch(function () { return null; }),
                            new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, 1800); }),
                        ])];
                case 24:
                    flaunchFast = _r.sent();
                    if (flaunchFast) {
                        result = { provider: 'flaunch', data: flaunchFast, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    _r.label = 25;
                case 25:
                    if (!(basePlatforms && !isProviderBackoffActive('virtuals'))) return [3 /*break*/, 27];
                    return [4 /*yield*/, Promise.race([
                            getVirtualsToken(address, options.mode || 'full').catch(function () { return null; }),
                            new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, 2500); }),
                        ])];
                case 26:
                    virtualFast = _r.sent();
                    if (virtualFast) {
                        result = { provider: 'virtuals', data: virtualFast, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    _r.label = 27;
                case 27:
                    if (!(basePlatforms && !isProviderBackoffActive('zora'))) return [3 /*break*/, 31];
                    _r.label = 28;
                case 28:
                    _r.trys.push([28, 30, , 31]);
                    return [4 /*yield*/, Promise.race([
                            zoraService_js_1.zoraService.getCoinByAddress(address),
                            new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, 1800); }),
                        ])];
                case 29:
                    zoraResult = _r.sent();
                    if (zoraResult) {
                        markProviderHealthy('zora');
                        result = { provider: 'zora', data: zoraResult, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    markProviderHealthy('zora');
                    return [3 /*break*/, 31];
                case 30:
                    e_7 = _r.sent();
                    if (isRateLimitedError(e_7)) {
                        markProviderRateLimited('zora');
                    }
                    return [3 /*break*/, 31];
                case 31:
                    if (!(basePlatforms && !options.requireCreator)) return [3 /*break*/, 35];
                    _r.label = 32;
                case 32:
                    _r.trys.push([32, 34, , 35]);
                    return [4 /*yield*/, Promise.race([
                            getZoraAddressIndex(),
                            new Promise(function (resolve) { return setTimeout(function () { return resolve(new Set()); }, 900); }),
                        ])];
                case 33:
                    zoraIndex = _r.sent();
                    if (zoraIndex.has(lowerAddress)) {
                        result = {
                            provider: 'zora',
                            data: { address: address, source: 'zora_api_index' },
                            chainId: 8453
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [3 /*break*/, 35];
                case 34:
                    _f = _r.sent();
                    return [3 /*break*/, 35];
                case 35:
                    if (!basePlatforms) return [3 /*break*/, 37];
                    allowDopplerHookFallback = String(process.env.DOPPLER_HOOK_FALLBACK_ENABLED || '').toLowerCase() === 'true';
                    withProviderTimeout = function (promise_1) {
                        var args_1 = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args_1[_i - 1] = arguments[_i];
                        }
                        return __awaiter(_this, __spreadArray([promise_1], args_1, true), void 0, function (promise, ms) {
                            if (ms === void 0) { ms = 1800; }
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.race([
                                            promise,
                                            new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, ms); }),
                                        ])];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        });
                    };
                    return [4 /*yield*/, Promise.all([
                            withProviderTimeout(getVirtualsToken(address, options.mode || 'full').catch(function () { return null; })),
                            withProviderTimeout(getDopplerToken(address, 8453).catch(function () { return null; })),
                            withProviderTimeout(getParagraphToken(address).catch(function () { return null; })),
                            withProviderTimeout(getFlaunchToken(address, false).catch(function () { return null; })),
                            withProviderTimeout(getCreatorBidToken(address, 8453).catch(function () { return null; })),
                            (clankerPlatforms && !lowerAddress.endsWith(CLANKER_SUFFIX) && !isProviderBackoffActive('clanker'))
                                ? withProviderTimeout(getClankerToken(address, chainId).catch(function () { return null; }))
                                : Promise.resolve(null),
                            allowDopplerHookFallback
                                ? withProviderTimeout(getDopplerTokenByV4Hook(address, 8453).catch(function () { return null; }))
                                : Promise.resolve(null),
                        ])];
                case 36:
                    _g = _r.sent(), virtualsResult = _g[0], dopplerResult = _g[1], paragraphResult = _g[2], flaunchResult = _g[3], creatorBidResult = _g[4], clankerResult = _g[5], dopplerByHook = _g[6];
                    if (virtualsResult) {
                        result = { provider: 'virtuals', data: virtualsResult, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    if (paragraphResult) {
                        result = { provider: 'paragraph', data: paragraphResult, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    if (flaunchResult) {
                        result = { provider: 'flaunch', data: flaunchResult, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    if (creatorBidResult) {
                        detectedChainId = normalizeCreatorBidChainId(creatorBidResult === null || creatorBidResult === void 0 ? void 0 : creatorBidResult.chainId) || 8453;
                        result = { provider: 'creatorbid', data: creatorBidResult, chainId: detectedChainId };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    if (clankerResult) {
                        result = {
                            provider: 'clanker',
                            data: clankerResult,
                            chainId: resolveClankerChainId(clankerResult, chainId),
                        };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    if (dopplerResult) {
                        result = { provider: 'doppler', data: dopplerResult, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    if (allowDopplerHookFallback && dopplerByHook) {
                        result = { provider: 'doppler', data: dopplerByHook, chainId: 8453 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    _r.label = 37;
                case 37:
                    if (!bscPlatforms) return [3 /*break*/, 44];
                    _r.label = 38;
                case 38:
                    _r.trys.push([38, 40, , 41]);
                    return [4 /*yield*/, getCreatorBidToken(address, 56)];
                case 39:
                    creatorBidResult = _r.sent();
                    if (creatorBidResult) {
                        result = { provider: 'creatorbid', data: creatorBidResult, chainId: 56 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [3 /*break*/, 41];
                case 40:
                    _h = _r.sent();
                    return [3 /*break*/, 41];
                case 41:
                    _r.trys.push([41, 43, , 44]);
                    return [4 /*yield*/, getFourMemeToken(address)];
                case 42:
                    fourmemeResult = _r.sent();
                    if (fourmemeResult) {
                        result = { provider: 'fourmeme', data: fourmemeResult, chainId: 56 };
                        DETECTION_CACHE.set(cacheKey, { result: result, expiry: Date.now() + CACHE_TTL });
                        return [2 /*return*/, result];
                    }
                    return [3 /*break*/, 44];
                case 43:
                    e_8 = _r.sent();
                    return [3 /*break*/, 44];
                case 44:
                    // Cache the result (even if null)
                    DETECTION_CACHE.set(cacheKey, {
                        result: null,
                        expiry: Date.now() + CACHE_TTL
                    });
                    return [2 /*return*/, null];
            }
        });
    });
}
