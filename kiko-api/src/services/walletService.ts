import { getWalletTransactions as fetchAlchemyTransactions, WalletBalance, getPortfolio } from './alchemy.js';
import prisma from '../db/prisma.js';
import { ethers } from 'ethers';
import { get as cacheGet, set as cacheSet } from '../cache/cacheClient.js';
import {
    readEvmTokenBalanceFast,
    readEvmTokenDecimalsFast,
    readNativeBalanceFast,
    readSolanaTokenBalanceFast,
} from './rpc/balanceRpcReader.js';
import { getWalletTransactionsForWalletPage } from './walletTransactionHistoryService.js';
import { syncPrivyEmbeddedWalletBindings } from './userWalletBindingService.js';

const ALL_BALANCES_CACHE_TTL_MS = 60_000;
// [Perf]: In-memory mirror of Redis cache for zero-latency repeat reads within same process.
// The 30s portfolioCache inside alchemy.ts handles dedup of concurrent Alchemy calls.
// This layer only caches the spam-filtered result from walletService level.
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

const SPAM_PATTERNS = [
    't.me', 'telegram', 'reward', 'airdrop', 'claim',
    'visit', 'bonus', 'promo', 'http', 'www', '.com',
    'winner', 'voucher', 'free'
];

function filterSpamTokens(balance: WalletBalance): WalletBalance {
    if (!balance.tokens || balance.tokens.length === 0) return balance;

    const filteredTokens = balance.tokens.filter((t: any) => {
        const tokenBalanceNum = parseFloat(String(t.tokenBalance || '0'));
        if (!Number.isFinite(tokenBalanceNum) || tokenBalanceNum <= 0) return false;

        const name = (t.name || '').toString();
        const symbolRaw = (t.symbol || '').toString();

        // 1. Check for explicit spam patterns in symbol or name
        const lowerSymbol = symbolRaw.toLowerCase();
        const lowerName = name.toLowerCase();
        if (SPAM_PATTERNS.some(p => lowerSymbol.includes(p) || lowerName.includes(p))) return false;

        // Balance-first behavior: keep non-spam tokens with positive balances.
        return true;
    });

    return { ...balance, tokens: filteredTokens };
}

