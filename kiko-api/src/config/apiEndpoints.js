"use strict";
/**
 * Unified API Endpoints Configuration
 * Central management for all external API endpoints
 *
 * This file manages:
 * - RPC endpoints (Alchemy, Infura, Ankr, public nodes)
 * - DexScreener API
 * - GeckoTerminal API
 * - Other third-party services
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
exports.MORALIS_CONFIG = exports.SOLSCAN_CONFIG = exports.BLOCKSCOUT_CONFIG = exports.ROUTESCAN_CONFIG = exports.ETHERSCAN_CONFIG = exports.INFURA_GAS_CONFIG = exports.ZEROX_CONFIG = exports.GECKOTERMINAL_CONFIG = exports.DEXSCREENER_CONFIG = exports.HELIUS_CONNECT_SRC = void 0;
exports.getRpcEndpoints = getRpcEndpoints;
exports.getRpcEndpointsWithStrategy = getRpcEndpointsWithStrategy;
exports.getRpcEndpointsForLane = getRpcEndpointsForLane;
exports.getFlashbotsEndpoints = getFlashbotsEndpoints;
exports.getVerifiedFreeEndpoints = getVerifiedFreeEndpoints;
exports.getRpcUrlsArray = getRpcUrlsArray;
exports.getRpcUrlsArrayWithStrategy = getRpcUrlsArrayWithStrategy;
exports.normalizeChainSlug = normalizeChainSlug;
exports.requiresAuthentication = requiresAuthentication;
exports.getEndpointName = getEndpointName;
var env_js_1 = require("./env.js");
exports.HELIUS_CONNECT_SRC = 'https://*.helius-rpc.com';
var DEFAULT_PUBLIC_RPS = parseInt(process.env.RPC_PUBLIC_RPS || '5', 10);
var DEFAULT_PUBLIC_RPM = parseInt(process.env.RPC_PUBLIC_RPM || '300', 10);
var DEFAULT_PUBLIC_MAX_INFLIGHT = parseInt(process.env.RPC_PUBLIC_MAX_INFLIGHT || '50', 10);
var DEFAULT_PREMIUM_RPS = parseInt(process.env.RPC_PREMIUM_RPS || '50', 10);
var DEFAULT_PREMIUM_RPM = parseInt(process.env.RPC_PREMIUM_RPM || '3000', 10);
var DEFAULT_PREMIUM_MAX_INFLIGHT = parseInt(process.env.RPC_PREMIUM_MAX_INFLIGHT || '150', 10);
var DEFAULT_FALLBACK_RPS = parseInt(process.env.RPC_FALLBACK_RPS || '2', 10);
var DEFAULT_FALLBACK_RPM = parseInt(process.env.RPC_FALLBACK_RPM || '120', 10);
var DEFAULT_FALLBACK_MAX_INFLIGHT = parseInt(process.env.RPC_FALLBACK_MAX_INFLIGHT || '25', 10);
function getDefaultLimits(type) {
    if (type === 'premium') {
        return { rps: DEFAULT_PREMIUM_RPS, rpm: DEFAULT_PREMIUM_RPM, maxInFlight: DEFAULT_PREMIUM_MAX_INFLIGHT };
    }
    if (type === 'fallback') {
        return { rps: DEFAULT_FALLBACK_RPS, rpm: DEFAULT_FALLBACK_RPM, maxInFlight: DEFAULT_FALLBACK_MAX_INFLIGHT };
    }
    return { rps: DEFAULT_PUBLIC_RPS, rpm: DEFAULT_PUBLIC_RPM, maxInFlight: DEFAULT_PUBLIC_MAX_INFLIGHT };
}
/**
 * Build RPC endpoint list for a specific chain
 * @param chainSlug - Chain identifier (e.g., 'eth', 'base', 'bsc')
 * @param primaryUrl - Primary RPC URL from environment
 * @returns Ordered list of RPC endpoints with priority
 *
 * 优先级策略 (成本优化 - 2026-02-02 验证通过):
 *   1-2: 免费公共节点 - 首选 (已验证可靠)
 *   3-4: 付费节点 (Alchemy) - 备用 (高可靠性保证)
 */
