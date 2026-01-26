/**
 * Approval Manager
 * Smart approval strategy to eliminate approval delays
 */

import { ethers } from 'ethers';
import { getChainConfig } from '../config/chainConfig.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

interface ApprovalCache {
    token: string;
    spender: string;
    chainId: number;
    allowance: string;
    checkedAt: number;
}

class ApprovalManagerClass {
    private cache: Map<string, ApprovalCache> = new Map();
    private readonly CACHE_TTL = 30000; // 30 seconds

    /**
     * Check if approval is needed with caching
     */
    async checkNeedsApproval(
        walletAddress: string,
        tokenAddress: string,
        spenderAddress: string,
        requiredAmount: string,
        chainId: number
    ): Promise<{ needed: boolean; currentAllowance: string }> {
        const cacheKey = this.getCacheKey(walletAddress, tokenAddress, spenderAddress, chainId);
        const cached = this.cache.get(cacheKey);

        // Use cache if fresh
        if (cached && Date.now() - cached.checkedAt < this.CACHE_TTL) {
            const needed = BigInt(cached.allowance) < BigInt(requiredAmount);
            console.log('[ApprovalManager] Cache hit:', { needed, allowance: cached.allowance });
            return { needed, currentAllowance: cached.allowance };
        }

        // Check on-chain
        try {
            const config = getChainConfig(chainId);
            const provider = new ethers.JsonRpcProvider(config.rpcUrls[0]);
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function allowance(address owner, address spender) view returns (uint256)'],
                provider
            );

            const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
            const allowanceStr = allowance.toString();

            // Cache the result
            this.cache.set(cacheKey, {
                token: tokenAddress,
                spender: spenderAddress,
                chainId,
                allowance: allowanceStr,
                checkedAt: Date.now()
            });

            const needed = BigInt(allowanceStr) < BigInt(requiredAmount);

            logger.info(LogCode.EXE_TX_BROADCAST, 'Approval check completed', {
                token: tokenAddress.slice(0, 10),
                spender: spenderAddress.slice(0, 10),
                currentAllowance: allowanceStr,
                requiredAmount,
                needed
            });

            return { needed, currentAllowance: allowanceStr };

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Approval check failed', {
                error: error.message
            });
            // Conservative: assume approval needed if check fails
            return { needed: true, currentAllowance: '0' };
        }
    }

    /**
     * Invalidate cache for a specific approval
     */
    invalidateCache(walletAddress: string, tokenAddress: string, spenderAddress: string, chainId: number): void {
        const key = this.getCacheKey(walletAddress, tokenAddress, spenderAddress, chainId);
        this.cache.delete(key);
    }

    /**
     * Check if using infinite approval (recommended strategy)
     */
    shouldUseInfiniteApproval(tokenAddress: string): boolean {
        // Always use infinite approval for better UX
        // User only needs to approve once per token-spender pair
        return true;
    }

    private getCacheKey(wallet: string, token: string, spender: string, chainId: number): string {
        return `${chainId}:${wallet.toLowerCase()}:${token.toLowerCase()}:${spender.toLowerCase()}`;
    }
}

export const ApprovalManager = new ApprovalManagerClass();
