"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTxLifecycleTerminal = isTxLifecycleTerminal;
exports.isTxLifecycleSendAccepted = isTxLifecycleSendAccepted;
exports.toTxLifecycleFailureMessage = toTxLifecycleFailureMessage;
function isTxLifecycleTerminal(status) {
    return status === 'confirmed_success'
        || status === 'confirmed_failed'
        || status === 'dropped_timeout';
}
function isTxLifecycleSendAccepted(result) {
    return Boolean(result.txHash)
        && (result.status === 'broadcasted_unseen'
            || result.status === 'visible_pending'
            || result.status === 'confirmed_success');
}
function toTxLifecycleFailureMessage(result) {
    var base = "tx_lifecycle_".concat(result.status);
    if (!result.lastRpcError)
        return base;
    return "".concat(base, ":").concat(result.lastRpcError);
}
