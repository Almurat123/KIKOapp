"use strict";
/**
 * Privy Wallet Service
 * Server-side wallet operations using Privy's embedded wallet API
 * Enables instant trading without user popups
 *
 * Documentation: https://docs.privy.io/guide/server/wallets/
 */
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
exports.__privyWalletTest = exports.isTransactionQueueBusy = exports.__runUserTransactionTaskForTests = exports.__resetUserTransactionSchedulerForTests = void 0;
exports.preWarmPrivyClient = preWarmPrivyClient;
exports.getEmbeddedWalletInfo = getEmbeddedWalletInfo;
exports.getEmbeddedWalletAddress = getEmbeddedWalletAddress;
exports.getSolanaEmbeddedWalletAddress = getSolanaEmbeddedWalletAddress;
exports.getPendingNonce = getPendingNonce;
exports.sendTransactionLifecycle = sendTransactionLifecycle;
exports.sendTransaction = sendTransaction;
exports.getOrCreateServerSolanaWallet = getOrCreateServerSolanaWallet;
exports.getServerSolanaWalletAddress = getServerSolanaWalletAddress;
exports.getDelegatedSolanaWallet = getDelegatedSolanaWallet;
exports.getDelegatedEvmWallet = getDelegatedEvmWallet;
exports.sendSolanaTransaction = sendSolanaTransaction;
exports.getSolanaSigningContext = getSolanaSigningContext;
exports.sendSolanaTransactionWithContext = sendSolanaTransactionWithContext;
exports.signTypedData = signTypedData;
exports.isPrivyConfigured = isPrivyConfigured;
var server_auth_1 = require("@privy-io/server-auth");
var ethers_1 = require("ethers");
var errorHandler_js_1 = require("../middleware/errorHandler.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
var privy_js_1 = require("../config/privy.js");
var rpcManager_js_1 = require("./rpcManager.js");
var flashbots_js_1 = require("./dex/flashbots.js");
var txLifecycle_js_1 = require("./txLifecycle.js");
var context_js_1 = require("./order-runtime/context.js");
var reasonCodes_js_1 = require("./order-runtime/reasonCodes.js");
var service_js_1 = require("./order-runtime/adjudicator/service.js");
var visibilityPolicy_js_1 = require("./rpc/visibilityPolicy.js");
var profile_js_1 = require("./rpc/profile.js");
var walletNonceLane_js_1 = require("./nonce/walletNonceLane.js");
var nonceFloorPolicy_js_1 = require("./nonce/nonceFloorPolicy.js");
var pendingNonceResolution_js_1 = require("./nonce/pendingNonceResolution.js");
var solanaWalletResolver_js_1 = require("./solana/solanaWalletResolver.js");
var solanaPrivySender_js_1 = require("./solana/solanaPrivySender.js");
var solanaSigningContext_js_1 = require("./solana/solanaSigningContext.js");
var privyEmbeddedWalletResolver_js_1 = require("./privyEmbeddedWalletResolver.js");
var pendingAttributedPositionLedger_js_1 = require("./copytrade-v2/positions/pendingAttributedPositionLedger.js");
var privyWalletQueue_js_1 = require("./privyWalletQueue.js");
var privyChainSendLimiter_js_1 = require("./privyChainSendLimiter.js");
var privyWalletQueue_js_2 = require("./privyWalletQueue.js");
Object.defineProperty(exports, "__resetUserTransactionSchedulerForTests", { enumerable: true, get: function () { return privyWalletQueue_js_2.__resetUserTransactionSchedulerForTests; } });
Object.defineProperty(exports, "__runUserTransactionTaskForTests", { enumerable: true, get: function () { return privyWalletQueue_js_2.__runUserTransactionTaskForTests; } });
Object.defineProperty(exports, "isTransactionQueueBusy", { enumerable: true, get: function () { return privyWalletQueue_js_2.isTransactionQueueBusy; } });
// Initialize Privy client
var _a = (0, privy_js_1.resolvePrivyServerConfig)(), PRIVY_APP_ID = _a.appId, PRIVY_APP_SECRET = _a.appSecret, PRIVY_FRONTEND_APP_ID = _a.frontendAppId, PRIVY_APP_ID_MISMATCH = _a.appIdMismatch;
var PRIVY_AUTHORIZATION_KEY = process.env.PRIVY_AUTHORIZATION_KEY || '';
var PRIVY_SEND_TX_CHAIN_IDS = new Set(String(process.env.PRIVY_SEND_TX_CHAIN_IDS || '1,8453,56')
    .split(',')
    .map(function (value) { return Number(value.trim()); })
    .filter(function (value) { return Number.isInteger(value) && value > 0; }));
// Keep visibility probing enabled for observability (deployment marker).
// For raw-path trade/speedup we also run a short synchronous visibility probe before returning success.
var PRIVY_TX_VISIBILITY_CHECK_ENABLED = true;
var PRIVY_TX_REQUIRE_VISIBILITY = false;
var PRIVY_TX_VISIBILITY_RETRIES = 6;
var PRIVY_TX_VISIBILITY_DELAY_MS = 500;
var PRIVY_TX_SYNC_VISIBILITY_RETRIES = 8;
var PRIVY_TX_SYNC_VISIBILITY_DELAY_MS = 400;
var PRIVY_FAST_TRADE_SYNC_VISIBILITY_RETRIES = 1;
var PRIVY_FAST_TRADE_SYNC_VISIBILITY_DELAY_MS = 0;
var PRIVY_FAST_TRADE_SKIP_SYNC_VISIBILITY = (process.env.PRIVY_FAST_TRADE_SKIP_SYNC_VISIBILITY || 'true').toLowerCase() === 'true';
var PRIVY_FAST_TRADE_FORCE_RAW_PATH = (process.env.PRIVY_FAST_TRADE_FORCE_RAW_PATH || 'false').toLowerCase() === 'true';
var PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_RETRIES = Math.max(1, Number(process.env.PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_RETRIES || '4'));
var PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_DELAY_MS = Math.max(0, Number(process.env.PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_DELAY_MS || '180'));
var PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_CHAIN_IDS = new Set(String(process.env.PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_CHAIN_IDS || '8453,56')
    .split(',')
    .map(function (value) { return Number(value.trim()); })
    .filter(function (value) { return Number.isInteger(value) && value > 0; }));
var PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS || '22000')));
var PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS || '17000')));
var PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS || '15000')));
var PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI = BigInt(Math.max(1, Number(process.env.PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI || '120000000')));
var PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI = BigInt(Math.max(1, Number(process.env.PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI || '1200000000')));
var LOCAL_SIGNER_ENABLED = (process.env.LOCAL_SIGNER_ENABLED || 'false').toLowerCase() === 'true';
var privyClient = null;
var privyConfigWarningLogged = false;
function shouldReturnAcceptedLifecycleImmediately(tx) {
    return tx.txPurpose === 'approval' || isFastTradeExecutionProfile(tx);
}
function syncAcceptedCopytradePendingPosition(params) {
    return __awaiter(this, void 0, void 0, function () {
        var pendingPositionId, txHash, status;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    pendingPositionId = String(((_b = (_a = params.runtimeContext) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.copytradePendingPositionId) || '').trim();
                    txHash = String(params.txHash || '').trim().toLowerCase();
                    if (!pendingPositionId || !/^0x[a-f0-9]{64}$/.test(txHash))
                        return [2 /*return*/];
                    status = String(params.lifecycleStatus || '').trim().toLowerCase() === 'visible_pending'
                        ? 'broadcasted_unseen'
                        : 'pending_broadcast';
                    return [4 /*yield*/, (0, pendingAttributedPositionLedger_js_1.markPendingAttributedPositionAccepted)({
                            positionId: pendingPositionId,
                            entryTxHash: txHash,
                            reasonCode: 'buy_tx_accepted',
                            positionStatus: status,
                        }).catch(function () { return 0; })];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function syncSendStartedCopytradePendingPosition(params) {
    return __awaiter(this, void 0, void 0, function () {
        var pendingPositionId;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    pendingPositionId = String(((_b = (_a = params.runtimeContext) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.copytradePendingPositionId) || '').trim();
                    if (!pendingPositionId)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, pendingAttributedPositionLedger_js_1.markPendingAttributedPositionSendStarted)({
                            positionId: pendingPositionId,
                            reasonCode: 'buy_send_started',
                            positionStatus: 'pending_broadcast',
                        }).catch(function () { return 0; })];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getLocalSignerPrivateKey(chainId) {
    var perChainKey = process.env["LOCAL_SIGNER_PRIVATE_KEY_".concat(chainId)];
    var genericKey = process.env.LOCAL_SIGNER_PRIVATE_KEY;
    return String(perChainKey || genericKey || '').trim();
}
function sendWithLocalSigner(tx) {
    return __awaiter(this, void 0, void 0, function () {
        var privateKey, localRpcUrl, provider, wallet, txReq, fee, latestBlock, base, priority, suggestedMax, _a, signedRawTransaction, sent, txHash, firstSeenAt, startedAt, maxWaitMs, receipt, ok, visible;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    privateKey = getLocalSignerPrivateKey(tx.chainId);
                    if (!privateKey) {
                        throw new errorHandler_js_1.AppError(500, 'LOCAL_SIGNER_PRIVATE_KEY not configured', 'LOCAL_SIGNER_NOT_CONFIGURED');
                    }
                    localRpcUrl = String(process.env["LOCAL_SIGNER_RPC_URL_".concat(tx.chainId)]
                        || process.env.LOCAL_SIGNER_RPC_URL
                        || '').trim();
                    provider = localRpcUrl
                        ? new ethers_1.ethers.JsonRpcProvider(localRpcUrl, tx.chainId, { staticNetwork: true })
                        : (0, rpcManager_js_1.getEthersProvider)(tx.chainId, 'trade_execution');
                    wallet = new ethers_1.ethers.Wallet(privateKey, provider);
                    txReq = {
                        to: tx.to,
                        data: tx.data,
                        value: tx.value ? BigInt(tx.value) : 0n,
                        chainId: tx.chainId
                    };
                    if (tx.gas)
                        txReq.gasLimit = BigInt(tx.gas);
                    if (tx.gasPrice)
                        txReq.gasPrice = BigInt(tx.gasPrice);
                    if (tx.maxFeePerGas)
                        txReq.maxFeePerGas = BigInt(tx.maxFeePerGas);
                    if (tx.maxPriorityFeePerGas)
                        txReq.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas);
                    if (!(!txReq.gasPrice && !txReq.maxFeePerGas)) return [3 /*break*/, 3];
                    return [4 /*yield*/, provider.getFeeData()];
                case 1:
                    fee = _b.sent();
                    return [4 /*yield*/, provider.getBlock('latest').catch(function () { return null; })];
                case 2:
                    latestBlock = _b.sent();
                    base = (latestBlock === null || latestBlock === void 0 ? void 0 : latestBlock.baseFeePerGas) || 0n;
                    priority = fee.maxPriorityFeePerGas || 1000000n;
                    suggestedMax = fee.maxFeePerGas || (base * 2n + priority);
                    txReq.maxPriorityFeePerGas = priority;
                    txReq.maxFeePerGas = suggestedMax > priority ? suggestedMax : (priority + 1n);
                    _b.label = 3;
                case 3:
                    if (!tx.nonce) return [3 /*break*/, 4];
                    txReq.nonce = Number(BigInt(tx.nonce));
                    return [3 /*break*/, 6];
                case 4:
                    _a = txReq;
                    return [4 /*yield*/, provider.getTransactionCount(wallet.address, 'pending')];
                case 5:
                    _a.nonce = _b.sent();
                    _b.label = 6;
                case 6: return [4 /*yield*/, wallet.signTransaction(txReq)];
                case 7:
                    signedRawTransaction = _b.sent();
                    return [4 /*yield*/, provider.broadcastTransaction(signedRawTransaction)];
                case 8:
                    sent = _b.sent();
                    txHash = sent.hash;
                    firstSeenAt = Date.now();
                    startedAt = Date.now();
                    maxWaitMs = 2500;
                    _b.label = 9;
                case 9:
                    if (!(Date.now() - startedAt < maxWaitMs)) return [3 /*break*/, 12];
                    return [4 /*yield*/, provider.getTransactionReceipt(txHash).catch(function () { return null; })];
                case 10:
                    receipt = _b.sent();
                    if (receipt) {
                        ok = Number(receipt.status || 0) === 1;
                        return [2 /*return*/, {
                                status: ok ? 'confirmed_success' : 'confirmed_failed',
                                txHash: txHash,
                                firstSeenAt: firstSeenAt,
                                confirmedAt: Date.now(),
                                attempts: 1,
                                chainId: tx.chainId,
                                lastRpcError: ok ? undefined : 'receipt_status_0'
                            }];
                    }
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 220); })];
                case 11:
                    _b.sent();
                    return [3 /*break*/, 9];
                case 12: return [4 /*yield*/, provider.getTransaction(txHash).catch(function () { return null; })];
                case 13:
                    visible = _b.sent();
                    return [2 /*return*/, {
                            status: visible ? 'visible_pending' : 'broadcasted_unseen',
                            txHash: txHash,
                            firstSeenAt: visible ? firstSeenAt : undefined,
                            attempts: 1,
                            chainId: tx.chainId,
                            lastRpcError: visible ? undefined : 'not_found_by_local_rpc'
                        }];
            }
        });
    });
}
function syncLifecycleIntoRuntimeContext(tx, lifecycle, reasonCode) {
    if (!tx.runtimeContext)
        return;
    (0, context_js_1.recordLifecycleOnOrder)(tx.runtimeContext, lifecycle, { reasonCode: reasonCode });
}
function isFallbackOwnedRuntimeState(runtimeContext) {
    var runtimeState = String((runtimeContext === null || runtimeContext === void 0 ? void 0 : runtimeContext.state) || '').trim().toLowerCase();
    return runtimeState === 'fallback_started'
        || runtimeState === 'fallback_succeeded'
        || runtimeState === 'fallback_failed';
}
function shouldSuppressSendForFallbackOwnership(params) {
    if (!isFallbackOwnedRuntimeState(params.runtimeContext))
        return false;
    return params.executionBranch !== 'fallback';
}
function reportAcceptedEvidence(tx, txHash, source) {
    var _a;
    var orderId = (_a = tx.runtimeContext) === null || _a === void 0 ? void 0 : _a.orderId;
    if (orderId)
        (0, service_js_1.bindOrderToTxHash)(orderId, tx.chainId, txHash);
    (0, service_js_1.reportSendAccepted)({
        chainId: tx.chainId,
        txHash: txHash,
        orderId: orderId,
        source: source
    });
}
var toHexQuantity = function (value) {
    return value !== undefined && value !== null && value !== ''
        ? "0x".concat(BigInt(value).toString(16))
        : undefined;
};
function isLikelyEvmAddress(value) {
    var address = String(value || '');
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}
function isFastTradeExecutionProfile(tx) {
    var purpose = tx.txPurpose || 'other';
    if (purpose !== 'trade' && purpose !== 'speedup')
        return false;
    var profile = String(tx.executionProfile || '').toLowerCase();
    return profile === 'base-sniper' || profile === 'bsc-sniper';
}
function resolveTradeGasPolicy(tx) {
    var purpose = tx.txPurpose || 'other';
    if (purpose !== 'trade' && purpose !== 'speedup') {
        return { bumpBps: 11500n, minGasPriceWei: 1n, policy: 'other' };
    }
    var profile = String(tx.executionProfile || '').toLowerCase();
    if (profile === 'base-sniper' || tx.chainId === 8453) {
        return {
            bumpBps: PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS,
            minGasPriceWei: PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI,
            policy: 'base-sniper'
        };
    }
    if (profile === 'bsc-sniper' || tx.chainId === 56) {
        return {
            bumpBps: PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS,
            minGasPriceWei: PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI,
            policy: 'bsc-sniper'
        };
    }
    return {
        bumpBps: PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS,
        minGasPriceWei: 1n,
        policy: 'trade-default'
    };
}
function verifyTxVisibility(chainId, txHash, expectedFrom, options) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, rpcManager_js_1.probeTxVisibility)({
                        chainId: chainId,
                        txHash: txHash,
                        expectedFrom: expectedFrom,
                        retries: Math.max(1, (options === null || options === void 0 ? void 0 : options.retries) || PRIVY_TX_VISIBILITY_RETRIES),
                        delayMs: Math.max(0, (_a = options === null || options === void 0 ? void 0 : options.delayMs) !== null && _a !== void 0 ? _a : PRIVY_TX_VISIBILITY_DELAY_MS)
                    })];
                case 1: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
