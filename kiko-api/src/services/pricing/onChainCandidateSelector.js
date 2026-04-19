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
exports.selectBestOnChainPriceCandidate = selectBestOnChainPriceCandidate;
function candidateWeight(candidate) {
    var score = 0;
    if (candidate.sourceKind === 'router')
        score += 4;
    if (candidate.version === 'v2')
        score += 3;
    if (candidate.version === 'aerodrome')
        score += 3;
    if (candidate.version === 'v3')
        score += 2;
    if (candidate.version === 'v4' || candidate.version === 'v4-pool')
        score += 2;
    if (candidate.version === 'bonding')
        score += 1;
    if (candidate.quoteIsStable)
        score += 1;
    var dexName = String(candidate.data.dexName || '').toLowerCase();
    if (dexName.includes('pancake'))
        score += 1;
    return score;
}
function priceRatio(a, b) {
    var high = Math.max(a, b);
    var low = Math.min(a, b);
    if (!Number.isFinite(high) || !Number.isFinite(low) || low <= 0)
        return Number.POSITIVE_INFINITY;
    return high / low;
}
function selectBestOnChainPriceCandidate(candidates, options) {
    if (options === void 0) { options = {}; }
    var valid = candidates.filter(function (candidate) { return Number.isFinite(candidate.data.price) && candidate.data.price > 0; });
    if (!valid.length)
        return null;
    if (valid.length === 1) {
        return { selected: valid[0], clusterSize: 1, discarded: [] };
    }
    var maxClusterRatio = Math.max(1.05, Number(options.maxClusterRatio || 1.5));
    var bestCluster = [valid[0]];
    var bestClusterScore = -1;
    var _loop_1 = function (anchor) {
        var cluster = valid.filter(function (candidate) { return priceRatio(anchor.data.price, candidate.data.price) <= maxClusterRatio; });
        var clusterScore = cluster.length * 100 + cluster.reduce(function (sum, candidate) { return sum + candidateWeight(candidate); }, 0);
        if (clusterScore > bestClusterScore) {
            bestCluster = cluster;
            bestClusterScore = clusterScore;
        }
    };
    for (var _i = 0, valid_1 = valid; _i < valid_1.length; _i++) {
        var anchor = valid_1[_i];
        _loop_1(anchor);
    }
    var clusterMedian = __spreadArray([], bestCluster, true).map(function (candidate) { return candidate.data.price; })
        .sort(function (left, right) { return left - right; })[Math.floor(bestCluster.length / 2)];
    var selected = __spreadArray([], bestCluster, true).sort(function (left, right) {
        var weightDiff = candidateWeight(right) - candidateWeight(left);
        if (weightDiff !== 0)
            return weightDiff;
        var leftDistance = Math.abs(left.data.price - clusterMedian);
        var rightDistance = Math.abs(right.data.price - clusterMedian);
        return leftDistance - rightDistance;
    })[0];
    var discarded = valid.filter(function (candidate) { return candidate !== selected && !bestCluster.includes(candidate); });
    return {
        selected: selected,
        clusterSize: bestCluster.length,
        discarded: discarded
    };
}
