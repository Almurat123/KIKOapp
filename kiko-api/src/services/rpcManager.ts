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
import { callRpc as unifiedCallRpc, fetchJson } from '../config/unifiedApiService.js';
import { getRpcEndpointsWithStrategy, RpcEndpointConfig } from '../config/apiEndpoints.js';
import { getCachedRpc, setCachedRpc, buildCacheKey, getTtlForMethod, isCacheable } from './rpcCache.js';
import { Connection } from '@solana/web3.js';

const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS || '10000'); // 10s default; override for faster benchmarks
const HEALTH_CHECK_INTERVAL = 60000; // Check endpoint health every 60s
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 consecutive failures (more tolerant)
const CIRCUIT_BREAKER_RESET_TIME = 30000; // Try again after 30s
const BENCHMARK_INTERVAL_MS = 300000; // 5 minutes
const BENCHMARK_TIMEOUT_MS = 3000;
const BENCHMARK_CHAIN_ID = 8453;
const BENCHMARK_TOKEN_ADDRESS = process.env.RPC_BENCH_TOKEN_ADDRESS || '0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07';
const BENCHMARK_DECIMALS_CALL = '0x313ce567'; // decimals()

// Endpoint health tracking
interface EndpointHealth {
    url: string;
    consecutiveFailures: number;
    lastFailureTime: number;
    circuitOpen: boolean;
    avgResponseTime: number;
    successCount: number;
    totalAttempts: number;
    lastBenchmarkTime?: number;
}

const endpointHealth = new Map<string, EndpointHealth>();

function getOrCreateUsage(url: string): EndpointUsage {
    if (!endpointUsage.has(url)) {
        endpointUsage.set(url, {
            url,
            inFlight: 0,
            lastSecondStart: Date.now(),
            secondCount: 0,
            lastMinuteStart: Date.now(),
            minuteCount: 0,
            lastUsedAt: 0
        });
    }
    return endpointUsage.get(url)!;
}

function recordUsageStart(url: string): void {
    const usage = getOrCreateUsage(url);
    const now = Date.now();
    if (now - usage.lastSecondStart >= 1000) {
        usage.lastSecondStart = now;
        usage.secondCount = 0;
    }
    if (now - usage.lastMinuteStart >= 60000) {
        usage.lastMinuteStart = now;
        usage.minuteCount = 0;
    }
    usage.secondCount += 1;
    usage.minuteCount += 1;
    usage.inFlight += 1;
    usage.lastUsedAt = now;
}

function recordUsageEnd(url: string): void {
    const usage = getOrCreateUsage(url);
    usage.inFlight = Math.max(0, usage.inFlight - 1);
}

function checkEndpointCapacity(endpoint: RpcEndpointConfig, importance: RpcImportance): { ok: boolean; reason?: string } {
    const limits = endpoint.limits;
    if (!limits) return { ok: true };
    const usage = getOrCreateUsage(endpoint.url);
    const now = Date.now();

    if (now - usage.lastSecondStart >= 1000) {
        usage.lastSecondStart = now;
        usage.secondCount = 0;
    }
    if (now - usage.lastMinuteStart >= 60000) {
        usage.lastMinuteStart = now;
        usage.minuteCount = 0;
    }

    if (limits.maxInFlight && usage.inFlight >= limits.maxInFlight) {
        return { ok: false, reason: 'maxInFlight' };
    }
    if (limits.rps && usage.secondCount >= limits.rps) {
        if (importance === 'critical' && endpoint.type === 'premium') {
            return { ok: true };
        }
        return { ok: false, reason: 'rps' };
    }
    if (limits.rpm && usage.minuteCount >= limits.rpm) {
        if (importance === 'critical' && endpoint.type === 'premium') {
            return { ok: true };
        }
        return { ok: false, reason: 'rpm' };
    }
    return { ok: true };
}

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

const CHAIN_PRIMARY_ENV: Record<string, string> = {
    eth: 'ETH_RPC_URL',
    base: 'BASE_RPC_URL',
    bsc: 'BSC_RPC_URL',
    polygon: 'POLYGON_RPC_URL',
    arbitrum: 'ARBITRUM_RPC_URL',
    optimism: 'OPTIMISM_RPC_URL',
    solana: 'SOLANA_RPC_URL',
};

