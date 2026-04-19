"use strict";
/**
 * Unified API Service
 * Central service for all external API calls with:
 * - Automatic failover
 * - Rate limiting
 * - Circuit breaker
 * - Request caching
 * - Health monitoring
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MORALIS_CONFIG = exports.SOLSCAN_CONFIG = exports.BLOCKSCOUT_CONFIG = exports.ROUTESCAN_CONFIG = exports.ETHERSCAN_CONFIG = exports.GECKOTERMINAL_CONFIG = exports.DEXSCREENER_CONFIG = exports.getRpcEndpoints = void 0;
exports.fetchJson = fetchJson;
exports.callRpc = callRpc;
exports.callDexScreener = callDexScreener;
exports.callGeckoTerminal = callGeckoTerminal;
exports.getEndpointHealthStats = getEndpointHealthStats;
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("./logRegistry.js");
var apiEndpoints_js_1 = require("./apiEndpoints.js");
Object.defineProperty(exports, "getRpcEndpoints", { enumerable: true, get: function () { return apiEndpoints_js_1.getRpcEndpoints; } });
Object.defineProperty(exports, "DEXSCREENER_CONFIG", { enumerable: true, get: function () { return apiEndpoints_js_1.DEXSCREENER_CONFIG; } });
Object.defineProperty(exports, "GECKOTERMINAL_CONFIG", { enumerable: true, get: function () { return apiEndpoints_js_1.GECKOTERMINAL_CONFIG; } });
Object.defineProperty(exports, "ETHERSCAN_CONFIG", { enumerable: true, get: function () { return apiEndpoints_js_1.ETHERSCAN_CONFIG; } });
Object.defineProperty(exports, "ROUTESCAN_CONFIG", { enumerable: true, get: function () { return apiEndpoints_js_1.ROUTESCAN_CONFIG; } });
Object.defineProperty(exports, "BLOCKSCOUT_CONFIG", { enumerable: true, get: function () { return apiEndpoints_js_1.BLOCKSCOUT_CONFIG; } });
Object.defineProperty(exports, "SOLSCAN_CONFIG", { enumerable: true, get: function () { return apiEndpoints_js_1.SOLSCAN_CONFIG; } });
Object.defineProperty(exports, "MORALIS_CONFIG", { enumerable: true, get: function () { return apiEndpoints_js_1.MORALIS_CONFIG; } });
var UNIFIED_API_FINAL_ERROR_LOG_WINDOW_MS = Number(process.env.UNIFIED_API_FINAL_ERROR_LOG_WINDOW_MS || 180000);
var endpointHealthMap = new Map();
function getOrCreateHealth(url) {
    if (!endpointHealthMap.has(url)) {
        endpointHealthMap.set(url, {
            url: url,
            consecutiveFailures: 0,
            lastFailureTime: 0,
            circuitOpen: false,
            avgResponseTime: 0,
            successCount: 0,
            totalAttempts: 0,
        });
    }
    return endpointHealthMap.get(url);
}
function recordSuccess(url, responseTime) {
    var health = getOrCreateHealth(url);
    health.consecutiveFailures = 0;
    health.circuitOpen = false;
    health.successCount++;
    health.totalAttempts++;
    // Update rolling average
    if (health.avgResponseTime === 0) {
        health.avgResponseTime = responseTime;
    }
    else {
        health.avgResponseTime = (health.avgResponseTime * 0.8) + (responseTime * 0.2);
    }
}
function recordFailure(url) {
    var health = getOrCreateHealth(url);
    health.consecutiveFailures++;
    health.lastFailureTime = Date.now();
    health.totalAttempts++;
    // Open circuit breaker after 3 consecutive failures
    if (health.consecutiveFailures >= 3) {
        health.circuitOpen = true;
        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, 'Circuit breaker opened for endpoint', {
            url: url.substring(0, 50),
            failures: health.consecutiveFailures
        });
    }
}
function isCircuitOpen(url) {
    var health = getOrCreateHealth(url);
    // Reset circuit if enough time has passed (30 seconds)
    if (health.circuitOpen && Date.now() - health.lastFailureTime > 30000) {
        health.circuitOpen = false;
        health.consecutiveFailures = 0;
        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Circuit breaker reset for endpoint', {
            url: url.substring(0, 50)
        });
    }
    return health.circuitOpen;
}
/**
 * Generic fetch wrapper with retries, timeout, and better error handling
 * Used by zeroEx, tokenService, etc.
 */
