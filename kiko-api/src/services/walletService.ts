import { getWalletTransactions as fetchAlchemyTransactions, WalletBalance, getPortfolio, getNativeBalances } from './alchemy.js';
import prisma from '../db/prisma.js';
import { getNativeBalance } from './rpcManager.js';
import { ethers } from 'ethers';
import { get as cacheGet, set as cacheSet } from '../cache/cacheClient.js';

const ALL_BALANCES_CACHE_TTL_MS = 60_000; // 增加到 60 秒，减少 RPC 调用
const allBalancesCache = new Map<string, { timestamp: number; data: Record<string, WalletBalance> }>();
const allBalancesInflight = new Map<string, Promise<Record<string, WalletBalance>>>();

const ACCESS_CACHE_TTL_MS = 60_000;
const accessCache = new Map<string, { timestamp: number; allowed: boolean }>();

function allBalancesRedisKey(cacheKey: string): string {
    return `wallet:all_balances:${cacheKey}`;
}

function accessRedisKey(cacheKey: string): string {
    return `wallet:access:${cacheKey}`;
}

const TRUSTED_SYMBOLS = new Set([
    'USDC', 'USDT', 'DAI', 'USDBC', 'USDbC',
    'ETH', 'WETH', 'BTC', 'WBTC',
    'MATIC', 'WMATIC', 'SOL', 'BNB',
    'POL', 'OP', 'ARB'
]);
const MIN_VALUE_USD = 0.05; // Lowered to $0.05 to catch small but real balances (e.g. dust)
const SPAM_PATTERNS = [
    't.me', 'telegram', 'reward', 'airdrop', 'claim',
    'visit', 'bonus', 'promo', 'http', 'www', '.com',
    'winner', 'voucher', 'free'
];

function filterSpamTokens(balance: WalletBalance): WalletBalance {
    if (!balance.tokens || balance.tokens.length === 0) return balance;

    const filteredTokens = balance.tokens.filter((t: any) => {
        const symbol = (t.symbol || '').toUpperCase();
        const name = (t.name || '').toString();
        const symbolRaw = (t.symbol || '').toString();

        // 1. Check for explicit spam patterns in symbol or name
        const lowerSymbol = symbolRaw.toLowerCase();
        const lowerName = name.toLowerCase();
        if (SPAM_PATTERNS.some(p => lowerSymbol.includes(p) || lowerName.includes(p))) return false;

        // 2. Always keep trusted tokens/stables regardless of value
        if (TRUSTED_SYMBOLS.has(symbol)) return true;

        // 3. Keep tokens with meaningful USD value
        if (t.valueUsd && t.valueUsd >= MIN_VALUE_USD) return true;

        // 4. If legacy 'price' field exists and value > threshold
        const usd = typeof t.valueUsd === 'number' ? t.valueUsd : (parseFloat(t.tokenBalance) * (t.price || 0));
        if (usd >= MIN_VALUE_USD) return true;

        return false;
    });

    return { ...balance, tokens: filteredTokens };
}

