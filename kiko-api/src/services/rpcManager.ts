/**
 * RPC Manager Service
 * Manages multiple RPC endpoints with automatic failover
 * Features: Health checks, circuit breaker, priority routing, fast failover
 * 
 * NOTE: This service now uses the unified API configuration from config/unifiedApiService.ts
 * All RPC endpoints are centrally managed in config/apiEndpoints.ts
 */

import { getChainConfig } from '../config/chainConfig.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { callRpc as unifiedCallRpc, getEndpointHealthStats } from '../config/unifiedApiService.js';

const RPC_TIMEOUT_MS = 10000; // 10s timeout for reliable RPC calls (Alchemy can be slow)
const HEALTH_CHECK_INTERVAL = 60000; // Check endpoint health every 60s
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 consecutive failures (more tolerant)
const CIRCUIT_BREAKER_RESET_TIME = 30000; // Try again after 30s

// Endpoint health tracking
interface EndpointHealth {
    url: string;
    consecutiveFailures: number;
    lastFailureTime: number;
    circuitOpen: boolean;
    avgResponseTime: number;
    successCount: number;
    totalAttempts: number;
}

const endpointHealth = new Map<string, EndpointHealth>();

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

    // Sort endpoints by health and priority
    const sortedEndpoints = sortEndpointsByHealth(endpoints);

    // Try each endpoint with circuit breaker check
    for (let i = 0; i < sortedEndpoints.length; i++) {
        const endpoint = sortedEndpoints[i];
        if (!endpoint) continue;

        // Check circuit breaker
        if (isCircuitOpen(endpoint)) {
            logger.debug(LogCode.API_FETCH_FAILED, `RPC circuit open, skipping endpoint`, { endpoint: maskEndpoint(endpoint) });
            continue;
        }

        const startTime = Date.now();
        try {
            recordAttempt(endpoint);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip', // ✅ Enable gzip compression (75% speedup for large responses)
                    'Connection': 'keep-alive', // ✅ Enable connection reuse (Alchemy best practice)
                },
                body: JSON.stringify(request),
                signal: controller.signal,
                keepalive: true, // ✅ Enable HTTP keep-alive for connection pooling
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

            // Success! Record health metrics
            const responseTime = Date.now() - startTime;
            recordSuccess(endpoint, responseTime);

            // Only log failover, not primary success
            if (i > 0) {
                logger.info(LogCode.API_FETCH_SUCCESS, `RPC failover success`, {
                    chain: chainName,
                    endpoint: i + 1,
                    total: sortedEndpoints.length,
                    responseTime
                });
            }

            return data.result;
        } catch (error: any) {
            lastError = error;
            recordFailure(endpoint);

            // Only log first 2 failures to reduce noise
            if (i < 2) {
                logger.warn(LogCode.API_FETCH_FAILED, `RPC endpoint failed`, {
                    chain: chainName,
                    endpoint: i + 1,
                    total: sortedEndpoints.length,
                    error: error.message,
                    duration: Date.now() - startTime
                });
            }

            // Continue to next endpoint
            if (i < sortedEndpoints.length - 1) {
                // ✅ Add delay before trying next endpoint (Alchemy best practice)
                // Exponential backoff: 100ms, 200ms, 400ms...
                const delayMs = Math.min(100 * Math.pow(2, i), 1000); // Max 1s
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
        }
    }

    // All endpoints failed
    logger.error(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
        chain: chainName,
        totalEndpoints: sortedEndpoints.length,
        lastError: lastError?.message
    });

    throw new Error(
        `All RPC endpoints failed for ${chainName}. Last error: ${lastError?.message || 'Unknown'}`
    );
}

/**
 * Execute a batch of RPC calls
 */