function fetchJson(options) {
    return __awaiter(this, void 0, void 0, function () {
        var url, _a, endpointName, _b, configuredTimeout, legacyTimeout, _c, suppressError, _d, retry, fetchOptions, requestTimeout, maxRetries, lastError, _loop_1, attempt, state_1, logUrl;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    url = options.url, _a = options.endpointName, endpointName = _a === void 0 ? 'api' : _a, _b = options.requestTimeout, configuredTimeout = _b === void 0 ? 10000 : _b, legacyTimeout = options.timeout, _c = options.suppressError, suppressError = _c === void 0 ? false : _c, _d = options.retry, retry = _d === void 0 ? { retries: 0 } : _d, fetchOptions = __rest(options, ["url", "endpointName", "requestTimeout", "timeout", "suppressError", "retry"]);
                    requestTimeout = legacyTimeout !== null && legacyTimeout !== void 0 ? legacyTimeout : configuredTimeout;
                    maxRetries = retry.retries || 0;
                    lastError = null;
                    _loop_1 = function (attempt) {
                        var externalSignal, controller, abortedByExternal, onExternalAbort, timeout, response_1, errorText, text, error_1, isRateLimit, isClientError, isAbort, shouldStopOnAbort, baseDelay, factor, delay_1;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    externalSignal = fetchOptions.signal;
                                    controller = new AbortController();
                                    abortedByExternal = false;
                                    onExternalAbort = function () {
                                        abortedByExternal = true;
                                        controller.abort();
                                    };
                                    if (externalSignal) {
                                        if (externalSignal.aborted) {
                                            onExternalAbort();
                                        }
                                        else {
                                            externalSignal.addEventListener('abort', onExternalAbort, { once: true });
                                        }
                                    }
                                    timeout = setTimeout(function () { return controller.abort(); }, requestTimeout);
                                    _f.label = 1;
                                case 1:
                                    _f.trys.push([1, 6, , 8]);
                                    return [4 /*yield*/, fetch(url, __assign(__assign({}, fetchOptions), { signal: controller.signal, headers: __assign({ 'Accept': 'application/json' }, fetchOptions.headers) }))];
                                case 2:
                                    response_1 = _f.sent();
                                    clearTimeout(timeout);
                                    if (externalSignal) {
                                        externalSignal.removeEventListener('abort', onExternalAbort);
                                    }
                                    // Handle 429 Rate Limit specifically
                                    if (response_1.status === 429) {
                                        throw new Error('429 Rate Limit Exceeded');
                                    }
                                    if (!!response_1.ok) return [3 /*break*/, 4];
                                    return [4 /*yield*/, response_1.text().catch(function () { return response_1.statusText; })];
                                case 3:
                                    errorText = _f.sent();
                                    throw new Error("HTTP ".concat(response_1.status, ": ").concat(errorText));
                                case 4: return [4 /*yield*/, response_1.text()];
                                case 5:
                                    text = _f.sent();
                                    if (!text)
                                        return [2 /*return*/, { value: {} }];
                                    try {
                                        return [2 /*return*/, { value: JSON.parse(text) }];
                                    }
                                    catch (parseError) {
                                        throw new Error("Invalid JSON response: ".concat(text.substring(0, 50), "..."));
                                    }
                                    return [3 /*break*/, 8];
                                case 6:
                                    error_1 = _f.sent();
                                    clearTimeout(timeout);
                                    if (externalSignal) {
                                        externalSignal.removeEventListener('abort', onExternalAbort);
                                    }
                                    lastError = error_1;
                                    isRateLimit = error_1.message.includes('429');
                                    isClientError = error_1.message.match(/HTTP 4\d\d/) && !isRateLimit;
                                    isAbort = (error_1 === null || error_1 === void 0 ? void 0 : error_1.name) === 'AbortError' || String((error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || '').toLowerCase().includes('aborted');
                                    shouldStopOnAbort = isAbort && abortedByExternal;
                                    if (attempt >= maxRetries || (isClientError && !isRateLimit) || shouldStopOnAbort) {
                                        return [2 /*return*/, "break"];
                                    }
                                    baseDelay = retry.minTimeout || 1000;
                                    factor = retry.factor || 2;
                                    delay_1 = Math.min(retry.maxTimeout || 5000, baseDelay * Math.pow(factor, attempt));
                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "".concat(endpointName, " failed (attempt ").concat(attempt + 1, "/").concat(maxRetries + 1, "), retrying in ").concat(delay_1, "ms"), {
                                        error: error_1.message,
                                        url: url.substring(0, 60)
                                    });
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                case 7:
                                    _f.sent();
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _e.label = 1;
                case 1:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _e.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    if (state_1 === "break")
                        return [3 /*break*/, 4];
                    _e.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4:
                    // Final failure
                    if (!suppressError) {
                        logUrl = url.includes('api.coinbase.com') ? url : url.substring(0, 60);
                        logger_js_1.logger.throttledError(logRegistry_js_1.LogCode.API_FETCH_FAILED, "".concat(endpointName, " failed after ").concat(maxRetries + 1, " attempts"), {
                            error: lastError === null || lastError === void 0 ? void 0 : lastError.message,
                            url: logUrl
                        }, UNIFIED_API_FINAL_ERROR_LOG_WINDOW_MS);
                    }
                    throw lastError;
            }
        });
    });
}
/**
 * Execute RPC call with automatic failover across multiple endpoints
 */
