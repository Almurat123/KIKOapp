"use strict";
/**
 * On-Chain Price Service (RPC Fallback)
 * Fetches price, liquidity, and market cap directly from chain via RPC
 * Used when DexScreener/GeckoTerminal APIs fail
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
exports.getOnChainPrice = getOnChainPrice;
exports.getCachedNativeTokenPriceUsd = getCachedNativeTokenPriceUsd;
exports.preloadNativeTokenPrices = preloadNativeTokenPrices;
exports.startNativePriceRefresh = startNativePriceRefresh;
exports.getNativeTokenPriceUsd = getNativeTokenPriceUsd;
var rpcManager_js_1 = require("./rpcManager.js");
var viem_1 = require("viem");
var chainConfig_js_1 = require("../config/chainConfig.js");
var tokenRegistry_js_1 = require("../config/tokenRegistry.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var cacheClient_js_1 = require("../cache/cacheClient.js");
var ethers_1 = require("ethers");
var uniswapV4_js_1 = require("./dex/uniswapV4.js");
var onChainCandidateSelector_js_1 = require("./pricing/onChainCandidateSelector.js");
var DataCacheHub_js_1 = require("../cache/DataCacheHub.js");
// Uniswap V2 Factory ABI (minimal)
var FACTORY_V2_ABI = (0, viem_1.parseAbi)([
    'function getPair(address tokenA, address tokenB) view returns (address pair)'
]);
// Uniswap V3 Factory ABI (minimal)
var FACTORY_V3_ABI = (0, viem_1.parseAbi)([
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
]);
// Uniswap V2 Pair ABI (minimal)
var PAIR_V2_ABI = (0, viem_1.parseAbi)([
    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function totalSupply() view returns (uint256)'
]);
// ⚡ V2 Router ABI - For getAmountsOut price quotes (SushiSwap, PancakeSwap V2, etc.)
var ROUTER_V2_ABI = (0, viem_1.parseAbi)([
    'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
]);
// V2 Router ethers interface for encoding
var routerV2Interface = new ethers_1.ethers.Interface([
    'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)'
]);
// ⚡ Aerodrome/Velodrome Router ABI - Uses Route struct instead of address array
// Route struct: { from: address, to: address, stable: bool, factory: address }
var AERODROME_ROUTER_ABI = [
    'function getAmountsOut(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint256[] amounts)'
];
// Aerodrome Router ethers interface
var aerodromeRouterInterface = new ethers_1.ethers.Interface(AERODROME_ROUTER_ABI);
// Aerodrome Pool Factory address (for Route struct)
var AERODROME_FACTORY = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da';
// ⚡ DEX Router addresses by chain - For direct getAmountsOut price quotes
// Priority order: Most likely to have liquidity first
// type: 'aerodrome' = uses Route struct, 'v2' = uses address[] path
var DEX_ROUTERS = {
    8453: [
        { name: 'Aerodrome', address: '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43', type: 'aerodrome' },
        { name: 'SushiSwap', address: '0x804b526e5bf4349819fe2db65349d0825870f8ee', type: 'v2' },
    ],
    1: [
        { name: 'SushiSwap', address: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', type: 'v2' },
    ],
    42161: [
        { name: 'Camelot', address: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d', type: 'v2' },
        { name: 'SushiSwap', address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', type: 'v2' },
    ],
    56: [
        { name: 'PancakeSwap V2', address: '0x10ED43C718714eb63d5aA57B78B54704E256024E', type: 'v2' },
    ],
    137: [
        { name: 'QuickSwap', address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', type: 'v2' },
        { name: 'SushiSwap', address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', type: 'v2' },
    ],
};
// Uniswap V3 Pool ABI (minimal)
var POOL_V3_ABI = (0, viem_1.parseAbi)([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function liquidity() view returns (uint128)',
    'function fee() view returns (uint24)'
]);
// ERC20 ABI (minimal)
var ERC20_ABI = (0, viem_1.parseAbi)([
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)'
]);
// Multicall3 deployed at same address on all EVM chains
var MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
// Ethers interfaces for Multicall3
var multicall3Interface = new ethers_1.ethers.Interface([
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])'
]);
var factoryV3Interface = new ethers_1.ethers.Interface([
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
]);
var poolV3Interface = new ethers_1.ethers.Interface([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)'
]);
var erc20Interface = new ethers_1.ethers.Interface([
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
]);
// ⚡ QuoterV2 - Single RPC call for price quote!
var quoterV2Interface = new ethers_1.ethers.Interface([
    'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);
// QuoterV2 addresses per chain (V3)
var QUOTER_V2_ADDRESSES = {
    1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Ethereum
    8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // Base
    42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Arbitrum
    10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Optimism
    137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Polygon
    56: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997', // BSC (PancakeSwap V3 Quoter)
};
// ⚡ Uniswap V4 Quoter - Latest version with Hooks support!
// [Ref]: https://docs.uniswap.org/contracts/v4/overview
var quoterV4Interface = new ethers_1.ethers.Interface([
    // QuoteExactInputSingleParams: { poolKey, zeroForOne, exactAmount, hookData }
    // PoolKey: { currency0, currency1, fee, tickSpacing, hooks }
    'function quoteExactInputSingle((' +
        '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey,' +
        'bool zeroForOne,' +
        'uint128 exactAmount,' +
        'bytes hookData' +
        ') params) external returns (uint256 amountOut, uint256 gasEstimate)'
]);
// V4 Quoter addresses per chain (deployed 2025-01-30)
var QUOTER_V4_ADDRESSES = {
    1: '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203', // Ethereum
    8453: '0x0d5e0f971ed27fbff6c2837bf31316121532048d', // Base
};
var V4_POOL_MANAGER_ADDRESSES = {
    1: '0x000000000004444c5dc75cB358380D2e3dE08A90', // Ethereum
    8453: '0x498581ff718922c3f8e6a244956af099b2652b2b', // Base
};
var V4_INIT_EVENT = ethers_1.ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
var ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
var NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
var V4_PAIR_CACHE_TTL_MS = 5 * 60 * 1000;
var v4PairCache = new Map();
var V4_INIT_FROM_BLOCKS = {
    1: '0x14af009', // Ethereum v4 PoolManager deployment block (21688329)
    8453: '0x27b6a9f', // Base v4 PoolManager deployment block (41642655)
};
// Common V4 fee tiers and tick spacings
var V4_POOL_CONFIGS = [
    { fee: 500, tickSpacing: 10 }, // 0.05%
    { fee: 3000, tickSpacing: 60 }, // 0.3%
    { fee: 10000, tickSpacing: 200 }, // 1%
];
var priceCache = new Map();
var priceInflight = new Map();
var PRICE_CACHE_TTL = 5000; // 5 second cache
function onChainPriceRedisKey(cacheKey) {
    return "onchain:price:".concat(cacheKey);
}
var FAST_RPC_RACE = Number(process.env.FAST_RPC_RACE || 1);
function resolveRpcCallProfile(rpcStrategy) {
    if (typeof rpcStrategy === 'string') {
        return {
            strategy: rpcStrategy,
            purpose: 'interactive_read',
            importance: rpcStrategy === 'fast' ? 'critical' : 'normal'
        };
    }
    return {
        strategy: rpcStrategy.strategy,
        purpose: rpcStrategy.purpose || 'interactive_read',
        importance: rpcStrategy.importance || (rpcStrategy.strategy === 'fast' ? 'critical' : 'normal')
    };
}
function callRpcWithStrategy(chainId, method, params, rpcStrategy) {
    return __awaiter(this, void 0, void 0, function () {
        var profile, candidates, attempts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    profile = resolveRpcCallProfile(rpcStrategy);
                    if (!(profile.strategy === 'fast' && FAST_RPC_RACE > 1)) return [3 /*break*/, 2];
                    candidates = ['fast', 'cheap'];
                    attempts = candidates.slice(0, FAST_RPC_RACE).map(function (strategy) {
                        return (0, rpcManager_js_1.callRpc)(chainId, method, params, {
                            strategy: strategy,
                            purpose: profile.purpose,
                            importance: profile.importance
                        });
                    });
                    return [4 /*yield*/, Promise.any(attempts)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2: return [2 /*return*/, (0, rpcManager_js_1.callRpc)(chainId, method, params, profile)];
            }
        });
    });
}
function normalizeCurrency(address) {
    var lower = address.toLowerCase();
    return lower === ZERO_ADDRESS ? NATIVE_PLACEHOLDER : lower;
}
function isNativeEquivalent(address, wrappedNative) {
    var lower = address.toLowerCase();
    return lower === NATIVE_PLACEHOLDER || lower === wrappedNative.toLowerCase();
}
function getV4PoolManager(chainId) {
    var envKey = "V4_POOL_MANAGER_".concat(chainId);
    var envVal = process.env[envKey];
    return envVal || V4_POOL_MANAGER_ADDRESSES[chainId] || null;
}
// NOTE: V4 pool discovery now uses official PoolId computation in uniswapV4.ts
// Known DEX Factory addresses by chain (2026 Official Deployments)
var DEX_FACTORIES = {
    1: [
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' },
        { name: 'Sushiswap', address: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', version: 'v2' }
    ],
    8453: [
        { name: 'Aerodrome', address: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da', version: 'v2' }, // Aerodrome main DEX on Base (highest liquidity)
        { name: 'Uniswap V3', address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', version: 'v3' }, // Clanker/Zora tokens
        { name: 'BaseSwap', address: '0xFDa619b6d20975be80A10332dD6a09952FB6EFA0', version: 'v2' }
    ],
    56: [
        { name: 'FourMeme', address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b', version: 'bonding' }, // FourMeme launchpad
        { name: 'Uniswap V3', address: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7', version: 'v3' },
        { name: 'PancakeSwap V3', address: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', version: 'v3' },
        { name: 'PancakeSwap V2', address: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', version: 'v2' },
        { name: 'BiSwap', address: '0x858E3312ed3A876947EA49d572A7C42DE08af7EE', version: 'v2' }
    ],
    42161: [
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' },
        { name: 'Sushiswap', address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', version: 'v2' }
    ],
    10: [
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' }
    ],
    137: [
        { name: 'Uniswap V3', address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', version: 'v3' },
        { name: 'Quickswap', address: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', version: 'v2' },
        { name: 'Sushiswap', address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', version: 'v2' }
    ]
};
function buildStableQuoteTokens(chainId) {
    var _a, _b;
    var quotes = [];
    var usdc = (_a = tokenRegistry_js_1.TOKEN_REGISTRY.USDC) === null || _a === void 0 ? void 0 : _a.addresses[chainId];
    if (usdc) {
        quotes.push({
            address: usdc,
            symbol: 'USDC',
            decimals: (0, tokenRegistry_js_1.getTokenDecimalsFromRegistry)(usdc, chainId) || 6,
            usdPrice: 1,
            isStable: true
        });
    }
    var usdt = (_b = tokenRegistry_js_1.TOKEN_REGISTRY.USDT) === null || _b === void 0 ? void 0 : _b.addresses[chainId];
    if (usdt) {
        quotes.push({
            address: usdt,
            symbol: 'USDT',
            decimals: (0, tokenRegistry_js_1.getTokenDecimalsFromRegistry)(usdt, chainId) || 6,
            usdPrice: 1,
            isStable: true
        });
    }
    return quotes;
}
function buildNativeQuoteToken(chainId_1) {
    return __awaiter(this, arguments, void 0, function (chainId, blockTag) {
        var chainConfig, wrappedNative, nativePrice;
        if (blockTag === void 0) { blockTag = 'latest'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainConfig = (0, chainConfig_js_1.getChainConfig)(chainId);
                    wrappedNative = chainConfig.wrappedNativeAddress;
                    return [4 /*yield*/, getNativeTokenPriceUsd(chainId, blockTag)];
                case 1:
                    nativePrice = _a.sent();
                    if (!nativePrice || nativePrice <= 0)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            address: wrappedNative,
                            symbol: chainConfig.nativeCurrency.symbol || 'NATIVE',
                            decimals: 18,
                            usdPrice: nativePrice,
                            isStable: false
                        }];
            }
        });
    });
}
function buildNativeQuoteTokenFast(chainId_1) {
    return __awaiter(this, arguments, void 0, function (chainId, blockTag) {
        var chainConfig, wrappedNative, nativePrice;
        if (blockTag === void 0) { blockTag = 'latest'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainConfig = (0, chainConfig_js_1.getChainConfig)(chainId);
                    wrappedNative = chainConfig.wrappedNativeAddress;
                    nativePrice = 0;
                    if (!(blockTag === 'latest')) return [3 /*break*/, 2];
                    return [4 /*yield*/, getCachedNativeTokenPriceUsd(chainId).catch(function () { return 0; })];
                case 1:
                    nativePrice = _a.sent();
                    _a.label = 2;
                case 2:
                    if (!nativePrice || nativePrice <= 0)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            address: wrappedNative,
                            symbol: chainConfig.nativeCurrency.symbol || 'NATIVE',
                            decimals: 18,
                            usdPrice: nativePrice,
                            isStable: false
                        }];
            }
        });
    });
}
function buildQuoteAttempts(chainId, lightweight, stableQuotes, nativeQuote) {
    if (!lightweight) {
        var quotes_1 = __spreadArray([], stableQuotes, true);
        if (nativeQuote)
            quotes_1.push(nativeQuote);
        return quotes_1;
    }
    // ETH hot path: prioritize the most liquid, most quoted routes only.
    if (chainId === 1) {
        var preferredStable = stableQuotes.find(function (q) { return q.symbol === 'USDC'; })
            || stableQuotes.find(function (q) { return q.symbol === 'USDT'; })
            || stableQuotes[0]
            || null;
        var quotes_2 = [];
        if (preferredStable)
            quotes_2.push(preferredStable);
        return quotes_2;
    }
    var quotes = stableQuotes.slice(0, 1);
    if (nativeQuote)
        quotes.push(nativeQuote);
    return quotes;
}
function filterFactoriesForFastPath(chainId, factories, lightweight) {
    if (!lightweight)
        return factories;
    if (chainId === 1) {
        return factories.filter(function (factory) {
            var lower = factory.name.toLowerCase();
            return lower.includes('uniswap') && factory.version === 'v3';
        }).slice(0, 1);
    }
    return factories.slice(0, 2);
}
function filterRoutersForFastPath(chainId, routers, lightweight) {
    if (!lightweight)
        return routers;
    if (chainId === 1) {
        // ETH hot path should not pay Sushi router latency unless caller chooses
        // the heavier non-lightweight path.
        return [];
    }
    return routers.slice(0, 1);
}
function raceOrNull(promise, timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.race([
                        promise,
                        new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, timeoutMs); }),
                    ])];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Fetch token price and liquidity directly from chain
 * Falls back to multiple DEXes if first fails
 * ⚡ OPTIMIZED: Cache + Multicall for sub-100ms queries
 */
