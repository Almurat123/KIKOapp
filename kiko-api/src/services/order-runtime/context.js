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
exports.createOrderRuntimeContext = createOrderRuntimeContext;
exports.ensureOrderRuntimeContext = ensureOrderRuntimeContext;
exports.recordOrderRoute = recordOrderRoute;
exports.markOrderPrepared = markOrderPrepared;
exports.markOrderSendStarted = markOrderSendStarted;
exports.addOrderAttempt = addOrderAttempt;
exports.updateOrderAttempt = updateOrderAttempt;
exports.attachOrderTxHash = attachOrderTxHash;
exports.recordLifecycleOnOrder = recordLifecycleOnOrder;
exports.markOrderHashAccepted = markOrderHashAccepted;
exports.markOrderFallbackStarted = markOrderFallbackStarted;
exports.markOrderFallbackResult = markOrderFallbackResult;
exports.markOrderFailure = markOrderFailure;
exports.transitionOrderState = transitionOrderState;
exports.setOrderMetadata = setOrderMetadata;
exports.snapshotOrderRuntime = snapshotOrderRuntime;
var reasonCodes_js_1 = require("./reasonCodes.js");
var stateMachine_js_1 = require("./stateMachine.js");
function buildOrderId(seed) {
    var parts = [
        seed.userId.slice(0, 12),
        String(seed.chainId),
        seed.walletAddress.toLowerCase().slice(2, 10),
        String(seed.sourceTxHash || 'nosource').toLowerCase().slice(2, 10),
        String(seed.tokenIn || 'na').toLowerCase().slice(0, 8),
        String(seed.tokenOut || 'na').toLowerCase().slice(0, 8),
        Date.now().toString(36)
    ];
    return parts.join(':');
}
function createOrderRuntimeContext(seed) {
    return {
        orderId: buildOrderId(seed),
        chainId: seed.chainId,
        userId: seed.userId,
        walletAddress: seed.walletAddress,
        side: seed.side || 'unknown',
        mode: seed.mode || 'unknown',
        state: 'created',
        reasonCode: 'none',
        sourceTxHash: seed.sourceTxHash,
        canonicalTxHash: undefined,
        relatedTxHashes: [],
        route: {},
        timing: {
            createdAt: Date.now()
        },
        attempts: [],
        fallbackUsed: false,
        metadata: __assign({ tokenIn: seed.tokenIn || null, tokenOut: seed.tokenOut || null }, (seed.metadata || {}))
    };
}
function ensureOrderRuntimeContext(input, seed) {
    if (input.runtimeContext)
        return input.runtimeContext;
    var ctx = createOrderRuntimeContext(seed);
    input.runtimeContext = ctx;
    return ctx;
}
function recordOrderRoute(ctx, route) {
    if (!ctx.timing.routeStartedAt)
        ctx.timing.routeStartedAt = Date.now();
    ctx.route = __assign(__assign({}, ctx.route), route);
    transitionOrderState(ctx, 'route_selected');
    if (!ctx.timing.routeSelectedAt) {
        ctx.timing.routeSelectedAt = Date.now();
    }
}
function markOrderPrepared(ctx) {
    transitionOrderState(ctx, 'tx_prepared');
    ctx.timing.txPreparedAt = Date.now();
}
function markOrderSendStarted(ctx) {
    transitionOrderState(ctx, 'send_started');
    if (!ctx.timing.sendStartedAt)
        ctx.timing.sendStartedAt = Date.now();
}
function addOrderAttempt(ctx, payload) {
    var attempt = __assign(__assign({}, payload), { id: payload.id || "".concat(ctx.orderId, ":attempt:").concat(ctx.attempts.length + 1), updatedAt: Date.now() });
    ctx.attempts.push(attempt);
    return attempt;
}
function updateOrderAttempt(ctx, attemptId, patch) {
    var attempt = ctx.attempts.find(function (item) { return item.id === attemptId; });
    if (!attempt)
        return null;
    Object.assign(attempt, patch, { updatedAt: Date.now() });
    if (patch.txHash) {
        attachOrderTxHash(ctx, patch.txHash, { canonical: attempt.state !== 'failed' });
    }
    return attempt;
}
function attachOrderTxHash(ctx, txHash, options) {
    var normalized = String(txHash || '').toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(normalized))
        return;
    if (!ctx.relatedTxHashes.includes(normalized)) {
        ctx.relatedTxHashes.push(normalized);
    }
    if ((options === null || options === void 0 ? void 0 : options.canonical) || !ctx.canonicalTxHash) {
        ctx.canonicalTxHash = normalized;
    }
}
function recordLifecycleOnOrder(ctx, lifecycle, options) {
    ctx.lastLifecycle = lifecycle;
    attachOrderTxHash(ctx, lifecycle.txHash, { canonical: true });
    var reasonCode = (options === null || options === void 0 ? void 0 : options.reasonCode) || (0, reasonCodes_js_1.inferOrderReasonCode)(lifecycle.lastRpcError || lifecycle.status);
    if (reasonCode !== 'unknown' && reasonCode !== 'none') {
        ctx.reasonCode = reasonCode;
    }
    var nextState = (0, stateMachine_js_1.nextOrderStateForLifecycle)(ctx.state, lifecycle.status, ctx.reasonCode);
    transitionOrderState(ctx, nextState);
    if (nextState === 'hash_accepted' && !ctx.timing.hashAcceptedAt)
        ctx.timing.hashAcceptedAt = Date.now();
    if (nextState === 'rpc_uncertain' && !ctx.timing.hashAcceptedAt && lifecycle.txHash)
        ctx.timing.hashAcceptedAt = Date.now();
    if (nextState === 'mempool_visible' && !ctx.timing.visibleAt)
        ctx.timing.visibleAt = Date.now();
    if ((nextState === 'confirmed_success' || nextState === 'confirmed_failed') && !ctx.timing.finishedAt) {
        ctx.timing.finishedAt = Date.now();
    }
}
function markOrderHashAccepted(ctx, txHash) {
    attachOrderTxHash(ctx, txHash, { canonical: true });
    transitionOrderState(ctx, 'hash_accepted');
    if (!ctx.timing.hashAcceptedAt)
        ctx.timing.hashAcceptedAt = Date.now();
}
function markOrderFallbackStarted(ctx, reasonCode) {
    ctx.fallbackUsed = true;
    if (reasonCode && reasonCode !== 'none')
        ctx.reasonCode = reasonCode;
    if (ctx.state === 'failed') {
        ctx.state = 'fallback_started';
        return;
    }
    transitionOrderState(ctx, 'fallback_started');
}
function markOrderFallbackResult(ctx, success, reasonCode) {
    if (reasonCode && reasonCode !== 'none')
        ctx.reasonCode = reasonCode;
    if (ctx.state === 'failed') {
        ctx.state = success ? 'fallback_succeeded' : 'fallback_failed';
        return;
    }
    transitionOrderState(ctx, success ? 'fallback_succeeded' : 'fallback_failed');
}
function markOrderFailure(ctx, input, reasonCode) {
    ctx.reasonCode = reasonCode || (0, reasonCodes_js_1.inferOrderReasonCode)(input) || 'unknown';
    transitionOrderState(ctx, 'failed');
    if (!ctx.timing.finishedAt)
        ctx.timing.finishedAt = Date.now();
}
function transitionOrderState(ctx, nextState) {
    if (!(0, stateMachine_js_1.canTransitionOrderState)(ctx.state, nextState))
        return;
    ctx.state = nextState;
}
function setOrderMetadata(ctx, patch) {
    Object.assign(ctx.metadata, patch);
}
function snapshotOrderRuntime(ctx) {
    var routeMs = ctx.timing.routeStartedAt && ctx.timing.routeSelectedAt
        ? ctx.timing.routeSelectedAt - ctx.timing.routeStartedAt
        : ctx.timing.routeSelectedAt
            ? ctx.timing.routeSelectedAt - ctx.timing.createdAt
            : null;
    var sendMs = ctx.timing.sendStartedAt && ctx.timing.hashAcceptedAt
        ? ctx.timing.hashAcceptedAt - ctx.timing.sendStartedAt
        : null;
    var visibleMs = ctx.timing.hashAcceptedAt && ctx.timing.visibleAt
        ? ctx.timing.visibleAt - ctx.timing.hashAcceptedAt
        : null;
    var totalMs = (ctx.timing.finishedAt || ctx.timing.visibleAt || ctx.timing.hashAcceptedAt)
        ? (ctx.timing.finishedAt || ctx.timing.visibleAt || ctx.timing.hashAcceptedAt || ctx.timing.createdAt) - ctx.timing.createdAt
        : null;
    return {
        orderId: ctx.orderId,
        chainId: ctx.chainId,
        userId: ctx.userId,
        walletAddress: ctx.walletAddress,
        side: ctx.side,
        mode: ctx.mode,
        state: ctx.state,
        reasonCode: ctx.reasonCode,
        sourceTxHash: ctx.sourceTxHash,
        canonicalTxHash: ctx.canonicalTxHash,
        relatedTxHashes: __spreadArray([], ctx.relatedTxHashes, true),
        route: __assign({}, ctx.route),
        attempts: ctx.attempts.map(function (attempt) { return (__assign({}, attempt)); }),
        fallbackUsed: ctx.fallbackUsed,
        metrics: { routeMs: routeMs, sendMs: sendMs, visibleMs: visibleMs, totalMs: totalMs },
        lastLifecycle: ctx.lastLifecycle ? __assign({}, ctx.lastLifecycle) : undefined,
        metadata: __assign({}, ctx.metadata)
    };
}