function scheduleTxVisibilityCheck(params) {
    var _this = this;
    if (!PRIVY_TX_VISIBILITY_CHECK_ENABLED)
        return;
    void (function () { return __awaiter(_this, void 0, void 0, function () {
        var visibility, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, verifyTxVisibility(params.chainId, params.txHash, params.expectedFrom)];
                case 1:
                    visibility = _a.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Privy tx visibility check', {
                        path: params.path,
                        txHash: params.txHash,
                        chainId: params.chainId,
                        visible: visibility.visible,
                        checks: visibility.checks,
                        seenFrom: visibility.from,
                        seenNonce: visibility.nonce,
                        expectedFrom: params.expectedFrom,
                        lastError: visibility.lastError
                    });
                    if (!visibility.visible) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Privy tx visibility miss (non-blocking)', {
                            path: params.path,
                            txHash: params.txHash,
                            chainId: params.chainId,
                            expectedFrom: params.expectedFrom,
                            lastError: visibility.lastError
                        });
                        if (PRIVY_TX_REQUIRE_VISIBILITY) {
                            logger_js_1.logger.error(logRegistry_js_1.LogCode.EXE_TX_REVERTED, 'Privy tx visibility required but not found', {
                                path: params.path,
                                txHash: params.txHash,
                                chainId: params.chainId,
                                expectedFrom: params.expectedFrom,
                                lastError: visibility.lastError
                            });
                        }
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Privy tx visibility probe failed (non-blocking)', {
                        path: params.path,
                        txHash: params.txHash,
                        chainId: params.chainId,
                        error: (err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || String(err_1)
                    });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); })();
}
function tryResolveFastTradeUnresolvedVisibility(params) {
    return __awaiter(this, void 0, void 0, function () {
        var lifecycle, chainId, txHash, expectedFrom, path, visibility, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lifecycle = params.lifecycle, chainId = params.chainId, txHash = params.txHash, expectedFrom = params.expectedFrom, path = params.path;
                    if (lifecycle.status !== 'broadcasted_unseen' || !txHash)
                        return [2 /*return*/, lifecycle];
                    if (!PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_CHAIN_IDS.has(chainId))
                        return [2 /*return*/, lifecycle];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, verifyTxVisibility(chainId, txHash, expectedFrom, {
                            retries: PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_RETRIES,
                            delayMs: PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_DELAY_MS
                        })];
                case 2:
                    visibility = _a.sent();
                    if (visibility.visible) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Fast trade visibility resolved via short sync probe', {
                            chainId: chainId,
                            txHash: txHash,
                            path: path,
                            checks: visibility.checks,
                            seenFrom: visibility.from,
                            seenNonce: visibility.nonce
                        });
                        return [2 /*return*/, __assign(__assign({}, lifecycle), { status: 'visible_pending', firstSeenAt: lifecycle.firstSeenAt || Date.now(), attempts: Math.max(lifecycle.attempts || 1, visibility.checks || 1), lastRpcError: undefined })];
                    }
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Fast trade visibility still pending after short sync probe', {
                        chainId: chainId,
                        txHash: txHash,
                        path: path,
                        checks: visibility.checks,
                        lastError: visibility.lastError || null
                    });
                    return [2 /*return*/, __assign(__assign({}, lifecycle), { attempts: Math.max(lifecycle.attempts || 1, visibility.checks || 1), lastRpcError: lifecycle.lastRpcError || visibility.lastError || 'not_found_by_rpc' })];
                case 3:
                    error_1 = _a.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Fast trade visibility short sync probe failed', {
                        chainId: chainId,
                        txHash: txHash,
                        path: path,
                        error: (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1)
                    });
                    return [2 /*return*/, lifecycle];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get or initialize Privy client
 */
function getPrivyClient() {
    if (privyClient)
        return privyClient;
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new errorHandler_js_1.AppError(503, 'Privy credentials not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET.', 'PRIVY_NOT_CONFIGURED');
    }
    if (PRIVY_APP_ID_MISMATCH && !privyConfigWarningLogged) {
        privyConfigWarningLogged = true;
        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Privy frontend/server app id mismatch detected on API server', {
            serverAppIdConfigured: true,
            frontendAppIdConfigured: Boolean(PRIVY_FRONTEND_APP_ID),
        });
    }
    // Initialize with Authorization Key if available (required for server-side signing)
    var config = {};
    if (PRIVY_AUTHORIZATION_KEY) {
        // wallet-auth: prefixed keys don't need newline handling
        var formattedKey = PRIVY_AUTHORIZATION_KEY.startsWith('wallet-auth:')
            ? PRIVY_AUTHORIZATION_KEY
            : PRIVY_AUTHORIZATION_KEY.replace(/\\n/g, '\n');
        var keyId = process.env.PRIVY_AUTHORIZATION_KEY_ID;
        config.walletApi = {
            authorizationPrivateKey: formattedKey,
            authorizationKeyId: keyId
        };
        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'PrivyWallet Authorization Key config', {
            keyFormat: PRIVY_AUTHORIZATION_KEY.startsWith('wallet-auth:') ? 'wallet-auth' : 'pem',
            keyLength: formattedKey.length,
            keyIdConfigured: !!keyId,
            keyId: (keyId === null || keyId === void 0 ? void 0 : keyId.slice(0, 10)) + '...',
        });
    }
    privyClient = new server_auth_1.PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, config);
    return privyClient;
}
/**
 * Pre-warm the Privy client at startup to avoid cold-start constructor overhead
 * on the first trade. Call this during server initialization.
 */
function preWarmPrivyClient() {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET)
        return;
    try {
        getPrivyClient();
        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, '[Privy] Client pre-warmed at startup');
    }
    catch (_a) {
        // Ignore – credentials may not be available at startup in some envs
    }
}
// Eagerly initialize the Privy client when this module is first imported
// so the constructor cost (and any internal SDK setup) is paid at boot time,
// not at the moment of the first trade request.
if (PRIVY_APP_ID && PRIVY_APP_SECRET) {
    try {
        getPrivyClient();
    }
    catch ( /* ignore */_b) { /* ignore */ }
}
/**
 * Get user's embedded wallet info (address AND internal ID)
 * @param userId - Privy user ID (from JWT sub claim)
 * @returns Wallet info or null if user has no embedded wallet
 */
function getEmbeddedWalletInfo(userId, options) {
    return __awaiter(this, void 0, void 0, function () {
        var client;
        return __generator(this, function (_a) {
            client = getPrivyClient();
            return [2 /*return*/, (0, privyEmbeddedWalletResolver_js_1.fetchPrivyEmbeddedWalletInfo)(userId, {
                    chainType: options === null || options === void 0 ? void 0 : options.chainType,
                    getUser: function (targetUserId) { return client.getUser(targetUserId); }
                })];
        });
    });
}
/**
 * Get user's embedded wallet address (convenience function)
 * @param userId - Privy user ID (from JWT sub claim)
 * @returns Wallet address or null if user has no embedded wallet
 */
function getEmbeddedWalletAddress(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, chainType) {
        var info;
        if (chainType === void 0) { chainType = 'ethereum'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getEmbeddedWalletInfo(userId, { chainType: chainType })];
                case 1:
                    info = _a.sent();
                    return [2 /*return*/, (info === null || info === void 0 ? void 0 : info.address) || null];
            }
        });
    });
}
/**
 * Get user's Solana embedded wallet address
 */
function getSolanaEmbeddedWalletAddress(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, user, solanaWallet, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = getPrivyClient();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.getUser(userId)];
                case 2:
                    user = _b.sent();
                    solanaWallet = (_a = user.linkedAccounts) === null || _a === void 0 ? void 0 : _a.find(function (account) { return account.type === 'wallet' &&
                        account.walletClientType === 'privy' &&
                        account.chainType === 'solana'; });
                    if (!solanaWallet) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'User has no Solana embedded wallet', { userId: userId });
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, solanaWallet.address || null];
                case 3:
                    error_2 = _b.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'Error getting Solana wallet from Privy', { userId: userId, error: error_2.message });
                    throw new errorHandler_js_1.AppError(500, 'Failed to get Solana wallet', 'WALLET_ERROR');
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Send a transaction using user's embedded wallet (server-side signing)
 * @param userId - Privy user ID
 * @param accessToken - User's Privy access token (for authorization context)
 * @param tx - Transaction to send
 * @returns Transaction hash
 */
