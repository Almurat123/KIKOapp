"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateUpcomingRpcBurstSize = estimateUpcomingRpcBurstSize;
exports.computeProjectedCapacityPressure = computeProjectedCapacityPressure;
function estimateUpcomingRpcBurstSize(params) {
    var method = String(params.method || '');
    if (method === 'eth_sendRawTransaction') {
        return params.purpose === 'trade_execution' ? 2 : 1;
    }
    if (method === 'eth_estimateGas') {
        return params.purpose === 'trade_execution' ? 3 : 2;
    }
    if (method === 'eth_getTransactionReceipt' || method === 'eth_getTransactionByHash') {
        return 2;
    }
    if (method === 'eth_call') {
        if (params.purpose === 'trade_execution')
            return 3;
        if (params.purpose === 'tx_visibility')
            return 2;
        return params.lane === 'route_read' || params.importance === 'critical' ? 2 : 1;
    }
    if (params.lane === 'route_read' && params.importance === 'critical') {
        return 2;
    }
    return 1;
}
function computeProjectedCapacityPressure(params) {
    var burstSize = estimateUpcomingRpcBurstSize({
        method: params.method,
        lane: params.lane,
        importance: params.importance,
        purpose: params.purpose,
    });
    var limits = params.endpoint.limits || {};
    var reservedSecondCount = Math.max(0, params.usage.reservedSecondCount || 0);
    var reservedMinuteCount = Math.max(0, params.usage.reservedMinuteCount || 0);
    var projectedRpsPressure = limits.rps
        ? (params.usage.secondCount + reservedSecondCount + burstSize) / Math.max(1, limits.rps)
        : 0;
    var projectedRpmPressure = limits.rpm
        ? (params.usage.minuteCount + reservedMinuteCount + burstSize) / Math.max(1, limits.rpm)
        : 0;
    var projectedInFlightPressure = limits.maxInFlight
        ? (params.usage.inFlight + 1) / Math.max(1, limits.maxInFlight)
        : 0;
    return {
        burstSize: burstSize,
        projectedPressure: Math.max(projectedRpsPressure, projectedRpmPressure, projectedInFlightPressure),
        projectedRpsPressure: projectedRpsPressure,
        projectedRpmPressure: projectedRpmPressure,
        projectedInFlightPressure: projectedInFlightPressure,
    };
}
