"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldRetryAfterBroadcastUnseen = shouldRetryAfterBroadcastUnseen;
exports.shouldPassVisibilityGate = shouldPassVisibilityGate;
exports.describeVisibilityFailure = describeVisibilityFailure;
var finalState_js_1 = require("../order-runtime/adjudicator/finalState.js");
function shouldRetryAfterBroadcastUnseen(params) {
    var _a;
    if (!params.hasNonce) {
        return { retry: false, bumpGas: false, reason: 'no_nonce' };
    }
    if (params.attempt >= params.maxRetries) {
        return { retry: false, bumpGas: false, reason: 'retry_budget_exhausted' };
    }
    var finalState = (0, finalState_js_1.resolveTxFinalState)({
        runtimeContext: params.runtimeContext,
        lifecycle: params.lifecycle || undefined,
        chainId: params.chainId,
        txHash: params.txHash || ((_a = params.lifecycle) === null || _a === void 0 ? void 0 : _a.txHash)
    });
    if (finalState.visible || finalState.success) {
        return { retry: false, bumpGas: false, reason: "final_state_".concat(finalState.state) };
    }
    if (!params.fastTradePath && params.txPurpose !== 'trade' && params.txPurpose !== 'speedup') {
        return { retry: false, bumpGas: false, reason: 'non_trade_purpose' };
    }
    if (params.fastTradePath) {
        return { retry: false, bumpGas: false, reason: 'fast_trade_wait_for_shared_evidence' };
    }
    return { retry: true, bumpGas: true, reason: 'shared_evidence_still_uncertain' };
}
function shouldPassVisibilityGate(params) {
    var _a;
    var finalState = (0, finalState_js_1.resolveTxFinalState)({
        runtimeContext: params.runtimeContext,
        lifecycle: params.lifecycle || undefined,
        chainId: params.chainId,
        txHash: params.txHash || ((_a = params.lifecycle) === null || _a === void 0 ? void 0 : _a.txHash)
    });
    return finalState.visible || finalState.success;
}
function describeVisibilityFailure(params) {
    var _a, _b, _c;
    var finalState = (0, finalState_js_1.resolveTxFinalState)({
        runtimeContext: params.runtimeContext,
        lifecycle: params.lifecycle || undefined,
        chainId: params.chainId,
        txHash: params.txHash || ((_a = params.lifecycle) === null || _a === void 0 ? void 0 : _a.txHash)
    });
    if (finalState.state !== 'unknown') {
        return {
            failure: finalState.state,
            reason: finalState.reasonCode || 'none'
        };
    }
    return {
        failure: ((_b = params.lifecycle) === null || _b === void 0 ? void 0 : _b.status) || 'broadcasted_unseen',
        reason: ((_c = params.lifecycle) === null || _c === void 0 ? void 0 : _c.lastRpcError) || 'not_found_by_rpc'
    };
}