var pendingNonceInflight = new Map();
var pendingNonceCache = new Map();
var PENDING_NONCE_CACHE_TTL_MS = Math.max(250, Number(process.env.PENDING_NONCE_CACHE_TTL_MS || '1500'));
var PENDING_NONCE_FLOOR_RETENTION_MS = Math.max(PENDING_NONCE_CACHE_TTL_MS, Number(process.env.PENDING_NONCE_FLOOR_RETENTION_MS || '30000'));
function buildPendingNonceKey(chainId, walletAddress) {
    return "".concat(chainId, ":").concat(walletAddress.toLowerCase());
}
function invalidatePendingNonce(chainId, walletAddress) {
    var key = buildPendingNonceKey(chainId, walletAddress);
    pendingNonceCache.delete(key);
    pendingNonceInflight.delete(key);
}
function seedNextPendingNonce(chainId, walletAddress, nonce) {
    if (!walletAddress || !nonce)
        return;
    try {
        var nextNonce = (BigInt(nonce) + 1n).toString();
        var key = buildPendingNonceKey(chainId, walletAddress);
        pendingNonceCache.set(key, {
            nonce: nextNonce,
            timestamp: Date.now()
        });
        pendingNonceInflight.delete(key);
    }
    catch (_a) {
        invalidatePendingNonce(chainId, walletAddress);
    }
}
function getPendingNonce(chainId, walletAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var key, cached, cachedAgeMs, inflight, task;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!walletAddress || chainId <= 0)
                        return [2 /*return*/, undefined];
                    key = buildPendingNonceKey(chainId, walletAddress);
                    cached = pendingNonceCache.get(key);
                    cachedAgeMs = cached ? Date.now() - cached.timestamp : null;
                    if (cached && cachedAgeMs !== null && cachedAgeMs <= PENDING_NONCE_CACHE_TTL_MS) {
                        return [2 /*return*/, cached.nonce];
                    }
                    inflight = pendingNonceInflight.get(key);
                    if (!inflight) return [3 /*break*/, 2];
                    return [4 /*yield*/, inflight];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    task = (function () { return __awaiter(_this, void 0, void 0, function () {
                        var rpcNonce, resolved, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, 3, 4]);
                                    return [4 /*yield*/, (0, rpcManager_js_1.callRpc)(chainId, 'eth_getTransactionCount', [walletAddress, 'pending'], {
                                            strategy: profile_js_1.TX_NONCE_PROFILE.strategy,
                                            purpose: profile_js_1.TX_NONCE_PROFILE.purpose,
                                            importance: profile_js_1.TX_NONCE_PROFILE.importance,
                                        })];
                                case 1:
                                    rpcNonce = _b.sent();
                                    resolved = (0, pendingNonceResolution_js_1.resolvePendingNonce)({
                                        cachedNonce: cached === null || cached === void 0 ? void 0 : cached.nonce,
                                        rpcNonce: typeof rpcNonce === 'string' ? rpcNonce : undefined
                                    });
                                    if (!resolved.nonce)
                                        return [2 /*return*/, undefined];
                                    pendingNonceCache.set(key, { nonce: resolved.nonce, timestamp: Date.now() });
                                    return [2 /*return*/, resolved.nonce];
                                case 2:
                                    _a = _b.sent();
                                    if (cached && cachedAgeMs !== null && cachedAgeMs <= PENDING_NONCE_FLOOR_RETENTION_MS) {
                                        return [2 /*return*/, cached.nonce];
                                    }
                                    return [2 /*return*/, undefined];
                                case 3:
                                    pendingNonceInflight.delete(key);
                                    return [7 /*endfinally*/];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); })();
                    pendingNonceInflight.set(key, task);
                    return [4 /*yield*/, task];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function signAndBroadcastRawTransaction(client, walletId, tx, context) {
    return __awaiter(this, void 0, void 0, function () {
        var signed, shouldUseFlashbots, flashbotsResult, visibility, fastTradePath, sendStartedAtMs, lifecycle, rawTxHash, sendHashAtMs, finalState;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Sending transaction via Privy sign+broadcast path', {
                        chainId: tx.chainId,
                        userId: context.userId.slice(0, 10),
                        attempt: context.attempt,
                        reason: context.reason
                    });
                    return [4 /*yield*/, client.walletApi.ethereum.signTransaction({
                            walletId: walletId,
                            transaction: {
                                to: tx.to,
                                data: tx.data,
                                value: toHexQuantity(tx.value),
                                gasLimit: toHexQuantity(tx.gas),
                                gasPrice: toHexQuantity(tx.gasPrice),
                                maxFeePerGas: toHexQuantity(tx.maxFeePerGas),
                                maxPriorityFeePerGas: toHexQuantity(tx.maxPriorityFeePerGas),
                                nonce: toHexQuantity(tx.nonce),
                                chainId: "0x".concat(BigInt(tx.chainId).toString(16)),
                            },
                        })];
                case 1:
                    signed = _a.sent();
                    if (typeof (signed === null || signed === void 0 ? void 0 : signed.signedTransaction) !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signed.signedTransaction)) {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.EXE_TX_REVERTED, 'Privy signTransaction returned invalid signed payload', {
                            chainId: tx.chainId,
                            userId: context.userId.slice(0, 10),
                            hasSignedTransaction: typeof (signed === null || signed === void 0 ? void 0 : signed.signedTransaction) === 'string',
                            signedLength: typeof (signed === null || signed === void 0 ? void 0 : signed.signedTransaction) === 'string' ? signed.signedTransaction.length : 0,
                            encoding: signed === null || signed === void 0 ? void 0 : signed.encoding
                        });
                        throw new Error('privy_invalid_signed_transaction_payload');
                    }
                    shouldUseFlashbots = tx.mevProtection === true
                        && tx.chainId === 1
                        && (tx.txPurpose === 'trade' || tx.txPurpose === 'speedup');
                    if (!shouldUseFlashbots) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, flashbots_js_1.sendViaFlashbots)(signed.signedTransaction, tx.chainId, { useFlashbots: true, preferFast: false, maxBlocksToWait: 25 })];
                case 2:
                    flashbotsResult = _a.sent();
                    if (!(flashbotsResult.success && flashbotsResult.txHash)) return [3 /*break*/, 4];
                    if (tx.runtimeContext) {
                        (0, context_js_1.setOrderMetadata)(tx.runtimeContext, {
                            submissionPath: 'flashbots',
                            privateRelayUsed: true,
                            fallbackToPublic: false,
                            privateRelayRejected: false
                        });
                    }
                    return [4 /*yield*/, verifyTxVisibility(tx.chainId, flashbotsResult.txHash, context.expectedFrom, {
                            retries: 4,
                            delayMs: 220
                        })];
                case 3:
                    visibility = _a.sent();
                    if (visibility.visible) {
                        return [2 /*return*/, {
                                status: 'visible_pending',
                                txHash: flashbotsResult.txHash,
                                firstSeenAt: Date.now(),
                                attempts: visibility.checks,
                                chainId: tx.chainId
                            }];
                    }
                    return [2 /*return*/, {
                            status: 'broadcasted_unseen',
                            txHash: flashbotsResult.txHash,
                            lastRpcError: visibility.lastError || 'flashbots_not_found_by_rpc',
                            attempts: visibility.checks,
                            chainId: tx.chainId
                        }];
                case 4:
                    if (tx.runtimeContext) {
                        (0, context_js_1.setOrderMetadata)(tx.runtimeContext, {
                            submissionPath: 'fallback_public',
                            privateRelayUsed: false,
                            fallbackToPublic: true,
                            privateRelayRejected: true
                        });
                    }
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Flashbots broadcast unavailable, falling back to quorum raw broadcast', {
                        chainId: tx.chainId,
                        userId: context.userId.slice(0, 10),
                        reason: flashbotsResult.error || 'unknown'
                    });
                    _a.label = 5;
                case 5:
                    if (tx.runtimeContext && !shouldUseFlashbots) {
                        (0, context_js_1.setOrderMetadata)(tx.runtimeContext, {
                            submissionPath: 'public',
                            privateRelayUsed: false,
                            fallbackToPublic: false,
                            privateRelayRejected: false
                        });
                    }
                    fastTradePath = isFastTradeExecutionProfile(tx);
                    sendStartedAtMs = Date.now();
                    return [4 /*yield*/, (0, rpcManager_js_1.broadcastRawWithQuorum)({
                            chainId: tx.chainId,
                            signedRawTransaction: signed.signedTransaction,
                            expectedFrom: context.expectedFrom,
                            syncVisibilityRetries: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_RETRIES : PRIVY_TX_SYNC_VISIBILITY_RETRIES,
                            syncVisibilityDelayMs: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_DELAY_MS : PRIVY_TX_SYNC_VISIBILITY_DELAY_MS,
                            bypassRawTxCache: true,
                            skipSyncVisibility: fastTradePath && PRIVY_FAST_TRADE_SKIP_SYNC_VISIBILITY
                        })];
                case 6:
                    lifecycle = _a.sent();
                    rawTxHash = lifecycle.txHash;
                    sendHashAtMs = rawTxHash ? Date.now() : null;
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, '[PrivySendTiming] send completed', {
                        chainId: tx.chainId,
                        txPurpose: context.txPurpose,
                        executionProfile: tx.executionProfile || 'default',
                        send_started_at: sendStartedAtMs,
                        send_hash_at: sendHashAtMs,
                        send_ms: sendHashAtMs ? Math.max(0, sendHashAtMs - sendStartedAtMs) : null,
                        txHash: rawTxHash || undefined,
                        status: lifecycle.status,
                        attempts: lifecycle.attempts || 0,
                        lastRpcError: lifecycle.lastRpcError || null
                    });
                    if (!rawTxHash)
                        return [2 /*return*/, lifecycle];
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Ethereum transaction broadcast via signed raw path', {
                        txHash: rawTxHash,
                        chainId: tx.chainId
                    });
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, "Ethereum transaction broadcast via signed raw path txHash=".concat(rawTxHash), {
                        chainId: tx.chainId
                    });
                    if (lifecycle.status === 'broadcasted_unseen') {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_REVERTED, 'Privy raw tx broadcasted but not visible in sync probe', {
                            txHash: rawTxHash,
                            chainId: tx.chainId,
                            txPurpose: context.txPurpose,
                            checks: lifecycle.attempts,
                            lastError: lifecycle.lastRpcError
                        });
                    }
                    scheduleTxVisibilityCheck({
                        path: 'raw_sign_broadcast',
                        chainId: tx.chainId,
                        txHash: rawTxHash,
                        expectedFrom: context.expectedFrom
                    });
                    if (fastTradePath) {
                        if (lifecycle.status === 'broadcasted_unseen' && rawTxHash) {
                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Privy fast trade visibility guard skipped (non-blocking)', {
                                chainId: tx.chainId,
                                txHash: rawTxHash,
                                status: lifecycle.status,
                                checks: lifecycle.attempts,
                                lastRpcError: lifecycle.lastRpcError || null
                            });
                        }
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Privy fast trade lifecycle early return', {
                            chainId: tx.chainId,
                            txHash: rawTxHash,
                            status: lifecycle.status,
                            checks: lifecycle.attempts
                        });
                        return [2 /*return*/, lifecycle];
                    }
                    if (!(context.txPurpose === 'trade' || context.txPurpose === 'speedup')) return [3 /*break*/, 8];
                    return [4 /*yield*/, (0, rpcManager_js_1.waitForReceiptStateMachine)({
                            chainId: tx.chainId,
                            txHash: rawTxHash,
                            expectedFrom: context.expectedFrom,
                            maxWaitMs: 900,
                            pollMs: 300
                        }).catch(function () { return lifecycle; })];
                case 7:
                    finalState = _a.sent();
                    if (finalState.status === 'dropped_timeout' && lifecycle.status === 'broadcasted_unseen') {
                        return [2 /*return*/, lifecycle];
                    }
                    return [2 /*return*/, finalState];
                case 8: return [2 /*return*/, lifecycle];
            }
        });
    });
}
function sendTransactionLifecycle(userId, accessToken, tx) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, privyWalletQueue_js_1.withUserTransactionLock)({
                    userId: userId,
                    chainId: tx.chainId,
                    tx: tx,
                    fn: function () { return __awaiter(_this, void 0, void 0, function () {
                        var _this = this;
                        return __generator(this, function (_a) {
                            return [2 /*return*/, (0, privyChainSendLimiter_js_1.withChainSendLimiter)(tx.chainId, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var runtimeContext_1, disownedLifecycle, simulatedLifecycle, localSignerLifecycle, client_1, MAX_RETRIES_1, NETWORK_RETRY_DELAY_MS_1, NONCE_RETRY_DELAY_MS_1, walletInfo_1;
                                    var _this = this;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                (0, privyWalletQueue_js_1.markUserChainInflight)(userId, tx.chainId, 1);
                                                _a.label = 1;
                                            case 1:
                                                _a.trys.push([1, , 8, 9]);
                                                runtimeContext_1 = tx.runtimeContext;
                                                if (shouldSuppressSendForFallbackOwnership({
                                                    runtimeContext: runtimeContext_1,
                                                    executionBranch: tx.executionBranch,
                                                })) {
                                                    disownedLifecycle = {
                                                        status: 'dropped_timeout',
                                                        attempts: 1,
                                                        chainId: tx.chainId,
                                                        lastRpcError: 'copytrade_send_disowned_by_fallback',
                                                    };
                                                    // This branch is a loser send after fallback ownership has already been established.
                                                    // Do not let it overwrite the canonical runtime state for the winning fallback path.
                                                    return [2 /*return*/, disownedLifecycle];
                                                }
                                                if (!runtimeContext_1) return [3 /*break*/, 3];
                                                (0, context_js_1.markOrderPrepared)(runtimeContext_1);
                                                (0, context_js_1.markOrderSendStarted)(runtimeContext_1);
                                                return [4 /*yield*/, syncSendStartedCopytradePendingPosition({ runtimeContext: runtimeContext_1 })];
                                            case 2:
                                                _a.sent();
                                                (0, context_js_1.setOrderMetadata)(runtimeContext_1, {
                                                    txPurpose: tx.txPurpose || 'other',
                                                    executionProfile: tx.executionProfile || 'default',
                                                    executionBranch: tx.executionBranch || 'primary',
                                                    mevProtection: tx.mevProtection === true,
                                                    gasPolicyTier: tx.gasPolicyTier || null,
                                                    replacementPolicyTier: tx.replacementPolicyTier || null,
                                                    privateRelayEligible: tx.privateRelayEligible === true
                                                });
                                                _a.label = 3;
                                            case 3:
                                                if (process.env.SIMULATION_MODE === 'true') {
                                                    logger_js_1.logger.info(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'SIMULATION MODE: Skipping actual Privy send', {
                                                        userId: userId,
                                                        to: tx.to,
                                                        value: tx.value,
                                                        chainId: tx.chainId
                                                    });
                                                    simulatedLifecycle = {
                                                        status: 'confirmed_success',
                                                        txHash: "0xSIMULATION_PRIVY_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(7)),
                                                        firstSeenAt: Date.now(),
                                                        confirmedAt: Date.now(),
                                                        attempts: 1,
                                                        chainId: tx.chainId
                                                    };
                                                    syncLifecycleIntoRuntimeContext(tx, simulatedLifecycle);
                                                    return [2 /*return*/, simulatedLifecycle];
                                                }
                                                if (!LOCAL_SIGNER_ENABLED) return [3 /*break*/, 5];
                                                logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'LOCAL_SIGNER mode enabled: bypassing Privy and sending via local key', {
                                                    chainId: tx.chainId,
                                                    txPurpose: tx.txPurpose || 'other'
                                                });
                                                return [4 /*yield*/, sendWithLocalSigner(tx)];
                                            case 4:
                                                localSignerLifecycle = _a.sent();
                                                syncLifecycleIntoRuntimeContext(tx, localSignerLifecycle);
                                                return [2 /*return*/, localSignerLifecycle];
                                            case 5:
                                                client_1 = getPrivyClient();
                                                MAX_RETRIES_1 = 3;
                                                NETWORK_RETRY_DELAY_MS_1 = 900;
                                                NONCE_RETRY_DELAY_MS_1 = 250;
                                                return [4 /*yield*/, getEmbeddedWalletInfo(userId, { chainType: 'ethereum' })];
                                            case 6:
                                                walletInfo_1 = _a.sent();
                                                if (!walletInfo_1) {
                                                    throw new errorHandler_js_1.AppError(400, 'User has no EVM embedded wallet', 'NO_EVM_WALLET');
                                                }
                                                if (!isLikelyEvmAddress(walletInfo_1.address)) {
                                                    throw new errorHandler_js_1.AppError(400, 'User has no EVM embedded wallet', 'NO_EVM_WALLET');
                                                }
                                                return [4 /*yield*/, (0, walletNonceLane_js_1.withWalletChainLock)(tx.chainId, walletInfo_1.address, function () { return __awaiter(_this, void 0, void 0, function () {
                                                        var txWithNonce, hasExplicitFee, needsNonce, shouldLoadNonceFloor, needsGas, _a, nonceResult, gasPriceResult, resolvedNonce, baseGasPrice, gasPolicy, bumpedGasPrice, finalGasPrice, needsDeterministicNonce, provider, fallbackNonce, fallbackErr_1, verboseTxLog, priorAcceptedLifecycle, _loop_1, attempt, state_1, terminalLifecycle;
                                                        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                                                        return __generator(this, function (_p) {
                                                            switch (_p.label) {
                                                                case 0:
                                                                    txWithNonce = __assign({}, tx);
                                                                    hasExplicitFee = !!txWithNonce.gasPrice
                                                                        || !!txWithNonce.maxFeePerGas
                                                                        || !!txWithNonce.maxPriorityFeePerGas;
                                                                    needsNonce = !txWithNonce.nonce;
                                                                    shouldLoadNonceFloor = !!txWithNonce.nonce && txWithNonce.txPurpose !== 'speedup';
                                                                    needsGas = !hasExplicitFee;
                                                                    if (!(needsNonce || needsGas || shouldLoadNonceFloor)) return [3 /*break*/, 2];
                                                                    return [4 /*yield*/, Promise.all([
                                                                            (needsNonce || shouldLoadNonceFloor)
                                                                                ? getPendingNonce(txWithNonce.chainId, walletInfo_1.address).catch(function () { return undefined; })
                                                                                : Promise.resolve(txWithNonce.nonce),
                                                                            needsGas
                                                                                ? (0, rpcManager_js_1.callRpc)(txWithNonce.chainId, 'eth_gasPrice', [], {
                                                                                    strategy: profile_js_1.EXECUTION_FEE_PROFILE.strategy,
                                                                                    purpose: profile_js_1.EXECUTION_FEE_PROFILE.purpose,
                                                                                    importance: profile_js_1.EXECUTION_FEE_PROFILE.importance,
                                                                                }).catch(function () { return null; })
                                                                                : Promise.resolve(null)
                                                                        ])];
                                                                case 1:
                                                                    _a = _p.sent(), nonceResult = _a[0], gasPriceResult = _a[1];
                                                                    if (needsNonce && nonceResult) {
                                                                        txWithNonce.nonce = nonceResult;
                                                                    }
                                                                    if (!needsNonce && shouldLoadNonceFloor) {
                                                                        resolvedNonce = (0, nonceFloorPolicy_js_1.resolveNonceFloor)({
                                                                            requestedNonce: txWithNonce.nonce,
                                                                            cachedFloorNonce: nonceResult,
                                                                            txPurpose: txWithNonce.txPurpose,
                                                                            hasPriorAcceptedLifecycle: false
                                                                        });
                                                                        if (resolvedNonce.upgraded && resolvedNonce.nonce) {
                                                                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Raised explicit nonce to cached wallet floor before send', {
                                                                                chainId: txWithNonce.chainId,
                                                                                txPurpose: txWithNonce.txPurpose || 'other',
                                                                                requestedNonce: txWithNonce.nonce,
                                                                                cachedFloorNonce: nonceResult,
                                                                                nextNonce: resolvedNonce.nonce
                                                                            });
                                                                            txWithNonce.nonce = resolvedNonce.nonce;
                                                                        }
                                                                    }
                                                                    if (needsGas && gasPriceResult) {
                                                                        try {
                                                                            baseGasPrice = BigInt(gasPriceResult);
                                                                            gasPolicy = resolveTradeGasPolicy(txWithNonce);
                                                                            bumpedGasPrice = (baseGasPrice * gasPolicy.bumpBps + 9999n) / 10000n;
                                                                            finalGasPrice = bumpedGasPrice > gasPolicy.minGasPriceWei
                                                                                ? bumpedGasPrice
                                                                                : gasPolicy.minGasPriceWei;
                                                                            txWithNonce = __assign(__assign({}, txWithNonce), { gasPrice: finalGasPrice.toString() });
                                                                            logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Privy gas policy applied', {
                                                                                chainId: txWithNonce.chainId,
                                                                                txPurpose: txWithNonce.txPurpose || 'other',
                                                                                executionProfile: txWithNonce.executionProfile || 'default',
                                                                                policy: gasPolicy.policy,
                                                                                baseGasPriceWei: baseGasPrice.toString(),
                                                                                bumpBps: gasPolicy.bumpBps.toString(),
                                                                                minGasPriceWei: gasPolicy.minGasPriceWei.toString(),
                                                                                finalGasPriceWei: finalGasPrice.toString()
                                                                            });
                                                                        }
                                                                        catch (gasErr) {
                                                                            logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Failed to derive gasPrice for Privy tx; continuing without explicit gas price', {
                                                                                chainId: txWithNonce.chainId,
                                                                                txPurpose: txWithNonce.txPurpose || 'other',
                                                                                error: (gasErr === null || gasErr === void 0 ? void 0 : gasErr.message) || String(gasErr)
                                                                            });
                                                                        }
                                                                    }
                                                                    _p.label = 2;
                                                                case 2:
                                                                    needsDeterministicNonce = txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup';
                                                                    if (!(needsDeterministicNonce && !txWithNonce.nonce)) return [3 /*break*/, 6];
                                                                    _p.label = 3;
                                                                case 3:
                                                                    _p.trys.push([3, 5, , 6]);
                                                                    provider = (0, rpcManager_js_1.getEthersProvider)(txWithNonce.chainId, 'tx_visibility');
                                                                    return [4 /*yield*/, provider.getTransactionCount(walletInfo_1.address, 'pending')];
                                                                case 4:
                                                                    fallbackNonce = _p.sent();
                                                                    txWithNonce.nonce = BigInt(fallbackNonce).toString();
                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Trade nonce fallback applied from ethers provider', {
                                                                        chainId: txWithNonce.chainId,
                                                                        txPurpose: txWithNonce.txPurpose,
                                                                        nonce: txWithNonce.nonce
                                                                    });
                                                                    return [3 /*break*/, 6];
                                                                case 5:
                                                                    fallbackErr_1 = _p.sent();
                                                                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'Failed to resolve deterministic nonce for trade tx', {
                                                                        chainId: txWithNonce.chainId,
                                                                        txPurpose: txWithNonce.txPurpose,
                                                                        error: (fallbackErr_1 === null || fallbackErr_1 === void 0 ? void 0 : fallbackErr_1.message) || String(fallbackErr_1)
                                                                    });
                                                                    return [3 /*break*/, 6];
                                                                case 6:
                                                                    verboseTxLog = (process.env.PRIVY_TX_DEBUG || 'false') === 'true';
                                                                    if (verboseTxLog) {
                                                                        console.log('[sendTransaction] ========== PRIVY TX PARAMS ==========');
                                                                        console.log('[sendTransaction] From:', walletInfo_1.address);
                                                                        console.log('[sendTransaction] To:', txWithNonce.to);
                                                                        console.log('[sendTransaction] Value:', txWithNonce.value);
                                                                        console.log('[sendTransaction] ValueHex:', txWithNonce.value ? "0x".concat(BigInt(txWithNonce.value).toString(16)) : 'undefined');
                                                                        console.log('[sendTransaction] Data length:', (_b = txWithNonce.data) === null || _b === void 0 ? void 0 : _b.length);
                                                                        console.log('[sendTransaction] Data prefix:', (_d = (_c = txWithNonce.data) === null || _c === void 0 ? void 0 : _c.slice) === null || _d === void 0 ? void 0 : _d.call(_c, 0, 82));
                                                                        console.log('[sendTransaction] ChainId:', txWithNonce.chainId);
                                                                        console.log('[sendTransaction] Gas:', txWithNonce.gas);
                                                                        console.log('[sendTransaction] GasPrice:', txWithNonce.gasPrice);
                                                                        console.log('[sendTransaction] MaxFeePerGas:', txWithNonce.maxFeePerGas);
                                                                        console.log('[sendTransaction] MaxPriorityFeePerGas:', txWithNonce.maxPriorityFeePerGas);
                                                                        console.log('[sendTransaction] Profile:', txWithNonce.executionProfile);
                                                                        console.log('[sendTransaction] ===========================================');
                                                                    }
                                                                    else {
                                                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Privy tx prepared', {
                                                                            chainId: txWithNonce.chainId,
                                                                            to: (_e = txWithNonce.to) === null || _e === void 0 ? void 0 : _e.slice(0, 10),
                                                                            value: txWithNonce.value,
                                                                            gas: txWithNonce.gas,
                                                                            nonce: txWithNonce.nonce,
                                                                            purpose: txWithNonce.txPurpose || 'other',
                                                                            profile: txWithNonce.executionProfile,
                                                                            gasPrice: txWithNonce.gasPrice,
                                                                            dataLength: ((_f = txWithNonce.data) === null || _f === void 0 ? void 0 : _f.length) || 0,
                                                                            sendTxAllowlist: Array.from(PRIVY_SEND_TX_CHAIN_IDS.values())
                                                                        });
                                                                    }
                                                                    priorAcceptedLifecycle = null;
                                                                    _loop_1 = function (attempt) {
                                                                        var attemptState, bumpGasForVisibilityRetry, preferPrivySendTx, fastTradePath, useRawPathForSpeed, rawLifecycle, retryDecision, upgradedLifecycle, privyTx, response, lifecycleBase_1, visibility, postSendDelayMs_1, retryDecision, upgradedLifecycle, finalState, error_3, effectiveError, errorMessage, lowerErrorMessage, preferPrivySendTx, unsupportedSendOnNonEth, fallbackLifecycle, bumpBps, current, bumped, fallbackError_1, isPrivyTransportTransient, transientFallback, bumpBps, current, bumped, fallbackError_2, hasUnderpricedHint, isNonceTooLowError, isReplacementUnderpricedError, isNonceError, isNetworkError, reason, keepSameNonceForSafety, bumpBps, current, bumped, nextTx, current, bumped, current, bumped, currentNonce, refreshedNonceHex, refreshedNonce, nextNonce, currentNonce, refreshedNonceHex, refreshedNonce, nextNonce, bumpBps, current, bumped, nextTx, current, bumped, current, bumped, retryDelayMs_1;
                                                                        return __generator(this, function (_q) {
                                                                            switch (_q.label) {
                                                                                case 0:
                                                                                    attemptState = runtimeContext_1
                                                                                        ? (0, context_js_1.addOrderAttempt)(runtimeContext_1, {
                                                                                            attempt: attempt,
                                                                                            channel: 'unknown',
                                                                                            state: 'sending',
                                                                                            nonce: txWithNonce.nonce,
                                                                                            gasPrice: txWithNonce.gasPrice,
                                                                                            maxFeePerGas: txWithNonce.maxFeePerGas,
                                                                                            maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas,
                                                                                            startedAt: Date.now()
                                                                                        })
                                                                                        : null;
                                                                                    _q.label = 1;
                                                                                case 1:
                                                                                    _q.trys.push([1, 22, , 45]);
                                                                                    bumpGasForVisibilityRetry = function (reason) {
                                                                                        var nextTx = __assign({}, txWithNonce);
                                                                                        var bumpBps = 12500n; // +25%
                                                                                        if (nextTx.gasPrice) {
                                                                                            var current = BigInt(nextTx.gasPrice);
                                                                                            var bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                            nextTx.gasPrice = (bumped > current ? bumped : (current + 1n)).toString();
                                                                                        }
                                                                                        else {
                                                                                            if (nextTx.maxFeePerGas) {
                                                                                                var current = BigInt(nextTx.maxFeePerGas);
                                                                                                var bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                                nextTx.maxFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                                                                            }
                                                                                            if (nextTx.maxPriorityFeePerGas) {
                                                                                                var current = BigInt(nextTx.maxPriorityFeePerGas);
                                                                                                var bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                                nextTx.maxPriorityFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                                                                            }
                                                                                        }
                                                                                        txWithNonce = nextTx;
                                                                                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Privy tx unseen after broadcast; bumping gas and retrying with same nonce', {
                                                                                            chainId: txWithNonce.chainId,
                                                                                            attempt: attempt,
                                                                                            maxAttempts: MAX_RETRIES_1,
                                                                                            reason: reason,
                                                                                            nonce: txWithNonce.nonce,
                                                                                            gasPrice: txWithNonce.gasPrice,
                                                                                            maxFeePerGas: txWithNonce.maxFeePerGas,
                                                                                            maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas
                                                                                        });
                                                                                    };
                                                                                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Sending Ethereum transaction via Privy', {
                                                                                        attempt: attempt,
                                                                                        from: (_g = walletInfo_1.address) === null || _g === void 0 ? void 0 : _g.slice(0, 10),
                                                                                        to: (_h = txWithNonce.to) === null || _h === void 0 ? void 0 : _h.slice(0, 10),
                                                                                        chainId: txWithNonce.chainId,
                                                                                    });
                                                                                    preferPrivySendTx = PRIVY_SEND_TX_CHAIN_IDS.has(txWithNonce.chainId);
                                                                                    fastTradePath = isFastTradeExecutionProfile(txWithNonce);
                                                                                    useRawPathForSpeed = fastTradePath && preferPrivySendTx && PRIVY_FAST_TRADE_FORCE_RAW_PATH;
                                                                                    if (!(!preferPrivySendTx || useRawPathForSpeed)) return [3 /*break*/, 9];
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                            channel: 'raw_broadcast',
                                                                                            nonce: txWithNonce.nonce,
                                                                                            gasPrice: txWithNonce.gasPrice,
                                                                                            maxFeePerGas: txWithNonce.maxFeePerGas,
                                                                                            maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas
                                                                                        });
                                                                                    }
                                                                                    return [4 /*yield*/, signAndBroadcastRawTransaction(client_1, walletInfo_1.id, txWithNonce, {
                                                                                            userId: userId,
                                                                                            attempt: attempt,
                                                                                            reason: useRawPathForSpeed ? 'fast_trade_sign_broadcast' : 'chain_not_in_privy_sendtx_allowlist',
                                                                                            expectedFrom: walletInfo_1.address,
                                                                                            txPurpose: txWithNonce.txPurpose
                                                                                        })];
                                                                                case 2:
                                                                                    rawLifecycle = _q.sent();
                                                                                    if (!(rawLifecycle.txHash && (0, txLifecycle_js_1.isTxLifecycleSendAccepted)(rawLifecycle))) return [3 /*break*/, 4];
                                                                                    priorAcceptedLifecycle = __assign({}, rawLifecycle);
                                                                                    seedNextPendingNonce(txWithNonce.chainId, walletInfo_1.address, txWithNonce.nonce);
                                                                                    reportAcceptedEvidence(tx, rawLifecycle.txHash, 'raw_broadcast');
                                                                                    return [4 /*yield*/, syncAcceptedCopytradePendingPosition({
                                                                                            runtimeContext: runtimeContext_1,
                                                                                            txHash: rawLifecycle.txHash,
                                                                                            lifecycleStatus: rawLifecycle.status,
                                                                                        })];
                                                                                case 3:
                                                                                    _q.sent();
                                                                                    _q.label = 4;
                                                                                case 4:
                                                                                    if (runtimeContext_1) {
                                                                                        if (rawLifecycle.txHash) {
                                                                                            (0, context_js_1.attachOrderTxHash)(runtimeContext_1, rawLifecycle.txHash, { canonical: true });
                                                                                        }
                                                                                        if (rawLifecycle.txHash && (0, txLifecycle_js_1.isTxLifecycleSendAccepted)(rawLifecycle)) {
                                                                                            (0, context_js_1.markOrderHashAccepted)(runtimeContext_1, rawLifecycle.txHash);
                                                                                        }
                                                                                        (0, context_js_1.recordLifecycleOnOrder)(runtimeContext_1, rawLifecycle, {
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(rawLifecycle.lastRpcError || rawLifecycle.status)
                                                                                        });
                                                                                    }
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                            state: rawLifecycle.status === 'confirmed_success'
                                                                                                ? 'confirmed_success'
                                                                                                : rawLifecycle.status === 'confirmed_failed'
                                                                                                    ? 'confirmed_failed'
                                                                                                    : rawLifecycle.status === 'visible_pending'
                                                                                                        ? 'visible'
                                                                                                        : rawLifecycle.status === 'broadcasted_unseen'
                                                                                                            ? 'uncertain'
                                                                                                            : 'accepted',
                                                                                            txHash: rawLifecycle.txHash,
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(rawLifecycle.lastRpcError || rawLifecycle.status),
                                                                                            error: rawLifecycle.lastRpcError
                                                                                        });
                                                                                    }
                                                                                    if (!(rawLifecycle.status === 'broadcasted_unseen')) return [3 /*break*/, 6];
                                                                                    retryDecision = (0, visibilityPolicy_js_1.shouldRetryAfterBroadcastUnseen)({
                                                                                        chainId: txWithNonce.chainId,
                                                                                        txHash: rawLifecycle.txHash,
                                                                                        runtimeContext: runtimeContext_1,
                                                                                        lifecycle: rawLifecycle,
                                                                                        attempt: attempt,
                                                                                        maxRetries: MAX_RETRIES_1,
                                                                                        hasNonce: !!txWithNonce.nonce,
                                                                                        txPurpose: txWithNonce.txPurpose,
                                                                                        fastTradePath: fastTradePath
                                                                                    });
                                                                                    if (!retryDecision.retry) return [3 /*break*/, 6];
                                                                                    if (retryDecision.bumpGas) {
                                                                                        bumpGasForVisibilityRetry(fastTradePath
                                                                                            ? 'raw_path_broadcasted_unseen_fast_trade'
                                                                                            : 'raw_path_broadcasted_unseen');
                                                                                    }
                                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Raw path broadcasted_unseen retry scheduled', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        txHash: rawLifecycle.txHash,
                                                                                        status: rawLifecycle.status,
                                                                                        attempt: attempt,
                                                                                        reason: retryDecision.reason
                                                                                    });
                                                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, NETWORK_RETRY_DELAY_MS_1); })];
                                                                                case 5:
                                                                                    _q.sent();
                                                                                    return [2 /*return*/, "continue"];
                                                                                case 6:
                                                                                    if (!(fastTradePath
                                                                                        && rawLifecycle.status === 'broadcasted_unseen'
                                                                                        && !!txWithNonce.nonce)) return [3 /*break*/, 8];
                                                                                    return [4 /*yield*/, tryResolveFastTradeUnresolvedVisibility({
                                                                                            lifecycle: rawLifecycle,
                                                                                            chainId: txWithNonce.chainId,
                                                                                            txHash: rawLifecycle.txHash,
                                                                                            expectedFrom: walletInfo_1.address,
                                                                                            path: 'raw_sign_broadcast'
                                                                                        })];
                                                                                case 7:
                                                                                    upgradedLifecycle = _q.sent();
                                                                                    if (upgradedLifecycle.status !== 'broadcasted_unseen') {
                                                                                        return [2 /*return*/, { value: upgradedLifecycle }];
                                                                                    }
                                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Fast trade raw path unresolved visibility; returning uncertain lifecycle', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        txHash: rawLifecycle.txHash,
                                                                                        attempts: attempt
                                                                                    });
                                                                                    return [2 /*return*/, { value: upgradedLifecycle }];
                                                                                case 8: return [2 /*return*/, { value: rawLifecycle }];
                                                                                case 9:
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                            channel: 'privy_sendtx',
                                                                                            nonce: txWithNonce.nonce,
                                                                                            gasPrice: txWithNonce.gasPrice,
                                                                                            maxFeePerGas: txWithNonce.maxFeePerGas,
                                                                                            maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas
                                                                                        });
                                                                                    }
                                                                                    privyTx = {
                                                                                        to: txWithNonce.to,
                                                                                        data: txWithNonce.data,
                                                                                        value: toHexQuantity(txWithNonce.value),
                                                                                        gasLimit: toHexQuantity(txWithNonce.gas),
                                                                                        gasPrice: toHexQuantity(txWithNonce.gasPrice),
                                                                                        maxFeePerGas: toHexQuantity(txWithNonce.maxFeePerGas),
                                                                                        maxPriorityFeePerGas: toHexQuantity(txWithNonce.maxPriorityFeePerGas),
                                                                                        nonce: toHexQuantity(txWithNonce.nonce),
                                                                                    };
                                                                                    return [4 /*yield*/, client_1.walletApi.ethereum.sendTransaction({
                                                                                            walletId: walletInfo_1.id,
                                                                                            caip2: "eip155:".concat(txWithNonce.chainId),
                                                                                            transaction: privyTx,
                                                                                        })];
                                                                                case 10:
                                                                                    response = _q.sent();
                                                                                    logger_js_1.logger.info(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Ethereum transaction sent via Privy', {
                                                                                        txHash: response.hash,
                                                                                        chainId: txWithNonce.chainId,
                                                                                        walletId: (_k = (_j = walletInfo_1.id) === null || _j === void 0 ? void 0 : _j.slice) === null || _k === void 0 ? void 0 : _k.call(_j, 0, 12),
                                                                                        expectedFrom: walletInfo_1.address
                                                                                    });
                                                                                    logger_js_1.logger.info(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, "Ethereum transaction sent via Privy txHash=".concat(response.hash), {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        walletId: (_m = (_l = walletInfo_1.id) === null || _l === void 0 ? void 0 : _l.slice) === null || _m === void 0 ? void 0 : _m.call(_l, 0, 12),
                                                                                        expectedFrom: walletInfo_1.address
                                                                                    });
                                                                                    scheduleTxVisibilityCheck({
                                                                                        path: 'privy_sendtx',
                                                                                        chainId: txWithNonce.chainId,
                                                                                        txHash: response.hash,
                                                                                        expectedFrom: walletInfo_1.address
                                                                                    });
                                                                                    lifecycleBase_1 = {
                                                                                        status: 'broadcasted_unseen',
                                                                                        txHash: response.hash,
                                                                                        attempts: 1,
                                                                                        chainId: txWithNonce.chainId
                                                                                    };
                                                                                    priorAcceptedLifecycle = __assign({}, lifecycleBase_1);
                                                                                    seedNextPendingNonce(txWithNonce.chainId, walletInfo_1.address, txWithNonce.nonce);
                                                                                    reportAcceptedEvidence(tx, response.hash, 'privy_sendtx');
                                                                                    return [4 /*yield*/, syncAcceptedCopytradePendingPosition({
                                                                                            runtimeContext: runtimeContext_1,
                                                                                            txHash: response.hash,
                                                                                            lifecycleStatus: lifecycleBase_1.status,
                                                                                        })];
                                                                                case 11:
                                                                                    _q.sent();
                                                                                    if (runtimeContext_1) {
                                                                                        (0, context_js_1.attachOrderTxHash)(runtimeContext_1, response.hash, { canonical: true });
                                                                                        (0, context_js_1.markOrderHashAccepted)(runtimeContext_1, response.hash);
                                                                                    }
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                            state: 'accepted',
                                                                                            txHash: response.hash
                                                                                        });
                                                                                    }
                                                                                    if (shouldReturnAcceptedLifecycleImmediately(txWithNonce)) {
                                                                                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, txWithNonce.txPurpose === 'approval'
                                                                                            ? 'Privy lifecycle early return for approval send'
                                                                                            : 'Privy lifecycle early return for fast trade send', {
                                                                                            chainId: txWithNonce.chainId,
                                                                                            txHash: response.hash,
                                                                                            txPurpose: txWithNonce.txPurpose,
                                                                                            executionProfile: txWithNonce.executionProfile || 'default',
                                                                                        });
                                                                                        if (runtimeContext_1) {
                                                                                            (0, context_js_1.recordLifecycleOnOrder)(runtimeContext_1, lifecycleBase_1, {
                                                                                                reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(lifecycleBase_1.lastRpcError || lifecycleBase_1.status)
                                                                                            });
                                                                                        }
                                                                                        if (attemptState) {
                                                                                            (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                                state: 'accepted',
                                                                                                reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(lifecycleBase_1.status),
                                                                                            });
                                                                                        }
                                                                                        return [2 /*return*/, { value: lifecycleBase_1 }];
                                                                                    }
                                                                                    if (!!fastTradePath) return [3 /*break*/, 13];
                                                                                    return [4 /*yield*/, verifyTxVisibility(txWithNonce.chainId, response.hash, walletInfo_1.address, {
                                                                                            retries: PRIVY_TX_SYNC_VISIBILITY_RETRIES,
                                                                                            delayMs: PRIVY_TX_SYNC_VISIBILITY_DELAY_MS
                                                                                        })];
                                                                                case 12:
                                                                                    visibility = _q.sent();
                                                                                    lifecycleBase_1.status = visibility.visible ? 'visible_pending' : 'broadcasted_unseen';
                                                                                    lifecycleBase_1.firstSeenAt = visibility.visible ? Date.now() : undefined;
                                                                                    lifecycleBase_1.lastRpcError = visibility.visible ? undefined : (visibility.lastError || 'not_found_by_rpc');
                                                                                    lifecycleBase_1.attempts = visibility.checks;
                                                                                    priorAcceptedLifecycle = __assign({}, lifecycleBase_1);
                                                                                    _q.label = 13;
                                                                                case 13:
                                                                                    if (runtimeContext_1) {
                                                                                        (0, context_js_1.recordLifecycleOnOrder)(runtimeContext_1, lifecycleBase_1, {
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(lifecycleBase_1.lastRpcError || lifecycleBase_1.status)
                                                                                        });
                                                                                    }
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                            state: lifecycleBase_1.status === 'confirmed_success'
                                                                                                ? 'confirmed_success'
                                                                                                : lifecycleBase_1.status === 'confirmed_failed'
                                                                                                    ? 'confirmed_failed'
                                                                                                    : lifecycleBase_1.status === 'visible_pending'
                                                                                                        ? 'visible'
                                                                                                        : lifecycleBase_1.status === 'broadcasted_unseen'
                                                                                                            ? 'uncertain'
                                                                                                            : 'accepted',
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(lifecycleBase_1.lastRpcError || lifecycleBase_1.status),
                                                                                            error: lifecycleBase_1.lastRpcError
                                                                                        });
                                                                                    }
                                                                                    postSendDelayMs_1 = Math.max(0, Number(process.env.PRIVY_POST_SEND_DELAY_MS || '0'));
                                                                                    if (!(postSendDelayMs_1 > 0)) return [3 /*break*/, 15];
                                                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, postSendDelayMs_1); })];
                                                                                case 14:
                                                                                    _q.sent();
                                                                                    _q.label = 15;
                                                                                case 15:
                                                                                    if (!(lifecycleBase_1.status === 'broadcasted_unseen')) return [3 /*break*/, 17];
                                                                                    retryDecision = (0, visibilityPolicy_js_1.shouldRetryAfterBroadcastUnseen)({
                                                                                        chainId: txWithNonce.chainId,
                                                                                        txHash: response.hash,
                                                                                        runtimeContext: runtimeContext_1,
                                                                                        lifecycle: lifecycleBase_1,
                                                                                        attempt: attempt,
                                                                                        maxRetries: MAX_RETRIES_1,
                                                                                        hasNonce: !!txWithNonce.nonce,
                                                                                        txPurpose: txWithNonce.txPurpose,
                                                                                        fastTradePath: fastTradePath
                                                                                    });
                                                                                    if (!retryDecision.retry) return [3 /*break*/, 17];
                                                                                    if (retryDecision.bumpGas) {
                                                                                        bumpGasForVisibilityRetry(fastTradePath
                                                                                            ? 'privy_sendtx_broadcasted_unseen_fast_trade'
                                                                                            : 'privy_sendtx_broadcasted_unseen');
                                                                                    }
                                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Privy send broadcasted_unseen retry scheduled', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        txHash: response.hash,
                                                                                        status: lifecycleBase_1.status,
                                                                                        checks: lifecycleBase_1.attempts,
                                                                                        attempt: attempt,
                                                                                        reason: retryDecision.reason
                                                                                    });
                                                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, NETWORK_RETRY_DELAY_MS_1); })];
                                                                                case 16:
                                                                                    _q.sent();
                                                                                    return [2 /*return*/, "continue"];
                                                                                case 17:
                                                                                    if (!(fastTradePath
                                                                                        && lifecycleBase_1.status === 'broadcasted_unseen'
                                                                                        && !!txWithNonce.nonce)) return [3 /*break*/, 19];
                                                                                    return [4 /*yield*/, tryResolveFastTradeUnresolvedVisibility({
                                                                                            lifecycle: lifecycleBase_1,
                                                                                            chainId: txWithNonce.chainId,
                                                                                            txHash: response.hash,
                                                                                            expectedFrom: walletInfo_1.address,
                                                                                            path: 'privy_sendtx'
                                                                                        })];
                                                                                case 18:
                                                                                    upgradedLifecycle = _q.sent();
                                                                                    if (upgradedLifecycle.status !== 'broadcasted_unseen') {
                                                                                        return [2 /*return*/, { value: upgradedLifecycle }];
                                                                                    }
                                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Privy fast trade send pending visibility after short sync probe', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        txHash: response.hash,
                                                                                        attempts: attempt
                                                                                    });
                                                                                    return [2 /*return*/, { value: upgradedLifecycle }];
                                                                                case 19:
                                                                                    if (fastTradePath) {
                                                                                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Privy fast trade lifecycle early return', {
                                                                                            chainId: txWithNonce.chainId,
                                                                                            txHash: response.hash,
                                                                                            status: lifecycleBase_1.status,
                                                                                            checks: lifecycleBase_1.attempts
                                                                                        });
                                                                                        return [2 /*return*/, { value: lifecycleBase_1 }];
                                                                                    }
                                                                                    if (!(txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup')) return [3 /*break*/, 21];
                                                                                    return [4 /*yield*/, (0, rpcManager_js_1.waitForReceiptStateMachine)({
                                                                                            chainId: txWithNonce.chainId,
                                                                                            txHash: response.hash,
                                                                                            expectedFrom: walletInfo_1.address,
                                                                                            maxWaitMs: 900,
                                                                                            pollMs: 300
                                                                                        }).catch(function () { return lifecycleBase_1; })];
                                                                                case 20:
                                                                                    finalState = _q.sent();
                                                                                    if (runtimeContext_1) {
                                                                                        (0, context_js_1.recordLifecycleOnOrder)(runtimeContext_1, finalState, {
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(finalState.lastRpcError || finalState.status)
                                                                                        });
                                                                                    }
                                                                                    if (finalState.status === 'dropped_timeout' && lifecycleBase_1.status === 'broadcasted_unseen') {
                                                                                        return [2 /*return*/, { value: lifecycleBase_1 }];
                                                                                    }
                                                                                    return [2 /*return*/, { value: finalState }];
                                                                                case 21: return [2 /*return*/, { value: lifecycleBase_1 }];
                                                                                case 22:
                                                                                    error_3 = _q.sent();
                                                                                    effectiveError = error_3;
                                                                                    errorMessage = (effectiveError === null || effectiveError === void 0 ? void 0 : effectiveError.message) || '';
                                                                                    lowerErrorMessage = String(errorMessage || '').toLowerCase();
                                                                                    preferPrivySendTx = PRIVY_SEND_TX_CHAIN_IDS.has(txWithNonce.chainId);
                                                                                    unsupportedSendOnNonEth = txWithNonce.chainId !== 1 && errorMessage.includes('eth_sendTransaction is only supported for Ethereum');
                                                                                    if (!unsupportedSendOnNonEth) return [3 /*break*/, 28];
                                                                                    _q.label = 23;
                                                                                case 23:
                                                                                    _q.trys.push([23, 27, , 28]);
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, { channel: 'raw_broadcast' });
                                                                                    }
                                                                                    return [4 /*yield*/, signAndBroadcastRawTransaction(client_1, walletInfo_1.id, txWithNonce, {
                                                                                            userId: userId,
                                                                                            attempt: attempt,
                                                                                            reason: 'privy_sendtx_unsupported_for_chain',
                                                                                            expectedFrom: walletInfo_1.address,
                                                                                            txPurpose: txWithNonce.txPurpose
                                                                                        })];
                                                                                case 24:
                                                                                    fallbackLifecycle = _q.sent();
                                                                                    if (fallbackLifecycle.txHash && (0, txLifecycle_js_1.isTxLifecycleSendAccepted)(fallbackLifecycle)) {
                                                                                        seedNextPendingNonce(txWithNonce.chainId, walletInfo_1.address, txWithNonce.nonce);
                                                                                    }
                                                                                    if (runtimeContext_1) {
                                                                                        (0, context_js_1.recordLifecycleOnOrder)(runtimeContext_1, fallbackLifecycle, {
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(fallbackLifecycle.lastRpcError || fallbackLifecycle.status)
                                                                                        });
                                                                                    }
                                                                                    if (!(fallbackLifecycle.status === 'broadcasted_unseen'
                                                                                        && attempt < MAX_RETRIES_1
                                                                                        && !!txWithNonce.nonce
                                                                                        && (isFastTradeExecutionProfile(txWithNonce) || txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup'))) return [3 /*break*/, 26];
                                                                                    // ⚡ FAST TRADE: tx was broadcast via fanout. Don't block for gas-bump retry.
                                                                                    if (isFastTradeExecutionProfile(txWithNonce)) {
                                                                                        return [2 /*return*/, { value: fallbackLifecycle }];
                                                                                    }
                                                                                    bumpBps = 12500n;
                                                                                    if (txWithNonce.gasPrice) {
                                                                                        current = BigInt(txWithNonce.gasPrice);
                                                                                        bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                        txWithNonce = __assign(__assign({}, txWithNonce), { gasPrice: (bumped > current ? bumped : (current + 1n)).toString() });
                                                                                    }
                                                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, NETWORK_RETRY_DELAY_MS_1); })];
                                                                                case 25:
                                                                                    _q.sent();
                                                                                    return [2 /*return*/, "continue"];
                                                                                case 26: return [2 /*return*/, { value: fallbackLifecycle }];
                                                                                case 27:
                                                                                    fallbackError_1 = _q.sent();
                                                                                    logger_js_1.logger.error(logRegistry_js_1.LogCode.EXE_TX_REVERTED, 'Privy sign+broadcast fallback failed', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        error: (fallbackError_1 === null || fallbackError_1 === void 0 ? void 0 : fallbackError_1.message) || String(fallbackError_1)
                                                                                    });
                                                                                    effectiveError = fallbackError_1;
                                                                                    errorMessage = (effectiveError === null || effectiveError === void 0 ? void 0 : effectiveError.message) || String(effectiveError);
                                                                                    return [3 /*break*/, 28];
                                                                                case 28:
                                                                                    isPrivyTransportTransient = lowerErrorMessage.includes('api failed after')
                                                                                        || lowerErrorMessage.includes('fetch failed')
                                                                                        || lowerErrorMessage.includes('socket disconnected')
                                                                                        || lowerErrorMessage.includes('socket hang up')
                                                                                        || lowerErrorMessage.includes('econnreset')
                                                                                        || lowerErrorMessage.includes('etimedout')
                                                                                        || lowerErrorMessage.includes('timeout')
                                                                                        || lowerErrorMessage.includes('temporarily unavailable')
                                                                                        || lowerErrorMessage.includes('service unavailable')
                                                                                        || lowerErrorMessage.includes('http 503')
                                                                                        || lowerErrorMessage.includes('http 502')
                                                                                        || lowerErrorMessage.includes('http 504')
                                                                                        || lowerErrorMessage.includes('rate limit')
                                                                                        || lowerErrorMessage.includes('http 429');
                                                                                    if (!(preferPrivySendTx && isPrivyTransportTransient)) return [3 /*break*/, 34];
                                                                                    _q.label = 29;
                                                                                case 29:
                                                                                    _q.trys.push([29, 33, , 34]);
                                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Privy sendTransaction transient failure, switching to sign+broadcast fallback', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        attempt: attempt,
                                                                                        error: errorMessage.slice(0, 200)
                                                                                    });
                                                                                    return [4 /*yield*/, signAndBroadcastRawTransaction(client_1, walletInfo_1.id, txWithNonce, {
                                                                                            userId: userId,
                                                                                            attempt: attempt,
                                                                                            reason: 'privy_sendtx_transient_fallback',
                                                                                            expectedFrom: walletInfo_1.address,
                                                                                            txPurpose: txWithNonce.txPurpose
                                                                                        })];
                                                                                case 30:
                                                                                    transientFallback = _q.sent();
                                                                                    if (transientFallback.txHash && (0, txLifecycle_js_1.isTxLifecycleSendAccepted)(transientFallback)) {
                                                                                        seedNextPendingNonce(txWithNonce.chainId, walletInfo_1.address, txWithNonce.nonce);
                                                                                    }
                                                                                    if (runtimeContext_1) {
                                                                                        (0, context_js_1.recordLifecycleOnOrder)(runtimeContext_1, transientFallback, {
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(transientFallback.lastRpcError || transientFallback.status)
                                                                                        });
                                                                                    }
                                                                                    if (!(transientFallback.status === 'broadcasted_unseen'
                                                                                        && attempt < MAX_RETRIES_1
                                                                                        && !!txWithNonce.nonce
                                                                                        && (isFastTradeExecutionProfile(txWithNonce) || txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup'))) return [3 /*break*/, 32];
                                                                                    // ⚡ FAST TRADE: tx was broadcast via fanout. Don't block for gas-bump retry.
                                                                                    if (isFastTradeExecutionProfile(txWithNonce)) {
                                                                                        return [2 /*return*/, { value: transientFallback }];
                                                                                    }
                                                                                    bumpBps = 12500n;
                                                                                    if (txWithNonce.gasPrice) {
                                                                                        current = BigInt(txWithNonce.gasPrice);
                                                                                        bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                        txWithNonce = __assign(__assign({}, txWithNonce), { gasPrice: (bumped > current ? bumped : (current + 1n)).toString() });
                                                                                    }
                                                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, NETWORK_RETRY_DELAY_MS_1); })];
                                                                                case 31:
                                                                                    _q.sent();
                                                                                    return [2 /*return*/, "continue"];
                                                                                case 32: return [2 /*return*/, { value: transientFallback }];
                                                                                case 33:
                                                                                    fallbackError_2 = _q.sent();
                                                                                    logger_js_1.logger.error(logRegistry_js_1.LogCode.EXE_TX_REVERTED, 'Privy transient fallback sign+broadcast failed', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        error: (fallbackError_2 === null || fallbackError_2 === void 0 ? void 0 : fallbackError_2.message) || String(fallbackError_2)
                                                                                    });
                                                                                    effectiveError = fallbackError_2;
                                                                                    errorMessage = (effectiveError === null || effectiveError === void 0 ? void 0 : effectiveError.message) || String(effectiveError);
                                                                                    return [3 /*break*/, 34];
                                                                                case 34:
                                                                                    hasUnderpricedHint = lowerErrorMessage.includes('underpriced') ||
                                                                                        lowerErrorMessage.includes('intrinsic gas too low') ||
                                                                                        lowerErrorMessage.includes('fee too low') ||
                                                                                        lowerErrorMessage.includes('max fee per gas less than block base fee');
                                                                                    isNonceTooLowError = lowerErrorMessage.includes('nonce too low')
                                                                                        || lowerErrorMessage.includes('nonce has already been used');
                                                                                    isReplacementUnderpricedError = lowerErrorMessage.includes('replacement transaction underpriced');
                                                                                    isNonceError = isNonceTooLowError || isReplacementUnderpricedError;
                                                                                    isNetworkError = lowerErrorMessage.includes('fetch failed') ||
                                                                                        lowerErrorMessage.includes('econnreset') ||
                                                                                        lowerErrorMessage.includes('socket disconnected') ||
                                                                                        lowerErrorMessage.includes('socket hang up') ||
                                                                                        lowerErrorMessage.includes('etimedout') ||
                                                                                        lowerErrorMessage.includes('timeout') ||
                                                                                        lowerErrorMessage.includes('api failed after') ||
                                                                                        lowerErrorMessage.includes('all rpc endpoints failed') ||
                                                                                        lowerErrorMessage.includes('rpc error') ||
                                                                                        lowerErrorMessage.includes('http 502') ||
                                                                                        lowerErrorMessage.includes('http 503') ||
                                                                                        lowerErrorMessage.includes('http 504');
                                                                                    if (isNonceError && (priorAcceptedLifecycle === null || priorAcceptedLifecycle === void 0 ? void 0 : priorAcceptedLifecycle.txHash)) {
                                                                                        if (runtimeContext_1) {
                                                                                            (0, context_js_1.attachOrderTxHash)(runtimeContext_1, priorAcceptedLifecycle.txHash, { canonical: true });
                                                                                            (0, context_js_1.recordLifecycleOnOrder)(runtimeContext_1, priorAcceptedLifecycle, {
                                                                                                reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(priorAcceptedLifecycle.lastRpcError || 'nonce_too_low_after_prior_send')
                                                                                            });
                                                                                        }
                                                                                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Nonce too low after prior accepted send; adopting prior tx hash', {
                                                                                            chainId: txWithNonce.chainId,
                                                                                            txHash: priorAcceptedLifecycle.txHash,
                                                                                            attempt: attempt,
                                                                                            nonce: txWithNonce.nonce
                                                                                        });
                                                                                        return [2 /*return*/, { value: __assign(__assign({}, priorAcceptedLifecycle), { chainId: txWithNonce.chainId, attempts: Math.max(priorAcceptedLifecycle.attempts || 1, attempt), lastRpcError: priorAcceptedLifecycle.lastRpcError || 'nonce_too_low_after_prior_send' }) }];
                                                                                    }
                                                                                    if (!((isNonceError || hasUnderpricedHint || isNetworkError) && attempt < MAX_RETRIES_1)) return [3 /*break*/, 44];
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                            state: hasUnderpricedHint || isNetworkError ? 'uncertain' : 'failed',
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(errorMessage),
                                                                                            error: errorMessage
                                                                                        });
                                                                                    }
                                                                                    reason = isNonceError
                                                                                        ? (isReplacementUnderpricedError ? 'Replacement underpriced' : 'Nonce error')
                                                                                        : (hasUnderpricedHint ? 'Underpriced tx' : 'Network failure');
                                                                                    if (!isNonceError) return [3 /*break*/, 41];
                                                                                    keepSameNonceForSafety = txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup';
                                                                                    if (!keepSameNonceForSafety) return [3 /*break*/, 38];
                                                                                    if (!txWithNonce.nonce) {
                                                                                        logger_js_1.logger.error(logRegistry_js_1.LogCode.EXE_TX_REVERTED, 'Nonce retry aborted for trade tx: nonce missing', {
                                                                                            chainId: txWithNonce.chainId,
                                                                                            txPurpose: txWithNonce.txPurpose,
                                                                                            attempt: attempt
                                                                                        });
                                                                                        throw new errorHandler_js_1.AppError(500, 'Trade nonce missing; aborting retry for safety', 'TRADE_NONCE_MISSING');
                                                                                    }
                                                                                    if (!isReplacementUnderpricedError) return [3 /*break*/, 35];
                                                                                    bumpBps = 12500n;
                                                                                    if (txWithNonce.gasPrice) {
                                                                                        current = BigInt(txWithNonce.gasPrice);
                                                                                        bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                        txWithNonce = __assign(__assign({}, txWithNonce), { gasPrice: (bumped > current ? bumped : (current + 1n)).toString() });
                                                                                    }
                                                                                    else {
                                                                                        nextTx = __assign({}, txWithNonce);
                                                                                        if (nextTx.maxFeePerGas) {
                                                                                            current = BigInt(nextTx.maxFeePerGas);
                                                                                            bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                            nextTx.maxFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                                                                        }
                                                                                        if (nextTx.maxPriorityFeePerGas) {
                                                                                            current = BigInt(nextTx.maxPriorityFeePerGas);
                                                                                            bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                            nextTx.maxPriorityFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                                                                        }
                                                                                        txWithNonce = nextTx;
                                                                                    }
                                                                                    return [3 /*break*/, 37];
                                                                                case 35:
                                                                                    invalidatePendingNonce(txWithNonce.chainId, walletInfo_1.address);
                                                                                    currentNonce = txWithNonce.nonce ? BigInt(txWithNonce.nonce) : null;
                                                                                    return [4 /*yield*/, getPendingNonce(txWithNonce.chainId, walletInfo_1.address)];
                                                                                case 36:
                                                                                    refreshedNonceHex = _q.sent();
                                                                                    refreshedNonce = refreshedNonceHex ? BigInt(refreshedNonceHex) : null;
                                                                                    nextNonce = refreshedNonce !== null
                                                                                        ? (currentNonce !== null && refreshedNonce <= currentNonce ? currentNonce + 1n : refreshedNonce)
                                                                                        : (currentNonce !== null ? currentNonce + 1n : null);
                                                                                    txWithNonce = __assign(__assign({}, txWithNonce), { nonce: nextNonce !== null ? nextNonce.toString() : txWithNonce.nonce });
                                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, 'Nonce too low on deterministic trade tx, advanced nonce for retry', {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        attempt: attempt,
                                                                                        currentNonce: (currentNonce === null || currentNonce === void 0 ? void 0 : currentNonce.toString()) || null,
                                                                                        refreshedNonce: (refreshedNonce === null || refreshedNonce === void 0 ? void 0 : refreshedNonce.toString()) || null,
                                                                                        nextNonce: txWithNonce.nonce || null
                                                                                    });
                                                                                    _q.label = 37;
                                                                                case 37: return [3 /*break*/, 40];
                                                                                case 38:
                                                                                    invalidatePendingNonce(txWithNonce.chainId, walletInfo_1.address);
                                                                                    currentNonce = txWithNonce.nonce ? BigInt(txWithNonce.nonce) : null;
                                                                                    return [4 /*yield*/, getPendingNonce(txWithNonce.chainId, walletInfo_1.address)];
                                                                                case 39:
                                                                                    refreshedNonceHex = _q.sent();
                                                                                    refreshedNonce = refreshedNonceHex ? BigInt(refreshedNonceHex) : null;
                                                                                    nextNonce = refreshedNonce !== null
                                                                                        ? (currentNonce !== null && refreshedNonce <= currentNonce ? currentNonce + 1n : refreshedNonce)
                                                                                        : (currentNonce !== null ? currentNonce + 1n : null);
                                                                                    txWithNonce = __assign(__assign({}, txWithNonce), { nonce: nextNonce !== null ? nextNonce.toString() : txWithNonce.nonce });
                                                                                    _q.label = 40;
                                                                                case 40: return [3 /*break*/, 42];
                                                                                case 41:
                                                                                    if (hasUnderpricedHint) {
                                                                                        bumpBps = 13000n;
                                                                                        if (txWithNonce.gasPrice) {
                                                                                            current = BigInt(txWithNonce.gasPrice);
                                                                                            bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                            txWithNonce = __assign(__assign({}, txWithNonce), { gasPrice: (bumped > current ? bumped : (current + 1n)).toString() });
                                                                                        }
                                                                                        else {
                                                                                            nextTx = __assign({}, txWithNonce);
                                                                                            if (nextTx.maxFeePerGas) {
                                                                                                current = BigInt(nextTx.maxFeePerGas);
                                                                                                bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                                nextTx.maxFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                                                                            }
                                                                                            if (nextTx.maxPriorityFeePerGas) {
                                                                                                current = BigInt(nextTx.maxPriorityFeePerGas);
                                                                                                bumped = (current * bumpBps + 9999n) / 10000n;
                                                                                                nextTx.maxPriorityFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                                                                            }
                                                                                            txWithNonce = nextTx;
                                                                                        }
                                                                                    }
                                                                                    _q.label = 42;
                                                                                case 42:
                                                                                    retryDelayMs_1 = isNonceError ? NONCE_RETRY_DELAY_MS_1 : NETWORK_RETRY_DELAY_MS_1;
                                                                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.EXE_TX_BROADCAST, "".concat(reason, " on attempt ").concat(attempt, ", retrying in ").concat(retryDelayMs_1, "ms..."), {
                                                                                        chainId: txWithNonce.chainId,
                                                                                        nextNonce: txWithNonce.nonce
                                                                                    });
                                                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, retryDelayMs_1); })];
                                                                                case 43:
                                                                                    _q.sent();
                                                                                    return [2 /*return*/, "continue"];
                                                                                case 44:
                                                                                    logger_js_1.logger.error(logRegistry_js_1.LogCode.EXE_TX_REVERTED, 'Privy Ethereum transaction failed', { error: (effectiveError === null || effectiveError === void 0 ? void 0 : effectiveError.message) || String(effectiveError), chainId: txWithNonce.chainId });
                                                                                    if (attemptState) {
                                                                                        (0, context_js_1.updateOrderAttempt)(runtimeContext_1, attemptState.id, {
                                                                                            state: 'failed',
                                                                                            reasonCode: (0, reasonCodes_js_1.inferOrderReasonCode)(errorMessage),
                                                                                            error: errorMessage
                                                                                        });
                                                                                    }
                                                                                    if (runtimeContext_1) {
                                                                                        (0, context_js_1.markOrderFailure)(runtimeContext_1, errorMessage);
                                                                                    }
                                                                                    // Handle specific Privy errors
                                                                                    if ((effectiveError === null || effectiveError === void 0 ? void 0 : effectiveError.code) === 'insufficient_funds') {
                                                                                        throw new errorHandler_js_1.AppError(400, 'Insufficient funds for transaction', 'INSUFFICIENT_FUNDS');
                                                                                    }
                                                                                    if ((effectiveError === null || effectiveError === void 0 ? void 0 : effectiveError.code) === 'user_denied') {
                                                                                        throw new errorHandler_js_1.AppError(403, 'User denied transaction', 'USER_DENIED');
                                                                                    }
                                                                                    throw new errorHandler_js_1.AppError(500, "Failed to send transaction: ".concat((effectiveError === null || effectiveError === void 0 ? void 0 : effectiveError.message) || 'Unknown error'), 'TRANSACTION_FAILED');
                                                                                case 45: return [2 /*return*/];
                                                                            }
                                                                        });
                                                                    };
                                                                    attempt = 1;
                                                                    _p.label = 7;
                                                                case 7:
                                                                    if (!(attempt <= MAX_RETRIES_1)) return [3 /*break*/, 10];
                                                                    return [5 /*yield**/, _loop_1(attempt)];
                                                                case 8:
                                                                    state_1 = _p.sent();
                                                                    if (typeof state_1 === "object")
                                                                        return [2 /*return*/, state_1.value];
                                                                    _p.label = 9;
                                                                case 9:
                                                                    attempt++;
                                                                    return [3 /*break*/, 7];
                                                                case 10:
                                                                    terminalLifecycle = {
                                                                        status: 'dropped_timeout',
                                                                        attempts: MAX_RETRIES_1,
                                                                        chainId: tx.chainId,
                                                                        lastRpcError: 'transaction_failed_after_max_retries'
                                                                    };
                                                                    if (tx.runtimeContext) {
                                                                        (0, context_js_1.recordLifecycleOnOrder)(tx.runtimeContext, terminalLifecycle, { reasonCode: 'rpc_uncertain' });
                                                                        (0, context_js_1.markOrderFailure)(tx.runtimeContext, terminalLifecycle.lastRpcError, 'rpc_uncertain');
                                                                    }
                                                                    if (terminalLifecycle.txHash) {
                                                                        (0, service_js_1.reportRpcUncertain)({
                                                                            chainId: tx.chainId,
                                                                            txHash: terminalLifecycle.txHash,
                                                                            orderId: (_o = tx.runtimeContext) === null || _o === void 0 ? void 0 : _o.orderId,
                                                                            error: terminalLifecycle.lastRpcError || 'transaction_failed_after_max_retries'
                                                                        });
                                                                    }
                                                                    return [2 /*return*/, terminalLifecycle];
                                                            }
                                                        });
                                                    }); })];
                                            case 7: return [2 /*return*/, _a.sent()];
                                            case 8:
                                                (0, privyWalletQueue_js_1.markUserChainInflight)(userId, tx.chainId, -1);
                                                return [7 /*endfinally*/];
                                            case 9: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        });
                    }); }
                })];
        });
    });
}
function sendTransaction(userId, accessToken, tx) {
    return __awaiter(this, void 0, void 0, function () {
        var lifecycle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, sendTransactionLifecycle(userId, accessToken, tx)];
                case 1:
                    lifecycle = _a.sent();
                    if ((0, txLifecycle_js_1.isTxLifecycleSendAccepted)(lifecycle) && lifecycle.txHash) {
                        return [2 /*return*/, lifecycle.txHash];
                    }
                    throw new errorHandler_js_1.AppError(500, "Failed to send transaction: ".concat((0, txLifecycle_js_1.toTxLifecycleFailureMessage)(lifecycle)), 'TRANSACTION_FAILED');
            }
        });
    });
}
exports.__privyWalletTest = {
    shouldReturnAcceptedLifecycleImmediately: shouldReturnAcceptedLifecycleImmediately,
    isFallbackOwnedRuntimeState: isFallbackOwnedRuntimeState,
    shouldSuppressSendForFallbackOwnership: shouldSuppressSendForFallbackOwnership,
};
/**
 * Send a Solana transaction using user's embedded wallet
 */
