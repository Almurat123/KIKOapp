import { env, type UsageLimitTier } from '../config/env.js';
import { getEmbeddedWalletAddress } from './privyWallet.js';
import { callRpc } from './rpcManager.js';
import { INTERACTIVE_READ_PROFILE } from './rpc/profile.js';

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: token-holder quota logic still existed after the free/premium quota
//         rework, but chat enforcement stopped consuming it. The holder-tier
//         layer now has to resolve one per-user free-model limit and one
//         premium-model limit so chat gating and usage summary both follow the
//         same token-tier policy again.
// Goal: keep holder-tier quota resolution as the single source of truth for
//       user-specific chat limits whenever token gating is configured.
// Owns: token balance reads, per-user holder-tier quota resolution, and cache
//       reuse for repeated chat/summary reads.
// Does Not Own: model-family classification, request allow/deny messaging, or
//               UI rendering.
// Design Language:
// - If token gating is configured, user chat quota must come from the matched tier.
// - `dailyLimit` remains a backward-compatible premium-limit alias for legacy tiers.
// - `freeModelLimit` of `0` means unlimited free-model traffic at the KIKO layer.
// - If token gating is not configured, billing env quotas are the only fallback.
// - Balance fetch failures must degrade to the zero-balance tier, not break chat.
// Document Provenance:
// - Source: operator quota-policy correction for token-tier chat quota rebinding
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: reattaching holder tiers to free/premium chat quotas
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-api/src/config/env.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: normalized dual-limit tier parsing and billing-env fallback semantics
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

// Cache token balance + derived daily limit for a full day by default.
// This keeps chat sends from repeatedly re-checking chain state on every request.
const USAGE_LIMIT_CACHE_TTL_MS = Number(process.env.USAGE_LIMIT_CACHE_TTL_MS || String(24 * 60 * 60 * 1000));
export type ResolvedUsageQuota = {
    freeModelLimit: number;
    premiumLimit: number;
    dailyLimit: number;
    tokenBalance: number;
    matchedTier: UsageLimitTier | null;
    source: 'billing_env' | 'token_tier';
};

const usageLimitCache = new Map<string, { expiresAt: number; value: ResolvedUsageQuota }>();
const usageLimitInflight = new Map<string, Promise<ResolvedUsageQuota>>();

export function getUsageLimitRpcChain(): number {
    return env.usageLimits.chainId;
}

function getBillingFallbackQuota(): ResolvedUsageQuota {
    return {
        freeModelLimit: env.billing.dailyFreeModelLimit,
        premiumLimit: env.billing.dailyFreePremium,
        dailyLimit: env.billing.dailyFreePremium,
        tokenBalance: 0,
        matchedTier: null,
        source: 'billing_env',
    };
}

function encodeBalanceOf(walletAddress: string): string {
    const address = walletAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    return `0x70a08231${address}`;
}

function formatErc20Balance(rawHex: string, decimals: number): number {
    if (!rawHex || rawHex === '0x') return 0;
    const raw = BigInt(rawHex);
    if (decimals <= 0) return Number(raw);
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 6);
    return Number(`${whole.toString()}.${fractionStr}`);
}

export function computeDailyLimitFromBalance(balance: number): number {
    return computeUsageQuotaFromBalance(balance).dailyLimit;
}

export function computeUsageQuotaFromBalance(balance: number): ResolvedUsageQuota {
    const tiers = env.usageLimits.tiers || [];
    const fallback = getBillingFallbackQuota();
    let matchedTier: UsageLimitTier | null = null;

    for (const tier of tiers) {
        if (balance >= tier.minBalance) {
            matchedTier = tier;
        }
    }

    if (!matchedTier) {
        return {
            ...fallback,
            tokenBalance: balance,
            source: 'token_tier',
        };
    }

    return {
        freeModelLimit: Math.max(0, matchedTier.freeModelLimit),
        premiumLimit: Math.max(0, matchedTier.premiumLimit),
        dailyLimit: Math.max(0, matchedTier.dailyLimit),
        tokenBalance: balance,
        matchedTier,
        source: 'token_tier',
    };
}

export async function getUserTokenBalance(params: { userId: string }): Promise<number> {
    if (!env.usageLimits.tokenAddress) return 0;
    try {
        const walletAddress = await getEmbeddedWalletAddress(params.userId);
        if (!walletAddress) return 0;
        const data = await callRpc(getUsageLimitRpcChain(), 'eth_call', [
            {
                to: env.usageLimits.tokenAddress,
                data: encodeBalanceOf(walletAddress)
            },
            'latest'
        ], {
            strategy: INTERACTIVE_READ_PROFILE.strategy,
            purpose: INTERACTIVE_READ_PROFILE.purpose,
            importance: INTERACTIVE_READ_PROFILE.importance,
            path: 'usage_limit_balance',
        });
        return formatErc20Balance(String(data), env.usageLimits.tokenDecimals);
    } catch (error) {
        // Fallback to 0 on balance fetch errors to avoid breaking usage summary.
        return 0;
    }
}

export async function getUserDailyLimit(params: { userId: string }): Promise<{ limit: number; tokenBalance: number }> {
    const resolved = await getUserUsageQuota(params);
    return {
        limit: resolved.dailyLimit,
        tokenBalance: resolved.tokenBalance,
    };
}

export async function getUserUsageQuota(params: { userId: string }): Promise<ResolvedUsageQuota> {
    if (!env.usageLimits.tokenAddress) {
        return getBillingFallbackQuota();
    }

    const now = Date.now();
    const cached = usageLimitCache.get(params.userId);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const inflight = usageLimitInflight.get(params.userId);
    if (inflight) return inflight;

    const request = (async () => {
        const tokenBalance = await getUserTokenBalance({ userId: params.userId });
        const value = computeUsageQuotaFromBalance(tokenBalance);
        usageLimitCache.set(params.userId, { expiresAt: Date.now() + USAGE_LIMIT_CACHE_TTL_MS, value });
        return value;
    })();

    usageLimitInflight.set(params.userId, request);
    try {
        return await request;
    } finally {
        usageLimitInflight.delete(params.userId);
    }
}
