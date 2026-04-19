"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferLegacyRpcPurpose = inferLegacyRpcPurpose;
exports.getRpcPurposeProfile = getRpcPurposeProfile;
exports.purposeUsesPublicFreeOnly = purposeUsesPublicFreeOnly;
exports.purposeAllowsHedge = purposeAllowsHedge;
function inferLegacyRpcPurpose(params) {
    var method = String(params.method || '');
    var path = String(params.path || '');
    var importance = params.importance || (params.strategy === 'fast' ? 'critical' : 'normal');
    if (method === 'eth_sendRawTransaction'
        || method === 'eth_sendTransaction'
        || method === 'sendTransaction'
        || method === 'eth_estimateGas') {
        return 'trade_execution';
    }
    if (method === 'eth_getTransactionByHash'
        || method === 'eth_getTransactionReceipt'
        || method === 'eth_getTransactionCount'
        || method === 'eth_feeHistory'
        || method === 'eth_gasPrice'
        || method === 'eth_maxPriorityFeePerGas') {
        return 'tx_visibility';
    }
    if (path.includes('preheat')) {
        return 'preheat';
    }
    if (path.includes('reconcile') || path.includes('orphan') || path.includes('backfill')) {
        return 'background_reconcile';
    }
    if (importance === 'critical') {
        return 'interactive_read';
    }
    return 'interactive_read';
}
function getRpcPurposeProfile(purpose) {
    switch (purpose) {
        case 'polling_background':
            return {
                purpose: purpose,
                strategy: 'cheap',
                importance: 'normal',
                lane: 'cheap',
                allowPremiumEndpoints: false,
                allowPremiumFallback: false,
                allowHedge: false,
                allowExhaustiveFailover: false,
                premiumFirst: false,
                maxEndpointAttempts: 2,
                sendRawFanoutMax: 1,
                cooldownAttemptCap: 1,
            };
        case 'background_reconcile':
            return {
                purpose: purpose,
                strategy: 'cheap',
                importance: 'normal',
                lane: 'cheap',
                allowPremiumEndpoints: false,
                allowPremiumFallback: false,
                allowHedge: false,
                allowExhaustiveFailover: false,
                premiumFirst: false,
                maxEndpointAttempts: 2,
                sendRawFanoutMax: 1,
                cooldownAttemptCap: 1,
            };
        case 'preheat':
            return {
                purpose: purpose,
                strategy: 'cheap',
                importance: 'normal',
                lane: 'cheap',
                allowPremiumEndpoints: false,
                allowPremiumFallback: false,
                allowHedge: false,
                allowExhaustiveFailover: false,
                premiumFirst: false,
                maxEndpointAttempts: 2,
                sendRawFanoutMax: 1,
                cooldownAttemptCap: 1,
            };
        case 'interactive_read':
            return {
                purpose: purpose,
                strategy: 'cheap',
                importance: 'normal',
                lane: 'cheap',
                allowPremiumEndpoints: true,
                allowPremiumFallback: true,
                allowHedge: false,
                allowExhaustiveFailover: false,
                premiumFirst: false,
                maxEndpointAttempts: 2,
                sendRawFanoutMax: 1,
                cooldownAttemptCap: 1,
            };
        case 'tx_visibility':
            return {
                purpose: purpose,
                strategy: 'fast',
                importance: 'critical',
                lane: 'critical',
                allowPremiumEndpoints: true,
                allowPremiumFallback: true,
                allowHedge: true,
                allowExhaustiveFailover: true,
                premiumFirst: true,
                maxEndpointAttempts: 3,
                sendRawFanoutMax: 1,
                cooldownAttemptCap: 2,
            };
        case 'trade_execution':
            return {
                purpose: purpose,
                strategy: 'fast',
                importance: 'critical',
                lane: 'critical',
                allowPremiumEndpoints: true,
                allowPremiumFallback: false,
                allowHedge: true,
                allowExhaustiveFailover: true,
                premiumFirst: true,
                maxEndpointAttempts: 2,
                sendRawFanoutMax: 2,
                cooldownAttemptCap: 2,
            };
    }
}
function purposeUsesPublicFreeOnly(purpose) {
    return purpose === 'polling_background'
        || purpose === 'background_reconcile'
        || purpose === 'preheat';
}
function purposeAllowsHedge(purpose) {
    return getRpcPurposeProfile(purpose).allowHedge;
}
