"use strict";
/**
 * RPC Manager Service
 * Manages multiple RPC endpoints with automatic failover
 * Features: Health checks, circuit breaker, priority routing, fast failover
 *
 * NOTE: This service now uses the unified API configuration from config/unifiedApiService.ts
 * All RPC endpoints are centrally managed in config/apiEndpoints.ts
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__rpcManagerTest = exports.rpcManager = exports.callRpcCustom = void 0;
exports.recordTxLifecycleState = recordTxLifecycleState;
exports.getTxLifecycleState = getTxLifecycleState;
exports.getChainRpcDegradeState = getChainRpcDegradeState;
exports.callRpc = callRpc;
exports.callRpcRaw = callRpcRaw;
exports.getNativeBalance = getNativeBalance;
exports.getErc20Balance = getErc20Balance;
exports.getErc20Decimals = getErc20Decimals;
exports.getErc20Allowance = getErc20Allowance;
exports.getBlockNumber = getBlockNumber;
exports.getBlockByNumber = getBlockByNumber;
exports.getTransactionByHash = getTransactionByHash;
exports.getTransactionReceipt = getTransactionReceipt;
exports.getGasPrice = getGasPrice;
exports.getRpcEndpoints = getRpcEndpoints;
exports.getEthersProvider = getEthersProvider;
exports.getSolanaConnection = getSolanaConnection;
exports.getRpcHealthStats = getRpcHealthStats;
exports.startRpcHealthMonitor = startRpcHealthMonitor;
exports.startRpcBenchmarkSampling = startRpcBenchmarkSampling;
exports.getRpcMethodUsageSnapshot = getRpcMethodUsageSnapshot;
exports.diffRpcMethodUsageSnapshots = diffRpcMethodUsageSnapshots;
exports.getUsageSnapshot = getUsageSnapshot;
exports.probeTxVisibility = probeTxVisibility;
exports.waitForReceiptStateMachine = waitForReceiptStateMachine;
exports.broadcastRawWithQuorum = broadcastRawWithQuorum;
var chainConfig_js_1 = require("../config/chainConfig.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var unifiedApiService_js_1 = require("../config/unifiedApiService.js");
var apiEndpoints_js_1 = require("../config/apiEndpoints.js");
var rpcCache_js_1 = require("./rpcCache.js");
var web3_js_1 = require("@solana/web3.js");
var service_js_1 = require("./order-runtime/adjudicator/service.js");
var finalState_js_1 = require("./order-runtime/adjudicator/finalState.js");
var explain_js_1 = require("./rpc/explain.js");
var explainAggregate_js_1 = require("./rpc/explainAggregate.js");
var policy_js_1 = require("./rpc/policy.js");
var prediction_js_1 = require("./rpc/prediction.js");
var reservation_js_1 = require("./rpc/reservation.js");
var failoverPolicy_js_1 = require("./rpc/failoverPolicy.js");
var score_js_1 = require("./rpc/score.js");
var snapshotStore_js_1 = require("./rpc/snapshotStore.js");
var backgroundBudget_js_1 = require("./rpc/backgroundBudget.js");
var confirmScheduler_js_1 = require("./rpc/confirmScheduler.js");
var readBudget_js_1 = require("./rpc/readBudget.js");
var executionLane_js_1 = require("./rpc/executionLane.js");
var laneBudget_js_1 = require("./rpc/laneBudget.js");
var purpose_js_1 = require("./rpc/purpose.js");
var rpcCustomAccess_js_1 = require("./rpc/rpcCustomAccess.js");
Object.defineProperty(exports, "callRpcCustom", { enumerable: true, get: function () { return rpcCustomAccess_js_1.callRpcCustom; } });
var RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS || '10000'); // 10s default
var RPC_TIMEOUT_FAST_MS = Number(process.env.RPC_TIMEOUT_FAST_MS || '2500');
var RPC_TIMEOUT_CRITICAL_MS = Number(process.env.RPC_TIMEOUT_CRITICAL_MS || '1500');
var RPC_CRITICAL_HEDGE_ENABLED = (process.env.RPC_CRITICAL_HEDGE_ENABLED || 'true') === 'true';
var RPC_CRITICAL_HEDGE_ALLOW_WRITE = (process.env.RPC_CRITICAL_HEDGE_ALLOW_WRITE || 'false') === 'true';
var RPC_CRITICAL_HEDGE_STAGGER_MS = Number(process.env.RPC_CRITICAL_HEDGE_STAGGER_MS || '60');
var RPC_CRITICAL_HEDGE_FANOUT = Math.max(1, Math.min(4, Number(process.env.RPC_CRITICAL_HEDGE_FANOUT || '2')));
var RPC_ETH_CALL_HEDGE_FANOUT = Math.max(1, Math.min(3, Number(process.env.RPC_ETH_CALL_HEDGE_FANOUT || '1')));
var RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL = (process.env.RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL || 'false') === 'true';
var RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL || '3'));
var RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL || '4'));
var RPC_MAX_ENDPOINT_ATTEMPTS_WRITE = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_WRITE || '4'));
var RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL || '2'));
var RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL || '2'));
var RPC_CONCURRENCY_NORMAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_NORMAL || '28'));
var RPC_CONCURRENCY_CRITICAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_CRITICAL || '56'));
var RPC_CONCURRENCY_WRITE = Math.max(1, Number(process.env.RPC_CONCURRENCY_WRITE || '10'));
var RPC_CONCURRENCY_ETH_CALL_NORMAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_ETH_CALL_NORMAL || '14'));
var RPC_CONCURRENCY_ETH_CALL_CRITICAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_ETH_CALL_CRITICAL || '8'));
var RPC_CRITICAL_POOL_CONCURRENCY = Math.max(1, Number(process.env.RPC_CRITICAL_POOL_CONCURRENCY || '64'));
var RPC_BEST_EFFORT_POOL_CONCURRENCY = Math.max(1, Number(process.env.RPC_BEST_EFFORT_POOL_CONCURRENCY || '20'));
var RPC_CRITICAL_MAX_INFLIGHT_BURST = Math.max(0, Number(process.env.RPC_CRITICAL_MAX_INFLIGHT_BURST || '2'));
var RPC_METHOD_COOLDOWN_BASE_MS = Math.max(0, Number(process.env.RPC_METHOD_COOLDOWN_BASE_MS || '250'));
var RPC_METHOD_COOLDOWN_MAX_MS = Math.max(RPC_METHOD_COOLDOWN_BASE_MS, Number(process.env.RPC_METHOD_COOLDOWN_MAX_MS || '4000'));
var RPC_METHOD_COOLDOWN_ATTEMPT_CAP = Math.max(1, Number(process.env.RPC_METHOD_COOLDOWN_ATTEMPT_CAP || '1'));
var RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS = Math.max(10000, Number(process.env.RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS || '120000'));
var RPC_INFLIGHT_KEY_MAX_LEN = Math.max(128, Number(process.env.RPC_INFLIGHT_KEY_MAX_LEN || '2048'));
var RPC_INFLIGHT_MAP_MAX = Math.max(64, Number(process.env.RPC_INFLIGHT_MAP_MAX || '5000'));
var RPC_SEND_RAW_HASH_CACHE_MAX = Math.max(64, Number(process.env.RPC_SEND_RAW_HASH_CACHE_MAX || '4000'));
var TX_LIFECYCLE_ENDPOINT_FANOUT = 7;
var HEALTH_CHECK_INTERVAL = 60000; // Check endpoint health every 60s
var CIRCUIT_BREAKER_THRESHOLD = 5; // Open circuit after 5 consecutive failures (more tolerant)
var CIRCUIT_BREAKER_RESET_TIME = 30000; // Try again after 30s
var BENCHMARK_INTERVAL_MS = 300000; // 5 minutes
var BENCHMARK_TIMEOUT_MS = 3000;
var BENCHMARK_CHAIN_ID = 8453;
var BENCHMARK_TOKEN_ADDRESS = process.env.RPC_BENCH_TOKEN_ADDRESS || '0xf48bC234855aB08ab2EC0cfaaEb2A80D065a3b07';
var BENCHMARK_DECIMALS_CALL = '0x313ce567'; // decimals()
var ENDPOINT_METHOD_TIMEOUT_WINDOW_MS = Math.max(5000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_WINDOW_MS || '60000'));
var ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS = Math.max(3, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS || '8'));
var ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD = Math.min(1, Math.max(0, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD || '0.3')));
var ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS = Math.max(1000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS || '60000'));
var RPC_EXPLAIN_ENABLED = (process.env.RPC_EXPLAIN_ENABLED || 'true').toLowerCase() === 'true';
var RPC_UPGRADE_LOG_WINDOW_MS = Math.max(30000, Number(process.env.RPC_UPGRADE_LOG_WINDOW_MS || '60000'));
var RPC_ERC20_BALANCE_SUCCESS_TTL_MS = Math.max(200, Number(process.env.RPC_ERC20_BALANCE_SUCCESS_TTL_MS || '750'));
var RPC_ERC20_BALANCE_FAILURE_COOLDOWN_MS = Math.max(200, Number(process.env.RPC_ERC20_BALANCE_FAILURE_COOLDOWN_MS || '1200'));
var RPC_ERC20_DECIMALS_SUCCESS_TTL_MS = Math.max(30000, Number(process.env.RPC_ERC20_DECIMALS_SUCCESS_TTL_MS || '21600000'));
var RPC_ERC20_DECIMALS_FAILURE_COOLDOWN_MS = Math.max(500, Number(process.env.RPC_ERC20_DECIMALS_FAILURE_COOLDOWN_MS || '5000'));
var endpointHealth = new Map();
var allRpcFailedLogGate = new Map();
var ALL_RPC_FAILED_LOG_COOLDOWN_MS = Number(process.env.RPC_ALL_FAILED_LOG_COOLDOWN_MS || 5000);
function shouldLogAllRpcFailed(key) {
    var now = Date.now();
    var last = allRpcFailedLogGate.get(key) || 0;
    if (now - last < ALL_RPC_FAILED_LOG_COOLDOWN_MS)
        return false;
    allRpcFailedLogGate.set(key, now);
    return true;
}
function getOrCreateUsage(url) {
    if (!endpointUsage.has(url)) {
        endpointUsage.set(url, {
            url: url,
            inFlight: 0,
            lastSecondStart: Date.now(),
            secondCount: 0,
            lastMinuteStart: Date.now(),
            minuteCount: 0,
            lastUsedAt: 0
        });
    }
    return endpointUsage.get(url);
}
function recordUsageStart(url) {
    var usage = getOrCreateUsage(url);
    var now = Date.now();
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
function recordUsageEnd(url) {
    var usage = getOrCreateUsage(url);
    usage.inFlight = Math.max(0, usage.inFlight - 1);
}
/** Check capacity and increment usage in one synchronous block to avoid race under concurrency. */
function checkAndReserveCapacity(endpoint, importance) {
    var limits = endpoint.limits;
    if (!limits)
        return { ok: true };
    var usage = getOrCreateUsage(endpoint.url);
    var now = Date.now();
    var criticalPremiumBypass = importance === 'critical' && endpoint.type === 'premium';
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
        }
        else {
            return { ok: false, reason: 'rps' };
        }
    }
    if (limits.rpm && usage.minuteCount >= limits.rpm) {
        if (criticalPremiumBypass) {
            // allow but still reserve below
        }
        else {
            return { ok: false, reason: 'rpm' };
        }
    }
    usage.secondCount += 1;
    usage.minuteCount += 1;
    usage.inFlight += 1;
    usage.lastUsedAt = now;
    return { ok: true };
}
function checkEndpointCapacity(endpoint, importance) {
    var limits = endpoint.limits;
    if (!limits)
        return { ok: true };
    var usage = getOrCreateUsage(endpoint.url);
    var now = Date.now();
    var criticalPremiumBypass = importance === 'critical' && endpoint.type === 'premium';
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
var CHAIN_ID_TO_NAME = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    900: 'solana',
};
// Reverse mapping for name to ID
var CHAIN_NAME_TO_ID = Object.entries(CHAIN_ID_TO_NAME).reduce(function (acc, _a) {
    var id = _a[0], name = _a[1];
    acc[name] = Number(id);
    return acc;
}, {});
var CHAIN_PRIMARY_ENV = {
    eth: 'ETH_RPC_URL',
    base: 'BASE_RPC_URL',
    bsc: 'BSC_RPC_URL',
    polygon: 'POLYGON_RPC_URL',
    arbitrum: 'ARBITRUM_RPC_URL',
    optimism: 'OPTIMISM_RPC_URL',
    solana: 'SOLANA_RPC_URL',
};
function getPrimaryRpcUrl(chainSlug) {
    var key = CHAIN_PRIMARY_ENV[chainSlug];
    if (!key)
        return undefined;
    var value = process.env[key];
    return value || undefined;
}
function isPublicFreeEndpoint(endpoint) {
    return endpoint.type === 'public_free';
}
function filterEndpointsForPurpose(endpoints, purpose) {
    if ((0, purpose_js_1.purposeUsesPublicFreeOnly)(purpose)) {
        return endpoints.filter(function (endpoint) { return isPublicFreeEndpoint(endpoint) || endpoint.type === 'fallback'; });
    }
    if (purpose === 'trade_execution') {
        return endpoints.filter(function (endpoint) { return endpoint.type === 'premium' || endpoint.type === 'fallback'; });
    }
    return endpoints;
}
function countSelectedFreeEndpoints(endpoints) {
    return endpoints.filter(function (endpoint) { return isPublicFreeEndpoint(endpoint); }).length;
}
function forceOpenEndpointCircuit(url, cooldownMs) {
    var health = getOrCreateHealth(url);
    health.circuitOpen = true;
    health.consecutiveFailures = Math.max(health.consecutiveFailures, CIRCUIT_BREAKER_THRESHOLD);
    health.lastFailureTime = Date.now() + Math.max(0, cooldownMs - CIRCUIT_BREAKER_RESET_TIME);
}
function resolveRpcTimeoutMs(method, options) {
    var effectiveImportance = options.importance || (options.strategy === 'fast' ? 'critical' : 'normal');
    if (effectiveImportance === 'critical') {
        if (method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt') {
            return Math.min(RPC_TIMEOUT_CRITICAL_MS, RPC_TIMEOUT_FAST_MS);
        }
        return RPC_TIMEOUT_CRITICAL_MS;
    }
    if (options.strategy === 'fast')
        return RPC_TIMEOUT_FAST_MS;
    return RPC_TIMEOUT_MS;
}
function isNonRetryableRpcErrorMessage(message) {
    var msg = String(message || '').toLowerCase();
    if (!msg)
        return false;
    return (msg.includes('execution reverted')
        || msg.includes('invalid opcode')
        || msg.includes('out of gas')
        || msg.includes('insufficient funds for gas * price + value')
        || msg.includes('insufficient funds'));
}
var endpointUsage = new Map();
var methodBackoff = new Map();
var methodLimiter = new Map();
var inflightRpcRequests = new Map();
var inflightRpcRawRequests = new Map();
var rawTxHashCache = new Map();
var txLifecycleStateCache = new Map();
var TX_LIFECYCLE_STATE_TTL_MS = Math.max(5000, Number(process.env.TX_LIFECYCLE_STATE_TTL_MS || '180000'));
var TX_LIFECYCLE_STATE_MAX = Math.max(256, Number(process.env.TX_LIFECYCLE_STATE_MAX || '20000'));
var rpcChainDegradedState = new Map();
var RPC_CHAIN_DEGRADED_TTL_MS = Math.max(500, Number(process.env.RPC_CHAIN_DEGRADED_TTL_MS || '4000'));
var rpcMethodUsage = new Map();
var endpointMethodTimeoutHealth = new Map();
var rpcPoolInflight = {
    critical_tx: 0,
    best_effort_read: 0
};
function rpcMethodUsageKey(chainId, executionLane, method, importance, rpcClass, path) {
    return "".concat(chainId, ":").concat(executionLane, ":").concat(method, ":").concat(importance, ":").concat(rpcClass, ":").concat(path);
}
function getOrCreateRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path) {
    var key = rpcMethodUsageKey(chainId, executionLane, method, importance, rpcClass, path);
    var row = rpcMethodUsage.get(key);
    if (!row) {
        row = {
            chainId: chainId,
            executionLane: executionLane,
            method: method,
            importance: importance,
            rpcClass: rpcClass,
            path: path,
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
function markRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path, field) {
    var row = getOrCreateRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path);
    row[field] += 1;
    row.updatedAt = Date.now();
}
function markRpcMethodLatency(chainId, executionLane, method, importance, rpcClass, path, latencyMs) {
    var row = getOrCreateRpcMethodUsage(chainId, executionLane, method, importance, rpcClass, path);
    var bounded = Math.max(0, Math.floor(latencyMs));
    row.latencyMsTotal += bounded;
    row.lastLatencyMs = bounded;
    row.updatedAt = Date.now();
}
function endpointMethodHealthKey(endpointUrl, method) {
    return "".concat(endpointUrl, "::").concat(method);
}
function getEndpointMethodTimeoutHealth(key) {
    var now = Date.now();
    var state = endpointMethodTimeoutHealth.get(key);
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
function isEndpointMethodTimeoutCooling(key) {
    var state = getEndpointMethodTimeoutHealth(key);
    return state.cooldownUntil > Date.now();
}
function markEndpointMethodAttempt(key) {
    var state = getEndpointMethodTimeoutHealth(key);
    state.attempts += 1;
}
function maybeOpenEndpointMethodTimeoutCooldown(key) {
    var state = getEndpointMethodTimeoutHealth(key);
    if (state.attempts < ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS)
        return;
    var timeoutRate = state.timeouts / Math.max(1, state.attempts);
    if (timeoutRate < ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD)
        return;
    state.cooldownUntil = Date.now() + ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS;
    state.windowStart = Date.now();
    state.attempts = 0;
    state.timeouts = 0;
}
function markEndpointMethodTimeout(key) {
    var state = getEndpointMethodTimeoutHealth(key);
    state.timeouts += 1;
    maybeOpenEndpointMethodTimeoutCooldown(key);
}
function isWriteMethod(method) {
    return (method === 'eth_sendRawTransaction'
        || method === 'eth_sendTransaction'
        || method === 'sendTransaction'
        || method === 'simulateTransaction');
}
function inferRpcClass(method, importance) {
    if (method === 'eth_sendRawTransaction'
        || method === 'eth_sendTransaction'
        || method === 'sendTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt'
        || method === 'eth_getTransactionCount'
        || method === 'eth_estimateGas'
        || method === 'eth_feeHistory'
        || method === 'eth_gasPrice') {
        return 'critical_tx';
    }
    if (method === 'eth_call')
        return 'best_effort_read';
    return importance === 'critical' ? 'critical_tx' : 'best_effort_read';
}
function classifyRpcFailureCode(error) {
    var msg = String((error === null || error === void 0 ? void 0 : error.message) || error || '').toLowerCase();
    if (!msg)
        return 'unknown';
    if (msg.includes('aborted_by_signal'))
        return 'aborted_by_signal';
    if (msg.includes('endpoint_method_timeout_cooldown'))
        return 'endpoint_method_timeout_cooldown';
    if (msg.includes('capacity_limited'))
        return 'capacity_limited';
    if (msg.includes('circuit_open'))
        return 'circuit_open';
    if (msg.includes('aborterror') || msg.includes('timeout'))
        return 'timeout';
    if (msg.includes('empty result'))
        return 'empty_result';
    if (msg.includes('invalid tx hash'))
        return 'invalid_hash';
    if (msg.includes('rpc error'))
        return 'rpc_error';
    if (msg.includes('http '))
        return 'http_error';
    return 'unknown';
}
function shouldCoalesceMethod(method) {
    return !isWriteMethod(method) || method === 'eth_sendRawTransaction';
}
function shouldTreatSendRawErrorAsKnown(message) {
    var msg = String(message || '').toLowerCase();
    if (!msg)
        return false;
    return (msg.includes('already known')
        || msg.includes('known transaction')
        || msg.includes('already imported')
        || msg.includes('already exists'));
}
function normalizeRawTx(rawTx) {
    if (typeof rawTx !== 'string' || rawTx.length === 0)
        return null;
    var normalized = rawTx.startsWith('0x') ? rawTx : "0x".concat(rawTx);
    if (!/^0x[0-9a-fA-F]+$/.test(normalized))
        return null;
    return normalized.toLowerCase();
}
function tryGetRawTxHash(rawTx) {
    var normalized = normalizeRawTx(rawTx);
    if (!normalized)
        return null;
    try {
        return ethers_1.ethers.keccak256(normalized).toLowerCase();
    }
    catch (_a) {
        return null;
    }
}
function createStableRequestKey(chainId, method, params) {
    var seen = new WeakSet();
    var serialized = JSON.stringify(params, function (_key, value) {
        if (typeof value === 'bigint')
            return "bigint:".concat(value.toString());
        if (!value || typeof value !== 'object')
            return value;
        if (Array.isArray(value))
            return value;
        if (seen.has(value))
            return '__cycle__';
        seen.add(value);
        return Object.keys(value).sort().reduce(function (acc, itemKey) {
            acc[itemKey] = value[itemKey];
            return acc;
        }, {});
    }) || '__no_params__';
    var key = "".concat(chainId, ":").concat(method, ":").concat(serialized);
    if (key.length > RPC_INFLIGHT_KEY_MAX_LEN) {
        key = "".concat(chainId, ":").concat(method, ":").concat(Buffer.from(serialized).toString('base64url').slice(0, RPC_INFLIGHT_KEY_MAX_LEN));
    }
    return key;
}
function buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass) {
    if (importance === void 0) { importance = 'normal'; }
    if (rpcClass === void 0) { rpcClass = 'best_effort_read'; }
    return "".concat(chainId, ":").concat(executionLane, ":").concat(method, ":").concat(importance, ":").concat(rpcClass);
}
function getMethodBackoffState(backoffKey) {
    var state = methodBackoff.get(backoffKey);
    if (!state)
        return null;
    if (Date.now() > state.cooldownUntil) {
        methodBackoff.delete(backoffKey);
        return null;
    }
    return state;
}
function markMethodSuccess(backoffKey) {
    methodBackoff.delete(backoffKey);
}
function markMethodFailure(backoffKey) {
    var current = methodBackoff.get(backoffKey);
    var failures = Math.min(8, ((current === null || current === void 0 ? void 0 : current.failures) || 0) + 1);
    var cooldownMs = Math.min(RPC_METHOD_COOLDOWN_MAX_MS, RPC_METHOD_COOLDOWN_BASE_MS * (Math.pow(2, (failures - 1))));
    var next = {
        failures: failures,
        cooldownUntil: Date.now() + cooldownMs
    };
    methodBackoff.set(backoffKey, next);
    return next;
}
var RESILIENT_ETH_CALL_PATHS = new Set([
    'direct_swap',
    'confirm_wait',
    'token_metadata',
    'token_decimals',
    'token_supply',
    'token_supply_market_cap',
]);
function isResilientEthCallPath(method, path, importance) {
    if (method !== 'eth_call')
        return false;
    return importance === 'critical' || RESILIENT_ETH_CALL_PATHS.has(String(path || 'default'));
}
function getEndpointAttemptBudget(method, importance, endpointCount, cooldownActive, forceExhaustive, path) {
    if (forceExhaustive === void 0) { forceExhaustive = false; }
    if (path === void 0) { path = 'default'; }
    var isTxLifecycleMethod = method === 'eth_sendRawTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt';
    if (isTxLifecycleMethod && importance === 'critical') {
        var lifecycleBudget = Math.max(1, Math.min(endpointCount, TX_LIFECYCLE_ENDPOINT_FANOUT));
        return lifecycleBudget;
    }
    var ethCallBudget = method === 'eth_call'
        ? (importance === 'critical' ? RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL : RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL)
        : null;
    var baseBudget = ethCallBudget !== null && ethCallBudget !== void 0 ? ethCallBudget : (isWriteMethod(method)
        ? RPC_MAX_ENDPOINT_ATTEMPTS_WRITE
        : (importance === 'critical' ? RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL : RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL));
    var budget = Math.max(1, Math.min(endpointCount, baseBudget));
    if (cooldownActive && !isTxLifecycleMethod) {
        var cooldownAttemptCap = isResilientEthCallPath(method, path, importance)
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
function expandEthCallSelectionWithCheapFallback(params) {
    if (!isResilientEthCallPath(params.method, params.path, params.importance)) {
        return params.selectedEndpoints;
    }
    var hasPublic = params.selectedEndpoints.some(function (endpoint) { return endpoint.type === 'public_free'; });
    if (hasPublic)
        return params.selectedEndpoints;
    var cheapEndpoints = filterEndpointsByMethod((0, apiEndpoints_js_1.getRpcEndpointsWithStrategy)(params.chainSlug, 'cheap', params.primaryUrl), params.method).filter(function (endpoint) { return endpoint.type === 'public_free'; });
    if (!cheapEndpoints.length)
        return params.selectedEndpoints;
    var seen = new Set(params.selectedEndpoints.map(function (endpoint) { return endpoint.url; }));
    var expanded = __spreadArray([], params.selectedEndpoints, true);
    for (var _i = 0, cheapEndpoints_1 = cheapEndpoints; _i < cheapEndpoints_1.length; _i++) {
        var endpoint = cheapEndpoints_1[_i];
        if (!(endpoint === null || endpoint === void 0 ? void 0 : endpoint.url) || seen.has(endpoint.url))
            continue;
        seen.add(endpoint.url);
        expanded.push(endpoint);
        if (expanded.length >= params.selectedEndpoints.length + 2)
            break;
    }
    return expanded;
}
function expandCriticalSelectionWithPublicFallback(params) {
    if (params.executionLane !== 'critical') {
        return params.selectedEndpoints;
    }
    if (params.selectedEndpoints.some(function (endpoint) { return endpoint.type === 'public_free'; })) {
        return params.selectedEndpoints;
    }
    var premiumSelected = params.selectedEndpoints.filter(function (endpoint) { return endpoint.type === 'premium'; });
    if (premiumSelected.length === 0) {
        return params.selectedEndpoints;
    }
    var alwaysIncludePublicFallback = params.method === 'eth_getTransactionByHash'
        || params.method === 'eth_getTransactionReceipt';
    var allPremiumCircuited = premiumSelected.every(function (endpoint) { return isCircuitOpen(endpoint.url); });
    if (!alwaysIncludePublicFallback && !allPremiumCircuited) {
        return params.selectedEndpoints;
    }
    var cheapPublicEndpoints = filterEndpointsByMethod((0, apiEndpoints_js_1.getRpcEndpointsForLane)(params.chainSlug, 'cheap', params.primaryUrl), params.method).filter(function (endpoint) { return endpoint.type === 'public_free'; });
    if (!cheapPublicEndpoints.length) {
        return params.selectedEndpoints;
    }
    var seen = new Set(params.selectedEndpoints.map(function (endpoint) { return endpoint.url; }));
    var expanded = __spreadArray([], params.selectedEndpoints, true);
    for (var _i = 0, cheapPublicEndpoints_1 = cheapPublicEndpoints; _i < cheapPublicEndpoints_1.length; _i++) {
        var endpoint = cheapPublicEndpoints_1[_i];
        if (!(endpoint === null || endpoint === void 0 ? void 0 : endpoint.url) || seen.has(endpoint.url))
            continue;
        seen.add(endpoint.url);
        expanded.push(endpoint);
        if (expanded.length >= params.selectedEndpoints.length + 2)
            break;
    }
    return expanded;
}
function shouldForceExhaustiveFailover(method, importance, options, purpose) {
    if ((options === null || options === void 0 ? void 0 : options.exhaustiveFailover) === true)
        return true;
    if (importance !== 'critical')
        return false;
    if (purpose === 'tx_visibility' || purpose === 'trade_execution') {
        return method === 'eth_call'
            || method === 'eth_estimateGas'
            || method === 'eth_sendRawTransaction'
            || method === 'eth_getTransactionByHash'
            || method === 'eth_getTransactionReceipt'
            || method === 'eth_getTransactionCount'
            || method === 'eth_feeHistory'
            || method === 'eth_gasPrice'
            || method === 'eth_maxPriorityFeePerGas';
    }
    if (method === 'eth_call')
        return RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL;
    return method === 'eth_estimateGas'
        || method === 'eth_sendRawTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt';
}
function getMethodConcurrencyLimit(method, importance, cooldownActive, rpcClass) {
    var base = rpcClass === 'critical_tx'
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
        }
        else {
            base = Math.max(1, Math.floor(base / 2));
        }
    }
    return base;
}
function getLimiterState(key) {
    var state = methodLimiter.get(key);
    if (!state) {
        state = { inFlight: 0, queue: [] };
        methodLimiter.set(key, state);
    }
    return state;
}
function withMethodLimiter(key, limit, fn) {
    return __awaiter(this, void 0, void 0, function () {
        var state, next;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    state = getLimiterState(key);
                    if (!(state.inFlight >= limit)) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (resolve) {
                            state.queue.push(resolve);
                        })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    state.inFlight += 1;
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, , 5, 6]);
                    return [4 /*yield*/, fn()];
                case 4: return [2 /*return*/, _a.sent()];
                case 5:
                    state.inFlight = Math.max(0, state.inFlight - 1);
                    next = state.queue.shift();
                    if (next)
                        next();
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function getRawTxCache(chainId, rawTxHash) {
    var key = "".concat(chainId, ":").concat(rawTxHash);
    var hit = rawTxHashCache.get(key);
    if (!hit)
        return null;
    if (Date.now() - hit.timestamp > RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS) {
        rawTxHashCache.delete(key);
        return null;
    }
    return hit.txHash;
}
function setRawTxCache(chainId, rawTxHash, txHash) {
    if (rawTxHashCache.size >= RPC_SEND_RAW_HASH_CACHE_MAX) {
        var now = Date.now();
        for (var _i = 0, _a = rawTxHashCache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (now - value.timestamp > RPC_SEND_RAW_TX_HASH_CACHE_TTL_MS) {
                rawTxHashCache.delete(key);
            }
        }
        if (rawTxHashCache.size >= RPC_SEND_RAW_HASH_CACHE_MAX) {
            var oldestKeys = Array.from(rawTxHashCache.keys()).slice(0, Math.floor(RPC_SEND_RAW_HASH_CACHE_MAX * 0.2));
            for (var _c = 0, oldestKeys_1 = oldestKeys; _c < oldestKeys_1.length; _c++) {
                var key = oldestKeys_1[_c];
                rawTxHashCache.delete(key);
            }
        }
    }
    rawTxHashCache.set("".concat(chainId, ":").concat(rawTxHash), { txHash: txHash, timestamp: Date.now() });
}
function txLifecycleKey(chainId, txHash) {
    return "".concat(chainId, ":").concat(String(txHash || '').toLowerCase());
}
function pruneTxLifecycleStateCache() {
    if (txLifecycleStateCache.size < TX_LIFECYCLE_STATE_MAX)
        return;
    var now = Date.now();
    for (var _i = 0, _a = txLifecycleStateCache.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], row = _b[1];
        var updatedAt = row.updatedAt || 0;
        if (now - updatedAt > TX_LIFECYCLE_STATE_TTL_MS) {
            txLifecycleStateCache.delete(key);
        }
    }
    if (txLifecycleStateCache.size <= TX_LIFECYCLE_STATE_MAX)
        return;
    var drop = Math.max(1, Math.floor(TX_LIFECYCLE_STATE_MAX * 0.2));
    var oldest = Array.from(txLifecycleStateCache.entries())
        .sort(function (a, b) { return (a[1].updatedAt || 0) - (b[1].updatedAt || 0); })
        .slice(0, drop);
    for (var _c = 0, oldest_1 = oldest; _c < oldest_1.length; _c++) {
        var key = oldest_1[_c][0];
        txLifecycleStateCache.delete(key);
    }
}
function recordTxLifecycleState(snapshot) {
    if (!(snapshot === null || snapshot === void 0 ? void 0 : snapshot.chainId) || !(snapshot === null || snapshot === void 0 ? void 0 : snapshot.txHash))
        return;
    pruneTxLifecycleStateCache();
    var key = txLifecycleKey(snapshot.chainId, snapshot.txHash);
    var prev = txLifecycleStateCache.get(key);
    txLifecycleStateCache.set(key, __assign(__assign(__assign({}, (prev || {})), snapshot), { txHash: String(snapshot.txHash).toLowerCase(), updatedAt: Date.now() }));
    if (snapshot.status === 'confirmed_success' || snapshot.status === 'confirmed_failed') {
        (0, service_js_1.reportReceiptSeen)({
            chainId: snapshot.chainId,
            txHash: snapshot.txHash,
            success: snapshot.status === 'confirmed_success',
            rpcError: snapshot.lastRpcError,
            source: 'rpc_receipt'
        });
    }
    else if (snapshot.status === 'visible_pending') {
        (0, service_js_1.reportTxByHashSeen)({
            chainId: snapshot.chainId,
            txHash: snapshot.txHash,
            rpcError: snapshot.lastRpcError,
            source: 'rpc_tx'
        });
    }
    else if (snapshot.status === 'broadcasted_unseen' || snapshot.status === 'dropped_timeout' || snapshot.status === 'send_failed') {
        (0, service_js_1.reportRpcUncertain)({
            chainId: snapshot.chainId,
            txHash: snapshot.txHash,
            error: snapshot.lastRpcError || snapshot.status
        });
    }
}
function getTxLifecycleState(chainId, txHash) {
    var key = txLifecycleKey(chainId, txHash);
    var row = txLifecycleStateCache.get(key);
    if (!row)
        return null;
    var updatedAt = row.updatedAt || 0;
    if (Date.now() - updatedAt > TX_LIFECYCLE_STATE_TTL_MS) {
        txLifecycleStateCache.delete(key);
        return null;
    }
    return row;
}
function markChainRpcDegraded(chainId, method, errorMessage) {
    rpcChainDegradedState.set(chainId, {
        until: Date.now() + RPC_CHAIN_DEGRADED_TTL_MS,
        updatedAt: Date.now(),
        method: method,
        lastError: errorMessage ? String(errorMessage).slice(0, 180) : undefined
    });
}
function getChainRpcDegradeState(chainId) {
    var row = rpcChainDegradedState.get(chainId);
    if (!row)
        return { degraded: false, until: 0, updatedAt: 0 };
    if (Date.now() > row.until) {
        rpcChainDegradedState.delete(chainId);
        return { degraded: false, until: 0, updatedAt: 0 };
    }
    return __assign({ degraded: true }, row);
}
/**
 * Make an RPC call with automatic failover
 */
