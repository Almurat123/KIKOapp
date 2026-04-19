"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferRpcLane = inferRpcLane;
exports.shouldPreferPremium = shouldPreferPremium;
exports.shouldPreferPremiumForPurpose = shouldPreferPremiumForPurpose;
exports.shouldUpgradeRpcStrategy = shouldUpgradeRpcStrategy;
var prediction_js_1 = require("./prediction.js");
var purpose_js_1 = require("./purpose.js");
function inferRpcLane(method, importance) {
    if (method === 'eth_sendRawTransaction' || method === 'eth_getTransactionCount' || method === 'eth_feeHistory' || method === 'eth_maxPriorityFeePerGas') {
        return 'write';
    }
    if (method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt') {
        return 'confirm';
    }
    if (importance === 'critical') {
        return 'route_read';
    }
    return 'background';
}
function shouldPreferPremium(lane, importance) {
    if (lane === 'write' || lane === 'confirm')
        return true;
    return importance === 'critical' && lane === 'route_read';
}
function shouldPreferPremiumForPurpose(purpose, lane, importance) {
    if (purpose) {
        return (0, purpose_js_1.getRpcPurposeProfile)(purpose).premiumFirst;
    }
    return shouldPreferPremium(lane || 'background', importance || 'normal');
}
function shouldUpgradeRpcStrategy(params) {
    var lane = inferRpcLane(params.method, params.importance);
    if (params.purpose) {
        var profile = (0, purpose_js_1.getRpcPurposeProfile)(params.purpose);
        if (!profile.allowPremiumEndpoints) {
            return { upgrade: false, lane: lane, reasons: ['purpose_disallows_premium_upgrade'] };
        }
    }
    var reasons = [];
    var top = params.endpoints.slice(0, 3);
    if (top.length === 0) {
        return { upgrade: false, lane: lane, reasons: ['no_endpoints'] };
    }
    var unhealthy = 0;
    var openCircuits = 0;
    var lowSuccess = 0;
    var predictedPressure = 0;
    var predictedHardCap = 0;
    for (var _i = 0, top_1 = top; _i < top_1.length; _i++) {
        var endpoint = top_1[_i];
        var health = params.getHealth(endpoint.url);
        var successRate = health.totalAttempts > 0 ? health.successRate : 1;
        if (health.circuitOpen) {
            openCircuits += 1;
            unhealthy += 1;
            continue;
        }
        if (health.totalAttempts >= 10 && successRate < (lane === 'background' ? 0.5 : 0.8)) {
            lowSuccess += 1;
            unhealthy += 1;
        }
        var projected = (0, prediction_js_1.computeProjectedCapacityPressure)({
            endpoint: endpoint,
            usage: params.getUsage
                ? params.getUsage(endpoint.url)
                : { inFlight: 0, secondCount: 0, minuteCount: 0, lastUsedAt: 0 },
            method: params.method,
            lane: lane,
            importance: params.importance,
            purpose: params.purpose,
        });
        if (projected.projectedPressure >= 0.9) {
            predictedPressure += 1;
        }
        if (projected.projectedPressure >= 1) {
            predictedHardCap += 1;
        }
    }
    if (openCircuits > 0)
        reasons.push("open_circuit:".concat(openCircuits));
    if (lowSuccess > 0)
        reasons.push("low_success:".concat(lowSuccess));
    if (predictedPressure > 0)
        reasons.push("predicted_pressure:".concat(predictedPressure));
    if (predictedHardCap > 0)
        reasons.push("predicted_hard_cap:".concat(predictedHardCap));
    var upgrade = lane === 'write' || lane === 'confirm'
        ? unhealthy >= 1 || predictedPressure >= 1
        : unhealthy === top.length || predictedPressure >= Math.max(1, Math.min(2, top.length));
    if (upgrade && reasons.length === 0) {
        reasons.push('lane_policy_upgrade');
    }
    return { upgrade: upgrade, lane: lane, reasons: reasons };
}