function getOnChainPrice(tokenAddress_1, chainId_1) {
    return __awaiter(this, arguments, void 0, function (tokenAddress, chainId, options) {
        var rpcStrategy, blockTag, lightweight, startedAt, isLatestTag, chainConfig, wrappedNative, tokenLower, ethLightweightFastPath, nativePriceUsd, cacheKey, inflightKey, cached, redisCached, parsed, sharedSnapshot, existingInflight, task;
        var _this = this;
        var _a;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    rpcStrategy = options.rpcStrategy || 'cheap';
                    blockTag = (_a = options.blockTag) !== null && _a !== void 0 ? _a : 'latest';
                    lightweight = Boolean(options.lightweight);
                    startedAt = Date.now();
                    isLatestTag = blockTag === 'latest';
                    chainConfig = (0, chainConfig_js_1.getChainConfig)(chainId);
                    wrappedNative = chainConfig.wrappedNativeAddress;
                    tokenLower = tokenAddress.toLowerCase();
                    ethLightweightFastPath = lightweight && chainId === 1;
                    if (!(tokenLower === NATIVE_PLACEHOLDER || tokenLower === wrappedNative.toLowerCase())) return [3 /*break*/, 2];
                    return [4 /*yield*/, getNativeTokenPriceUsd(chainId, blockTag)];
                case 1:
                    nativePriceUsd = _b.sent();
                    if (nativePriceUsd && nativePriceUsd > 0) {
                        return [2 /*return*/, {
                                price: nativePriceUsd,
                                marketCap: 0,
                                pairAddress: '',
                                dexName: 'Native Price Cache'
                            }];
                    }
                    _b.label = 2;
                case 2:
                    cacheKey = "".concat(chainId, ":").concat(tokenAddress.toLowerCase());
                    inflightKey = "".concat(cacheKey, ":").concat(JSON.stringify(rpcStrategy), ":").concat(String(blockTag), ":").concat(lightweight ? 'light' : 'full');
                    if (!isLatestTag) return [3 /*break*/, 4];
                    cached = priceCache.get(cacheKey);
                    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
                        return [2 /*return*/, {
                                price: cached.price,
                                marketCap: cached.marketCap,
                                pairAddress: '',
                                dexName: "".concat(cached.dexName, " (cached)")
                            }];
                    }
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(onChainPriceRedisKey(cacheKey)).catch(function () { return null; })];
                case 3:
                    redisCached = _b.sent();
                    if (redisCached) {
                        try {
                            parsed = JSON.parse(redisCached);
                            if (parsed && Date.now() - parsed.timestamp < PRICE_CACHE_TTL) {
                                priceCache.set(cacheKey, parsed);
                                return [2 /*return*/, {
                                        price: parsed.price,
                                        marketCap: parsed.marketCap,
                                        pairAddress: '',
                                        dexName: "".concat(parsed.dexName, " (cached)")
                                    }];
                            }
                        }
                        catch (_c) {
                            // ignore parse errors
                        }
                    }
                    sharedSnapshot = DataCacheHub_js_1.cacheHub.getTokenPriceSnapshot(tokenAddress, chainId);
                    if (sharedSnapshot) {
                        priceCache.set(cacheKey, {
                            price: sharedSnapshot.price,
                            marketCap: 0,
                            timestamp: Date.now(),
                            dexName: sharedSnapshot.provider,
                        });
                        return [2 /*return*/, {
                                price: sharedSnapshot.price,
                                marketCap: 0,
                                pairAddress: '',
                                dexName: "".concat(sharedSnapshot.provider, " (shared)")
                            }];
                    }
                    _b.label = 4;
                case 4:
                    existingInflight = priceInflight.get(inflightKey);
                    if (existingInflight) {
                        return [2 /*return*/, existingInflight];
                    }
                    task = (function () { return __awaiter(_this, void 0, void 0, function () {
                        var factories, routers, stableQuotes, nativeQuote, _a, quoteAttempts, factoriesToTry, routersToTry, lightweightDeadlineMs, stageTimeoutMs, successfulCandidates, _loop_1, _i, quoteAttempts_1, quote, state_1, selectedCandidate, data;
                        var _this = this;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    factories = DEX_FACTORIES[chainId] || [];
                                    routers = DEX_ROUTERS[chainId] || [];
                                    if (factories.length === 0 && routers.length === 0) {
                                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'No DEX factories/routers configured for chain', { chainId: chainId });
                                        return [2 /*return*/, null];
                                    }
                                    stableQuotes = buildStableQuoteTokens(chainId);
                                    if (!ethLightweightFastPath) return [3 /*break*/, 2];
                                    return [4 /*yield*/, buildNativeQuoteTokenFast(chainId, blockTag)];
                                case 1:
                                    _a = _b.sent();
                                    return [3 /*break*/, 4];
                                case 2: return [4 /*yield*/, buildNativeQuoteToken(chainId, blockTag)];
                                case 3:
                                    _a = _b.sent();
                                    _b.label = 4;
                                case 4:
                                    nativeQuote = _a;
                                    quoteAttempts = buildQuoteAttempts(chainId, lightweight, stableQuotes, nativeQuote);
                                    factoriesToTry = filterFactoriesForFastPath(chainId, factories, lightweight);
                                    routersToTry = filterRoutersForFastPath(chainId, routers, lightweight);
                                    lightweightDeadlineMs = chainId === 1 ? 1200 : 1800;
                                    stageTimeoutMs = chainId === 1 ? 300 : 700;
                                    successfulCandidates = [];
                                    _loop_1 = function (quote) {
                                        var v4Result, _c, _d, v4PoolResult, _e, _f, fetchPromises, results, _g, results_1, result, data, lowerFactory, _h, routersToTry_1, router, routerData, err_1;
                                        return __generator(this, function (_j) {
                                            switch (_j.label) {
                                                case 0:
                                                    if (quote.address.toLowerCase() === tokenLower)
                                                        return [2 /*return*/, "continue"];
                                                    if (lightweight && Date.now() - startedAt >= lightweightDeadlineMs)
                                                        return [2 /*return*/, "break"];
                                                    if (!QUOTER_V4_ADDRESSES[chainId]) return [3 /*break*/, 7];
                                                    _j.label = 1;
                                                case 1:
                                                    _j.trys.push([1, 6, , 7]);
                                                    if (!lightweight) return [3 /*break*/, 3];
                                                    return [4 /*yield*/, raceOrNull(fetchPriceFromUniswapV4(tokenAddress, quote, chainId, rpcStrategy, blockTag), stageTimeoutMs)];
                                                case 2:
                                                    _c = _j.sent();
                                                    return [3 /*break*/, 5];
                                                case 3: return [4 /*yield*/, fetchPriceFromUniswapV4(tokenAddress, quote, chainId, rpcStrategy, blockTag)];
                                                case 4:
                                                    _c = _j.sent();
                                                    _j.label = 5;
                                                case 5:
                                                    v4Result = _c;
                                                    if (v4Result && v4Result.price > 0) {
                                                        successfulCandidates.push({
                                                            data: v4Result,
                                                            sourceKind: 'factory',
                                                            version: 'v4',
                                                            quoteSymbol: quote.symbol,
                                                            quoteIsStable: quote.isStable
                                                        });
                                                    }
                                                    return [3 /*break*/, 7];
                                                case 6:
                                                    _d = _j.sent();
                                                    return [3 /*break*/, 7];
                                                case 7:
                                                    if (!(uniswapV4_js_1.V4_STATE_VIEW[chainId] && !(lightweight && chainId === 1))) return [3 /*break*/, 14];
                                                    _j.label = 8;
                                                case 8:
                                                    _j.trys.push([8, 13, , 14]);
                                                    if (!lightweight) return [3 /*break*/, 10];
                                                    return [4 /*yield*/, raceOrNull(fetchPriceFromUniswapV4PoolId(tokenAddress, quote, chainId, rpcStrategy, blockTag), stageTimeoutMs)];
                                                case 9:
                                                    _e = _j.sent();
                                                    return [3 /*break*/, 12];
                                                case 10: return [4 /*yield*/, fetchPriceFromUniswapV4PoolId(tokenAddress, quote, chainId, rpcStrategy, blockTag)];
                                                case 11:
                                                    _e = _j.sent();
                                                    _j.label = 12;
                                                case 12:
                                                    v4PoolResult = _e;
                                                    if (v4PoolResult && v4PoolResult.price > 0) {
                                                        successfulCandidates.push({
                                                            data: v4PoolResult,
                                                            sourceKind: 'factory',
                                                            version: 'v4-pool',
                                                            quoteSymbol: quote.symbol,
                                                            quoteIsStable: quote.isStable
                                                        });
                                                    }
                                                    return [3 /*break*/, 14];
                                                case 13:
                                                    _f = _j.sent();
                                                    return [3 /*break*/, 14];
                                                case 14:
                                                    fetchPromises = factoriesToTry.map(function (factory) { return __awaiter(_this, void 0, void 0, function () {
                                                        var priceData, _a, _b, _c, err_2;
                                                        return __generator(this, function (_d) {
                                                            switch (_d.label) {
                                                                case 0:
                                                                    _d.trys.push([0, 16, , 17]);
                                                                    priceData = null;
                                                                    if (!(factory.version === 'v3')) return [3 /*break*/, 5];
                                                                    if (!lightweight) return [3 /*break*/, 2];
                                                                    return [4 /*yield*/, raceOrNull(fetchPriceFromUniswapV3(tokenAddress, quote, factory.address, factory.name, chainId, rpcStrategy, blockTag), stageTimeoutMs)];
                                                                case 1:
                                                                    _a = _d.sent();
                                                                    return [3 /*break*/, 4];
                                                                case 2: return [4 /*yield*/, fetchPriceFromUniswapV3(tokenAddress, quote, factory.address, factory.name, chainId, rpcStrategy, blockTag)];
                                                                case 3:
                                                                    _a = _d.sent();
                                                                    _d.label = 4;
                                                                case 4:
                                                                    priceData = _a;
                                                                    return [3 /*break*/, 15];
                                                                case 5:
                                                                    if (!(factory.version === 'bonding')) return [3 /*break*/, 10];
                                                                    if (!lightweight) return [3 /*break*/, 7];
                                                                    return [4 /*yield*/, raceOrNull(fetchPriceFromBondingCurve(tokenAddress, factory.address, factory.name, chainId, rpcStrategy, blockTag), stageTimeoutMs)];
                                                                case 6:
                                                                    _b = _d.sent();
                                                                    return [3 /*break*/, 9];
                                                                case 7: return [4 /*yield*/, fetchPriceFromBondingCurve(tokenAddress, factory.address, factory.name, chainId, rpcStrategy, blockTag)];
                                                                case 8:
                                                                    _b = _d.sent();
                                                                    _d.label = 9;
                                                                case 9:
                                                                    priceData = _b;
                                                                    return [3 /*break*/, 15];
                                                                case 10:
                                                                    if (!lightweight) return [3 /*break*/, 12];
                                                                    return [4 /*yield*/, raceOrNull(fetchPriceFromDex(tokenAddress, quote, factory.address, factory.name, chainId, rpcStrategy, blockTag), stageTimeoutMs)];
                                                                case 11:
                                                                    _c = _d.sent();
                                                                    return [3 /*break*/, 14];
                                                                case 12: return [4 /*yield*/, fetchPriceFromDex(tokenAddress, quote, factory.address, factory.name, chainId, rpcStrategy, blockTag)];
                                                                case 13:
                                                                    _c = _d.sent();
                                                                    _d.label = 14;
                                                                case 14:
                                                                    priceData = _c;
                                                                    _d.label = 15;
                                                                case 15:
                                                                    if (priceData && priceData.price > 0) {
                                                                        return [2 /*return*/, { success: true, data: priceData, factory: factory.name }];
                                                                    }
                                                                    return [2 /*return*/, { success: false, data: null, factory: factory.name }];
                                                                case 16:
                                                                    err_2 = _d.sent();
                                                                    return [2 /*return*/, { success: false, data: null, factory: factory.name, error: err_2.message }];
                                                                case 17: return [2 /*return*/];
                                                            }
                                                        });
                                                    }); });
                                                    return [4 /*yield*/, Promise.allSettled(fetchPromises)];
                                                case 15:
                                                    results = _j.sent();
                                                    for (_g = 0, results_1 = results; _g < results_1.length; _g++) {
                                                        result = results_1[_g];
                                                        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
                                                            data = result.value.data;
                                                            lowerFactory = String(result.value.factory || '').toLowerCase();
                                                            successfulCandidates.push({
                                                                data: data,
                                                                sourceKind: 'factory',
                                                                version: lowerFactory.includes('bonding')
                                                                    ? 'bonding'
                                                                    : lowerFactory.includes('v3') || lowerFactory.includes('uniswap v3') || lowerFactory.includes('pancakeswap v3')
                                                                        ? 'v3'
                                                                        : 'v2',
                                                                quoteSymbol: quote.symbol,
                                                                quoteIsStable: quote.isStable
                                                            });
                                                        }
                                                    }
                                                    if (lightweight && successfulCandidates.length > 0) {
                                                        return [2 /*return*/, "break"];
                                                    }
                                                    if (lightweight && Date.now() - startedAt >= lightweightDeadlineMs) {
                                                        return [2 /*return*/, "break"];
                                                    }
                                                    _h = 0, routersToTry_1 = routersToTry;
                                                    _j.label = 16;
                                                case 16:
                                                    if (!(_h < routersToTry_1.length)) return [3 /*break*/, 24];
                                                    router = routersToTry_1[_h];
                                                    _j.label = 17;
                                                case 17:
                                                    _j.trys.push([17, 22, , 23]);
                                                    routerData = null;
                                                    if (!(router.type === 'aerodrome')) return [3 /*break*/, 19];
                                                    return [4 /*yield*/, fetchPriceFromAerodrome(tokenAddress, quote, router.address, chainId, rpcStrategy, blockTag)];
                                                case 18:
                                                    routerData = _j.sent();
                                                    return [3 /*break*/, 21];
                                                case 19:
                                                    if (!(router.type === 'v2')) return [3 /*break*/, 21];
                                                    return [4 /*yield*/, fetchPriceFromV2Router(tokenAddress, quote, router.address, router.name, chainId, rpcStrategy, blockTag)];
                                                case 20:
                                                    routerData = _j.sent();
                                                    _j.label = 21;
                                                case 21:
                                                    if (routerData && routerData.price > 0) {
                                                        successfulCandidates.push({
                                                            data: routerData,
                                                            sourceKind: 'router',
                                                            version: router.type === 'aerodrome' ? 'aerodrome' : 'v2',
                                                            quoteSymbol: quote.symbol,
                                                            quoteIsStable: quote.isStable
                                                        });
                                                    }
                                                    return [3 /*break*/, 23];
                                                case 22:
                                                    err_1 = _j.sent();
                                                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, "Router ".concat(router.name, " failed"), { error: err_1.message });
                                                    return [3 /*break*/, 23];
                                                case 23:
                                                    _h++;
                                                    return [3 /*break*/, 16];
                                                case 24:
                                                    if (lightweight && successfulCandidates.length > 0) {
                                                        return [2 /*return*/, "break"];
                                                    }
                                                    return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _i = 0, quoteAttempts_1 = quoteAttempts;
                                    _b.label = 5;
                                case 5:
                                    if (!(_i < quoteAttempts_1.length)) return [3 /*break*/, 8];
                                    quote = quoteAttempts_1[_i];
                                    return [5 /*yield**/, _loop_1(quote)];
                                case 6:
                                    state_1 = _b.sent();
                                    if (state_1 === "break")
                                        return [3 /*break*/, 8];
                                    _b.label = 7;
                                case 7:
                                    _i++;
                                    return [3 /*break*/, 5];
                                case 8:
                                    selectedCandidate = (0, onChainCandidateSelector_js_1.selectBestOnChainPriceCandidate)(successfulCandidates);
                                    if (!selectedCandidate) return [3 /*break*/, 11];
                                    data = selectedCandidate.selected.data;
                                    if (!isLatestTag) return [3 /*break*/, 10];
                                    priceCache.set(cacheKey, {
                                        price: data.price,
                                        marketCap: data.marketCap,
                                        timestamp: Date.now(),
                                        dexName: data.dexName
                                    });
                                    DataCacheHub_js_1.cacheHub.setTokenPriceSnapshot(tokenAddress, chainId, {
                                        price: data.price,
                                        provider: data.dexName,
                                    });
                                    return [4 /*yield*/, (0, cacheClient_js_1.set)(onChainPriceRedisKey(cacheKey), JSON.stringify(priceCache.get(cacheKey)), Math.ceil(PRICE_CACHE_TTL / 1000)).catch(function () { })];
                                case 9:
                                    _b.sent();
                                    _b.label = 10;
                                case 10:
                                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'On-chain price candidate selected', {
                                        token: tokenAddress,
                                        price: data.price,
                                        marketCap: data.marketCap,
                                        dexName: data.dexName,
                                        clusterSize: selectedCandidate.clusterSize,
                                        discardedCandidates: selectedCandidate.discarded.length
                                    });
                                    return [2 /*return*/, data];
                                case 11:
                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'All on-chain DEX queries failed (Factory + Router)', { token: tokenAddress, chainId: chainId });
                                    return [2 /*return*/, null];
                            }
                        });
                    }); })().finally(function () {
                        priceInflight.delete(inflightKey);
                    });
                    priceInflight.set(inflightKey, task);
                    return [2 /*return*/, task];
            }
        });
    });
}
/**
 * Fetch price from a specific DEX factory
 * Note: Only fetches price and market cap. Liquidity is unreliable on-chain and should come from APIs.
 */
