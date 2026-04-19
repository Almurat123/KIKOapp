"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reserveProjectedEndpointUsage = reserveProjectedEndpointUsage;
exports.getProjectedEndpointUsage = getProjectedEndpointUsage;
exports.resetProjectedEndpointUsage = resetProjectedEndpointUsage;
var reservations = new Map();
function prune(url, now) {
    if (now === void 0) { now = Date.now(); }
    var active = (reservations.get(url) || []).filter(function (entry) { return entry.expiresAt > now; });
    if (active.length > 0) {
        reservations.set(url, active);
    }
    else {
        reservations.delete(url);
    }
    return active;
}
function reservationTtlMs(lane) {
    if (lane === 'write' || lane === 'confirm')
        return 1400;
    if (lane === 'route_read')
        return 900;
    return 500;
}
function reserveProjectedEndpointUsage(params) {
    var _a;
    var now = Date.now();
    var active = prune(params.url, now);
    active.push({
        secondUnits: Math.max(0, params.secondUnits),
        minuteUnits: Math.max(0, (_a = params.minuteUnits) !== null && _a !== void 0 ? _a : params.secondUnits),
        expiresAt: now + reservationTtlMs(params.lane),
    });
    reservations.set(params.url, active);
}
function getProjectedEndpointUsage(url) {
    var active = prune(url);
    return active.reduce(function (acc, entry) {
        acc.reservedSecondCount += entry.secondUnits;
        acc.reservedMinuteCount += entry.minuteUnits;
        return acc;
    }, { reservedSecondCount: 0, reservedMinuteCount: 0 });
}
function resetProjectedEndpointUsage() {
    reservations.clear();
}