function callRpc(chainIdOrName_1, method_1) {
    return __awaiter(this, arguments, void 0, function (chainIdOrName, method, params, options) {
        var endpoints, chainName, chainSlug, primaryUrl, chainId, purpose, purposeProfile, requestedStrategy, isLatestBlockRead, cacheableMethod, cacheKey, cached, id, effectiveImportance, executionLane, config, strategy, upgradeDecision, upgraded, isTxLifecycleMethod, cheapEndpoints, seen, merged, _i, _a, ep, rpcClass, path, backoffKey, cooldownState, cooldownActive, limiterKey, concurrencyLimit, requestTimeoutMs, rawTxHash, cachedSubmittedHash, coalescingEnabled, inflightKey, existing, runCall, executePromise;
        var _this = this;
        if (params === void 0) { params = []; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    endpoints = [];
                    chainName = typeof chainIdOrName === 'string' ? chainIdOrName : "Chain ".concat(chainIdOrName);
                    chainSlug = typeof chainIdOrName === 'number'
                        ? (CHAIN_ID_TO_NAME[chainIdOrName] || 'eth')
                        : chainIdOrName.toLowerCase();
                    purpose = options.purpose || (0, purpose_js_1.inferLegacyRpcPurpose)({
                        method: method,
                        strategy: options.strategy,
                        importance: options.importance,
                        path: options.path,
                    });
                    purposeProfile = (0, purpose_js_1.getRpcPurposeProfile)(purpose);
                    requestedStrategy = options.strategy || purposeProfile.strategy;
                    isLatestBlockRead = method === 'eth_getBlockByNumber'
                        && Array.isArray(params)
                        && String(params[0] || '').toLowerCase() === 'latest';
                    cacheableMethod = (0, rpcCache_js_1.isCacheable)(method) && !isLatestBlockRead;
                    if (cacheableMethod) {
                        cacheKey = (0, rpcCache_js_1.buildCacheKey)(chainIdOrName, method, params);
                        cached = (0, rpcCache_js_1.getCachedRpc)(cacheKey);
                        if (cached !== null) {
                            return [2 /*return*/, cached];
                        }
                    }
                    // Resolve Chain ID
                    if (typeof chainIdOrName === 'number') {
                        chainId = chainIdOrName;
                    }
                    else {
                        id = CHAIN_NAME_TO_ID[chainIdOrName.toLowerCase()];
                        if (!id)
                            throw new Error("Unsupported chain name: ".concat(chainIdOrName));
                        chainId = id;
                    }
                    effectiveImportance = options.importance || purposeProfile.importance || (options.strategy === 'fast' ? 'critical' : 'normal');
                    executionLane = options.lane || purposeProfile.lane || (0, executionLane_js_1.inferExecutionLane)(method, effectiveImportance);
                    try {
                        config = (0, chainConfig_js_1.getChainConfig)(chainId);
                        chainName = config.name;
                        chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
                        strategy = executionLane === 'critical' ? 'fast' : requestedStrategy;
                        primaryUrl = getPrimaryRpcUrl(chainSlug);
                        endpoints = (0, apiEndpoints_js_1.getRpcEndpointsForLane)(chainSlug, executionLane, primaryUrl);
                        endpoints = filterEndpointsByMethod(endpoints, method);
                        endpoints = filterEndpointsForPurpose(endpoints, purpose);
                        upgradeDecision = (0, policy_js_1.shouldUpgradeRpcStrategy)({
                            endpoints: endpoints,
                            getHealth: getEndpointHealthView,
                            getUsage: getEndpointUsageView,
                            method: method,
                            importance: effectiveImportance,
                            purpose: purpose,
                        });
                        if (!(0, purpose_js_1.purposeUsesPublicFreeOnly)(purpose) && executionLane === 'cheap' && strategy === 'cheap' && upgradeDecision.upgrade) {
                            upgraded = (0, apiEndpoints_js_1.getRpcEndpointsForLane)(chainSlug, 'critical', primaryUrl);
                            if (upgraded.length > 0) {
                                endpoints = filterEndpointsForPurpose(filterEndpointsByMethod(upgraded, method), purpose);
                                logger_js_1.logger.throttled(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC strategy upgraded to fast due to degraded cheap pool', {
                                    chain: chainName,
                                    method: method,
                                    executionLane: executionLane,
                                    lane: upgradeDecision.lane,
                                    reasons: upgradeDecision.reasons,
                                    purpose: purpose,
                                    role: logRegistry_js_1.LogRole.METRIC
                                }, RPC_UPGRADE_LOG_WINDOW_MS);
                            }
                        }
                        isTxLifecycleMethod = method === 'eth_sendRawTransaction'
                            || method === 'eth_getTransactionByHash'
                            || method === 'eth_getTransactionReceipt';
                        if (isTxLifecycleMethod && purpose === 'tx_visibility') {
                            cheapEndpoints = filterEndpointsByMethod((0, apiEndpoints_js_1.getRpcEndpointsForLane)(chainSlug, 'cheap', primaryUrl), method);
                            if (cheapEndpoints.length > 0) {
                                seen = new Set();
                                merged = [];
                                for (_i = 0, _a = __spreadArray(__spreadArray([], endpoints, true), cheapEndpoints, true); _i < _a.length; _i++) {
                                    ep = _a[_i];
                                    if (!(ep === null || ep === void 0 ? void 0 : ep.url) || seen.has(ep.url))
                                        continue;
                                    seen.add(ep.url);
                                    merged.push(ep);
                                }
                                endpoints = merged;
                            }
                        }
                    }
                    catch (e) {
                        // Safe fallback for edge cases
                        throw new Error("Unsupported chain ID: ".concat(chainId));
                    }
                    if (!endpoints || endpoints.length === 0) {
                        throw new Error("No RPC endpoints configured for ".concat(chainName));
                    }
                    rpcClass = options.rpcClass || inferRpcClass(method, effectiveImportance);
                    path = String(options.path || purpose);
                    backoffKey = buildMethodBackoffKey(chainId, executionLane, method, effectiveImportance, rpcClass);
                    cooldownState = getMethodBackoffState(backoffKey);
                    cooldownActive = !!cooldownState;
                    limiterKey = "".concat(chainId, ":").concat(executionLane, ":").concat(method, ":").concat(effectiveImportance, ":").concat(rpcClass);
                    concurrencyLimit = getMethodConcurrencyLimit(method, effectiveImportance, cooldownActive, rpcClass);
                    requestTimeoutMs = resolveRpcTimeoutMs(method, options);
                    rawTxHash = method === 'eth_sendRawTransaction'
                        ? tryGetRawTxHash(String(Array.isArray(params) ? (params[0] || '') : ''))
                        : null;
                    if (rawTxHash && !options.bypassRawTxCache) {
                        cachedSubmittedHash = getRawTxCache(chainId, rawTxHash);
                        if (cachedSubmittedHash) {
                            return [2 /*return*/, cachedSubmittedHash];
                        }
                    }
                    coalescingEnabled = shouldCoalesceMethod(method);
                    inflightKey = rawTxHash
                        ? "".concat(chainId, ":").concat(method, ":").concat(rawTxHash)
                        : createStableRequestKey(chainId, method, params);
                    if (!coalescingEnabled) return [3 /*break*/, 2];
                    existing = inflightRpcRequests.get(inflightKey);
                    if (!existing) return [3 /*break*/, 2];
                    return [4 /*yield*/, existing];
                case 1: return [2 /*return*/, _b.sent()];
                case 2:
                    runCall = function () { return __awaiter(_this, void 0, void 0, function () {
                        var runStartedAt, request_1, scoreTable, sortedEndpoints, forceExhaustiveFailover, lane, backgroundPressure, endpointBudget, selectedAfterEthCallExpansion, selectedEndpoints_1, txLifecycleCritical_1, explainSnapshot, lastError_1, rateLimitedFailures_1, paidFallbackSuccess, failureReasonCounts_1, registerFailureReason, runEndpointAttempt_1, canHedgeReads, canHedgeEthCall, canHedgeWrites, canUseCriticalHedge, hedgeFanout, fanout, attempts, hedged, cacheKey, _a, fanoutSendRaw, sendRawFanoutMax, endpointsToTry, acceptedHash_1, acceptedCount_1, failedCount_1, knownCount_1, endpointResults_1, attemptPromises, firstHash, _b, i, endpoint, isLast, startTime, result, cacheKey, error_1, message, isContractError, newBackoff, failedLogKey, rpcFailureCode;
                        var _this = this;
                        var _c, _d, _e;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    if ((_c = options.signal) === null || _c === void 0 ? void 0 : _c.aborted) {
                                        throw new Error('aborted_by_signal');
                                    }
                                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'requests');
                                    rpcPoolInflight[rpcClass] += 1;
                                    runStartedAt = Date.now();
                                    _f.label = 1;
                                case 1:
                                    _f.trys.push([1, , 20, 21]);
                                    request_1 = {
                                        jsonrpc: '2.0',
                                        id: Date.now(),
                                        method: method,
                                        params: params,
                                    };
                                    scoreTable = (0, score_js_1.buildRpcScoreTable)({
                                        endpoints: endpoints,
                                        method: method,
                                        importance: effectiveImportance,
                                        purpose: purpose,
                                        now: Date.now(),
                                        getHealth: getEndpointHealthView,
                                        getUsage: getEndpointUsageView
                                    });
                                    sortedEndpoints = scoreTable.map(function (row) { return row.endpoint; });
                                    forceExhaustiveFailover = purposeProfile.allowExhaustiveFailover
                                        && shouldForceExhaustiveFailover(method, effectiveImportance, options, purpose);
                                    lane = (0, policy_js_1.inferRpcLane)(method, effectiveImportance);
                                    backgroundPressure = executionLane === 'cheap' && lane === 'background' && (0, backgroundBudget_js_1.hasCriticalRpcPressure)();
                                    endpointBudget = getEndpointAttemptBudget(method, effectiveImportance, sortedEndpoints.length, cooldownActive, forceExhaustiveFailover, path);
                                    if (backgroundPressure) {
                                        endpointBudget = Math.max(1, Math.min(endpointBudget, 1));
                                    }
                                    endpointBudget = Math.max(1, Math.min(endpointBudget, forceExhaustiveFailover ? sortedEndpoints.length : purposeProfile.maxEndpointAttempts));
                                    if (purposeProfile.allowPremiumFallback) {
                                        endpointBudget = (0, failoverPolicy_js_1.extendCheapBudgetToIncludePremiumFallback)({
                                            strategy: requestedStrategy,
                                            sortedEndpoints: sortedEndpoints,
                                            endpointBudget: endpointBudget,
                                            forceExhaustiveFailover: forceExhaustiveFailover
                                        });
                                    }
                                    selectedAfterEthCallExpansion = (0, purpose_js_1.purposeUsesPublicFreeOnly)(purpose) ? sortedEndpoints.slice(0, endpointBudget) : expandEthCallSelectionWithCheapFallback({
                                        method: method,
                                        path: path,
                                        importance: effectiveImportance,
                                        selectedEndpoints: sortedEndpoints.slice(0, endpointBudget),
                                        chainSlug: chainSlug,
                                        primaryUrl: primaryUrl,
                                    });
                                    selectedEndpoints_1 = purpose === 'tx_visibility' ? expandCriticalSelectionWithPublicFallback({
                                        executionLane: executionLane,
                                        selectedEndpoints: selectedAfterEthCallExpansion,
                                        chainSlug: chainSlug,
                                        primaryUrl: primaryUrl,
                                        method: method,
                                    }) : selectedAfterEthCallExpansion;
                                    reserveProjectedSelection(selectedEndpoints_1, method, effectiveImportance, purpose);
                                    txLifecycleCritical_1 = effectiveImportance === 'critical'
                                        && (method === 'eth_sendRawTransaction'
                                            || method === 'eth_getTransactionByHash'
                                            || method === 'eth_getTransactionReceipt');
                                    if (RPC_EXPLAIN_ENABLED && (txLifecycleCritical_1 || options.path === 'direct_swap' || options.path === 'confirm_wait')) {
                                        explainSnapshot = (0, explain_js_1.buildRpcSelectionExplain)({
                                            method: method,
                                            importance: effectiveImportance,
                                            strategy: options.strategy || 'cheap',
                                            scores: scoreTable,
                                            selectedEndpoints: selectedEndpoints_1,
                                            upgradeDecision: (0, policy_js_1.shouldUpgradeRpcStrategy)({
                                                endpoints: endpoints,
                                                getHealth: getEndpointHealthView,
                                                getUsage: getEndpointUsageView,
                                                method: method,
                                                importance: effectiveImportance,
                                                purpose: purpose,
                                            })
                                        });
                                        (0, explainAggregate_js_1.recordRpcSelectionExplainAggregate)({
                                            chain: chainName,
                                            purpose: purpose,
                                            snapshot: explainSnapshot,
                                        });
                                    }
                                    lastError_1 = null;
                                    rateLimitedFailures_1 = 0;
                                    paidFallbackSuccess = false;
                                    failureReasonCounts_1 = new Map();
                                    registerFailureReason = function (message) {
                                        var reason = (0, failoverPolicy_js_1.classifyFailoverReason)(message);
                                        failureReasonCounts_1.set(reason, (failureReasonCounts_1.get(reason) || 0) + 1);
                                        if ((0, failoverPolicy_js_1.isRateLimitedFailure)(message)) {
                                            rateLimitedFailures_1 += 1;
                                        }
                                    };
                                    runEndpointAttempt_1 = function (endpoint_1) {
                                        var args_1 = [];
                                        for (var _i = 1; _i < arguments.length; _i++) {
                                            args_1[_i - 1] = arguments[_i];
                                        }
                                        return __awaiter(_this, __spreadArray([endpoint_1], args_1, true), void 0, function (endpoint, delayMs) {
                                            var endpointMethodKey, capacity, startTime, externalAbortListener, controller_1, timeout_1, response, data, knownHash, responseTime, txHash, error_2, msg;
                                            var _a, _b;
                                            if (delayMs === void 0) { delayMs = 0; }
                                            return __generator(this, function (_c) {
                                                switch (_c.label) {
                                                    case 0:
                                                        if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                                                            throw new Error('aborted_by_signal');
                                                        }
                                                        if (!(delayMs > 0)) return [3 /*break*/, 2];
                                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delayMs); })];
                                                    case 1:
                                                        _c.sent();
                                                        _c.label = 2;
                                                    case 2:
                                                        endpointMethodKey = endpointMethodHealthKey(endpoint.url, method);
                                                        if (isEndpointMethodTimeoutCooling(endpointMethodKey)) {
                                                            throw new Error('endpoint_method_timeout_cooldown');
                                                        }
                                                        markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointAttempts');
                                                        markEndpointMethodAttempt(endpointMethodKey);
                                                        if (!txLifecycleCritical_1 && isCircuitOpen(endpoint.url)) {
                                                            throw new Error('circuit_open');
                                                        }
                                                        if (txLifecycleCritical_1) {
                                                            recordUsageStart(endpoint.url);
                                                        }
                                                        else {
                                                            capacity = checkAndReserveCapacity(endpoint, effectiveImportance);
                                                            if (!capacity.ok) {
                                                                throw new Error("capacity_limited:".concat(capacity.reason || 'unknown'));
                                                            }
                                                        }
                                                        startTime = Date.now();
                                                        externalAbortListener = null;
                                                        _c.label = 3;
                                                    case 3:
                                                        _c.trys.push([3, 6, 7, 8]);
                                                        recordAttempt(endpoint.url);
                                                        controller_1 = new AbortController();
                                                        if (options.signal) {
                                                            if (options.signal.aborted) {
                                                                controller_1.abort();
                                                            }
                                                            else {
                                                                externalAbortListener = function () { return controller_1.abort(); };
                                                                options.signal.addEventListener('abort', externalAbortListener, { once: true });
                                                            }
                                                        }
                                                        timeout_1 = setTimeout(function () { return controller_1.abort(); }, requestTimeoutMs);
                                                        return [4 /*yield*/, fetch(endpoint.url, {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Accept-Encoding': 'gzip',
                                                                    'Connection': 'keep-alive',
                                                                },
                                                                body: JSON.stringify(request_1),
                                                                signal: controller_1.signal,
                                                                keepalive: true,
                                                            }).finally(function () {
                                                                clearTimeout(timeout_1);
                                                                if (externalAbortListener && options.signal) {
                                                                    options.signal.removeEventListener('abort', externalAbortListener);
                                                                }
                                                            })];
                                                    case 4:
                                                        response = _c.sent();
                                                        if (!response.ok) {
                                                            throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                                                        }
                                                        return [4 /*yield*/, response.json()];
                                                    case 5:
                                                        data = _c.sent();
                                                        if (data.error) {
                                                            if (method === 'eth_sendRawTransaction' && rawTxHash && shouldTreatSendRawErrorAsKnown(data.error.message)) {
                                                                knownHash = rawTxHash;
                                                                setRawTxCache(chainId, rawTxHash, knownHash);
                                                                recordSuccess(endpoint.url, Date.now() - startTime);
                                                                return [2 /*return*/, knownHash];
                                                            }
                                                            throw new Error("RPC Error: ".concat(data.error.message));
                                                        }
                                                        if (data.result === undefined || data.result === null) {
                                                            throw new Error('RPC returned empty result');
                                                        }
                                                        responseTime = Date.now() - startTime;
                                                        recordSuccess(endpoint.url, responseTime);
                                                        markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'successes');
                                                        if (method === 'eth_sendRawTransaction' && rawTxHash) {
                                                            if (typeof data.result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(data.result)) {
                                                                throw new Error('RPC returned invalid tx hash for eth_sendRawTransaction');
                                                            }
                                                            txHash = data.result;
                                                            setRawTxCache(chainId, rawTxHash, txHash);
                                                        }
                                                        return [2 /*return*/, data.result];
                                                    case 6:
                                                        error_2 = _c.sent();
                                                        recordFailure(endpoint.url);
                                                        markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointFailures');
                                                        msg = String((error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || '');
                                                        if (msg.includes('timeout_') || msg.toLowerCase().includes('aborterror')) {
                                                            markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'timeoutErrors');
                                                            if (!((_b = options.signal) === null || _b === void 0 ? void 0 : _b.aborted)) {
                                                                markEndpointMethodTimeout(endpointMethodKey);
                                                            }
                                                        }
                                                        throw error_2;
                                                    case 7:
                                                        recordUsageEnd(endpoint.url);
                                                        return [7 /*endfinally*/];
                                                    case 8: return [2 /*return*/];
                                                }
                                            });
                                        });
                                    };
                                    canHedgeReads = method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt';
                                    canHedgeEthCall = method === 'eth_call';
                                    canHedgeWrites = method === 'eth_sendRawTransaction' && RPC_CRITICAL_HEDGE_ALLOW_WRITE;
                                    canUseCriticalHedge = RPC_CRITICAL_HEDGE_ENABLED &&
                                        (0, purpose_js_1.purposeAllowsHedge)(purpose) &&
                                        !cooldownActive &&
                                        effectiveImportance === 'critical' &&
                                        selectedEndpoints_1.length >= 2 &&
                                        (canHedgeReads || canHedgeWrites || canHedgeEthCall);
                                    if (!canUseCriticalHedge) return [3 /*break*/, 5];
                                    _f.label = 2;
                                case 2:
                                    _f.trys.push([2, 4, , 5]);
                                    hedgeFanout = canHedgeEthCall ? RPC_ETH_CALL_HEDGE_FANOUT : RPC_CRITICAL_HEDGE_FANOUT;
                                    fanout = Math.min(hedgeFanout, selectedEndpoints_1.length);
                                    attempts = Array.from({ length: fanout }, function (_, idx) {
                                        return runEndpointAttempt_1(selectedEndpoints_1[idx], Math.max(0, RPC_CRITICAL_HEDGE_STAGGER_MS) * idx);
                                    });
                                    return [4 /*yield*/, Promise.any(attempts)];
                                case 3:
                                    hedged = _f.sent();
                                    if (cacheableMethod) {
                                        cacheKey = (0, rpcCache_js_1.buildCacheKey)(chainIdOrName, method, params);
                                        (0, rpcCache_js_1.setCachedRpc)(cacheKey, hedged, (0, rpcCache_js_1.getTtlForMethod)(method));
                                    }
                                    markMethodSuccess(backoffKey);
                                    return [2 /*return*/, hedged];
                                case 4:
                                    _a = _f.sent();
                                    return [3 /*break*/, 5];
                                case 5:
                                    fanoutSendRaw = method === 'eth_sendRawTransaction' && options.sendRawFanout === true;
                                    if (!fanoutSendRaw) return [3 /*break*/, 10];
                                    sendRawFanoutMax = Math.max(1, Math.min(selectedEndpoints_1.length, Math.min(Number(process.env.RPC_SENDRAW_FANOUT_MAX || '3'), purposeProfile.sendRawFanoutMax)));
                                    endpointsToTry = selectedEndpoints_1.slice(0, sendRawFanoutMax);
                                    acceptedHash_1 = null;
                                    acceptedCount_1 = 0;
                                    failedCount_1 = 0;
                                    knownCount_1 = 0;
                                    endpointResults_1 = [];
                                    attemptPromises = endpointsToTry.map(function (endpoint) { return __awaiter(_this, void 0, void 0, function () {
                                        var result, txHash, error_3, message;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    if (!(endpoint === null || endpoint === void 0 ? void 0 : endpoint.url))
                                                        throw new Error('invalid_endpoint');
                                                    _a.label = 1;
                                                case 1:
                                                    _a.trys.push([1, 3, , 4]);
                                                    return [4 /*yield*/, runEndpointAttempt_1(endpoint)];
                                                case 2:
                                                    result = _a.sent();
                                                    txHash = typeof result === 'string' && /^0x[0-9a-fA-F]{64}$/.test(result)
                                                        ? result
                                                        : '';
                                                    if (!txHash) {
                                                        failedCount_1 += 1;
                                                        endpointResults_1.push({
                                                            endpoint: maskEndpoint(endpoint.url),
                                                            status: 'failed',
                                                            error: 'invalid_tx_hash_result'
                                                        });
                                                        throw new Error('invalid_tx_hash_result');
                                                    }
                                                    acceptedCount_1 += 1;
                                                    endpointResults_1.push({
                                                        endpoint: maskEndpoint(endpoint.url),
                                                        status: 'accepted',
                                                        txHash: txHash
                                                    });
                                                    if (!acceptedHash_1)
                                                        acceptedHash_1 = txHash;
                                                    return [2 /*return*/, txHash];
                                                case 3:
                                                    error_3 = _a.sent();
                                                    message = String((error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || error_3 || '');
                                                    lastError_1 = error_3 instanceof Error ? error_3 : new Error(message);
                                                    if (message.includes('already known') || message.includes('known transaction') || message.includes('already imported')) {
                                                        knownCount_1 += 1;
                                                        if (!acceptedHash_1 && rawTxHash)
                                                            acceptedHash_1 = rawTxHash;
                                                        endpointResults_1.push({
                                                            endpoint: maskEndpoint(endpoint.url),
                                                            status: 'known',
                                                            txHash: rawTxHash || undefined,
                                                            error: message.slice(0, 180)
                                                        });
                                                        if (rawTxHash)
                                                            return [2 /*return*/, rawTxHash];
                                                    }
                                                    failedCount_1 += 1;
                                                    endpointResults_1.push({
                                                        endpoint: maskEndpoint(endpoint.url),
                                                        status: 'failed',
                                                        error: message.slice(0, 180)
                                                    });
                                                    throw error_3;
                                                case 4: return [2 /*return*/];
                                            }
                                        });
                                    }); });
                                    _f.label = 6;
                                case 6:
                                    _f.trys.push([6, 8, , 9]);
                                    return [4 /*yield*/, Promise.any(attemptPromises)];
                                case 7:
                                    firstHash = _f.sent();
                                    if (firstHash && /^0x[0-9a-fA-F]{64}$/.test(firstHash)) {
                                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'eth_sendRawTransaction fanout completed', {
                                            chain: chainName,
                                            rpc_pool: rpcClass,
                                            attemptedEndpoints: endpointsToTry.length,
                                            selectedEndpoints: selectedEndpoints_1.length,
                                            acceptedCount: acceptedCount_1,
                                            knownCount: knownCount_1,
                                            failedCount: failedCount_1,
                                            endpointBudget: endpointBudget,
                                            endpointResults: endpointResults_1,
                                            role: logRegistry_js_1.LogRole.METRIC
                                        });
                                        markMethodSuccess(backoffKey);
                                        if (rawTxHash) {
                                            setRawTxCache(chainId, rawTxHash, firstHash);
                                        }
                                        return [2 /*return*/, firstHash];
                                    }
                                    return [3 /*break*/, 9];
                                case 8:
                                    _b = _f.sent();
                                    return [3 /*break*/, 9];
                                case 9:
                                    if (acceptedHash_1) {
                                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'eth_sendRawTransaction fanout completed', {
                                            chain: chainName,
                                            rpc_pool: rpcClass,
                                            attemptedEndpoints: endpointsToTry.length,
                                            selectedEndpoints: selectedEndpoints_1.length,
                                            acceptedCount: acceptedCount_1,
                                            knownCount: knownCount_1,
                                            failedCount: failedCount_1,
                                            endpointBudget: endpointBudget,
                                            endpointResults: endpointResults_1,
                                            role: logRegistry_js_1.LogRole.METRIC
                                        });
                                        markMethodSuccess(backoffKey);
                                        if (rawTxHash) {
                                            setRawTxCache(chainId, rawTxHash, acceptedHash_1);
                                        }
                                        return [2 /*return*/, acceptedHash_1];
                                    }
                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'eth_sendRawTransaction fanout failed with no accepted hash', {
                                        chain: chainName,
                                        rpc_pool: rpcClass,
                                        attemptedEndpoints: endpointsToTry.length,
                                        selectedEndpoints: selectedEndpoints_1.length,
                                        failedCount: failedCount_1,
                                        knownCount: knownCount_1,
                                        endpointBudget: endpointBudget,
                                        endpointResults: endpointResults_1,
                                        role: logRegistry_js_1.LogRole.METRIC
                                    });
                                    _f.label = 10;
                                case 10:
                                    i = 0;
                                    _f.label = 11;
                                case 11:
                                    if (!(i < selectedEndpoints_1.length)) return [3 /*break*/, 19];
                                    if ((_d = options.signal) === null || _d === void 0 ? void 0 : _d.aborted) {
                                        throw new Error('aborted_by_signal');
                                    }
                                    endpoint = selectedEndpoints_1[i];
                                    if (!(endpoint === null || endpoint === void 0 ? void 0 : endpoint.url))
                                        return [3 /*break*/, 18];
                                    isLast = i >= selectedEndpoints_1.length - 1;
                                    startTime = Date.now();
                                    _f.label = 12;
                                case 12:
                                    _f.trys.push([12, 14, , 18]);
                                    return [4 /*yield*/, runEndpointAttempt_1(endpoint)];
                                case 13:
                                    result = _f.sent();
                                    if (cacheableMethod) {
                                        cacheKey = (0, rpcCache_js_1.buildCacheKey)(chainIdOrName, method, params);
                                        (0, rpcCache_js_1.setCachedRpc)(cacheKey, result, (0, rpcCache_js_1.getTtlForMethod)(method));
                                    }
                                    if (i > 0) {
                                        if (endpoint.type === 'premium') {
                                            paidFallbackSuccess = true;
                                        }
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, "RPC failover success", {
                                            chain: chainName,
                                            endpoint: i + 1,
                                            total: selectedEndpoints_1.length,
                                            endpointBudget: endpointBudget,
                                            responseTime: Date.now() - startTime,
                                            paid_fallback_success: paidFallbackSuccess,
                                            rate_limited_failures: rateLimitedFailures_1,
                                            role: logRegistry_js_1.LogRole.METRIC
                                        });
                                    }
                                    markMethodSuccess(backoffKey);
                                    return [2 /*return*/, result];
                                case 14:
                                    error_1 = _f.sent();
                                    message = String((error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || error_1 || '');
                                    if (message === 'circuit_open') {
                                        lastError_1 = new Error('all_endpoints_circuit_open');
                                        registerFailureReason(message);
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, "RPC circuit open, skipping endpoint", {
                                            chain: chainName,
                                            endpoint: maskEndpoint(endpoint.url),
                                            role: logRegistry_js_1.LogRole.METRIC
                                        });
                                        return [3 /*break*/, 18];
                                    }
                                    if (message.startsWith('capacity_limited:')) {
                                        lastError_1 = new Error(message);
                                        registerFailureReason(message);
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, "RPC capacity limited, skipping endpoint", {
                                            chain: chainName,
                                            endpoint: maskEndpoint(endpoint.url),
                                            reason: message.split(':')[1] || 'unknown',
                                            role: logRegistry_js_1.LogRole.METRIC
                                        });
                                        return [3 /*break*/, 18];
                                    }
                                    if (message === 'endpoint_method_timeout_cooldown') {
                                        lastError_1 = new Error(message);
                                        registerFailureReason(message);
                                        return [3 /*break*/, 18];
                                    }
                                    lastError_1 = error_1 instanceof Error ? error_1 : new Error(message);
                                    registerFailureReason(message);
                                    if ((0, purpose_js_1.purposeUsesPublicFreeOnly)(purpose) && (0, failoverPolicy_js_1.isHighSeverityRpcFailure)(message)) {
                                        forceOpenEndpointCircuit(endpoint.url, CIRCUIT_BREAKER_RESET_TIME * 4);
                                    }
                                    isContractError = isNonRetryableRpcErrorMessage(message);
                                    if (isContractError) {
                                        throw lastError_1;
                                    }
                                    if (i < 2) {
                                        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.API_FETCH_FAILED, "RPC endpoint failed", {
                                            chain: chainName,
                                            endpoint: i + 1,
                                            total: selectedEndpoints_1.length,
                                            endpointBudget: endpointBudget,
                                            error: message,
                                            duration: Date.now() - startTime,
                                            role: logRegistry_js_1.LogRole.METRIC
                                        });
                                    }
                                    if (!!isLast) return [3 /*break*/, 17];
                                    if ((_e = options.signal) === null || _e === void 0 ? void 0 : _e.aborted) {
                                        throw lastError_1;
                                    }
                                    if (!!(0, failoverPolicy_js_1.shouldSkipFailoverDelay)(message)) return [3 /*break*/, 16];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                                case 15:
                                    _f.sent();
                                    _f.label = 16;
                                case 16: return [3 /*break*/, 18];
                                case 17: return [3 /*break*/, 18];
                                case 18:
                                    i++;
                                    return [3 /*break*/, 11];
                                case 19:
                                    newBackoff = markMethodFailure(backoffKey);
                                    failedLogKey = "".concat(chainName, ":").concat(method);
                                    rpcFailureCode = classifyRpcFailureCode(lastError_1);
                                    if (shouldLogAllRpcFailed(failedLogKey)) {
                                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
                                            chain: chainName,
                                            method: method,
                                            rpc_pool: rpcClass,
                                            rpc_failure_code: rpcFailureCode,
                                            totalEndpoints: sortedEndpoints.length,
                                            attemptedEndpoints: selectedEndpoints_1.length,
                                            endpointBudget: endpointBudget,
                                            exhaustiveFailover: forceExhaustiveFailover,
                                            rate_limited_failures: rateLimitedFailures_1,
                                            failure_reason_top: (0, failoverPolicy_js_1.summarizeTopFailoverReasons)(failureReasonCounts_1),
                                            cooldownMs: Math.max(0, newBackoff.cooldownUntil - Date.now()),
                                            lastError: lastError_1 === null || lastError_1 === void 0 ? void 0 : lastError_1.message,
                                            role: logRegistry_js_1.LogRole.METRIC
                                        });
                                    }
                                    else {
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'All RPC endpoints failed (suppressed)', {
                                            chain: chainName,
                                            method: method
                                        });
                                    }
                                    (0, explainAggregate_js_1.recordRpcSelectionExplainAllFailed)({
                                        chain: chainName,
                                        method: method,
                                        purpose: purpose,
                                        lane: executionLane,
                                        reasons: (0, failoverPolicy_js_1.summarizeTopFailoverReasons)(failureReasonCounts_1).map(function (row) { return String(row.reason || 'unknown'); }),
                                    });
                                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'allFailed');
                                    markChainRpcDegraded(chainId, method, (lastError_1 === null || lastError_1 === void 0 ? void 0 : lastError_1.message) || 'all_endpoints_failed');
                                    throw new Error("All RPC endpoints failed for ".concat(chainName, ". Last error: ").concat((lastError_1 === null || lastError_1 === void 0 ? void 0 : lastError_1.message) || 'Unknown'));
                                case 20:
                                    markRpcMethodLatency(chainId, executionLane, method, effectiveImportance, rpcClass, path, Date.now() - runStartedAt);
                                    rpcPoolInflight[rpcClass] = Math.max(0, rpcPoolInflight[rpcClass] - 1);
                                    return [7 /*endfinally*/];
                                case 21: return [2 /*return*/];
                            }
                        });
                    }); };
                    executePromise = (0, laneBudget_js_1.withRpcLaneBudget)({
                        chainId: chainId,
                        lane: executionLane,
                        fn: function () { return withMethodLimiter(limiterKey, concurrencyLimit, runCall); },
                    });
                    if (!(coalescingEnabled && inflightRpcRequests.size < RPC_INFLIGHT_MAP_MAX)) return [3 /*break*/, 6];
                    inflightRpcRequests.set(inflightKey, executePromise);
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, , 5, 6]);
                    return [4 /*yield*/, executePromise];
                case 4: return [2 /*return*/, _b.sent()];
                case 5:
                    inflightRpcRequests.delete(inflightKey);
                    return [7 /*endfinally*/];
                case 6: return [4 /*yield*/, executePromise];
                case 7: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