function fetchPriceFromDex(tokenAddress, quote, factoryAddress, dexName, chainId, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var pairAddress, _a, reserve0, reserve1, token0, isToken0, tokenReserve, quoteReserve, tokenDecimals, quoteDecimals, tokenReserveFloat, quoteReserveFloat, priceInQuote, priceUsd, marketCap, totalSupply, totalSupplyFloat, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, callEthCall(chainId, factoryAddress, FACTORY_V2_ABI, 'getPair', [tokenAddress, quote.address], rpcStrategy, blockTag)];
                case 1:
                    pairAddress = _c.sent();
                    // Check if pair exists
                    if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
                        return [2 /*return*/, null]; // No pair found
                    }
                    return [4 /*yield*/, callEthCall(chainId, pairAddress, PAIR_V2_ABI, 'getReserves', [], rpcStrategy, blockTag)];
                case 2:
                    _a = _c.sent(), reserve0 = _a[0], reserve1 = _a[1];
                    return [4 /*yield*/, callEthCall(chainId, pairAddress, PAIR_V2_ABI, 'token0', [], rpcStrategy, blockTag)];
                case 3:
                    token0 = _c.sent();
                    isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
                    tokenReserve = isToken0 ? reserve0 : reserve1;
                    quoteReserve = isToken0 ? reserve1 : reserve0;
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'decimals', [], rpcStrategy, blockTag)];
                case 4:
                    tokenDecimals = _c.sent();
                    quoteDecimals = quote.decimals;
                    tokenReserveFloat = Number(tokenReserve) / Math.pow(10, tokenDecimals);
                    quoteReserveFloat = Number(quoteReserve) / Math.pow(10, quoteDecimals);
                    if (tokenReserveFloat === 0) {
                        return [2 /*return*/, null]; // No liquidity
                    }
                    priceInQuote = quoteReserveFloat / tokenReserveFloat;
                    priceUsd = priceInQuote * quote.usdPrice;
                    marketCap = 0;
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'totalSupply', [], rpcStrategy, blockTag)];
                case 6:
                    totalSupply = _c.sent();
                    totalSupplyFloat = Number(totalSupply) / Math.pow(10, tokenDecimals);
                    marketCap = totalSupplyFloat * priceUsd;
                    return [3 /*break*/, 8];
                case 7:
                    _b = _c.sent();
                    marketCap = 0; // Cannot estimate without total supply
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, {
                        price: priceUsd,
                        marketCap: marketCap,
                        pairAddress: pairAddress,
                        dexName: dexName
                    }];
            }
        });
    });
}
/**
 * ⚡ Fetch price from V2 Router using getAmountsOut
 * More reliable than Factory+Pair method for Aerodrome, SushiSwap, etc.
 * [Ref]: V2 Router uses x*y=k formula, getAmountsOut calculates output amount
 */