function getRpcEndpoints(chainSlug, primaryUrl) {
    if (chainSlug === 'base') {
        return getBasePreferredEndpoints(primaryUrl);
    }
    if (chainSlug === 'solana') {
        return getSolanaEndpoints(primaryUrl, 'cheap');
    }
    var endpoints = [];
    // ============================================
    // 1. 免费公共节点优先 (已验证可靠性 95%+)
    // ============================================
    // 获取经过验证的免费节点
    var freeEndpoints = getVerifiedFreeEndpoints(chainSlug);
    freeEndpoints.forEach(function (ep, index) {
        endpoints.push({
            name: ep.name,
            url: ep.url,
            priority: index + 1,
            requiresAuth: false,
            type: 'public_free',
            limits: getDefaultLimits('public_free')
        });
    });
    // ============================================
    // 2. 付费节点作为备用 (高可靠性保证)
    // ============================================
    var basePriority = freeEndpoints.length;
    // Primary Provider (Alchemy/Infura from ENV)
    if (primaryUrl) {
        endpoints.push({
            name: 'Primary',
            url: primaryUrl,
            priority: basePriority + 1,
            requiresAuth: true,
            type: 'premium',
            limits: getDefaultLimits('premium')
        });
    }
    // Alchemy (if API key available and no primary)
    if (env_js_1.env.apiKeys.alchemy && !primaryUrl) {
        var alchemyUrl = getAlchemyUrl(chainSlug);
        if (alchemyUrl) {
            endpoints.push({
                name: 'Alchemy',
                url: alchemyUrl,
                priority: basePriority + 2,
                requiresAuth: true,
                type: 'premium',
                limits: getDefaultLimits('premium')
            });
        }
    }
    // Ankr (final backup)
    if (env_js_1.env.apiKeys.ankr) {
        endpoints.push({
            name: 'Ankr',
            url: "https://rpc.ankr.com/".concat(chainSlug, "/").concat(env_js_1.env.apiKeys.ankr),
            priority: basePriority + 3,
            requiresAuth: true,
            type: 'premium',
            limits: getDefaultLimits('premium')
        });
    }
    return endpoints.sort(function (a, b) { return a.priority - b.priority; });
}
function getRpcEndpointsWithStrategy(chainSlug, strategy, primaryUrl) {
    if (strategy === void 0) { strategy = 'cheap'; }
    return getRpcEndpointsForLane(chainSlug, strategy === 'fast' ? 'critical' : 'cheap', primaryUrl);
}
function getRpcEndpointsForLane(chainSlug, lane, primaryUrl) {
    if (lane === void 0) { lane = 'cheap'; }
    if (lane === 'cheap') {
        if (chainSlug === 'solana') {
            return getSolanaEndpoints(primaryUrl, 'cheap');
        }
        if (chainSlug === 'base') {
            return getBaseCheapEndpoints(primaryUrl);
        }
        if (chainSlug === 'bsc') {
            return getBscCheapEndpoints(primaryUrl);
        }
        return getRpcEndpoints(chainSlug, primaryUrl);
    }
    var preferPremiumDefault = 'true';
    var onlyPremiumDefault = chainSlug === 'eth' ? 'true' : 'false';
    var preferPremium = (process.env.RPC_FAST_PREFER_PREMIUM || preferPremiumDefault).toLowerCase() === 'true';
    var onlyPremium = (process.env.RPC_FAST_ONLY_PREMIUM || onlyPremiumDefault).toLowerCase() === 'true';
    var override = getFastOverride(chainSlug);
    if (override.length > 0) {
        return override;
    }
    if (chainSlug === 'solana') {
        return getSolanaEndpoints(primaryUrl, 'fast');
    }
    if (chainSlug === 'base') {
        var list_1 = getBasePreferredEndpoints(primaryUrl);
        var ordered_1 = preferPremium ? prioritizePremium(list_1) : list_1;
        if (onlyPremium) {
            var premium = ordered_1.filter(function (e) { return e.type === 'premium'; });
            return premium.length > 0 ? premium : ordered_1;
        }
        return ordered_1;
    }
    if (chainSlug === 'bsc') {
        var list_2 = getBscPreferredEndpoints(primaryUrl);
        var ordered_2 = preferPremium ? prioritizePremium(list_2) : list_2;
        if (onlyPremium) {
            var premium = ordered_2.filter(function (e) { return e.type === 'premium'; });
            return premium.length > 0 ? premium : ordered_2;
        }
        return ordered_2;
    }
    var list = getGenericCriticalEndpoints(chainSlug, primaryUrl);
    var ordered = preferPremium ? prioritizePremium(list) : list;
    if (onlyPremium) {
        var premium = ordered.filter(function (e) { return e.type === 'premium'; });
        return premium.length > 0 ? premium : ordered;
    }
    return ordered;
}
function getBscPreferredEndpoints(primaryUrl) {
    var endpoints = [];
    var priority = 1;
    var push = function (name, url, requiresAuth, type) {
        if (requiresAuth === void 0) { requiresAuth = false; }
        if (type === void 0) { type = 'public_free'; }
        if (!url)
            return;
        endpoints.push({ name: name, url: url, priority: priority++, requiresAuth: requiresAuth, type: type, limits: getDefaultLimits(type) });
    };
    if (primaryUrl)
        push('Primary', primaryUrl, true, 'premium');
    if (env_js_1.env.apiKeys.alchemy)
        push('Alchemy', getAlchemyUrl('bsc') || undefined, true, 'premium');
    if (env_js_1.env.apiKeys.ankr)
        push('Ankr', "https://rpc.ankr.com/bsc/".concat(env_js_1.env.apiKeys.ankr), true, 'premium');
    push('PublicNode', 'https://bsc-rpc.publicnode.com', false, 'public_free');
    push('Binance Dataseed', 'https://bsc-dataseed.binance.org', false, 'public_free');
    push('DRPC', 'https://bsc.drpc.org', false, 'public_free');
    var seen = new Set();
    return endpoints.filter(function (ep) {
        if (seen.has(ep.url))
            return false;
        seen.add(ep.url);
        return true;
    });
}
function getBscCheapEndpoints(primaryUrl) {
    var endpoints = [];
    var priority = 1;
    var push = function (name, url, requiresAuth, type) {
        if (requiresAuth === void 0) { requiresAuth = false; }
        if (type === void 0) { type = 'public_free'; }
        if (!url)
            return;
        endpoints.push({ name: name, url: url, priority: priority++, requiresAuth: requiresAuth, type: type, limits: getDefaultLimits(type) });
    };
    push('PublicNode', 'https://bsc-rpc.publicnode.com', false, 'public_free');
    push('Binance Dataseed', 'https://bsc-dataseed.binance.org', false, 'public_free');
    push('DRPC', 'https://bsc.drpc.org', false, 'public_free');
    if (primaryUrl)
        push('Primary', primaryUrl, true, 'premium');
    if (env_js_1.env.apiKeys.alchemy)
        push('Alchemy', getAlchemyUrl('bsc') || undefined, true, 'premium');
    if (env_js_1.env.apiKeys.ankr)
        push('Ankr', "https://rpc.ankr.com/bsc/".concat(env_js_1.env.apiKeys.ankr), true, 'premium');
    var seen = new Set();
    return endpoints.filter(function (ep) {
        if (seen.has(ep.url))
            return false;
        seen.add(ep.url);
        return true;
    });
}
function prioritizePremium(endpoints) {
    var premium = endpoints.filter(function (e) { return e.type === 'premium'; });
    var rest = endpoints.filter(function (e) { return e.type !== 'premium'; });
    var ordered = __spreadArray(__spreadArray([], premium, true), rest, true);
    return ordered.map(function (ep, idx) { return (__assign(__assign({}, ep), { priority: idx + 1 })); });
}
function getGenericCriticalEndpoints(chainSlug, primaryUrl) {
    var endpoints = [];
    var priority = 1;
    var push = function (name, url, requiresAuth, type) {
        if (requiresAuth === void 0) { requiresAuth = false; }
        if (type === void 0) { type = 'public_free'; }
        if (!url)
            return;
        endpoints.push({ name: name, url: url, priority: priority++, requiresAuth: requiresAuth, type: type, limits: getDefaultLimits(type) });
    };
    if (primaryUrl) {
        push('Primary', primaryUrl, true, 'premium');
    }
    var alchemyUrl = getAlchemyUrl(chainSlug);
    if (env_js_1.env.apiKeys.alchemy && alchemyUrl && alchemyUrl !== primaryUrl) {
        push('Alchemy', alchemyUrl, true, 'premium');
    }
    if (env_js_1.env.apiKeys.ankr) {
        push('Ankr', "https://rpc.ankr.com/".concat(chainSlug, "/").concat(env_js_1.env.apiKeys.ankr), true, 'premium');
    }
    var freeEndpoints = getVerifiedFreeEndpoints(chainSlug);
    freeEndpoints.forEach(function (ep) {
        push(ep.name, ep.url, false, 'public_free');
    });
    var seen = new Set();
    return endpoints.filter(function (ep) {
        if (seen.has(ep.url))
            return false;
        seen.add(ep.url);
        return true;
    });
}
function getFastOverride(chainSlug) {
    var key = "RPC_FAST_OVERRIDE_".concat(chainSlug.toUpperCase());
    var raw = process.env[key];
    if (!raw)
        return [];
    var urls = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return urls.map(function (url, idx) { return ({
        name: "Override-".concat(idx + 1),
        url: url,
        priority: idx + 1,
        requiresAuth: true,
        type: 'premium',
        limits: getDefaultLimits('premium')
    }); });
}
function getBasePreferredEndpoints(primaryUrl) {
    var endpoints = [];
    var priority = 1;
    var push = function (name, url, requiresAuth, type) {
        if (requiresAuth === void 0) { requiresAuth = false; }
        if (type === void 0) { type = 'public_free'; }
        if (!url)
            return;
        endpoints.push({ name: name, url: url, priority: priority++, requiresAuth: requiresAuth, type: type, limits: getDefaultLimits(type) });
    };
    // Preferred order (most stable)
    // Alchemy/Primary -> DRPC -> PublicNode -> Base Official -> Coinbase -> Ankr -> Infura
    if (env_js_1.env.apiKeys.alchemy) {
        push('Alchemy', getAlchemyUrl('base') || undefined, true, 'premium');
    }
    if (primaryUrl) {
        push('Primary', primaryUrl, true, 'premium');
    }
    push('DRPC', 'https://base.drpc.org', false, 'public_free');
    push('PublicNode', 'https://base-rpc.publicnode.com', false, 'public_free');
    push('Base Official', 'https://mainnet.base.org', false, 'public_free');
    push('Coinbase', 'https://api.developer.coinbase.com/rpc/v1/base/ilSV6rJjgR0WwRdvqjG5cL07exQrmr8t', true, 'premium');
    if (env_js_1.env.apiKeys.ankr) {
        push('Ankr', "https://rpc.ankr.com/base/".concat(env_js_1.env.apiKeys.ankr), true, 'premium');
    }
    if (env_js_1.env.apiKeys.infura) {
        push('Infura', "https://base-mainnet.infura.io/v3/".concat(env_js_1.env.apiKeys.infura), true, 'premium');
    }
    // Deduplicate by URL (preserve priority)
    var seen = new Set();
    return endpoints.filter(function (ep) {
        if (seen.has(ep.url))
            return false;
        seen.add(ep.url);
        return true;
    });
}
function getBaseCheapEndpoints(primaryUrl) {
    var endpoints = [];
    var priority = 1;
    var push = function (name, url, requiresAuth, type) {
        if (requiresAuth === void 0) { requiresAuth = false; }
        if (type === void 0) { type = 'public_free'; }
        if (!url)
            return;
        endpoints.push({ name: name, url: url, priority: priority++, requiresAuth: requiresAuth, type: type, limits: getDefaultLimits(type) });
    };
    // Cheap-first order: stable public endpoints -> premium fallbacks
    push('DRPC', 'https://base.drpc.org', false, 'public_free');
    push('PublicNode', 'https://base-rpc.publicnode.com', false, 'public_free');
    push('Base Official', 'https://mainnet.base.org', false, 'public_free');
    if (primaryUrl) {
        push('Primary', primaryUrl, true, 'premium');
    }
    if (env_js_1.env.apiKeys.alchemy) {
        push('Alchemy', getAlchemyUrl('base') || undefined, true, 'premium');
    }
    if (env_js_1.env.apiKeys.ankr) {
        push('Ankr', "https://rpc.ankr.com/base/".concat(env_js_1.env.apiKeys.ankr), true, 'premium');
    }
    if (env_js_1.env.apiKeys.infura) {
        push('Infura', "https://base-mainnet.infura.io/v3/".concat(env_js_1.env.apiKeys.infura), true, 'premium');
    }
    var seen = new Set();
    return endpoints.filter(function (ep) {
        if (seen.has(ep.url))
            return false;
        seen.add(ep.url);
        return true;
    });
}
function getSolanaEndpoints(primaryUrl, strategy) {
    if (strategy === void 0) { strategy = 'cheap'; }
    var endpoints = [];
    var priority = 1;
    var push = function (name, url, requiresAuth, type, capabilities) {
        if (requiresAuth === void 0) { requiresAuth = false; }
        if (type === void 0) { type = 'public_free'; }
        if (!url)
            return;
        endpoints.push({
            name: name,
            url: url,
            priority: priority++,
            requiresAuth: requiresAuth,
            type: type,
            limits: getDefaultLimits(type),
            capabilities: capabilities
        });
    };
    var premiumFirst = strategy === 'fast';
    if (premiumFirst) {
        // fast/critical: paid nodes first for lowest latency on copytrade/sniper paths
        if (primaryUrl) {
            push('Primary', primaryUrl, true, 'premium');
        }
        if (env_js_1.env.apiKeys.helius) {
            push('Helius', "https://mainnet.helius-rpc.com/?api-key=".concat(env_js_1.env.apiKeys.helius), true, 'premium', { methods: ['getAsset', 'getAssetsByOwner', 'getAssetBatch'] });
        }
        if (env_js_1.env.apiKeys.alchemy) {
            push('Alchemy', "https://solana-mainnet.g.alchemy.com/v2/".concat(env_js_1.env.apiKeys.alchemy), true, 'premium');
        }
        // Public as backup
        push('PublicNode', 'https://solana-rpc.publicnode.com', false, 'public_free');
        push('Ankr Public', 'https://rpc.ankr.com/solana', false, 'public_free');
        push('Solana Official', 'https://api.mainnet-beta.solana.com', false, 'public_free');
        push('DRPC', 'https://solana.drpc.org', false, 'fallback');
    }
    else {
        // cheap: public nodes first to conserve paid quota
        push('PublicNode', 'https://solana-rpc.publicnode.com', false, 'public_free');
        push('Ankr Public', 'https://rpc.ankr.com/solana', false, 'public_free');
        push('Solana Official', 'https://api.mainnet-beta.solana.com', false, 'public_free');
        push('DRPC', 'https://solana.drpc.org', false, 'fallback');
        if (primaryUrl) {
            push('Primary', primaryUrl, true, 'premium');
        }
        if (env_js_1.env.apiKeys.alchemy) {
            push('Alchemy', "https://solana-mainnet.g.alchemy.com/v2/".concat(env_js_1.env.apiKeys.alchemy), true, 'premium');
        }
        if (env_js_1.env.apiKeys.helius) {
            push('Helius', "https://mainnet.helius-rpc.com/?api-key=".concat(env_js_1.env.apiKeys.helius), true, 'premium', { methods: ['getAsset', 'getAssetsByOwner', 'getAssetBatch'] });
        }
    }
    var seen = new Set();
    return endpoints.filter(function (ep) {
        if (seen.has(ep.url))
            return false;
        seen.add(ep.url);
        return true;
    });
}
function getFlashbotsEndpoints() {
    var limits = getDefaultLimits('premium');
    return [
        {
            name: 'Flashbots Protect',
            url: 'https://rpc.flashbots.net',
            priority: 1,
            requiresAuth: false,
            type: 'premium',
            limits: limits
        },
        {
            name: 'Flashbots Protect Fast',
            url: 'https://rpc.flashbots.net/fast',
            priority: 2,
            requiresAuth: false,
            type: 'premium',
            limits: limits
        }
    ];
}
/**
 * 获取经过验证的免费 RPC 节点
 * 基于 2026-02-02 生产环境测试结果
 */