function getPrimaryRpcUrl(chainSlug: string): string | undefined {
    const key = CHAIN_PRIMARY_ENV[chainSlug];
    if (!key) return undefined;
    const value = (process.env as Record<string, string | undefined>)[key];
    return value || undefined;
}

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

type RpcImportance = 'normal' | 'critical';

interface EndpointUsage {
    url: string;
    inFlight: number;
    lastSecondStart: number;
    secondCount: number;
    lastMinuteStart: number;
    minuteCount: number;
    lastUsedAt: number;
}

const endpointUsage = new Map<string, EndpointUsage>();

/**
 * Make an RPC call with automatic failover
 */
export async function callRpc<T = any>(
    chainIdOrName: number | string,
    method: string,
    params: any = [],
    options: { strategy?: 'fast' | 'cheap'; importance?: RpcImportance } = {}
): Promise<T> {
    let endpoints: RpcEndpointConfig[] = [];
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
        chainName = config.name;
        const chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
        const strategy = options.strategy || 'cheap';
        const primaryUrl = getPrimaryRpcUrl(chainSlug);
        endpoints = getRpcEndpointsWithStrategy(chainSlug, strategy, primaryUrl);
        endpoints = filterEndpointsByMethod(endpoints, method);

        if (strategy === 'cheap' && shouldUpgradeToFast(endpoints)) {
            const upgraded = getRpcEndpointsWithStrategy(chainSlug, 'fast', primaryUrl);
            if (upgraded.length > 0) {
                endpoints = filterEndpointsByMethod(upgraded, method);
                logger.warn(LogCode.API_FETCH_FAILED, 'RPC strategy upgraded to fast due to degraded cheap pool', {
                    chain: chainName
                });
            }
        }
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
    const sortedEndpoints = sortEndpointsByScore(endpoints, options.importance || 'normal');

    // Try each endpoint with circuit breaker check
    for (let i = 0; i < sortedEndpoints.length; i++) {
        const endpoint = sortedEndpoints[i];
        if (!endpoint?.url) continue;

        // Check circuit breaker
        if (isCircuitOpen(endpoint.url)) {
            logger.debug(LogCode.API_FETCH_FAILED, `RPC circuit open, skipping endpoint`, { endpoint: maskEndpoint(endpoint.url) });
            continue;
        }

        const capacity = checkEndpointCapacity(endpoint, options.importance || 'normal');
        if (!capacity.ok) {
            logger.debug(LogCode.API_FETCH_FAILED, `RPC capacity limited, skipping endpoint`, {
                endpoint: maskEndpoint(endpoint.url),
                reason: capacity.reason
            });
            continue;
        }

        const startTime = Date.now();
        try {
            recordUsageStart(endpoint.url);
            recordAttempt(endpoint.url);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
            const response = await fetch(endpoint.url, {
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
            recordSuccess(endpoint.url, responseTime);

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

            recordFailure(endpoint.url);

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
        } finally {
            recordUsageEnd(endpoint.url);
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
 * Make an RPC call against a custom endpoint list (non-chain RPCs like Flashbots)
 */
export async function callRpcCustom<T = any>(
    endpoints: RpcEndpointConfig[],
    method: string,
    params: any = [],
    options: { importance?: RpcImportance } = {}
): Promise<T> {
    if (!endpoints || endpoints.length === 0) {
        throw new Error('No RPC endpoints provided');
    }

    const normalized = endpoints.map((ep, idx) => ({
        name: ep.name || `Custom-${idx + 1}`,
        url: ep.url,
        priority: ep.priority ?? idx + 1,
        requiresAuth: ep.requiresAuth ?? false,
        type: ep.type ?? 'premium',
        limits: ep.limits,
        weight: ep.weight,
        capabilities: ep.capabilities
    })) as RpcEndpointConfig[];

    const filtered = filterEndpointsByMethod(normalized, method);
    if (filtered.length === 0) {
        throw new Error(`No RPC endpoints support method ${method}`);
    }

    const request: RpcRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
    };

    let lastError: Error | null = null;
    const sortedEndpoints = sortEndpointsByScore(filtered, options.importance || 'normal');

    for (let i = 0; i < sortedEndpoints.length; i++) {
        const endpoint = sortedEndpoints[i];
        if (!endpoint?.url) continue;

        if (isCircuitOpen(endpoint.url)) {
            logger.debug(LogCode.API_FETCH_FAILED, 'RPC circuit open, skipping endpoint', { endpoint: maskEndpoint(endpoint.url) });
            continue;
        }

        const capacity = checkEndpointCapacity(endpoint, options.importance || 'normal');
        if (!capacity.ok) {
            logger.debug(LogCode.API_FETCH_FAILED, 'RPC capacity limited, skipping endpoint', {
                endpoint: maskEndpoint(endpoint.url),
                reason: capacity.reason
            });
            continue;
        }

        const startTime = Date.now();
        try {
            recordUsageStart(endpoint.url);
            recordAttempt(endpoint.url);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
            const response = await fetch(endpoint.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'Connection': 'keep-alive',
                },
                body: JSON.stringify(request),
                signal: controller.signal,
                keepalive: true,
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

            const responseTime = Date.now() - startTime;
            recordSuccess(endpoint.url, responseTime);

            if (i > 0) {
                logger.info(LogCode.API_FETCH_SUCCESS, 'RPC failover success', {
                    endpoint: i + 1,
                    total: sortedEndpoints.length,
                    responseTime
                });
            }

            return data.result;
        } catch (error: any) {
            lastError = error;

            const isContractError = error.message?.includes('execution reverted') ||
                error.message?.includes('revert') ||
                error.message?.includes('invalid opcode') ||
                error.message?.includes('out of gas');

            if (isContractError) {
                throw error;
            }

            recordFailure(endpoint.url);

            if (i < 2) {
                logger.warn(LogCode.API_FETCH_FAILED, 'RPC endpoint failed', {
                    endpoint: i + 1,
                    total: sortedEndpoints.length,
                    error: error.message,
                    duration: Date.now() - startTime
                });
            }

            if (i < sortedEndpoints.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
                continue;
            }
        } finally {
            recordUsageEnd(endpoint.url);
        }
    }

    logger.error(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
        totalEndpoints: sortedEndpoints.length,
        lastError: lastError?.message
    });

    throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Call RPC and return raw response (used when revert data is needed)
 */
export async function callRpcRaw<T = any>(
    chainIdOrName: number | string,
    method: string,
    params: any = [],
    options: { strategy?: 'fast' | 'cheap'; importance?: RpcImportance } = {}
): Promise<RpcResponse<T>> {
    let endpoints: RpcEndpointConfig[] = [];
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
        chainName = config.name;
        const chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
        const strategy = options.strategy || 'cheap';
        const primaryUrl = getPrimaryRpcUrl(chainSlug);
        endpoints = getRpcEndpointsWithStrategy(chainSlug, strategy, primaryUrl);
        endpoints = filterEndpointsByMethod(endpoints, method);

        if (strategy === 'cheap' && shouldUpgradeToFast(endpoints)) {
            const upgraded = getRpcEndpointsWithStrategy(chainSlug, 'fast', primaryUrl);
            if (upgraded.length > 0) {
                endpoints = filterEndpointsByMethod(upgraded, method);
                logger.warn(LogCode.API_FETCH_FAILED, 'RPC strategy upgraded to fast due to degraded cheap pool', {
                    chain: chainName
                });
            }
        }
    } catch (e) {
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
    const sortedEndpoints = sortEndpointsByScore(endpoints, options.importance || 'normal');

    for (let i = 0; i < sortedEndpoints.length; i++) {
        const endpoint = sortedEndpoints[i];
        if (!endpoint?.url) continue;

        if (isCircuitOpen(endpoint.url)) {
            logger.debug(LogCode.API_FETCH_FAILED, 'RPC circuit open, skipping endpoint', { endpoint: maskEndpoint(endpoint.url) });
            continue;
        }

        const capacity = checkEndpointCapacity(endpoint, options.importance || 'normal');
        if (!capacity.ok) {
            logger.debug(LogCode.API_FETCH_FAILED, 'RPC capacity limited, skipping endpoint', {
                endpoint: maskEndpoint(endpoint.url),
                reason: capacity.reason
            });
            continue;
        }

        const startTime = Date.now();
        try {
            recordUsageStart(endpoint.url);
            recordAttempt(endpoint.url);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
            const response = await fetch(endpoint.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'Connection': 'keep-alive',
                },
                body: JSON.stringify(request),
                signal: controller.signal,
                keepalive: true,
            }).finally(() => clearTimeout(timeout));

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as RpcResponse<T>;
            const responseTime = Date.now() - startTime;
            recordSuccess(endpoint.url, responseTime);

            if (i > 0) {
                logger.info(LogCode.API_FETCH_SUCCESS, 'RPC failover success', {
                    chain: chainName,
                    endpoint: i + 1,
                    total: sortedEndpoints.length,
                    responseTime
                });
            }

            return data;
        } catch (error: any) {
            lastError = error;

            const isContractError = error.message?.includes('execution reverted') ||
                error.message?.includes('revert') ||
                error.message?.includes('invalid opcode') ||
                error.message?.includes('out of gas');

            if (isContractError) {
                throw error;
            }

            recordFailure(endpoint.url);

            if (i < 2) {
                logger.warn(LogCode.API_FETCH_FAILED, 'RPC endpoint failed', {
                    chain: chainName,
                    endpoint: i + 1,
                    total: sortedEndpoints.length,
                    error: error.message,
                    duration: Date.now() - startTime
                });
            }

            if (i < sortedEndpoints.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
                continue;
            }
        } finally {
            recordUsageEnd(endpoint.url);
        }
    }

    logger.error(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
        chain: chainName,
        totalEndpoints: sortedEndpoints.length,
        lastError: lastError?.message
    });

    throw new Error(`All RPC endpoints failed for ${chainName}. Last error: ${lastError?.message || 'Unknown'}`);
}

function filterEndpointsByMethod(endpoints: RpcEndpointConfig[], method: string): RpcEndpointConfig[] {
    const matches = endpoints.filter(endpoint => endpoint.capabilities?.methods?.includes(method));
    return matches.length > 0 ? matches : endpoints;
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

async function probeEndpoint(url: string, method: string, params: any[] = [], timeoutMs = BENCHMARK_TIMEOUT_MS): Promise<{ ok: boolean; ms: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
            signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        const ms = Date.now() - start;
        if (!response.ok || data.error) {
            return { ok: false, ms };
        }
        return { ok: true, ms };
    } catch {
        return { ok: false, ms: Date.now() - start };
    } finally {
        clearTimeout(timeout);
    }
}

async function runBenchmarkSample(chainId: number, tokenAddress: string): Promise<void> {
    const endpoints = getRpcEndpoints(chainId, 'fast');
    if (endpoints.length === 0) return;

    const methods: Array<[string, any[]]> = [
        ['eth_blockNumber', []],
        ['eth_getBlockByNumber', ['latest', false]],
        ['eth_call', [{ to: tokenAddress, data: BENCHMARK_DECIMALS_CALL }, 'latest']],
    ];

    for (const endpoint of endpoints) {
        for (const [method, params] of methods) {
            recordAttempt(endpoint);
            const result = await probeEndpoint(endpoint, method, params);
            if (result.ok) {
                recordSuccess(endpoint, result.ms);
            } else {
                recordFailure(endpoint);
            }
        }
        const health = getOrCreateHealth(endpoint);
        health.lastBenchmarkTime = Date.now();
    }
}

function sortEndpointsByScore(endpoints: RpcEndpointConfig[], importance: RpcImportance): RpcEndpointConfig[] {
    const now = Date.now();
    return endpoints.slice().sort((a, b) => {
        const scoreA = scoreEndpoint(a, importance, now);
        const scoreB = scoreEndpoint(b, importance, now);
        return scoreB - scoreA;
    });
}

function scoreEndpoint(endpoint: RpcEndpointConfig, importance: RpcImportance, now: number): number {
    const health = getOrCreateHealth(endpoint.url);
    const usage = getOrCreateUsage(endpoint.url);

    // Base score from success rate and response time
    const successRate = health.totalAttempts > 0 ? health.successCount / health.totalAttempts : 0.7;
    const latencyScore = health.avgResponseTime > 0 ? Math.max(0, 1000 - health.avgResponseTime) / 1000 : 0.5;
    let score = successRate * 10 + latencyScore * 2;

    // Penalize circuit open
    if (health.circuitOpen) score -= 5;

    // Type preference by importance
    if (importance === 'critical') {
        if (endpoint.type === 'premium') score += 2;
        if (endpoint.type === 'public') score += 0.5;
    } else {
        if (endpoint.type === 'public') score += 2;
        if (endpoint.type === 'premium') score -= 0.5;
    }

    // Capacity pressure
    const limits = endpoint.limits;
    if (limits?.maxInFlight && usage.inFlight >= limits.maxInFlight) score -= 2;
    if (limits?.rps && usage.secondCount >= limits.rps) score -= 1.5;
    if (limits?.rpm && usage.minuteCount >= limits.rpm) score -= 1.5;

    // Slight penalty for very recent usage to spread load
    if (now - usage.lastUsedAt < 50) score -= 0.2;

    // Optional weight
    if (endpoint.weight) score += endpoint.weight;

    return score;
}

function maskEndpoint(url: string): string {
    // Mask API keys in URLs for logging
    return url.replace(/[a-zA-Z0-9]{32,}/g, '***');
}

function shouldUpgradeToFast(endpoints: RpcEndpointConfig[]): boolean {
    if (endpoints.length === 0) return false;
    const top = endpoints.slice(0, 3);
    let badCount = 0;
    for (const endpoint of top) {
        const health = getOrCreateHealth(endpoint.url);
        const attempts = health.totalAttempts;
        const successRate = attempts > 0 ? (health.successCount / attempts) * 100 : 100;
        const isBad = health.circuitOpen || (attempts >= 10 && successRate < 50);
        if (isBad) badCount++;
    }
    return badCount === top.length;
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
 * Get ERC20 balance via eth_call with RPC failover
 */
export async function getErc20Balance(
    tokenAddress: string,
    ownerAddress: string,
    chainIdOrName: number | string
): Promise<bigint> {
    const iface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
    const data = iface.encodeFunctionData('balanceOf', [ownerAddress]);
    const result = await callRpc<string>(chainIdOrName, 'eth_call', [{
        to: tokenAddress,
        data
    }, 'latest']);

    if (!result || result === '0x') return 0n;
    const [balance] = iface.decodeFunctionResult('balanceOf', result);
    return BigInt(balance);
}

/**
 * Get ERC20 decimals via eth_call with RPC failover
 */
export async function getErc20Decimals(
    tokenAddress: string,
    chainIdOrName: number | string
): Promise<number> {
    const iface = new ethers.Interface(['function decimals() view returns (uint8)']);
    const data = iface.encodeFunctionData('decimals', []);
    const result = await callRpc<string>(chainIdOrName, 'eth_call', [{
        to: tokenAddress,
        data
    }, 'latest']);

    if (!result || result === '0x') return 18;
    const [decimals] = iface.decodeFunctionResult('decimals', result);
    return Number(decimals);
}

/**
 * Get ERC20 allowance via eth_call with RPC failover
 */
export async function getErc20Allowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    chainIdOrName: number | string
): Promise<bigint> {
    const iface = new ethers.Interface(['function allowance(address owner, address spender) view returns (uint256)']);
    const data = iface.encodeFunctionData('allowance', [ownerAddress, spenderAddress]);
    const result = await callRpc<string>(chainIdOrName, 'eth_call', [{
        to: tokenAddress,
        data
    }, 'latest']);

    if (!result || result === '0x') return 0n;
    const [allowance] = iface.decodeFunctionResult('allowance', result);
    return BigInt(allowance);
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
        return await callRpc(chainId, 'eth_getTransactionByHash', [txHash], { strategy: 'fast', importance: 'critical' });
    }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
    chainId: number,
    txHash: string
): Promise<any> {
    return await callRpc(chainId, 'eth_getTransactionReceipt', [txHash], { strategy: 'fast', importance: 'critical' });
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
export function getRpcEndpoints(chainId: number, strategy?: 'fast' | 'cheap'): string[] {
    try {
        if (strategy) {
            const chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
            const primaryUrl = getPrimaryRpcUrl(chainSlug);
            return getRpcEndpointsWithStrategy(chainSlug, strategy, primaryUrl).map(e => e.url);
        }
        const chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
        const primaryUrl = getPrimaryRpcUrl(chainSlug);
        return getRpcEndpointsWithStrategy(chainSlug, 'cheap', primaryUrl).map(e => e.url);
    } catch {
        return [];
    }
}

// Cache providers to avoid creating new instances for every call (memory optimization)
// Key: chainId, Value: { provider: JsonRpcProvider, url: string, timestamp: number }
const providerCache = new Map<number, { provider: ethers.JsonRpcProvider, url: string, timestamp: number }>();
const PROVIDER_CACHE_TTL = 60000; // Refresh provider mapping every 1 minute
const SOLANA_CONN_CACHE = new Map<string, { connection: Connection; timestamp: number }>();
const SOLANA_CONN_CACHE_TTL = 60000;

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

/**
 * Get a Solana Connection instance using rpcManager selection
 */
export function getSolanaConnection(
    strategy: 'fast' | 'cheap' = 'cheap',
    importance: RpcImportance = 'normal'
): Connection {
    const chainSlug = 'solana';
    const primaryUrl = getPrimaryRpcUrl(chainSlug);
    let endpoints = getRpcEndpointsWithStrategy(chainSlug, strategy, primaryUrl);

    if (strategy === 'cheap' && shouldUpgradeToFast(endpoints)) {
        const upgraded = getRpcEndpointsWithStrategy(chainSlug, 'fast', primaryUrl);
        if (upgraded.length > 0) {
            endpoints = upgraded;
        }
    }

    if (!endpoints || endpoints.length === 0) {
        throw new Error('No RPC endpoints configured for Solana');
    }

    const sorted = sortEndpointsByScore(endpoints, importance);
    const chosen = sorted.find(ep => !isCircuitOpen(ep.url)) || sorted[0];
    const url = chosen.url;
    const now = Date.now();
    const cached = SOLANA_CONN_CACHE.get(url);

    if (cached && now - cached.timestamp < SOLANA_CONN_CACHE_TTL) {
        return cached.connection;
    }

    const connection = new Connection(url, 'confirmed');
    SOLANA_CONN_CACHE.set(url, { connection, timestamp: now });
    return connection;
}

/**
 * Get RPC health stats (RPC-only)
 */
export function getRpcHealthStats(): Array<{
    url: string;
    successRate: number;
    avgResponseTime: number;
    circuitOpen: boolean;
    consecutiveFailures: number;
}> {
    const stats: Array<any> = [];
    for (const [url, health] of endpointHealth.entries()) {
        const successRate = health.totalAttempts > 0
            ? (health.successCount / health.totalAttempts) * 100
            : 0;
        stats.push({
            url: maskEndpoint(url),
            successRate: Math.round(successRate * 100) / 100,
            avgResponseTime: Math.round(health.avgResponseTime),
            circuitOpen: health.circuitOpen,
            consecutiveFailures: health.consecutiveFailures
        });
    }
    return stats.sort((a, b) => b.successRate - a.successRate);
}

/**
 * Start periodic RPC health logging (only logs unhealthy endpoints)
 */
export function startRpcHealthMonitor(intervalMs = 60000): NodeJS.Timeout {
    return setInterval(() => {
        const stats = getRpcHealthStats();
        const unhealthy = stats.filter(s => s.circuitOpen || s.successRate < 50);
        if (unhealthy.length > 0) {
            logger.warn(LogCode.SYS_ERROR, 'RPC health degraded', {
                endpoints: unhealthy.slice(0, 5)
            });
        }
    }, intervalMs);
}

/**
 * Start periodic RPC benchmark sampling (updates health metrics)
 */
export function startRpcBenchmarkSampling(
    intervalMs = BENCHMARK_INTERVAL_MS,
    chainId = BENCHMARK_CHAIN_ID,
    tokenAddress = BENCHMARK_TOKEN_ADDRESS
): NodeJS.Timeout {
    // Warm once immediately
    runBenchmarkSample(chainId, tokenAddress).catch(() => undefined);
    return setInterval(() => {
        runBenchmarkSample(chainId, tokenAddress).catch(() => undefined);
    }, intervalMs);
}
