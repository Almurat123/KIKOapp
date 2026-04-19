"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRpcSelectionExplain = buildRpcSelectionExplain;
function maskEndpoint(url) {
    return url.replace(/[a-zA-Z0-9]{32,}/g, '***');
}
function buildRpcSelectionExplain(params) {
    var _a, _b, _c, _d;
    return {
        method: params.method,
        importance: params.importance,
        lane: ((_a = params.upgradeDecision) === null || _a === void 0 ? void 0 : _a.lane) || ((_b = params.scores[0]) === null || _b === void 0 ? void 0 : _b.lane) || 'background',
        strategy: params.strategy,
        upgradedToFast: Boolean((_c = params.upgradeDecision) === null || _c === void 0 ? void 0 : _c.upgrade),
        upgradeReasons: ((_d = params.upgradeDecision) === null || _d === void 0 ? void 0 : _d.reasons) || [],
        selectedEndpoints: params.selectedEndpoints.map(function (endpoint) { return maskEndpoint(endpoint.url); }),
        topScores: params.scores.slice(0, 5).map(function (row) { return ({
            endpoint: maskEndpoint(row.endpoint.url),
            type: row.endpoint.type,
            score: Number(row.score.toFixed(3)),
            reasons: row.reasons.slice(0, 8)
        }); })
    };
}
