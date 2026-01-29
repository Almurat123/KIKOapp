import { getWalletTransactions as fetchAlchemyTransactions, WalletBalance, getPortfolio, getNativeBalances } from './alchemy.js';
import prisma from '../db/prisma.js';

const ALL_BALANCES_CACHE_TTL_MS = 60_000; // 增加到 60 秒，减少 RPC 调用
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
            return false;
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