/**
 * Call RPC and return raw response (used when revert data is needed)
 */
function callRpcRaw(chainIdOrName_1, method_1) {
    return __awaiter(this, arguments, void 0, function (chainIdOrName, method, params, options) {
        var endpoints, chainName, chainId, chainSlug, primaryUrl, purpose, purposeProfile, requestedStrategy, id, effectiveImportance, executionLane, config, strategy, upgradeDecision, upgraded, rpcClass, path, backoffKey, cooldownState, cooldownActive, limiterKey, concurrencyLimit, requestTimeoutMs, inflightKey, existing, runCall, wrappedRunCall, executePromise;
        var _this = this;
        if (params === void 0) { params = []; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    endpoints = [];
                    chainName = typeof chainIdOrName === 'string' ? chainIdOrName : "Chain ".concat(chainIdOrName);
                    chainSlug = 'eth';
                    purpose = options.purpose || (0, purpose_js_1.inferLegacyRpcPurpose)({
                        method: method,
                        strategy: options.strategy,
                        importance: options.importance,
                        path: options.path,
                    });
                    purposeProfile = (0, purpose_js_1.getRpcPurposeProfile)(purpose);
                    requestedStrategy = options.strategy || purposeProfile.strategy;
                    // Resolve Chain ID
                    if (typeof chainIdOrName === 'number') {
                        chainId = chainIdOrName;
                    }
                    else {
                        id = CHAIN_NAME_TO_ID[chainIdOrName.toLowerCase()];
                        if (!id)
                            throw new Error("Unsupported chain name: ".concat(chainIdOrName));
                        chainId = id;
                    }
                    effectiveImportance = options.importance || purposeProfile.importance || (options.strategy === 'fast' ? 'critical' : 'normal');
                    executionLane = options.lane || purposeProfile.lane || (0, executionLane_js_1.inferExecutionLane)(method, effectiveImportance);
                    try {
                        config = (0, chainConfig_js_1.getChainConfig)(chainId);
                        chainName = config.name;
                        chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
                        strategy = executionLane === 'critical' ? 'fast' : requestedStrategy;
                        primaryUrl = getPrimaryRpcUrl(chainSlug);
                        endpoints = (0, apiEndpoints_js_1.getRpcEndpointsForLane)(chainSlug, executionLane, primaryUrl);
                        endpoints = filterEndpointsByMethod(endpoints, method);
                        endpoints = filterEndpointsForPurpose(endpoints, purpose);
                        upgradeDecision = (0, policy_js_1.shouldUpgradeRpcStrategy)({
                            endpoints: endpoints,
                            getHealth: getEndpointHealthView,
                            getUsage: getEndpointUsageView,
                            method: method,
                            importance: effectiveImportance,
                            purpose: purpose,
                        });
                        if (!(0, purpose_js_1.purposeUsesPublicFreeOnly)(purpose) && executionLane === 'cheap' && strategy === 'cheap' && upgradeDecision.upgrade) {
                            upgraded = (0, apiEndpoints_js_1.getRpcEndpointsForLane)(chainSlug, 'critical', primaryUrl);
                            if (upgraded.length > 0) {
                                endpoints = filterEndpointsForPurpose(filterEndpointsByMethod(upgraded, method), purpose);
                                logger_js_1.logger.throttled(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC strategy upgraded to fast due to degraded cheap pool', {
                                    chain: chainName,
                                    method: method,
                                    executionLane: executionLane,
                                    lane: upgradeDecision.lane,
                                    reasons: upgradeDecision.reasons,
                                    purpose: purpose,
                                }, RPC_UPGRADE_LOG_WINDOW_MS);
                            }
                        }
                    }
                    catch (e) {
                        throw new Error("Unsupported chain ID: ".concat(chainId));
                    }
                    if (!endpoints || endpoints.length === 0) {
                        throw new Error("No RPC endpoints configured for ".concat(chainName));
                    }
                    rpcClass = options.rpcClass || inferRpcClass(method, effectiveImportance);
                    path = String(options.path || purpose);
                    backoffKey = buildMethodBackoffKey(chainId, executionLane, method, effectiveImportance, rpcClass);
                    cooldownState = getMethodBackoffState(backoffKey);
                    cooldownActive = !!cooldownState;
                    limiterKey = "".concat(chainId, ":").concat(executionLane, ":").concat(method, ":").concat(effectiveImportance, ":").concat(rpcClass, ":raw");
                    concurrencyLimit = getMethodConcurrencyLimit(method, effectiveImportance, cooldownActive, rpcClass);
                    requestTimeoutMs = resolveRpcTimeoutMs(method, options);
                    inflightKey = "raw:".concat(createStableRequestKey(chainId, method, params));
                    existing = inflightRpcRawRequests.get(inflightKey);
                    if (!existing) return [3 /*break*/, 2];
                    return [4 /*yield*/, existing];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    runCall = function () { return __awaiter(_this, void 0, void 0, function () {
                        var request, scoreTable, sortedEndpoints, forceExhaustiveFailover, endpointBudget, selectedEndpoints, selectedPremiumCount, selectedPublicCount, explainSnapshot, criticalFallbackSelected, lastError, rateLimitedFailures, paidFallbackSuccess, failureReasonCounts, registerFailureReason, _loop_1, i, state_1, newBackoff, failedLogKey;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'requests');
                                    rpcPoolInflight[rpcClass] += 1;
                                    request = {
                                        jsonrpc: '2.0',
                                        id: Date.now(),
                                        method: method,
                                        params: params,
                                    };
                                    scoreTable = (0, score_js_1.buildRpcScoreTable)({
                                        endpoints: endpoints,
                                        method: method,
                                        importance: effectiveImportance,
                                        purpose: purpose,
                                        now: Date.now(),
                                        getHealth: getEndpointHealthView,
                                        getUsage: getEndpointUsageView
                                    });
                                    sortedEndpoints = scoreTable.map(function (row) { return row.endpoint; });
                                    forceExhaustiveFailover = purposeProfile.allowExhaustiveFailover
                                        && shouldForceExhaustiveFailover(method, effectiveImportance, options, purpose);
                                    endpointBudget = getEndpointAttemptBudget(method, effectiveImportance, sortedEndpoints.length, cooldownActive, forceExhaustiveFailover);
                                    endpointBudget = Math.max(1, Math.min(endpointBudget, forceExhaustiveFailover ? sortedEndpoints.length : purposeProfile.maxEndpointAttempts));
                                    if (purposeProfile.allowPremiumFallback) {
                                        endpointBudget = (0, failoverPolicy_js_1.extendCheapBudgetToIncludePremiumFallback)({
                                            strategy: requestedStrategy,
                                            sortedEndpoints: sortedEndpoints,
                                            endpointBudget: endpointBudget,
                                            forceExhaustiveFailover: forceExhaustiveFailover
                                        });
                                    }
                                    selectedEndpoints = purpose === 'tx_visibility' ? expandCriticalSelectionWithPublicFallback({
                                        executionLane: executionLane,
                                        selectedEndpoints: sortedEndpoints.slice(0, endpointBudget),
                                        chainSlug: chainSlug,
                                        primaryUrl: primaryUrl,
                                        method: method,
                                    }) : sortedEndpoints.slice(0, endpointBudget);
                                    reserveProjectedSelection(selectedEndpoints, method, effectiveImportance, purpose);
                                    selectedPremiumCount = selectedEndpoints.filter(function (endpoint) { return endpoint.type === 'premium'; }).length;
                                    selectedPublicCount = countSelectedFreeEndpoints(selectedEndpoints);
                                    if (RPC_EXPLAIN_ENABLED && effectiveImportance === 'critical') {
                                        explainSnapshot = (0, explain_js_1.buildRpcSelectionExplain)({
                                            method: method,
                                            importance: effectiveImportance,
                                            strategy: options.strategy || 'cheap',
                                            scores: scoreTable,
                                            selectedEndpoints: selectedEndpoints,
                                            upgradeDecision: (0, policy_js_1.shouldUpgradeRpcStrategy)({
                                                endpoints: endpoints,
                                                getHealth: getEndpointHealthView,
                                                getUsage: getEndpointUsageView,
                                                method: method,
                                                importance: effectiveImportance,
                                                purpose: purpose,
                                            })
                                        });
                                        criticalFallbackSelected = selectedPublicCount > 0 && selectedPremiumCount === 0;
                                        if (criticalFallbackSelected) {
                                            logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'RPC raw selection explain (critical fallback)', __assign({ chain: chainName, purpose: purpose }, explainSnapshot));
                                        }
                                        else {
                                            (0, explainAggregate_js_1.recordRpcSelectionExplainAggregate)({
                                                chain: chainName,
                                                purpose: purpose,
                                                snapshot: explainSnapshot,
                                            });
                                        }
                                    }
                                    lastError = null;
                                    rateLimitedFailures = 0;
                                    paidFallbackSuccess = false;
                                    failureReasonCounts = new Map();
                                    registerFailureReason = function (message) {
                                        var reason = (0, failoverPolicy_js_1.classifyFailoverReason)(message);
                                        failureReasonCounts.set(reason, (failureReasonCounts.get(reason) || 0) + 1);
                                        if ((0, failoverPolicy_js_1.isRateLimitedFailure)(message)) {
                                            rateLimitedFailures += 1;
                                        }
                                    };
                                    _loop_1 = function (i) {
                                        var endpoint, capacity, isLast, startTime, controller_2, timeout_2, response, data, responseTime, error_4, msg, isContractError;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    endpoint = selectedEndpoints[i];
                                                    if (!(endpoint === null || endpoint === void 0 ? void 0 : endpoint.url))
                                                        return [2 /*return*/, "continue"];
                                                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointAttempts');
                                                    if (isCircuitOpen(endpoint.url)) {
                                                        lastError = new Error('all_endpoints_circuit_open');
                                                        registerFailureReason('circuit_open');
                                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC circuit open, skipping endpoint', {
                                                            chain: chainName,
                                                            endpoint: maskEndpoint(endpoint.url)
                                                        });
                                                        return [2 /*return*/, "continue"];
                                                    }
                                                    capacity = checkAndReserveCapacity(endpoint, effectiveImportance);
                                                    if (!capacity.ok) {
                                                        lastError = new Error("capacity_limited:".concat(capacity.reason || 'unknown'));
                                                        registerFailureReason("capacity_limited:".concat(capacity.reason || 'unknown'));
                                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC capacity limited, skipping endpoint', {
                                                            chain: chainName,
                                                            endpoint: maskEndpoint(endpoint.url),
                                                            reason: capacity.reason
                                                        });
                                                        return [2 /*return*/, "continue"];
                                                    }
                                                    isLast = i >= selectedEndpoints.length - 1;
                                                    startTime = Date.now();
                                                    _b.label = 1;
                                                case 1:
                                                    _b.trys.push([1, 4, 8, 9]);
                                                    recordAttempt(endpoint.url);
                                                    controller_2 = new AbortController();
                                                    timeout_2 = setTimeout(function () { return controller_2.abort(); }, requestTimeoutMs);
                                                    return [4 /*yield*/, fetch(endpoint.url, {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Accept-Encoding': 'gzip',
                                                                'Connection': 'keep-alive',
                                                            },
                                                            body: JSON.stringify(request),
                                                            signal: controller_2.signal,
                                                            keepalive: true,
                                                        }).finally(function () { return clearTimeout(timeout_2); })];
                                                case 2:
                                                    response = _b.sent();
                                                    if (!response.ok) {
                                                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                                                    }
                                                    return [4 /*yield*/, response.json()];
                                                case 3:
                                                    data = _b.sent();
                                                    responseTime = Date.now() - startTime;
                                                    recordSuccess(endpoint.url, responseTime);
                                                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'successes');
                                                    if (i > 0) {
                                                        if (endpoint.type === 'premium') {
                                                            paidFallbackSuccess = true;
                                                        }
                                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'RPC failover success', {
                                                            chain: chainName,
                                                            endpoint: i + 1,
                                                            total: selectedEndpoints.length,
                                                            endpointBudget: endpointBudget,
                                                            responseTime: responseTime,
                                                            paid_fallback_success: paidFallbackSuccess,
                                                            rate_limited_failures: rateLimitedFailures,
                                                        });
                                                    }
                                                    markMethodSuccess(backoffKey);
                                                    return [2 /*return*/, { value: data }];
                                                case 4:
                                                    error_4 = _b.sent();
                                                    recordFailure(endpoint.url);
                                                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'endpointFailures');
                                                    msg = String((error_4 === null || error_4 === void 0 ? void 0 : error_4.message) || '');
                                                    if (msg.includes('timeout_') || msg.toLowerCase().includes('aborterror')) {
                                                        markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'timeoutErrors');
                                                    }
                                                    lastError = error_4 instanceof Error ? error_4 : new Error(msg);
                                                    registerFailureReason(msg);
                                                    if ((0, purpose_js_1.purposeUsesPublicFreeOnly)(purpose) && (0, failoverPolicy_js_1.isHighSeverityRpcFailure)(msg)) {
                                                        forceOpenEndpointCircuit(endpoint.url, CIRCUIT_BREAKER_RESET_TIME * 4);
                                                    }
                                                    isContractError = isNonRetryableRpcErrorMessage(msg);
                                                    if (isContractError) {
                                                        throw lastError;
                                                    }
                                                    if (i < 2) {
                                                        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC endpoint failed', {
                                                            chain: chainName,
                                                            endpoint: i + 1,
                                                            total: selectedEndpoints.length,
                                                            endpointBudget: endpointBudget,
                                                            error: msg,
                                                            duration: Date.now() - startTime
                                                        });
                                                    }
                                                    if (!!isLast) return [3 /*break*/, 7];
                                                    if (!!(0, failoverPolicy_js_1.shouldSkipFailoverDelay)(msg)) return [3 /*break*/, 6];
                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                                                case 5:
                                                    _b.sent();
                                                    _b.label = 6;
                                                case 6: return [2 /*return*/, "continue"];
                                                case 7: return [3 /*break*/, 9];
                                                case 8:
                                                    recordUsageEnd(endpoint.url);
                                                    return [7 /*endfinally*/];
                                                case 9: return [2 /*return*/];
                                            }
                                        });
                                    };
                                    i = 0;
                                    _a.label = 1;
                                case 1:
                                    if (!(i < selectedEndpoints.length)) return [3 /*break*/, 4];
                                    return [5 /*yield**/, _loop_1(i)];
                                case 2:
                                    state_1 = _a.sent();
                                    if (typeof state_1 === "object")
                                        return [2 /*return*/, state_1.value];
                                    _a.label = 3;
                                case 3:
                                    i++;
                                    return [3 /*break*/, 1];
                                case 4:
                                    newBackoff = markMethodFailure(backoffKey);
                                    failedLogKey = "".concat(chainName, ":").concat(method, ":raw");
                                    if (shouldLogAllRpcFailed(failedLogKey)) {
                                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
                                            chain: chainName,
                                            method: method,
                                            rpc_pool: rpcClass,
                                            rpc_failure_code: classifyRpcFailureCode(lastError),
                                            totalEndpoints: sortedEndpoints.length,
                                            attemptedEndpoints: selectedEndpoints.length,
                                            selectedPremiumCount: selectedPremiumCount,
                                            selectedPublicCount: selectedPublicCount,
                                            endpointBudget: endpointBudget,
                                            exhaustiveFailover: forceExhaustiveFailover,
                                            rate_limited_failures: rateLimitedFailures,
                                            failure_reason_top: (0, failoverPolicy_js_1.summarizeTopFailoverReasons)(failureReasonCounts),
                                            cooldownMs: Math.max(0, newBackoff.cooldownUntil - Date.now()),
                                            lastError: lastError === null || lastError === void 0 ? void 0 : lastError.message
                                        });
                                    }
                                    else {
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'All RPC endpoints failed (suppressed)', {
                                            chain: chainName,
                                            method: method
                                        });
                                    }
                                    (0, explainAggregate_js_1.recordRpcSelectionExplainAllFailed)({
                                        chain: chainName,
                                        method: method,
                                        purpose: purpose,
                                        lane: executionLane,
                                        reasons: (0, failoverPolicy_js_1.summarizeTopFailoverReasons)(failureReasonCounts).map(function (row) { return String(row.reason || 'unknown'); }),
                                    });
                                    markRpcMethodUsage(chainId, executionLane, method, effectiveImportance, rpcClass, path, 'allFailed');
                                    throw new Error("All RPC endpoints failed for ".concat(chainName, ". Last error: ").concat((lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown'));
                            }
                        });
                    }); };
                    wrappedRunCall = function () { return __awaiter(_this, void 0, void 0, function () {
                        var startedAt;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    startedAt = Date.now();
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, , 3, 4]);
                                    return [4 /*yield*/, runCall()];
                                case 2: return [2 /*return*/, _a.sent()];
                                case 3:
                                    markRpcMethodLatency(chainId, executionLane, method, effectiveImportance, rpcClass, path, Date.now() - startedAt);
                                    rpcPoolInflight[rpcClass] = Math.max(0, rpcPoolInflight[rpcClass] - 1);
                                    return [7 /*endfinally*/];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); };
                    executePromise = (0, laneBudget_js_1.withRpcLaneBudget)({
                        chainId: chainId,
                        lane: executionLane,
                        fn: function () { return withMethodLimiter(limiterKey, concurrencyLimit, wrappedRunCall); },
                    });
                    if (!(inflightRpcRawRequests.size < RPC_INFLIGHT_MAP_MAX)) return [3 /*break*/, 6];
                    inflightRpcRawRequests.set(inflightKey, executePromise);
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, , 5, 6]);
                    return [4 /*yield*/, executePromise];
                case 4: return [2 /*return*/, _a.sent()];
                case 5:
                    inflightRpcRawRequests.delete(inflightKey);
                    return [7 /*endfinally*/];
                case 6: return [4 /*yield*/, executePromise];
                case 7: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function filterEndpointsByMethod(endpoints, method) {
    var matches = endpoints.filter(function (endpoint) { var _a, _b; return (_b = (_a = endpoint.capabilities) === null || _a === void 0 ? void 0 : _a.methods) === null || _b === void 0 ? void 0 : _b.includes(method); });
    return matches.length > 0 ? matches : endpoints;
}
/**
 * Health tracking functions
 */