function getVerifiedFreeEndpoints(chainSlug) {
    var endpoints = {
        // ETH: diversify public reads to avoid single-endpoint exhaustion.
        'eth': [
            { name: 'DRPC', url: 'https://eth.drpc.org' },
            { name: 'LlamaRPC', url: 'https://eth.llamarpc.com' },
            { name: '1RPC', url: 'https://1rpc.io/eth' },
            { name: 'MEV Blocker', url: 'https://rpc.mevblocker.io' },
            { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
        ],
        // Base: DRPC/PublicNode are generally more stable than rate-limited public endpoints
        'base': [
            { name: 'DRPC', url: 'https://base.drpc.org' },
            { name: 'PublicNode', url: 'https://base-rpc.publicnode.com' },
            { name: 'Base Official', url: 'https://mainnet.base.org' },
        ],
        // BSC: PublicNode/Defibit are more stable under load than binance dataseed
        'bsc': [
            { name: 'PublicNode', url: 'https://bsc-rpc.publicnode.com' },
            { name: 'Defibit-1', url: 'https://bsc-dataseed1.defibit.io' },
            { name: 'Binance Official', url: 'https://bsc-dataseed.binance.org' },
        ],
        // Polygon: PublicNode 100% 成功率
        'polygon': [
            { name: 'PublicNode', url: 'https://polygon-bor-rpc.publicnode.com' },
            { name: 'DRPC', url: 'https://polygon.drpc.org' },
        ],
        // Arbitrum: PublicNode 100% 成功率
        'arbitrum': [
            { name: 'PublicNode', url: 'https://arbitrum-one-rpc.publicnode.com' },
            { name: 'DRPC', url: 'https://arbitrum.drpc.org' },
        ],
        // Optimism: PublicNode 100% 成功率
        'optimism': [
            { name: 'PublicNode', url: 'https://optimism-rpc.publicnode.com' },
            { name: 'DRPC', url: 'https://optimism.drpc.org' },
        ],
        // Solana: Public endpoints
        'solana': [
            { name: 'PublicNode', url: 'https://solana-rpc.publicnode.com' },
            { name: 'Solana Official', url: 'https://api.mainnet-beta.solana.com' },
            { name: 'DRPC', url: 'https://solana.drpc.org' },
        ],
    };
    return endpoints[chainSlug] || [];
}
/**
 * Get Alchemy URL for a specific chain
 */
function getAlchemyUrl(chainSlug) {
    var network = ALCHEMY_NETWORK_MAP[chainSlug];
    if (!network || !env_js_1.env.apiKeys.alchemy)
        return null;
    return "https://".concat(network, ".g.alchemy.com/v2/").concat(env_js_1.env.apiKeys.alchemy);
}
var ALCHEMY_NETWORK_MAP = {
    'eth': 'eth-mainnet',
    'base': 'base-mainnet',
    'bsc': 'bnb-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arb-mainnet',
    'optimism': 'opt-mainnet',
};
// ============================================================================
// DEXSCREENER API CONFIGURATION
// ============================================================================
exports.DEXSCREENER_CONFIG = {
    baseUrl: 'https://api.dexscreener.com/latest/dex',
    tokenProfilesUrl: 'https://api.dexscreener.com/token-profiles/latest/v1',
    tokenBoostsUrl: 'https://api.dexscreener.com/token-boosts/top/v1',
    websocketUrl: 'wss://io.dexscreener.com/dex/screener/v5/pairs',
    // Rate limiting
    rateLimit: {
        requestsPerMinute: 300, // Free tier limit
        backoffMs: 1000, // Base backoff on rate limit
    },
    // Timeouts
    timeout: {
        rest: 10000, // 10 seconds for REST API
        websocket: 30000, // 30 seconds for WebSocket
    },
    // Chain mappings (DexScreener uses specific naming)
    chainMap: {
        'eth': 'ethereum',
        'ethereum': 'ethereum',
        'bsc': 'bsc',
        'base': 'base',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism',
        'polygon': 'polygon',
        'avalanche': 'avalanche',
        'solana': 'solana',
    },
    // Network reverse mapping
    networkMap: {
        'ethereum': 'eth',
        'bsc': 'bsc',
        'base': 'base',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism',
        'polygon': 'polygon',
        'avalanche': 'avax',
        'solana': 'solana',
    },
};
// ============================================================================
// GECKOTERMINAL API CONFIGURATION
// ============================================================================
exports.GECKOTERMINAL_CONFIG = {
    baseUrl: 'https://api.geckoterminal.com/api/v2',
    // Rate limiting
    rateLimit: {
        requestsPerMinute: 30, // Conservative limit for free tier
        burstRequests: 10, // Max burst requests
        backoffMs: 2000, // Base backoff on rate limit
    },
    // Timeouts
    timeout: {
        default: 30000, // 30 seconds
        search: 15000, // 15 seconds for search queries
    },
    // Retry configuration
    retry: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
    },
    // Circuit breaker
    circuitBreaker: {
        failureThreshold: 5, // Open circuit after 5 failures
        resetTimeoutMs: 60000, // Reset after 60 seconds
    },
    // Network mappings (GeckoTerminal uses specific naming)
    networkMap: {
        'ethereum': 'eth',
        'eth': 'eth',
        'bsc': 'bsc',
        'base': 'base',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism',
        'polygon': 'polygon-pos',
        'avalanche': 'avax',
        'solana': 'solana',
    },
};
exports.ZEROX_CONFIG = {
    // 0x API endpoints by chain
    baseUrls: {
        1: 'https://api.0x.org',
        8453: 'https://base.api.0x.org',
        56: 'https://bsc.api.0x.org',
        137: 'https://polygon.api.0x.org',
        42161: 'https://arbitrum.api.0x.org',
        10: 'https://optimism.api.0x.org',
        43114: 'https://avalanche.api.0x.org',
    },
    apiKey: env_js_1.env.apiKeys.zeroEx || '',
    timeout: 10000, // 10 seconds
};
exports.INFURA_GAS_CONFIG = {
    baseUrl: 'https://gas.api.infura.io',
    apiKey: env_js_1.env.apiKeys.infuraGas || '',
    timeout: 5000, // 5 seconds
};
// ============================================================================
// BLOCKCHAIN EXPLORER APIS
// ============================================================================
/**
 * Etherscan V2 API (unified for all EVM chains)
 * https://docs.etherscan.io/v2/
 */
