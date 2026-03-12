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
import { LogCode, LogRole } from '../config/logRegistry.js';
import { callRpc as unifiedCallRpc, fetchJson } from '../config/unifiedApiService.js';
import { getRpcEndpointsForLane, getRpcEndpointsWithStrategy, RpcEndpointConfig, type RpcExecutionLane as EndpointExecutionLane } from '../config/apiEndpoints.js';
import { getCachedRpc, setCachedRpc, buildCacheKey, getTtlForMethod, isCacheable } from './rpcCache.js';
import { Connection } from '@solana/web3.js';
import type { TxLifecycleResult } from './txLifecycle.js';
import type { RpcImportance } from './rpc/types.js';
import {
    reportReceiptSeen,
    reportRpcUncertain,
    reportSendAccepted,
    reportTxByHashSeen
} from './order-runtime/adjudicator/service.js';
import { resolveTxFinalState, toLifecycleResultFromFinalState } from './order-runtime/adjudicator/finalState.js';
import { buildRpcSelectionExplain } from './rpc/explain.js';
import { inferRpcLane, shouldUpgradeRpcStrategy } from './rpc/policy.js';
import {
    classifyFailoverReason,
    extendCheapBudgetToIncludePremiumFallback,
    isRateLimitedFailure,
    shouldSkipFailoverDelay,
    summarizeTopFailoverReasons,
} from './rpc/failoverPolicy.js';
import { buildRpcScoreTable, sortRpcEndpointsByScore } from './rpc/score.js';
import {
    getErc20AllowanceSnapshot,
    getErc20BalanceSnapshot,
    getNativeBalanceSnapshot,
    setErc20AllowanceSnapshot,
    setErc20BalanceSnapshot,
    setNativeBalanceSnapshot
} from './rpc/snapshotStore.js';
import { getCriticalRpcPressureSnapshot, hasCriticalRpcPressure, beginCriticalRpcWindow } from './rpc/backgroundBudget.js';
import { getSharedTxObservation, waitForSharedTxConfirmation } from './rpc/confirmScheduler.js';
import { withRpcReadBudget } from './rpc/readBudget.js';
import { inferExecutionLane } from './rpc/executionLane.js';
import { withRpcLaneBudget } from './rpc/laneBudget.js';

const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS || '10000'); // 10s default
const RPC_TIMEOUT_FAST_MS = Number(process.env.RPC_TIMEOUT_FAST_MS || '2500');
const RPC_TIMEOUT_CRITICAL_MS = Number(process.env.RPC_TIMEOUT_CRITICAL_MS || '1500');
const RPC_CRITICAL_HEDGE_ENABLED = (process.env.RPC_CRITICAL_HEDGE_ENABLED || 'true') === 'true';
const RPC_CRITICAL_HEDGE_ALLOW_WRITE = (process.env.RPC_CRITICAL_HEDGE_ALLOW_WRITE || 'false') === 'true';
const RPC_CRITICAL_HEDGE_STAGGER_MS = Number(process.env.RPC_CRITICAL_HEDGE_STAGGER_MS || '60');
const RPC_CRITICAL_HEDGE_FANOUT = Math.max(1, Math.min(4, Number(process.env.RPC_CRITICAL_HEDGE_FANOUT || '2')));
const RPC_ETH_CALL_HEDGE_FANOUT = Math.max(1, Math.min(3, Number(process.env.RPC_ETH_CALL_HEDGE_FANOUT || '1')));
const RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL = (process.env.RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL || 'false') === 'true';
const RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL || '3'));
const RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL || '4'));
const RPC_MAX_ENDPOINT_ATTEMPTS_WRITE = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_WRITE || '4'));
const RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL || '2'));
const RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL || '2'));
const RPC_CONCURRENCY_NORMAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_NORMAL || '28'));
const RPC_CONCURRENCY_CRITICAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_CRITICAL || '56'));
const RPC_CONCURRENCY_WRITE = Math.max(1, Number(process.env.RPC_CONCURRENCY_WRITE || '10'));
const RPC_CONCURRENCY_ETH_CALL_NORMAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_ETH_CALL_NORMAL || '14'));
const RPC_CONCURRENCY_ETH_CALL_CRITICAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_ETH_CALL_CRITICAL || '8'));
const RPC_CRITICAL_POOL_CONCURRENCY = Math.max(1, Number(process.env.RPC_CRITICAL_POOL_CONCURRENCY || '64'));
const RPC_BEST_EFFORT_POOL_CONCURRENCY = Math.max(1, Number(process.env.RPC_BEST_EFFORT_POOL_CONCURRENCY || '20'));
const RPC_CRITICAL_MAX_INFLIGHT_BURST = Math.max(0, Number(process.env.RPC_CRITICAL_MAX_INFLIGHT_BURST || '2'));
const RPC_METHOD_COOLDOWN_BASE_MS = Math.max(0, Number(process.env.RPC_METHOD_COOLDOWN_BASE_MS || '250'));
const RPC_METHOD_COOLDOWN_MAX_MS = Math.max(RPC_METHOD_COOLDOWN_BASE_MS, Number(process.env.RPC_METHOD_COOLDOWN_MAX_MS || '4000'));
const RPC_METHOD_COOLDOWN_ATTEMPT_CAP = Math.max(1, Number(process.env.RPC_METHOD_COOLDOWN_ATTEMPT_CAP || '1'));
const RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS = Math.max(10_000, Number(process.env.RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS || '120000'));
const RPC_INFLIGHT_KEY_MAX_LEN = Math.max(128, Number(process.env.RPC_INFLIGHT_KEY_MAX_LEN || '2048'));
const RPC_INFLIGHT_MAP_MAX = Math.max(64, Number(process.env.RPC_INFLIGHT_MAP_MAX || '5000'));
const RPC_SEND_RAW_HASH_CACHE_MAX = Math.max(64, Number(process.env.RPC_SEND_RAW_HASH_CACHE_MAX || '4000'));
const TX_LIFECYCLE_ENDPOINT_FANOUT = 7;
const HEALTH_CHECK_INTERVAL = 60000; // Check endpoint health every 60s
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 consecutive failures (more tolerant)
const CIRCUIT_BREAKER_RESET_TIME = 30000; // Try again after 30s
const BENCHMARK_INTERVAL_MS = 300000; // 5 minutes
const BENCHMARK_TIMEOUT_MS = 3000;
const BENCHMARK_CHAIN_ID = 8453;
const BENCHMARK_TOKEN_ADDRESS = process.env.RPC_BENCH_TOKEN_ADDRESS || '0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07';
const BENCHMARK_DECIMALS_CALL = '0x313ce567'; // decimals()
const ENDPOINT_METHOD_TIMEOUT_WINDOW_MS = Math.max(5_000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_WINDOW_MS || '60000'));
const ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS = Math.max(3, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS || '8'));
const ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD = Math.min(1, Math.max(0, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD || '0.3')));
const ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS = Math.max(1_000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS || '60000'));
const RPC_EXPLAIN_ENABLED = (process.env.RPC_EXPLAIN_ENABLED || 'true').toLowerCase() === 'true';
const RPC_ERC20_BALANCE_SUCCESS_TTL_MS = Math.max(200, Number(process.env.RPC_ERC20_BALANCE_SUCCESS_TTL_MS || '750'));
const RPC_ERC20_BALANCE_FAILURE_COOLDOWN_MS = Math.max(200, Number(process.env.RPC_ERC20_BALANCE_FAILURE_COOLDOWN_MS || '1200'));
const RPC_ERC20_DECIMALS_SUCCESS_TTL_MS = Math.max(30_000, Number(process.env.RPC_ERC20_DECIMALS_SUCCESS_TTL_MS || '21600000'));
const RPC_ERC20_DECIMALS_FAILURE_COOLDOWN_MS = Math.max(500, Number(process.env.RPC_ERC20_DECIMALS_FAILURE_COOLDOWN_MS || '5000'));

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
const allRpcFailedLogGate = new Map<string, number>();
const ALL_RPC_FAILED_LOG_COOLDOWN_MS = Number(process.env.RPC_ALL_FAILED_LOG_COOLDOWN_MS || 5000);

function shouldLogAllRpcFailed(key: string): boolean {
    const now = Date.now();
    const last = allRpcFailedLogGate.get(key) || 0;
    if (now - last < ALL_RPC_FAILED_LOG_COOLDOWN_MS) return false;
    allRpcFailedLogGate.set(key, now);
    return true;
}

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

/** Check capacity and increment usage in one synchronous block to avoid race under concurrency. */
function checkAndReserveCapacity(endpoint: RpcEndpointConfig, importance: RpcImportance): { ok: boolean; reason?: string } {
    const limits = endpoint.limits;
    if (!limits) return { ok: true };
    const usage = getOrCreateUsage(endpoint.url);
    const now = Date.now();
    const criticalPremiumBypass = importance === 'critical' && endpoint.type === 'premium';

    if (now - usage.lastSecondStart >= 1000) {
        usage.lastSecondStart = now;
        usage.secondCount = 0;
    }
    if (now - usage.lastMinuteStart >= 60000) {
        usage.lastMinuteStart = now;
        usage.minuteCount = 0;
    }

    if (limits.maxInFlight && usage.inFlight >= limits.maxInFlight) {
        if (!criticalPremiumBypass || usage.inFlight >= (limits.maxInFlight + RPC_CRITICAL_MAX_INFLIGHT_BURST)) {
            return { ok: false, reason: 'maxInFlight' };
        }
    }
    if (limits.rps && usage.secondCount >= limits.rps) {
        if (criticalPremiumBypass) {
            // allow but still reserve below
        } else {
            return { ok: false, reason: 'rps' };
        }
    }
    if (limits.rpm && usage.minuteCount >= limits.rpm) {
        if (criticalPremiumBypass) {
            // allow but still reserve below
        } else {
            return { ok: false, reason: 'rpm' };
        }
    }

    usage.secondCount += 1;
    usage.minuteCount += 1;
    usage.inFlight += 1;
    usage.lastUsedAt = now;
    return { ok: true };
}