function fetchPriceFromV2Router(tokenAddress, quote, routerAddress, dexName, chainId, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var amountIn, path, callData, result, decoded, amounts, tokenDecimals, tokenAmountOut, quoteAmountIn, priceInQuote, priceUsd, marketCap, totalSupply, totalSupplyFloat, _a, err_3;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 7, , 8]);
                    amountIn = ethers_1.ethers.parseUnits(quote.isStable ? '10' : '0.01', quote.decimals);
                    path = [quote.address, tokenAddress];
                    callData = routerV2Interface.encodeFunctionData('getAmountsOut', [amountIn, path]);
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{
                                to: routerAddress,
                                data: callData
                            }, blockTag], rpcStrategy)];
                case 1:
                    result = _c.sent();
                    if (!result || result === '0x') {
                        return [2 /*return*/, null]; // No pool or error
                    }
                    decoded = routerV2Interface.decodeFunctionResult('getAmountsOut', result);
                    amounts = decoded[0];
                    if (amounts.length < 2 || amounts[1] === 0n) {
                        return [2 /*return*/, null]; // Invalid result
                    }
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'decimals', [], rpcStrategy, blockTag)];
                case 2:
                    tokenDecimals = _c.sent();
                    tokenAmountOut = Number(amounts[1]) / Math.pow(10, tokenDecimals);
                    quoteAmountIn = quote.isStable ? 10 : 0.01;
                    priceInQuote = quoteAmountIn / tokenAmountOut;
                    priceUsd = priceInQuote * quote.usdPrice;
                    marketCap = 0;
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'totalSupply', [], rpcStrategy, blockTag)];
                case 4:
                    totalSupply = _c.sent();
                    totalSupplyFloat = Number(totalSupply) / Math.pow(10, tokenDecimals);
                    marketCap = totalSupplyFloat * priceUsd;
                    return [3 /*break*/, 6];
                case 5:
                    _a = _c.sent();
                    // [Risk]: totalSupply may fail for some tokens
                    marketCap = 0;
                    return [3 /*break*/, 6];
                case 6:
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "\uD83D\uDD17 ".concat(dexName, " Router price fetched"), {
                        token: tokenAddress,
                        price: priceUsd.toFixed(12),
                        dex: dexName
                    });
                    return [2 /*return*/, {
                            price: priceUsd,
                            marketCap: marketCap,
                            pairAddress: routerAddress, // Use router as reference
                            dexName: dexName
                        }];
                case 7:
                    err_3 = _c.sent();
                    // [Risk]: Call may fail if no liquidity pool exists
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, "".concat(dexName, " Router query failed"), {
                        token: tokenAddress,
                        error: (_b = err_3.message) === null || _b === void 0 ? void 0 : _b.substring(0, 100)
                    });
                    return [2 /*return*/, null];
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * ⚡ Fetch price from Aerodrome Router using Route struct
 * Aerodrome uses a different signature: getAmountsOut(amountIn, Route[] routes)
 * Route = { from, to, stable, factory }
 * [Ref]: https://github.com/aerodrome-finance/contracts - Router.sol
 */
function fetchPriceFromAerodrome(tokenAddress, quote, routerAddress, chainId, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var amountIn, amountInFloat, routes, callData, result, stableCallData, stableResult, decoded_1, decoded, err_4;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 7]);
                    amountIn = ethers_1.ethers.parseUnits(quote.isStable ? '10' : '0.01', quote.decimals);
                    amountInFloat = quote.isStable ? 10 : 0.01;
                    routes = [{
                            from: quote.address,
                            to: tokenAddress,
                            stable: false,
                            factory: AERODROME_FACTORY
                        }];
                    callData = aerodromeRouterInterface.encodeFunctionData('getAmountsOut', [amountIn, routes]);
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{
                                to: routerAddress,
                                data: callData
                            }, blockTag], rpcStrategy)];
                case 1:
                    result = _b.sent();
                    if (!(!result || result === '0x')) return [3 /*break*/, 4];
                    // Try stable pool as fallback
                    routes[0].stable = true;
                    stableCallData = aerodromeRouterInterface.encodeFunctionData('getAmountsOut', [amountIn, routes]);
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{
                                to: routerAddress,
                                data: stableCallData
                            }, blockTag], rpcStrategy)];
                case 2:
                    stableResult = _b.sent();
                    if (!stableResult || stableResult === '0x') {
                        return [2 /*return*/, null];
                    }
                    decoded_1 = aerodromeRouterInterface.decodeFunctionResult('getAmountsOut', stableResult);
                    return [4 /*yield*/, calculatePriceFromAmounts(decoded_1, tokenAddress, chainId, 'Aerodrome (stable)', rpcStrategy, quote, amountInFloat, blockTag)];
                case 3: return [2 /*return*/, _b.sent()];
                case 4:
                    decoded = aerodromeRouterInterface.decodeFunctionResult('getAmountsOut', result);
                    return [4 /*yield*/, calculatePriceFromAmounts(decoded, tokenAddress, chainId, 'Aerodrome', rpcStrategy, quote, amountInFloat, blockTag)];
                case 5: return [2 /*return*/, _b.sent()];
                case 6:
                    err_4 = _b.sent();
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Aerodrome Router query failed', {
                        token: tokenAddress,
                        error: (_a = err_4.message) === null || _a === void 0 ? void 0 : _a.substring(0, 100)
                    });
                    return [2 /*return*/, null];
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Helper: Calculate price from getAmountsOut result
 */
