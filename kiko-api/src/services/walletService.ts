import { getWalletTransactions as fetchAlchemyTransactions, WalletBalance, getPortfolio } from './alchemy.js';
import prisma from '../db/prisma.js';

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
        return await getPortfolio(address, chains, solanaAddress);
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

        console.log('[verifyAccess] Checking access:', {
            userId,
            requestedAddress: address,
            normalizedAddress
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

        if (user) {
            console.log('[verifyAccess] Found user:', {
                userId: user.id,
                walletAddress: user.walletAddress,
                solanaWalletAddress: user.solanaWalletAddress,
                walletMatch: user.walletAddress.toLowerCase() === normalizedAddress,
                solanaMatch: user.solanaWalletAddress?.toLowerCase() === normalizedAddress
            });

            if (user.walletAddress.toLowerCase() === normalizedAddress ||
                user.solanaWalletAddress?.toLowerCase() === normalizedAddress) {
                console.log('[verifyAccess] ✅ Access granted');
                return true;
            }
        } else {
            console.log('[verifyAccess] ❌ User not found');
        }

        console.log('[verifyAccess] ❌ Access denied');
        return false;
    }
};
