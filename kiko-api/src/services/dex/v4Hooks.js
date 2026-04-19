"use strict";
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
exports.CUSTOM_V4_HOOKS_BY_CHAIN = exports.FLAUNCH_HOOKS_BY_CHAIN = exports.DOPPLER_HOOKS_BY_CHAIN = exports.ZORA_HOOKS_BY_CHAIN = exports.CLANKER_HOOKS_BY_CHAIN = void 0;
exports.getKnownV4HooksByChain = getKnownV4HooksByChain;
exports.isClankerHook = isClankerHook;
exports.buildClankerHookData = buildClankerHookData;
exports.resolveV4HookProfile = resolveV4HookProfile;
exports.buildV4HookDataCandidates = buildV4HookDataCandidates;
// CONTEXT MEMORY
// Updated: 2026-04-11
// Author: Mina Zhou
// Reason: DirectSwap 的 v4 hook 注册表混用了官方文档事实、第三方文档事实
//         和生产流量观察值，导致后续模型会把“观察到的地址”误读成
//         “官方已发布的稳定地址表”。
// Goal: 保持 hook 家族识别与 hookData 生成稳定，同时明确每组地址的
//       文档来源、检索日期和验证强度。
// Owns: DirectSwap 对已知 v4 hook 家族的地址登记、家族分类、静态 hookData 候选。
// Does Not Own: 第三方协议的链上部署发布流程、Universal Router 兼容性探测、
//               或对未知 hook 的最终安全裁定。
// Design Language:
// - 协议层事实、第三方文档事实、运行时观察值必须分开记录。
// - 未被供应商公开文档证实的地址可以保留，但必须标明为运行时观察。
// - 不要把同一个 hook 地址同时归到多个家族。
// Document Provenance:
// - Source: Uniswap v4 hook spec (`IHooks.sol`, `Hooks.sol`)
// - Kind: official API doc
// - Retrieved: 2026-04-11
// - Applied To: 确认 DirectSwap 注册的是第三方 hook 地址簇，不是协议层 hook 位定义
// - Verification: verified in code
// - Source: Clanker v4 reference + deployed contracts
// - Kind: product doc
// - Retrieved: 2026-04-11
// - Applied To: Base 上 Clanker v4.0/v4.1 hook 地址归因
// - Verification: verified in docs
// - Source: Doppler Hooks
// - Kind: product doc
// - Retrieved: 2026-04-11
// - Applied To: Doppler hook 生命周期语义与动态 fee 边界
// - Verification: verified in docs
// - Source: Base production swap traffic sampled by existing DirectSwap diagnostics
// - Kind: runtime observation
// - Retrieved: 2026-04-11
// - Applied To: 保留供应商公开文档未列出但已在生产流量出现的 hook 地址
// - Verification: partially verified
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/directswap-v4-hook-provenance.md
// - /Users/almurat/KiKo/system-journal/owner-map/backend-swap-validation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-directswap-v4-hook-provenance-audit.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
var ethers_1 = require("ethers");
// Clanker v4 hooks on Base.
// Official docs confirm the v4.0/v4.1 families below. Runtime-only variants stay
// in the registry, but must remain clearly labeled as observations.
exports.CLANKER_HOOKS_BY_CHAIN = {
    8453: [
        '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc', // ClankerHookStaticFeeV2 v4.1.0
        '0xd60d6b218116cfd801e28f78d011a203d2b068cc', // ClankerHookDynamicFeeV2 v4.1.0
        '0x34a45c6b61876d739400bd71228cbcbd4f53e8cc', // ClankerHookDynamicFee v4.0.0
        '0xdd5eeaff7bd481ad55db083062b13a3cdf0a68cc', // ClankerHookStaticFee v4.0.0
        '0x7debe6943acefe85c4ee81aadd736466e07528cc', // Runtime-observed Base variant; not listed in current public Clanker docs
    ]
};
// Zora creator coin hooks on Base.
// Public Zora docs checked on 2026-04-11 did not expose a stable hook address table,
// so these entries remain runtime-observed integration values.
exports.ZORA_HOOKS_BY_CHAIN = {
    8453: [
        '0xd61A675F8a0c67A73DC3B54FB7318B4D91409040', // Runtime-observed
        '0xc8d077444625eb300a427a6dfb2b1dbf9b159040', // Runtime-observed
        '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040' // Runtime-observed
    ]
};
// Doppler hooks / multicurve initializer hooks on Base.
// Public docs confirm callback semantics, `setHook` behavior, and dynamic-fee
// constraints, but not a complete raw Base address table in the retrieved page.
exports.DOPPLER_HOOKS_BY_CHAIN = {
    8453: [
        // RehypeDopplerHook (runtime-observed Base)
        '0x97cad25c7796df5df4da6f4f56877b6874e7a503',
        // UniswapV4MulticurveInitializerHook (runtime-observed Base)
        '0x892d0d37d61f30f8f15be8cfc24eb9cece210210',
        // UniswapV4ScheduledMulticurveInitializerHook (runtime-observed Base)
        '0x3e342c2f6ea14f4f26919dc5ff0652db10f42dc0',
        // DecayMulticurveInitializerHook (runtime-observed Base)
        '0xbb7784a4d481184283ed89619a3e3ed143e1adc0'
    ]
};
// Flaunch position manager hooks on Base.
// The public contract-addresses page checked on 2026-04-11 did not yield a
// stable raw-text address table during retrieval, so the version labels below
// should be treated as historical integration knowledge plus production checks.
exports.FLAUNCH_HOOKS_BY_CHAIN = {
    8453: [
        // Historical integration: Position Manager hook v1
        '0x000000000d564d5be76f7f0d28fe52605afc7cf8',
        // Historical integration: Position Manager hook v2
        '0x00000000f2f2896bef8d504bb79af67a6e4b1fe2',
        // Historical integration: Position Manager hook v3
        '0x00000000c1500ca71c8d7d8a71cc6e106b2b5a60',
        // Historical integration: Position Manager hook v4
        '0x00000000ede6d8d217c60f93191c060747324bca',
        // Historical integration: Position Manager hook v4.1
        '0x00000000796b9b0ef0d3ba88e0f72e252eb0f0d4',
        // Historical integration: Position Manager hook v4.2
        '0x0000000008d2d4de69390f08f7f2a95988f52621',
        // Runtime-observed in Base production swaps (Takeover / NCX / Clawbot)
        '0x23321f11a6d44fd1ab790044fdfde5758c902fdc'
    ]
};
// Runtime-observed hooks that do not yet have a stronger public provenance.
exports.CUSTOM_V4_HOOKS_BY_CHAIN = {
    8453: [
        // DeliHook (Base) - runtime-observed on CreatorBid-related v4 pools
        '0x570a48f96035c2874de1c0f13c5075a05683b0cc'
    ]
};
var HOOK_ZERO = '0x0000000000000000000000000000000000000000';
var DEFAULT_PROFILE_TTL_MS = 60000;
var dynamicProfilesCache = null;
function getKnownV4HooksByChain(chainId) {
    var dynamic = Array.from(loadDynamicProfiles().values())
        .filter(function (p) { return p.chainId === chainId && p.hookAddress !== HOOK_ZERO; })
        .map(function (p) { return p.hookAddress; });
    return Array.from(new Set(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], (exports.CLANKER_HOOKS_BY_CHAIN[chainId] || []), true), (exports.ZORA_HOOKS_BY_CHAIN[chainId] || []), true), (exports.DOPPLER_HOOKS_BY_CHAIN[chainId] || []), true), (exports.FLAUNCH_HOOKS_BY_CHAIN[chainId] || []), true), (exports.CUSTOM_V4_HOOKS_BY_CHAIN[chainId] || []), true), dynamic, true).map(function (h) { return h.toLowerCase(); })));
}
function isClankerHook(chainId, hookAddress) {
    var hooks = exports.CLANKER_HOOKS_BY_CHAIN[chainId] || [];
    return hooks.some(function (h) { return h.toLowerCase() === hookAddress.toLowerCase(); });
}
function buildClankerHookData(payee) {
    // PoolSwapData: (bytes mevModuleSwapData, bytes poolExtensionSwapData)
    // mevModuleSwapData = abi.encode(address payee)
    var mevModuleSwapData = ethers_1.ethers.AbiCoder.defaultAbiCoder().encode(['address'], [payee]);
    return ethers_1.ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes'], [mevModuleSwapData, '0x']);
}
function normalizeHookAddress(hookAddress) {
    var raw = String(hookAddress || '').trim().toLowerCase();
    if (!raw || raw === '0x')
        return HOOK_ZERO;
    return raw;
}
function normalizeHookDataList(input) {
    var list = (input || []).filter(function (v) { return typeof v === 'string' && v.startsWith('0x'); });
    return Array.from(new Set(list.map(function (v) { return v.toLowerCase(); })));
}
function parseFamily(value) {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'none' || normalized === 'clanker' || normalized === 'zora' || normalized === 'doppler' || normalized === 'flaunch' || normalized === 'custom' || normalized === 'unknown') {
        return normalized;
    }
    return 'custom';
}
function buildAddressEncodedCandidates(addresses) {
    var encoded = addresses
        .map(function (addr) { return String(addr || '').trim(); })
        .filter(Boolean)
        .map(function (addr) {
        try {
            return ethers_1.ethers.AbiCoder.defaultAbiCoder()
                .encode(['address'], [ethers_1.ethers.getAddress(addr)])
                .toLowerCase();
        }
        catch (_a) {
            return '';
        }
    })
        .filter(Boolean);
    return Array.from(new Set(encoded));
}
function loadDynamicProfiles() {
    var now = Date.now();
    var ttl = Number(process.env.DIRECT_SWAP_V4_HOOK_PROFILE_CACHE_MS || DEFAULT_PROFILE_TTL_MS);
    if (dynamicProfilesCache && now - dynamicProfilesCache.ts < ttl) {
        return dynamicProfilesCache.value;
    }
    var map = new Map();
    var raw = process.env.DIRECT_SWAP_V4_HOOK_PROFILES_JSON;
    if (!raw)
        return map;
    try {
        var parsed = JSON.parse(raw);
        for (var _i = 0, _a = Object.entries(parsed || {}); _i < _a.length; _i++) {
            var _b = _a[_i], chainIdRaw = _b[0], hooks = _b[1];
            var chainId = Number(chainIdRaw);
            if (!Number.isFinite(chainId) || !hooks || typeof hooks !== 'object')
                continue;
            for (var _c = 0, _d = Object.entries(hooks); _c < _d.length; _c++) {
                var _e = _d[_c], hookAddressRaw = _e[0], cfg = _e[1];
                var hookAddress = normalizeHookAddress(hookAddressRaw);
                if (hookAddress === HOOK_ZERO)
                    continue;
                var profile = {
                    chainId: chainId,
                    hookAddress: hookAddress,
                    family: parseFamily(cfg === null || cfg === void 0 ? void 0 : cfg.family),
                    requiresWalletAddress: Boolean(cfg === null || cfg === void 0 ? void 0 : cfg.requiresWalletAddress),
                    description: typeof (cfg === null || cfg === void 0 ? void 0 : cfg.description) === 'string' ? cfg.description : 'dynamic_profile',
                    quoteHookData: normalizeHookDataList(cfg === null || cfg === void 0 ? void 0 : cfg.quoteHookData),
                    executeHookData: normalizeHookDataList(cfg === null || cfg === void 0 ? void 0 : cfg.executeHookData)
                };
                map.set("".concat(chainId, ":").concat(hookAddress), profile);
            }
        }
    }
    catch (_f) {
        return map;
    }
    dynamicProfilesCache = { ts: now, value: map };
    return map;
}
function resolveV4HookProfile(chainId, hookAddress) {
    var normalizedHook = normalizeHookAddress(hookAddress);
    if (normalizedHook === HOOK_ZERO) {
        return {
            chainId: chainId,
            hookAddress: HOOK_ZERO,
            family: 'none',
            requiresWalletAddress: false,
            description: 'hookless_pool'
        };
    }
    var dynamic = loadDynamicProfiles().get("".concat(chainId, ":").concat(normalizedHook));
    if (dynamic)
        return dynamic;
    if (isClankerHook(chainId, normalizedHook)) {
        return {
            chainId: chainId,
            hookAddress: normalizedHook,
            family: 'clanker',
            requiresWalletAddress: true,
            description: 'clanker_mev_hook'
        };
    }
    var zoraHooks = exports.ZORA_HOOKS_BY_CHAIN[chainId] || [];
    if (zoraHooks.some(function (h) { return h.toLowerCase() === normalizedHook; })) {
        return {
            chainId: chainId,
            hookAddress: normalizedHook,
            family: 'zora',
            requiresWalletAddress: false,
            description: 'zora_creator_coin_hook'
        };
    }
    var dopplerHooks = exports.DOPPLER_HOOKS_BY_CHAIN[chainId] || [];
    if (dopplerHooks.some(function (h) { return h.toLowerCase() === normalizedHook; })) {
        return {
            chainId: chainId,
            hookAddress: normalizedHook,
            family: 'doppler',
            requiresWalletAddress: false,
            description: 'doppler_multicurve_hook'
        };
    }
    var flaunchHooks = exports.FLAUNCH_HOOKS_BY_CHAIN[chainId] || [];
    if (flaunchHooks.some(function (h) { return h.toLowerCase() === normalizedHook; })) {
        var referrer = String(process.env.DIRECT_SWAP_FLAUNCH_REFERRER_ADDRESS || '').trim();
        var refCandidates = buildAddressEncodedCandidates([referrer, HOOK_ZERO]);
        return {
            chainId: chainId,
            hookAddress: normalizedHook,
            family: 'flaunch',
            requiresWalletAddress: false,
            description: 'flaunch_position_manager_hook',
            quoteHookData: __spreadArray(__spreadArray([], refCandidates, true), ['0x'], false),
            executeHookData: __spreadArray(__spreadArray([], refCandidates, true), ['0x'], false)
        };
    }
    var customHooks = exports.CUSTOM_V4_HOOKS_BY_CHAIN[chainId] || [];
    if (customHooks.some(function (h) { return h.toLowerCase() === normalizedHook; })) {
        return {
            chainId: chainId,
            hookAddress: normalizedHook,
            family: 'custom',
            requiresWalletAddress: false,
            description: 'known_custom_hook'
        };
    }
    return {
        chainId: chainId,
        hookAddress: normalizedHook,
        family: 'unknown',
        requiresWalletAddress: false,
        description: 'unknown_hook_family'
    };
}
function buildV4HookDataCandidates(params) {
    var profile = resolveV4HookProfile(params.chainId, params.hookAddress);
    var isExecute = params.stage === 'execute';
    var staticCandidates = isExecute ? profile.executeHookData : profile.quoteHookData;
    var fallback = ['0x'];
    if (staticCandidates && staticCandidates.length > 0) {
        return Array.from(new Set(__spreadArray(__spreadArray([], staticCandidates, true), fallback, true)));
    }
    if (profile.family === 'clanker') {
        var wallet = String(params.walletAddress || '').trim();
        if (wallet) {
            return Array.from(new Set([buildClankerHookData(wallet), '0x']));
        }
    }
    return fallback;
}
