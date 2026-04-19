"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.upsertPendingAttributedPosition = upsertPendingAttributedPosition;
exports.cancelPendingAttributedPosition = cancelPendingAttributedPosition;
exports.markPendingAttributedPositionAccepted = markPendingAttributedPositionAccepted;
exports.markPendingAttributedPositionSendStarted = markPendingAttributedPositionSendStarted;
exports.armPendingAttributedPositionsForMirrorSell = armPendingAttributedPositionsForMirrorSell;
exports.listPendingAttributedPositions = listPendingAttributedPositions;
exports.consumePendingAttributedPositions = consumePendingAttributedPositions;
exports.getPendingAttributedPositionById = getPendingAttributedPositionById;
var prisma_js_1 = require("../../../db/prisma.js");
var positionDecimalCodec_js_1 = require("./positionDecimalCodec.js");
function isOnchainTxHash(value) {
    var normalized = String(value || '').trim().toLowerCase();
    return /^0x[a-f0-9]{64}$/.test(normalized);
}
function normalizeOptionalAmount(value) {
    var raw = String(value || '').trim();
    return raw ? raw : null;
}
function upsertPendingAttributedPosition(params) {
    return __awaiter(this, void 0, void 0, function () {
        var encoded, expectedAmountRaw;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    encoded = (0, positionDecimalCodec_js_1.encodePositionTokenAmount)({
                        exactAmount: params.expectedAmountDec,
                    });
                    expectedAmountRaw = normalizeOptionalAmount(params.expectedAmountRaw);
                    return [4 /*yield*/, prisma_js_1.default.pendingAttributedPosition.upsert({
                            where: { positionId: params.positionId },
                            update: {
                                userId: params.userId,
                                chainId: params.chainId,
                                tokenAddress: params.tokenAddress,
                                entryTxHash: params.entryTxHash,
                                leaderBuyTxHash: params.leaderBuyTxHash || undefined,
                                expectedAmountRaw: expectedAmountRaw || undefined,
                                expectedAmountDec: encoded.decimalAmount || undefined,
                                status: 'armed',
                                reasonCode: params.reasonCode,
                                targetSellTxHash: null,
                                exitTxHash: null,
                                consumedAt: null,
                            },
                            create: {
                                positionId: params.positionId,
                                userId: params.userId,
                                chainId: params.chainId,
                                tokenAddress: params.tokenAddress,
                                entryTxHash: params.entryTxHash,
                                leaderBuyTxHash: params.leaderBuyTxHash || undefined,
                                expectedAmountRaw: expectedAmountRaw || undefined,
                                expectedAmountDec: encoded.decimalAmount || undefined,
                                status: 'armed',
                                reasonCode: params.reasonCode,
                            },
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function cancelPendingAttributedPosition(params) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!params.positionId)
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, prisma_js_1.default.pendingAttributedPosition.updateMany({
                            where: {
                                positionId: params.positionId,
                                status: { in: ['armed', 'sell_armed'] },
                            },
                            data: {
                                status: 'cancelled',
                                reasonCode: params.reasonCode,
                                consumedAt: new Date(),
                            },
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.count];
            }
        });
    });
}
function markPendingAttributedPositionAccepted(params) {
    return __awaiter(this, void 0, void 0, function () {
        var positionId, entryTxHash, _a, pendingResult, positionResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    positionId = String(params.positionId || '').trim();
                    entryTxHash = String(params.entryTxHash || '').trim().toLowerCase();
                    if (!positionId || !isOnchainTxHash(entryTxHash))
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, Promise.all([
                            prisma_js_1.default.pendingAttributedPosition.updateMany({
                                where: {
                                    positionId: positionId,
                                    status: { in: ['armed', 'sell_armed'] },
                                },
                                data: {
                                    entryTxHash: entryTxHash,
                                    reasonCode: params.reasonCode,
                                },
                            }),
                            prisma_js_1.default.position.updateMany({
                                where: {
                                    id: positionId,
                                    status: { in: ['pending', 'pending_broadcast', 'broadcasted_unseen'] },
                                },
                                data: {
                                    entryTxHash: entryTxHash,
                                    status: (params.positionStatus || 'pending_broadcast'),
                                },
                            }),
                        ])];
                case 1:
                    _a = _b.sent(), pendingResult = _a[0], positionResult = _a[1];
                    return [2 /*return*/, Math.max(pendingResult.count, positionResult.count)];
            }
        });
    });
}
function markPendingAttributedPositionSendStarted(params) {
    return __awaiter(this, void 0, void 0, function () {
        var positionId, _a, pendingResult, positionResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    positionId = String(params.positionId || '').trim();
                    if (!positionId)
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, Promise.all([
                            prisma_js_1.default.pendingAttributedPosition.updateMany({
                                where: {
                                    positionId: positionId,
                                    status: { in: ['armed', 'sell_armed'] },
                                },
                                data: {
                                    reasonCode: params.reasonCode,
                                },
                            }),
                            prisma_js_1.default.position.updateMany({
                                where: {
                                    id: positionId,
                                    status: { in: ['pending', 'pending_broadcast', 'broadcasted_unseen'] },
                                },
                                data: {
                                    status: (params.positionStatus || 'pending_broadcast'),
                                },
                            }),
                        ])];
                case 1:
                    _a = _b.sent(), pendingResult = _a[0], positionResult = _a[1];
                    return [2 /*return*/, Math.max(pendingResult.count, positionResult.count)];
            }
        });
    });
}
function armPendingAttributedPositionsForMirrorSell(params) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (params.positionIds.length === 0)
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, prisma_js_1.default.pendingAttributedPosition.updateMany({
                            where: {
                                userId: params.userId,
                                chainId: params.chainId,
                                tokenAddress: params.tokenAddress,
                                positionId: { in: params.positionIds },
                                status: { in: ['armed', 'sell_armed'] },
                            },
                            data: {
                                status: 'sell_armed',
                                targetSellTxHash: params.targetSellTxHash || undefined,
                                reasonCode: params.reasonCode,
                            },
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.count];
            }
        });
    });
}
function listPendingAttributedPositions(params) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            return [2 /*return*/, prisma_js_1.default.pendingAttributedPosition.findMany({
                    where: __assign(__assign(__assign(__assign({}, (params.userId ? { userId: params.userId } : {})), { chainId: params.chainId, tokenAddress: params.tokenAddress }), (((_a = params.statuses) === null || _a === void 0 ? void 0 : _a.length) ? { status: { in: params.statuses } } : {})), (((_b = params.positionIds) === null || _b === void 0 ? void 0 : _b.length) ? { positionId: { in: params.positionIds } } : {})),
                    orderBy: { createdAt: 'asc' },
                })];
        });
    });
}
function consumePendingAttributedPositions(params) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (params.positionIds.length === 0)
                        return [2 /*return*/, 0];
                    return [4 /*yield*/, prisma_js_1.default.pendingAttributedPosition.updateMany({
                            where: {
                                positionId: { in: params.positionIds },
                                status: { in: ['armed', 'sell_armed'] },
                            },
                            data: {
                                status: 'consumed',
                                exitTxHash: params.exitTxHash,
                                reasonCode: params.reasonCode,
                                consumedAt: new Date(),
                            },
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.count];
            }
        });
    });
}
function getPendingAttributedPositionById(positionId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!positionId)
                return [2 /*return*/, null];
            return [2 /*return*/, prisma_js_1.default.pendingAttributedPosition.findUnique({
                    where: { positionId: positionId },
                })];
        });
    });
}