function checkEndpointCapacity(endpoint: RpcEndpointConfig, importance: RpcImportance): { ok: boolean; reason?: string } {
    const limits = endpoint.limits;
    if (!limits) return { ok: true };
    const usage = getOrCreateUsage(endpoint.url);
    const now = Date.now();
    const criticalPremiumBypass = importance === 'critical' && endpoint.type === 'premium';

    if (now - usage.lastSecondStart >= 1000) {
        usage.lastSecondStart = now;
        usage.secondCount = 0;
    }
    if (now - usage.lastMinuteStart >= 60000) {
        usage.lastMinuteStart = now;
        usage.minuteCount = 0;
    }

    if (limits.maxInFlight && usage.inFlight >= limits.maxInFlight) {
        if (!criticalPremiumBypass || usage.inFlight >= (limits.maxInFlight + RPC_CRITICAL_MAX_INFLIGHT_BURST)) {
            return { ok: false, reason: 'maxInFlight' };
        }
    }
    if (limits.rps && usage.secondCount >= limits.rps) {
        if (criticalPremiumBypass) {
            return { ok: true };
        }
        return { ok: false, reason: 'rps' };
    }
    if (limits.rpm && usage.minuteCount >= limits.rpm) {
        if (criticalPremiumBypass) {
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

export type RpcClass = 'critical_tx' | 'best_effort_read';

function resolveRpcTimeoutMs(
    method: string,
    options: { strategy?: 'fast' | 'cheap'; importance?: RpcImportance }
): number {
    const effectiveImportance: RpcImportance =
        options.importance || (options.strategy === 'fast' ? 'critical' : 'normal');

    if (effectiveImportance === 'critical') {
        if (method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt') {
            return Math.min(RPC_TIMEOUT_CRITICAL_MS, RPC_TIMEOUT_FAST_MS);
        }
        return RPC_TIMEOUT_CRITICAL_MS;
    }

    if (options.strategy === 'fast') return RPC_TIMEOUT_FAST_MS;
    return RPC_TIMEOUT_MS;
}

function isNonRetryableRpcErrorMessage(message: string): boolean {
    const msg = String(message || '').toLowerCase();
    if (!msg) return false;
    return (
        msg.includes('execution reverted')
        || msg.includes('invalid opcode')
        || msg.includes('out of gas')
        || msg.includes('insufficient funds for gas * price + value')
        || msg.includes('insufficient funds')
    );
}

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
interface MethodBackoffState {
    failures: number;
    cooldownUntil: number;
}
interface RpcMethodUsage {
    chainId: number;
    executionLane: EndpointExecutionLane;
    method: string;
    importance: RpcImportance;
    rpcClass: RpcClass;
    path: string;
    requests: number;
    endpointAttempts: number;
    successes: number;
    endpointFailures: number;
    allFailed: number;
    timeoutErrors: number;
    latencyMsTotal: number;
    lastLatencyMs: number;
    updatedAt: number;
}

interface EndpointMethodTimeoutHealth {
    windowStart: number;
    attempts: number;
    timeouts: number;
    cooldownUntil: number;
}

interface RpcLimiterState {
    inFlight: number;
    queue: Array<() => void>;
}

const methodBackoff = new Map<string, MethodBackoffState>();
const methodLimiter = new Map<string, RpcLimiterState>();
const inflightRpcRequests = new Map<string, Promise<any>>();
const inflightRpcRawRequests = new Map<string, Promise<any>>();
const rawTxHashCache = new Map<string, { txHash: string; timestamp: number }>();
type TxObservedStatus = TxLifecycleResult['status'] | 'send_failed';
interface TxLifecycleSnapshot {
    chainId: number;
    txHash: string;
    status: TxObservedStatus;
    updatedAt?: number;
    firstSeenAt?: number;
    confirmedAt?: number;
    attempts?: number;
    lastRpcError?: string;
    source?: string;
}
const txLifecycleStateCache = new Map<string, TxLifecycleSnapshot>();
const TX_LIFECYCLE_STATE_TTL_MS = Math.max(5_000, Number(process.env.TX_LIFECYCLE_STATE_TTL_MS || '180000'));
const TX_LIFECYCLE_STATE_MAX = Math.max(256, Number(process.env.TX_LIFECYCLE_STATE_MAX || '20000'));
const rpcChainDegradedState = new Map<number, { until: number; updatedAt: number; lastError?: string; method?: string }>();
const RPC_CHAIN_DEGRADED_TTL_MS = Math.max(500, Number(process.env.RPC_CHAIN_DEGRADED_TTL_MS || '4000'));
const rpcMethodUsage = new Map<string, RpcMethodUsage>();
const endpointMethodTimeoutHealth = new Map<string, EndpointMethodTimeoutHealth>();
const rpcPoolInflight: Record<RpcClass, number> = {
    critical_tx: 0,
    best_effort_read: 0
};

function rpcMethodUsageKey(chainId: number, executionLane: EndpointExecutionLane, method: string, importance: RpcImportance, rpcClass: RpcClass, path: string): string {
    return `${chainId}:${executionLane}:${method}:${importance}:${rpcClass}:${path}`;
}

function getOrCreateRpcMethodUsage(
    chainId: number,
    executionLane: EndpointExecutionLane,
    method: string,
    importance: RpcImportance,
    rpcClass: RpcClass,
    path: string
): RpcMethodUsage {
    const key = rpcMethodUsageKey(chainId, executionLane, method, importance, rpcClass, path);
    let row = rpcMethodUsage.get(key);
    if (!row) {
        row = {
            chainId,
            executionLane,
            method,
            importance,
            rpcClass,
            path,
            requests: 0,
            endpointAttempts: 0,
            successes: 0,
            endpointFailures: 0,
            allFailed: 0,
            timeoutErrors: 0,
            latencyMsTotal: 0,
            lastLatencyMs: 0,
            updatedAt: Date.now()
        };
        rpcMethodUsage.set(key, row);
    }
    return row;
}

function markRpcMethodUsage(
    chainId: number,
    executionLane: EndpointExecutionLane,
    method: string,
    importance: RpcImportance,
    rpcClass: RpcClass,
    path: string,
    field: 'requests' | 'endpointAttempts' | 'successes' | 'endpointFailures' | 'allFailed' | 'timeoutErrors'
): void {
    const row = getOrCreateRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path);
    row[field] += 1;
    row.updatedAt = Date.now();
}

function markRpcMethodLatency(
    chainId: number,
    executionLane: EndpointExecutionLane,
    method: string,
    importance: RpcImportance,
    rpcClass: RpcClass,
    path: string,
    latencyMs: number
): void {
    const row = getOrCreateRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path);
    const bounded = Math.max(0, Math.floor(latencyMs));
    row.latencyMsTotal += bounded;
    row.lastLatencyMs = bounded;
    row.updatedAt = Date.now();
}

function endpointMethodHealthKey(endpointUrl: string, method: string): string {
    return `${endpointUrl}::${method}`;
}

function getEndpointMethodTimeoutHealth(key: string): EndpointMethodTimeoutHealth {
    const now = Date.now();
    let state = endpointMethodTimeoutHealth.get(key);
    if (!state) {
        state = { windowStart: now, attempts: 0, timeouts: 0, cooldownUntil: 0 };
        endpointMethodTimeoutHealth.set(key, state);
        return state;
    }
    if (now - state.windowStart >= ENDPOINT_METHOD_TIMEOUT_WINDOW_MS) {
        state.windowStart = now;
        state.attempts = 0;
        state.timeouts = 0;
    }
    if (state.cooldownUntil > 0 && now >= state.cooldownUntil) {
        state.cooldownUntil = 0;
    }
    return state;
}

function isEndpointMethodTimeoutCooling(key: string): boolean {
    const state = getEndpointMethodTimeoutHealth(key);
    return state.cooldownUntil > Date.now();
}

function markEndpointMethodAttempt(key: string): void {
    const state = getEndpointMethodTimeoutHealth(key);
    state.attempts += 1;
}

function maybeOpenEndpointMethodTimeoutCooldown(key: string): void {
    const state = getEndpointMethodTimeoutHealth(key);
    if (state.attempts < ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS) return;
    const timeoutRate = state.timeouts / Math.max(1, state.attempts);
    if (timeoutRate < ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD) return;
    state.cooldownUntil = Date.now() + ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS;
    state.windowStart = Date.now();
    state.attempts = 0;
    state.timeouts = 0;
}

function markEndpointMethodTimeout(key: string): void {
    const state = getEndpointMethodTimeoutHealth(key);
    state.timeouts += 1;
    maybeOpenEndpointMethodTimeoutCooldown(key);
}

function isWriteMethod(method: string): boolean {
    return (
        method === 'eth_sendRawTransaction'
        || method === 'eth_sendTransaction'
        || method === 'sendTransaction'
        || method === 'simulateTransaction'
    );
}

function inferRpcClass(method: string, importance: RpcImportance): RpcClass {
    if (
        method === 'eth_sendRawTransaction'
        || method === 'eth_sendTransaction'
        || method === 'sendTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt'
        || method === 'eth_getTransactionCount'
        || method === 'eth_estimateGas'
        || method === 'eth_feeHistory'
        || method === 'eth_gasPrice'
    ) {
        return 'critical_tx';
    }
    if (method === 'eth_call') return 'best_effort_read';
    return importance === 'critical' ? 'critical_tx' : 'best_effort_read';
}

function classifyRpcFailureCode(error: unknown): string {
    const msg = String((error as any)?.message || error || '').toLowerCase();
    if (!msg) return 'unknown';
    if (msg.includes('aborted_by_signal')) return 'aborted_by_signal';
    if (msg.includes('endpoint_method_timeout_cooldown')) return 'endpoint_method_timeout_cooldown';
    if (msg.includes('capacity_limited')) return 'capacity_limited';
    if (msg.includes('circuit_open')) return 'circuit_open';
    if (msg.includes('aborterror') || msg.includes('timeout')) return 'timeout';
    if (msg.includes('empty result')) return 'empty_result';
    if (msg.includes('invalid tx hash')) return 'invalid_hash';
    if (msg.includes('rpc error')) return 'rpc_error';
    if (msg.includes('http ')) return 'http_error';
    return 'unknown';
}

function shouldCoalesceMethod(method: string): boolean {
    return !isWriteMethod(method) || method === 'eth_sendRawTransaction';
}

function shouldTreatSendRawErrorAsKnown(message: string): boolean {
    const msg = String(message || '').toLowerCase();
    if (!msg) return false;
    return (
        msg.includes('already known')
        || msg.includes('known transaction')
        || msg.includes('already imported')
        || msg.includes('already exists')
    );
}

function normalizeRawTx(rawTx: string): string | null {
    if (typeof rawTx !== 'string' || rawTx.length === 0) return null;
    const normalized = rawTx.startsWith('0x') ? rawTx : `0x${rawTx}`;
    if (!/^0x[0-9a-fA-F]+$/.test(normalized)) return null;
    return normalized.toLowerCase();
}

function tryGetRawTxHash(rawTx: string): string | null {
    const normalized = normalizeRawTx(rawTx);
    if (!normalized) return null;
    try {
        return ethers.keccak256(normalized as `0x${string}`).toLowerCase();
    } catch {
        return null;
    }
}

function createStableRequestKey(chainId: number, method: string, params: any): string {
    const seen = new WeakSet<object>();
    const serialized = JSON.stringify(params, (_key, value) => {
        if (typeof value === 'bigint') return `bigint:${value.toString()}`;
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value;
        if (seen.has(value)) return '__cycle__';
        seen.add(value);
        return Object.keys(value).sort().reduce((acc, itemKey) => {
            (acc as Record<string, any>)[itemKey] = (value as Record<string, any>)[itemKey];
            return acc;
        }, {} as Record<string, any>);
    }) || '__no_params__';

    let key = `${chainId}:${method}:${serialized}`;
    if (key.length > RPC_INFLIGHT_KEY_MAX_LEN) {
        key = `${chainId}:${method}:${Buffer.from(serialized).toString('base64url').slice(0, RPC_INFLIGHT_KEY_MAX_LEN)}`;
    }
    return key;
}

function buildMethodBackoffKey(
    chainId: number,
    executionLane: EndpointExecutionLane,
    method: string,
    importance: RpcImportance = 'normal',
    rpcClass: RpcClass = 'best_effort_read'
): string {
    return `${chainId}:${executionLane}:${method}:${importance}:${rpcClass}`;
}

function getMethodBackoffState(backoffKey: string): MethodBackoffState | null {
    const state = methodBackoff.get(backoffKey);
    if (!state) return null;
    if (Date.now() > state.cooldownUntil) {
        methodBackoff.delete(backoffKey);
        return null;
    }
    return state;
}

function markMethodSuccess(backoffKey: string): void {
    methodBackoff.delete(backoffKey);
}

function markMethodFailure(backoffKey: string): MethodBackoffState {
    const current = methodBackoff.get(backoffKey);
    const failures = Math.min(8, (current?.failures || 0) + 1);
    const cooldownMs = Math.min(RPC_METHOD_COOLDOWN_MAX_MS, RPC_METHOD_COOLDOWN_BASE_MS * (2 ** (failures - 1)));
    const next: MethodBackoffState = {
        failures,
        cooldownUntil: Date.now() + cooldownMs
    };
    methodBackoff.set(backoffKey, next);
    return next;
}

const RESILIENT_ETH_CALL_PATHS = new Set([
    'direct_swap',
    'confirm_wait',
    'token_metadata',
    'token_decimals',
    'token_supply',
    'token_supply_market_cap',
]);

function isResilientEthCallPath(method: string, path: string, importance: RpcImportance): boolean {
    if (method !== 'eth_call') return false;
    return importance === 'critical' || RESILIENT_ETH_CALL_PATHS.has(String(path || 'default'));
}

function getEndpointAttemptBudget(
    method: string,
    importance: RpcImportance,
    endpointCount: number,
    cooldownActive: boolean,
    forceExhaustive = false,
    path = 'default'
): number {
    const isTxLifecycleMethod = method === 'eth_sendRawTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt';
    if (isTxLifecycleMethod && importance === 'critical') {
        const lifecycleBudget = Math.max(1, Math.min(endpointCount, TX_LIFECYCLE_ENDPOINT_FANOUT));
        return lifecycleBudget;
    }

    if (forceExhaustive) {
        return Math.max(1, endpointCount);
    }

    const ethCallBudget = method === 'eth_call'
        ? (importance === 'critical' ? RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL : RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL)
        : null;
    const baseBudget = ethCallBudget ?? (isWriteMethod(method)
        ? RPC_MAX_ENDPOINT_ATTEMPTS_WRITE
        : (importance === 'critical' ? RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL : RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL));
    let budget = Math.max(1, Math.min(endpointCount, baseBudget));

    if (cooldownActive && !isTxLifecycleMethod) {
        const cooldownAttemptCap = isResilientEthCallPath(method, path, importance)
            ? Math.max(2, RPC_METHOD_COOLDOWN_ATTEMPT_CAP)
            : importance === 'critical'
            ? (isWriteMethod(method)
                ? Math.max(3, RPC_METHOD_COOLDOWN_ATTEMPT_CAP)
                : Math.max(2, RPC_METHOD_COOLDOWN_ATTEMPT_CAP))
            : RPC_METHOD_COOLDOWN_ATTEMPT_CAP;
        budget = Math.max(1, Math.min(budget, cooldownAttemptCap));
    }

    if (isResilientEthCallPath(method, path, importance)) {
        budget = Math.max(budget, Math.min(endpointCount, 3));
    }

    return budget;
}

function expandEthCallSelectionWithCheapFallback(params: {
    method: string;
    path: string;
    importance: RpcImportance;
    selectedEndpoints: RpcEndpointConfig[];
    chainSlug: string;
    primaryUrl?: string;
}): RpcEndpointConfig[] {
    if (!isResilientEthCallPath(params.method, params.path, params.importance)) {
        return params.selectedEndpoints;
    }

    const hasPublic = params.selectedEndpoints.some((endpoint) => endpoint.type === 'public');
    if (hasPublic) return params.selectedEndpoints;

    const cheapEndpoints = filterEndpointsByMethod(
        getRpcEndpointsWithStrategy(params.chainSlug, 'cheap', params.primaryUrl),
        params.method
    ).filter((endpoint) => endpoint.type === 'public');

    if (!cheapEndpoints.length) return params.selectedEndpoints;

    const seen = new Set(params.selectedEndpoints.map((endpoint) => endpoint.url));
    const expanded = [...params.selectedEndpoints];
    for (const endpoint of cheapEndpoints) {
        if (!endpoint?.url || seen.has(endpoint.url)) continue;
        seen.add(endpoint.url);
        expanded.push(endpoint);
        if (expanded.length >= params.selectedEndpoints.length + 2) break;
    }
    return expanded;
}

function expandCriticalSelectionWithPublicFallback(params: {
    executionLane: EndpointExecutionLane;
    selectedEndpoints: RpcEndpointConfig[];
    chainSlug: string;
    primaryUrl?: string;
    method: string;
}): RpcEndpointConfig[] {
    if (params.executionLane !== 'critical') {
        return params.selectedEndpoints;
    }

    if (params.selectedEndpoints.some((endpoint) => endpoint.type === 'public')) {
        return params.selectedEndpoints;
    }

    const premiumSelected = params.selectedEndpoints.filter((endpoint) => endpoint.type === 'premium');
    if (premiumSelected.length === 0) {
        return params.selectedEndpoints;
    }

    const alwaysIncludePublicFallback = params.method === 'eth_getTransactionByHash'
        || params.method === 'eth_getTransactionReceipt';
    const allPremiumCircuited = premiumSelected.every((endpoint) => isCircuitOpen(endpoint.url));
    if (!alwaysIncludePublicFallback && !allPremiumCircuited) {
        return params.selectedEndpoints;
    }

    const cheapPublicEndpoints = filterEndpointsByMethod(
        getRpcEndpointsForLane(params.chainSlug, 'cheap', params.primaryUrl),
        params.method
    ).filter((endpoint) => endpoint.type === 'public');

    if (!cheapPublicEndpoints.length) {
        return params.selectedEndpoints;
    }

    const seen = new Set(params.selectedEndpoints.map((endpoint) => endpoint.url));
    const expanded = [...params.selectedEndpoints];
    for (const endpoint of cheapPublicEndpoints) {
        if (!endpoint?.url || seen.has(endpoint.url)) continue;
        seen.add(endpoint.url);
        expanded.push(endpoint);
        if (expanded.length >= params.selectedEndpoints.length + 2) break;
    }
    return expanded;
}

function shouldForceExhaustiveFailover(
    method: string,
    importance: RpcImportance,
    options?: { exhaustiveFailover?: boolean }
): boolean {
    if (options?.exhaustiveFailover === true) return true;
    // Trade-critical path: exhaust all available endpoints for reliability.
    // eth_call is latency-sensitive and already uses hedge + capped endpoint budget.
    if (importance !== 'critical') return false;
    if (method === 'eth_call') return RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL;
    return method === 'eth_estimateGas'
        || method === 'eth_sendRawTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt';
}

function getMethodConcurrencyLimit(
    method: string,
    importance: RpcImportance,
    cooldownActive: boolean,
    rpcClass: RpcClass
): number {
    let base = rpcClass === 'critical_tx'
        ? RPC_CRITICAL_POOL_CONCURRENCY
        : RPC_BEST_EFFORT_POOL_CONCURRENCY;

    if (rpcClass === 'critical_tx') {
        base = method === 'eth_call'
            ? (importance === 'critical' ? RPC_CONCURRENCY_ETH_CALL_CRITICAL : RPC_CONCURRENCY_ETH_CALL_NORMAL)
            : (isWriteMethod(method)
                ? RPC_CONCURRENCY_WRITE
                : (importance === 'critical' ? RPC_CONCURRENCY_CRITICAL : RPC_CONCURRENCY_NORMAL));
    }

    if (cooldownActive) {
        if (importance === 'critical') {
            base = Math.max(2, Math.floor(base * 0.75));
        } else {
            base = Math.max(1, Math.floor(base / 2));
        }
    }
    return base;
}

function getLimiterState(key: string): RpcLimiterState {
    let state = methodLimiter.get(key);
    if (!state) {
        state = { inFlight: 0, queue: [] };
        methodLimiter.set(key, state);
    }
    return state;
}

async function withMethodLimiter<T>(key: string, limit: number, fn: () => Promise<T>): Promise<T> {
    const state = getLimiterState(key);

    if (state.inFlight >= limit) {
        await new Promise<void>(resolve => {
            state.queue.push(resolve);
        });
    }

    state.inFlight += 1;
    try {
        return await fn();
    } finally {
        state.inFlight = Math.max(0, state.inFlight - 1);
        const next = state.queue.shift();
        if (next) next();
    }
}

function getRawTxCache(chainId: number, rawTxHash: string): string | null {
    const key = `${chainId}:${rawTxHash}`;
    const hit = rawTxHashCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.timestamp > RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS) {
        rawTxHashCache.delete(key);
        return null;
    }
    return hit.txHash;
}