exports.ETHERSCAN_CONFIG = {
    baseUrl: 'https://api.etherscan.io/v2/api',
    apiKey: env_js_1.env.apiKeys.etherscan || '',
    timeout: 10000, // 10 seconds
    rateLimit: {
        requestsPerSecond: 5, // Free tier: 5 req/sec
        backoffMs: 200,
    },
    // V2 API: Single URL works for all chains via chainId parameter
    // Example: https://api.etherscan.io/v2/api?chainid=1&...
    // Legacy V1 endpoints for chains without V2 support:
    legacyUrls: {
        'ethereum': 'https://api.etherscan.io/api',
        'base': 'https://api.basescan.org/api',
        'polygon': 'https://api.polygonscan.com/api',
        'arbitrum': 'https://api.arbiscan.io/api',
        'optimism': 'https://api-optimistic.etherscan.io/api',
        'bsc': 'https://api.bscscan.com/api',
    },
};
/**
 * RouteScan API (Multi-chain explorer)
 * Free tier, supports many L2s
 */
exports.ROUTESCAN_CONFIG = {
    baseUrl: 'https://api.routescan.io/v2/network',
    apiKey: env_js_1.env.apiKeys.routescan || '',
    timeout: 10000, // 10 seconds
    chainMap: {
        'ethereum': 'mainnet/evm/1/etherscan',
        'eth': 'mainnet/evm/1/etherscan',
        'base': 'base/evm/8453/etherscan',
        'polygon': 'polygon/evm/137/etherscan',
        'arbitrum': 'arbitrum/evm/42161/etherscan',
        'optimism': 'optimism/evm/10/etherscan',
        'bsc': 'bnb/evm/56/etherscan',
        'linea': 'linea/evm/59144/etherscan',
        'avalanche': 'avalanche/evm/43114/etherscan',
    },
};
/**
 * Blockscout API (Multi-chain explorer)
 * Free tier, Etherscan V1 compatible
 */
