import { ethers } from 'ethers';

// Clanker V4 hooks (MEV auction hooks require hookData)
// [Ref]: https://clanker.gitbook.io/clanker-documentation/references/core-contracts/v4
export const CLANKER_HOOKS_BY_CHAIN: Record<number, string[]> = {
    8453: [
        '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc', // ClankerHookStaticFeeV2 v4.1.0
        '0xd60d6b218116cfd801e28f78d011a203d2b068cc', // ClankerHookDynamicFeeV2 v4.1.0
        '0x34a45c6b61876d739400bd71228cbcbd4f53e8cc', // ClankerHookDynamicFee v4.0.0
        '0xdd5eeaff7bd481ad55db083062b13a3cdf0a68cc', // ClankerHookStaticFee v4.0.0
        '0x7debe6943acefe85c4ee81aadd736466e07528cc', // Clanker hook variant seen in recent Base txs
    ]
};

// Zora creator coin hooks (v4)
export const ZORA_HOOKS_BY_CHAIN: Record<number, string[]> = {
    8453: [
        '0xd61A675F8a0c67A73DC3B54FB7318B4D91409040',
        '0xc8d077444625eb300a427a6dfb2b1dbf9b159040',
        '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040'
    ]
};

export type V4HookFamily = 'none' | 'clanker' | 'zora' | 'custom' | 'unknown';
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
    if (normalized === 'none' || normalized === 'clanker' || normalized === 'zora' || normalized === 'custom' || normalized === 'unknown') {
        return normalized as V4HookFamily;
    }
    return 'custom';
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