function setRawTxCache(chainId: number, rawTxHash: string, txHash: string): void {
    if (rawTxHashCache.size >= RPC_SEND_RAW_HASH_CACHE_MAX) {
        const now = Date.now();
        for (const [key, value] of rawTxHashCache.entries()) {
            if (now - value.timestamp > RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS) {
                rawTxHashCache.delete(key);
            }
        }
        if (rawTxHashCache.size >= RPC_SEND_RAW_HASH_CACHE_MAX) {
            const oldestKeys = Array.from(rawTxHashCache.keys()).slice(0, Math.floor(RPC_SEND_RAW_HASH_CACHE_MAX * 0.2));
            for (const key of oldestKeys) rawTxHashCache.delete(key);
        }
    }
    rawTxHashCache.set(`${chainId}:${rawTxHash}`, { txHash, timestamp: Date.now() });
}

function txLifecycleKey(chainId: number, txHash: string): string {
    return `${chainId}:${String(txHash || '').toLowerCase()}`;
}

function pruneTxLifecycleStateCache(): void {
    if (txLifecycleStateCache.size < TX_LIFECYCLE_STATE_MAX) return;
    const now = Date.now();
    for (const [key, row] of txLifecycleStateCache.entries()) {
        const updatedAt = row.updatedAt || 0;
        if (now - updatedAt > TX_LIFECYCLE_STATE_TTL_MS) {
            txLifecycleStateCache.delete(key);
        }
    }
    if (txLifecycleStateCache.size <= TX_LIFECYCLE_STATE_MAX) return;
    const drop = Math.max(1, Math.floor(TX_LIFECYCLE_STATE_MAX * 0.2));
    const oldest = Array.from(txLifecycleStateCache.entries())
        .sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0))
        .slice(0, drop);
    for (const [key] of oldest) txLifecycleStateCache.delete(key);
}

export function recordTxLifecycleState(snapshot: TxLifecycleSnapshot): void {
    if (!snapshot?.chainId || !snapshot?.txHash) return;
    pruneTxLifecycleStateCache();
    const key = txLifecycleKey(snapshot.chainId, snapshot.txHash);
    const prev = txLifecycleStateCache.get(key);
    txLifecycleStateCache.set(key, {
        ...(prev || {}),
        ...snapshot,
        txHash: String(snapshot.txHash).toLowerCase(),
        updatedAt: Date.now()
    });
    if (snapshot.status === 'confirmed_success' || snapshot.status === 'confirmed_failed') {
        reportReceiptSeen({
            chainId: snapshot.chainId,
            txHash: snapshot.txHash,
            success: snapshot.status === 'confirmed_success',
            rpcError: snapshot.lastRpcError,
            source: 'rpc_receipt'
        });
    } else if (snapshot.status === 'visible_pending') {
        reportTxByHashSeen({
            chainId: snapshot.chainId,
            txHash: snapshot.txHash,
            rpcError: snapshot.lastRpcError,
            source: 'rpc_tx'
        });
    } else if (snapshot.status === 'broadcasted_unseen' || snapshot.status === 'dropped_timeout' || snapshot.status === 'send_failed') {
        reportRpcUncertain({
            chainId: snapshot.chainId,
            txHash: snapshot.txHash,
            error: snapshot.lastRpcError || snapshot.status
        });
    }
}

export function getTxLifecycleState(chainId: number, txHash: string): TxLifecycleSnapshot | null {
    const key = txLifecycleKey(chainId, txHash);
    const row = txLifecycleStateCache.get(key);
    if (!row) return null;
    const updatedAt = row.updatedAt || 0;
    if (Date.now() - updatedAt > TX_LIFECYCLE_STATE_TTL_MS) {
        txLifecycleStateCache.delete(key);
        return null;
    }
    return row;
}

function markChainRpcDegraded(chainId: number, method: string, errorMessage?: string): void {
    rpcChainDegradedState.set(chainId, {
        until: Date.now() + RPC_CHAIN_DEGRADED_TTL_MS,
        updatedAt: Date.now(),
        method,
        lastError: errorMessage ? String(errorMessage).slice(0, 180) : undefined
    });
}

export function getChainRpcDegradeState(chainId: number): { degraded: boolean; until: number; updatedAt: number; method?: string; lastError?: string } {
    const row = rpcChainDegradedState.get(chainId);
    if (!row) return { degraded: false, until: 0, updatedAt: 0 };
    if (Date.now() > row.until) {
        rpcChainDegradedState.delete(chainId);
        return { degraded: false, until: 0, updatedAt: 0 };
    }
    return { degraded: true, ...row };
}

/**
 * Make an RPC call with automatic failover
 */