export async function callRpcBatch<T = any>(
    chainIdOrName: number | string,
    requests: RpcRequest[]
): Promise<RpcResponse<T>[]> {
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
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    if (!endpoints || endpoints.length === 0) {
        throw new Error(`No RPC endpoints configured for ${chainName}`);
    }

    // Sort endpoints by health and priority
    const sortedEndpoints = sortEndpointsByHealth(endpoints);
    let lastError: Error | null = null;

    // Try each endpoint
    for (const endpoint of sortedEndpoints) {
        if (!endpoint || isCircuitOpen(endpoint)) continue;

        const startTime = Date.now();
        try {
            recordAttempt(endpoint);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'Connection': 'keep-alive',
                },
                body: JSON.stringify(requests),
                signal: controller.signal,
                keepalive: true,
            }).finally(() => clearTimeout(timeout));

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const data = await response.json() as RpcResponse<T>[];

            // Check if result is array (batch response)
            if (!Array.isArray(data)) throw new Error('RPC returned non-array result for batch request');

            recordSuccess(endpoint, Date.now() - startTime);
            return data;
        } catch (error: any) {
            lastError = error;
            recordFailure(endpoint);
        }
    }

    throw new Error(`All RPC endpoints failed for ${chainName} batch call. Last error: ${lastError?.message}`);
}


/**
 * Health tracking functions
 */
function getOrCreateHealth(url: string): EndpointHealth {
    if (!endpointHealth.has(url)) {
        endpointHealth.set(url, {
            url,
            consecutiveFailures: 0,
            lastFailureTime: 0,
            circuitOpen: false,
            avgResponseTime: 0,
            successCount: 0,
            totalAttempts: 0
        });
    }
    return endpointHealth.get(url)!;
}

function isCircuitOpen(url: string): boolean {
    const health = getOrCreateHealth(url);

    if (!health.circuitOpen) return false;

    // Check if enough time has passed to reset circuit
    if (Date.now() - health.lastFailureTime > CIRCUIT_BREAKER_RESET_TIME) {
        health.circuitOpen = false;
        health.consecutiveFailures = 0;
        logger.info(LogCode.API_FETCH_SUCCESS, 'RPC circuit breaker reset', { endpoint: maskEndpoint(url) });
        return false;
    }

    return true;
}

function recordAttempt(url: string): void {
    const health = getOrCreateHealth(url);
    health.totalAttempts++;
}

function recordSuccess(url: string, responseTime: number): void {
    const health = getOrCreateHealth(url);
    health.successCount++;
    health.consecutiveFailures = 0;
    health.circuitOpen = false;

    // Update average response time (exponential moving average)
    if (health.avgResponseTime === 0) {
        health.avgResponseTime = responseTime;
    } else {
        health.avgResponseTime = health.avgResponseTime * 0.7 + responseTime * 0.3;
    }
}

function recordFailure(url: string): void {
    const health = getOrCreateHealth(url);
    health.consecutiveFailures++;
    health.lastFailureTime = Date.now();

    // Open circuit if threshold reached
    if (health.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        health.circuitOpen = true;
        logger.warn(LogCode.API_FETCH_FAILED, 'RPC circuit breaker opened', {
            endpoint: maskEndpoint(url),
            failures: health.consecutiveFailures
        });
    }
}

function sortEndpointsByHealth(endpoints: string[]): string[] {
    return endpoints.slice().sort((a, b) => {
        const healthA = getOrCreateHealth(a);
        const healthB = getOrCreateHealth(b);

        // Prioritize endpoints with circuit closed
        if (healthA.circuitOpen && !healthB.circuitOpen) return 1;
        if (!healthA.circuitOpen && healthB.circuitOpen) return -1;

        // Then by success rate
        const successRateA = healthA.totalAttempts > 0 ? healthA.successCount / healthA.totalAttempts : 0.5;
        const successRateB = healthB.totalAttempts > 0 ? healthB.successCount / healthB.totalAttempts : 0.5;

        if (successRateA !== successRateB) {
            return successRateB - successRateA;
        }

        // Then by average response time (lower is better)
        return healthA.avgResponseTime - healthB.avgResponseTime;
    });
}

function maskEndpoint(url: string): string {
    // Mask API keys in URLs for logging
    return url.replace(/[a-zA-Z0-9]{32,}/g, '***');
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