function getOrCreateHealth(url) {
    if (!endpointHealth.has(url)) {
        endpointHealth.set(url, {
            url: url,
            consecutiveFailures: 0,
            lastFailureTime: 0,
            circuitOpen: false,
            avgResponseTime: 0,
            successCount: 0,
            totalAttempts: 0
        });
    }
    return endpointHealth.get(url);
}
function isCircuitOpen(url) {
    var health = getOrCreateHealth(url);
    if (!health.circuitOpen)
        return false;
    // Check if enough time has passed to reset circuit
    if (Date.now() - health.lastFailureTime > CIRCUIT_BREAKER_RESET_TIME) {
        health.circuitOpen = false;
        health.consecutiveFailures = 0;
        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'RPC circuit breaker reset', { endpoint: maskEndpoint(url) });
        return false;
    }
    return true;
}
function recordAttempt(url) {
    var health = getOrCreateHealth(url);
    health.totalAttempts++;
}
function recordSuccess(url, responseTime) {
    var health = getOrCreateHealth(url);
    health.successCount++;
    health.consecutiveFailures = 0;
    health.circuitOpen = false;
    // Update average response time (exponential moving average)
    if (health.avgResponseTime === 0) {
        health.avgResponseTime = responseTime;
    }
    else {
        health.avgResponseTime = health.avgResponseTime * 0.7 + responseTime * 0.3;
    }
}
function recordFailure(url) {
    var health = getOrCreateHealth(url);
    health.consecutiveFailures++;
    health.lastFailureTime = Date.now();
    // Open circuit if threshold reached
    if (health.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        health.circuitOpen = true;
        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC circuit breaker opened', {
            endpoint: maskEndpoint(url),
            failures: health.consecutiveFailures
        });
    }
}
function getEndpointHealthView(url) {
    var health = getOrCreateHealth(url);
    return {
        successRate: health.totalAttempts > 0 ? health.successCount / health.totalAttempts : 0.7,
        avgResponseTime: health.avgResponseTime,
        circuitOpen: health.circuitOpen,
        consecutiveFailures: health.consecutiveFailures,
        totalAttempts: health.totalAttempts
    };
}
function getEndpointUsageView(url) {
    var usage = getOrCreateUsage(url);
    var reserved = (0, reservation_js_1.getProjectedEndpointUsage)(url);
    return {
        inFlight: usage.inFlight,
        secondCount: usage.secondCount,
        minuteCount: usage.minuteCount,
        lastUsedAt: usage.lastUsedAt,
        reservedSecondCount: reserved.reservedSecondCount,
        reservedMinuteCount: reserved.reservedMinuteCount
    };
}
function reserveProjectedSelection(endpoints, method, importance, purpose) {
    if (endpoints.length === 0)
        return;
    var lane = (0, policy_js_1.inferRpcLane)(method, importance);
    var burstSize = (0, prediction_js_1.estimateUpcomingRpcBurstSize)({ method: method, lane: lane, importance: importance, purpose: purpose });
    (0, reservation_js_1.reserveProjectedEndpointUsage)({
        url: endpoints[0].url,
        lane: lane,
        secondUnits: burstSize,
        minuteUnits: burstSize
    });
    if (endpoints.length > 1 && (importance === 'critical' || method === 'eth_call')) {
        (0, reservation_js_1.reserveProjectedEndpointUsage)({
            url: endpoints[1].url,
            lane: lane,
            secondUnits: 1,
            minuteUnits: 1
        });
    }
}
function endpointCapacityPressure(endpoint) {
    var usage = getEndpointUsageView(endpoint.url);
    var limits = endpoint.limits || {};
    var rpsPressure = limits.rps ? (usage.secondCount + (usage.reservedSecondCount || 0)) / Math.max(1, limits.rps) : 0;
    var rpmPressure = limits.rpm ? (usage.minuteCount + (usage.reservedMinuteCount || 0)) / Math.max(1, limits.rpm) : 0;
    var inFlightPressure = limits.maxInFlight ? usage.inFlight / Math.max(1, limits.maxInFlight) : 0;
    return Math.max(rpsPressure, rpmPressure, inFlightPressure);
}
function probeEndpoint(url_1, method_1) {
    return __awaiter(this, arguments, void 0, function (url, method, params, timeoutMs) {
        var controller, timeout, start, response, data, ms, _a;
        if (params === void 0) { params = []; }
        if (timeoutMs === void 0) { timeoutMs = BENCHMARK_TIMEOUT_MS; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    controller = new AbortController();
                    timeout = setTimeout(function () { return controller.abort(); }, timeoutMs);
                    start = Date.now();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: method, params: params }),
                            signal: controller.signal,
                        })];
                case 2:
                    response = _b.sent();
                    return [4 /*yield*/, response.json().catch(function () { return ({}); })];
                case 3:
                    data = _b.sent();
                    ms = Date.now() - start;
                    if (!response.ok || data.error) {
                        return [2 /*return*/, { ok: false, ms: ms }];
                    }
                    return [2 /*return*/, { ok: true, ms: ms }];
                case 4:
                    _a = _b.sent();
                    return [2 /*return*/, { ok: false, ms: Date.now() - start }];
                case 5:
                    clearTimeout(timeout);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function runBenchmarkSample(chainId, tokenAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var endpoints, methods, _i, endpoints_1, endpoint, _a, methods_1, _b, method, params, result, health;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    endpoints = getRpcEndpoints(chainId, 'fast');
                    if (endpoints.length === 0)
                        return [2 /*return*/];
                    methods = [
                        ['eth_blockNumber', []],
                        ['eth_getBlockByNumber', ['latest', false]],
                        ['eth_call', [{ to: tokenAddress, data: BENCHMARK_DECIMALS_CALL }, 'latest']],
                    ];
                    _i = 0, endpoints_1 = endpoints;
                    _c.label = 1;
                case 1:
                    if (!(_i < endpoints_1.length)) return [3 /*break*/, 7];
                    endpoint = endpoints_1[_i];
                    _a = 0, methods_1 = methods;
                    _c.label = 2;
                case 2:
                    if (!(_a < methods_1.length)) return [3 /*break*/, 5];
                    _b = methods_1[_a], method = _b[0], params = _b[1];
                    recordAttempt(endpoint);
                    return [4 /*yield*/, probeEndpoint(endpoint, method, params)];
                case 3:
                    result = _c.sent();
                    if (result.ok) {
                        recordSuccess(endpoint, result.ms);
                    }
                    else {
                        recordFailure(endpoint);
                    }
                    _c.label = 4;
                case 4:
                    _a++;
                    return [3 /*break*/, 2];
                case 5:
                    health = getOrCreateHealth(endpoint);
                    health.lastBenchmarkTime = Date.now();
                    _c.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function sortEndpointsByScore(endpoints, method, importance) {
    return (0, score_js_1.sortRpcEndpointsByScore)({
        endpoints: endpoints,
        method: method,
        importance: importance,
        now: Date.now(),
        getHealth: getEndpointHealthView,
        getUsage: getEndpointUsageView
    });
}
function maskEndpoint(url) {
    // Mask API keys in URLs for logging
    return url.replace(/[a-zA-Z0-9]{32,}/g, '***');
}
function shouldUpgradeToFast(endpoints, method, importance) {
    return (0, policy_js_1.shouldUpgradeRpcStrategy)({
        endpoints: endpoints,
        getHealth: getEndpointHealthView,
        getUsage: getEndpointUsageView,
        method: method,
        importance: importance
    }).upgrade;
}
/**
 * Get native balance (ETH, BNB, SOL, etc.)
 */
function getNativeBalance(address_1, chainIdOrName_1) {
    return __awaiter(this, arguments, void 0, function (address, chainIdOrName, blockTag, options) {
        var chainName, result, chainId, cached, value;
        if (blockTag === void 0) { blockTag = 'latest'; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainName = typeof chainIdOrName === 'number'
                        ? CHAIN_ID_TO_NAME[chainIdOrName]
                        : chainIdOrName;
                    if (!(chainName === 'solana')) return [3 /*break*/, 2];
                    return [4 /*yield*/, callRpc('solana', 'getBalance', [address], { purpose: 'interactive_read' })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.value.toString()];
                case 2:
                    chainId = typeof chainIdOrName === 'number' ? chainIdOrName : CHAIN_NAME_TO_ID[String(chainName).toLowerCase()];
                    if (!chainId) return [3 /*break*/, 4];
                    cached = (0, snapshotStore_js_1.getNativeBalanceSnapshot)(chainId, address, blockTag);
                    if (cached !== null)
                        return [2 /*return*/, cached];
                    return [4 /*yield*/, callRpc(chainIdOrName, 'eth_getBalance', [address, blockTag], { lane: options.lane, purpose: 'interactive_read' })];
                case 3:
                    value = _a.sent();
                    return [2 /*return*/, (0, snapshotStore_js_1.setNativeBalanceSnapshot)(chainId, address, blockTag, value)];
                case 4: return [4 /*yield*/, callRpc(chainIdOrName, 'eth_getBalance', [address, blockTag], { lane: options.lane, purpose: 'interactive_read' })];
                case 5: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get ERC20 balance via eth_call with RPC failover
 */
function getErc20Balance(tokenAddress_1, ownerAddress_1, chainIdOrName_1) {
    return __awaiter(this, arguments, void 0, function (tokenAddress, ownerAddress, chainIdOrName, blockTag, options) {
        var chainId, cached;
        var _this = this;
        if (blockTag === void 0) { blockTag = 'latest'; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainId = typeof chainIdOrName === 'number'
                        ? chainIdOrName
                        : CHAIN_NAME_TO_ID[String(chainIdOrName).toLowerCase()];
                    if (chainId) {
                        cached = (0, snapshotStore_js_1.getErc20BalanceSnapshot)(chainId, tokenAddress, ownerAddress, blockTag);
                        if (cached !== null)
                            return [2 /*return*/, cached];
                    }
                    return [4 /*yield*/, (0, readBudget_js_1.withRpcReadBudget)({
                            scope: 'rpc_read_erc20_balance',
                            parts: [chainIdOrName, tokenAddress.toLowerCase(), ownerAddress.toLowerCase(), blockTag],
                            successTtlMs: RPC_ERC20_BALANCE_SUCCESS_TTL_MS,
                            failureCooldownMs: RPC_ERC20_BALANCE_FAILURE_COOLDOWN_MS,
                            producer: function () { return __awaiter(_this, void 0, void 0, function () {
                                var iface, data, result, balance, value;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            iface = new ethers_1.ethers.Interface(['function balanceOf(address) view returns (uint256)']);
                                            data = iface.encodeFunctionData('balanceOf', [ownerAddress]);
                                            return [4 /*yield*/, callRpc(chainIdOrName, 'eth_call', [{
                                                        to: tokenAddress,
                                                        data: data
                                                    }, blockTag], { lane: options.lane, purpose: 'interactive_read' })];
                                        case 1:
                                            result = _a.sent();
                                            if (!result || result === '0x')
                                                return [2 /*return*/, 0n];
                                            balance = iface.decodeFunctionResult('balanceOf', result)[0];
                                            value = BigInt(balance);
                                            if (chainId)
                                                return [2 /*return*/, (0, snapshotStore_js_1.setErc20BalanceSnapshot)(chainId, tokenAddress, ownerAddress, blockTag, value)];
                                            return [2 /*return*/, value];
                                    }
                                });
                            }); }
                        })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get ERC20 decimals via eth_call with RPC failover
 */
function getErc20Decimals(tokenAddress_1, chainIdOrName_1) {
    return __awaiter(this, arguments, void 0, function (tokenAddress, chainIdOrName, blockTag, options) {
        var _this = this;
        if (blockTag === void 0) { blockTag = 'latest'; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, readBudget_js_1.withRpcReadBudget)({
                        scope: 'rpc_read_erc20_decimals',
                        parts: [chainIdOrName, tokenAddress.toLowerCase(), blockTag],
                        successTtlMs: RPC_ERC20_DECIMALS_SUCCESS_TTL_MS,
                        failureCooldownMs: RPC_ERC20_DECIMALS_FAILURE_COOLDOWN_MS,
                        producer: function () { return __awaiter(_this, void 0, void 0, function () {
                            var iface, data, result, decimals;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        iface = new ethers_1.ethers.Interface(['function decimals() view returns (uint8)']);
                                        data = iface.encodeFunctionData('decimals', []);
                                        return [4 /*yield*/, callRpc(chainIdOrName, 'eth_call', [{
                                                    to: tokenAddress,
                                                    data: data
                                                }, blockTag], { lane: options.lane, purpose: 'interactive_read' })];
                                    case 1:
                                        result = _a.sent();
                                        if (!result || result === '0x')
                                            return [2 /*return*/, 18];
                                        decimals = iface.decodeFunctionResult('decimals', result)[0];
                                        return [2 /*return*/, Number(decimals)];
                                }
                            });
                        }); }
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get ERC20 allowance via eth_call with RPC failover
 */
function getErc20Allowance(tokenAddress_1, ownerAddress_1, spenderAddress_1, chainIdOrName_1) {
    return __awaiter(this, arguments, void 0, function (tokenAddress, ownerAddress, spenderAddress, chainIdOrName, blockTag, options) {
        var chainId, cached, iface, data, result, allowance, value;
        if (blockTag === void 0) { blockTag = 'latest'; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainId = typeof chainIdOrName === 'number'
                        ? chainIdOrName
                        : CHAIN_NAME_TO_ID[String(chainIdOrName).toLowerCase()];
                    if (chainId && !options.bypassCache) {
                        cached = (0, snapshotStore_js_1.getErc20AllowanceSnapshot)(chainId, tokenAddress, ownerAddress, spenderAddress, blockTag);
                        if (cached !== null)
                            return [2 /*return*/, cached];
                    }
                    iface = new ethers_1.ethers.Interface(['function allowance(address owner, address spender) view returns (uint256)']);
                    data = iface.encodeFunctionData('allowance', [ownerAddress, spenderAddress]);
                    return [4 /*yield*/, callRpc(chainIdOrName, 'eth_call', [{
                                to: tokenAddress,
                                data: data
                            }, blockTag], { lane: options.lane, purpose: 'interactive_read' })];
                case 1:
                    result = _a.sent();
                    if (!result || result === '0x')
                        return [2 /*return*/, 0n];
                    allowance = iface.decodeFunctionResult('allowance', result)[0];
                    value = BigInt(allowance);
                    if (chainId && !options.bypassCache)
                        return [2 /*return*/, (0, snapshotStore_js_1.setErc20AllowanceSnapshot)(chainId, tokenAddress, ownerAddress, spenderAddress, blockTag, value)];
                    return [2 /*return*/, value];
            }
        });
    });
}
/**
 * Get current block number
 */
function getBlockNumber(chainIdOrName) {
    return __awaiter(this, void 0, void 0, function () {
        var chainName, result, hex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainName = typeof chainIdOrName === 'number'
                        ? CHAIN_ID_TO_NAME[chainIdOrName]
                        : chainIdOrName;
                    if (!(chainName === 'solana')) return [3 /*break*/, 2];
                    return [4 /*yield*/, callRpc(chainName, 'getSlot', [], { purpose: 'interactive_read' })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result];
                case 2: return [4 /*yield*/, callRpc(chainIdOrName, 'eth_blockNumber', [], { purpose: 'interactive_read' })];
                case 3:
                    hex = _a.sent();
                    return [2 /*return*/, parseInt(hex, 16)];
            }
        });
    });
}
/**
 * Get block by number
 */
function getBlockByNumber(chainId_1, blockNumber_1) {
    return __awaiter(this, arguments, void 0, function (chainId, blockNumber, fullTransactions) {
        var blockHex;
        if (fullTransactions === void 0) { fullTransactions = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    blockHex = typeof blockNumber === 'number'
                        ? '0x' + blockNumber.toString(16)
                        : blockNumber;
                    return [4 /*yield*/, callRpc(chainId, 'eth_getBlockByNumber', [blockHex, fullTransactions], { purpose: 'interactive_read' })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get transaction by hash
 */
function getTransactionByHash(chainId, txHash) {
    return __awaiter(this, void 0, void 0, function () {
        var config, observed;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = (0, chainConfig_js_1.getChainConfig)(chainId);
                    if (!(config.name === 'Solana')) return [3 /*break*/, 2];
                    return [4 /*yield*/, callRpc(chainId, 'getTransaction', [
                            txHash,
                            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
                        ], { purpose: 'tx_visibility' })];
                case 1: return [2 /*return*/, _a.sent()];
                case 2: return [4 /*yield*/, (0, confirmScheduler_js_1.getSharedTxObservation)({
                        chainId: chainId,
                        txHash: txHash,
                        scope: 'tx',
                        producer: function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = {};
                                        return [4 /*yield*/, callRpc(chainId, 'eth_getTransactionByHash', [txHash], { purpose: 'tx_visibility', lane: 'critical' }).catch(function () { return null; })];
                                    case 1: return [2 /*return*/, (_a.tx = _b.sent(),
                                            _a.receipt = null,
                                            _a.observedAt = Date.now(),
                                            _a)];
                                }
                            });
                        }); }
                    })];
                case 3:
                    observed = _a.sent();
                    return [2 /*return*/, observed.tx];
            }
        });
    });
}
/**
 * Get transaction receipt
 */