function calculatePriceFromAmounts(decoded, tokenAddress, chainId, dexName, rpcStrategy, quote, quoteAmountIn, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var amounts, tokenDecimals, tokenAmountOut, priceInQuote, priceUsd, marketCap, totalSupply, totalSupplyFloat, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    amounts = decoded[0];
                    if (amounts.length < 2 || amounts[1] === 0n) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'decimals', [], rpcStrategy, blockTag)];
                case 1:
                    tokenDecimals = _b.sent();
                    tokenAmountOut = Number(amounts[1]) / Math.pow(10, tokenDecimals);
                    priceInQuote = quoteAmountIn / tokenAmountOut;
                    priceUsd = priceInQuote * quote.usdPrice;
                    marketCap = 0;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'totalSupply', [], rpcStrategy, blockTag)];
                case 3:
                    totalSupply = _b.sent();
                    totalSupplyFloat = Number(totalSupply) / Math.pow(10, tokenDecimals);
                    marketCap = totalSupplyFloat * priceUsd;
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    marketCap = 0;
                    return [3 /*break*/, 5];
                case 5:
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "\uD83D\uDD17 ".concat(dexName, " price fetched"), {
                        token: tokenAddress,
                        price: priceUsd.toFixed(12)
                    });
                    return [2 /*return*/, {
                            price: priceUsd,
                            marketCap: marketCap,
                            pairAddress: '',
                            dexName: dexName
                        }];
            }
        });
    });
}
/**
 * Get native token price in USD (ETH, BNB, SOL, etc.)
 * ⚡ OPTIMIZED: 10-minute cache + background refresh using Coinbase primary + multi-source fallback
 */
var nativePriceCache = {};
var NATIVE_PRICE_CACHE_TTL = 600000; // 10 minutes cache
var NATIVE_LAST_PRICE_CACHE_TTL_SEC = Number(process.env.NATIVE_LAST_PRICE_CACHE_TTL_SEC || 30 * 24 * 60 * 60); // 30 days
// Native token symbols for Coinbase API
var NATIVE_COINBASE_SYMBOLS = {
    1: 'ETH', // Ethereum
    8453: 'ETH', // Base uses ETH
    56: 'BNB', // BSC
    42161: 'ETH', // Arbitrum uses ETH
    10: 'ETH', // Optimism uses ETH
    137: 'MATIC', // Polygon
    900: 'SOL', // Solana ✅ NEW
};
var NATIVE_COINGECKO_IDS = {
    1: 'ethereum',
    8453: 'ethereum',
    56: 'binancecoin',
    42161: 'ethereum',
    10: 'ethereum',
    137: 'matic-network',
    900: 'solana',
};
function nativeLastPriceRedisKey(chainId) {
    return "native:last_price:".concat(chainId);
}
function persistNativePrice(chainId, price) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!Number.isFinite(price) || price <= 0)
                        return [2 /*return*/];
                    nativePriceCache[chainId] = { price: price, timestamp: Date.now() };
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(nativeLastPriceRedisKey(chainId), String(price), NATIVE_LAST_PRICE_CACHE_TTL_SEC).catch(function () { })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getLastKnownNativePrice(chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var cached, redisVal, n;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cached = nativePriceCache[chainId];
                    if (cached && Number.isFinite(cached.price) && cached.price > 0) {
                        return [2 /*return*/, cached.price];
                    }
                    return [4 /*yield*/, (0, cacheClient_js_1.get)(nativeLastPriceRedisKey(chainId)).catch(function () { return null; })];
                case 1:
                    redisVal = _a.sent();
                    n = Number(redisVal);
                    if (Number.isFinite(n) && n > 0) {
                        nativePriceCache[chainId] = { price: n, timestamp: Date.now() };
                        return [2 /*return*/, n];
                    }
                    return [2 /*return*/, null];
            }
        });
    });
}
/**
 * Read-only native USD price getter for hot paths (trade-card persistence).
 * It never triggers external APIs and only reads memory/redis last-known cache.
 */
function getCachedNativeTokenPriceUsd(chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var price;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getLastKnownNativePrice(chainId)];
                case 1:
                    price = _a.sent();
                    return [2 /*return*/, price && price > 0 ? price : 0];
            }
        });
    });
}
function fetchNativePriceFromCoinbase(symbol) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data, price, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch("https://api.coinbase.com/v2/prices/".concat(symbol, "-USD/spot"), { signal: AbortSignal.timeout(3000) })];
                case 1:
                    response = _c.sent();
                    if (!response.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _c.sent();
                    price = Number.parseFloat((_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b.amount);
                    return [2 /*return*/, Number.isFinite(price) && price > 0 ? price : null];
                case 3:
                    _a = _c.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchNativePriceFromCoinGecko(chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var coinId, demoKey, url, response, data, price, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    coinId = NATIVE_COINGECKO_IDS[chainId] || 'ethereum';
                    demoKey = (_b = process.env.COINGECKO_API_KEY) === null || _b === void 0 ? void 0 : _b.trim();
                    url = "https://api.coingecko.com/api/v3/simple/price?ids=".concat(encodeURIComponent(coinId), "&vs_currencies=usd").concat(demoKey ? "&x_cg_demo_api_key=".concat(encodeURIComponent(demoKey)) : '');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch(url, { signal: AbortSignal.timeout(3000) })];
                case 2:
                    response = _e.sent();
                    if (!response.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _e.sent();
                    price = Number((_d = (_c = data === null || data === void 0 ? void 0 : data[coinId]) === null || _c === void 0 ? void 0 : _c.usd) !== null && _d !== void 0 ? _d : 0);
                    return [2 /*return*/, Number.isFinite(price) && price > 0 ? price : null];
                case 4:
                    _a = _e.sent();
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function fetchNativePriceFromCoinMarketCap(symbol) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, url, response, data, row, quote, price, _a;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    apiKey = (_b = process.env.CMC_PRO_API_KEY) === null || _b === void 0 ? void 0 : _b.trim();
                    if (!apiKey)
                        return [2 /*return*/, null];
                    url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=".concat(encodeURIComponent(symbol), "&convert=USD");
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch(url, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                                'X-CMC_PRO_API_KEY': apiKey
                            },
                            signal: AbortSignal.timeout(3000)
                        })];
                case 2:
                    response = _g.sent();
                    if (!response.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _g.sent();
                    row = (_c = data === null || data === void 0 ? void 0 : data.data) === null || _c === void 0 ? void 0 : _c[symbol];
                    quote = Array.isArray(row) ? (_d = row[0]) === null || _d === void 0 ? void 0 : _d.quote : row === null || row === void 0 ? void 0 : row.quote;
                    price = Number((_f = (_e = quote === null || quote === void 0 ? void 0 : quote.USD) === null || _e === void 0 ? void 0 : _e.price) !== null && _f !== void 0 ? _f : 0);
                    return [2 /*return*/, Number.isFinite(price) && price > 0 ? price : null];
                case 4:
                    _a = _g.sent();
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * ⚡ PRELOAD: Fetch all native token prices at startup using Coinbase API
 * Call this when the server starts to warm the cache
 */
function preloadNativeTokenPrices() {
    return __awaiter(this, void 0, void 0, function () {
        var chainIds, uniqueSymbols, priceResults, priceMap, _i, priceResults_1, result, now, _a, chainIds_1, chainId, symbol, price, lastKnown, error_1, now, _b, chainIds_2, chainId, lastKnown;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, '⚡ Preloading native token prices via Coinbase...');
                    chainIds = Object.keys(NATIVE_COINBASE_SYMBOLS).map(Number);
                    uniqueSymbols = __spreadArray([], new Set(Object.values(NATIVE_COINBASE_SYMBOLS)), true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 9, , 14]);
                    return [4 /*yield*/, Promise.allSettled(uniqueSymbols.map(function (symbol) { return __awaiter(_this, void 0, void 0, function () {
                            var response, data;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch("https://api.coinbase.com/v2/prices/".concat(symbol, "-USD/spot"), { signal: AbortSignal.timeout(5000) })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok)
                                            throw new Error("HTTP ".concat(response.status));
                                        return [4 /*yield*/, response.json()];
                                    case 2:
                                        data = _a.sent();
                                        return [2 /*return*/, { symbol: symbol, price: parseFloat(data.data.amount) }];
                                }
                            });
                        }); }))];
                case 2:
                    priceResults = _c.sent();
                    priceMap = {};
                    for (_i = 0, priceResults_1 = priceResults; _i < priceResults_1.length; _i++) {
                        result = priceResults_1[_i];
                        if (result.status === 'fulfilled' && result.value.price > 0) {
                            priceMap[result.value.symbol] = result.value.price;
                        }
                    }
                    now = Date.now();
                    _a = 0, chainIds_1 = chainIds;
                    _c.label = 3;
                case 3:
                    if (!(_a < chainIds_1.length)) return [3 /*break*/, 8];
                    chainId = chainIds_1[_a];
                    symbol = NATIVE_COINBASE_SYMBOLS[chainId];
                    price = priceMap[symbol];
                    if (!(price && price > 0)) return [3 /*break*/, 5];
                    nativePriceCache[chainId] = { price: price, timestamp: now };
                    return [4 /*yield*/, (0, cacheClient_js_1.set)(nativeLastPriceRedisKey(chainId), String(price), NATIVE_LAST_PRICE_CACHE_TTL_SEC).catch(function () { })];
                case 4:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, getLastKnownNativePrice(chainId)];
                case 6:
                    lastKnown = _c.sent();
                    if (lastKnown) {
                        nativePriceCache[chainId] = { price: lastKnown, timestamp: now };
                    }
                    _c.label = 7;
                case 7:
                    _a++;
                    return [3 /*break*/, 3];
                case 8:
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, '⚡ Native token prices cached (Coinbase)', {
                        eth: priceMap['ETH'],
                        bnb: priceMap['BNB'],
                        sol: priceMap['SOL'],
                        chains: chainIds.length
                    });
                    return [3 /*break*/, 14];
                case 9:
                    error_1 = _c.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Failed to preload native prices, preserving last-known cache', { error: error_1.message });
                    now = Date.now();
                    _b = 0, chainIds_2 = chainIds;
                    _c.label = 10;
                case 10:
                    if (!(_b < chainIds_2.length)) return [3 /*break*/, 13];
                    chainId = chainIds_2[_b];
                    return [4 /*yield*/, getLastKnownNativePrice(chainId)];
                case 11:
                    lastKnown = _c.sent();
                    if (lastKnown) {
                        nativePriceCache[chainId] = { price: lastKnown, timestamp: now };
                    }
                    _c.label = 12;
                case 12:
                    _b++;
                    return [3 /*break*/, 10];
                case 13: return [3 /*break*/, 14];
                case 14: return [2 /*return*/];
            }
        });
    });
}
/**
 * Start background refresh (call once at startup)
 */