function isNativeTokenAddress(tokenAddress: string, chain: string): boolean {
    const lower = String(tokenAddress || '').toLowerCase();
    if (chain === 'solana') {
        return lower === 'so11111111111111111111111111111111111111111' || lower === 'so11111111111111111111111111111111111111112';
    }
    return lower === '0x0000000000000000000000000000000000000000' || lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
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
            const rawBigInt = await readNativeBalanceFast({
                walletAddress: address,
                chainIdOrName: chain,
                path: 'wallet_service_fallback_native',
            });
            const raw = chain === 'solana' ? rawBigInt.toString() : `0x${rawBigInt.toString(16)}`;
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
    async getAllChainBalances(address: string, solanaAddress?: string, options?: { forceRefresh?: boolean }): Promise<Record<string, WalletBalance>> {
        const chains = ['eth', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'solana'];
        const cacheKey = `${address.toLowerCase()}::${(solanaAddress || '').toLowerCase()}`;
        const forceRefresh = options?.forceRefresh === true;
        const cached = allBalancesCache.get(cacheKey);
        if (!forceRefresh && cached && Date.now() - cached.timestamp < ALL_BALANCES_CACHE_TTL_MS) {
            return cached.data;
        }
        if (!forceRefresh) {
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
        }

        const inflight = allBalancesInflight.get(cacheKey);
        if (!forceRefresh && inflight) return inflight;

        // [Change]: Use getPortfolio instead of getNativeBalances to ensure all tokens are fetched
        // [Ref]: User request to fix missing tokens in balance view
        const promise = (async () => {
            const rawData = await getPortfolio(address, chains, solanaAddress, forceRefresh);
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
     * Get balance for a specific token address, bypassing portfolio-level token filtering.
     */
    async getTokenBalance(address: string, chain: string, tokenAddress: string, fallbackDecimals?: number): Promise<{ rawBalance: string; decimals: number; formatted: string }> {
        if (isNativeTokenAddress(tokenAddress, chain)) {
            const rawBigInt = await readNativeBalanceFast({
                walletAddress: address,
                chainIdOrName: chain,
                path: 'wallet_service_native_balance',
            });
            const raw = chain === 'solana' ? rawBigInt.toString() : `0x${rawBigInt.toString(16)}`;
            const decimals = chain === 'solana' ? 9 : 18;
            const formatted = chain === 'solana'
                ? (Number(raw) / 1e9).toString()
                : ethers.formatUnits(raw, decimals);
            return { rawBalance: raw, decimals, formatted };
        }

        if (chain !== 'solana') {
            const rawBigInt = await readEvmTokenBalanceFast({
                tokenAddress,
                walletAddress: address,
                chainId: chain,
                path: 'wallet_service_token_balance',
            });
            const decimals = await readEvmTokenDecimalsFast({
                tokenAddress,
                chainId: chain,
                path: 'wallet_service_token_decimals',
            }).catch(() => fallbackDecimals ?? 18);
            const formatted = ethers.formatUnits(rawBigInt, decimals);
            return {
                rawBalance: `0x${rawBigInt.toString(16)}`,
                decimals,
                formatted,
            };
        }

        try {
            const { balanceRaw, decimals } = await readSolanaTokenBalanceFast({
                walletAddress: address,
                tokenAddress,
                path: 'wallet_service_solana_token_balance',
            });
            return {
                rawBalance: `0x${balanceRaw.toString(16)}`,
                decimals,
                formatted: ethers.formatUnits(balanceRaw, decimals),
            };
        } catch {
            // Solana SPL fallback via portfolio lookup.
            const portfolio = await getPortfolio(address, ['solana'], address);
            const sol = portfolio.solana || { tokens: [] as any[] };
            const token = (sol.tokens || []).find((t: any) => String(t.contractAddress || '').toLowerCase() === tokenAddress.toLowerCase());
            const decimals = typeof token?.decimals === 'number' ? token.decimals : (fallbackDecimals ?? 9);
            const formatted = String(token?.tokenBalance || '0');
            let rawBalance = '0';
            try {
                rawBalance = `0x${ethers.parseUnits(formatted, decimals).toString(16)}`;
            } catch {
                rawBalance = '0';
            }
            return { rawBalance, decimals, formatted };
        }
    },

    /**
     * Get real-time transactions for an address
     */
    async getWalletTransactions(address: string, options: { chain?: string; limit?: number } = {}): Promise<any[]> {
        const chain = options.chain || 'eth';
        if (chain === 'solana' || chain === 'sol') {
            return await fetchAlchemyTransactions(address, chain, options.limit);
        }
        return await getWalletTransactionsForWalletPage(address, options);
    },

    async getAuthenticatedWalletBinding(userId: string) {
        return syncPrivyEmbeddedWalletBindings(userId);
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
            if (!isEvmAddress) return cached.allowed;
        }
        const accessCached = await cacheGet(accessRedisKey(cacheKey)).catch(() => null);
        if (accessCached) {
            const allowed = accessCached === '1';
            accessCache.set(cacheKey, { timestamp: Date.now(), allowed });
            if (!isEvmAddress) return allowed;
        }

        console.log('[verifyAccess] Checking access:', {
            userId,
            userIdLength: userId?.length,
            userIdPrefix: userId?.substring(0, 20),
            requestedAddress: address
        });

        const binding = await syncPrivyEmbeddedWalletBindings(userId);
        if (binding.status === 'conflict') {
            console.error('[verifyAccess] ❌ Access denied (Privy wallet binding conflict)', {
                userIdPrefix: userId?.substring(0, 20),
                requestedAddress: normalizedAddress,
                evmWalletAddress: binding.evmWalletAddress,
            });
            accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
            await cacheSet(accessRedisKey(cacheKey), '0', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
            return false;
        }

        const user = binding.user ?? await prisma.user.findFirst({
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

        if (!user) {
            console.log('[verifyAccess] ❌ User not found');
            accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
            await cacheSet(accessRedisKey(cacheKey), '0', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
            return false;
        }

        const dbEvmAddress = user.walletAddress?.toLowerCase();
        const dbSolanaAddress = user.solanaWalletAddress || null;
        const bindingEvmAddress = binding.evmWalletAddress?.toLowerCase() || null;
        const bindingSolanaAddress = binding.solanaWalletAddress || null;
        const isAddressMatch = isEvmAddress
            ? normalizedAddress === bindingEvmAddress || normalizedAddress === dbEvmAddress
            : address === bindingSolanaAddress ||
                address === dbSolanaAddress ||
                normalizedAddress === dbSolanaAddress?.toLowerCase();

        if (isAddressMatch) {
            accessCache.set(cacheKey, { timestamp: Date.now(), allowed: true });
            await cacheSet(accessRedisKey(cacheKey), '1', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
            console.log('[verifyAccess] ✅ Access granted');
            return true;
        }

        console.log('[verifyAccess] ❌ Access denied (address mismatch)', {
            requestedAddress: normalizedAddress,
            dbWalletAddress: dbEvmAddress,
            dbSolanaWalletAddress: dbSolanaAddress?.toLowerCase(),
            privyEvmWalletAddress: bindingEvmAddress,
            privySolanaWalletAddress: bindingSolanaAddress,
            privyDid: user.privyDid?.substring(0, 30) + '...',
            userId: user.id
        });
        accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
        await cacheSet(accessRedisKey(cacheKey), '0', Math.ceil(ACCESS_CACHE_TTL_MS / 1000)).catch(() => { });
        return false;
    }
};