export async function callRpc<T = any>(
    chainIdOrName: number | string,
    method: string,
    params: any = [],
    options: {
        strategy?: 'fast' | 'cheap';
        importance?: RpcImportance;
        rpcClass?: RpcClass;
        path?: string;
        exhaustiveFailover?: boolean;
        sendRawFanout?: boolean;
        bypassRawTxCache?: boolean;
        signal?: AbortSignal;
        lane?: EndpointExecutionLane;
    } = {}
): Promise<T> {
    let endpoints: RpcEndpointConfig[] = [];
    let chainName = typeof chainIdOrName === 'string' ? chainIdOrName : `Chain ${chainIdOrName}`;
    let chainSlug = typeof chainIdOrName === 'number'
        ? (CHAIN_ID_TO_NAME[chainIdOrName] || 'eth')
        : chainIdOrName.toLowerCase();
    let primaryUrl: string | undefined;
    let chainId: number;
    const requestedStrategy: 'fast' | 'cheap' = options.strategy || 'cheap';

    const isLatestBlockRead =
        method === 'eth_getBlockByNumber'
        && Array.isArray(params)
        && String(params[0] || '').toLowerCase() === 'latest';
    const cacheableMethod = isCacheable(method) && !isLatestBlockRead;
    if (cacheableMethod) {
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

    const effectiveImportance: RpcImportance =
        options.importance || (options.strategy === 'fast' ? 'critical' : 'normal');
    const executionLane: EndpointExecutionLane = options.lane || inferExecutionLane(method, effectiveImportance);

    try {
        const config = getChainConfig(chainId);
        chainName = config.name;
        chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
        const strategy = executionLane === 'critical' ? 'fast' : requestedStrategy;
        primaryUrl = getPrimaryRpcUrl(chainSlug);
        endpoints = getRpcEndpointsForLane(chainSlug, executionLane, primaryUrl);
        endpoints = filterEndpointsByMethod(endpoints, method);

        const upgradeDecision = shouldUpgradeRpcStrategy({
            endpoints,
            getHealth: getEndpointHealthView,
            method,
            importance: effectiveImportance
        });
        if (executionLane === 'cheap' && strategy === 'cheap' && upgradeDecision.upgrade) {
            const upgraded = getRpcEndpointsForLane(chainSlug, 'critical', primaryUrl);
            if (upgraded.length > 0) {
                endpoints = filterEndpointsByMethod(upgraded, method);
                logger.warn(LogCode.API_FETCH_FAILED, 'RPC strategy upgraded to fast due to degraded cheap pool', {
                    chain: chainName,
                    method,
                    executionLane,
                    lane: upgradeDecision.lane,
                    reasons: upgradeDecision.reasons,
                    role: LogRole.METRIC
                });
            }
        }

        // For tx submission + visibility path, always include cheap-pool endpoints as backup
        // so fast/premium-only mode cannot starve write/read quorum.
        const isTxLifecycleMethod = method === 'eth_sendRawTransaction'
            || method === 'eth_getTransactionByHash'
            || method === 'eth_getTransactionReceipt';
        if (isTxLifecycleMethod) {
            const cheapEndpoints = filterEndpointsByMethod(
                getRpcEndpointsForLane(chainSlug, 'cheap', primaryUrl),
                method
            );
            if (cheapEndpoints.length > 0) {
                const seen = new Set<string>();
                const merged: RpcEndpointConfig[] = [];
                for (const ep of [...endpoints, ...cheapEndpoints]) {
                    if (!ep?.url || seen.has(ep.url)) continue;
                    seen.add(ep.url);
                    merged.push(ep);
                }
                endpoints = merged;
            }
        }
    } catch (e) {
        // Safe fallback for edge cases
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    if (!endpoints || endpoints.length === 0) {
        throw new Error(`No RPC endpoints configured for ${chainName}`);
    }

    const rpcClass: RpcClass = options.rpcClass || inferRpcClass(method, effectiveImportance);
    const path = String(options.path || 'default');
    const backoffKey = buildMethodBackoffKey(chainId, executionLane, method, effectiveImportance, rpcClass);
    const cooldownState = getMethodBackoffState(backoffKey);
    const cooldownActive = !!cooldownState;
    const limiterKey = `${chainId}:${executionLane}:${method}:${effectiveImportance}:${rpcClass}`;
    const concurrencyLimit = getMethodConcurrencyLimit(method, effectiveImportance, cooldownActive, rpcClass);
    const requestTimeoutMs = resolveRpcTimeoutMs(method, options);
    const rawTxHash = method === 'eth_sendRawTransaction'
        ? tryGetRawTxHash(String(Array.isArray(params) ? (params[0] || '') : ''))
        : null;

    if (rawTxHash && !options.bypassRawTxCache) {
        const cachedSubmittedHash = getRawTxCache(chainId, rawTxHash);
        if (cachedSubmittedHash) {
            return cachedSubmittedHash as T;
        }
    }

    const coalescingEnabled = shouldCoalesceMethod(method);
    const inflightKey = rawTxHash
        ? `${chainId}:${method}:${rawTxHash}`
        : createStableRequestKey(chainId, method, params);

    if (coalescingEnabled) {
        const existing = inflightRpcRequests.get(inflightKey);
        if (existing) return await existing as T;
    }

    const runCall = async (): Promise<T> => {
        if (options.signal?.aborted) {
            throw new Error('aborted_by_signal');
        }
        markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'requests');
        rpcPoolInflight[rpcClass] += 1;
        const runStartedAt = Date.now();
        try {
            const request: RpcRequest = {
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params,
            };

            const scoreTable = buildRpcScoreTable({
                endpoints,
                method,
                importance: effectiveImportance,
                now: Date.now(),
                getHealth: getEndpointHealthView,
                getUsage: getEndpointUsageView
            });
            const sortedEndpoints = scoreTable.map((row) => row.endpoint);
            const forceExhaustiveFailover = shouldForceExhaustiveFailover(method, effectiveImportance, options);
            const lane = inferRpcLane(method, effectiveImportance);
            const backgroundPressure = executionLane === 'cheap' && lane === 'background' && hasCriticalRpcPressure();
            let endpointBudget = getEndpointAttemptBudget(
                method,
                effectiveImportance,
                sortedEndpoints.length,
                cooldownActive,
                forceExhaustiveFailover,
                path
            );
            if (backgroundPressure) {
                endpointBudget = Math.max(1, Math.min(endpointBudget, 1));
            }
            endpointBudget = extendCheapBudgetToIncludePremiumFallback({
                strategy: requestedStrategy,
                sortedEndpoints,
                endpointBudget,
                forceExhaustiveFailover
            });
            const selectedAfterEthCallExpansion = expandEthCallSelectionWithCheapFallback({
                method,
                path,
                importance: effectiveImportance,
                selectedEndpoints: sortedEndpoints.slice(0, endpointBudget),
                chainSlug,
                primaryUrl,
            });
            const selectedEndpoints = expandCriticalSelectionWithPublicFallback({
                executionLane,
                selectedEndpoints: selectedAfterEthCallExpansion,
                chainSlug,
                primaryUrl,
                method,
            });
            const selectedPremiumCount = selectedEndpoints.filter((endpoint) => endpoint.type === 'premium').length;
            const selectedPublicCount = selectedEndpoints.filter((endpoint) => endpoint.type === 'public').length;
            const txLifecycleCritical =
                effectiveImportance === 'critical'
                && (
                    method === 'eth_sendRawTransaction'
                    || method === 'eth_getTransactionByHash'
                    || method === 'eth_getTransactionReceipt'
                );

            if (RPC_EXPLAIN_ENABLED && (txLifecycleCritical || options.path === 'direct_swap' || options.path === 'confirm_wait')) {
                logger.info(LogCode.SYS_INFO, 'RPC selection explain', {
                    chain: chainName,
                    backgroundPressure,
                    criticalPressure: getCriticalRpcPressureSnapshot(),
                    ...buildRpcSelectionExplain({
                        method,
                        importance: effectiveImportance,
                        strategy: options.strategy || 'cheap',
                        scores: scoreTable,
                        selectedEndpoints,
                        upgradeDecision: shouldUpgradeRpcStrategy({
                            endpoints,
                            getHealth: getEndpointHealthView,
                            method,
                            importance: effectiveImportance
                        })
                    })
                });
            }

            let lastError: Error | null = null;
            let rateLimitedFailures = 0;
            let paidFallbackSuccess = false;
            const failureReasonCounts = new Map<string, number>();
            const registerFailureReason = (message: string): void => {
                const reason = classifyFailoverReason(message);
                failureReasonCounts.set(reason, (failureReasonCounts.get(reason) || 0) + 1);
                if (isRateLimitedFailure(message)) {
                    rateLimitedFailures += 1;
                }
            };

        const runEndpointAttempt = async (endpoint: RpcEndpointConfig, delayMs = 0): Promise<T> => {
            if (options.signal?.aborted) {
                throw new Error('aborted_by_signal');
            }
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            const endpointMethodKey = endpointMethodHealthKey(endpoint.url, method);
            if (isEndpointMethodTimeoutCooling(endpointMethodKey)) {
                throw new Error('endpoint_method_timeout_cooldown');
            }

                markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointAttempts');
            markEndpointMethodAttempt(endpointMethodKey);
            if (!txLifecycleCritical && isCircuitOpen(endpoint.url)) {
                throw new Error('circuit_open');
            }
            if (txLifecycleCritical) {
                recordUsageStart(endpoint.url);
            } else {
                const capacity = checkAndReserveCapacity(endpoint, effectiveImportance);
                if (!capacity.ok) {
                    throw new Error(`capacity_limited:${capacity.reason || 'unknown'}`);
                }
            }

            const startTime = Date.now();
            let externalAbortListener: (() => void) | null = null;
            try {
                recordAttempt(endpoint.url);

                const controller = new AbortController();
                if (options.signal) {
                    if (options.signal.aborted) {
                        controller.abort();
                    } else {
                        externalAbortListener = () => controller.abort();
                        options.signal.addEventListener('abort', externalAbortListener, { once: true });
                    }
                }
                const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
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
                }).finally(() => {
                    clearTimeout(timeout);
                    if (externalAbortListener && options.signal) {
                        options.signal.removeEventListener('abort', externalAbortListener);
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json() as RpcResponse<T>;
                if (data.error) {
                    if (method === 'eth_sendRawTransaction' && rawTxHash && shouldTreatSendRawErrorAsKnown(data.error.message)) {
                        const knownHash = rawTxHash;
                        setRawTxCache(chainId, rawTxHash, knownHash);
                        recordSuccess(endpoint.url, Date.now() - startTime);
                        return knownHash as T;
                    }
                    throw new Error(`RPC Error: ${data.error.message}`);
                }
                if (data.result === undefined || data.result === null) {
                    throw new Error('RPC returned empty result');
                }

                const responseTime = Date.now() - startTime;
                recordSuccess(endpoint.url, responseTime);
                markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'successes');

                if (method === 'eth_sendRawTransaction' && rawTxHash) {
                    if (typeof data.result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(data.result)) {
                        throw new Error('RPC returned invalid tx hash for eth_sendRawTransaction');
                    }
                    const txHash = data.result;
                    setRawTxCache(chainId, rawTxHash, txHash);
                }

                return data.result as T;
            } catch (error: any) {
                recordFailure(endpoint.url);
                markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointFailures');
                const msg = String(error?.message || '');
                if (msg.includes('timeout_') || msg.toLowerCase().includes('aborterror')) {
                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'timeoutErrors');
                    if (!options.signal?.aborted) {
                        markEndpointMethodTimeout(endpointMethodKey);
                    }
                }
                throw error;
            } finally {
                recordUsageEnd(endpoint.url);
            }
        };

            const canHedgeReads = method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt';
        const canHedgeEthCall = method === 'eth_call';
        const canHedgeWrites = method === 'eth_sendRawTransaction' && RPC_CRITICAL_HEDGE_ALLOW_WRITE;
        const canUseCriticalHedge =
            RPC_CRITICAL_HEDGE_ENABLED &&
            !cooldownActive &&
            effectiveImportance === 'critical' &&
            selectedEndpoints.length >= 2 &&
            (canHedgeReads || canHedgeWrites || canHedgeEthCall);

            if (canUseCriticalHedge) {
            try {
                const hedgeFanout = canHedgeEthCall ? RPC_ETH_CALL_HEDGE_FANOUT : RPC_CRITICAL_HEDGE_FANOUT;
                const fanout = Math.min(hedgeFanout, selectedEndpoints.length);
                const attempts = Array.from({ length: fanout }, (_, idx) =>
                    runEndpointAttempt(selectedEndpoints[idx], Math.max(0, RPC_CRITICAL_HEDGE_STAGGER_MS) * idx)
                );
                const hedged = await Promise.any(attempts);
                if (cacheableMethod) {
                    const cacheKey = buildCacheKey(chainIdOrName, method, params);
                    setCachedRpc(cacheKey, hedged, getTtlForMethod(method));
                }
                markMethodSuccess(backoffKey);
                return hedged;
            } catch {
                // Fall through to sequential failover path below.
            }
        }

            const fanoutSendRaw = method === 'eth_sendRawTransaction' && options.sendRawFanout === true;
            if (fanoutSendRaw) {
            const sendRawFanoutMax = Math.max(
                1,
                Math.min(
                    selectedEndpoints.length,
                    Number(process.env.RPC_SENDRAW_FANOUT_MAX || '3')
                )
            );
            const endpointsToTry = selectedEndpoints.slice(0, sendRawFanoutMax);
            let acceptedHash: string | null = null;
            let acceptedCount = 0;
            let failedCount = 0;
            let knownCount = 0;
            const endpointResults: Array<{
                endpoint: string;
                status: 'accepted' | 'known' | 'failed';
                txHash?: string;
                error?: string;
            }> = [];
            const attemptPromises = endpointsToTry.map(async (endpoint) => {
                if (!endpoint?.url) throw new Error('invalid_endpoint');
                try {
                    const result = await runEndpointAttempt(endpoint);
                    const txHash = typeof result === 'string' && /^0x[0-9a-fA-F]{64}$/.test(result)
                        ? result
                        : '';
                    if (!txHash) {
                        failedCount += 1;
                        endpointResults.push({
                            endpoint: maskEndpoint(endpoint.url),
                            status: 'failed',
                            error: 'invalid_tx_hash_result'
                        });
                        throw new Error('invalid_tx_hash_result');
                    }
                    acceptedCount += 1;
                    endpointResults.push({
                        endpoint: maskEndpoint(endpoint.url),
                        status: 'accepted',
                        txHash
                    });
                    if (!acceptedHash) acceptedHash = txHash;
                    return txHash;
                } catch (error: any) {
                    const message = String(error?.message || error || '');
                    lastError = error instanceof Error ? error : new Error(message);
                    if (message.includes('already known') || message.includes('known transaction') || message.includes('already imported')) {
                        knownCount += 1;
                        if (!acceptedHash && rawTxHash) acceptedHash = rawTxHash;
                        endpointResults.push({
                            endpoint: maskEndpoint(endpoint.url),
                            status: 'known',
                            txHash: rawTxHash || undefined,
                            error: message.slice(0, 180)
                        });
                        if (rawTxHash) return rawTxHash;
                    }
                    failedCount += 1;
                    endpointResults.push({
                        endpoint: maskEndpoint(endpoint.url),
                        status: 'failed',
                        error: message.slice(0, 180)
                    });
                    throw error;
                }
            });

            // Fast path: return on first accepted/known hash, don't wait slow endpoints.
            try {
                const firstHash = await Promise.any(attemptPromises);
                if (firstHash && /^0x[0-9a-fA-F]{64}$/.test(firstHash)) {
                    logger.info(LogCode.API_FETCH_SUCCESS, 'eth_sendRawTransaction fanout completed', {
                        chain: chainName,
                        rpc_pool: rpcClass,
                        attemptedEndpoints: endpointsToTry.length,
                        selectedEndpoints: selectedEndpoints.length,
                        acceptedCount,
                        knownCount,
                        failedCount,
                        endpointBudget,
                        endpointResults,
                        role: LogRole.METRIC
                    });
                    markMethodSuccess(backoffKey);
                    if (rawTxHash) {
                        setRawTxCache(chainId, rawTxHash, firstHash);
                    }
                    return firstHash as T;
                }
            } catch {
                // Fall through to aggregate failure logging below.
            }

            if (acceptedHash) {
                logger.info(LogCode.API_FETCH_SUCCESS, 'eth_sendRawTransaction fanout completed', {
                    chain: chainName,
                    rpc_pool: rpcClass,
                    attemptedEndpoints: endpointsToTry.length,
                    selectedEndpoints: selectedEndpoints.length,
                    acceptedCount,
                    knownCount,
                    failedCount,
                    endpointBudget,
                    endpointResults,
                    role: LogRole.METRIC
                });
                markMethodSuccess(backoffKey);
                if (rawTxHash) {
                    setRawTxCache(chainId, rawTxHash, acceptedHash);
                }
                return acceptedHash as T;
            }

            logger.warn(LogCode.API_FETCH_FAILED, 'eth_sendRawTransaction fanout failed with no accepted hash', {
                chain: chainName,
                rpc_pool: rpcClass,
                attemptedEndpoints: endpointsToTry.length,
                selectedEndpoints: selectedEndpoints.length,
                failedCount,
                knownCount,
                endpointBudget,
                endpointResults,
                role: LogRole.METRIC
            });
        }

            for (let i = 0; i < selectedEndpoints.length; i++) {
            if (options.signal?.aborted) {
                throw new Error('aborted_by_signal');
            }
            const endpoint = selectedEndpoints[i];
            if (!endpoint?.url) continue;

            const isLast = i >= selectedEndpoints.length - 1;
            const startTime = Date.now();

            try {
                const result = await runEndpointAttempt(endpoint);

                if (cacheableMethod) {
                    const cacheKey = buildCacheKey(chainIdOrName, method, params);
                    setCachedRpc(cacheKey, result, getTtlForMethod(method));
                }

                if (i > 0) {
                    if (endpoint.type === 'premium') {
                        paidFallbackSuccess = true;
                    }
                    logger.debug(LogCode.API_FETCH_SUCCESS, `RPC failover success`, {
                        chain: chainName,
                        endpoint: i + 1,
                        total: selectedEndpoints.length,
                        endpointBudget,
                        responseTime: Date.now() - startTime,
                        paid_fallback_success: paidFallbackSuccess,
                        rate_limited_failures: rateLimitedFailures,
                        role: LogRole.METRIC
                    });
                }

                markMethodSuccess(backoffKey);
                return result;
            } catch (error: any) {
                const message = String(error?.message || error || '');
                if (message === 'circuit_open') {
                    lastError = new Error('all_endpoints_circuit_open');
                    registerFailureReason(message);
                    logger.debug(LogCode.API_FETCH_FAILED, `RPC circuit open, skipping endpoint`, {
                        chain: chainName,
                        endpoint: maskEndpoint(endpoint.url),
                        role: LogRole.METRIC
                    });
                    continue;
                }
                if (message.startsWith('capacity_limited:')) {
                    lastError = new Error(message);
                    registerFailureReason(message);
                    logger.debug(LogCode.API_FETCH_FAILED, `RPC capacity limited, skipping endpoint`, {
                        chain: chainName,
                        endpoint: maskEndpoint(endpoint.url),
                        reason: message.split(':')[1] || 'unknown',
                        role: LogRole.METRIC
                    });
                    continue;
                }
                if (message === 'endpoint_method_timeout_cooldown') {
                    lastError = new Error(message);
                    registerFailureReason(message);
                    continue;
                }

                lastError = error instanceof Error ? error : new Error(message);
                registerFailureReason(message);

                const isContractError = isNonRetryableRpcErrorMessage(message);
                if (isContractError) {
                    throw lastError;
                }

                if (i < 2) {
                    logger.aggregate(LogCode.API_FETCH_FAILED, `RPC endpoint failed`, {
                        chain: chainName,
                        endpoint: i + 1,
                        total: selectedEndpoints.length,
                        endpointBudget,
                        error: message,
                        duration: Date.now() - startTime,
                        role: LogRole.METRIC
                    });
                }

                if (!isLast) {
                    if (options.signal?.aborted) {
                        throw lastError;
                    }
                    if (!shouldSkipFailoverDelay(message)) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    continue;
                }
            }
        }

            const newBackoff = markMethodFailure(backoffKey);
            const failedLogKey = `${chainName}:${method}`;
            const rpcFailureCode = classifyRpcFailureCode(lastError);
            if (shouldLogAllRpcFailed(failedLogKey)) {
                logger.error(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
                    chain: chainName,
                    method,
                    rpc_pool: rpcClass,
                    rpc_failure_code: rpcFailureCode,
                    totalEndpoints: sortedEndpoints.length,
                    attemptedEndpoints: selectedEndpoints.length,
                    selectedPremiumCount,
                    selectedPublicCount,
                    endpointBudget,
                    exhaustiveFailover: forceExhaustiveFailover,
                    rate_limited_failures: rateLimitedFailures,
                    failure_reason_top: summarizeTopFailoverReasons(failureReasonCounts),
                    cooldownMs: Math.max(0, newBackoff.cooldownUntil - Date.now()),
                    lastError: lastError?.message,
                    role: LogRole.METRIC
                });
            } else {
                logger.debug(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed (suppressed)', {
                    chain: chainName,
                    method
                });
            }
            markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'allFailed');
            markChainRpcDegraded(chainId, method, lastError?.message || 'all_endpoints_failed');

            throw new Error(
                `All RPC endpoints failed for ${chainName}. Last error: ${lastError?.message || 'Unknown'}`
            );
        } finally {
            markRpcMethodLatency(chainId, executionLane, method, effectiveImportance, rpcClass, path, Date.now() - runStartedAt);
            rpcPoolInflight[rpcClass] = Math.max(0, rpcPoolInflight[rpcClass] - 1);
        }
    };

    const executePromise = withRpcLaneBudget({
        chainId,
        lane: executionLane,
        fn: () => withMethodLimiter(limiterKey, concurrencyLimit, runCall),
    });

    if (coalescingEnabled && inflightRpcRequests.size < RPC_INFLIGHT_MAP_MAX) {
        inflightRpcRequests.set(inflightKey, executePromise);
        try {
            return await executePromise;
        } finally {
            inflightRpcRequests.delete(inflightKey);
        }
    }

    return await executePromise;
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
    const effectiveImportance: RpcImportance = options.importance || 'normal';
    const requestTimeoutMs = resolveRpcTimeoutMs(method, { strategy: 'fast', importance: effectiveImportance });
        const sortedEndpoints = sortEndpointsByScore(filtered, method, effectiveImportance);

    for (let i = 0; i < sortedEndpoints.length; i++) {
        const endpoint = sortedEndpoints[i];
        if (!endpoint?.url) continue;

        if (isCircuitOpen(endpoint.url)) {
            logger.debug(LogCode.API_FETCH_FAILED, 'RPC circuit open, skipping endpoint', { endpoint: maskEndpoint(endpoint.url) });
            continue;
        }

        const capacity = checkAndReserveCapacity(endpoint, effectiveImportance);
        if (!capacity.ok) {
            logger.debug(LogCode.API_FETCH_FAILED, 'RPC capacity limited, skipping endpoint', {
                endpoint: maskEndpoint(endpoint.url),
                reason: capacity.reason
            });
            continue;
        }

        const startTime = Date.now();
        try {
            recordAttempt(endpoint.url);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
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
                logger.debug(LogCode.API_FETCH_SUCCESS, 'RPC failover success', {
                    endpoint: i + 1,
                    total: sortedEndpoints.length,
                    responseTime
                });
            }

            return data.result;
        } catch (error: any) {
            lastError = error;

            const isContractError = isNonRetryableRpcErrorMessage(error?.message || '');

            if (isContractError) {
                throw error;
            }

            recordFailure(endpoint.url);

            if (i < 2) {
                logger.aggregate(LogCode.API_FETCH_FAILED, 'RPC endpoint failed', {
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

    const failedLogKey = `custom:${method}`;
    if (shouldLogAllRpcFailed(failedLogKey)) {
        logger.error(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
            method,
            totalEndpoints: sortedEndpoints.length,
            lastError: lastError?.message
        });
    } else {
        logger.debug(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed (suppressed)', {
            method
        });
    }

    throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Call RPC and return raw response (used when revert data is needed)
 */
export async function callRpcRaw<T = any>(
    chainIdOrName: number | string,
    method: string,
    params: any = [],
    options: {
        strategy?: 'fast' | 'cheap';
        importance?: RpcImportance;
        rpcClass?: RpcClass;
        path?: string;
        exhaustiveFailover?: boolean;
        lane?: EndpointExecutionLane;
    } = {}
): Promise<RpcResponse<T>> {
    let endpoints: RpcEndpointConfig[] = [];
    let chainName = typeof chainIdOrName === 'string' ? chainIdOrName : `Chain ${chainIdOrName}`;
    let chainId: number;
    let chainSlug = 'eth';
    let primaryUrl: string | undefined;
    const requestedStrategy: 'fast' | 'cheap' = options.strategy || 'cheap';

    // Resolve Chain ID
    if (typeof chainIdOrName === 'number') {
        chainId = chainIdOrName;
    } else {
        const id = CHAIN_NAME_TO_ID[chainIdOrName.toLowerCase()];
        if (!id) throw new Error(`Unsupported chain name: ${chainIdOrName}`);
        chainId = id;
    }

    const effectiveImportance: RpcImportance =
        options.importance || (options.strategy === 'fast' ? 'critical' : 'normal');
    const executionLane: EndpointExecutionLane = options.lane || inferExecutionLane(method, effectiveImportance);

    try {
        const config = getChainConfig(chainId);
        chainName = config.name;
        chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
        const strategy = executionLane === 'critical' ? 'fast' : requestedStrategy;
        primaryUrl = getPrimaryRpcUrl(chainSlug);
        endpoints = getRpcEndpointsForLane(chainSlug, executionLane, primaryUrl);
        endpoints = filterEndpointsByMethod(endpoints, method);

        const upgradeDecision = shouldUpgradeRpcStrategy({
            endpoints,
            getHealth: getEndpointHealthView,
            method,
            importance: effectiveImportance
        });
        if (executionLane === 'cheap' && strategy === 'cheap' && upgradeDecision.upgrade) {
            const upgraded = getRpcEndpointsForLane(chainSlug, 'critical', primaryUrl);
            if (upgraded.length > 0) {
                endpoints = filterEndpointsByMethod(upgraded, method);
                logger.warn(LogCode.API_FETCH_FAILED, 'RPC strategy upgraded to fast due to degraded cheap pool', {
                    chain: chainName,
                    method,
                    executionLane,
                    lane: upgradeDecision.lane,
                    reasons: upgradeDecision.reasons
                });
            }
        }
    } catch (e) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    if (!endpoints || endpoints.length === 0) {
        throw new Error(`No RPC endpoints configured for ${chainName}`);
    }
    const rpcClass: RpcClass = options.rpcClass || inferRpcClass(method, effectiveImportance);
    const path = String(options.path || 'default');
    const backoffKey = buildMethodBackoffKey(chainId, executionLane, method, effectiveImportance, rpcClass);
    const cooldownState = getMethodBackoffState(backoffKey);
    const cooldownActive = !!cooldownState;
    const limiterKey = `${chainId}:${executionLane}:${method}:${effectiveImportance}:${rpcClass}:raw`;
    const concurrencyLimit = getMethodConcurrencyLimit(method, effectiveImportance, cooldownActive, rpcClass);
    const requestTimeoutMs = resolveRpcTimeoutMs(method, options);

    const inflightKey = `raw:${createStableRequestKey(chainId, method, params)}`;
    const existing = inflightRpcRawRequests.get(inflightKey);
    if (existing) {
        return await existing as RpcResponse<T>;
    }

    const runCall = async (): Promise<RpcResponse<T>> => {
        markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'requests');
        rpcPoolInflight[rpcClass] += 1;
        const request: RpcRequest = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
        };

        const scoreTable = buildRpcScoreTable({
            endpoints,
            method,
            importance: effectiveImportance,
            now: Date.now(),
            getHealth: getEndpointHealthView,
            getUsage: getEndpointUsageView
        });
        const sortedEndpoints = scoreTable.map((row) => row.endpoint);
        const forceExhaustiveFailover = shouldForceExhaustiveFailover(method, effectiveImportance, options);
        let endpointBudget = getEndpointAttemptBudget(
            method,
            effectiveImportance,
            sortedEndpoints.length,
            cooldownActive,
            forceExhaustiveFailover
        );
        endpointBudget = extendCheapBudgetToIncludePremiumFallback({
            strategy: requestedStrategy,
            sortedEndpoints,
            endpointBudget,
            forceExhaustiveFailover
        });
        const selectedEndpoints = expandCriticalSelectionWithPublicFallback({
            executionLane,
            selectedEndpoints: sortedEndpoints.slice(0, endpointBudget),
            chainSlug,
            primaryUrl,
            method,
        });
        const selectedPremiumCount = selectedEndpoints.filter((endpoint) => endpoint.type === 'premium').length;
        const selectedPublicCount = selectedEndpoints.filter((endpoint) => endpoint.type === 'public').length;
        if (RPC_EXPLAIN_ENABLED && effectiveImportance === 'critical') {
            logger.info(LogCode.SYS_INFO, 'RPC raw selection explain', {
                chain: chainName,
                ...buildRpcSelectionExplain({
                    method,
                    importance: effectiveImportance,
                    strategy: options.strategy || 'cheap',
                    scores: scoreTable,
                    selectedEndpoints,
                    upgradeDecision: shouldUpgradeRpcStrategy({
                        endpoints,
                        getHealth: getEndpointHealthView,
                        method,
                        importance: effectiveImportance
                    })
                })
            });
        }
        let lastError: Error | null = null;
        let rateLimitedFailures = 0;
        let paidFallbackSuccess = false;
        const failureReasonCounts = new Map<string, number>();
        const registerFailureReason = (message: string): void => {
            const reason = classifyFailoverReason(message);
            failureReasonCounts.set(reason, (failureReasonCounts.get(reason) || 0) + 1);
            if (isRateLimitedFailure(message)) {
                rateLimitedFailures += 1;
            }
        };

        for (let i = 0; i < selectedEndpoints.length; i++) {
            const endpoint = selectedEndpoints[i];
            if (!endpoint?.url) continue;

                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointAttempts');
            if (isCircuitOpen(endpoint.url)) {
                lastError = new Error('all_endpoints_circuit_open');
                registerFailureReason('circuit_open');
                logger.debug(LogCode.API_FETCH_FAILED, 'RPC circuit open, skipping endpoint', {
                    chain: chainName,
                    endpoint: maskEndpoint(endpoint.url)
                });
                continue;
            }

            const capacity = checkAndReserveCapacity(endpoint, effectiveImportance);
            if (!capacity.ok) {
                lastError = new Error(`capacity_limited:${capacity.reason || 'unknown'}`);
                registerFailureReason(`capacity_limited:${capacity.reason || 'unknown'}`);
                logger.debug(LogCode.API_FETCH_FAILED, 'RPC capacity limited, skipping endpoint', {
                    chain: chainName,
                    endpoint: maskEndpoint(endpoint.url),
                    reason: capacity.reason
                });
                continue;
            }

            const isLast = i >= selectedEndpoints.length - 1;
            const startTime = Date.now();
            try {
                recordAttempt(endpoint.url);

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
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
                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'successes');

                if (i > 0) {
                    if (endpoint.type === 'premium') {
                        paidFallbackSuccess = true;
                    }
                    logger.debug(LogCode.API_FETCH_SUCCESS, 'RPC failover success', {
                        chain: chainName,
                        endpoint: i + 1,
                        total: selectedEndpoints.length,
                        endpointBudget,
                        responseTime,
                        paid_fallback_success: paidFallbackSuccess,
                        rate_limited_failures: rateLimitedFailures,
                    });
                }

                markMethodSuccess(backoffKey);
                return data;
            } catch (error: any) {
                recordFailure(endpoint.url);
                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointFailures');
                const msg = String(error?.message || '');
                if (msg.includes('timeout_') || msg.toLowerCase().includes('aborterror')) {
                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'timeoutErrors');
                }
                lastError = error instanceof Error ? error : new Error(msg);
                registerFailureReason(msg);

                const isContractError = isNonRetryableRpcErrorMessage(msg);
                if (isContractError) {
                    throw lastError;
                }

                if (i < 2) {
                    logger.aggregate(LogCode.API_FETCH_FAILED, 'RPC endpoint failed', {
                        chain: chainName,
                        endpoint: i + 1,
                        total: selectedEndpoints.length,
                        endpointBudget,
                        error: msg,
                        duration: Date.now() - startTime
                    });
                }

                if (!isLast) {
                    if (!shouldSkipFailoverDelay(msg)) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    continue;
                }
            } finally {
                recordUsageEnd(endpoint.url);
            }
        }

        const newBackoff = markMethodFailure(backoffKey);
        const failedLogKey = `${chainName}:${method}:raw`;
        if (shouldLogAllRpcFailed(failedLogKey)) {
            logger.error(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
                chain: chainName,
                method,
                rpc_pool: rpcClass,
                rpc_failure_code: classifyRpcFailureCode(lastError),
                totalEndpoints: sortedEndpoints.length,
                attemptedEndpoints: selectedEndpoints.length,
                selectedPremiumCount,
                selectedPublicCount,
                endpointBudget,
                exhaustiveFailover: forceExhaustiveFailover,
                rate_limited_failures: rateLimitedFailures,
                failure_reason_top: summarizeTopFailoverReasons(failureReasonCounts),
                cooldownMs: Math.max(0, newBackoff.cooldownUntil - Date.now()),
                lastError: lastError?.message
            });
        } else {
            logger.debug(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed (suppressed)', {
                chain: chainName,
                method
            });
        }
        markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'allFailed');

        throw new Error(`All RPC endpoints failed for ${chainName}. Last error: ${lastError?.message || 'Unknown'}`);
    };

    const wrappedRunCall = async (): Promise<RpcResponse<T>> => {
        const startedAt = Date.now();
        try {
            return await runCall();
        } finally {
            markRpcMethodLatency(chainId, executionLane, method, effectiveImportance, rpcClass, path, Date.now() - startedAt);
            rpcPoolInflight[rpcClass] = Math.max(0, rpcPoolInflight[rpcClass] - 1);
        }
    };

    const executePromise = withRpcLaneBudget({
        chainId,
        lane: executionLane,
        fn: () => withMethodLimiter(limiterKey, concurrencyLimit, wrappedRunCall),
    });
    if (inflightRpcRawRequests.size < RPC_INFLIGHT_MAP_MAX) {
        inflightRpcRawRequests.set(inflightKey, executePromise);
        try {
            return await executePromise;
        } finally {
            inflightRpcRawRequests.delete(inflightKey);
        }
    }
    return await executePromise;
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
        logger.debug(LogCode.API_FETCH_SUCCESS, 'RPC circuit breaker reset', { endpoint: maskEndpoint(url) });
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
        logger.aggregate(LogCode.API_FETCH_FAILED, 'RPC circuit breaker opened', {
            endpoint: maskEndpoint(url),
            failures: health.consecutiveFailures
        });
    }
}

