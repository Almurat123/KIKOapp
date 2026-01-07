/**
 * RPC Manager Service
 * Manages multiple RPC endpoints with automatic failover
 */

import { env } from '../config/env.js';

// Default Ankr key provided by user in prc.txt
const DEFAULT_ANKR_KEY = '8f96ed785d9086a7b8fa113a9a01953b11699182d24bee50c89d7d2ca74ab0b3';

// RPC endpoint configurations
export const RPC_ENDPOINTS = {
    eth: [
        'https://ethereum-rpc.publicnode.com',
        'https://eth.drpc.org',
        `https://rpc.ankr.com/eth/${env.apiKeys.ankr || ''}`,
    ],
    base: [
        'https://base-rpc.publicnode.com',
        'https://base.drpc.org',
        `https://rpc.ankr.com/base/${env.apiKeys.ankr || ''}`,
    ],
    bsc: [
        'https://bsc-rpc.publicnode.com',
        'https://bsc.drpc.org',
        `https://rpc.ankr.com/bsc/${env.apiKeys.ankr || ''}`,
    ],
    polygon: [
        'https://polygon-bor-rpc.publicnode.com',
        'https://polygon.drpc.org',
        `https://rpc.ankr.com/polygon/${env.apiKeys.ankr || ''}`,
    ],
    arbitrum: [
        'https://arbitrum-one-rpc.publicnode.com',
        'https://arbitrum.drpc.org',
        `https://rpc.ankr.com/arbitrum/${env.apiKeys.ankr || ''}`,
    ],
    optimism: [
        'https://optimism-rpc.publicnode.com',
        'https://optimism.drpc.org',
    ],
    solana: [
        'https://solana-rpc.publicnode.com',
        'https://solana.drpc.org',
        `https://rpc.ankr.com/solana/${env.apiKeys.ankr || DEFAULT_ANKR_KEY}`,
        env.apiKeys.helius ? `https://mainnet.helius-rpc.com/${env.apiKeys.helius}` : '',
    ].filter(Boolean),
};

// Chain ID to chain name mapping
const CHAIN_ID_TO_NAME: Record<number, keyof typeof RPC_ENDPOINTS> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    900: 'solana',
};

interface RpcRequest {
    jsonrpc: string;
    id: number;
    method: string;
    params: any[];
}

interface RpcResponse<T = any> {
    jsonrpc: string;
    id: number;
    result?: T;
    error?: {
        code: number;
        message: string;
    };
}

/**
 * Make an RPC call with automatic failover
 */
export async function callRpc<T = any>(
    chainIdOrName: number | string,
    method: string,
    params: any[] = []
): Promise<T> {
    const chainName = typeof chainIdOrName === 'number'
        ? CHAIN_ID_TO_NAME[chainIdOrName]
        : chainIdOrName as keyof typeof RPC_ENDPOINTS;

    if (!chainName || !RPC_ENDPOINTS[chainName]) {
        throw new Error(`Unsupported chain: ${chainIdOrName}`);
    }

    const endpoints = RPC_ENDPOINTS[chainName];
    const request: RpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
    };

    let lastError: Error | null = null;

    // Try each endpoint in order
    for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        if (!endpoint) continue;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as RpcResponse<T>;

            if (data.error) {
                throw new Error(`RPC Error: ${data.error.message}`);
            }

            if (data.result === undefined) {
                throw new Error('RPC returned undefined result');
            }

            // Success! Log if we had to failover
            if (i > 0) {
                console.log(`[RPC] Failover success on endpoint ${i + 1}/${endpoints.length} for ${chainName}`);
            }

            return data.result;
        } catch (error: any) {
            lastError = error;
            console.warn(`[RPC] Endpoint ${i + 1}/${endpoints.length} failed for ${chainName}:`, error.message);

            // Continue to next endpoint
            if (i < endpoints.length - 1) {
                continue;
            }
        }
    }

    // All endpoints failed
    throw new Error(
        `All RPC endpoints failed for ${chainName}. Last error: ${lastError?.message || 'Unknown'}`
    );
}

/**
 * Get native balance (ETH, BNB, SOL, etc.)
 */
export async function getNativeBalance(
    address: string,
    chainIdOrName: number | string
): Promise<string> {
    const chainName = typeof chainIdOrName === 'number'
        ? CHAIN_ID_TO_NAME[chainIdOrName]
        : chainIdOrName;

    if (chainName === 'solana') {
        // Solana uses getBalance
        const result = await callRpc<{ value: number }>(chainName, 'getBalance', [address]);
        return result.value.toString();
    } else {
        // EVM uses eth_getBalance
        return await callRpc<string>(chainIdOrName, 'eth_getBalance', [address, 'latest']);
    }
}

/**
 * Get current block number
 */
export async function getBlockNumber(chainIdOrName: number | string): Promise<number> {
    const chainName = typeof chainIdOrName === 'number'
        ? CHAIN_ID_TO_NAME[chainIdOrName]
        : chainIdOrName;

    if (chainName === 'solana') {
        const result = await callRpc<number>(chainName, 'getSlot', []);
        return result;
    } else {
        const hex = await callRpc<string>(chainIdOrName, 'eth_blockNumber', []);
        return parseInt(hex, 16);
    }
}

/**
 * Get block by number
 */
export async function getBlockByNumber(
    chainIdOrName: number | string,
    blockNumber: number | string,
    fullTransactions: boolean = false
): Promise<any> {
    const blockHex = typeof blockNumber === 'number'
        ? '0x' + blockNumber.toString(16)
        : blockNumber;

    return await callRpc(
        chainIdOrName,
        'eth_getBlockByNumber',
        [blockHex, fullTransactions]
    );
}

/**
 * Get transaction by hash
 */
export async function getTransactionByHash(
    chainIdOrName: number | string,
    txHash: string
): Promise<any> {
    const chainName = typeof chainIdOrName === 'number'
        ? CHAIN_ID_TO_NAME[chainIdOrName]
        : chainIdOrName;

    if (chainName === 'solana') {
        return await callRpc(chainName, 'getTransaction', [
            txHash,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ]);
    } else {
        return await callRpc(chainIdOrName, 'eth_getTransactionByHash', [txHash]);
    }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
    chainIdOrName: number | string,
    txHash: string
): Promise<any> {
    return await callRpc(chainIdOrName, 'eth_getTransactionReceipt', [txHash]);
}

/**
 * Get current gas price in wei
 */
export async function getGasPrice(chainIdOrName: number | string): Promise<string> {
    const chainName = typeof chainIdOrName === 'number'
        ? CHAIN_ID_TO_NAME[chainIdOrName]
        : chainIdOrName;

    if (chainName === 'solana') {
        return '0';
    } else {
        const hex = await callRpc<string>(chainIdOrName, 'eth_gasPrice', []);
        return parseInt(hex, 16).toString();
    }
}

/**
 * Get available RPC endpoints for a chain
 */
export function getRpcEndpoints(chainIdOrName: number | string): string[] {
    const chainName = typeof chainIdOrName === 'number'
        ? CHAIN_ID_TO_NAME[chainIdOrName]
        : chainIdOrName as keyof typeof RPC_ENDPOINTS;

    return RPC_ENDPOINTS[chainName] || [];
}