var web3_js_1 = require("@solana/web3.js");
// Cache for server wallet to avoid repeated lookups
var serverSolanaWallet = null;
/**
 * Get or create a dedicated server-owned Solana wallet for copy trading
 * Server wallets don't require Origin headers and can be signed purely with Authorization Key
 */
function getOrCreateServerSolanaWallet() {
    return __awaiter(this, void 0, void 0, function () {
        var client, wallets, existingServerWallet, newWallet, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Return cached wallet if available
                    if (serverSolanaWallet) {
                        return [2 /*return*/, serverSolanaWallet];
                    }
                    client = getPrivyClient();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, client.walletApi.getWallets({ chainType: 'solana' })];
                case 2:
                    wallets = _a.sent();
                    existingServerWallet = wallets.data.find(function (w) { return w.chainType === 'solana'; });
                    if (existingServerWallet) {
                        serverSolanaWallet = {
                            id: existingServerWallet.id,
                            address: existingServerWallet.address
                        };
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Using existing server Solana wallet', { address: serverSolanaWallet.address });
                        return [2 /*return*/, serverSolanaWallet];
                    }
                    // Create a new server wallet if none exists
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Creating new server Solana wallet...');
                    return [4 /*yield*/, client.walletApi.create({
                            chainType: 'solana'
                        })];
                case 3:
                    newWallet = _a.sent();
                    serverSolanaWallet = {
                        id: newWallet.id,
                        address: newWallet.address
                    };
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Created new server Solana wallet', { address: serverSolanaWallet.address });
                    return [2 /*return*/, serverSolanaWallet];
                case 4:
                    error_4 = _a.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'Failed to get/create server wallet', { error: error_4.message });
                    throw new errorHandler_js_1.AppError(500, "Failed to get/create server wallet: ".concat(error_4.message), 'SERVER_WALLET_ERROR');
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get the server Solana wallet address (for balance checks, funding, etc.)
 */
function getServerSolanaWalletAddress() {
    return __awaiter(this, void 0, void 0, function () {
        var wallet;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getOrCreateServerSolanaWallet()];
                case 1:
                    wallet = _a.sent();
                    return [2 /*return*/, wallet.address];
            }
        });
    });
}
/**
 * Get user's delegated Solana wallet (if they have authorized server-side signing)
 * Returns null if user hasn't granted delegation
 */
