"use strict";
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
exports.maskEndpoint = maskEndpoint;
exports.shouldLogAllRpcFailed = shouldLogAllRpcFailed;
exports.forceOpenEndpointCircuit = forceOpenEndpointCircuit;
exports.isCircuitOpen = isCircuitOpen;
exports.recordAttempt = recordAttempt;
exports.recordSuccess = recordSuccess;
exports.recordFailure = recordFailure;
exports.recordUsageStart = recordUsageStart;
exports.recordUsageEnd = recordUsageEnd;
exports.checkAndReserveCapacity = checkAndReserveCapacity;
exports.checkEndpointCapacity = checkEndpointCapacity;
exports.markRpcMethodUsage = markRpcMethodUsage;
exports.markRpcMethodLatency = markRpcMethodLatency;
exports.isEndpointMethodTimeoutCooling = isEndpointMethodTimeoutCooling;
exports.markEndpointMethodAttempt = markEndpointMethodAttempt;
exports.markEndpointMethodTimeout = markEndpointMethodTimeout;
exports.getMethodBackoffState = getMethodBackoffState;
exports.markMethodSuccess = markMethodSuccess;
exports.markMethodFailure = markMethodFailure;
exports.recordTxLifecycleState = recordTxLifecycleState;
exports.getTxLifecycleState = getTxLifecycleState;
exports.markChainRpcDegraded = markChainRpcDegraded;
exports.getChainRpcDegradeState = getChainRpcDegradeState;
exports.getEndpointHealthView = getEndpointHealthView;
exports.getEndpointUsageView = getEndpointUsageView;
exports.reserveProjectedSelection = reserveProjectedSelection;
exports.endpointCapacityPressure = endpointCapacityPressure;
exports.getRpcMethodUsageSnapshot = getRpcMethodUsageSnapshot;
exports.diffRpcMethodUsageSnapshots = diffRpcMethodUsageSnapshots;
exports.getUsageSnapshot = getUsageSnapshot;
exports.getRpcHealthStats = getRpcHealthStats;
exports.markRpcPoolInflight = markRpcPoolInflight;
exports.getRpcPoolInflight = getRpcPoolInflight;
exports.resetRpcRuntimeStateForTest = resetRpcRuntimeStateForTest;
exports.shouldLogRpcExplain = shouldLogRpcExplain;
exports.shouldLogAllRpcFailedGate = shouldLogAllRpcFailedGate;
exports.getEndpointMethodTimeoutHealthView = getEndpointMethodTimeoutHealthView;
exports.endpointMethodTimeoutKey = endpointMethodTimeoutKey;
var logger_js_1 = require("../../utils/logger.js");
var logRegistry_js_1 = require("../../config/logRegistry.js");
var service_js_1 = require("../order-runtime/adjudicator/service.js");
var prediction_js_1 = require("./prediction.js");
var reservation_js_1 = require("./reservation.js");
var CIRCUIT_BREAKER_THRESHOLD = 5;
var CIRCUIT_BREAKER_RESET_TIME = 30000;
var RPC_METHOD_COOLDOWN_BASE_MS = Math.max(0, Number(process.env.RPC_METHOD_COOLDOWN_BASE_MS || '250'));
var RPC_METHOD_COOLDOWN_MAX_MS = Math.max(RPC_METHOD_COOLDOWN_BASE_MS, Number(process.env.RPC_METHOD_COOLDOWN_MAX_MS || '4000'));
var RPC_METHOD_COOLDOWN_ATTEMPT_CAP = Math.max(1, Number(process.env.RPC_METHOD_COOLDOWN_ATTEMPT_CAP || '1'));
var ENDPOINT_METHOD_TIMEOUT_WINDOW_MS = Math.max(5000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_WINDOW_MS || '60000'));
var ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS = Math.max(3, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_MIN_ATTEMPTS || '8'));
var ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD = Math.min(1, Math.max(0, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_RATE_THRESHOLD || '0.3')));
var ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS = Math.max(1000, Number(process.env.RPC_ENDPOINT_METHOD_TIMEOUT_COOLDOWN_MS || '60000'));
var TX_LIFECYCLE_STATE_TTL_MS = Math.max(5000, Number(process.env.TX_LIFECYCLE_STATE_TTL_MS || '180000'));
var TX_LIFECYCLE_STATE_MAX = Math.max(256, Number(process.env.TX_LIFECYCLE_STATE_MAX || '20000'));
var RPC_CHAIN_DEGRADED_TTL_MS = Math.max(500, Number(process.env.RPC_CHAIN_DEGRADED_TTL_MS || '4000'));
var RPC_ALL_FAILED_LOG_COOLDOWN_MS = Number(process.env.RPC_ALL_FAILED_LOG_COOLDOWN_MS || 5000);
var RPC_EXPLAIN_ENABLED = (process.env.RPC_EXPLAIN_ENABLED || 'true').toLowerCase() === 'true';
var endpointHealth = new Map();
var endpointUsage = new Map();
var methodBackoff = new Map();
var rpcMethodUsage = new Map();
var endpointMethodTimeoutHealth = new Map();
var txLifecycleStateCache = new Map();
var rpcChainDegradedState = new Map();
var rpcPoolInflight = {
    critical_tx: 0,
    best_effort_read: 0
};
var allRpcFailedLogGate = new Map();
function maskEndpoint(url) {
    return String(url || '').replace(/[a-zA-Z0-9]{32,}/g, '***');
}
function shouldLogAllRpcFailed(key) {
    var now = Date.now();
    var last = allRpcFailedLogGate.get(key) || 0;
    if (now - last < RPC_ALL_FAILED_LOG_COOLDOWN_MS)
        return false;
    allRpcFailedLogGate.set(key, now);
    return true;
}
function forceOpenEndpointCircuit(url, cooldownMs) {
    var health = getOrCreateHealth(url);
    health.circuitOpen = true;
    health.lastFailureTime = Date.now() - Math.max(0, CIRCUIT_BREAKER_RESET_TIME - Math.max(0, cooldownMs));
    health.consecutiveFailures = Math.max(health.consecutiveFailures, CIRCUIT_BREAKER_THRESHOLD);
}
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
    if (health.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        health.circuitOpen = true;
        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC circuit breaker opened', {
            endpoint: maskEndpoint(url),
            failures: health.consecutiveFailures
        });
    }
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
        if (!criticalPremiumBypass || usage.inFlight >= (limits.maxInFlight + 2)) {
            return { ok: false, reason: 'maxInFlight' };
        }
    }
    if (limits.rps && usage.secondCount >= limits.rps) {
        if (!criticalPremiumBypass) {
            return { ok: false, reason: 'rps' };
        }
    }
    if (limits.rpm && usage.minuteCount >= limits.rpm) {
        if (!criticalPremiumBypass) {
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
        if (!criticalPremiumBypass || usage.inFlight >= (limits.maxInFlight + 2)) {
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
function txLifecycleKey(chainId, txHash) {
    return "".concat(chainId, ":").concat(String(txHash || '').toLowerCase());
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
    var lane = importance === 'critical' ? 'route_read' : 'background';
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
function markRpcPoolInflight(rpcClass, delta) {
    rpcPoolInflight[rpcClass] = Math.max(0, rpcPoolInflight[rpcClass] + delta);
}
function getRpcPoolInflight() {
    return __assign({}, rpcPoolInflight);
}
function resetRpcRuntimeStateForTest() {
    endpointHealth.clear();
    endpointUsage.clear();
    methodBackoff.clear();
    rpcMethodUsage.clear();
    endpointMethodTimeoutHealth.clear();
    txLifecycleStateCache.clear();
    rpcChainDegradedState.clear();
    allRpcFailedLogGate.clear();
    rpcPoolInflight.critical_tx = 0;
    rpcPoolInflight.best_effort_read = 0;
}
function shouldLogRpcExplain() {
    return RPC_EXPLAIN_ENABLED;
}
function shouldLogAllRpcFailedGate(key) {
    return shouldLogAllRpcFailed(key);
}
function getEndpointMethodTimeoutHealthView(key) {
    var state = getEndpointMethodTimeoutHealth(key);
    return __assign({}, state);
}
function endpointMethodTimeoutKey(endpointUrl, method) {
    return endpointMethodHealthKey(endpointUrl, method);
}
