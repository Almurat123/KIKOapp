"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
exports.getSnapshotByTxHash = getSnapshotByTxHash;
exports.getSnapshotByOrderId = getSnapshotByOrderId;
exports.upsertSnapshot = upsertSnapshot;
exports.bindOrderId = bindOrderId;
exports.hydrateSharedSnapshotByTxHash = hydrateSharedSnapshotByTxHash;
exports.hydrateSharedSnapshotByOrderId = hydrateSharedSnapshotByOrderId;
var cacheClient_js_1 = require("../../../cache/cacheClient.js");
var confirmEvidence_js_1 = require("../../rpc/confirmEvidence.js");
var byTxHash = new Map();
var byOrderId = new Map();
var SNAPSHOT_TTL_SEC = Math.max(60, Number(process.env.COPYTRADE_ADJUDICATOR_SNAPSHOT_TTL_SEC || '900'));
function txKey(chainId, txHash) {
    return "".concat(chainId, ":").concat(txHash);
}
function snapshotCacheKey(chainId, txHash) {
    return "copytrade:adjudicator:snapshot:".concat(chainId, ":").concat(txHash);
}
function orderCacheKey(orderId) {
    return "copytrade:adjudicator:order:".concat(orderId);
}
function persistSnapshotToMemory(snapshot) {
    var canonical = (0, confirmEvidence_js_1.normalizeTxHash)(snapshot.chainId, snapshot.canonicalTxHash) || snapshot.allTxHashes[0] || '';
    if (!canonical)
        return snapshot;
    snapshot.canonicalTxHash = canonical;
    var aliases = (0, confirmEvidence_js_1.mergeTxHashAliases)(snapshot.chainId, snapshot.allTxHashes, [canonical]);
    for (var _i = 0, aliases_1 = aliases; _i < aliases_1.length; _i++) {
        var alias = aliases_1[_i];
        byTxHash.set(txKey(snapshot.chainId, alias), snapshot);
    }
    if (snapshot.orderId)
        byOrderId.set(snapshot.orderId, txKey(snapshot.chainId, canonical));
    return snapshot;
}
function persistSnapshotToShared(snapshot) {
    return __awaiter(this, void 0, void 0, function () {
        var canonical, aliases;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    canonical = (0, confirmEvidence_js_1.normalizeTxHash)(snapshot.chainId, snapshot.canonicalTxHash) || snapshot.allTxHashes[0] || '';
                    if (!canonical)
                        return [2 /*return*/];
                    aliases = (0, confirmEvidence_js_1.mergeTxHashAliases)(snapshot.chainId, snapshot.allTxHashes, [canonical]);
                    return [4 /*yield*/, Promise.all(__spreadArray(__spreadArray([], aliases.map(function (alias) { return (0, cacheClient_js_1.setJson)(snapshotCacheKey(snapshot.chainId, alias), snapshot, SNAPSHOT_TTL_SEC).catch(function () { }); }), true), [
                            snapshot.orderId
                                ? (0, cacheClient_js_1.setJson)(orderCacheKey(snapshot.orderId), { chainId: snapshot.chainId, txHash: canonical }, SNAPSHOT_TTL_SEC).catch(function () { })
                                : Promise.resolve(),
                        ], false))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getSnapshotByTxHash(chainId, txHash) {
    var normalized = (0, confirmEvidence_js_1.normalizeTxHash)(chainId, txHash);
    if (!normalized)
        return null;
    return byTxHash.get(txKey(chainId, normalized)) || null;
}
function getSnapshotByOrderId(orderId) {
    if (!orderId)
        return null;
    var key = byOrderId.get(orderId);
    if (!key)
        return null;
    return byTxHash.get(key) || null;
}
function upsertSnapshot(snapshot) {
    snapshot.allTxHashes = (0, confirmEvidence_js_1.mergeTxHashAliases)(snapshot.chainId, snapshot.allTxHashes || [], [snapshot.canonicalTxHash]);
    var persisted = persistSnapshotToMemory(snapshot);
    void persistSnapshotToShared(persisted);
    return persisted;
}
function bindOrderId(orderId, chainId, txHash) {
    var normalized = (0, confirmEvidence_js_1.normalizeTxHash)(chainId, txHash);
    if (!orderId || !normalized)
        return;
    byOrderId.set(orderId, txKey(chainId, normalized));
    void (0, cacheClient_js_1.setJson)(orderCacheKey(orderId), { chainId: chainId, txHash: normalized }, SNAPSHOT_TTL_SEC).catch(function () { });
}
function hydrateSharedSnapshotByTxHash(chainId, txHash) {
    return __awaiter(this, void 0, void 0, function () {
        var normalized, cached;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    normalized = (0, confirmEvidence_js_1.normalizeTxHash)(chainId, txHash);
                    if (!normalized)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, (0, cacheClient_js_1.getJson)(snapshotCacheKey(chainId, normalized)).catch(function () { return null; })];
                case 1:
                    cached = _a.sent();
                    if (!cached)
                        return [2 /*return*/, null];
                    return [2 /*return*/, persistSnapshotToMemory(cached)];
            }
        });
    });
}
function hydrateSharedSnapshotByOrderId(orderId) {
    return __awaiter(this, void 0, void 0, function () {
        var pointer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!orderId)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, (0, cacheClient_js_1.getJson)(orderCacheKey(orderId)).catch(function () { return null; })];
                case 1:
                    pointer = _a.sent();
                    if (!(pointer === null || pointer === void 0 ? void 0 : pointer.chainId) || !(pointer === null || pointer === void 0 ? void 0 : pointer.txHash))
                        return [2 /*return*/, null];
                    return [2 /*return*/, hydrateSharedSnapshotByTxHash(pointer.chainId, pointer.txHash)];
            }
        });
    });
}