function startNativePriceRefresh() {
    // Preload immediately
    preloadNativeTokenPrices();
    // Refresh every 10 minutes
    setInterval(function () {
        preloadNativeTokenPrices();
    }, NATIVE_PRICE_CACHE_TTL);
    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, '⚡ Native price refresh started (10 min interval)');
}
function getNativeTokenPriceUsd(chainId_1) {
    return __awaiter(this, arguments, void 0, function (chainId, blockTag) {
        var cached, chainConfig, wrappedNative, stableQuotes, factories, routers, _i, stableQuotes_1, quote, v4Result, v4PoolResult, _a, factories_1, factory, priceData, _b, routers_1, router, routerData, err_5, symbol, coinbasePrice, coingeckoPrice, cmcPrice, lastKnown;
        if (blockTag === void 0) { blockTag = 'latest'; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    // Check memory cache first (should always hit after preload) - only for 'latest'
                    if (blockTag === 'latest') {
                        cached = nativePriceCache[chainId];
                        if (cached && Date.now() - cached.timestamp < NATIVE_PRICE_CACHE_TTL) {
                            return [2 /*return*/, cached.price];
                        }
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 30, , 31]);
                    chainConfig = (0, chainConfig_js_1.getChainConfig)(chainId);
                    wrappedNative = chainConfig.wrappedNativeAddress;
                    stableQuotes = buildStableQuoteTokens(chainId);
                    factories = DEX_FACTORIES[chainId] || [];
                    routers = DEX_ROUTERS[chainId] || [];
                    _i = 0, stableQuotes_1 = stableQuotes;
                    _c.label = 2;
                case 2:
                    if (!(_i < stableQuotes_1.length)) return [3 /*break*/, 29];
                    quote = stableQuotes_1[_i];
                    if (quote.address.toLowerCase() === wrappedNative.toLowerCase())
                        return [3 /*break*/, 28];
                    if (!QUOTER_V4_ADDRESSES[chainId]) return [3 /*break*/, 6];
                    return [4 /*yield*/, fetchPriceFromUniswapV4(wrappedNative, quote, chainId, 'fast', blockTag)];
                case 3:
                    v4Result = _c.sent();
                    if (!(v4Result === null || v4Result === void 0 ? void 0 : v4Result.price)) return [3 /*break*/, 6];
                    if (!(blockTag === 'latest')) return [3 /*break*/, 5];
                    return [4 /*yield*/, persistNativePrice(chainId, v4Result.price)];
                case 4:
                    _c.sent();
                    _c.label = 5;
                case 5: return [2 /*return*/, v4Result.price];
                case 6:
                    if (!uniswapV4_js_1.V4_STATE_VIEW[chainId]) return [3 /*break*/, 10];
                    return [4 /*yield*/, fetchPriceFromUniswapV4PoolId(wrappedNative, quote, chainId, 'fast', blockTag)];
                case 7:
                    v4PoolResult = _c.sent();
                    if (!(v4PoolResult === null || v4PoolResult === void 0 ? void 0 : v4PoolResult.price)) return [3 /*break*/, 10];
                    if (!(blockTag === 'latest')) return [3 /*break*/, 9];
                    return [4 /*yield*/, persistNativePrice(chainId, v4PoolResult.price)];
                case 8:
                    _c.sent();
                    _c.label = 9;
                case 9: return [2 /*return*/, v4PoolResult.price];
                case 10:
                    _a = 0, factories_1 = factories;
                    _c.label = 11;
                case 11:
                    if (!(_a < factories_1.length)) return [3 /*break*/, 19];
                    factory = factories_1[_a];
                    priceData = null;
                    if (!(factory.version === 'v3')) return [3 /*break*/, 13];
                    return [4 /*yield*/, fetchPriceFromUniswapV3(wrappedNative, quote, factory.address, factory.name, chainId, 'fast', blockTag)];
                case 12:
                    priceData = _c.sent();
                    return [3 /*break*/, 15];
                case 13: return [4 /*yield*/, fetchPriceFromDex(wrappedNative, quote, factory.address, factory.name, chainId, 'fast', blockTag)];
                case 14:
                    priceData = _c.sent();
                    _c.label = 15;
                case 15:
                    if (!(priceData === null || priceData === void 0 ? void 0 : priceData.price)) return [3 /*break*/, 18];
                    if (!(blockTag === 'latest')) return [3 /*break*/, 17];
                    return [4 /*yield*/, persistNativePrice(chainId, priceData.price)];
                case 16:
                    _c.sent();
                    _c.label = 17;
                case 17: return [2 /*return*/, priceData.price];
                case 18:
                    _a++;
                    return [3 /*break*/, 11];
                case 19:
                    _b = 0, routers_1 = routers;
                    _c.label = 20;
                case 20:
                    if (!(_b < routers_1.length)) return [3 /*break*/, 28];
                    router = routers_1[_b];
                    routerData = null;
                    if (!(router.type === 'aerodrome')) return [3 /*break*/, 22];
                    return [4 /*yield*/, fetchPriceFromAerodrome(wrappedNative, quote, router.address, chainId, 'fast', blockTag)];
                case 21:
                    routerData = _c.sent();
                    return [3 /*break*/, 24];
                case 22:
                    if (!(router.type === 'v2')) return [3 /*break*/, 24];
                    return [4 /*yield*/, fetchPriceFromV2Router(wrappedNative, quote, router.address, router.name, chainId, 'fast', blockTag)];
                case 23:
                    routerData = _c.sent();
                    _c.label = 24;
                case 24:
                    if (!(routerData === null || routerData === void 0 ? void 0 : routerData.price)) return [3 /*break*/, 27];
                    if (!(blockTag === 'latest')) return [3 /*break*/, 26];
                    return [4 /*yield*/, persistNativePrice(chainId, routerData.price)];
                case 25:
                    _c.sent();
                    _c.label = 26;
                case 26: return [2 /*return*/, routerData.price];
                case 27:
                    _b++;
                    return [3 /*break*/, 20];
                case 28:
                    _i++;
                    return [3 /*break*/, 2];
                case 29: return [3 /*break*/, 31];
                case 30:
                    err_5 = _c.sent();
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC native price failed', { chainId: chainId, error: err_5.message });
                    return [3 /*break*/, 31];
                case 31:
                    symbol = NATIVE_COINBASE_SYMBOLS[chainId] || 'ETH';
                    if (!(blockTag === 'latest')) return [3 /*break*/, 40];
                    return [4 /*yield*/, fetchNativePriceFromCoinbase(symbol)];
                case 32:
                    coinbasePrice = _c.sent();
                    if (!coinbasePrice) return [3 /*break*/, 34];
                    return [4 /*yield*/, persistNativePrice(chainId, coinbasePrice)];
                case 33:
                    _c.sent();
                    return [2 /*return*/, coinbasePrice];
                case 34: return [4 /*yield*/, fetchNativePriceFromCoinGecko(chainId)];
                case 35:
                    coingeckoPrice = _c.sent();
                    if (!coingeckoPrice) return [3 /*break*/, 37];
                    return [4 /*yield*/, persistNativePrice(chainId, coingeckoPrice)];
                case 36:
                    _c.sent();
                    return [2 /*return*/, coingeckoPrice];
                case 37: return [4 /*yield*/, fetchNativePriceFromCoinMarketCap(symbol)];
                case 38:
                    cmcPrice = _c.sent();
                    if (!cmcPrice) return [3 /*break*/, 40];
                    return [4 /*yield*/, persistNativePrice(chainId, cmcPrice)];
                case 39:
                    _c.sent();
                    return [2 /*return*/, cmcPrice];
                case 40: return [4 /*yield*/, getLastKnownNativePrice(chainId)];
                case 41:
                    lastKnown = _c.sent();
                    if (lastKnown)
                        return [2 /*return*/, lastKnown];
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Native price unavailable: no live source and no last-known cache', { chainId: chainId, blockTag: blockTag });
                    return [2 /*return*/, 0];
            }
        });
    });
}
/**
 * Generic eth_call wrapper with type safety
 */