function getDelegatedSolanaWallet(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, user, delegatedWallet, resolution, error_5;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = getPrivyClient();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.getUser(userId)];
                case 2:
                    user = _b.sent();
                    delegatedWallet = (_a = user.linkedAccounts) === null || _a === void 0 ? void 0 : _a.find(function (account) {
                        return account.type === 'wallet' &&
                            account.walletClientType === 'privy' &&
                            account.chainType === 'solana' &&
                            account.delegated === true;
                    });
                    if (!delegatedWallet) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'User has no delegated Solana wallet', { userId: userId });
                        return [2 /*return*/, null];
                    }
                    resolution = (0, solanaWalletResolver_js_1.resolveSolanaWalletRecord)(delegatedWallet);
                    if (!resolution.wallet) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, 'Delegated Solana wallet is invalid, ignoring delegated path', {
                            userId: userId,
                            reasonCode: resolution.reasonCode
                        });
                        return [2 /*return*/, null];
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'Found delegated Solana wallet for user', {
                        address: resolution.wallet.address,
                        userId: userId
                    });
                    return [2 /*return*/, resolution.wallet];
                case 3:
                    error_5 = _b.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'Error getting delegated wallet from Privy', { userId: userId, error: error_5.message });
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get user's delegated EVM wallet (if they have authorized server-side signing)
 */
