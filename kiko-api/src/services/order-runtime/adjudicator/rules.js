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
exports.adjudicateSnapshot = adjudicateSnapshot;
function nextState(snapshot) {
    if (snapshot.receipt.seen) {
        if (snapshot.receipt.success === true)
            return { state: 'confirmed_success', reasonCode: 'receipt_success', final: true };
        if (snapshot.receipt.success === false)
            return { state: 'confirmed_failed', reasonCode: 'receipt_failed', final: true };
    }
    if (snapshot.webhook.seen) {
        return { state: 'chain_observed', reasonCode: 'webhook_seen', final: false };
    }
    if (snapshot.txByHash.seen) {
        return { state: 'rpc_visible', reasonCode: 'tx_by_hash_seen', final: false };
    }
    if (snapshot.send.accepted) {
        return { state: 'send_accepted', reasonCode: 'send_accepted', final: false };
    }
    var rpcError = snapshot.receipt.rpcError || snapshot.txByHash.rpcError;
    if (rpcError) {
        return { state: 'rpc_uncertain', reasonCode: 'rpc_uncertain', final: false };
    }
    return { state: 'unknown', reasonCode: 'none', final: false };
}
function adjudicateSnapshot(snapshot) {
    var adjudicated = nextState(snapshot);
    return __assign(__assign({}, snapshot), { adjudicated: __assign(__assign({}, adjudicated), { decidedAt: Date.now() }) });
}
