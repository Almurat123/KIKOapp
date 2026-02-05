/**
 * Flashbots MEV Protection Service
 * Sends private transactions to avoid front-running and sandwich attacks
 * 
 * [Ref]: https://docs.flashbots.net/flashbots-protect/overview
 * [Risk]: Only works on ETH mainnet (chainId: 1)
 */

import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { callRpcCustom } from '../rpcManager.js';
import { getFlashbotsEndpoints } from '../../config/apiEndpoints.js';

export interface FlashbotsConfig {
    useFlashbots: boolean;
    preferFast: boolean;  // Use fast mode (less MEV protection, faster inclusion)
    maxBlocksToWait: number;  // Max blocks to wait for inclusion
}

export interface FlashbotsResult {
    success: boolean;
    txHash?: string;
    blockNumber?: number;
    error?: string;
    usedFlashbots: boolean;
}

/**
 * Send transaction via Flashbots Protect
 * [Logic]: Submits to private mempool, avoiding public exposure
 * 
 * @param signedTx - Signed transaction hex string
 * @param chainId - Chain ID (must be 1 for Flashbots)
 * @param config - Flashbots configuration
 */
export async function sendViaFlashbots(
    signedTx: string,
    chainId: number,
    config: FlashbotsConfig = { useFlashbots: true, preferFast: false, maxBlocksToWait: 25 }
): Promise<FlashbotsResult> {
    // Flashbots only works on ETH mainnet
    if (chainId !== 1) {
        logger.debug(LogCode.API_FETCH_FAILED, 'Flashbots only supported on ETH mainnet', { chainId });
        return {
            success: false,
            error: 'Flashbots only supported on ETH mainnet',
            usedFlashbots: false
        };
    }

    if (!config.useFlashbots) {
        return {
            success: false,
            error: 'Flashbots disabled',
            usedFlashbots: false
        };
    }

    try {
        const endpoints = getFlashbotsEndpoints();
        const fast = endpoints.find(ep => ep.name.toLowerCase().includes('fast'));
        const standard = endpoints.find(ep => !ep.name.toLowerCase().includes('fast'));
        const ordered = config.preferFast
            ? [fast, standard].filter(Boolean) as typeof endpoints
            : [standard, fast].filter(Boolean) as typeof endpoints;

        logger.info(LogCode.API_FETCH_SUCCESS, '🔒 Sending via Flashbots Protect', {
            mode: config.preferFast ? 'fast' : 'standard'
        });

        const txHash = await callRpcCustom<string>(
            ordered.length > 0 ? ordered : endpoints,
            'eth_sendRawTransaction',
            [signedTx],
            { importance: 'critical' }
        );

        logger.info(LogCode.API_FETCH_SUCCESS, '✅ Flashbots transaction submitted', {
            txHash,
            mode: config.preferFast ? 'fast' : 'standard'
        });

        return {
            success: true,
            txHash,
            usedFlashbots: true
        };
    } catch (err: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Flashbots request failed', {
            error: err.message
        });
        return {
            success: false,
            error: err.message,
            usedFlashbots: false
        };
    }
}

/**
 * Wait for Flashbots transaction confirmation
 * [Logic]: Poll for transaction receipt
 */
export async function waitForFlashbotsConfirmation(
    txHash: string,
    provider: ethers.Provider,
    maxBlocksToWait: number = 25
): Promise<{ confirmed: boolean; receipt?: ethers.TransactionReceipt }> {
    const startBlock = await provider.getBlockNumber();

    for (let i = 0; i < maxBlocksToWait; i++) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) {
                logger.info(LogCode.API_FETCH_SUCCESS, '✅ Flashbots tx confirmed', {
                    txHash,
                    blockNumber: receipt.blockNumber,
                    blocksWaited: i
                });
                return { confirmed: true, receipt };
            }
        } catch {
            // Continue polling
        }

        // Wait for next block (~12s on ETH mainnet)
        await new Promise(resolve => setTimeout(resolve, 3000));

        const currentBlock = await provider.getBlockNumber();
        if (currentBlock >= startBlock + maxBlocksToWait) {
            break;
        }
    }

    logger.warn(LogCode.API_FETCH_FAILED, 'Flashbots tx not confirmed in time', {
        txHash,
        maxBlocksToWait
    });
    return { confirmed: false };
}

/**
 * Check if MEV protection should be used based on transaction value
 * [Logic]: Large swaps benefit more from MEV protection
 */
export function shouldUseMevProtection(
    amountInWei: bigint,
    chainId: number,
    forceEnable?: boolean
): boolean {
    // Only ETH mainnet supports Flashbots
    if (chainId !== 1) {
        return false;
    }

    if (forceEnable === true) {
        return true;
    }

    if (forceEnable === false) {
        return false;
    }

    // Auto-enable for swaps > 0.5 ETH
    const threshold = BigInt('500000000000000000'); // 0.5 ETH
    return amountInWei >= threshold;
}

/**
 * Get Flashbots bundle status (for advanced usage)
 * [Ref]: https://docs.flashbots.net/flashbots-auction/advanced/bundle-status
 */
export async function getBundleStatus(bundleHash: string): Promise<any> {
    try {
        const endpoints = getFlashbotsEndpoints();
        return await callRpcCustom<any>(
            endpoints,
            'flashbots_getBundleStats',
            [{ bundleHash }],
            { importance: 'normal' }
        );
    } catch {
        return null;
    }
}