function callRpc(chainSlug_1, method_1) {
    return __awaiter(this, arguments, void 0, function (chainSlug, method, params, primaryUrl) {
        var endpoints, request, lastError, attemptCount, _loop_2, _i, endpoints_1, endpoint, state_2;
        if (params === void 0) { params = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    endpoints = (0, apiEndpoints_js_1.getRpcEndpoints)(chainSlug, primaryUrl);
                    if (endpoints.length === 0) {
                        throw new Error("No RPC endpoints configured for chain: ".concat(chainSlug));
                    }
                    request = {
                        jsonrpc: '2.0',
                        id: Date.now(),
                        method: method,
                        params: params,
                    };
                    lastError = null;
                    attemptCount = 0;
                    _loop_2 = function (endpoint) {
                        var startTime, controller_1, timeout, response, data, responseTime, error_2, errorMsg;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    // Skip if circuit breaker is open
                                    if (isCircuitOpen(endpoint.url)) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    attemptCount++;
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 4, , 5]);
                                    startTime = Date.now();
                                    controller_1 = new AbortController();
                                    timeout = setTimeout(function () { return controller_1.abort(); }, 10000);
                                    return [4 /*yield*/, fetch(endpoint.url, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Accept-Encoding': 'gzip', // ✅ Enable gzip compression (75% speedup for large responses)
                                            },
                                            body: JSON.stringify(request),
                                            signal: controller_1.signal,
                                        })];
                                case 2:
                                    response = _b.sent();
                                    clearTimeout(timeout);
                                    if (!response.ok) {
                                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                                    }
                                    return [4 /*yield*/, response.json()];
                                case 3:
                                    data = _b.sent();
                                    if (data.error) {
                                        throw new Error("RPC Error: ".concat(data.error.message));
                                    }
                                    if (!data.result && data.result !== null && data.result !== false && data.result !== 0) {
                                        throw new Error('No result in RPC response');
                                    }
                                    responseTime = Date.now() - startTime;
                                    recordSuccess(endpoint.url, responseTime);
                                    if (attemptCount > 1) {
                                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, "[RPC] Failover success on endpoint ".concat(attemptCount, "/").concat(endpoints.length, " for ").concat(chainSlug), {
                                            endpoint: endpoint.name
                                        });
                                    }
                                    return [2 /*return*/, { value: data.result }];
                                case 4:
                                    error_2 = _b.sent();
                                    recordFailure(endpoint.url);
                                    lastError = error_2;
                                    errorMsg = error_2.message || String(error_2);
                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "[RPC] Endpoint ".concat(attemptCount, "/").concat(endpoints.length, " failed for ").concat(chainSlug, ": ").concat(errorMsg), {
                                        endpoint: endpoint.name,
                                        method: method
                                    });
                                    return [2 /*return*/, "continue"];
                                case 5: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, endpoints_1 = endpoints;
                    _a.label = 1;
                case 1:
                    if (!(_i < endpoints_1.length)) return [3 /*break*/, 4];
                    endpoint = endpoints_1[_i];
                    return [5 /*yield**/, _loop_2(endpoint)];
                case 2:
                    state_2 = _a.sent();
                    if (typeof state_2 === "object")
                        return [2 /*return*/, state_2.value];
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: 
                // All endpoints failed
                throw new Error("All RPC endpoints failed for ".concat(chainSlug, ". Last error: ").concat((lastError === null || lastError === void 0 ? void 0 : lastError.message) || lastError));
            }
        });
    });
}
// ============================================================================
// DEXSCREENER SERVICE
// ============================================================================
var dexscreenerBackoffUntil = 0;
function callDexScreener(endpoint_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, options, priority) {
        var waitTime, url, controller, timeout, response, backoffMs, error_3;
        if (options === void 0) { options = {}; }
        if (priority === void 0) { priority = 'normal'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Check rate limit backoff (high priority skips this check for Copy Trade)
                    if (priority !== 'high' && Date.now() < dexscreenerBackoffUntil) {
                        waitTime = Math.ceil((dexscreenerBackoffUntil - Date.now()) / 1000);
                        throw new Error("DexScreener rate limit active (".concat(waitTime, "s remaining)"));
                    }
                    url = "".concat(apiEndpoints_js_1.DEXSCREENER_CONFIG.baseUrl).concat(endpoint);
                    controller = new AbortController();
                    timeout = setTimeout(function () { return controller.abort(); }, apiEndpoints_js_1.DEXSCREENER_CONFIG.timeout.rest);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch(url, __assign(__assign({}, options), { signal: controller.signal, headers: __assign({ 'Content-Type': 'application/json' }, options.headers) }))];
                case 2:
                    response = _a.sent();
                    clearTimeout(timeout);
                    // Handle rate limiting
                    if (response.status === 429) {
                        backoffMs = 60000;
                        dexscreenerBackoffUntil = Date.now() + backoffMs;
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_RATE_LIMIT, 'DexScreener rate limit hit', { backoffMs: backoffMs, priority: priority });
                        throw new Error('Rate limit hit, backing off for 60s');
                    }
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.json()];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    error_3 = _a.sent();
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener API error', {
                        endpoint: endpoint,
                        error: error_3.message,
                        priority: priority
                    });
                    throw error_3;
                case 5:
                    clearTimeout(timeout);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// GECKOTERMINAL SERVICE
