"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beginCriticalRpcWindow = beginCriticalRpcWindow;
exports.hasCriticalRpcPressure = hasCriticalRpcPressure;
exports.getCriticalRpcPressureSnapshot = getCriticalRpcPressureSnapshot;
var ACTIVE_HOLD_MS = Math.max(500, Number(process.env.RPC_BACKGROUND_HOLD_MS || '6000'));
var activeCriticalContexts = new Map();
var lastCriticalAt = 0;
function beginCriticalRpcWindow(label) {
    var current = (activeCriticalContexts.get(label) || 0) + 1;
    activeCriticalContexts.set(label, current);
    lastCriticalAt = Date.now();
    var released = false;
    return function () {
        if (released)
            return;
        released = true;
        var next = Math.max(0, (activeCriticalContexts.get(label) || 1) - 1);
        if (next === 0)
            activeCriticalContexts.delete(label);
        else
            activeCriticalContexts.set(label, next);
        lastCriticalAt = Date.now();
    };
}
function hasCriticalRpcPressure() {
    if (activeCriticalContexts.size > 0)
        return true;
    return Date.now() - lastCriticalAt < ACTIVE_HOLD_MS;
}
function getCriticalRpcPressureSnapshot() {
    return {
        activeContexts: activeCriticalContexts.size,
        lastCriticalAt: lastCriticalAt,
        active: hasCriticalRpcPressure()
    };
}
