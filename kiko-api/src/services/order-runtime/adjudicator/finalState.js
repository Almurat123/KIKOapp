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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTxFinalState = resolveTxFinalState;
exports.toLifecycleResultFromFinalState = toLifecycleResultFromFinalState;
var service_js_1 = require("./service.js");
function flagsForState(state, terminal) {
    return {
        terminal: terminal,
        accepted: state === 'send_accepted' || state === 'rpc_visible' || state === 'chain_observed' || state === 'confirmed_success',
        visible: state === 'rpc_visible' || state === 'chain_observed' || state === 'confirmed_success',
        success: state === 'confirmed_success',
        failed: state === 'confirmed_failed'
    };
}
function fromAdjudicatedState(state, reasonCode, final) {
    if (!state || state === 'unknown')
        return null;
    return __assign({ state: state, reasonCode: reasonCode || 'none', source: 'adjudicator' }, flagsForState(state, Boolean(final)));
}
function fromRuntimeState(state, reasonCode) {
    if (!state)
        return null;
    var mapped = state === 'confirmed_success' ? 'confirmed_success'
        : state === 'confirmed_failed' || state === 'failed' || state === 'fallback_failed' ? 'confirmed_failed'
            : state === 'included' || state === 'mempool_visible' ? 'rpc_visible'
                : state === 'hash_accepted' ? 'send_accepted'
                    : state === 'rpc_uncertain' ? 'rpc_uncertain'
                        : null;
    if (!mapped)
        return null;
    var terminal = mapped === 'confirmed_success' || mapped === 'confirmed_failed';
    return __assign({ state: mapped, reasonCode: reasonCode || 'none', source: 'runtime' }, flagsForState(mapped, terminal));
}
function fromLifecycleStatus(status, reasonCode) {
    if (!status)
        return null;
    var mapped = status === 'confirmed_success' ? 'confirmed_success'
        : status === 'confirmed_failed' || status === 'dropped_timeout' || status === 'send_failed' ? 'confirmed_failed'
            : status === 'visible_pending' ? 'rpc_visible'
                : status === 'broadcasted_unseen' ? 'rpc_uncertain'
                    : status === 'pending_broadcast' ? 'unknown'
                        : null;
    if (!mapped || mapped === 'unknown')
        return null;
    var terminal = mapped === 'confirmed_success' || mapped === 'confirmed_failed';
    return __assign({ state: mapped, reasonCode: reasonCode || 'none', source: 'lifecycle' }, flagsForState(mapped, terminal));
}
function resolveTxFinalState(params) {
    var runtimeContext = params.runtimeContext;
    var lifecycle = params.lifecycle;
    var lifecycleTxHash = lifecycle && 'txHash' in lifecycle ? lifecycle.txHash : undefined;
    var snapshot = (0, service_js_1.getAdjudicatedSnapshot)({
        orderId: params.orderId || (runtimeContext === null || runtimeContext === void 0 ? void 0 : runtimeContext.orderId),
        chainId: params.chainId || (runtimeContext === null || runtimeContext === void 0 ? void 0 : runtimeContext.chainId),
        txHash: params.txHash || (runtimeContext === null || runtimeContext === void 0 ? void 0 : runtimeContext.canonicalTxHash) || lifecycleTxHash
    });
    var adjudicated = fromAdjudicatedState(snapshot === null || snapshot === void 0 ? void 0 : snapshot.adjudicated.state, snapshot === null || snapshot === void 0 ? void 0 : snapshot.adjudicated.reasonCode, snapshot === null || snapshot === void 0 ? void 0 : snapshot.adjudicated.final);
    if (adjudicated)
        return adjudicated;
    var runtime = fromRuntimeState(runtimeContext === null || runtimeContext === void 0 ? void 0 : runtimeContext.state, runtimeContext === null || runtimeContext === void 0 ? void 0 : runtimeContext.reasonCode);
    if (runtime)
        return runtime;
    var lifecycleState = fromLifecycleStatus(lifecycle === null || lifecycle === void 0 ? void 0 : lifecycle.status, lifecycle === null || lifecycle === void 0 ? void 0 : lifecycle.lastRpcError);
    if (lifecycleState)
        return lifecycleState;
    return {
        state: 'unknown',
        reasonCode: 'none',
        terminal: false,
        accepted: false,
        visible: false,
        success: false,
        failed: false,
        source: 'none'
    };
}
function toLifecycleResultFromFinalState(params) {
    var status = params.resolution.state === 'confirmed_success' ? 'confirmed_success'
        : params.resolution.state === 'confirmed_failed' ? 'confirmed_failed'
            : params.resolution.state === 'rpc_visible' || params.resolution.state === 'chain_observed' ? 'visible_pending'
                : params.resolution.state === 'send_accepted' || params.resolution.state === 'rpc_uncertain' ? 'broadcasted_unseen'
                    : 'dropped_timeout';
    return {
        status: status,
        txHash: params.txHash,
        chainId: params.chainId,
        attempts: params.attempts || 0,
        firstSeenAt: params.firstSeenAt,
        confirmedAt: params.confirmedAt,
        lastRpcError: params.resolution.reasonCode || undefined
    };
}
