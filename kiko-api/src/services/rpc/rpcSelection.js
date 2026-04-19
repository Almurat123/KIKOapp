"use strict";
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
exports.forceOpenEndpointCircuit = void 0;
exports.isWriteMethod = isWriteMethod;
exports.inferRpcClass = inferRpcClass;
exports.resolveRpcTimeoutMs = resolveRpcTimeoutMs;
exports.isNonRetryableRpcErrorMessage = isNonRetryableRpcErrorMessage;
exports.shouldCoalesceMethod = shouldCoalesceMethod;
exports.shouldTreatSendRawErrorAsKnown = shouldTreatSendRawErrorAsKnown;
exports.getPrimaryRpcUrl = getPrimaryRpcUrl;
exports.isPublicFreeEndpoint = isPublicFreeEndpoint;
exports.filterEndpointsForPurpose = filterEndpointsForPurpose;
exports.countSelectedFreeEndpoints = countSelectedFreeEndpoints;
exports.normalizeRawTx = normalizeRawTx;
exports.tryGetRawTxHash = tryGetRawTxHash;
exports.createStableRequestKey = createStableRequestKey;
exports.buildMethodBackoffKey = buildMethodBackoffKey;
exports.getMethodConcurrencyLimit = getMethodConcurrencyLimit;
exports.shouldForceExhaustiveFailover = shouldForceExhaustiveFailover;
exports.isResilientEthCallPath = isResilientEthCallPath;
exports.getEndpointAttemptBudget = getEndpointAttemptBudget;
exports.expandEthCallSelectionWithCheapFallback = expandEthCallSelectionWithCheapFallback;
exports.expandCriticalSelectionWithPublicFallback = expandCriticalSelectionWithPublicFallback;
var ethers_1 = require("ethers");
var RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS || '10000');
var RPC_TIMEOUT_FAST_MS = Number(process.env.RPC_TIMEOUT_FAST_MS || '2500');
var RPC_TIMEOUT_CRITICAL_MS = Number(process.env.RPC_TIMEOUT_CRITICAL_MS || '1500');
var RPC_CRITICAL_HEDGE_ALLOW_WRITE = (process.env.RPC_CRITICAL_HEDGE_ALLOW_WRITE || 'false') === 'true';
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
var RPC_METHOD_COOLDOWN_ATTEMPT_CAP = Math.max(1, Number(process.env.RPC_METHOD_COOLDOWN_ATTEMPT_CAP || '1'));
var RPC_METHOD_COOLDOWN_BASE_MS = Math.max(0, Number(process.env.RPC_METHOD_COOLDOWN_BASE_MS || '250'));
var RPC_METHOD_COOLDOWN_MAX_MS = Math.max(RPC_METHOD_COOLDOWN_BASE_MS, Number(process.env.RPC_METHOD_COOLDOWN_MAX_MS || '4000'));
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
function getPrimaryRpcUrl(chainSlug) {
    var envKey = {
        eth: 'ETH_RPC_URL',
        base: 'BASE_RPC_URL',
        bsc: 'BSC_RPC_URL',
        polygon: 'POLYGON_RPC_URL',
        arbitrum: 'ARBITRUM_RPC_URL',
        optimism: 'OPTIMISM_RPC_URL',
        solana: 'SOLANA_RPC_URL',
    }[chainSlug];
    return envKey ? process.env[envKey] : undefined;
}
function isPublicFreeEndpoint(endpoint) {
    return endpoint.type === 'public_free';
}
function filterEndpointsForPurpose(endpoints, purpose) {
    if (purpose === 'polling_background' || purpose === 'background_reconcile' || purpose === 'preheat') {
        return endpoints.filter(function (endpoint) { return endpoint.type === 'public_free' || endpoint.type === 'fallback'; });
    }
    if (purpose === 'trade_execution') {
        return endpoints.filter(function (endpoint) { return endpoint.type === 'premium' || endpoint.type === 'fallback'; });
    }
    return endpoints;
}
function countSelectedFreeEndpoints(endpoints) {
    return endpoints.filter(function (endpoint) { return endpoint.type === 'public_free'; }).length;
}
var rpcState_js_1 = require("./rpcState.js");
Object.defineProperty(exports, "forceOpenEndpointCircuit", { enumerable: true, get: function () { return rpcState_js_1.forceOpenEndpointCircuit; } });
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
function createStableRequestKey(chainId, method, params, maxLen) {
    if (maxLen === void 0) { maxLen = 2048; }
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
    if (key.length > maxLen) {
        key = "".concat(chainId, ":").concat(method, ":").concat(Buffer.from(serialized).toString('base64url').slice(0, maxLen));
    }
    return key;
}
function buildMethodBackoffKey(chainId, executionLane, method, importance, rpcClass) {
    if (importance === void 0) { importance = 'normal'; }
    if (rpcClass === void 0) { rpcClass = 'best_effort_read'; }
    return "".concat(chainId, ":").concat(executionLane, ":").concat(method, ":").concat(importance, ":").concat(rpcClass);
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
function isResilientEthCallPath(method, path, importance) {
    if (method !== 'eth_call')
        return false;
    return importance === 'critical' || new Set([
        'direct_swap',
        'confirm_wait',
        'token_metadata',
        'token_decimals',
        'token_supply',
        'token_supply_market_cap',
    ]).has(String(path || 'default'));
}
function getEndpointAttemptBudget(method, importance, endpointCount, cooldownActive, forceExhaustive, path) {
    if (forceExhaustive === void 0) { forceExhaustive = false; }
    if (path === void 0) { path = 'default'; }
    var isTxLifecycleMethod = method === 'eth_sendRawTransaction'
        || method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt';
    if (isTxLifecycleMethod && importance === 'critical') {
        return Math.max(1, Math.min(endpointCount, 7));
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
    if (forceExhaustive)
        return Math.max(1, endpointCount);
    return budget;
}
function expandEthCallSelectionWithCheapFallback(params) {
    if (!isResilientEthCallPath(params.method, params.path, params.importance)) {
        return params.selectedEndpoints;
    }
    var hasPublic = params.selectedEndpoints.some(function (endpoint) { return endpoint.type === 'public_free'; });
    if (hasPublic)
        return params.selectedEndpoints;
    var cheapEndpoints = params.filterEndpointsByMethod(params.getRpcEndpointsWithStrategy(params.chainSlug, 'cheap', params.primaryUrl), params.method).filter(function (endpoint) { return endpoint.type === 'public_free'; });
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
    var allPremiumCircuited = premiumSelected.every(function (endpoint) { return params.isCircuitOpen(endpoint.url); });
    if (!alwaysIncludePublicFallback && !allPremiumCircuited) {
        return params.selectedEndpoints;
    }
    var cheapPublicEndpoints = params.filterEndpointsByMethod(params.getRpcEndpointsForLane(params.chainSlug, 'cheap', params.primaryUrl), params.method).filter(function (endpoint) { return endpoint.type === 'public_free'; });
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