function getTransactionReceipt(chainId, txHash) {
    return __awaiter(this, void 0, void 0, function () {
        var observed;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, confirmScheduler_js_1.getSharedTxObservation)({
                        chainId: chainId,
                        txHash: txHash,
                        scope: 'receipt',
                        producer: function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = {
                                            tx: null
                                        };
                                        return [4 /*yield*/, callRpc(chainId, 'eth_getTransactionReceipt', [txHash], { purpose: 'tx_visibility', lane: 'critical' }).catch(function () { return null; })];
                                    case 1: return [2 /*return*/, (_a.receipt = _b.sent(),
                                            _a.observedAt = Date.now(),
                                            _a)];
                                }
                            });
                        }); }
                    })];
                case 1:
                    observed = _a.sent();
                    return [2 /*return*/, observed.receipt];
            }
        });
    });
}
/**
 * Get current gas price in wei
 */
function getGasPrice(chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var config, hex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    config = (0, chainConfig_js_1.getChainConfig)(chainId);
                    if (!(config.name === 'Solana')) return [3 /*break*/, 1];
                    return [2 /*return*/, '0'];
                case 1: return [4 /*yield*/, callRpc(chainId, 'eth_gasPrice', [], { purpose: 'tx_visibility' })];
                case 2:
                    hex = _a.sent();
                    return [2 /*return*/, parseInt(hex, 16).toString()];
            }
        });
    });
}
var RpcManager = /** @class */ (function () {
    function RpcManager() {
    }
    /**
     * Call a single RPC method
     */
    RpcManager.prototype.callRpc = function (chain_1, method_1) {
        return __awaiter(this, arguments, void 0, function (chain, method, params) {
            var chainName;
            if (params === void 0) { params = []; }
            return __generator(this, function (_a) {
                chainName = typeof chain === 'string' ? chain : (CHAIN_ID_TO_NAME[chain] || 'eth');
                return [2 /*return*/, (0, unifiedApiService_js_1.callRpc)(chainName, method, params)];
            });
        });
    };
    /**
     * Call multiple RPC methods in a single batch request
     */
    RpcManager.prototype.callRpcBatch = function (chain, requests) {
        return __awaiter(this, void 0, void 0, function () {
            var chainId, endpoints, payload, lastError, i, url, results, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!Array.isArray(requests) || requests.length === 0) {
                            return [2 /*return*/, []];
                        }
                        chainId = typeof chain === 'string' ? (CHAIN_NAME_TO_ID[chain] || 1) : chain;
                        endpoints = getRpcEndpoints(chainId, 'cheap');
                        if (endpoints.length === 0) {
                            throw new Error("No RPC endpoints configured for chain ".concat(chainId));
                        }
                        payload = requests.map(function (req) { return ({
                            jsonrpc: '2.0',
                            id: req.id,
                            method: req.method,
                            params: req.params
                        }); });
                        lastError = null;
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < endpoints.length)) return [3 /*break*/, 8];
                        url = endpoints[i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 7]);
                        return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                                url: url,
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(payload),
                                requestTimeout: RPC_TIMEOUT_MS,
                                endpointName: "rpc-batch-".concat(chainId)
                            })];
                    case 3:
                        results = _a.sent();
                        if (i > 0) {
                            logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'Batch RPC failover success', {
                                chain: chainId,
                                endpointAttempt: i + 1,
                                totalEndpoints: endpoints.length,
                                batchSize: requests.length
                            });
                        }
                        return [2 /*return*/, results];
                    case 4:
                        error_5 = _a.sent();
                        lastError = error_5 instanceof Error ? error_5 : new Error(String(error_5));
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Batch RPC endpoint failed', {
                            chain: chainId,
                            endpointAttempt: i + 1,
                            totalEndpoints: endpoints.length,
                            batchSize: requests.length,
                            error: lastError.message
                        });
                        if (!(i < endpoints.length - 1)) return [3 /*break*/, 6];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [3 /*break*/, 7];
                    case 7:
                        i++;
                        return [3 /*break*/, 1];
                    case 8:
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Batch RPC call failed on all endpoints', {
                            chain: chainId,
                            error: (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error',
                            batchSize: requests.length
                        });
                        return [2 /*return*/, requests.map(function (req) { return ({
                                id: req.id,
                                error: { code: -32603, message: "Batch failed: ".concat((lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'unknown error') }
                            }); })];
                }
            });
        });
    };
    return RpcManager;
}());
exports.rpcManager = new RpcManager();
var ethers_1 = require("ethers");
/**
 * Get available RPC endpoints for a chain
 */
