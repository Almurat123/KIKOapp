import { getWalletTransactions as fetchAlchemyTransactions, WalletBalance, getPortfolio, getNativeBalances } from './alchemy.js';
import prisma from '../db/prisma.js';

const ALL_BALANCES_CACHE_TTL_MS = 20_000;
const allBalancesCache = new Map<string, { timestamp: number; data: Record<string, WalletBalance> }>();
const allBalancesInflight = new Map<string, Promise<Record<string, WalletBalance>>>();

const ACCESS_CACHE_TTL_MS = 60_000;
const accessCache = new Map<string, { timestamp: number; allowed: boolean }>();

export const walletService = {
    /**
     * Get real-time balance for an address
     */
    async getWalletBalance(address: string, chain: string = 'eth'): Promise<WalletBalance> {
        const results = await getPortfolio(address, [chain]);
        return results[chain] || { ethBalance: '0', ethBalanceFormatted: 0, tokens: [] };
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

        const inflight = allBalancesInflight.get(cacheKey);
        if (inflight) return inflight;

        const promise = getNativeBalances(address, chains, solanaAddress);
        allBalancesInflight.set(cacheKey, promise);
        try {
            const data = await promise;
            allBalancesCache.set(cacheKey, { timestamp: Date.now(), data });
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

        console.log('[verifyAccess] Checking access:', { userId, requestedAddress: address });

        // Check if it's the user's primary wallet or solana wallet
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { privyDid: userId },
                    { id: userId }
                ]
            }
        });

        if (user) {
            const allowed =
                user.walletAddress.toLowerCase() === normalizedAddress ||
                user.solanaWalletAddress?.toLowerCase() === normalizedAddress;
            accessCache.set(cacheKey, { timestamp: Date.now(), allowed });
            if (allowed) console.log('[verifyAccess] ✅ Access granted');
            else console.log('[verifyAccess] ❌ Access denied (address mismatch)');
            return allowed;
        } else {
            console.log('[verifyAccess] ❌ User not found');
            if (!isEvmAddress) {
                // User model requires walletAddress (EVM). We do not auto-create users from non-EVM addresses.
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
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
                    return false;
                }

                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { privyDid: userId }
                });
                console.log('[verifyAccess] ✅ Access granted (attached privyDid to existing user)');
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: true });
                return true;
            }

            try {
                const created = await prisma.user.create({
                    data: { privyDid: userId, walletAddress: normalizedAddress }
                });
                console.log('[verifyAccess] ✅ Access granted (created user)', { userId: created.id });
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: true });
                return true;
            } catch (createError: any) {
                console.error('[verifyAccess] ❌ Failed to create user record', { error: createError.message });
                accessCache.set(cacheKey, { timestamp: Date.now(), allowed: false });
                return false;
            }
        }
    }
};
