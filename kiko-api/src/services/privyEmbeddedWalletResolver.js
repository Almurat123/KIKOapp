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
exports.fetchPrivyEmbeddedWalletInfo = fetchPrivyEmbeddedWalletInfo;
var errorHandler_js_1 = require("../middleware/errorHandler.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var logger_js_1 = require("../utils/logger.js");
var walletInfoCache = new Map();
var WALLET_INFO_CACHE_TTL_MS = Number(process.env.PRIVY_WALLET_INFO_CACHE_TTL_MS || '600000');
function isLikelyEvmAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(value || ''));
}
function isPrivyEmbeddedWalletAccount(account) {
    if ((account === null || account === void 0 ? void 0 : account.type) !== 'wallet')
        return false;
    var walletClientType = String((account === null || account === void 0 ? void 0 : account.walletClientType) || '').toLowerCase();
    if (walletClientType && walletClientType !== 'privy')
        return false;
    return typeof (account === null || account === void 0 ? void 0 : account.address) === 'string' && account.address.length > 0;
}
function resolveEmbeddedWallet(user, chainType) {
    var linkedWallets = ((user === null || user === void 0 ? void 0 : user.linkedAccounts) || []).filter(isPrivyEmbeddedWalletAccount);
    var evmWallet = linkedWallets.find(function (account) {
        return String((account === null || account === void 0 ? void 0 : account.chainType) || '').toLowerCase() === 'ethereum' && isLikelyEvmAddress(account === null || account === void 0 ? void 0 : account.address);
    })
        || linkedWallets.find(function (account) { return isLikelyEvmAddress(account === null || account === void 0 ? void 0 : account.address); })
        || null;
    var solanaWallet = linkedWallets.find(function (account) { return String((account === null || account === void 0 ? void 0 : account.chainType) || '').toLowerCase() === 'solana'; })
        || linkedWallets.find(function (account) { return !isLikelyEvmAddress(account === null || account === void 0 ? void 0 : account.address); })
        || null;
    var embeddedWallet = chainType === 'ethereum'
        ? evmWallet
        : chainType === 'solana'
            ? solanaWallet
            : (evmWallet || solanaWallet || linkedWallets[0] || null);
    return {
        linkedWallets: linkedWallets,
        embeddedWallet: embeddedWallet,
    };
}
function fetchPrivyEmbeddedWalletInfo(userId, deps) {
    return __awaiter(this, void 0, void 0, function () {
        var chainType, cacheKey, cached, maxRetries, lastError, _loop_1, attempt, state_1, lastErrorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainType = deps.chainType || 'auto';
                    cacheKey = "".concat(userId, ":").concat(chainType);
                    cached = walletInfoCache.get(cacheKey);
                    if (cached && Date.now() - cached.ts < WALLET_INFO_CACHE_TTL_MS) {
                        return [2 /*return*/, cached.info];
                    }
                    maxRetries = 3;
                    lastError = null;
                    _loop_1 = function (attempt) {
                        var user, _b, linkedWallets, embeddedWallet, result, error_1, delayMs_1;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 5]);
                                    return [4 /*yield*/, deps.getUser(userId)];
                                case 1:
                                    user = _c.sent();
                                    _b = resolveEmbeddedWallet(user, chainType), linkedWallets = _b.linkedWallets, embeddedWallet = _b.embeddedWallet;
                                    if (!embeddedWallet) {
                                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'User has no embedded wallet for requested chain', {
                                            userId: userId,
                                            chainType: chainType,
                                            linkedWalletCount: linkedWallets.length,
                                            linkedChains: linkedWallets.map(function (account) { return String((account === null || account === void 0 ? void 0 : account.chainType) || 'unknown'); }),
                                        });
                                        walletInfoCache.set(cacheKey, { info: null, ts: Date.now() });
                                        return [2 /*return*/, { value: null }];
                                    }
                                    result = {
                                        address: String(embeddedWallet.address || ''),
                                        id: String(embeddedWallet.id || embeddedWallet.address || ''),
                                    };
                                    walletInfoCache.set(cacheKey, { info: result, ts: Date.now() });
                                    return [2 /*return*/, { value: result }];
                                case 2:
                                    error_1 = _c.sent();
                                    lastError = error_1;
                                    if (!(attempt < maxRetries - 1)) return [3 /*break*/, 4];
                                    delayMs_1 = 500 * Math.pow(2, attempt);
                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, "Privy wallet fetch failed, retrying in ".concat(delayMs_1, "ms"), {
                                        userId: userId,
                                        attempt: attempt + 1,
                                        maxRetries: maxRetries,
                                        error: (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1),
                                    });
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delayMs_1); })];
                                case 3:
                                    _c.sent();
                                    _c.label = 4;
                                case 4: return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempt < maxRetries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt += 1;
                    return [3 /*break*/, 1];
                case 4:
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'Error getting user wallet from Privy after retries', {
                        userId: userId,
                        attempts: maxRetries,
                        error: lastError === null || lastError === void 0 ? void 0 : lastError.message,
                    });
                    lastErrorMessage = String((lastError === null || lastError === void 0 ? void 0 : lastError.message) || '');
                    if (lastErrorMessage.toLowerCase().includes('invalid app id or app secret')) {
                        throw new errorHandler_js_1.AppError(503, 'Privy server credentials are invalid on the API server. Check PRIVY_APP_ID and PRIVY_APP_SECRET.', 'PRIVY_INVALID_SERVER_CONFIG');
                    }
                    throw new errorHandler_js_1.AppError(500, 'Failed to get user wallet', 'WALLET_ERROR');
            }
        });
    });
}