exports.BLOCKSCOUT_CONFIG = {
    baseUrl: 'https://blockscout.com/api',
    apiKey: env_js_1.env.apiKeys.blockscout || '',
    timeout: 10000, // 10 seconds
    chainUrls: {
        'ethereum': 'https://eth.blockscout.com/api',
        'base': 'https://base.blockscout.com/api',
        'polygon': 'https://polygon.blockscout.com/api',
        'bsc': 'https://bsc.blockscout.com/api',
        'arbitrum': 'https://arbitrum.blockscout.com/api',
        'optimism': 'https://optimism.blockscout.com/api',
        'linea': 'https://linea.blockscout.com/api',
        'avalanche': 'https://snowtrace.io/api',
    },
};
/**
 * Solscan API (Solana explorer)
 * Paid tier required, best for Solana data
 */
exports.SOLSCAN_CONFIG = {
    baseUrl: 'https://pro-api.solscan.io/v2.0',
    apiKey: env_js_1.env.apiKeys.solscan || '',
    timeout: 15000, // 15 seconds for Solana
    rateLimit: {
        requestsPerSecond: 2,
        backoffMs: 500,
    },
    endpoints: {
        transactions: '/transaction/list',
        tokenTransfers: '/token/transfer',
        accountInfo: '/account/info',
    },
};
/**
 * Moralis API (Token balances and PNL)
 * Supports EVM chains for wallet data
 */
