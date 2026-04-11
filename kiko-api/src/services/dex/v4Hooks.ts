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
import { ethers } from 'ethers';

// Clanker v4 hooks on Base.
// Official docs confirm the v4.0/v4.1 families below. Runtime-only variants stay
// in the registry, but must remain clearly labeled as observations.
export const CLANKER_HOOKS_BY_CHAIN: Record<number, string[]> = {
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
export const ZORA_HOOKS_BY_CHAIN: Record<number, string[]> = {
    8453: [
        '0xd61A675F8a0c67A73DC3B54FB7318B4D91409040', // Runtime-observed
        '0xc8d077444625eb300a427a6dfb2b1dbf9b159040', // Runtime-observed
        '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040' // Runtime-observed
    ]
};

// Doppler hooks / multicurve initializer hooks on Base.
// Public docs confirm callback semantics, `setHook` behavior, and dynamic-fee
// constraints, but not a complete raw Base address table in the retrieved page.
export const DOPPLER_HOOKS_BY_CHAIN: Record<number, string[]> = {
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
export const FLAUNCH_HOOKS_BY_CHAIN: Record<number, string[]> = {
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
export const CUSTOM_V4_HOOKS_BY_CHAIN: Record<number, string[]> = {
    8453: [
        // DeliHook (Base) - runtime-observed on CreatorBid-related v4 pools
        '0x570a48f96035c2874de1c0f13c5075a05683b0cc'
    ]
};

export type V4HookFamily = 'none' | 'clanker' | 'zora' | 'doppler' | 'flaunch' | 'custom' | 'unknown';
export type V4HookStage = 'quote' | 'execute';

export interface V4HookProfile {
    chainId: number;
    hookAddress: string;
    family: V4HookFamily;
    requiresWalletAddress: boolean;
    description?: string;
    quoteHookData?: string[];
    executeHookData?: string[];
}

interface DynamicV4HookProfileConfig {
    family?: string;
    requiresWalletAddress?: boolean;
    description?: string;
    quoteHookData?: string[];
    executeHookData?: string[];
}

const HOOK_ZERO = '0x0000000000000000000000000000000000000000';
const DEFAULT_PROFILE_TTL_MS = 60_000;
let dynamicProfilesCache: { ts: number; value: Map<string, V4HookProfile> } | null = null;

export function getKnownV4HooksByChain(chainId: number): string[] {
    const dynamic = Array.from(loadDynamicProfiles().values())
        .filter((p) => p.chainId === chainId && p.hookAddress !== HOOK_ZERO)
        .map((p) => p.hookAddress);
    return Array.from(new Set([
        ...(CLANKER_HOOKS_BY_CHAIN[chainId] || []),
        ...(ZORA_HOOKS_BY_CHAIN[chainId] || []),
        ...(DOPPLER_HOOKS_BY_CHAIN[chainId] || []),
        ...(FLAUNCH_HOOKS_BY_CHAIN[chainId] || []),
        ...(CUSTOM_V4_HOOKS_BY_CHAIN[chainId] || []),
        ...dynamic
    ].map((h) => h.toLowerCase())));
}

export function isClankerHook(chainId: number, hookAddress: string): boolean {
    const hooks = CLANKER_HOOKS_BY_CHAIN[chainId] || [];
    return hooks.some(h => h.toLowerCase() === hookAddress.toLowerCase());
}

export function buildClankerHookData(payee: string): string {
    // PoolSwapData: (bytes mevModuleSwapData, bytes poolExtensionSwapData)
    // mevModuleSwapData = abi.encode(address payee)
    const mevModuleSwapData = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [payee]);
    return ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes'], [mevModuleSwapData, '0x']);
}

function normalizeHookAddress(hookAddress?: string): string {
    const raw = String(hookAddress || '').trim().toLowerCase();
    if (!raw || raw === '0x') return HOOK_ZERO;
    return raw;
}

function normalizeHookDataList(input?: string[]): string[] {
    const list = (input || []).filter((v) => typeof v === 'string' && v.startsWith('0x'));
    return Array.from(new Set(list.map((v) => v.toLowerCase())));
}

function parseFamily(value: unknown): V4HookFamily {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'none' || normalized === 'clanker' || normalized === 'zora' || normalized === 'doppler' || normalized === 'flaunch' || normalized === 'custom' || normalized === 'unknown') {
        return normalized as V4HookFamily;
    }
    return 'custom';
}

function buildAddressEncodedCandidates(addresses: string[]): string[] {
    const encoded = addresses
        .map((addr) => String(addr || '').trim())
        .filter(Boolean)
        .map((addr) => {
            try {
                return ethers.AbiCoder.defaultAbiCoder()
                    .encode(['address'], [ethers.getAddress(addr)])
                    .toLowerCase();
            } catch {
                return '';
            }
        })
        .filter(Boolean);
    return Array.from(new Set(encoded));
}

function loadDynamicProfiles(): Map<string, V4HookProfile> {
    const now = Date.now();
    const ttl = Number(process.env.DIRECT_SWAP_V4_HOOK_PROFILE_CACHE_MS || DEFAULT_PROFILE_TTL_MS);
    if (dynamicProfilesCache && now - dynamicProfilesCache.ts < ttl) {
        return dynamicProfilesCache.value;
    }

    const map = new Map<string, V4HookProfile>();
    const raw = process.env.DIRECT_SWAP_V4_HOOK_PROFILES_JSON;
    if (!raw) return map;

    try {
        const parsed = JSON.parse(raw) as Record<string, Record<string, DynamicV4HookProfileConfig>>;
        for (const [chainIdRaw, hooks] of Object.entries(parsed || {})) {
            const chainId = Number(chainIdRaw);
            if (!Number.isFinite(chainId) || !hooks || typeof hooks !== 'object') continue;
            for (const [hookAddressRaw, cfg] of Object.entries(hooks)) {
                const hookAddress = normalizeHookAddress(hookAddressRaw);
                if (hookAddress === HOOK_ZERO) continue;
                const profile: V4HookProfile = {
                    chainId,
                    hookAddress,
                    family: parseFamily(cfg?.family),
                    requiresWalletAddress: Boolean(cfg?.requiresWalletAddress),
                    description: typeof cfg?.description === 'string' ? cfg.description : 'dynamic_profile',
                    quoteHookData: normalizeHookDataList(cfg?.quoteHookData),
                    executeHookData: normalizeHookDataList(cfg?.executeHookData)
                };
                map.set(`${chainId}:${hookAddress}`, profile);
            }
        }
    } catch {
        return map;
    }

    dynamicProfilesCache = { ts: now, value: map };
    return map;
}

export function resolveV4HookProfile(chainId: number, hookAddress?: string): V4HookProfile {
    const normalizedHook = normalizeHookAddress(hookAddress);
    if (normalizedHook === HOOK_ZERO) {
        return {
            chainId,
            hookAddress: HOOK_ZERO,
            family: 'none',
            requiresWalletAddress: false,
            description: 'hookless_pool'
        };
    }

    const dynamic = loadDynamicProfiles().get(`${chainId}:${normalizedHook}`);
    if (dynamic) return dynamic;

    if (isClankerHook(chainId, normalizedHook)) {
        return {
            chainId,
            hookAddress: normalizedHook,
            family: 'clanker',
            requiresWalletAddress: true,
            description: 'clanker_mev_hook'
        };
    }
    const zoraHooks = ZORA_HOOKS_BY_CHAIN[chainId] || [];
    if (zoraHooks.some((h) => h.toLowerCase() === normalizedHook)) {
        return {
            chainId,
            hookAddress: normalizedHook,
            family: 'zora',
            requiresWalletAddress: false,
            description: 'zora_creator_coin_hook'
        };
    }
    const dopplerHooks = DOPPLER_HOOKS_BY_CHAIN[chainId] || [];
    if (dopplerHooks.some((h) => h.toLowerCase() === normalizedHook)) {
        return {
            chainId,
            hookAddress: normalizedHook,
            family: 'doppler',
            requiresWalletAddress: false,
            description: 'doppler_multicurve_hook'
        };
    }
    const flaunchHooks = FLAUNCH_HOOKS_BY_CHAIN[chainId] || [];
    if (flaunchHooks.some((h) => h.toLowerCase() === normalizedHook)) {
        const referrer = String(process.env.DIRECT_SWAP_FLAUNCH_REFERRER_ADDRESS || '').trim();
        const refCandidates = buildAddressEncodedCandidates([referrer, HOOK_ZERO]);
        return {
            chainId,
            hookAddress: normalizedHook,
            family: 'flaunch',
            requiresWalletAddress: false,
            description: 'flaunch_position_manager_hook',
            quoteHookData: [...refCandidates, '0x'],
            executeHookData: [...refCandidates, '0x']
        };
    }
    const customHooks = CUSTOM_V4_HOOKS_BY_CHAIN[chainId] || [];
    if (customHooks.some((h) => h.toLowerCase() === normalizedHook)) {
        return {
            chainId,
            hookAddress: normalizedHook,
            family: 'custom',
            requiresWalletAddress: false,
            description: 'known_custom_hook'
        };
    }

    return {
        chainId,
        hookAddress: normalizedHook,
        family: 'unknown',
        requiresWalletAddress: false,
        description: 'unknown_hook_family'
    };
}

export function buildV4HookDataCandidates(params: {
    chainId: number;
    hookAddress?: string;
    walletAddress?: string;
    stage: V4HookStage;
}): string[] {
    const profile = resolveV4HookProfile(params.chainId, params.hookAddress);
    const isExecute = params.stage === 'execute';
    const staticCandidates = isExecute ? profile.executeHookData : profile.quoteHookData;
    const fallback: string[] = ['0x'];

    if (staticCandidates && staticCandidates.length > 0) {
        return Array.from(new Set([...staticCandidates, ...fallback]));
    }

    if (profile.family === 'clanker') {
        const wallet = String(params.walletAddress || '').trim();
        if (wallet) {
            return Array.from(new Set([buildClankerHookData(wallet), '0x']));
        }
    }

    return fallback;
}