function getEndpointHealthView(url: string) {
    const health = getOrCreateHealth(url);
    return {
        successRate: health.totalAttempts > 0 ? health.successCount / health.totalAttempts : 0.7,
        avgResponseTime: health.avgResponseTime,
        circuitOpen: health.circuitOpen,
        consecutiveFailures: health.consecutiveFailures,
        totalAttempts: health.totalAttempts
    };
}

function getEndpointUsageView(url: string) {
    const usage = getOrCreateUsage(url);
    return {
        inFlight: usage.inFlight,
        secondCount: usage.secondCount,
        minuteCount: usage.minuteCount,
        lastUsedAt: usage.lastUsedAt
    };
}

function endpointCapacityPressure(endpoint: RpcEndpointConfig): number {
    const usage = getOrCreateUsage(endpoint.url);
    const limits = endpoint.limits || {};
    const rpsPressure = limits.rps ? usage.secondCount / Math.max(1, limits.rps) : 0;
    const rpmPressure = limits.rpm ? usage.minuteCount / Math.max(1, limits.rpm) : 0;
    const inFlightPressure = limits.maxInFlight ? usage.inFlight / Math.max(1, limits.maxInFlight) : 0;
    return Math.max(rpsPressure, rpmPressure, inFlightPressure);
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

function sortEndpointsByScore(endpoints: RpcEndpointConfig[], method: string, importance: RpcImportance): RpcEndpointConfig[] {
    return sortRpcEndpointsByScore({
        endpoints,
        method,
        importance,
        now: Date.now(),
        getHealth: getEndpointHealthView,
        getUsage: getEndpointUsageView
    });
}

function maskEndpoint(url: string): string {
    // Mask API keys in URLs for logging
    return url.replace(/[a-zA-Z0-9]{32,}/g, '***');
}

function shouldUpgradeToFast(endpoints: RpcEndpointConfig[], method: string, importance: RpcImportance): boolean {
    return shouldUpgradeRpcStrategy({
        endpoints,
        getHealth: getEndpointHealthView,
        method,
        importance
    }).upgrade;
}

/**
 * Get native balance (ETH, BNB, SOL, etc.)
 */
export async function getNativeBalance(
    address: string,
    chainIdOrName: number | string,
    blockTag: string | number = 'latest',
    options: { lane?: EndpointExecutionLane } = {}
): Promise<string> {
    const chainName = typeof chainIdOrName === 'number'
        ? CHAIN_ID_TO_NAME[chainIdOrName]
        : chainIdOrName;

    if (chainName === 'solana') {
        const result = await callRpc<{ value: number }>('solana', 'getBalance', [address]);
        return result.value.toString();
    } else {
        const chainId = typeof chainIdOrName === 'number' ? chainIdOrName : CHAIN_NAME_TO_ID[String(chainName).toLowerCase()];
        if (chainId) {
            const cached = getNativeBalanceSnapshot(chainId, address, blockTag);
            if (cached !== null) return cached;
            const value = await callRpc<string>(chainIdOrName, 'eth_getBalance', [address, blockTag], { lane: options.lane });
            return setNativeBalanceSnapshot(chainId, address, blockTag, value);
        }
        return await callRpc<string>(chainIdOrName, 'eth_getBalance', [address, blockTag], { lane: options.lane });
    }
}

/**
 * Get ERC20 balance via eth_call with RPC failover
 */
export async function getErc20Balance(
    tokenAddress: string,
    ownerAddress: string,
    chainIdOrName: number | string,
    blockTag: string | number = 'latest',
    options: { lane?: EndpointExecutionLane } = {}
): Promise<bigint> {
    const chainId = typeof chainIdOrName === 'number'
        ? chainIdOrName
        : CHAIN_NAME_TO_ID[String(chainIdOrName).toLowerCase()];
    if (chainId) {
        const cached = getErc20BalanceSnapshot(chainId, tokenAddress, ownerAddress, blockTag);
        if (cached !== null) return cached;
    }
    return await withRpcReadBudget({
        scope: 'rpc_read_erc20_balance',
        parts: [chainIdOrName, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), blockTag],
        successTtlMs: RPC_ERC20_BALANCE_SUCCESS_TTL_MS,
        failureCooldownMs: RPC_ERC20_BALANCE_FAILURE_COOLDOWN_MS,
        producer: async () => {
            const iface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
            const data = iface.encodeFunctionData('balanceOf', [ownerAddress]);
            const result = await callRpc<string>(chainIdOrName, 'eth_call', [{
                to: tokenAddress,
                data
            }, blockTag], { lane: options.lane });

            if (!result || result === '0x') return 0n;
            const [balance] = iface.decodeFunctionResult('balanceOf', result);
            const value = BigInt(balance);
            if (chainId) return setErc20BalanceSnapshot(chainId, tokenAddress, ownerAddress, blockTag, value);
            return value;
        }
    });
}