function getRpcEndpoints(chainId, strategy) {
    try {
        if (strategy) {
            var chainSlug_1 = CHAIN_ID_TO_NAME[chainId] || 'eth';
            var primaryUrl_1 = getPrimaryRpcUrl(chainSlug_1);
            return (0, apiEndpoints_js_1.getRpcEndpointsWithStrategy)(chainSlug_1, strategy, primaryUrl_1).map(function (e) { return e.url; });
        }
        var chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
        var primaryUrl = getPrimaryRpcUrl(chainSlug);
        return (0, apiEndpoints_js_1.getRpcEndpointsWithStrategy)(chainSlug, 'cheap', primaryUrl).map(function (e) { return e.url; });
    }
    catch (_a) {
        return [];
    }
}
// Cache providers to avoid creating new instances for every call (memory optimization)
// Key: chainId, Value: { provider: JsonRpcProvider, url: string, timestamp: number }
var providerCache = new Map();
var PROVIDER_CACHE_TTL = 60000; // Refresh provider mapping every 1 minute
var SOLANA_CONN_CACHE = new Map();
var SOLANA_CONN_CACHE_TTL = Math.max(1000, Number(process.env.SOLANA_CONN_CACHE_TTL_MS || '15000'));
var SOLANA_MANAGED_CONNECTION_MARKER = '__kiko_managed_solana_rpc';
function normalizeSolanaRpcArgs(args) {
    return Array.isArray(args) ? args : [];
}
function normalizeSolanaRpcResponse(response) {
    var _a;
    if (!response || typeof response !== 'object') {
        return response;
    }
    var maybeResponse = response;
    if (!Object.prototype.hasOwnProperty.call(maybeResponse, 'id')) {
        return response;
    }
    if (typeof maybeResponse.id === 'string') {
        return response;
    }
    return __assign(__assign({}, maybeResponse), { id: String((_a = maybeResponse.id) !== null && _a !== void 0 ? _a : '') });
}
function buildSolanaRpcPath(method) {
    var safeMethod = String(method || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
    return "solana_connection_".concat(safeMethod);
}
function patchSolanaConnectionRpc(connection, strategy, importance) {
    var _this = this;
    var managedConnection = connection;
    var markerValue = "".concat(strategy, ":").concat(importance);
    if (managedConnection[SOLANA_MANAGED_CONNECTION_MARKER] === markerValue) {
        return managedConnection;
    }
    managedConnection._rpcRequest = function (method, args) { return __awaiter(_this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, callRpcRaw('solana', method, normalizeSolanaRpcArgs(args), {
                        strategy: strategy,
                        importance: importance,
                        path: buildSolanaRpcPath(method),
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, normalizeSolanaRpcResponse(response)];
            }
        });
    }); };
    managedConnection._rpcBatchRequest = function (requests) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!Array.isArray(requests) || requests.length === 0) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, Promise.all(requests.map(function (request) {
                            return managedConnection._rpcRequest(String((request === null || request === void 0 ? void 0 : request.methodName) || ''), normalizeSolanaRpcArgs(request === null || request === void 0 ? void 0 : request.args));
                        }))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
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
function getEthersProvider(chainId, purpose) {
    var _a;
    if (purpose === void 0) { purpose = 'interactive_read'; }
    var chainSlug = CHAIN_ID_TO_NAME[chainId] || 'eth';
    var primaryUrl = getPrimaryRpcUrl(chainSlug);
    var purposeProfile = (0, purpose_js_1.getRpcPurposeProfile)(purpose);
    var endpoints = (0, apiEndpoints_js_1.getRpcEndpointsForLane)(chainSlug, purposeProfile.lane, primaryUrl);
    endpoints = filterEndpointsForPurpose(endpoints, purpose);
    if (endpoints.length === 0) {
        throw new Error("No RPC endpoints configured for chain ".concat(chainId));
    }
    var sorted = sortEndpointsByScore(endpoints, purpose === 'trade_execution' ? 'eth_sendRawTransaction' : 'eth_call', purposeProfile.importance);
    var bestUrl = (_a = sorted[0]) === null || _a === void 0 ? void 0 : _a.url;
    if (!bestUrl) {
        throw new Error("No RPC endpoints configured for chain ".concat(chainId));
    }
    var now = Date.now();
    var cacheKey = "".concat(chainId, ":").concat(purpose);
    var cached = providerCache.get(cacheKey);
    // Return cached provider if valid and URL matches (and not too old)
    if (cached && cached.url === bestUrl && (now - cached.timestamp < PROVIDER_CACHE_TTL)) {
        return cached.provider;
    }
    // Create new provider
    var provider = new ethers_1.ethers.JsonRpcProvider(bestUrl, undefined, {
        staticNetwork: true // Optimization
    });
    providerCache.set(cacheKey, {
        provider: provider,
        url: bestUrl,
        timestamp: now
    });
    return provider;
}
/**
 * Get a Solana Connection instance using rpcManager selection
 */