function callEthCall(chainId_1, to_1, abi_1, functionName_1, args_1, rpcStrategy_1) {
    return __awaiter(this, arguments, void 0, function (chainId, to, abi, functionName, args, rpcStrategy, blockTag) {
        var data, resultHex, decoded;
        if (blockTag === void 0) { blockTag = 'latest'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    data = (0, viem_1.encodeFunctionData)({
                        abi: abi,
                        functionName: functionName,
                        args: args
                    });
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{
                                to: to,
                                data: data
                            }, blockTag], rpcStrategy)];
                case 1:
                    resultHex = _a.sent();
                    decoded = (0, viem_1.decodeFunctionResult)({
                        abi: abi,
                        functionName: functionName,
                        data: resultHex
                    });
                    return [2 /*return*/, decoded];
            }
        });
    });
}
function fetchPriceFromUniswapV4PoolId(tokenAddress, quote, chainId, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var v4DiscoveryProfile, pools, decimalsCache, getDecimals, _i, pools_1, pool, sqrtPriceX96, token0, token1, decimals0, decimals1, priceToken1PerToken0, priceInQuote, priceUsd, marketCap, totalSupply, tokenDecimals, totalSupplyFormatted, _a, _b;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!uniswapV4_js_1.V4_STATE_VIEW[chainId])
                        return [2 /*return*/, null];
                    v4DiscoveryProfile = resolveRpcCallProfile(rpcStrategy);
                    return [4 /*yield*/, (0, uniswapV4_js_1.findV4Pools)(tokenAddress, quote.address, chainId, {
                            profile: {
                                strategy: v4DiscoveryProfile.strategy,
                                purpose: v4DiscoveryProfile.purpose || 'interactive_read',
                                importance: v4DiscoveryProfile.importance || 'normal',
                            },
                        })];
                case 1:
                    pools = _c.sent();
                    if (!pools.length)
                        return [2 /*return*/, null];
                    decimalsCache = new Map();
                    getDecimals = function (address) { return __awaiter(_this, void 0, void 0, function () {
                        var key, dec;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    key = address.toLowerCase();
                                    if (decimalsCache.has(key))
                                        return [2 /*return*/, decimalsCache.get(key)];
                                    return [4 /*yield*/, (0, rpcManager_js_1.getErc20Decimals)(address, chainId, blockTag).catch(function () { return 18; })];
                                case 1:
                                    dec = _a.sent();
                                    decimalsCache.set(key, dec);
                                    return [2 /*return*/, dec];
                            }
                        });
                    }); };
                    _i = 0, pools_1 = pools;
                    _c.label = 2;
                case 2:
                    if (!(_i < pools_1.length)) return [3 /*break*/, 13];
                    pool = pools_1[_i];
                    _c.label = 3;
                case 3:
                    _c.trys.push([3, 11, , 12]);
                    if (!pool.liquidity || BigInt(pool.liquidity) <= 0n)
                        return [3 /*break*/, 12];
                    sqrtPriceX96 = BigInt(pool.sqrtPriceX96);
                    if (sqrtPriceX96 === 0n)
                        return [3 /*break*/, 12];
                    token0 = pool.poolKey.currency0;
                    token1 = pool.poolKey.currency1;
                    return [4 /*yield*/, getDecimals(token0)];
                case 4:
                    decimals0 = _c.sent();
                    return [4 /*yield*/, getDecimals(token1)];
                case 5:
                    decimals1 = _c.sent();
                    priceToken1PerToken0 = (0, uniswapV4_js_1.calculatePriceFromSqrtX96)(sqrtPriceX96, decimals0, decimals1);
                    priceInQuote = null;
                    if (tokenAddress.toLowerCase() === token0.toLowerCase() && quote.address.toLowerCase() === token1.toLowerCase()) {
                        priceInQuote = priceToken1PerToken0;
                    }
                    else if (tokenAddress.toLowerCase() === token1.toLowerCase() && quote.address.toLowerCase() === token0.toLowerCase()) {
                        priceInQuote = priceToken1PerToken0 > 0 ? 1 / priceToken1PerToken0 : null;
                    }
                    if (!priceInQuote || !Number.isFinite(priceInQuote) || priceInQuote <= 0)
                        return [3 /*break*/, 12];
                    priceUsd = priceInQuote * quote.usdPrice;
                    marketCap = 0;
                    _c.label = 6;
                case 6:
                    _c.trys.push([6, 9, , 10]);
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'totalSupply', [], rpcStrategy, blockTag)];
                case 7:
                    totalSupply = _c.sent();
                    return [4 /*yield*/, getDecimals(tokenAddress)];
                case 8:
                    tokenDecimals = _c.sent();
                    totalSupplyFormatted = Number(totalSupply) / Math.pow(10, tokenDecimals);
                    marketCap = totalSupplyFormatted * priceUsd;
                    return [3 /*break*/, 10];
                case 9:
                    _a = _c.sent();
                    marketCap = 0;
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/, {
                        price: priceUsd,
                        marketCap: marketCap,
                        pairAddress: pool.poolId,
                        dexName: 'Uniswap V4 (poolId)'
                    }];
                case 11:
                    _b = _c.sent();
                    return [3 /*break*/, 12];
                case 12:
                    _i++;
                    return [3 /*break*/, 2];
                case 13: return [2 /*return*/, null];
            }
        });
    });
}
/**
 * ⚡ Fetch price from Uniswap V4 Quoter
 * V4 uses PoolKey struct with hooks support
 * [Ref]: https://docs.uniswap.org/contracts/v4/overview
 */
function fetchPriceFromUniswapV4(tokenAddress, quote, chainId, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var quoterAddress, _a, currency0, currency1, zeroForOne, amountIn, _i, V4_POOL_CONFIGS_1, config, poolKey, params, callData, result, decoded, amountOut, tokenDecimals, quoteAmount, tokenAmount, priceInQuote, priceUsd, marketCap, totalSupply, _b, _c, err_6;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    quoterAddress = QUOTER_V4_ADDRESSES[chainId];
                    if (!quoterAddress)
                        return [2 /*return*/, null];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 13, , 14]);
                    _a = tokenAddress.toLowerCase() < quote.address.toLowerCase()
                        ? [tokenAddress, quote.address]
                        : [quote.address, tokenAddress], currency0 = _a[0], currency1 = _a[1];
                    zeroForOne = quote.address.toLowerCase() === currency0.toLowerCase();
                    amountIn = ethers_1.ethers.parseUnits(quote.isStable ? '10' : '0.01', quote.decimals);
                    _i = 0, V4_POOL_CONFIGS_1 = V4_POOL_CONFIGS;
                    _e.label = 2;
                case 2:
                    if (!(_i < V4_POOL_CONFIGS_1.length)) return [3 /*break*/, 12];
                    config = V4_POOL_CONFIGS_1[_i];
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 10, , 11]);
                    poolKey = {
                        currency0: currency0,
                        currency1: currency1,
                        fee: config.fee,
                        tickSpacing: config.tickSpacing,
                        hooks: '0x0000000000000000000000000000000000000000'
                    };
                    params = {
                        poolKey: poolKey,
                        zeroForOne: zeroForOne,
                        exactAmount: amountIn,
                        hookData: '0x'
                    };
                    callData = quoterV4Interface.encodeFunctionData('quoteExactInputSingle', [params]);
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{
                                to: quoterAddress,
                                data: callData
                            }, blockTag], rpcStrategy)];
                case 4:
                    result = _e.sent();
                    if (!result || result === '0x' || result.length < 66) {
                        return [3 /*break*/, 11]; // Try next fee tier
                    }
                    decoded = quoterV4Interface.decodeFunctionResult('quoteExactInputSingle', result);
                    amountOut = decoded[0];
                    if (amountOut <= BigInt(0)) {
                        return [3 /*break*/, 11];
                    }
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'decimals', [], rpcStrategy, blockTag)];
                case 5:
                    tokenDecimals = _e.sent();
                    quoteAmount = Number(amountIn) / Math.pow(10, quote.decimals);
                    tokenAmount = Number(amountOut) / Math.pow(10, tokenDecimals);
                    priceInQuote = tokenAmount > 0 ? (quoteAmount / tokenAmount) : 0;
                    priceUsd = priceInQuote * quote.usdPrice;
                    marketCap = 0;
                    _e.label = 6;
                case 6:
                    _e.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'totalSupply', [], rpcStrategy, blockTag)];
                case 7:
                    totalSupply = _e.sent();
                    marketCap = Number(totalSupply) / Math.pow(10, tokenDecimals) * priceUsd;
                    return [3 /*break*/, 9];
                case 8:
                    _b = _e.sent();
                    marketCap = 0;
                    return [3 /*break*/, 9];
                case 9:
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "\u26A1 Uniswap V4 price fetched", {
                        token: tokenAddress,
                        price: priceUsd.toFixed(12),
                        fee: config.fee / 10000 + '%'
                    });
                    return [2 /*return*/, {
                            price: priceUsd,
                            marketCap: marketCap,
                            pairAddress: quoterAddress,
                            dexName: "Uniswap V4 (".concat(config.fee / 10000, "%)")
                        }];
                case 10:
                    _c = _e.sent();
                    // Try next fee tier
                    return [3 /*break*/, 11];
                case 11:
                    _i++;
                    return [3 /*break*/, 2];
                case 12: return [2 /*return*/, null];
                case 13:
                    err_6 = _e.sent();
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Uniswap V4 Quoter failed', {
                        token: tokenAddress,
                        error: (_d = err_6.message) === null || _d === void 0 ? void 0 : _d.substring(0, 100)
                    });
                    return [2 /*return*/, null];
                case 14: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch price from Uniswap V3 Pool
 * ⚡ QUOTER V2: Single Multicall using QuoterV2 for instant price quotes!
 * 🔄 FALLBACK: If QuoterV2 fails, falls back to getPool + slot0 method
 */
function fetchPriceFromUniswapV3(tokenAddress, quote, factoryAddress, dexName, chainId, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var FEE_TIERS, quoterAddress, result, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    FEE_TIERS = [10000, 3000, 500];
                    quoterAddress = QUOTER_V2_ADDRESSES[chainId];
                    if (!quoterAddress) return [3 /*break*/, 4];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, tryQuoterV2(tokenAddress, quote, quoterAddress, dexName, chainId, FEE_TIERS, rpcStrategy, blockTag)];
                case 2:
                    result = _b.sent();
                    if (result)
                        return [2 /*return*/, result];
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: 
                // 🔄 FALLBACK: getPool + slot0 method (2 Multicalls)
                return [2 /*return*/, tryGetPoolSlot0Fallback(tokenAddress, quote, factoryAddress, dexName, chainId, FEE_TIERS, rpcStrategy, blockTag)];
            }
        });
    });
}
/**
 * Try QuoterV2 method - single Multicall
 */
function tryQuoterV2(tokenAddress, quote, quoterAddress, dexName, chainId, FEE_TIERS, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var amountIn, calls, _i, FEE_TIERS_1, fee, quoteParams, batchData, batchResult, decoded, results, amountOut, selectedFee, i, quoteResult, tokenDecimals, totalSupply, amountInFloat, amountOutFloat, priceInQuote, priceUsd, marketCap;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    amountIn = Math.pow(BigInt(10), BigInt(18));
                    calls = [];
                    for (_i = 0, FEE_TIERS_1 = FEE_TIERS; _i < FEE_TIERS_1.length; _i++) {
                        fee = FEE_TIERS_1[_i];
                        quoteParams = {
                            tokenIn: tokenAddress,
                            tokenOut: quote.address,
                            amountIn: amountIn,
                            fee: fee,
                            sqrtPriceLimitX96: 0
                        };
                        calls.push({
                            target: quoterAddress,
                            allowFailure: true,
                            callData: quoterV2Interface.encodeFunctionData('quoteExactInputSingle', [quoteParams])
                        });
                    }
                    calls.push({
                        target: tokenAddress,
                        allowFailure: false,
                        callData: erc20Interface.encodeFunctionData('decimals', [])
                    });
                    calls.push({
                        target: tokenAddress,
                        allowFailure: true,
                        callData: erc20Interface.encodeFunctionData('totalSupply', [])
                    });
                    batchData = multicall3Interface.encodeFunctionData('aggregate3', [calls]);
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: batchData }, blockTag], rpcStrategy)];
                case 1:
                    batchResult = _a.sent();
                    decoded = multicall3Interface.decodeFunctionResult('aggregate3', batchResult);
                    results = decoded[0];
                    amountOut = null;
                    selectedFee = 0;
                    for (i = 0; i < FEE_TIERS.length; i++) {
                        if (results[i].success && results[i].returnData.length > 2) {
                            try {
                                quoteResult = quoterV2Interface.decodeFunctionResult('quoteExactInputSingle', results[i].returnData);
                                amountOut = quoteResult[0];
                                if (amountOut > BigInt(0)) {
                                    selectedFee = FEE_TIERS[i];
                                    break;
                                }
                            }
                            catch (_b) {
                                continue;
                            }
                        }
                    }
                    if (!amountOut || amountOut === BigInt(0)) {
                        return [2 /*return*/, null];
                    }
                    tokenDecimals = Number(erc20Interface.decodeFunctionResult('decimals', results[3].returnData)[0]);
                    totalSupply = BigInt(0);
                    if (results[4].success) {
                        totalSupply = erc20Interface.decodeFunctionResult('totalSupply', results[4].returnData)[0];
                    }
                    amountInFloat = Number(amountIn) / Math.pow(10, tokenDecimals);
                    amountOutFloat = Number(amountOut) / Math.pow(10, quote.decimals);
                    if (amountInFloat <= 0)
                        return [2 /*return*/, null];
                    priceInQuote = amountOutFloat / amountInFloat;
                    priceUsd = priceInQuote * quote.usdPrice;
                    marketCap = Number(totalSupply) / Math.pow(10, tokenDecimals) * priceUsd;
                    return [2 /*return*/, {
                            price: priceUsd,
                            marketCap: marketCap,
                            pairAddress: '',
                            dexName: "".concat(dexName, " (V3 ").concat(selectedFee / 10000, "%)")
                        }];
            }
        });
    });
}
/**
 * Fallback: getPool + slot0 method (2 Multicalls)
 */
