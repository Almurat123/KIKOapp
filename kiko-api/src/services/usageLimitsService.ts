import { env } from '../config/env.js';
import { getEmbeddedWalletAddress } from './privyWallet.js';
import { callRpc } from './rpcManager.js';
import { INTERACTIVE_READ_PROFILE } from './rpc/profile.js';

// Cache token balance + derived daily limit for a full day by default.
// This keeps chat sends from repeatedly re-checking chain state on every request.
const USAGE_LIMIT_CACHE_TTL_MS = Number(process.env.USAGE_LIMIT_CACHE_TTL_MS || String(24 * 60 * 60 * 1000));
const usageLimitCache = new Map<string, { expiresAt: number; value: { limit: number; tokenBalance: number } }>();
const usageLimitInflight = new Map<string, Promise<{ limit: number; tokenBalance: number }>>();

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
    const base = env.usageLimits.baseDailyLimit;
    const tiers = env.usageLimits.tiers || [];
    let limit = base;
    for (const tier of tiers) {
        if (balance >= tier.minBalance) {
            limit = Math.max(limit, tier.dailyLimit);
        }
    }
    return limit;
}

export async function getUserTokenBalance(params: { userId: string }): Promise<number> {
    if (!env.usageLimits.tokenAddress) return 0;
    try {
        const walletAddress = await getEmbeddedWalletAddress(params.userId);
        if (!walletAddress) return 0;
        const data = await callRpc('base', 'eth_call', [
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
    const now = Date.now();
    const cached = usageLimitCache.get(params.userId);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const inflight = usageLimitInflight.get(params.userId);
    if (inflight) return inflight;

    const request = (async () => {
        const tokenBalance = await getUserTokenBalance({ userId: params.userId });
        const limit = computeDailyLimitFromBalance(tokenBalance);
        const value = { limit, tokenBalance };
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
