"use strict";
/**
 * Flashbots MEV Protection Service
 * Sends private transactions to avoid front-running and sandwich attacks
 *
 * [Ref]: https://docs.flashbots.net/flashbots-protect/overview
 * [Risk]: Only works on ETH mainnet (chainId: 1)
 */
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
exports.sendViaFlashbots = sendViaFlashbots;
exports.waitForFlashbotsConfirmation = waitForFlashbotsConfirmation;
exports.shouldUseMevProtection = shouldUseMevProtection;
exports.getBundleStatus = getBundleStatus;
var logger_js_1 = require("../../utils/logger.js");
var logRegistry_js_1 = require("../../config/logRegistry.js");
var rpcManager_js_1 = require("../rpcManager.js");
var apiEndpoints_js_1 = require("../../config/apiEndpoints.js");
/**
 * Send transaction via Flashbots Protect
 * [Logic]: Submits to private mempool, avoiding public exposure
 *
 * @param signedTx - Signed transaction hex string
 * @param chainId - Chain ID (must be 1 for Flashbots)
 * @param config - Flashbots configuration
 */
function sendViaFlashbots(signedTx_1, chainId_1) {
    return __awaiter(this, arguments, void 0, function (signedTx, chainId, config) {
        var endpoints, fast, standard, ordered, txHash, err_1;
        if (config === void 0) { config = { useFlashbots: true, preferFast: false, maxBlocksToWait: 25 }; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Flashbots only works on ETH mainnet
                    if (chainId !== 1) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Flashbots only supported on ETH mainnet', { chainId: chainId });
                        return [2 /*return*/, {
                                success: false,
                                error: 'Flashbots only supported on ETH mainnet',
                                usedFlashbots: false
                            }];
                    }
                    if (!config.useFlashbots) {
                        return [2 /*return*/, {
                                success: false,
                                error: 'Flashbots disabled',
                                usedFlashbots: false
                            }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    endpoints = (0, apiEndpoints_js_1.getFlashbotsEndpoints)();
                    fast = endpoints.find(function (ep) { return ep.name.toLowerCase().includes('fast'); });
                    standard = endpoints.find(function (ep) { return !ep.name.toLowerCase().includes('fast'); });
                    ordered = config.preferFast
                        ? [fast, standard].filter(Boolean)
                        : [standard, fast].filter(Boolean);
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, '🔒 Sending via Flashbots Protect', {
                        mode: config.preferFast ? 'fast' : 'standard'
                    });
                    return [4 /*yield*/, (0, rpcManager_js_1.callRpcCustom)(ordered.length > 0 ? ordered : endpoints, 'eth_sendRawTransaction', [signedTx], { importance: 'critical' })];
                case 2:
                    txHash = _a.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, '✅ Flashbots transaction submitted', {
                        txHash: txHash,
                        mode: config.preferFast ? 'fast' : 'standard'
                    });
                    return [2 /*return*/, {
                            success: true,
                            txHash: txHash,
                            usedFlashbots: true
                        }];
                case 3:
                    err_1 = _a.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Flashbots request failed', {
                        error: err_1.message
                    });
                    return [2 /*return*/, {
                            success: false,
                            error: err_1.message,
                            usedFlashbots: false
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Wait for Flashbots transaction confirmation
 * [Logic]: Poll for transaction receipt
 */
function waitForFlashbotsConfirmation(txHash_1, provider_1) {
    return __awaiter(this, arguments, void 0, function (txHash, provider, maxBlocksToWait) {
        var startBlock, i, receipt, _a, currentBlock;
        if (maxBlocksToWait === void 0) { maxBlocksToWait = 25; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, provider.getBlockNumber()];
                case 1:
                    startBlock = _b.sent();
                    i = 0;
                    _b.label = 2;
                case 2:
                    if (!(i < maxBlocksToWait)) return [3 /*break*/, 10];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, provider.getTransactionReceipt(txHash)];
                case 4:
                    receipt = _b.sent();
                    if (receipt) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, '✅ Flashbots tx confirmed', {
                            txHash: txHash,
                            blockNumber: receipt.blockNumber,
                            blocksWaited: i
                        });
                        return [2 /*return*/, { confirmed: true, receipt: receipt }];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    _a = _b.sent();
                    return [3 /*break*/, 6];
                case 6: 
                // Wait for next block (~12s on ETH mainnet)
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 3000); })];
                case 7:
                    // Wait for next block (~12s on ETH mainnet)
                    _b.sent();
                    return [4 /*yield*/, provider.getBlockNumber()];
                case 8:
                    currentBlock = _b.sent();
                    if (currentBlock >= startBlock + maxBlocksToWait) {
                        return [3 /*break*/, 10];
                    }
                    _b.label = 9;
                case 9:
                    i++;
                    return [3 /*break*/, 2];
                case 10:
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Flashbots tx not confirmed in time', {
                        txHash: txHash,
                        maxBlocksToWait: maxBlocksToWait
                    });
                    return [2 /*return*/, { confirmed: false }];
            }
        });
    });
}
/**
 * Check if MEV protection should be used based on transaction value
 * [Logic]: Large swaps benefit more from MEV protection
 */
function shouldUseMevProtection(amountInWei, chainId, forceEnable) {
    // Only ETH mainnet supports Flashbots
    if (chainId !== 1) {
        return false;
    }
    if (forceEnable === true) {
        return true;
    }
    if (forceEnable === false) {
        return false;
    }
    // Auto-enable for swaps > 0.5 ETH
    var threshold = BigInt('500000000000000000'); // 0.5 ETH
    return amountInWei >= threshold;
}
/**
 * Get Flashbots bundle status (for advanced usage)
 * [Ref]: https://docs.flashbots.net/flashbots-auction/advanced/bundle-status
 */
function getBundleStatus(bundleHash) {
    return __awaiter(this, void 0, void 0, function () {
        var endpoints, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    endpoints = (0, apiEndpoints_js_1.getFlashbotsEndpoints)();
                    return [4 /*yield*/, (0, rpcManager_js_1.callRpcCustom)(endpoints, 'flashbots_getBundleStats', [{ bundleHash: bundleHash }], { importance: 'normal' })];
                case 1: return [2 /*return*/, _b.sent()];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
