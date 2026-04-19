"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTransitionOrderState = canTransitionOrderState;
exports.nextOrderStateForLifecycle = nextOrderStateForLifecycle;
var TRANSITIONS = {
    created: new Set(['route_selected', 'fallback_started', 'failed']),
    route_selected: new Set(['tx_prepared', 'failed', 'fallback_started']),
    tx_prepared: new Set(['send_started', 'failed', 'fallback_started']),
    send_started: new Set(['hash_accepted', 'rpc_uncertain', 'failed', 'fallback_started']),
    hash_accepted: new Set(['rpc_uncertain', 'mempool_visible', 'included', 'confirmed_success', 'confirmed_failed', 'fallback_started', 'failed']),
    rpc_uncertain: new Set(['hash_accepted', 'mempool_visible', 'included', 'confirmed_success', 'confirmed_failed', 'fallback_started', 'failed']),
    mempool_visible: new Set(['included', 'confirmed_success', 'confirmed_failed', 'fallback_started', 'failed']),
    included: new Set(['confirmed_success', 'confirmed_failed', 'failed']),
    confirmed_success: new Set([]),
    confirmed_failed: new Set([]),
    fallback_started: new Set(['fallback_succeeded', 'fallback_failed', 'failed']),
    fallback_succeeded: new Set(['confirmed_success', 'confirmed_failed', 'failed']),
    fallback_failed: new Set(['failed']),
    failed: new Set([])
};
function canTransitionOrderState(from, to) {
    var _a, _b;
    if (from === to)
        return true;
    return (_b = (_a = TRANSITIONS[from]) === null || _a === void 0 ? void 0 : _a.has(to)) !== null && _b !== void 0 ? _b : false;
}
function nextOrderStateForLifecycle(current, lifecycleStatus, reasonCode) {
    if (reasonCode === void 0) { reasonCode = 'none'; }
    var status = String(lifecycleStatus || '').toLowerCase();
    if (!status)
        return current;
    if (status === 'confirmed_success')
        return 'confirmed_success';
    if (status === 'confirmed_failed')
        return 'confirmed_failed';
    if (status === 'visible_pending')
        return canTransitionOrderState(current, 'mempool_visible') ? 'mempool_visible' : current;
    if (status === 'broadcasted_unseen')
        return canTransitionOrderState(current, 'rpc_uncertain') ? 'rpc_uncertain' : current;
    if (status === 'dropped_timeout') {
        if (reasonCode === 'rpc_uncertain' || reasonCode === 'pending_visibility')
            return canTransitionOrderState(current, 'rpc_uncertain') ? 'rpc_uncertain' : current;
        return canTransitionOrderState(current, 'failed') ? 'failed' : current;
    }
    return current;
}