function getSolanaConnection(strategy, importance) {
    if (strategy === void 0) { strategy = 'cheap'; }
    if (importance === void 0) { importance = 'normal'; }
    var chainSlug = 'solana';
    var primaryUrl = getPrimaryRpcUrl(chainSlug);
    var endpoints = (0, apiEndpoints_js_1.getRpcEndpointsWithStrategy)(chainSlug, strategy, primaryUrl);
    if (strategy === 'cheap' && shouldUpgradeToFast(endpoints, 'solana_connection', importance)) {
        var upgraded = (0, apiEndpoints_js_1.getRpcEndpointsWithStrategy)(chainSlug, 'fast', primaryUrl);
        if (upgraded.length > 0) {
            endpoints = upgraded;
        }
    }
    if (!endpoints || endpoints.length === 0) {
        throw new Error('No RPC endpoints configured for Solana');
    }
    var sorted = sortEndpointsByScore(endpoints, 'solana_connection', importance);
    var healthy = sorted.filter(function (ep) { return !isCircuitOpen(ep.url); });
    var candidates = healthy.length > 0 ? healthy : sorted;
    var chosen = candidates.find(function (ep) { return checkEndpointCapacity(ep, importance).ok; });
    if (!chosen && candidates.length > 0) {
        chosen = __spreadArray([], candidates, true).sort(function (a, b) { return endpointCapacityPressure(a) - endpointCapacityPressure(b); })[0];
        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, '[RPC][Solana] All endpoints at/near capacity, selecting lowest-pressure endpoint', {
            strategy: strategy,
            importance: importance,
            selected: chosen === null || chosen === void 0 ? void 0 : chosen.name,
            selectedEndpoint: maskEndpoint((chosen === null || chosen === void 0 ? void 0 : chosen.url) || ''),
        });
    }
    if (!chosen) {
        chosen = sorted[0];
    }
    var reserve = checkAndReserveCapacity(chosen, importance);
    if (!reserve.ok) {
        // Race-safe fallback: if selected endpoint just got saturated, pick another available candidate.
        var fallback = candidates.find(function (ep) { return ep.url !== chosen.url && checkAndReserveCapacity(ep, importance).ok; });
        if (fallback) {
            recordUsageEnd(fallback.url);
            chosen = fallback;
        }
        else {
            // keep current chosen connection selection, but do not keep stale inFlight reservations
            recordUsageEnd(chosen.url);
        }
    }
    else {
        // Connection selection should count towards rps/rpm, but not hold long-lived inFlight.
        recordUsageEnd(chosen.url);
    }
    var url = chosen.url;
    var cacheKey = "".concat(url, "|").concat(strategy, "|").concat(importance);
    var now = Date.now();
    var cached = SOLANA_CONN_CACHE.get(cacheKey);
    if (cached && now - cached.timestamp < SOLANA_CONN_CACHE_TTL) {
        return cached.connection;
    }
    var connection = patchSolanaConnectionRpc(new web3_js_1.Connection(url, 'confirmed'), strategy, importance);
    SOLANA_CONN_CACHE.set(cacheKey, { connection: connection, timestamp: now });
    return connection;
}
/**
 * Get RPC health stats (RPC-only)
 */
function getRpcHealthStats() {
    var stats = [];
    for (var _i = 0, _a = endpointHealth.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], url = _b[0], health = _b[1];
        var successRate = health.totalAttempts > 0
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
    return stats.sort(function (a, b) { return b.successRate - a.successRate; });
}
/**
 * Start periodic RPC health logging (only logs unhealthy endpoints)
 */
function startRpcHealthMonitor(intervalMs) {
    if (intervalMs === void 0) { intervalMs = 60000; }
    return setInterval(function () {
        var stats = getRpcHealthStats();
        var unhealthy = stats.filter(function (s) { return s.circuitOpen || s.successRate < 50; });
        if (unhealthy.length > 0) {
            logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, 'RPC health degraded', {
                endpoints: unhealthy.slice(0, 5)
            });
        }
    }, intervalMs);
}
/**
 * Start periodic RPC benchmark sampling (updates health metrics)
 */
