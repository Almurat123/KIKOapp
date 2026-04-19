"use strict";
/**
 * CONTEXT MEMORY
 * Updated: 2026-04-11
 * Author: Mina Zhou
 * Reason: v4 池发现层同时承担“官方部署地址读取”和“第三方 hook 池启发式发现”，
 *         需要明确哪些配置来自官方文档，哪些只是为生产流量保留的发现窗口。
 * Goal: 保持 PoolId 计算、StateView 读取和 Base 上第三方 hook 池发现稳定，
 *       同时不把启发式配置误记为官方规范。
 * Owns: v4 PoolId 计算、StateView 地址映射、常用 hook 池组合的只读发现。
 * Does Not Own: hook 家族归因、执行期能力判定、或 Universal Router 交易编码。
 * Design Language:
 * - 官方部署地址和本地发现启发式必须分开注释。
 * - Base 第三方 hook 池的零流动性发现属于兼容策略，不是协议事实。
 * - 扩大 fee/tickSpacing 搜索窗口时要保留来源说明。
 * Document Provenance:
 * - Source: Uniswap v4 deployments
 * - Kind: official API doc
 * - Retrieved: 2026-04-11
 * - Applied To: StateView 官方部署地址映射
 * - Verification: verified in docs
 * - Source: Uniswap v4 PoolId / PoolKey docs
 * - Kind: official API doc
 * - Retrieved: 2026-04-11
 * - Applied To: PoolId 计算与 PoolKey 编码方式
 * - Verification: verified in docs
 * - Source: DirectSwap v4 hook registry audit
 * - Kind: repo doc
 * - Retrieved: 2026-04-11
 * - Applied To: Base hook 池搜索组合只作为启发式兼容窗口
 * - Verification: verified in code
 * See also:
 * - /Users/almurat/KiKo/system-journal/INDEX.md
 * - /Users/almurat/KiKo/system-journal/design-language/directswap-v4-hook-provenance.md
 * - /Users/almurat/KiKo/system-journal/owner-map/backend-swap-validation.md
 * - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-directswap-v4-hook-provenance-audit.md
 * - /Users/almurat/KiKo/system-journal/conflicts.md
 *
 * Uniswap V4 Pool Information Service - 纯链上实现
 *
 * V4 架构:
 * - PoolId = keccak256(abi.encode(PoolKey))
 * - PoolKey = {currency0, currency1, fee, tickSpacing, hooks}
 * - 通过计算 PoolId 直接查询 StateView
 *
 * [Ref]: https://docs.uniswap.org/contracts/v4/reference/core/types/PoolId
 * [Logic]: 遍历常见配置计算 PoolId，查询 StateView 验证池子存在
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
exports.V4_STATE_VIEW = void 0;
exports.matchV4PoolKeyById = matchV4PoolKeyById;
exports.computePoolId = computePoolId;
exports.getV4PoolInfo = getV4PoolInfo;
exports.findV4Pools = findV4Pools;
exports.calculatePriceFromSqrtX96 = calculatePriceFromSqrtX96;
exports.isV4Supported = isV4Supported;
var ethers_1 = require("ethers");
var rpcManager_js_1 = require("../rpcManager.js");
var v4Hooks_js_1 = require("./v4Hooks.js");
var profile_js_1 = require("../rpc/profile.js");
// StateView ABI
var V4_STATE_VIEW_ABI = [
    'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    'function getLiquidity(bytes32 poolId) view returns (uint128)'
];
// StateView 地址 (官方部署地址，2026-04-11 已按 Uniswap 官方 deployment 文档复核)
exports.V4_STATE_VIEW = {
    1: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227', // Ethereum
    8453: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71', // Base
    56: '0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4', // BNB Smart Chain
    42161: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990', // Arbitrum
    10: '0xc18a3169788f4f75a170290584eca6395c75ecdb', // Optimism
};
var stateViewInterface = new ethers_1.ethers.Interface(V4_STATE_VIEW_ABI);
var CLANKER_HOOKS_BASE = v4Hooks_js_1.CLANKER_HOOKS_BY_CHAIN[8453] || [];
// Clanker 在公开文档里说明 dynamic fee 池使用 Uniswap v4 的 0x800000 标志。
var DYNAMIC_FEE_FLAG = 0x800000;
var CLANKER_HOOKS_DYNAMIC_BASE = [
    '0xd60d6b218116cfd801e28f78d011a203d2b068cc', // ClankerHookDynamicFeeV2 v4.1.0
    '0x34a45c6b61876d739400bd71228cbcbd4f53e8cc', // ClankerHookDynamicFee v4.0.0
    '0x7debe6943acefe85c4ee81aadd736466e07528cc', // Runtime-observed Clanker-like dynamic fee variant
];
var CLANKER_HOOKS_STATIC_BASE = [
    '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc', // ClankerHookStaticFeeV2 v4.1.0
    '0xdd5eeaff7bd481ad55db083062b13a3cdf0a68cc', // ClankerHookStaticFee v4.0.0
];
var CLANKER_FEE_TICK_SPACING = [
    { fee: DYNAMIC_FEE_FLAG, tickSpacing: 200 },
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 },
    // Wider net for Clanker variants seen in the wild
    { fee: 2500, tickSpacing: 50 },
    { fee: 1000, tickSpacing: 20 },
];
var KNOWN_HOOKS_BASE = (0, v4Hooks_js_1.getKnownV4HooksByChain)(8453);
var KNOWN_DYNAMIC_FEE_HOOKS_BASE = KNOWN_HOOKS_BASE;
var DYNAMIC_FEE_TICK_SPACING_BASE = [40, 60, 200, 300, 1000];
// 常见 V4 配置。
// 注意：这里只是发现窗口，不是官方“完整可用池参数表”。
var V4_CONFIGS = {
    8453: __spreadArray(__spreadArray(__spreadArray(__spreadArray([], CLANKER_FEE_TICK_SPACING.map(function (cfg) { return (__assign(__assign({}, cfg), { hooks: CLANKER_HOOKS_DYNAMIC_BASE })); }), true), CLANKER_FEE_TICK_SPACING.map(function (cfg) { return (__assign(__assign({}, cfg), { hooks: CLANKER_HOOKS_STATIC_BASE })); }), true), [
        // Common static fee tiers (hookless + locally registered hooks).
        // Fee=0 pools are production-observed on Base in some flaunch-style hooks.
        { fee: 0, tickSpacing: 60, hooks: __spreadArray(['0x0000000000000000000000000000000000000000'], KNOWN_HOOKS_BASE, true) },
        { fee: 100, tickSpacing: 1, hooks: __spreadArray(['0x0000000000000000000000000000000000000000'], KNOWN_HOOKS_BASE, true) },
        { fee: 500, tickSpacing: 10, hooks: __spreadArray(['0x0000000000000000000000000000000000000000'], KNOWN_HOOKS_BASE, true) },
        { fee: 3000, tickSpacing: 60, hooks: __spreadArray(['0x0000000000000000000000000000000000000000'], KNOWN_HOOKS_BASE, true) },
        { fee: 10000, tickSpacing: 200, hooks: __spreadArray(['0x0000000000000000000000000000000000000000'], KNOWN_HOOKS_BASE, true) },
        { fee: 50000, tickSpacing: 1000, hooks: __spreadArray(['0x0000000000000000000000000000000000000000'], KNOWN_HOOKS_BASE, true) }
    ], false), DYNAMIC_FEE_TICK_SPACING_BASE.map(function (tickSpacing) { return ({
        fee: DYNAMIC_FEE_FLAG,
        tickSpacing: tickSpacing,
        hooks: KNOWN_DYNAMIC_FEE_HOOKS_BASE
    }); }), true),
    1: [
        { fee: 100, tickSpacing: 1, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 500, tickSpacing: 10, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 3000, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 10000, tickSpacing: 200, hooks: ['0x0000000000000000000000000000000000000000'] },
    ],
    56: [
        { fee: 100, tickSpacing: 1, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 500, tickSpacing: 10, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 3000, tickSpacing: 60, hooks: ['0x0000000000000000000000000000000000000000'] },
        { fee: 10000, tickSpacing: 200, hooks: ['0x0000000000000000000000000000000000000000'] },
    ],
};
var V4_POOL_CACHE_TTL = 30000; // 30s cache
var v4PoolCache = new Map();
var v4PoolInflight = new Map();
// Base 上部分第三方 hook 池在 StateView 中可能以零流动性初始化态出现。
// 这里是兼容发现逻辑，不代表这些家族天生等于“可执行池”。
var BASE_V4_ZERO_LIQ_HOOK_FAMILIES = new Set(['clanker', 'doppler', 'flaunch', 'zora', 'custom']);
var V4_FAST_DISCOVERY_WINDOW_MS = Number(process.env.V4_FAST_DISCOVERY_WINDOW_MS || '650');
var V4_FAST_DISCOVERY_BATCH_SIZE = Number(process.env.V4_FAST_DISCOVERY_BATCH_SIZE || '18');
function baseFastPriorityScore(poolKey) {
    if (poolKey.fee === DYNAMIC_FEE_FLAG && poolKey.tickSpacing === 200)
        return 0;
    if (poolKey.fee === DYNAMIC_FEE_FLAG)
        return 1;
    if (poolKey.fee === 10000 && poolKey.tickSpacing === 200)
        return 2;
    if (poolKey.fee === 3000 && poolKey.tickSpacing === 60)
        return 3;
    if (poolKey.fee === 500 && poolKey.tickSpacing === 10)
        return 4;
    if (poolKey.fee === 0 && poolKey.tickSpacing === 60)
        return 5;
    return 9;
}
function callRpc(chainId, method, params, options) {
    return __awaiter(this, void 0, void 0, function () {
        var profile;
        return __generator(this, function (_a) {
            profile = (0, profile_js_1.resolveRpcCallProfile)(options === null || options === void 0 ? void 0 : options.profile, {
                purpose: 'interactive_read',
                strategy: (options === null || options === void 0 ? void 0 : options.strategy) || 'fast',
                importance: ((options === null || options === void 0 ? void 0 : options.strategy) || 'fast') === 'fast' ? 'critical' : 'normal'
            });
            return [2 /*return*/, (0, rpcManager_js_1.callRpc)(chainId, method, params, {
                    strategy: profile.strategy,
                    importance: profile.importance,
                    purpose: profile.purpose,
                    exhaustiveFailover: true
                })];
        });
    });
}
/**
 * Try to resolve a PoolKey by matching a known poolId against common configs.
 * This is useful when payloads include poolId + hook + token pair but not fee/tickSpacing.
 */
