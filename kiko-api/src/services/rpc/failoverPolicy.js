"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendCheapBudgetToIncludePremiumFallback = extendCheapBudgetToIncludePremiumFallback;
exports.isRateLimitedFailure = isRateLimitedFailure;
exports.isHighSeverityRpcFailure = isHighSeverityRpcFailure;
exports.shouldSkipFailoverDelay = shouldSkipFailoverDelay;
exports.classifyFailoverReason = classifyFailoverReason;
exports.summarizeTopFailoverReasons = summarizeTopFailoverReasons;
function extendCheapBudgetToIncludePremiumFallback(params) {
    if (params.strategy !== 'cheap')
        return params.endpointBudget;
    if (params.forceExhaustiveFailover)
        return params.endpointBudget;
    var premiumIndex = params.sortedEndpoints.findIndex(function (endpoint) { return endpoint.type === 'premium'; });
    if (premiumIndex < 0)
        return params.endpointBudget;
    var requiredBudget = premiumIndex + 1;
    if (params.endpointBudget >= requiredBudget)
        return params.endpointBudget;
    return Math.min(params.sortedEndpoints.length, requiredBudget);
}
function isRateLimitedFailure(message) {
    var lower = String(message || '').toLowerCase();
    if (!lower)
        return false;
    return (lower.includes('http 429')
        || lower.includes('too many requests')
        || lower.includes('rate limit')
        || lower.includes('capacity_limited:rps')
        || lower.includes('capacity_limited:rpm')
        || lower.includes('capacity_limited:maxinflight'));
}
function isHighSeverityRpcFailure(message) {
    var lower = String(message || '').toLowerCase();
    if (!lower)
        return false;
    return (lower.includes('http 401')
        || lower.includes('http 402')
        || lower.includes('http 403')
        || lower.includes('http 429')
        || lower.includes('payment required')
        || lower.includes('forbidden')
        || lower.includes('unauthorized')
        || isRateLimitedFailure(lower));
}
function shouldSkipFailoverDelay(message) {
    var lower = String(message || '').toLowerCase();
    return (isRateLimitedFailure(lower)
        || lower === 'circuit_open'
        || lower === 'endpoint_method_timeout_cooldown'
        || lower.startsWith('capacity_limited:'));
}
function classifyFailoverReason(message) {
    var lower = String(message || '').toLowerCase();
    if (!lower)
        return 'unknown';
    if (isRateLimitedFailure(lower))
        return 'rate_limited';
    if (lower === 'circuit_open' || lower.includes('all_endpoints_circuit_open'))
        return 'circuit_open';
    if (lower === 'endpoint_method_timeout_cooldown')
        return 'timeout_cooldown';
    if (lower.includes('aborterror') || lower.includes('timeout'))
        return 'timeout';
    if (lower.includes('execution reverted') || lower.includes('invalid opcode') || lower.includes('out of gas'))
        return 'contract_revert';
    if (lower.includes('rpc error'))
        return 'rpc_error';
    if (lower.includes('http '))
        return 'http_error';
    if (lower.startsWith('capacity_limited:'))
        return 'capacity_limited';
    return 'unknown';
}
function summarizeTopFailoverReasons(reasonCounts, topN) {
    if (topN === void 0) { topN = 3; }
    return Array.from(reasonCounts.entries())
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, Math.max(1, topN))
        .map(function (_a) {
        var reason = _a[0], count = _a[1];
        return ({ reason: reason, count: count });
    });
}
