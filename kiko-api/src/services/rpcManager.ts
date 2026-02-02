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
import { callRpc as unifiedCallRpc, getEndpointHealthStats, fetchJson } from '../config/unifiedApiService.js';
import { getCachedRpc, setCachedRpc, buildCacheKey, getTtlForMethod, isCacheable } from './rpcCache.js';

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

    // ✅ 缓存检查 - 在任何 RPC 调用前先检查缓存
    if (isCacheable(method)) {
        const cacheKey = buildCacheKey(chainIdOrName, method, params);
        const cached = getCachedRpc(cacheKey);
        if (cached !== null) {
            return cached as T;
        }
    }

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

            // ✅ 缓存写入 - 成功后写入缓存
            if (isCacheable(method)) {
                const cacheKey = buildCacheKey(chainIdOrName, method, params);
                const ttl = getTtlForMethod(method);
                setCachedRpc(cacheKey, data.result, ttl);
            }

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

            // ⚡ FAST FAIL: Contract errors should NOT be retried on other endpoints
            // These are logic errors, not network errors
            const isContractError = error.message?.includes('execution reverted') ||
                error.message?.includes('revert') ||
                error.message?.includes('invalid opcode') ||
                error.message?.includes('out of gas');

            if (isContractError) {
                // Don't retry - throw immediately to save time
                throw error;
            }

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

            // Continue to next endpoint only for network errors
            if (i < sortedEndpoints.length - 1) {
                // Minimal delay for network errors
                await new Promise(resolve => setTimeout(resolve, 50));
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

interface BatchRequest {
    id: string | number;
    method: string;
    params: any[];
}

interface BatchResponse {
    id: string | number;
    result?: any;
    error?: { code: number; message: string };
}

class RpcManager {
    /**
     * Call a single RPC method
     */
    async callRpc<T = any>(chain: string | number, method: string, params: any[] = []): Promise<T> {
        const chainName = typeof chain === 'string' ? chain : (CHAIN_ID_TO_NAME[chain] || 'eth');
        return unifiedCallRpc(chainName, method, params);
    }

    /**
     * Call multiple RPC methods in a single batch request
     */
    async callRpcBatch<T = any>(chain: string | number, requests: BatchRequest[]): Promise<BatchResponse[]> {
        const chainId = typeof chain === 'string' ? (CHAIN_NAME_TO_ID[chain] || 1) : chain;
        const endpoints = getRpcEndpoints(chainId);

        if (endpoints.length === 0) {
            throw new Error(`No RPC endpoints configured for chain ${chainId}`);
        }

        // Use the first (best) endpoint
        const url = endpoints[0];

        try {
            // Construct batch payload
            const payload = requests.map(req => ({
                jsonrpc: '2.0',
                id: req.id,
                method: req.method,
                params: req.params
            }));

            // Make the batch call
            const results = await fetchJson<BatchResponse[]>({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                requestTimeout: RPC_TIMEOUT_MS,
                endpointName: `rpc-batch-${chainId}`
            });

            return results;
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Batch RPC call failed', {
                chain: chainId,
                error: error.message,
                batchSize: requests.length
            });

            // Return error for all requests in batch
            return requests.map(req => ({
                id: req.id,
                error: { code: -32603, message: `Batch failed: ${error.message}` }
            }));
        }
    }
}

export const rpcManager = new RpcManager();

import { ethers } from 'ethers';

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

// Cache providers to avoid creating new instances for every call (memory optimization)
// Key: chainId, Value: { provider: JsonRpcProvider, url: string, timestamp: number }
const providerCache = new Map<number, { provider: ethers.JsonRpcProvider, url: string, timestamp: number }>();
const PROVIDER_CACHE_TTL = 60000; // Refresh provider mapping every 1 minute

/**
 * Get an ethers.js Provider instance for a chain
 * Uses the highest priority (healthiest) RPC endpoint available
 * 
 * @param chainId Chain ID
 * @returns ethers.JsonRpcProvider
 */
export function getEthersProvider(chainId: number): ethers.JsonRpcProvider {
    const endpoints = getRpcEndpoints(chainId);

    if (endpoints.length === 0) {
        throw new Error(`No RPC endpoints configured for chain ${chainId}`);
    }

    // Use the first (best) endpoint
    const bestUrl = endpoints[0];

    const now = Date.now();
    const cached = providerCache.get(chainId);

    // Return cached provider if valid and URL matches (and not too old)
    if (cached && cached.url === bestUrl && (now - cached.timestamp < PROVIDER_CACHE_TTL)) {
        return cached.provider;
    }

    // Create new provider
    const provider = new ethers.JsonRpcProvider(bestUrl, undefined, {
        staticNetwork: true // Optimization
    });

    providerCache.set(chainId, {
        provider,
        url: bestUrl,
        timestamp: now
    });

    return provider;
}

