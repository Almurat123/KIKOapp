"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreRpcEndpoint = scoreRpcEndpoint;
exports.sortRpcEndpointsByScore = sortRpcEndpointsByScore;
exports.buildRpcScoreTable = buildRpcScoreTable;
var policy_js_1 = require("./policy.js");
var prediction_js_1 = require("./prediction.js");
function scoreRpcEndpoint(params) {
    var endpoint = params.endpoint, method = params.method, importance = params.importance, now = params.now, health = params.health, usage = params.usage;
    var lane = (0, policy_js_1.inferRpcLane)(method, importance);
    var reasons = [];
    var score = 0;
    var successScore = (health.totalAttempts > 0 ? health.successRate : 0.7) * 12;
    score += successScore;
    reasons.push("success=".concat(successScore.toFixed(2)));
    var latencyScore = health.avgResponseTime > 0 ? Math.max(0, 1500 - health.avgResponseTime) / 300 : 1.5;
    score += latencyScore;
    reasons.push("latency=".concat(latencyScore.toFixed(2)));
    if ((0, policy_js_1.shouldPreferPremiumForPurpose)(params.purpose, lane, importance)) {
        if (endpoint.type === 'premium') {
            score += 3;
            reasons.push('premium_preferred');
        }
        else if (endpoint.type === 'public_free') {
            score -= 1;
            reasons.push('public_penalty');
        }
    }
    else if (lane === 'background') {
        if (endpoint.type === 'public_free') {
            score += 2;
            reasons.push('cheap_preferred');
        }
        else if (endpoint.type === 'premium') {
            score -= 0.75;
            reasons.push('premium_cost_penalty');
        }
    }
    if (health.circuitOpen) {
        score -= 6;
        reasons.push('circuit_open');
    }
    if (health.consecutiveFailures > 0) {
        var penalty = Math.min(3, health.consecutiveFailures * 0.6);
        score -= penalty;
        reasons.push("failures=-".concat(penalty.toFixed(2)));
    }
    var limits = endpoint.limits;
    if ((limits === null || limits === void 0 ? void 0 : limits.maxInFlight) && usage.inFlight >= limits.maxInFlight) {
        score -= lane === 'write' || lane === 'confirm' ? 4 : 2;
        reasons.push('maxInFlight_pressure');
    }
    if ((limits === null || limits === void 0 ? void 0 : limits.rps) && usage.secondCount >= limits.rps) {
        score -= lane === 'write' || lane === 'confirm' ? 3 : 1.5;
        reasons.push('rps_pressure');
    }
    if ((limits === null || limits === void 0 ? void 0 : limits.rpm) && usage.minuteCount >= limits.rpm) {
        score -= lane === 'write' || lane === 'confirm' ? 2 : 1;
        reasons.push('rpm_pressure');
    }
    var projected = (0, prediction_js_1.computeProjectedCapacityPressure)({
        endpoint: endpoint,
        usage: usage,
        method: method,
        lane: lane,
        importance: importance,
        purpose: params.purpose,
    });
    if (projected.projectedPressure >= 1) {
        var penalty = lane === 'write' || lane === 'confirm' ? 5 : 3.5;
        score -= penalty;
        reasons.push("predicted_cap=-".concat(penalty.toFixed(2)));
    }
    else if (projected.projectedPressure >= 0.9) {
        var penalty = lane === 'write' || lane === 'confirm' ? 2.5 : 1.75;
        score -= penalty;
        reasons.push("predicted_pressure=-".concat(penalty.toFixed(2)));
    }
    else if (projected.projectedPressure >= 0.75) {
        var penalty = lane === 'write' || lane === 'confirm' ? 1.5 : 1;
        score -= penalty;
        reasons.push("predicted_soft_pressure=-".concat(penalty.toFixed(2)));
    }
    if (now - usage.lastUsedAt < 50) {
        score -= lane === 'write' ? 0.1 : 0.25;
        reasons.push('recently_used');
    }
    if (endpoint.weight) {
        score += endpoint.weight;
        reasons.push("weight=".concat(endpoint.weight));
    }
    var priorityBonus = Math.max(0, 4 - Math.min(4, endpoint.priority || 4)) * 0.25;
    score += priorityBonus;
    reasons.push("priority=".concat(priorityBonus.toFixed(2)));
    return {
        endpoint: endpoint,
        lane: lane,
        score: score,
        reasons: reasons
    };
}
function sortRpcEndpointsByScore(params) {
    return params.endpoints
        .map(function (endpoint) { return scoreRpcEndpoint({
        endpoint: endpoint,
        method: params.method,
        importance: params.importance,
        purpose: params.purpose,
        now: params.now,
        health: params.getHealth(endpoint.url),
        usage: params.getUsage(endpoint.url)
    }); })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (row) { return row.endpoint; });
}
function buildRpcScoreTable(params) {
    return params.endpoints
        .map(function (endpoint) { return scoreRpcEndpoint({
        endpoint: endpoint,
        method: params.method,
        importance: params.importance,
        purpose: params.purpose,
        now: params.now,
        health: params.getHealth(endpoint.url),
        usage: params.getUsage(endpoint.url)
    }); })
        .sort(function (a, b) { return b.score - a.score; });
}