function startRpcBenchmarkSampling(intervalMs, chainId, tokenAddress) {
    if (intervalMs === void 0) { intervalMs = BENCHMARK_INTERVAL_MS; }
    if (chainId === void 0) { chainId = BENCHMARK_CHAIN_ID; }
    if (tokenAddress === void 0) { tokenAddress = BENCHMARK_TOKEN_ADDRESS; }
    // Warm once immediately
    runBenchmarkSample(chainId, tokenAddress).catch(function () { return undefined; });
    return setInterval(function () {
        runBenchmarkSample(chainId, tokenAddress).catch(function () { return undefined; });
    }, intervalMs);
}
function getRpcMethodUsageSnapshot(chainId) {
    var out = {};
    for (var _i = 0, _a = rpcMethodUsage.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], row = _b[1];
        if (typeof chainId === 'number' && row.chainId !== chainId)
            continue;
        out[key] = __assign({}, row);
    }
    return out;
}
function diffRpcMethodUsageSnapshots(before, after) {
    var _a, _b, _c, _d, _e;
    var deltas = [];
    var keys = new Set(__spreadArray(__spreadArray([], Object.keys(before), true), Object.keys(after), true));
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var b = before[key];
        var a = after[key];
        if (!a && !b)
            continue;
        var chain = (_a = a === null || a === void 0 ? void 0 : a.chainId) !== null && _a !== void 0 ? _a : b.chainId;
        var method = (_b = a === null || a === void 0 ? void 0 : a.method) !== null && _b !== void 0 ? _b : b.method;
        var row = {
            chainId: chain,
            method: method,
            importance: (_c = a === null || a === void 0 ? void 0 : a.importance) !== null && _c !== void 0 ? _c : b.importance,
            rpcClass: (_d = a === null || a === void 0 ? void 0 : a.rpcClass) !== null && _d !== void 0 ? _d : b.rpcClass,
            path: (_e = a === null || a === void 0 ? void 0 : a.path) !== null && _e !== void 0 ? _e : b.path,
            requests: ((a === null || a === void 0 ? void 0 : a.requests) || 0) - ((b === null || b === void 0 ? void 0 : b.requests) || 0),
            endpointAttempts: ((a === null || a === void 0 ? void 0 : a.endpointAttempts) || 0) - ((b === null || b === void 0 ? void 0 : b.endpointAttempts) || 0),
            successes: ((a === null || a === void 0 ? void 0 : a.successes) || 0) - ((b === null || b === void 0 ? void 0 : b.successes) || 0),
            endpointFailures: ((a === null || a === void 0 ? void 0 : a.endpointFailures) || 0) - ((b === null || b === void 0 ? void 0 : b.endpointFailures) || 0),
            allFailed: ((a === null || a === void 0 ? void 0 : a.allFailed) || 0) - ((b === null || b === void 0 ? void 0 : b.allFailed) || 0),
            timeoutErrors: ((a === null || a === void 0 ? void 0 : a.timeoutErrors) || 0) - ((b === null || b === void 0 ? void 0 : b.timeoutErrors) || 0),
            latencyMsTotal: ((a === null || a === void 0 ? void 0 : a.latencyMsTotal) || 0) - ((b === null || b === void 0 ? void 0 : b.latencyMsTotal) || 0),
            lastLatencyMs: (a === null || a === void 0 ? void 0 : a.lastLatencyMs) || (b === null || b === void 0 ? void 0 : b.lastLatencyMs) || 0,
            updatedAt: (a === null || a === void 0 ? void 0 : a.updatedAt) || b.updatedAt
        };
        if (row.requests <= 0 &&
            row.endpointAttempts <= 0 &&
            row.successes <= 0 &&
            row.endpointFailures <= 0 &&
            row.allFailed <= 0 &&
            row.timeoutErrors <= 0 &&
            row.latencyMsTotal <= 0) {
            continue;
        }
        deltas.push(row);
    }
    deltas.sort(function (x, y) { return y.endpointAttempts - x.endpointAttempts; });
    return deltas;
}
function getUsageSnapshot(chainId) {
    var methods = getRpcMethodUsageSnapshot(chainId);
    var endpoints = Array.from(endpointUsage.values()).map(function (usage) { return ({
        url: maskEndpoint(usage.url),
        inFlight: usage.inFlight,
        secondCount: usage.secondCount,
        minuteCount: usage.minuteCount,
        lastUsedAt: usage.lastUsedAt
    }); });
    return {
        timestamp: Date.now(),
        methods: methods,
        inflightPools: {
            critical_tx: rpcPoolInflight.critical_tx,
            best_effort_read: rpcPoolInflight.best_effort_read
        },
        endpoints: endpoints
    };
}
function probeTxVisibility(params) {
    return __awaiter(this, void 0, void 0, function () {
        var releaseCriticalWindow, finalState, cached, degrade, retries, delayMs_1, expectedFrom, lastError_2, visibleHits, i, observation, tx, from, stableVisible, out_1, out_2, err_1, out;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    releaseCriticalWindow = (0, backgroundBudget_js_1.beginCriticalRpcWindow)("probe_visibility:".concat(params.chainId, ":").concat(params.txHash.toLowerCase()));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 15, 16]);
                    finalState = (0, finalState_js_1.resolveTxFinalState)({
                        chainId: params.chainId,
                        txHash: params.txHash
                    });
                    if (finalState.visible || finalState.success) {
                        return [2 /*return*/, {
                                visible: true,
                                checks: 0,
                                lastError: finalState.reasonCode
                            }];
                    }
                    if (finalState.failed) {
                        return [2 /*return*/, {
                                visible: false,
                                checks: 0,
                                lastError: finalState.reasonCode || 'cached_tx_failed'
                            }];
                    }
                    cached = getTxLifecycleState(params.chainId, params.txHash);
                    if (cached) {
                        if (cached.status === 'confirmed_success' || cached.status === 'confirmed_failed' || cached.status === 'visible_pending') {
                            return [2 /*return*/, {
                                    visible: true,
                                    checks: 0,
                                    lastError: cached.lastRpcError
                                }];
                        }
                        if (cached.status === 'dropped_timeout' || cached.status === 'send_failed') {
                            return [2 /*return*/, {
                                    visible: false,
                                    checks: 0,
                                    lastError: cached.lastRpcError || 'cached_tx_unseen'
                                }];
                        }
                    }
                    degrade = getChainRpcDegradeState(params.chainId);
                    if (degrade.degraded && cached && cached.status === 'broadcasted_unseen') {
                        return [2 /*return*/, {
                                visible: false,
                                checks: 0,
                                lastError: degrade.lastError || cached.lastRpcError || 'chain_rpc_degraded'
                            }];
                    }
                    retries = Math.max(1, Number(params.retries || 6));
                    delayMs_1 = Math.max(0, Number((_a = params.delayMs) !== null && _a !== void 0 ? _a : 400));
                    expectedFrom = String(params.expectedFrom || '').toLowerCase();
                    lastError_2 = '';
                    visibleHits = 0;
                    i = 1;
                    _b.label = 2;
                case 2:
                    if (!(i <= retries)) return [3 /*break*/, 14];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 10, , 11]);
                    return [4 /*yield*/, (0, confirmScheduler_js_1.getSharedTxObservation)({
                            chainId: params.chainId,
                            txHash: params.txHash,
                            scope: 'tx',
                            producer: function () { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _a = {};
                                            return [4 /*yield*/, callRpc(params.chainId, 'eth_getTransactionByHash', [params.txHash], { purpose: 'tx_visibility' }).catch(function () { return null; })];
                                        case 1: return [2 /*return*/, (_a.tx = _b.sent(),
                                                _a.receipt = null,
                                                _a.observedAt = Date.now(),
                                                _a.lastRpcError = lastError_2 || undefined,
                                                _a)];
                                    }
                                });
                            }); }
                        })];
                case 4:
                    observation = _b.sent();
                    tx = observation.tx;
                    if (!(tx === null || tx === void 0 ? void 0 : tx.hash)) return [3 /*break*/, 9];
                    from = String(tx.from || '').toLowerCase();
                    if (!(!expectedFrom || from === expectedFrom)) return [3 /*break*/, 8];
                    visibleHits += 1;
                    stableVisible = visibleHits >= 2 || retries <= 1;
                    if (!(!stableVisible && i < retries)) return [3 /*break*/, 7];
                    if (!(delayMs_1 > 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delayMs_1); })];
                case 5:
                    _b.sent();
                    _b.label = 6;
                case 6: return [3 /*break*/, 13];
                case 7:
                    out_1 = {
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
                    return [2 /*return*/, out_1];
                case 8:
                    out_2 = {
                        visible: false,
                        checks: i,
                        from: tx.from,
                        nonce: tx.nonce,
                        blockNumber: tx.blockNumber,
                        lastError: "from_mismatch expected=".concat(params.expectedFrom, " got=").concat(tx.from)
                    };
                    recordTxLifecycleState({
                        chainId: params.chainId,
                        txHash: params.txHash,
                        status: 'broadcasted_unseen',
                        attempts: i,
                        lastRpcError: out_2.lastError,
                        source: 'probe_visibility'
                    });
                    return [2 /*return*/, out_2];
                case 9: return [3 /*break*/, 11];
                case 10:
                    err_1 = _b.sent();
                    lastError_2 = (err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || String(err_1);
                    return [3 /*break*/, 11];
                case 11:
                    if (!(i < retries)) return [3 /*break*/, 13];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delayMs_1); })];
                case 12:
                    _b.sent();
                    _b.label = 13;
                case 13:
                    i++;
                    return [3 /*break*/, 2];
                case 14:
                    out = {
                        visible: false,
                        checks: retries,
                        lastError: lastError_2 || 'not_found_by_rpc'
                    };
                    recordTxLifecycleState({
                        chainId: params.chainId,
                        txHash: params.txHash,
                        status: 'broadcasted_unseen',
                        attempts: retries,
                        lastRpcError: out.lastError,
                        source: 'probe_visibility'
                    });
                    return [2 /*return*/, out];
                case 15:
                    releaseCriticalWindow();
                    return [7 /*endfinally*/];
                case 16: return [2 /*return*/];
            }
        });
    });
}
function waitForReceiptStateMachine(params) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, confirmScheduler_js_1.waitForSharedTxConfirmation)({
                        chainId: params.chainId,
                        txHash: params.txHash,
                        producer: function () { return __awaiter(_this, void 0, void 0, function () {
                            var releaseCriticalWindow, finalState, cached, startedAt, maxWaitMs, pollMs_1, expectedFrom, attempts, firstSeenAt, lastRpcError, visibilityHits, degrade, observation, tx, receipt, seenFrom, statusHex, status_1, out_3, out_4, err_2, out;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        releaseCriticalWindow = (0, backgroundBudget_js_1.beginCriticalRpcWindow)("confirm_wait:".concat(params.chainId, ":").concat(params.txHash.toLowerCase()));
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, , 9, 10]);
                                        finalState = (0, finalState_js_1.resolveTxFinalState)({
                                            chainId: params.chainId,
                                            txHash: params.txHash
                                        });
                                        if (finalState.terminal || finalState.visible) {
                                            return [2 /*return*/, (0, finalState_js_1.toLifecycleResultFromFinalState)({
                                                    chainId: params.chainId,
                                                    txHash: params.txHash,
                                                    resolution: finalState
                                                })];
                                        }
                                        cached = getTxLifecycleState(params.chainId, params.txHash);
                                        if (cached && (cached.status === 'confirmed_success'
                                            || cached.status === 'confirmed_failed'
                                            || cached.status === 'visible_pending'
                                            || cached.status === 'dropped_timeout')) {
                                            return [2 /*return*/, {
                                                    status: cached.status,
                                                    txHash: params.txHash,
                                                    firstSeenAt: cached.firstSeenAt,
                                                    confirmedAt: cached.confirmedAt,
                                                    lastRpcError: cached.lastRpcError,
                                                    attempts: cached.attempts || 0,
                                                    chainId: params.chainId
                                                }];
                                        }
                                        startedAt = Date.now();
                                        maxWaitMs = Math.max(200, Number(params.maxWaitMs || 12000));
                                        pollMs_1 = Math.max(120, Number(params.pollMs || 500));
                                        expectedFrom = String(params.expectedFrom || '').toLowerCase();
                                        attempts = 0;
                                        firstSeenAt = void 0;
                                        lastRpcError = '';
                                        visibilityHits = 0;
                                        _a.label = 2;
                                    case 2:
                                        if (!(Date.now() - startedAt < maxWaitMs)) return [3 /*break*/, 8];
                                        degrade = getChainRpcDegradeState(params.chainId);
                                        if (degrade.degraded && !firstSeenAt) {
                                            (0, service_js_1.reportRpcUncertain)({
                                                chainId: params.chainId,
                                                txHash: params.txHash,
                                                error: degrade.lastError || 'chain_rpc_degraded'
                                            });
                                            return [2 /*return*/, {
                                                    status: 'dropped_timeout',
                                                    txHash: params.txHash,
                                                    firstSeenAt: firstSeenAt,
                                                    lastRpcError: degrade.lastError || 'chain_rpc_degraded',
                                                    attempts: attempts,
                                                    chainId: params.chainId
                                                }];
                                        }
                                        attempts += 1;
                                        _a.label = 3;
                                    case 3:
                                        _a.trys.push([3, 5, , 6]);
                                        return [4 /*yield*/, (0, confirmScheduler_js_1.getSharedTxObservation)({
                                                chainId: params.chainId,
                                                txHash: params.txHash,
                                                scope: 'combined',
                                                producer: function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var observationError, _a, tx, receipt;
                                                    return __generator(this, function (_b) {
                                                        switch (_b.label) {
                                                            case 0:
                                                                observationError = '';
                                                                return [4 /*yield*/, Promise.all([
                                                                        callRpc(params.chainId, 'eth_getTransactionByHash', [params.txHash], { purpose: 'tx_visibility', path: 'confirm_wait' }).catch(function (err) {
                                                                            observationError = (err === null || err === void 0 ? void 0 : err.message) || String(err);
                                                                            return null;
                                                                        }),
                                                                        callRpc(params.chainId, 'eth_getTransactionReceipt', [params.txHash], { purpose: 'tx_visibility', path: 'confirm_wait' }).catch(function (err) {
                                                                            observationError = (err === null || err === void 0 ? void 0 : err.message) || String(err);
                                                                            return null;
                                                                        })
                                                                    ])];
                                                            case 1:
                                                                _a = _b.sent(), tx = _a[0], receipt = _a[1];
                                                                return [2 /*return*/, {
                                                                        tx: tx,
                                                                        receipt: receipt,
                                                                        observedAt: Date.now(),
                                                                        lastRpcError: observationError || undefined
                                                                    }];
                                                        }
                                                    });
                                                }); }
                                            })];
                                    case 4:
                                        observation = _a.sent();
                                        tx = observation.tx;
                                        receipt = observation.receipt;
                                        if (observation.lastRpcError)
                                            lastRpcError = observation.lastRpcError;
                                        if (tx === null || tx === void 0 ? void 0 : tx.hash) {
                                            seenFrom = String(tx.from || '').toLowerCase();
                                            if (!expectedFrom || seenFrom === expectedFrom) {
                                                firstSeenAt = firstSeenAt || Date.now();
                                                visibilityHits += 1;
                                                (0, service_js_1.reportTxByHashSeen)({
                                                    chainId: params.chainId,
                                                    txHash: params.txHash,
                                                    from: tx.from || undefined,
                                                    blockNumber: tx.blockNumber || undefined,
                                                    rpcError: lastRpcError || undefined,
                                                    source: 'rpc_tx'
                                                });
                                            }
                                            else {
                                                visibilityHits = 0;
                                                lastRpcError = "from_mismatch expected=".concat(params.expectedFrom, " got=").concat(tx.from);
                                            }
                                        }
                                        else {
                                            visibilityHits = 0;
                                        }
                                        if (receipt === null || receipt === void 0 ? void 0 : receipt.transactionHash) {
                                            statusHex = String(receipt.status || '');
                                            status_1 = statusHex === '0x1' || statusHex === '1' ? 'confirmed_success' : 'confirmed_failed';
                                            (0, service_js_1.reportReceiptSeen)({
                                                chainId: params.chainId,
                                                txHash: params.txHash,
                                                success: status_1 === 'confirmed_success',
                                                blockNumber: receipt.blockNumber || undefined,
                                                rpcError: lastRpcError || undefined,
                                                source: 'rpc_receipt'
                                            });
                                            out_3 = {
                                                status: status_1,
                                                txHash: params.txHash,
                                                firstSeenAt: firstSeenAt,
                                                confirmedAt: Date.now(),
                                                lastRpcError: status_1 === 'confirmed_failed' ? (lastRpcError || 'receipt_status_0') : lastRpcError || undefined,
                                                attempts: attempts,
                                                chainId: params.chainId
                                            };
                                            recordTxLifecycleState({
                                                chainId: params.chainId,
                                                txHash: params.txHash,
                                                status: out_3.status,
                                                firstSeenAt: out_3.firstSeenAt,
                                                confirmedAt: out_3.confirmedAt,
                                                attempts: out_3.attempts,
                                                lastRpcError: out_3.lastRpcError,
                                                source: 'wait_for_receipt'
                                            });
                                            return [2 /*return*/, out_3];
                                        }
                                        if (firstSeenAt && visibilityHits >= 2) {
                                            out_4 = {
                                                status: 'visible_pending',
                                                txHash: params.txHash,
                                                firstSeenAt: firstSeenAt,
                                                lastRpcError: lastRpcError || undefined,
                                                attempts: attempts,
                                                chainId: params.chainId
                                            };
                                            recordTxLifecycleState({
                                                chainId: params.chainId,
                                                txHash: params.txHash,
                                                status: out_4.status,
                                                firstSeenAt: out_4.firstSeenAt,
                                                attempts: out_4.attempts,
                                                lastRpcError: out_4.lastRpcError,
                                                source: 'wait_for_receipt'
                                            });
                                            return [2 /*return*/, out_4];
                                        }
                                        return [3 /*break*/, 6];
                                    case 5:
                                        err_2 = _a.sent();
                                        lastRpcError = (err_2 === null || err_2 === void 0 ? void 0 : err_2.message) || String(err_2);
                                        return [3 /*break*/, 6];
                                    case 6: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, pollMs_1); })];
                                    case 7:
                                        _a.sent();
                                        return [3 /*break*/, 2];
                                    case 8:
                                        out = {
                                            status: firstSeenAt ? 'visible_pending' : 'dropped_timeout',
                                            txHash: params.txHash,
                                            firstSeenAt: firstSeenAt,
                                            lastRpcError: lastRpcError || 'wait_timeout',
                                            attempts: attempts,
                                            chainId: params.chainId
                                        };
                                        if (!firstSeenAt) {
                                            (0, service_js_1.reportRpcUncertain)({
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
                                        return [2 /*return*/, out];
                                    case 9:
                                        releaseCriticalWindow();
                                        return [7 /*endfinally*/];
                                    case 10: return [2 /*return*/];
                                }
                            });
                        }); }
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function broadcastRawWithQuorum(params) {
    return __awaiter(this, void 0, void 0, function () {
        var releaseCriticalWindow, txHash, out_5, out_6, visibility, out_7, out;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    releaseCriticalWindow = (0, backgroundBudget_js_1.beginCriticalRpcWindow)("broadcast_raw:".concat(params.chainId));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 4, 5]);
                    return [4 /*yield*/, callRpc(params.chainId, 'eth_sendRawTransaction', [params.signedRawTransaction], {
                            purpose: 'trade_execution',
                            sendRawFanout: true,
                            bypassRawTxCache: params.bypassRawTxCache === true
                        })];
                case 2:
                    txHash = _a.sent();
                    if (!txHash) {
                        out_5 = {
                            status: 'dropped_timeout',
                            lastRpcError: 'eth_sendRawTransaction_empty_hash',
                            attempts: 1,
                            chainId: params.chainId
                        };
                        return [2 /*return*/, out_5];
                    }
                    (0, service_js_1.reportSendAccepted)({
                        chainId: params.chainId,
                        txHash: txHash,
                        source: 'raw_broadcast'
                    });
                    if (params.skipSyncVisibility === true) {
                        out_6 = {
                            status: 'broadcasted_unseen',
                            txHash: txHash,
                            attempts: 1,
                            chainId: params.chainId
                        };
                        recordTxLifecycleState({
                            chainId: params.chainId,
                            txHash: txHash,
                            status: out_6.status,
                            attempts: out_6.attempts,
                            source: 'broadcast_raw'
                        });
                        return [2 /*return*/, out_6];
                    }
                    return [4 /*yield*/, probeTxVisibility({
                            chainId: params.chainId,
                            txHash: txHash,
                            expectedFrom: params.expectedFrom,
                            retries: params.syncVisibilityRetries,
                            delayMs: params.syncVisibilityDelayMs
                        })];
                case 3:
                    visibility = _a.sent();
                    if (visibility.visible) {
                        (0, service_js_1.reportTxByHashSeen)({
                            chainId: params.chainId,
                            txHash: txHash,
                            source: 'rpc_tx'
                        });
                        out_7 = {
                            status: 'visible_pending',
                            txHash: txHash,
                            firstSeenAt: Date.now(),
                            attempts: visibility.checks,
                            chainId: params.chainId
                        };
                        recordTxLifecycleState({
                            chainId: params.chainId,
                            txHash: txHash,
                            status: out_7.status,
                            firstSeenAt: out_7.firstSeenAt,
                            attempts: out_7.attempts,
                            source: 'broadcast_raw'
                        });
                        return [2 /*return*/, out_7];
                    }
                    out = {
                        status: 'broadcasted_unseen',
                        txHash: txHash,
                        lastRpcError: visibility.lastError || 'not_found_by_rpc',
                        attempts: visibility.checks,
                        chainId: params.chainId
                    };
                    (0, service_js_1.reportRpcUncertain)({
                        chainId: params.chainId,
                        txHash: txHash,
                        error: out.lastRpcError || 'not_found_by_rpc'
                    });
                    recordTxLifecycleState({
                        chainId: params.chainId,
                        txHash: txHash,
                        status: out.status,
                        attempts: out.attempts,
                        lastRpcError: out.lastRpcError,
                        source: 'broadcast_raw'
                    });
                    return [2 /*return*/, out];
                case 4:
                    releaseCriticalWindow();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.__rpcManagerTest = {
    createStableRequestKey: createStableRequestKey,
    tryGetRawTxHash: tryGetRawTxHash,
    shouldTreatSendRawErrorAsKnown: shouldTreatSendRawErrorAsKnown,
    filterEndpointsForPurpose: filterEndpointsForPurpose,
    countSelectedFreeEndpoints: countSelectedFreeEndpoints,
    getEndpointAttemptBudget: getEndpointAttemptBudget,
    getMethodConcurrencyLimit: getMethodConcurrencyLimit,
    expandCriticalSelectionWithPublicFallback: expandCriticalSelectionWithPublicFallback,
    getMethodBackoff: function (chainId, method, executionLane, importance, rpcClass) {
        if (executionLane === void 0) { executionLane = 'cheap'; }
        if (importance === void 0) { importance = 'normal'; }
        if (rpcClass === void 0) { rpcClass = 'best_effort_read'; }
        return getMethodBackoffState(buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass));
    },
    markMethodFailureForTest: function (chainId, method, executionLane, importance, rpcClass) {
        if (executionLane === void 0) { executionLane = 'cheap'; }
        if (importance === void 0) { importance = 'normal'; }
        if (rpcClass === void 0) { rpcClass = 'best_effort_read'; }
        return markMethodFailure(buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass));
    },
    markMethodSuccessForTest: function (chainId, method, executionLane, importance, rpcClass) {
        if (executionLane === void 0) { executionLane = 'cheap'; }
        if (importance === void 0) { importance = 'normal'; }
        if (rpcClass === void 0) { rpcClass = 'best_effort_read'; }
        return markMethodSuccess(buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass));
    },
    resetRuntimeStateForTest: function () {
        endpointHealth.clear();
        endpointUsage.clear();
        (0, reservation_js_1.resetProjectedEndpointUsage)();
        methodBackoff.clear();
        methodLimiter.clear();
        inflightRpcRequests.clear();
        inflightRpcRawRequests.clear();
        rawTxHashCache.clear();
        rpcMethodUsage.clear();
    },
    seedCircuitOpenForTest: function (url) {
        var health = getOrCreateHealth(url);
        health.circuitOpen = true;
        health.consecutiveFailures = Math.max(health.consecutiveFailures, CIRCUIT_BREAKER_THRESHOLD);
        health.lastFailureTime = Date.now();
    }
};