export const walletService = {
    /**
     * Get real-time balance for an address
     * Filters out spam/low-value tokens to keep AI context clean
     */
    async getWalletBalance(address: string, chain: string = 'eth'): Promise<WalletBalance> {
        try {
            const results = await getPortfolio(address, [chain]);
            const balance = results[chain] || { ethBalance: '0', ethBalanceFormatted: 0, tokens: [] };
            return filterSpamTokens(balance);
        } catch (err) {
            // Fallback to direct RPC (native balance only)
            const raw = await getNativeBalance(address, chain);
            let formatted = 0;
            try {
                if (chain === 'solana') {
                    formatted = Number(raw) / 1e9;
                } else {
                    formatted = Number(ethers.formatEther(raw));
                }
            } catch {
                formatted = 0;
            }
            return { ethBalance: raw, ethBalanceFormatted: formatted, tokens: [] };
        }
    },

    /**
     * Get real-time balance for all supported chains
     */
    async getAllChainBalances(address: string, solanaAddress?: string): Promise<Record<string, WalletBalance>> {
        const chains = ['eth', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'solana'];
        const cacheKey = `${address.toLowerCase()}::${(solanaAddress || '').toLowerCase()}`;
        const cached = allBalancesCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ALL_BALANCES_CACHE_TTL_MS) {
            return cached.data;
        }
        const redisCached = await cacheGet(allBalancesRedisKey(cacheKey)).catch(() => null);
        if (redisCached) {
            try {
                const parsed = JSON.parse(redisCached) as Record<string, WalletBalance>;
                allBalancesCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
                return parsed;
            } catch {
                // ignore redis parse error and continue
            }
        }

        const inflight = allBalancesInflight.get(cacheKey);
        if (inflight) return inflight;

        // [Change]: Use getPortfolio instead of getNativeBalances to ensure all tokens are fetched
        // [Ref]: User request to fix missing tokens in balance view
        const promise = (async () => {
            const rawData = await getPortfolio(address, chains, solanaAddress);
            const filteredData: Record<string, WalletBalance> = {};

            for (const [chain, balance] of Object.entries(rawData)) {
                filteredData[chain] = filterSpamTokens(balance);
            }
            return filteredData;
        })();

        allBalancesInflight.set(cacheKey, promise);
        try {
            const data = await promise;
            allBalancesCache.set(cacheKey, { timestamp: Date.now(), data });
            await cacheSet(allBalancesRedisKey(cacheKey), JSON.stringify(data), Math.ceil(ALL_BALANCES_CACHE_TTL_MS / 1000)).catch(() => { });
            return data;
        } catch (error) {
            if (cached) return cached.data;
            throw error;
        } finally {
            allBalancesInflight.delete(cacheKey);
        }
    },

    /**
     * Get real-time transactions for an address
     */
    async getWalletTransactions(address: string, options: { chain?: string; limit?: number } = {}): Promise<any[]> {
        return await fetchAlchemyTransactions(address, options.chain || 'eth', options.limit);
    },

    /**
     * Verify if a user has access to a specific wallet address
     */
    async verifyAccess(userId: string, address: string): Promise<boolean> {
        const normalizedAddress = address.toLowerCase();
        const isEvmAddress = normalizedAddress.startsWith('0x') && normalizedAddress.length === 42;

        const cacheKey = `${userId}::${normalizedAddress}`;
        const cached = accessCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ACCESS_CACHE_TTL_MS) {
            return cached.allowed;
        }
        const accessCached = await cacheGet(accessRedisKey(cacheKey)).catch(() => null);
        if (accessCached) {
            const allowed = accessCached === '1';
            accessCache.set(cacheKey, { timestamp: Date.now(), allowed });
            return allowed;
        }

        console.log('[verifyAccess] Checking access:', {
            userId,
            userIdLength: userId?.length,
            userIdPrefix: userId?.substring(0, 20),
            requestedAddress: address
        });

        // Check if it's the user's primary wallet or solana wallet
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { privyDid: userId },
                    { id: userId }
                ]
            }
        });

        if (!user) {
            // Additional debug: Try to find any user by wallet address
            const userByWallet = await prisma.user.findFirst({
                where: { walletAddress: normalizedAddress }
            });
            console.log('[verifyAccess] Debug - User lookup failed:', {
                searchedPrivyDid: userId,
                foundUserByWallet: userByWallet ? {
                    id: userByWallet.id,
                    privyDid: userByWallet.privyDid?.substring(0, 25) + '...',
                    walletAddress: userByWallet.walletAddress
                } : null
            });
        }

        if (user) {
            const isAddressMatch =
                user.walletAddress.toLowerCase() === normalizedAddress ||
                user.solanaWalletAddress?.toLowerCase() === normalizedAddress ||
                // Solana addresses are base58 (case-sensitive), but we normalize to be safe for legacy/db consistency.
                // Re-checking against raw address for Solana specifically.
                user.solanaWalletAddress === address;

            if (isAddressMatch) {
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: true });
                await cacheSet(accessRedisKey(cacheKey), '1', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
                console.log('[verifyAccess] ✅ Access granted');
                return true;
            }

            // [Logic]: Auto-link Solana wallet if missing but requested by authorized user.
            const isSolanaAddress = !isEvmAddress && address.length >= 32 && address.length <= 44;
            if (isSolanaAddress && !user.solanaWalletAddress) {
                console.log('[verifyAccess] 🔄 Auto-linking Solana wallet for user:', { userId, address });
                await prisma.user.update({
                    where: { id: user.id },
                    data: { solanaWalletAddress: address }
                });
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: true });
                await cacheSet(accessRedisKey(cacheKey), '1', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
                return true;
            }

            // DEBUG: Log the actual mismatch details
            console.log('[verifyAccess] ❌ Access denied (address mismatch)', {
                requestedAddress: normalizedAddress,
                dbWalletAddress: user.walletAddress?.toLowerCase(),
                dbSolanaWalletAddress: user.solanaWalletAddress?.toLowerCase(),
                privyDid: user.privyDid?.substring(0, 30) + '...',
                userId: user.id
            });
            accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
            await cacheSet(accessRedisKey(cacheKey), '0', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
            return false;
        } else {
            console.log('[verifyAccess] ❌ User not found');
            if (!isEvmAddress) {
                // User model requires walletAddress (EVM). We do not auto-create users from non-EVM addresses.
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
                await cacheSet(accessRedisKey(cacheKey), '0', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
                return false;
            }
            const existingUser = await prisma.user.findFirst({
                where: { walletAddress: normalizedAddress }
            });

            if (existingUser) {
                if (existingUser.privyDid && existingUser.privyDid !== userId) {
                    console.error('[verifyAccess] ❌ Address owned by another user', {
                        requestedAddress: normalizedAddress,
                        owner: existingUser.privyDid
                    });
                    accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
                    await cacheSet(accessRedisKey(cacheKey), '0', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
                    return false;
                }

                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { privyDid: userId }
                });
                console.log('[verifyAccess] ✅ Access granted (attached privyDid to existing user)');
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: true });
                await cacheSet(accessRedisKey(cacheKey), '1', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
                return true;
            }

            try {
                const created = await prisma.user.create({
                    data: { privyDid: userId, walletAddress: normalizedAddress }
                });
                console.log('[verifyAccess] ✅ Access granted (created user)', { userId: created.id });
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: true });
                await cacheSet(accessRedisKey(cacheKey), '1', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
                return true;
            } catch (createError: any) {
                console.error('[verifyAccess] ❌ Failed to create user record', { error: createError.message });
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
                await cacheSet(accessRedisKey(cacheKey), '0', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
                return false;
            }
        }
    }
};