// ============================================================================
var geckoTerminalBackoffUntil = 0;
/**
 * Token Bucket Rate Limiter for GeckoTerminal
 * Controls request rate to stay within 30 req/min limit
 */
var GeckoTokenBucket = /** @class */ (function () {
    function GeckoTokenBucket(maxTokens, refillRatePerMinute) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRatePerMinute / 60;
        this.lastRefill = Date.now();
    }
    GeckoTokenBucket.prototype.acquire = function () {
        return __awaiter(this, void 0, void 0, function () {
            var waitTime_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.refill();
                        if (!(this.tokens < 1)) return [3 /*break*/, 2];
                        waitTime_1 = Math.ceil((1 - this.tokens) / this.refillRate * 1000);
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_RATE_LIMIT, "GeckoTerminal rate limit: waiting ".concat(waitTime_1, "ms"));
                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, waitTime_1); })];
                    case 1:
                        _a.sent();
                        this.refill();
                        _a.label = 2;
                    case 2:
                        this.tokens -= 1;
                        return [2 /*return*/];
                }
            });
        });
    };
    GeckoTokenBucket.prototype.refill = function () {
        var now = Date.now();
        var elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    };
    GeckoTokenBucket.prototype.getAvailableTokens = function () {
        this.refill();
        return Math.floor(this.tokens);
    };
    return GeckoTokenBucket;
}());
// Token bucket: 10 burst capacity, 25 req/min refill (留有余量 vs 30 req/min limit)
var geckoTerminalBucket = new GeckoTokenBucket(10, 25);
function callGeckoTerminal(endpoint_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, options, retries, priority) {
        var waitTime, url, lastError, _loop_3, attempt, state_3;
        if (options === void 0) { options = {}; }
        if (retries === void 0) { retries = apiEndpoints_js_1.GECKOTERMINAL_CONFIG.retry.maxRetries; }
        if (priority === void 0) { priority = 'normal'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Check global backoff first (high priority skips this for Copy Trade)
                    if (priority !== 'high' && Date.now() < geckoTerminalBackoffUntil) {
                        waitTime = Math.ceil((geckoTerminalBackoffUntil - Date.now()) / 1000);
                        throw new Error("GeckoTerminal backoff active (".concat(waitTime, "s remaining)"));
                    }
                    if (!(priority !== 'high')) return [3 /*break*/, 2];
                    return [4 /*yield*/, geckoTerminalBucket.acquire()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    url = "".concat(apiEndpoints_js_1.GECKOTERMINAL_CONFIG.baseUrl).concat(endpoint);
                    lastError = null;
                    _loop_3 = function (attempt) {
                        var controller_2, timeout, response, backoffMs, setGeckoBackoff, err_1, delay_2, _b, error_4, delay_3;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 10, , 12]);
                                    controller_2 = new AbortController();
                                    timeout = setTimeout(function () { return controller_2.abort(); }, apiEndpoints_js_1.GECKOTERMINAL_CONFIG.timeout.default);
                                    return [4 /*yield*/, fetch(url, __assign(__assign({}, options), { signal: controller_2.signal, headers: __assign({ 'Content-Type': 'application/json' }, options.headers) }))];
                                case 1:
                                    response = _c.sent();
                                    clearTimeout(timeout);
                                    if (!(response.status === 429)) return [3 /*break*/, 6];
                                    backoffMs = 60000;
                                    geckoTerminalBackoffUntil = Date.now() + backoffMs;
                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_RATE_LIMIT, 'GeckoTerminal 429 triggered backoff', { backoffMs: backoffMs });
                                    _c.label = 2;
                                case 2:
                                    _c.trys.push([2, 4, , 5]);
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../jobs/tokenDataJob.js'); })];
                                case 3:
                                    setGeckoBackoff = (_c.sent()).setGeckoBackoff;
                                    setGeckoBackoff(backoffMs);
                                    return [3 /*break*/, 5];
                                case 4:
                                    err_1 = _c.sent();
                                    return [3 /*break*/, 5];
                                case 5: throw new Error("Rate limit hit, backing off for ".concat(backoffMs, "ms"));
                                case 6:
                                    if (!(response.status >= 500 && attempt < retries)) return [3 /*break*/, 8];
                                    delay_2 = apiEndpoints_js_1.GECKOTERMINAL_CONFIG.retry.baseDelayMs * Math.pow(2, attempt);
                                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, "GeckoTerminal ".concat(response.status, ", retrying..."), {
                                        attempt: attempt + 1,
                                        delayMs: delay_2
                                    });
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_2); })];
                                case 7:
                                    _c.sent();
                                    return [2 /*return*/, "continue"];
                                case 8:
                                    if (!response.ok) {
                                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                                    }
                                    _b = {};
                                    return [4 /*yield*/, response.json()];
                                case 9: return [2 /*return*/, (_b.value = _c.sent(), _b)];
                                case 10:
                                    error_4 = _c.sent();
                                    lastError = error_4;
                                    // Don't retry on timeout or network errors beyond max retries
                                    if (attempt >= retries) {
                                        return [2 /*return*/, "break"];
                                    }
                                    delay_3 = apiEndpoints_js_1.GECKOTERMINAL_CONFIG.retry.baseDelayMs * Math.pow(2, attempt);
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_3); })];
                                case 11:
                                    _c.sent();
                                    return [3 /*break*/, 12];
                                case 12: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _a.label = 3;
                case 3:
                    if (!(attempt <= retries)) return [3 /*break*/, 6];
                    return [5 /*yield**/, _loop_3(attempt)];
                case 4:
                    state_3 = _a.sent();
                    if (typeof state_3 === "object")
                        return [2 /*return*/, state_3.value];
                    if (state_3 === "break")
                        return [3 /*break*/, 6];
                    _a.label = 5;
                case 5:
                    attempt++;
                    return [3 /*break*/, 3];
                case 6:
                    logger_js_1.logger.error(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'GeckoTerminal API error after retries', {
                        endpoint: endpoint,
                        error: lastError === null || lastError === void 0 ? void 0 : lastError.message
                    });
                    throw lastError;
            }
        });
    });
}
// ============================================================================
// UTILITY: GET ENDPOINT HEALTH STATS
// ============================================================================
function getEndpointHealthStats() {
    var stats = [];
    for (var _i = 0, _a = endpointHealthMap.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], url = _b[0], health = _b[1];
        var successRate = health.totalAttempts > 0
            ? (health.successCount / health.totalAttempts) * 100
            : 0;
        stats.push({
            url: url.substring(0, 60),
            name: (0, apiEndpoints_js_1.getEndpointName)(url),
            successRate: Math.round(successRate * 100) / 100,
            avgResponseTime: Math.round(health.avgResponseTime),
            circuitOpen: health.circuitOpen,
            consecutiveFailures: health.consecutiveFailures,
        });
    }
    return stats.sort(function (a, b) { return b.successRate - a.successRate; });
}
