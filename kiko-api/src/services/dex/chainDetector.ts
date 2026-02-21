/**
 * Chain Detector
 * Automatically detects which chain a token exists on
 */

import { ethers } from 'ethers';
import { callRpc as callRpcRaw } from '../rpcManager.js';

const ERC20_ABI = ['function symbol() view returns (string)'];
const erc20Interface = new ethers.Interface(ERC20_ABI);

async function callRpc<T = any>(chainId: number, method: string, params: any): Promise<T> {
    return callRpcRaw<T>(chainId, method, params, {
        strategy: 'fast',
        importance: 'critical',
        exhaustiveFailover: true
    });
}

// Chains to check
const CHAINS_TO_CHECK = [
    { chainId: 8453, name: 'Base' },
    { chainId: 1, name: 'Ethereum' },
    { chainId: 56, name: 'BSC' },
    { chainId: 42161, name: 'Arbitrum' },
    { chainId: 137, name: 'Polygon' }
];

/**
 * Detect which chain(s) a token exists on
 * [Logic]: Tries to call symbol() on each chain
 */
export async function detectTokenChains(tokenAddress: string): Promise<number[]> {
    const normalizedAddress = ethers.getAddress(tokenAddress.toLowerCase());
    const foundChains: number[] = [];

    const symbolData = erc20Interface.encodeFunctionData('symbol');

    // Check all chains in parallel
    const results = await Promise.allSettled(
        CHAINS_TO_CHECK.map(async ({ chainId }) => {
            try {
                const result = await callRpc<string>(chainId, 'eth_call', [{
                    to: normalizedAddress,
                    data: symbolData
                }, 'latest']);

                if (result && result !== '0x' && result.length > 2) {
                    return chainId;
                }
                return null;
            } catch {
                return null;
            }
        })
    );

    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value !== null) {
            foundChains.push(result.value);
        }
    });

    return foundChains;
}

/**
 * Get token info with auto chain detection
 */
export async function getTokenWithChainDetection(tokenAddress: string): Promise<{
    address: string;
    chains: Array<{ chainId: number; name: string }>;
}> {
    const chainIds = await detectTokenChains(tokenAddress);

    const chains = chainIds.map(chainId => {
        const chain = CHAINS_TO_CHECK.find(c => c.chainId === chainId);
        return {
            chainId,
            name: chain?.name || `Chain ${chainId}`
        };
    });

    return {
        address: tokenAddress,
        chains
    };
}