function matchV4PoolKeyById(chainId, poolId, tokenA, tokenB, hookHint) {
    var configs = V4_CONFIGS[chainId];
    if (!configs)
        return null;
    if (!poolId || !tokenA || !tokenB)
        return null;
    var normalizedPoolId = poolId.toLowerCase();
    var hookNormalized = hookHint ? hookHint.toLowerCase() : null;
    var _a = BigInt(tokenA) < BigInt(tokenB)
        ? [tokenA, tokenB]
        : [tokenB, tokenA], currency0 = _a[0], currency1 = _a[1];
    for (var _i = 0, configs_1 = configs; _i < configs_1.length; _i++) {
        var config = configs_1[_i];
        var hooksToTry = hookNormalized ? [hookNormalized] : config.hooks;
        for (var _b = 0, hooksToTry_1 = hooksToTry; _b < hooksToTry_1.length; _b++) {
            var hooks = hooksToTry_1[_b];
            var poolKey = {
                currency0: currency0,
                currency1: currency1,
                fee: config.fee,
                tickSpacing: config.tickSpacing,
                hooks: hooks
            };
            var candidate = computePoolId(poolKey).toLowerCase();
            if (candidate === normalizedPoolId)
                return poolKey;
        }
    }
    return null;
}
/**
 * 计算 PoolId
 * [Logic]: PoolId = keccak256(abi.encode(PoolKey))
 * [Ref]: https://docs.uniswap.org/contracts/v4/reference/core/types/PoolId
 */