function getDelegatedEvmWallet(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var client, user, delegatedWallet, walletData, error_6;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = getPrivyClient();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.getUser(userId)];
                case 2:
                    user = _b.sent();
                    delegatedWallet = (_a = user.linkedAccounts) === null || _a === void 0 ? void 0 : _a.find(function (account) {
                        return account.type === 'wallet' &&
                            account.walletClientType === 'privy' &&
                            account.chainType === 'ethereum' &&
                            account.delegated === true;
                    });
                    if (!delegatedWallet) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'User has no delegated EVM wallet', { userId: userId });
                        return [2 /*return*/, null];
                    }
                    walletData = delegatedWallet;
                    return [2 /*return*/, {
                            id: walletData.id || walletData.address,
                            address: walletData.address || ''
                        }];
                case 3:
                    error_6 = _b.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'Error checking delegated EVM wallet', { userId: userId, error: error_6.message });
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Send a Solana transaction using user's delegated wallet or fallback to server wallet
 * Prefers user's delegated wallet for better fund isolation
 */
function sendSolanaTransaction(userId, transactionBase64 // Base64 encoded transaction from Jupiter
) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = sendSolanaTransactionWithContext;
                    _b = [userId, transactionBase64];
                    return [4 /*yield*/, getSolanaSigningContext(userId)];
                case 1: return [2 /*return*/, _a.apply(void 0, _b.concat([_c.sent()]))];
            }
        });
    });
}
function getSolanaSigningContext(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, solanaSigningContext_js_1.resolveSolanaSigningContext)(userId, {
                    getDelegatedWallet: function (targetUserId) { return getDelegatedSolanaWallet(targetUserId); },
                    getServerWallet: function () { return getOrCreateServerSolanaWallet(); },
                })];
        });
    });
}
function sendSolanaTransactionWithContext(userId, transactionBase64, signingContext) {
    return __awaiter(this, void 0, void 0, function () {
        var client;
        return __generator(this, function (_a) {
            client = getPrivyClient();
            return [2 /*return*/, (0, solanaPrivySender_js_1.sendSolanaTransactionWithContextDeps)(userId, transactionBase64, signingContext, {
                    deserializeTransaction: web3_js_1.VersionedTransaction.deserialize,
                    signAndSendTransaction: function (params) { return client.walletApi.solana.signAndSendTransaction(params); },
                })];
        });
    });
}
function signTypedData(userId_1, typedData_1) {
    return __awaiter(this, arguments, void 0, function (userId, typedData, chainId // Default to Polygon for Polymarket
    ) {
        var client, walletInfo, response, error_7;
        var _a;
        if (chainId === void 0) { chainId = 137; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = getPrivyClient();
                    return [4 /*yield*/, getEmbeddedWalletInfo(userId, { chainType: 'ethereum' })];
                case 1:
                    walletInfo = _b.sent();
                    if (!walletInfo) {
                        throw new errorHandler_js_1.AppError(400, 'User has no EVM embedded wallet', 'NO_EVM_WALLET');
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'Signing EIP-712 typed data via Privy', {
                        userId: userId,
                        primaryType: typedData.primaryType,
                        chainId: chainId,
                    });
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, client.walletApi.ethereum.signTypedData({
                            walletId: walletInfo.id,
                            caip2: "eip155:".concat(chainId),
                            typedData: {
                                domain: typedData.domain,
                                types: typedData.types,
                                primaryType: typedData.primaryType,
                                message: typedData.message,
                            },
                        })];
                case 3:
                    response = _b.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'EIP-712 signature obtained via Privy', { userId: userId });
                    return [2 /*return*/, response.signature];
                case 4:
                    error_7 = _b.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'EIP-712 signing failed via Privy', { error: error_7.message, userId: userId });
                    // Handle specific errors
                    if ((_a = error_7.message) === null || _a === void 0 ? void 0 : _a.includes('not delegated')) {
                        throw new errorHandler_js_1.AppError(403, 'User has not enabled server-side signing. Please enable delegation in wallet settings.', 'DELEGATION_REQUIRED');
                    }
                    throw new errorHandler_js_1.AppError(500, "Failed to sign typed data: ".concat(error_7.message || 'Unknown error'), 'SIGNING_FAILED');
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if Privy server-side signing is configured
 */
function isPrivyConfigured() {
    return !!(PRIVY_APP_ID && PRIVY_APP_SECRET);
}
