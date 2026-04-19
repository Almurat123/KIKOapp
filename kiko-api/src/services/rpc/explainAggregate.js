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
exports.recordRpcSelectionExplainAggregate = recordRpcSelectionExplainAggregate;
exports.recordRpcSelectionExplainAllFailed = recordRpcSelectionExplainAllFailed;
exports.flushRpcSelectionExplainAggregates = flushRpcSelectionExplainAggregates;
exports.__resetRpcSelectionExplainAggregatesForTests = __resetRpcSelectionExplainAggregatesForTests;
var logRegistry_js_1 = require("../../config/logRegistry.js");
var logger_js_1 = require("../../utils/logger.js");
var RPC_EXPLAIN_AGGREGATE_WINDOW_MS = Math.max(10000, Number(process.env.RPC_EXPLAIN_AGGREGATE_WINDOW_MS || 60000));
var currentWindowStart = Math.floor(Date.now() / RPC_EXPLAIN_AGGREGATE_WINDOW_MS) * RPC_EXPLAIN_AGGREGATE_WINDOW_MS;
var aggregates = new Map();
var flushTimer = null;
function buildKey(params) {
    return "".concat(params.chain, "::").concat(params.method, "::").concat(params.purpose, "::").concat(params.lane);
}
function rotateWindowIfNeeded(now) {
    if (now === void 0) { now = Date.now(); }
    var windowStart = Math.floor(now / RPC_EXPLAIN_AGGREGATE_WINDOW_MS) * RPC_EXPLAIN_AGGREGATE_WINDOW_MS;
    if (windowStart === currentWindowStart)
        return;
    flushRpcSelectionExplainAggregates();
    currentWindowStart = windowStart;
}
function ensureFlushTimer() {
    var _a;
    if (flushTimer)
        return;
    flushTimer = setInterval(function () {
        flushRpcSelectionExplainAggregates();
    }, RPC_EXPLAIN_AGGREGATE_WINDOW_MS);
    (_a = flushTimer.unref) === null || _a === void 0 ? void 0 : _a.call(flushTimer);
}
function collectReasons(snapshot) {
    var reasons = new Set();
    for (var _i = 0, _a = snapshot.upgradeReasons || []; _i < _a.length; _i++) {
        var reason = _a[_i];
        if (reason)
            reasons.add(String(reason));
    }
    if (reasons.size === 0) {
        for (var _b = 0, _c = snapshot.topScores || []; _b < _c.length; _b++) {
            var score = _c[_b];
            for (var _d = 0, _e = score.reasons || []; _d < _e.length; _d++) {
                var reason = _e[_d];
                if (reason)
                    reasons.add(String(reason));
                if (reasons.size >= 8)
                    break;
            }
            if (reasons.size >= 8)
                break;
        }
    }
    return __spreadArray([], reasons, true);
}
function recordRpcSelectionExplainAggregate(params) {
    rotateWindowIfNeeded();
    ensureFlushTimer();
    var key = buildKey({
        chain: params.chain,
        method: params.snapshot.method,
        purpose: params.purpose,
        lane: params.snapshot.lane,
    });
    var current = aggregates.get(key) || {
        chain: params.chain,
        method: params.snapshot.method,
        purpose: params.purpose,
        lane: params.snapshot.lane,
        calls: 0,
        upgradedToFast: 0,
        allFailed: 0,
        reasons: new Map(),
    };
    current.calls += 1;
    if (params.snapshot.upgradedToFast)
        current.upgradedToFast += 1;
    for (var _i = 0, _a = collectReasons(params.snapshot); _i < _a.length; _i++) {
        var reason = _a[_i];
        current.reasons.set(reason, (current.reasons.get(reason) || 0) + 1);
    }
    aggregates.set(key, current);
}
function recordRpcSelectionExplainAllFailed(params) {
    rotateWindowIfNeeded();
    ensureFlushTimer();
    var key = buildKey(params);
    var current = aggregates.get(key) || {
        chain: params.chain,
        method: params.method,
        purpose: params.purpose,
        lane: params.lane,
        calls: 0,
        upgradedToFast: 0,
        allFailed: 0,
        reasons: new Map(),
    };
    current.allFailed += 1;
    for (var _i = 0, _a = params.reasons || []; _i < _a.length; _i++) {
        var reason = _a[_i];
        current.reasons.set(reason, (current.reasons.get(reason) || 0) + 1);
    }
    aggregates.set(key, current);
}
function flushRpcSelectionExplainAggregates() {
    if (aggregates.size === 0)
        return;
    var windowStartIso = new Date(currentWindowStart).toISOString();
    var windowEndIso = new Date(currentWindowStart + RPC_EXPLAIN_AGGREGATE_WINDOW_MS).toISOString();
    var rows = __spreadArray([], aggregates.values(), true).sort(function (a, b) { return (b.calls + b.allFailed) - (a.calls + a.allFailed); })
        .map(function (entry) { return ({
        chain: entry.chain,
        method: entry.method,
        purpose: entry.purpose,
        lane: entry.lane,
        calls: entry.calls,
        upgradedToFast: entry.upgradedToFast,
        allFailed: entry.allFailed,
        topReasons: __spreadArray([], entry.reasons.entries(), true).sort(function (a, b) { return b[1] - a[1]; })
            .slice(0, 5)
            .map(function (_a) {
            var reason = _a[0], count = _a[1];
            return ({ reason: reason, count: count });
        }),
    }); });
    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'RPC selection explain summary', {
        windowStartIso: windowStartIso,
        windowEndIso: windowEndIso,
        groups: rows.length,
        rows: rows,
    });
    aggregates.clear();
}
function __resetRpcSelectionExplainAggregatesForTests() {
    aggregates.clear();
    currentWindowStart = Math.floor(Date.now() / RPC_EXPLAIN_AGGREGATE_WINDOW_MS) * RPC_EXPLAIN_AGGREGATE_WINDOW_MS;
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
}
