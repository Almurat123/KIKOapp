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
exports.callRpcCustom = callRpcCustom;
var logger_js_1 = require("../../utils/logger.js");
var logRegistry_js_1 = require("../../config/logRegistry.js");
var score_js_1 = require("./score.js");
var rpcSelection_js_1 = require("./rpcSelection.js");
var rpcState_js_1 = require("./rpcState.js");
function filterEndpointsByMethod(endpoints, method) {
    var matches = endpoints.filter(function (endpoint) { var _a, _b; return (_b = (_a = endpoint.capabilities) === null || _a === void 0 ? void 0 : _a.methods) === null || _b === void 0 ? void 0 : _b.includes(method); });
    return matches.length > 0 ? matches : endpoints;
}
function sortEndpointsByScore(endpoints, method, importance) {
    return (0, score_js_1.sortRpcEndpointsByScore)({
        endpoints: endpoints,
        method: method,
        importance: importance,
        now: Date.now(),
        getHealth: rpcState_js_1.getEndpointHealthView,
        getUsage: rpcState_js_1.getEndpointUsageView,
    });
}
function callRpcCustom(endpoints_1, method_1) {
    return __awaiter(this, arguments, void 0, function (endpoints, method, params, options) {
        var normalized, filtered, request, lastError, effectiveImportance, requestTimeoutMs, sortedEndpoints, _loop_1, i, state_1, failedLogKey;
        if (params === void 0) { params = []; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!endpoints || endpoints.length === 0) {
                        throw new Error('No RPC endpoints provided');
                    }
                    normalized = endpoints.map(function (ep, idx) {
                        var _a, _b, _c;
                        return ({
                            name: ep.name || "Custom-".concat(idx + 1),
                            url: ep.url,
                            priority: (_a = ep.priority) !== null && _a !== void 0 ? _a : idx + 1,
                            requiresAuth: (_b = ep.requiresAuth) !== null && _b !== void 0 ? _b : false,
                            type: (_c = ep.type) !== null && _c !== void 0 ? _c : 'premium',
                            limits: ep.limits,
                            weight: ep.weight,
                            capabilities: ep.capabilities,
                        });
                    });
                    filtered = filterEndpointsByMethod(normalized, method);
                    if (filtered.length === 0) {
                        throw new Error("No RPC endpoints support method ".concat(method));
                    }
                    request = {
                        jsonrpc: '2.0',
                        id: Date.now(),
                        method: method,
                        params: params,
                    };
                    lastError = null;
                    effectiveImportance = options.importance || 'normal';
                    requestTimeoutMs = (0, rpcSelection_js_1.resolveRpcTimeoutMs)(method, { strategy: 'fast', importance: effectiveImportance });
                    sortedEndpoints = sortEndpointsByScore(filtered, method, effectiveImportance);
                    _loop_1 = function (i) {
                        var endpoint, capacity, startTime, controller_1, timeout_1, response, data, responseTime, error_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    endpoint = sortedEndpoints[i];
                                    if (!(endpoint === null || endpoint === void 0 ? void 0 : endpoint.url))
                                        return [2 /*return*/, "continue"];
                                    if ((0, rpcState_js_1.isCircuitOpen)(endpoint.url)) {
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC circuit open, skipping endpoint', { endpoint: (0, rpcState_js_1.maskEndpoint)(endpoint.url) });
                                        return [2 /*return*/, "continue"];
                                    }
                                    capacity = (0, rpcState_js_1.checkAndReserveCapacity)(endpoint, effectiveImportance);
                                    if (!capacity.ok) {
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC capacity limited, skipping endpoint', {
                                            endpoint: (0, rpcState_js_1.maskEndpoint)(endpoint.url),
                                            reason: capacity.reason,
                                        });
                                        return [2 /*return*/, "continue"];
                                    }
                                    startTime = Date.now();
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 4, 7, 8]);
                                    (0, rpcState_js_1.recordAttempt)(endpoint.url);
                                    controller_1 = new AbortController();
                                    timeout_1 = setTimeout(function () { return controller_1.abort(); }, requestTimeoutMs);
                                    return [4 /*yield*/, fetch(endpoint.url, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Accept-Encoding': 'gzip',
                                                Connection: 'keep-alive',
                                            },
                                            body: JSON.stringify(request),
                                            signal: controller_1.signal,
                                            keepalive: true,
                                        }).finally(function () { return clearTimeout(timeout_1); })];
                                case 2:
                                    response = _b.sent();
                                    if (!response.ok) {
                                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                                    }
                                    return [4 /*yield*/, response.json()];
                                case 3:
                                    data = _b.sent();
                                    if (data.error) {
                                        throw new Error("RPC Error: ".concat(data.error.message));
                                    }
                                    if (data.result === undefined) {
                                        throw new Error('RPC returned undefined result');
                                    }
                                    responseTime = Date.now() - startTime;
                                    (0, rpcState_js_1.recordSuccess)(endpoint.url, responseTime);
                                    if (i > 0) {
                                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_SUCCESS, 'RPC failover success', {
                                            endpoint: i + 1,
                                            total: sortedEndpoints.length,
                                            responseTime: responseTime,
                                        });
                                    }
                                    return [2 /*return*/, { value: data.result }];
                                case 4:
                                    error_1 = _b.sent();
                                    lastError = error_1;
                                    if ((0, rpcSelection_js_1.isNonRetryableRpcErrorMessage)((error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || '')) {
                                        throw error_1;
                                    }
                                    (0, rpcState_js_1.recordFailure)(endpoint.url);
                                    if (i < 2) {
                                        logger_js_1.logger.aggregate(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'RPC endpoint failed', {
                                            endpoint: i + 1,
                                            total: sortedEndpoints.length,
                                            error: error_1.message,
                                            duration: Date.now() - startTime,
                                        });
                                    }
                                    if (!(i < sortedEndpoints.length - 1)) return [3 /*break*/, 6];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                                case 5:
                                    _b.sent();
                                    return [2 /*return*/, "continue"];
                                case 6: return [3 /*break*/, 8];
                                case 7:
                                    (0, rpcState_js_1.recordUsageEnd)(endpoint.url);
                                    return [7 /*endfinally*/];
                                case 8: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < sortedEndpoints.length)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4:
                    failedLogKey = "custom:".concat(method);
                    if ((0, rpcState_js_1.shouldLogAllRpcFailed)(failedLogKey)) {
                        logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
                            method: method,
                            totalEndpoints: sortedEndpoints.length,
                            lastError: lastError === null || lastError === void 0 ? void 0 : lastError.message,
                        });
                    }
                    else {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'All RPC endpoints failed (suppressed)', { method: method });
                    }
                    throw new Error("All RPC endpoints failed. Last error: ".concat((lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown'));
            }
        });
    });
}
