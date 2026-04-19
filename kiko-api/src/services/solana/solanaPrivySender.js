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
exports.__solanaPrivySenderTest = void 0;
exports.sendSolanaTransactionWithContextDeps = sendSolanaTransactionWithContextDeps;
exports.sendSolanaTransactionWithDeps = sendSolanaTransactionWithDeps;
var errorHandler_js_1 = require("../../middleware/errorHandler.js");
var logger_js_1 = require("../../utils/logger.js");
var logRegistry_js_1 = require("../../config/logRegistry.js");
var solanaSigningContext_js_1 = require("./solanaSigningContext.js");
var SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
function sendSolanaTransactionWithContextDeps(userId, transactionBase64, context, deps) {
    return __awaiter(this, void 0, void 0, function () {
        var transactionBuffer, transaction, response, error_1, errorMessage, errorCode, errorStatus, errorDetails_1, detailsPreview, lower;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Sending Solana transaction via Privy', {
                        walletSource: context.walletSource,
                        hasWalletId: true,
                        walletIdPrefix: context.walletId.slice(0, 12),
                        address: context.address,
                        userId: userId,
                        reasonCode: context.reasonCode,
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    transactionBuffer = Buffer.from(transactionBase64, 'base64');
                    transaction = deps.deserializeTransaction(transactionBuffer);
                    return [4 /*yield*/, deps.signAndSendTransaction({
                            walletId: context.walletId,
                            caip2: SOLANA_MAINNET_CAIP2,
                            transaction: transaction,
                        })];
                case 2:
                    response = _b.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Solana transaction sent via Privy', {
                        txHash: response.hash,
                        walletSource: context.walletSource,
                        reasonCode: context.reasonCode,
                    });
                    return [2 /*return*/, response.hash];
                case 3:
                    error_1 = _b.sent();
                    errorMessage = String((error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || 'Unknown error');
                    errorCode = String((error_1 === null || error_1 === void 0 ? void 0 : error_1.code) || (error_1 === null || error_1 === void 0 ? void 0 : error_1.status) || '');
                    errorStatus = Number((error_1 === null || error_1 === void 0 ? void 0 : error_1.status) || (error_1 === null || error_1 === void 0 ? void 0 : error_1.statusCode) || 0) || undefined;
                    errorDetails_1 = ((_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _a === void 0 ? void 0 : _a.data)
                        || (error_1 === null || error_1 === void 0 ? void 0 : error_1.data)
                        || (error_1 === null || error_1 === void 0 ? void 0 : error_1.details)
                        || null;
                    detailsPreview = (function () {
                        try {
                            if (!errorDetails_1)
                                return '';
                            var text = JSON.stringify(errorDetails_1);
                            return text.length > 300 ? "".concat(text.slice(0, 300), "...") : text;
                        }
                        catch (_a) {
                            return String(errorDetails_1 || '');
                        }
                    })();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.EXE_TX_REVERTED, "Solana transaction failed via Privy source=".concat(context.walletSource, " reason=").concat(context.reasonCode, " code=").concat(errorCode || 'n/a', " status=").concat(errorStatus || 'n/a', " error=").concat(errorMessage).concat(detailsPreview ? " details=".concat(detailsPreview) : ''), {
                        error: errorMessage,
                        code: errorCode || undefined,
                        status: errorStatus,
                        details: errorDetails_1,
                        userId: userId,
                        walletSource: context.walletSource,
                        reasonCode: context.reasonCode,
                    });
                    lower = errorMessage.toLowerCase();
                    if (lower.includes('not delegated')) {
                        throw new errorHandler_js_1.AppError(403, 'User has not enabled Solana server-side signing delegation.', 'DELEGATION_REQUIRED');
                    }
                    if (lower.includes('insufficient') || lower.includes('lamports')) {
                        throw new errorHandler_js_1.AppError(400, "Failed to send Solana transaction: ".concat(errorMessage), 'INSUFFICIENT_FUNDS');
                    }
                    throw new errorHandler_js_1.AppError(500, "Failed to send Solana transaction: ".concat(errorMessage), 'SOLANA_TRANSACTION_FAILED');
                case 4: return [2 /*return*/];
            }
        });
    });
}
function sendSolanaTransactionWithDeps(userId, transactionBase64, deps) {
    return __awaiter(this, void 0, void 0, function () {
        var context;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, solanaSigningContext_js_1.resolveSolanaSigningContext)(userId, deps)];
                case 1:
                    context = _a.sent();
                    return [2 /*return*/, sendSolanaTransactionWithContextDeps(userId, transactionBase64, context, deps)];
            }
        });
    });
}
exports.__solanaPrivySenderTest = {
    resolveSolanaSigningContext: solanaSigningContext_js_1.resolveSolanaSigningContext,
    sendSolanaTransactionWithContextDeps: sendSolanaTransactionWithContextDeps,
    sendSolanaTransactionWithDeps: sendSolanaTransactionWithDeps,
};