/**
 * Get ERC20 decimals via eth_call with RPC failover
 */
export async function getErc20Decimals(
    tokenAddress: string,
    chainIdOrName: number | string,
    blockTag: string | number = 'latest',
    options: { lane?: EndpointExecutionLane } = {}
): Promise<number> {
    return await withRpcReadBudget({
        scope: 'rpc_read_erc20_decimals',
        parts: [chainIdOrName, tokenAddress.toLowerCase(), blockTag],
        successTtlMs: RPC_ERC20_DECIMALS_SUCCESS_TTL_MS,
        failureCooldownMs: RPC_ERC20_DECIMALS_FAILURE_COOLDOWN_MS,
        producer: async () => {
            const iface = new ethers.Interface(['function decimals() view returns (uint8)']);
            const data = iface.encodeFunctionData('decimals', []);
            const result = await callRpc<string>(chainIdOrName, 'eth_call', [{
                to: tokenAddress,
                data
            }, blockTag], { lane: options.lane });

            if (!result || result === '0x') return 18;
            const [decimals] = iface.decodeFunctionResult('decimals', result);
            return Number(decimals);
        }
    });
}

/**
 * Get ERC20 allowance via eth_call with RPC failover
 */
export async function getErc20Allowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    chainIdOrName: number | string,
    blockTag: string | number = 'latest',
    options: { lane?: EndpointExecutionLane } = {}
): Promise<bigint> {
    const chainId = typeof chainIdOrName === 'number'
        ? chainIdOrName
        : CHAIN_NAME_TO_ID[String(chainIdOrName).toLowerCase()];
    if (chainId) {
        const cached = getErc20AllowanceSnapshot(chainId, tokenAddress, ownerAddress, spenderAddress, blockTag);
        if (cached !== null) return cached;
    }
    const iface = new ethers.Interface(['function allowance(address owner, address spender) view returns (uint256)']);
    const data = iface.encodeFunctionData('allowance', [ownerAddress, spenderAddress]);
    const result = await callRpc<string>(chainIdOrName, 'eth_call', [{
        to: tokenAddress,
        data
    }, blockTag], { lane: options.lane });

    if (!result || result === '0x') return 0n;
    const [allowance] = iface.decodeFunctionResult('allowance', result);
    const value = BigInt(allowance);
    if (chainId) return setErc20AllowanceSnapshot(chainId, tokenAddress, ownerAddress, spenderAddress, blockTag, value);
    return value;
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
        const observed = await getSharedTxObservation({
            chainId,
            txHash,
            scope: 'tx',
            producer: async () => ({
                tx: await callRpc(chainId, 'eth_getTransactionByHash', [txHash], { strategy: 'fast', importance: 'critical', lane: 'critical' }).catch(() => null),
                receipt: null,
                observedAt: Date.now()
            })
        });
        return observed.tx;
    }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
    chainId: number,
    txHash: string
): Promise<any> {
    const observed = await getSharedTxObservation({
        chainId,
        txHash,
        scope: 'receipt',
        producer: async () => ({
            tx: null,
            receipt: await callRpc(chainId, 'eth_getTransactionReceipt', [txHash], { strategy: 'fast', importance: 'critical', lane: 'critical' }).catch(() => null),
            observedAt: Date.now()
        })
    });
    return observed.receipt;
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
        if (!Array.isArray(requests) || requests.length === 0) {
            return [];
        }

        const chainId = typeof chain === 'string' ? (CHAIN_NAME_TO_ID[chain] || 1) : chain;
        const endpoints = getRpcEndpoints(chainId, 'cheap');

        if (endpoints.length === 0) {
            throw new Error(`No RPC endpoints configured for chain ${chainId}`);
        }

        const payload = requests.map(req => ({
            jsonrpc: '2.0',
            id: req.id,
            method: req.method,
            params: req.params
        }));

        let lastError: Error | null = null;

        for (let i = 0; i < endpoints.length; i++) {
            const url = endpoints[i];
            try {
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
                if (i > 0) {
                    logger.info(LogCode.API_FETCH_SUCCESS, 'Batch RPC failover success', {
                        chain: chainId,
                        endpointAttempt: i + 1,
                        totalEndpoints: endpoints.length,
                        batchSize: requests.length
                    });
                }
                return results;
            } catch (error: any) {
                lastError = error instanceof Error ? error : new Error(String(error));
                logger.warn(LogCode.API_FETCH_FAILED, 'Batch RPC endpoint failed', {
                    chain: chainId,
                    endpointAttempt: i + 1,
                    totalEndpoints: endpoints.length,
                    batchSize: requests.length,
                    error: lastError.message
                });
                if (i < endpoints.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }

        logger.error(LogCode.API_FETCH_FAILED, 'Batch RPC call failed on all endpoints', {
            chain: chainId,
            error: lastError?.message || 'Unknown error',
            batchSize: requests.length
        });

        return requests.map(req => ({
            id: req.id,
            error: { code: -32603, message: `Batch failed: ${lastError?.message || 'unknown error'}` }
        }));
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
const SOLANA_CONN_CACHE_TTL = Math.max(1_000, Number(process.env.SOLANA_CONN_CACHE_TTL_MS || '15000'));
const SOLANA_MANAGED_CONNECTION_MARKER = '__kiko_managed_solana_rpc';

type SolanaBatchRequest = {
    methodName: string;
    args: any[];
};

function normalizeSolanaRpcArgs(args: any): any[] {
    return Array.isArray(args) ? args : [];
}

function normalizeSolanaRpcResponse<T = any>(response: T): T {
    if (!response || typeof response !== 'object') {
        return response;
    }
    const maybeResponse = response as Record<string, any>;
    if (!Object.prototype.hasOwnProperty.call(maybeResponse, 'id')) {
        return response;
    }
    if (typeof maybeResponse.id === 'string') {
        return response;
    }
    return {
        ...maybeResponse,
        id: String(maybeResponse.id ?? ''),
    } as T;
}

function buildSolanaRpcPath(method: string): string {
    const safeMethod = String(method || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
    return `solana_connection_${safeMethod}`;
}

function patchSolanaConnectionRpc(
    connection: Connection,
    strategy: 'fast' | 'cheap',
    importance: RpcImportance
): Connection {
    const managedConnection = connection as Connection & {
        _rpcRequest?: (method: string, args: any[]) => Promise<any>;
        _rpcBatchRequest?: (requests: SolanaBatchRequest[]) => Promise<any[]>;
        [SOLANA_MANAGED_CONNECTION_MARKER]?: string;
    };

    const markerValue = `${strategy}:${importance}`;
    if (managedConnection[SOLANA_MANAGED_CONNECTION_MARKER] === markerValue) {
        return managedConnection;
    }

    managedConnection._rpcRequest = async (method: string, args: any[]) => {
        const response = await callRpcRaw(
            'solana',
            method,
            normalizeSolanaRpcArgs(args),
            {
                strategy,
                importance,
                path: buildSolanaRpcPath(method),
            }
        );
        return normalizeSolanaRpcResponse(response);
    };

    managedConnection._rpcBatchRequest = async (requests: SolanaBatchRequest[]) => {
        if (!Array.isArray(requests) || requests.length === 0) {
            return [];
        }

        return await Promise.all(
            requests.map((request) =>
                managedConnection._rpcRequest!(
                    String(request?.methodName || ''),
                    normalizeSolanaRpcArgs(request?.args)
                )
            )
        );
    };

    managedConnection[SOLANA_MANAGED_CONNECTION_MARKER] = markerValue;
    return managedConnection;
}

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

    if (strategy === 'cheap' && shouldUpgradeToFast(endpoints, 'solana_connection', importance)) {
        const upgraded = getRpcEndpointsWithStrategy(chainSlug, 'fast', primaryUrl);
        if (upgraded.length > 0) {
            endpoints = upgraded;
        }
    }

    if (!endpoints || endpoints.length === 0) {
        throw new Error('No RPC endpoints configured for Solana');
    }

    const sorted = sortEndpointsByScore(endpoints, 'solana_connection', importance);
    const healthy = sorted.filter(ep => !isCircuitOpen(ep.url));
    const candidates = healthy.length > 0 ? healthy : sorted;
    let chosen = candidates.find(ep => checkEndpointCapacity(ep, importance).ok);

    if (!chosen && candidates.length > 0) {
        chosen = [...candidates].sort((a, b) => endpointCapacityPressure(a) - endpointCapacityPressure(b))[0];
        logger.warn(LogCode.API_FETCH_FAILED, '[RPC][Solana] All endpoints at/near capacity, selecting lowest-pressure endpoint', {
            strategy,
            importance,
            selected: chosen?.name,
            selectedEndpoint: maskEndpoint(chosen?.url || ''),
        });
    }

    if (!chosen) {
        chosen = sorted[0];
    }

    const reserve = checkAndReserveCapacity(chosen, importance);
    if (!reserve.ok) {
        // Race-safe fallback: if selected endpoint just got saturated, pick another available candidate.
        const fallback = candidates.find(ep => ep.url !== chosen!.url && checkAndReserveCapacity(ep, importance).ok);
        if (fallback) {
            recordUsageEnd(fallback.url);
            chosen = fallback;
        } else {
            // keep current chosen connection selection, but do not keep stale inFlight reservations
            recordUsageEnd(chosen.url);
        }
    } else {
        // Connection selection should count towards rps/rpm, but not hold long-lived inFlight.
        recordUsageEnd(chosen.url);
    }

    const url = chosen.url;
    const cacheKey = `${url}|${strategy}|${importance}`;
    const now = Date.now();
    const cached = SOLANA_CONN_CACHE.get(cacheKey);

    if (cached && now - cached.timestamp < SOLANA_CONN_CACHE_TTL) {
        return cached.connection;
    }

    const connection = patchSolanaConnectionRpc(new Connection(url, 'confirmed'), strategy, importance);
    SOLANA_CONN_CACHE.set(cacheKey, { connection, timestamp: now });
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

export interface RpcMethodUsageSnapshotRow {
    chainId: number;
    method: string;
    importance: RpcImportance;
    rpcClass: RpcClass;
    path: string;
    requests: number;
    endpointAttempts: number;
    successes: number;
    endpointFailures: number;
    allFailed: number;
    timeoutErrors: number;
    latencyMsTotal: number;
    lastLatencyMs: number;
    updatedAt: number;
}

export function getRpcMethodUsageSnapshot(
    chainId?: number
): Record<string, RpcMethodUsageSnapshotRow> {
    const out: Record<string, RpcMethodUsageSnapshotRow> = {};
    for (const [key, row] of rpcMethodUsage.entries()) {
        if (typeof chainId === 'number' && row.chainId !== chainId) continue;
        out[key] = { ...row };
    }
    return out;
}

export function diffRpcMethodUsageSnapshots(
    before: Record<string, RpcMethodUsageSnapshotRow>,
    after: Record<string, RpcMethodUsageSnapshotRow>
): Array<RpcMethodUsageSnapshotRow> {
    const deltas: Array<RpcMethodUsageSnapshotRow> = [];
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
        const b = before[key];
        const a = after[key];
        if (!a && !b) continue;
        const chain = a?.chainId ?? b!.chainId;
        const method = a?.method ?? b!.method;
        const row: RpcMethodUsageSnapshotRow = {
            chainId: chain,
            method,
            importance: a?.importance ?? b!.importance,
            rpcClass: a?.rpcClass ?? b!.rpcClass,
            path: a?.path ?? b!.path,
            requests: (a?.requests || 0) - (b?.requests || 0),
            endpointAttempts: (a?.endpointAttempts || 0) - (b?.endpointAttempts || 0),
            successes: (a?.successes || 0) - (b?.successes || 0),
            endpointFailures: (a?.endpointFailures || 0) - (b?.endpointFailures || 0),
            allFailed: (a?.allFailed || 0) - (b?.allFailed || 0),
            timeoutErrors: (a?.timeoutErrors || 0) - (b?.timeoutErrors || 0),
            latencyMsTotal: (a?.latencyMsTotal || 0) - (b?.latencyMsTotal || 0),
            lastLatencyMs: a?.lastLatencyMs || b?.lastLatencyMs || 0,
            updatedAt: a?.updatedAt || b!.updatedAt
        };
        if (
            row.requests <= 0 &&
            row.endpointAttempts <= 0 &&
            row.successes <= 0 &&
            row.endpointFailures <= 0 &&
            row.allFailed <= 0 &&
            row.timeoutErrors <= 0 &&
            row.latencyMsTotal <= 0
        ) {
            continue;
        }
        deltas.push(row);
    }
    deltas.sort((x, y) => y.endpointAttempts - x.endpointAttempts);
    return deltas;
}

export interface RpcUsageSnapshot {
    timestamp: number;
    methods: Record<string, RpcMethodUsageSnapshotRow>;
    inflightPools: Record<RpcClass, number>;
    endpoints: Array<{
        url: string;
        inFlight: number;
        secondCount: number;
        minuteCount: number;
        lastUsedAt: number;
    }>;
}

export function getUsageSnapshot(chainId?: number): RpcUsageSnapshot {
    const methods = getRpcMethodUsageSnapshot(chainId);
    const endpoints = Array.from(endpointUsage.values()).map((usage) => ({
        url: maskEndpoint(usage.url),
        inFlight: usage.inFlight,
        secondCount: usage.secondCount,
        minuteCount: usage.minuteCount,
        lastUsedAt: usage.lastUsedAt
    }));
    return {
        timestamp: Date.now(),
        methods,
        inflightPools: {
            critical_tx: rpcPoolInflight.critical_tx,
            best_effort_read: rpcPoolInflight.best_effort_read
        },
        endpoints
    };
}

export async function probeTxVisibility(params: {
    chainId: number;
    txHash: string;
    expectedFrom?: string;
    retries?: number;
    delayMs?: number;
}): Promise<{
    visible: boolean;
    checks: number;
    from?: string;
    nonce?: string;
    blockNumber?: string;
    lastError?: string;
}> {
    const releaseCriticalWindow = beginCriticalRpcWindow(`probe_visibility:${params.chainId}:${params.txHash.toLowerCase()}`);
    try {
    const finalState = resolveTxFinalState({
        chainId: params.chainId,
        txHash: params.txHash
    });
    if (finalState.visible || finalState.success) {
        return {
            visible: true,
            checks: 0,
            lastError: finalState.reasonCode
        };
    }
    if (finalState.failed) {
        return {
            visible: false,
            checks: 0,
            lastError: finalState.reasonCode || 'cached_tx_failed'
        };
    }
    const cached = getTxLifecycleState(params.chainId, params.txHash);
    if (cached) {
        if (cached.status === 'confirmed_success' || cached.status === 'confirmed_failed' || cached.status === 'visible_pending') {
            return {
                visible: true,
                checks: 0,
                lastError: cached.lastRpcError
            };
        }
        if (cached.status === 'dropped_timeout' || cached.status === 'send_failed') {
            return {
                visible: false,
                checks: 0,
                lastError: cached.lastRpcError || 'cached_tx_unseen'
            };
        }
    }

    const degrade = getChainRpcDegradeState(params.chainId);
    if (degrade.degraded && cached && cached.status === 'broadcasted_unseen') {
        return {
            visible: false,
            checks: 0,
            lastError: degrade.lastError || cached.lastRpcError || 'chain_rpc_degraded'
        };
    }

    const retries = Math.max(1, Number(params.retries || 6));
    const delayMs = Math.max(0, Number(params.delayMs ?? 400));
    const expectedFrom = String(params.expectedFrom || '').toLowerCase();
    let lastError = '';
    let visibleHits = 0;

    for (let i = 1; i <= retries; i++) {
        try {
            const observation = await getSharedTxObservation({
                chainId: params.chainId,
                txHash: params.txHash,
                scope: 'tx',
                producer: async () => ({
                    tx: await callRpc<any>(
                        params.chainId,
                        'eth_getTransactionByHash',
                        [params.txHash],
                        { strategy: 'fast', importance: 'critical', exhaustiveFailover: true }
                    ).catch(() => null),
                    receipt: null,
                    observedAt: Date.now(),
                    lastRpcError: lastError || undefined
                })
            });
            const tx = observation.tx;
            if (tx?.hash) {
                const from = String(tx.from || '').toLowerCase();
                if (!expectedFrom || from === expectedFrom) {
                    visibleHits += 1;
                    const stableVisible = visibleHits >= 2 || retries <= 1;
                    if (!stableVisible && i < retries) {
                        if (delayMs > 0) {
                            await new Promise((resolve) => setTimeout(resolve, delayMs));
                        }
                        continue;
                    }
                    const out = {
                        visible: true,
                        checks: i,
                        from: tx.from,
                        nonce: tx.nonce,
                        blockNumber: tx.blockNumber
                    };
                    recordTxLifecycleState({
                        chainId: params.chainId,
                        txHash: params.txHash,
                        status: 'visible_pending',
                        firstSeenAt: Date.now(),
                        attempts: i,
                        source: 'probe_visibility'
                    });
                    return out;
                }
                const out = {
                    visible: false,
                    checks: i,
                    from: tx.from,
                    nonce: tx.nonce,
                    blockNumber: tx.blockNumber,
                    lastError: `from_mismatch expected=${params.expectedFrom} got=${tx.from}`
                };
                recordTxLifecycleState({
                    chainId: params.chainId,
                    txHash: params.txHash,
                    status: 'broadcasted_unseen',
                    attempts: i,
                    lastRpcError: out.lastError,
                    source: 'probe_visibility'
                });
                return out;
            }
        } catch (err: any) {
            lastError = err?.message || String(err);
        }

        if (i < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    const out = {
        visible: false,
        checks: retries,
        lastError: lastError || 'not_found_by_rpc'
    };
    recordTxLifecycleState({
        chainId: params.chainId,
        txHash: params.txHash,
        status: 'broadcasted_unseen',
        attempts: retries,
        lastRpcError: out.lastError,
        source: 'probe_visibility'
    });
    return out;
    } finally {
        releaseCriticalWindow();
    }
}

export async function waitForReceiptStateMachine(params: {
    chainId: number;
    txHash: string;
    expectedFrom?: string;
    maxWaitMs?: number;
    pollMs?: number;
}): Promise<TxLifecycleResult> {
    return await waitForSharedTxConfirmation({
        chainId: params.chainId,
        txHash: params.txHash,
        producer: async () => {
            const releaseCriticalWindow = beginCriticalRpcWindow(`confirm_wait:${params.chainId}:${params.txHash.toLowerCase()}`);
            try {
                const finalState = resolveTxFinalState({
                    chainId: params.chainId,
                    txHash: params.txHash
                });
                if (finalState.terminal || finalState.visible) {
                    return toLifecycleResultFromFinalState({
                        chainId: params.chainId,
                        txHash: params.txHash,
                        resolution: finalState
                    });
                }
                const cached = getTxLifecycleState(params.chainId, params.txHash);
                if (cached && (
                    cached.status === 'confirmed_success'
                    || cached.status === 'confirmed_failed'
                    || cached.status === 'visible_pending'
                    || cached.status === 'dropped_timeout'
                )) {
                    return {
                        status: cached.status as TxLifecycleResult['status'],
                        txHash: params.txHash,
                        firstSeenAt: cached.firstSeenAt,
                        confirmedAt: cached.confirmedAt,
                        lastRpcError: cached.lastRpcError,
                        attempts: cached.attempts || 0,
                        chainId: params.chainId
                    };
                }

                const startedAt = Date.now();
                const maxWaitMs = Math.max(200, Number(params.maxWaitMs || 12_000));
                const pollMs = Math.max(120, Number(params.pollMs || 500));
                const expectedFrom = String(params.expectedFrom || '').toLowerCase();
                let attempts = 0;
                let firstSeenAt: number | undefined;
                let lastRpcError = '';
                let visibilityHits = 0;

                while (Date.now() - startedAt < maxWaitMs) {
                    const degrade = getChainRpcDegradeState(params.chainId);
                    if (degrade.degraded && !firstSeenAt) {
                        reportRpcUncertain({
                            chainId: params.chainId,
                            txHash: params.txHash,
                            error: degrade.lastError || 'chain_rpc_degraded'
                        });
                        return {
                            status: 'dropped_timeout',
                            txHash: params.txHash,
                            firstSeenAt,
                            lastRpcError: degrade.lastError || 'chain_rpc_degraded',
                            attempts,
                            chainId: params.chainId
                        };
                    }
                    attempts += 1;
                    try {
                        const observation = await getSharedTxObservation({
                            chainId: params.chainId,
                            txHash: params.txHash,
                            scope: 'combined',
                            producer: async () => {
                                let observationError = '';
                                const [tx, receipt] = await Promise.all([
                                    callRpc<any>(
                                        params.chainId,
                                        'eth_getTransactionByHash',
                                        [params.txHash],
                                        { strategy: 'fast', importance: 'critical', exhaustiveFailover: true, path: 'confirm_wait' }
                                    ).catch((err: any) => {
                                        observationError = err?.message || String(err);
                                        return null;
                                    }),
                                    callRpc<any>(
                                        params.chainId,
                                        'eth_getTransactionReceipt',
                                        [params.txHash],
                                        { strategy: 'fast', importance: 'critical', exhaustiveFailover: true, path: 'confirm_wait' }
                                    ).catch((err: any) => {
                                        observationError = err?.message || String(err);
                                        return null;
                                    })
                                ]);
                                return {
                                    tx,
                                    receipt,
                                    observedAt: Date.now(),
                                    lastRpcError: observationError || undefined
                                };
                            }
                        });
                        const tx = observation.tx;
                        const receipt = observation.receipt;
                        if (observation.lastRpcError) lastRpcError = observation.lastRpcError;

                        if (tx?.hash) {
                            const seenFrom = String(tx.from || '').toLowerCase();
                            if (!expectedFrom || seenFrom === expectedFrom) {
                                firstSeenAt = firstSeenAt || Date.now();
                                visibilityHits += 1;
                                reportTxByHashSeen({
                                    chainId: params.chainId,
                                    txHash: params.txHash,
                                    from: tx.from || undefined,
                                    blockNumber: tx.blockNumber || undefined,
                                    rpcError: lastRpcError || undefined,
                                    source: 'rpc_tx'
                                });
                            } else {
                                visibilityHits = 0;
                                lastRpcError = `from_mismatch expected=${params.expectedFrom} got=${tx.from}`;
                            }
                        } else {
                            visibilityHits = 0;
                        }

                        if (receipt?.transactionHash) {
                            const statusHex = String(receipt.status || '');
                            const status: TxLifecycleResult['status'] = statusHex === '0x1' || statusHex === '1' ? 'confirmed_success' : 'confirmed_failed';
                            reportReceiptSeen({
                                chainId: params.chainId,
                                txHash: params.txHash,
                                success: status === 'confirmed_success',
                                blockNumber: receipt.blockNumber || undefined,
                                rpcError: lastRpcError || undefined,
                                source: 'rpc_receipt'
                            });
                            const out: TxLifecycleResult = {
                                status,
                                txHash: params.txHash,
                                firstSeenAt,
                                confirmedAt: Date.now(),
                                lastRpcError: status === 'confirmed_failed' ? (lastRpcError || 'receipt_status_0') : lastRpcError || undefined,
                                attempts,
                                chainId: params.chainId
                            };
                            recordTxLifecycleState({
                                chainId: params.chainId,
                                txHash: params.txHash,
                                status: out.status,
                                firstSeenAt: out.firstSeenAt,
                                confirmedAt: out.confirmedAt,
                                attempts: out.attempts,
                                lastRpcError: out.lastRpcError,
                                source: 'wait_for_receipt'
                            });
                            return out;
                        }

                        if (firstSeenAt && visibilityHits >= 2) {
                            const out: TxLifecycleResult = {
                                status: 'visible_pending',
                                txHash: params.txHash,
                                firstSeenAt,
                                lastRpcError: lastRpcError || undefined,
                                attempts,
                                chainId: params.chainId
                            };
                            recordTxLifecycleState({
                                chainId: params.chainId,
                                txHash: params.txHash,
                                status: out.status,
                                firstSeenAt: out.firstSeenAt,
                                attempts: out.attempts,
                                lastRpcError: out.lastRpcError,
                                source: 'wait_for_receipt'
                            });
                            return out;
                        }
                    } catch (err: any) {
                        lastRpcError = err?.message || String(err);
                    }

                    await new Promise((resolve) => setTimeout(resolve, pollMs));
                }

                const out: TxLifecycleResult = {
                    status: firstSeenAt ? 'visible_pending' : 'dropped_timeout',
                    txHash: params.txHash,
                    firstSeenAt,
                    lastRpcError: lastRpcError || 'wait_timeout',
                    attempts,
                    chainId: params.chainId
                };
                if (!firstSeenAt) {
                    reportRpcUncertain({
                        chainId: params.chainId,
                        txHash: params.txHash,
                        error: out.lastRpcError || 'wait_timeout'
                    });
                }
                recordTxLifecycleState({
                    chainId: params.chainId,
                    txHash: params.txHash,
                    status: out.status,
                    firstSeenAt: out.firstSeenAt,
                    attempts: out.attempts,
                    lastRpcError: out.lastRpcError,
                    source: 'wait_for_receipt'
                });
                return out;
            } finally {
                releaseCriticalWindow();
            }
        }
    });
}

export async function broadcastRawWithQuorum(params: {
    chainId: number;
    signedRawTransaction: string;
    expectedFrom?: string;
    syncVisibilityRetries?: number;
    syncVisibilityDelayMs?: number;
    bypassRawTxCache?: boolean;
    skipSyncVisibility?: boolean;
}): Promise<TxLifecycleResult> {
    const releaseCriticalWindow = beginCriticalRpcWindow(`broadcast_raw:${params.chainId}`);
    try {
    const txHash = await callRpc<string>(
        params.chainId,
        'eth_sendRawTransaction',
        [params.signedRawTransaction],
        {
            strategy: 'fast',
            importance: 'critical',
            exhaustiveFailover: true,
            sendRawFanout: true,
            bypassRawTxCache: params.bypassRawTxCache === true
        }
    );
    if (!txHash) {
        const out: TxLifecycleResult = {
            status: 'dropped_timeout',
            lastRpcError: 'eth_sendRawTransaction_empty_hash',
            attempts: 1,
            chainId: params.chainId
        };
        return out;
    }

    reportSendAccepted({
        chainId: params.chainId,
        txHash,
        source: 'raw_broadcast'
    });

    if (params.skipSyncVisibility === true) {
        const out: TxLifecycleResult = {
            status: 'broadcasted_unseen',
            txHash,
            attempts: 1,
            chainId: params.chainId
        };
        recordTxLifecycleState({
            chainId: params.chainId,
            txHash,
            status: out.status,
            attempts: out.attempts,
            source: 'broadcast_raw'
        });
        return out;
    }

    const visibility = await probeTxVisibility({
        chainId: params.chainId,
        txHash,
        expectedFrom: params.expectedFrom,
        retries: params.syncVisibilityRetries,
        delayMs: params.syncVisibilityDelayMs
    });

    if (visibility.visible) {
        reportTxByHashSeen({
            chainId: params.chainId,
            txHash,
            source: 'rpc_tx'
        });
        const out: TxLifecycleResult = {
            status: 'visible_pending',
            txHash,
            firstSeenAt: Date.now(),
            attempts: visibility.checks,
            chainId: params.chainId
        };
        recordTxLifecycleState({
            chainId: params.chainId,
            txHash,
            status: out.status,
            firstSeenAt: out.firstSeenAt,
            attempts: out.attempts,
            source: 'broadcast_raw'
        });
        return out;
    }

    const out: TxLifecycleResult = {
        status: 'broadcasted_unseen',
        txHash,
        lastRpcError: visibility.lastError || 'not_found_by_rpc',
        attempts: visibility.checks,
        chainId: params.chainId
    };
    reportRpcUncertain({
        chainId: params.chainId,
        txHash,
        error: out.lastRpcError || 'not_found_by_rpc'
    });
    recordTxLifecycleState({
        chainId: params.chainId,
        txHash,
        status: out.status,
        attempts: out.attempts,
        lastRpcError: out.lastRpcError,
        source: 'broadcast_raw'
    });
    return out;
    } finally {
        releaseCriticalWindow();
    }
}

export const __rpcManagerTest = {
    createStableRequestKey,
    tryGetRawTxHash,
    shouldTreatSendRawErrorAsKnown,
    getEndpointAttemptBudget,
    getMethodConcurrencyLimit,
    expandCriticalSelectionWithPublicFallback,
    getMethodBackoff: (
        chainId: number,
        method: string,
        executionLane: EndpointExecutionLane = 'cheap',
        importance: RpcImportance = 'normal',
        rpcClass: RpcClass = 'best_effort_read'
    ) =>
        getMethodBackoffState(buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass)),
    markMethodFailureForTest: (
        chainId: number,
        method: string,
        executionLane: EndpointExecutionLane = 'cheap',
        importance: RpcImportance = 'normal',
        rpcClass: RpcClass = 'best_effort_read'
    ) =>
        markMethodFailure(buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass)),
    markMethodSuccessForTest: (
        chainId: number,
        method: string,
        executionLane: EndpointExecutionLane = 'cheap',
        importance: RpcImportance = 'normal',
        rpcClass: RpcClass = 'best_effort_read'
    ) =>
        markMethodSuccess(buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass)),
    resetRuntimeStateForTest: () => {
        endpointHealth.clear();
        endpointUsage.clear();
        methodBackoff.clear();
        methodLimiter.clear();
        inflightRpcRequests.clear();
        inflightRpcRawRequests.clear();
        rawTxHashCache.clear();
        rpcMethodUsage.clear();
    },
    seedCircuitOpenForTest: (url: string) => {
        const health = getOrCreateHealth(url);
        health.circuitOpen = true;
        health.consecutiveFailures = Math.max(health.consecutiveFailures, CIRCUIT_BREAKER_THRESHOLD);
        health.lastFailureTime = Date.now();
    }
};
