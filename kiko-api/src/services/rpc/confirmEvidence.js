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
exports.normalizeTxHash = normalizeTxHash;
exports.mergeTxHashAliases = mergeTxHashAliases;
var txIdentity_js_1 = require("../../utils/txIdentity.js");
function normalizeTxHash(chainId, txHash) {
    return (0, txIdentity_js_1.normalizeTxIdentity)(chainId, txHash);
}
function mergeTxHashAliases(chainId, existing, txHashes) {
    var seen = new Set();
    var out = [];
    for (var _i = 0, _a = __spreadArray(__spreadArray([], existing, true), txHashes, true); _i < _a.length; _i++) {
        var raw = _a[_i];
        var normalized = normalizeTxHash(chainId, raw);
        if (!normalized || seen.has(normalized))
            continue;
        seen.add(normalized);
        out.push(normalized);
    }
    return out;
}
