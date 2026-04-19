"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markEndUserActivity = markEndUserActivity;
exports.getLastEndUserActivityAt = getLastEndUserActivityAt;
exports.hasRecentEndUserActivity = hasRecentEndUserActivity;
exports.shouldRunNonCriticalJob = shouldRunNonCriticalJob;
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var NON_CRITICAL_IDLE_TIMEOUT_MS = Math.max(60000, Number(process.env.NON_CRITICAL_IDLE_TIMEOUT_MS || "".concat(30 * 60 * 1000)));
var IDLE_SKIP_LOG_WINDOW_MS = Math.max(30000, Number(process.env.IDLE_SKIP_LOG_WINDOW_MS || '300000'));
var lastEndUserActivityAt = 0;
function markEndUserActivity(at) {
    if (at === void 0) { at = Date.now(); }
    lastEndUserActivityAt = Math.max(lastEndUserActivityAt, at);
}
function getLastEndUserActivityAt() {
    return lastEndUserActivityAt;
}
function hasRecentEndUserActivity(now) {
    if (now === void 0) { now = Date.now(); }
    if (lastEndUserActivityAt <= 0)
        return false;
    return now - lastEndUserActivityAt < NON_CRITICAL_IDLE_TIMEOUT_MS;
}
function shouldRunNonCriticalJob(jobName, now) {
    if (now === void 0) { now = Date.now(); }
    var active = hasRecentEndUserActivity(now);
    if (!active) {
        logger_js_1.logger.throttled(logRegistry_js_1.LogCode.SYS_INFO, "[IdleMode] Skipping non-critical job while idle", {
            jobName: jobName,
            idleTimeoutMs: NON_CRITICAL_IDLE_TIMEOUT_MS,
            lastEndUserActivityAt: lastEndUserActivityAt > 0
                ? new Date(lastEndUserActivityAt).toISOString()
                : null,
        }, IDLE_SKIP_LOG_WINDOW_MS);
    }
    return active;
}
