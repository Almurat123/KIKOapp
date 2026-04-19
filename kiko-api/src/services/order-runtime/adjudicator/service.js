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
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportSendAccepted = reportSendAccepted;
exports.reportTxByHashSeen = reportTxByHashSeen;
exports.reportReceiptSeen = reportReceiptSeen;
exports.reportWebhookSeen = reportWebhookSeen;
exports.reportRpcUncertain = reportRpcUncertain;
exports.bindOrderToTxHash = bindOrderToTxHash;
exports.getAdjudicatedSnapshot = getAdjudicatedSnapshot;
exports.hydrateSharedAdjudicatedSnapshot = hydrateSharedAdjudicatedSnapshot;
var rules_js_1 = require("./rules.js");
var store_js_1 = require("./store.js");
var confirmEvidence_js_1 = require("../../rpc/confirmEvidence.js");
function createEmptySnapshot(chainId, txHash, orderId) {
    var canonicalTxHash = (0, confirmEvidence_js_1.normalizeTxHash)(chainId, txHash) || undefined;
    return {
        orderId: orderId,
        chainId: chainId,
        canonicalTxHash: canonicalTxHash,
        allTxHashes: canonicalTxHash ? [canonicalTxHash] : [],
        send: { accepted: false },
        txByHash: { seen: false },
        receipt: { seen: false },
        webhook: { seen: false },
        adjudicated: {
            state: 'unknown',
            reasonCode: 'none',
            decidedAt: Date.now(),
            final: false
        }
    };
}
function getOrCreate(params) {
    var existing = (params.orderId ? (0, store_js_1.getSnapshotByOrderId)(params.orderId) : null)
        || (params.txHash ? (0, store_js_1.getSnapshotByTxHash)(params.chainId, params.txHash) : null);
    if (existing)
        return existing;
    return createEmptySnapshot(params.chainId, params.txHash, params.orderId);
}
function normalizeAndStore(snapshot) {
    var canonical = snapshot.canonicalTxHash || snapshot.allTxHashes[0];
    if (canonical) {
        snapshot.canonicalTxHash = (0, confirmEvidence_js_1.normalizeTxHash)(snapshot.chainId, canonical) || canonical;
        if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash)) {
            snapshot.allTxHashes.unshift(snapshot.canonicalTxHash);
        }
    }
    var adjudicated = (0, rules_js_1.adjudicateSnapshot)(snapshot);
    return (0, store_js_1.upsertSnapshot)(adjudicated);
}
function reportSendAccepted(params) {
    var snapshot = getOrCreate(params);
    snapshot.orderId = snapshot.orderId || params.orderId;
    snapshot.canonicalTxHash = (0, confirmEvidence_js_1.normalizeTxHash)(params.chainId, params.txHash) || String(params.txHash);
    if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash))
        snapshot.allTxHashes.push(snapshot.canonicalTxHash);
    snapshot.send = {
        accepted: true,
        source: params.source || 'unknown',
        acceptedAt: snapshot.send.acceptedAt || Date.now()
    };
    (0, store_js_1.bindOrderId)(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
    return normalizeAndStore(snapshot);
}
function reportTxByHashSeen(params) {
    var snapshot = getOrCreate(params);
    snapshot.orderId = snapshot.orderId || params.orderId;
    snapshot.canonicalTxHash = snapshot.canonicalTxHash || (0, confirmEvidence_js_1.normalizeTxHash)(params.chainId, params.txHash) || String(params.txHash);
    if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash))
        snapshot.allTxHashes.push(snapshot.canonicalTxHash);
    snapshot.txByHash = {
        seen: true,
        from: params.from || snapshot.txByHash.from,
        blockNumber: params.blockNumber || snapshot.txByHash.blockNumber,
        seenAt: snapshot.txByHash.seenAt || Date.now(),
        source: params.source || 'rpc_tx',
        rpcError: params.rpcError || snapshot.txByHash.rpcError
    };
    (0, store_js_1.bindOrderId)(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
    return normalizeAndStore(snapshot);
}
function reportReceiptSeen(params) {
    var snapshot = getOrCreate(params);
    snapshot.orderId = snapshot.orderId || params.orderId;
    snapshot.canonicalTxHash = snapshot.canonicalTxHash || (0, confirmEvidence_js_1.normalizeTxHash)(params.chainId, params.txHash) || String(params.txHash);
    if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash))
        snapshot.allTxHashes.push(snapshot.canonicalTxHash);
    snapshot.receipt = {
        seen: true,
        success: params.success,
        blockNumber: params.blockNumber || snapshot.receipt.blockNumber,
        seenAt: snapshot.receipt.seenAt || Date.now(),
        source: params.source || 'rpc_receipt',
        rpcError: params.rpcError || snapshot.receipt.rpcError
    };
    (0, store_js_1.bindOrderId)(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
    return normalizeAndStore(snapshot);
}
function reportWebhookSeen(params) {
    var snapshot = getOrCreate(params);
    snapshot.orderId = snapshot.orderId || params.orderId;
    snapshot.canonicalTxHash = snapshot.canonicalTxHash || (0, confirmEvidence_js_1.normalizeTxHash)(params.chainId, params.txHash) || String(params.txHash);
    if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash))
        snapshot.allTxHashes.push(snapshot.canonicalTxHash);
    snapshot.webhook = {
        seen: true,
        source: params.source || 'alchemy_webhook',
        seenAt: snapshot.webhook.seenAt || Date.now(),
        matchedWallet: params.matchedWallet || snapshot.webhook.matchedWallet
    };
    (0, store_js_1.bindOrderId)(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
    return normalizeAndStore(snapshot);
}
function reportRpcUncertain(params) {
    var snapshot = getOrCreate(params);
    snapshot.orderId = snapshot.orderId || params.orderId;
    snapshot.canonicalTxHash = snapshot.canonicalTxHash || (0, confirmEvidence_js_1.normalizeTxHash)(params.chainId, params.txHash) || String(params.txHash);
    if (!snapshot.allTxHashes.includes(snapshot.canonicalTxHash))
        snapshot.allTxHashes.push(snapshot.canonicalTxHash);
    snapshot.txByHash.rpcError = params.error;
    snapshot.receipt.rpcError = params.error;
    (0, store_js_1.bindOrderId)(snapshot.orderId, snapshot.chainId, snapshot.canonicalTxHash);
    return normalizeAndStore(snapshot);
}
function bindOrderToTxHash(orderId, chainId, txHash) {
    (0, store_js_1.bindOrderId)(orderId, chainId, txHash);
}
function getAdjudicatedSnapshot(params) {
    if (params.orderId)
        return (0, store_js_1.getSnapshotByOrderId)(params.orderId);
    if (params.chainId && params.txHash)
        return (0, store_js_1.getSnapshotByTxHash)(params.chainId, params.txHash);
    return null;
}
function hydrateSharedAdjudicatedSnapshot(params) {
    return __awaiter(this, void 0, void 0, function () {
        var byOrder;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!params.orderId) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, store_js_1.hydrateSharedSnapshotByOrderId)(params.orderId)];
                case 1:
                    byOrder = _a.sent();
                    if (byOrder)
                        return [2 /*return*/, byOrder];
                    _a.label = 2;
                case 2:
                    if (params.chainId && params.txHash) {
                        return [2 /*return*/, (0, store_js_1.hydrateSharedSnapshotByTxHash)(params.chainId, params.txHash)];
                    }
                    return [2 /*return*/, null];
            }
        });
    });
}