function tryGetPoolSlot0Fallback(tokenAddress, quote, factoryAddress, dexName, chainId, FEE_TIERS, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var calls, _i, FEE_TIERS_2, fee_1, batchData, batchResult, decoded, results, poolAddress, fee, i, addr, poolCalls, poolBatchData, poolResult, poolDecoded, poolResults, slot0, token0, tokenDecimals, totalSupply, sqrtPriceX96, isToken0, Q96, sqrtPrice, price, decimalAdjustment, priceInQuote, priceUsd, marketCap, err_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    calls = [];
                    for (_i = 0, FEE_TIERS_2 = FEE_TIERS; _i < FEE_TIERS_2.length; _i++) {
                        fee_1 = FEE_TIERS_2[_i];
                        calls.push({
                            target: factoryAddress,
                            allowFailure: true,
                            callData: factoryV3Interface.encodeFunctionData('getPool', [tokenAddress, quote.address, fee_1])
                        });
                    }
                    calls.push({
                        target: tokenAddress,
                        allowFailure: false,
                        callData: erc20Interface.encodeFunctionData('decimals', [])
                    });
                    calls.push({
                        target: tokenAddress,
                        allowFailure: true,
                        callData: erc20Interface.encodeFunctionData('totalSupply', [])
                    });
                    batchData = multicall3Interface.encodeFunctionData('aggregate3', [calls]);
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: batchData }, blockTag], rpcStrategy)];
                case 1:
                    batchResult = _a.sent();
                    decoded = multicall3Interface.decodeFunctionResult('aggregate3', batchResult);
                    results = decoded[0];
                    poolAddress = null;
                    fee = 0;
                    for (i = 0; i < FEE_TIERS.length; i++) {
                        if (results[i].success && results[i].returnData !== '0x' && results[i].returnData.length > 2) {
                            addr = factoryV3Interface.decodeFunctionResult('getPool', results[i].returnData)[0];
                            if (addr && addr !== '0x0000000000000000000000000000000000000000') {
                                poolAddress = addr;
                                fee = FEE_TIERS[i];
                                break;
                            }
                        }
                    }
                    if (!poolAddress) {
                        return [2 /*return*/, null];
                    }
                    poolCalls = [
                        { target: poolAddress, allowFailure: false, callData: poolV3Interface.encodeFunctionData('slot0', []) },
                        { target: poolAddress, allowFailure: false, callData: poolV3Interface.encodeFunctionData('token0', []) }
                    ];
                    poolBatchData = multicall3Interface.encodeFunctionData('aggregate3', [poolCalls]);
                    return [4 /*yield*/, callRpcWithStrategy(chainId, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: poolBatchData }, blockTag], rpcStrategy)];
                case 2:
                    poolResult = _a.sent();
                    poolDecoded = multicall3Interface.decodeFunctionResult('aggregate3', poolResult);
                    poolResults = poolDecoded[0];
                    slot0 = poolV3Interface.decodeFunctionResult('slot0', poolResults[0].returnData);
                    token0 = poolV3Interface.decodeFunctionResult('token0', poolResults[1].returnData)[0];
                    tokenDecimals = Number(erc20Interface.decodeFunctionResult('decimals', results[3].returnData)[0]);
                    totalSupply = BigInt(0);
                    if (results[4].success) {
                        totalSupply = erc20Interface.decodeFunctionResult('totalSupply', results[4].returnData)[0];
                    }
                    sqrtPriceX96 = slot0[0];
                    isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
                    Q96 = Math.pow(BigInt(2), BigInt(96));
                    sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
                    price = sqrtPrice * sqrtPrice;
                    decimalAdjustment = Math.pow(10, quote.decimals - tokenDecimals);
                    priceInQuote = isToken0 ? price * decimalAdjustment : (1 / price) / decimalAdjustment;
                    priceUsd = priceInQuote * quote.usdPrice;
                    marketCap = Number(totalSupply) / Math.pow(10, tokenDecimals) * priceUsd;
                    return [2 /*return*/, {
                            price: priceUsd,
                            marketCap: marketCap,
                            pairAddress: poolAddress,
                            dexName: "".concat(dexName, " (V3 ").concat(fee / 10000, "%)")
                        }];
                case 3:
                    err_7 = _a.sent();
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch price from FourMeme Bonding Curve (TokenManager2)
 * Uses TokenManagerHelper3 to get token info and calculate price
 */
function fetchPriceFromBondingCurve(tokenAddress, tokenManagerAddress, dexName, chainId, rpcStrategy, blockTag) {
    return __awaiter(this, void 0, void 0, function () {
        var HELPER_ABI, HELPER_ADDRESS, tokenInfo, lastPrice, quote, liquidityAdded, chainConfig, priceInQuote, quotePriceUsd, quoteInfo, priceUsd, marketCap, totalSupply, decimals, totalSupplyFloat, _a, err_8;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 12, , 13]);
                    HELPER_ABI = (0, viem_1.parseAbi)([
                        'function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)'
                    ]);
                    HELPER_ADDRESS = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034';
                    return [4 /*yield*/, callEthCall(chainId, HELPER_ADDRESS, HELPER_ABI, 'getTokenInfo', [tokenAddress], rpcStrategy, blockTag)];
                case 1:
                    tokenInfo = _b.sent();
                    lastPrice = tokenInfo[3];
                    quote = String(tokenInfo[2] || '').toLowerCase();
                    liquidityAdded = Boolean(tokenInfo[11]);
                    chainConfig = (0, chainConfig_js_1.getChainConfig)(chainId);
                    if (liquidityAdded) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Skipping bonding-curve price after launchpad graduation', {
                            token: tokenAddress,
                            chainId: chainId,
                            dexName: dexName,
                            reasonCode: 'fourmeme_liquidity_graduated'
                        });
                        return [2 /*return*/, null];
                    }
                    priceInQuote = Number(lastPrice) / 1e18;
                    if (!Number.isFinite(priceInQuote) || priceInQuote <= 0) {
                        return [2 /*return*/, null];
                    }
                    quotePriceUsd = 0;
                    if (!(!quote || quote === ZERO_ADDRESS || isNativeEquivalent(quote, chainConfig.wrappedNativeAddress))) return [3 /*break*/, 3];
                    return [4 /*yield*/, getNativeTokenPriceUsd(chainId, blockTag)];
                case 2:
                    quotePriceUsd = _b.sent();
                    return [3 /*break*/, 6];
                case 3:
                    if (!chainConfig.stablecoins.includes(quote)) return [3 /*break*/, 4];
                    quotePriceUsd = 1;
                    return [3 /*break*/, 6];
                case 4:
                    if (!(quote !== tokenAddress.toLowerCase())) return [3 /*break*/, 6];
                    return [4 /*yield*/, getOnChainPrice(quote, chainId, { rpcStrategy: rpcStrategy, blockTag: blockTag })];
                case 5:
                    quoteInfo = _b.sent();
                    quotePriceUsd = Number((quoteInfo === null || quoteInfo === void 0 ? void 0 : quoteInfo.price) || 0);
                    _b.label = 6;
                case 6:
                    if (!Number.isFinite(quotePriceUsd) || quotePriceUsd <= 0) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Bonding-curve quote token USD price unavailable', {
                            token: tokenAddress,
                            quote: quote,
                            chainId: chainId,
                            dexName: dexName,
                            reasonCode: 'fourmeme_quote_price_unavailable'
                        });
                        return [2 /*return*/, null];
                    }
                    priceUsd = priceInQuote * quotePriceUsd;
                    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
                        return [2 /*return*/, null];
                    }
                    marketCap = 0;
                    _b.label = 7;
                case 7:
                    _b.trys.push([7, 10, , 11]);
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'totalSupply', [], rpcStrategy, blockTag)];
                case 8:
                    totalSupply = _b.sent();
                    return [4 /*yield*/, callEthCall(chainId, tokenAddress, ERC20_ABI, 'decimals', [], rpcStrategy, blockTag)];
                case 9:
                    decimals = _b.sent();
                    totalSupplyFloat = Number(totalSupply) / Math.pow(10, decimals);
                    marketCap = totalSupplyFloat * priceUsd;
                    return [3 /*break*/, 11];
                case 10:
                    _a = _b.sent();
                    marketCap = 0;
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/, {
                        price: priceUsd,
                        marketCap: marketCap,
                        pairAddress: tokenManagerAddress,
                        dexName: dexName
                    }];
                case 12:
                    err_8 = _b.sent();
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'FourMeme bonding curve query failed', {
                        error: err_8.message,
                        token: tokenAddress
                    });
                    return [2 /*return*/, null];
                case 13: return [2 /*return*/];
            }
        });
    });
}
