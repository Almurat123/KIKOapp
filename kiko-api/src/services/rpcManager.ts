/**
 * RPC Manager Service
 * Manages multiple RPC endpoints with automatic failover
 */

import { getChainConfig } from '../config/chainConfig.js';

const RPC_TIMEOUT_MS = 4500;

// Chain ID to chain name mapping
const CHAIN_ID_TO_NAME: Record<number, string> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    900: 'solana',
};

// Reverse mapping for name to ID
const CHAIN_NAME_TO_ID: Record<string, number> = Object.entries(CHAIN_ID_TO_NAME).reduce((acc, [id, name]) => {
    acc[name] = Number(id);
    return acc;
}, {} as Record<string, number>);

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
    let endpoints: string[] = [];
    let chainName = typeof chainIdOrName === 'string' ? chainIdOrName : `Chain ${chainIdOrName}`;
    let chainId: number;

    // Resolve Chain ID
    if (typeof chainIdOrName === 'number') {
        chainId = chainIdOrName;
    } else {
        const id = CHAIN_NAME_TO_ID[chainIdOrName.toLowerCase()];
        if (!id) throw new Error(`Unsupported chain name: ${chainIdOrName}`);
        chainId = id;
    }

    try {
        const config = getChainConfig(chainId);
        endpoints = config.rpcUrls;
        chainName = config.name;
    } catch (e) {
        // Safe fallback for edge cases
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    if (!endpoints || endpoints.length === 0) {
        throw new Error(`No RPC endpoints configured for ${chainName}`);
    }

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
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            }).finally(() => clearTimeout(timeout));

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
            // Only log detailed errors for primary failovers to reduce noise
            if (i < 2) {
                console.warn(`[RPC] Endpoint ${i + 1}/${endpoints.length} failed for ${chainName}:`, error.message);
            }

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
        const result = await callRpc<{ value: number }>('solana', 'getBalance', [address]);
        return result.value.toString();
    } else {
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
    chainId: number,
    blockNumber: number | string,
    fullTransactions: boolean = false
): Promise<any> {
    const blockHex = typeof blockNumber === 'number'
        ? '0x' + blockNumber.toString(16)
        : blockNumber;

    return await callRpc(
        chainId,
        'eth_getBlockByNumber',
        [blockHex, fullTransactions]
    );
}

/**
 * Get transaction by hash
 */
export async function getTransactionByHash(
    chainId: number,
    txHash: string
): Promise<any> {
    const config = getChainConfig(chainId);

    if (config.name === 'Solana') {
        return await callRpc(chainId, 'getTransaction', [
            txHash,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ]);
    } else {
        return await callRpc(chainId, 'eth_getTransactionByHash', [txHash]);
    }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
    chainId: number,
    txHash: string
): Promise<any> {
    return await callRpc(chainId, 'eth_getTransactionReceipt', [txHash]);
}

/**
 * Get current gas price in wei
 */
export async function getGasPrice(chainId: number): Promise<string> {
    const config = getChainConfig(chainId);

    if (config.name === 'Solana') {
        return '0';
    } else {
        const hex = await callRpc<string>(chainId, 'eth_gasPrice', []);
        return parseInt(hex, 16).toString();
    }
}

/**
 * Get available RPC endpoints for a chain
 */
export function getRpcEndpoints(chainId: number): string[] {
    try {
        return getChainConfig(chainId).rpcUrls;
    } catch {
        return [];
    }
}