function computePoolId(poolKey) {
    var abiCoder = ethers_1.ethers.AbiCoder.defaultAbiCoder();
    var encoded = abiCoder.encode(['address', 'address', 'uint24', 'int24', 'address'], [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]);
    return ethers_1.ethers.keccak256(encoded);
}
/**
 * 查询 V4 池子信息
 * [Risk]: PoolId 必须有效，否则返回 null
 */
function getV4PoolInfo(poolKey, chainId, options) {
    return __awaiter(this, void 0, void 0, function () {
        var stateView, poolId, slot0Data, liquidityData, _a, slot0Result, liquidityResult, slot0, sqrtPriceX96, tick, protocolFee, lpFee, liquidity, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    stateView = exports.V4_STATE_VIEW[chainId];
                    if (!stateView)
                        return [2 /*return*/, null];
                    poolId = computePoolId(poolKey);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    slot0Data = stateViewInterface.encodeFunctionData('getSlot0', [poolId]);
                    liquidityData = stateViewInterface.encodeFunctionData('getLiquidity', [poolId]);
                    return [4 /*yield*/, Promise.all([
                            callRpc(chainId, 'eth_call', [{
                                    to: stateView,
                                    data: slot0Data
                                }, 'latest'], options),
                            callRpc(chainId, 'eth_call', [{
                                    to: stateView,
                                    data: liquidityData
                                }, 'latest'], options)
                        ])];
                case 2:
                    _a = _b.sent(), slot0Result = _a[0], liquidityResult = _a[1];
                    if (!slot0Result || slot0Result === '0x' || slot0Result.length < 66) {
                        return [2 /*return*/, null];
                    }
                    slot0 = stateViewInterface.decodeFunctionResult('getSlot0', slot0Result);
                    sqrtPriceX96 = slot0[0];
                    // sqrtPriceX96 = 0 表示池子未初始化
                    if (sqrtPriceX96 === BigInt(0)) {
                        return [2 /*return*/, null];
                    }
                    tick = Number(slot0[1]);
                    protocolFee = Number(slot0[2]);
                    lpFee = Number(slot0[3]);
                    liquidity = liquidityResult && liquidityResult !== '0x'
                        ? BigInt(liquidityResult)
                        : BigInt(0);
                    return [2 /*return*/, {
                            poolId: poolId,
                            poolKey: poolKey,
                            sqrtPriceX96: sqrtPriceX96.toString(),
                            tick: tick,
                            liquidity: liquidity.toString(),
                            protocolFee: protocolFee,
                            lpFee: lpFee
                        }];
                case 3:
                    err_1 = _b.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 查找 V4 池子 (纯链上)
 * [Logic]: 遍历常见配置计算 PoolId 并验证
 */
function findV4Pools(tokenA, tokenB, chainId, options) {
    return __awaiter(this, void 0, void 0, function () {
        var configs, profile, discoveryMode, cacheKey, cached, inflight, _a, currency0, currency1, poolKeys, _i, configs_2, config, _b, _c, hooks, promise;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    configs = V4_CONFIGS[chainId];
                    if (!configs)
                        return [2 /*return*/, []];
                    profile = (0, profile_js_1.resolveRpcCallProfile)(options === null || options === void 0 ? void 0 : options.profile, {
                        purpose: 'interactive_read',
                        strategy: (options === null || options === void 0 ? void 0 : options.strategy) || 'cheap',
                        importance: (options === null || options === void 0 ? void 0 : options.strategy) === 'fast' ? 'critical' : 'normal'
                    });
                    discoveryMode = profile.strategy === 'fast' ? 'fast' : 'full';
                    cacheKey = "".concat(chainId, ":").concat(tokenA.toLowerCase(), ":").concat(tokenB.toLowerCase(), ":").concat(discoveryMode);
                    cached = v4PoolCache.get(cacheKey);
                    if (cached && Date.now() - cached.timestamp < V4_POOL_CACHE_TTL) {
                        return [2 /*return*/, cached.pools];
                    }
                    inflight = v4PoolInflight.get(cacheKey);
                    if (!inflight) return [3 /*break*/, 2];
                    return [4 /*yield*/, inflight];
                case 1: return [2 /*return*/, _d.sent()];
                case 2:
                    _a = BigInt(tokenA) < BigInt(tokenB)
                        ? [tokenA, tokenB]
                        : [tokenB, tokenA], currency0 = _a[0], currency1 = _a[1];
                    poolKeys = [];
                    for (_i = 0, configs_2 = configs; _i < configs_2.length; _i++) {
                        config = configs_2[_i];
                        for (_b = 0, _c = config.hooks; _b < _c.length; _b++) {
                            hooks = _c[_b];
                            poolKeys.push({
                                currency0: currency0,
                                currency1: currency1,
                                fee: config.fee,
                                tickSpacing: config.tickSpacing,
                                hooks: hooks
                            });
                        }
                    }
                    promise = (function () { return __awaiter(_this, void 0, void 0, function () {
                        var isFastStrategy, shouldKeepPool, collect, pools, dynamic200Hooks, dynamic200Keys, dynamicHits, dynamicPools, sorted, startedAt, batchSize, i, batch, batchResults, hit, results;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    isFastStrategy = profile.strategy === 'fast';
                                    shouldKeepPool = function (pool) {
                                        if (!pool)
                                            return false;
                                        if (BigInt(pool.liquidity) > 0n)
                                            return true;
                                        if (chainId !== 8453)
                                            return false;
                                        var family = (0, v4Hooks_js_1.resolveV4HookProfile)(chainId, pool.poolKey.hooks).family;
                                        return BASE_V4_ZERO_LIQ_HOOK_FAMILIES.has(family);
                                    };
                                    collect = function (items) {
                                        var deduped = new Map();
                                        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
                                            var pool = items_1[_i];
                                            if (!shouldKeepPool(pool))
                                                continue;
                                            deduped.set(pool.poolId.toLowerCase(), pool);
                                        }
                                        return Array.from(deduped.values());
                                    };
                                    pools = [];
                                    if (!(isFastStrategy && chainId === 8453)) return [3 /*break*/, 2];
                                    dynamic200Hooks = Array.from(new Set(KNOWN_DYNAMIC_FEE_HOOKS_BASE.map(function (h) { return h.toLowerCase(); })));
                                    dynamic200Keys = dynamic200Hooks.map(function (hooks) { return ({
                                        currency0: currency0,
                                        currency1: currency1,
                                        fee: DYNAMIC_FEE_FLAG,
                                        tickSpacing: 200,
                                        hooks: hooks
                                    }); });
                                    if (!(dynamic200Keys.length > 0)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, Promise.all(dynamic200Keys.map(function (poolKey) { return getV4PoolInfo(poolKey, chainId, options).catch(function () { return null; }); }))];
                                case 1:
                                    dynamicHits = _a.sent();
                                    dynamicPools = collect(dynamicHits);
                                    if (dynamicPools.length > 0) {
                                        pools = dynamicPools;
                                    }
                                    _a.label = 2;
                                case 2:
                                    if (!(isFastStrategy && chainId === 8453 && pools.length === 0)) return [3 /*break*/, 6];
                                    sorted = __spreadArray([], poolKeys, true).sort(function (a, b) {
                                        var byScore = baseFastPriorityScore(a) - baseFastPriorityScore(b);
                                        if (byScore !== 0)
                                            return byScore;
                                        var aZeroHook = a.hooks === '0x0000000000000000000000000000000000000000' ? 1 : 0;
                                        var bZeroHook = b.hooks === '0x0000000000000000000000000000000000000000' ? 1 : 0;
                                        return aZeroHook - bZeroHook;
                                    });
                                    startedAt = Date.now();
                                    batchSize = Math.max(4, V4_FAST_DISCOVERY_BATCH_SIZE);
                                    i = 0;
                                    _a.label = 3;
                                case 3:
                                    if (!(i < sorted.length)) return [3 /*break*/, 6];
                                    if (Date.now() - startedAt >= V4_FAST_DISCOVERY_WINDOW_MS)
                                        return [3 /*break*/, 6];
                                    batch = sorted.slice(i, i + batchSize);
                                    return [4 /*yield*/, Promise.all(batch.map(function (poolKey) { return getV4PoolInfo(poolKey, chainId, options).catch(function () { return null; }); }))];
                                case 4:
                                    batchResults = _a.sent();
                                    hit = collect(batchResults);
                                    if (hit.length > 0) {
                                        pools = hit;
                                        return [3 /*break*/, 6];
                                    }
                                    _a.label = 5;
                                case 5:
                                    i += batchSize;
                                    return [3 /*break*/, 3];
                                case 6:
                                    if (!(pools.length === 0)) return [3 /*break*/, 8];
                                    return [4 /*yield*/, Promise.all(poolKeys.map(function (poolKey) { return getV4PoolInfo(poolKey, chainId, options).catch(function () { return null; }); }))];
                                case 7:
                                    results = _a.sent();
                                    pools = collect(results);
                                    _a.label = 8;
                                case 8:
                                    v4PoolCache.set(cacheKey, { pools: pools, timestamp: Date.now() });
                                    return [2 /*return*/, pools];
                            }
                        });
                    }); })();
                    v4PoolInflight.set(cacheKey, promise);
                    _d.label = 3;
                case 3:
                    _d.trys.push([3, , 5, 6]);
                    return [4 /*yield*/, promise];
                case 4: return [2 /*return*/, _d.sent()];
                case 5:
                    v4PoolInflight.delete(cacheKey);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * 计算价格
 */
function calculatePriceFromSqrtX96(sqrtPriceX96, decimals0, decimals1) {
    var Q96 = Math.pow(BigInt(2), BigInt(96));
    var sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    var priceRaw = sqrtPrice * sqrtPrice;
    var decimalAdjustment = Math.pow(10, (decimals0 - decimals1));
    return priceRaw * decimalAdjustment;
}
/**
 * 检查 V4 支持
 */
function isV4Supported(chainId) {
    return chainId in exports.V4_STATE_VIEW;
}
