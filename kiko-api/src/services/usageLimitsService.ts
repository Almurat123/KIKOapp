import { env } from '../config/env.js';
import { getEmbeddedWalletAddress } from './privyWallet.js';
import { getBalanceOptimized } from './balanceCache.js';

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
    const walletAddress = await getEmbeddedWalletAddress(params.userId);
    if (!walletAddress) return 0;
    // Use balanceCache for rate-limited, low-latency balance reads.
    return getBalanceOptimized(params.userId, walletAddress, 'base', env.usageLimits.tokenAddress);
}

export async function getUserDailyLimit(params: { userId: string }): Promise<{ limit: number; tokenBalance: number }> {
    const tokenBalance = await getUserTokenBalance({ userId: params.userId });
    const limit = computeDailyLimitFromBalance(tokenBalance);
    return { limit, tokenBalance };
}