exports.MORALIS_CONFIG = {
    baseUrl: 'https://deep-index.moralis.io/api/v2.2',
    apiKey: env_js_1.env.apiKeys.moralis || '',
    timeout: 30000, // 30 seconds for PNL queries
    supportedChains: [1, 137, 8453], // Eth, Polygon, Base
    endpoints: {
        profitability: '/wallets/{address}/profitability',
        topGainers: '/erc20/{address}/top-gainers',
        tokenBalances: '/wallets/{address}/tokens',
        transactions: '/wallets/{address}/transactions',
    },
};
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Get all RPC URLs for a chain (for backward compatibility)
 */
function getRpcUrlsArray(chainSlug, primaryUrl) {
    return getRpcEndpoints(chainSlug, primaryUrl).map(function (e) { return e.url; });
}
function getRpcUrlsArrayWithStrategy(chainSlug, strategy, primaryUrl) {
    if (strategy === void 0) { strategy = 'cheap'; }
    return getRpcEndpointsWithStrategy(chainSlug, strategy, primaryUrl).map(function (e) { return e.url; });
}
/**
 * Validate and normalize chain identifier
 */
function normalizeChainSlug(chain) {
    var normalized = chain.toLowerCase().trim();
    // Handle common aliases
    var aliases = {
        'ethereum': 'eth',
        'binance': 'bsc',
        'bnb': 'bsc',
        'polygon-pos': 'polygon',
        'arb': 'arbitrum',
        'op': 'optimism',
        'avax': 'avalanche',
        'sol': 'solana',
    };
    return aliases[normalized] || normalized;
}
/**
 * Check if API requires authentication
 */
function requiresAuthentication(url) {
    return url.includes('alchemy.com') ||
        url.includes('infura.io') ||
        url.includes('ankr.com') ||
        url.includes('helius') ||
        url.includes('quicknode');
}
/**
 * Get endpoint name from URL
 */
function getEndpointName(url) {
    if (url.includes('alchemy.com'))
        return 'Alchemy';
    if (url.includes('infura.io'))
        return 'Infura';
    if (url.includes('ankr.com'))
        return 'Ankr';
    if (url.includes('drpc.org'))
        return 'DRPC';
    if (url.includes('publicnode.com'))
        return 'PublicNode';
    if (url.includes('helius'))
        return 'Helius';
    if (url.includes('quicknode'))
        return 'QuickNode';
    return 'Custom';
}
