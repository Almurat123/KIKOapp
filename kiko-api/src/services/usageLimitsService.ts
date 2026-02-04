import { env } from '../config/env.js';
import { getEmbeddedWalletAddress } from './privyWallet.js';
import { callRpc } from './rpcManager.js';

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
        ], { strategy: 'cheap' });
        return formatErc20Balance(String(data), env.usageLimits.tokenDecimals);
    } catch (error) {
        // Fallback to 0 on balance fetch errors to avoid breaking usage summary.
        return 0;
    }
}

export async function getUserDailyLimit(params: { userId: string }): Promise<{ limit: number; tokenBalance: number }> {
    const tokenBalance = await getUserTokenBalance({ userId: params.userId });
    const limit = computeDailyLimitFromBalance(tokenBalance);
    return { limit, tokenBalance };
}
