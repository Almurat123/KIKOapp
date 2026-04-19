"use strict";
/**
 * DexScreener WebSocket Service
 *
 * Fetches real-time trending token addresses from DexScreener via WebSocket.
 * This provides more accurate trending data than the HTTP API search/boost methods.
 *
 * Supported chains: base, ethereum, bsc
 * Supported time frames: m5 (5 min), h1 (1 hour), h6 (6 hours), h24 (24 hours)
 *
 * NOTE: Uses Chrome TLS fingerprint simulation to bypass Cloudflare Bot detection.
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
exports.WS_SUPPORTED_CHAINS = void 0;
exports.fetchTrendingAddresses = fetchTrendingAddresses;
exports.fetchTrendingAddressesMultiChain = fetchTrendingAddressesMultiChain;
exports.isWSSupportedChain = isWSSupportedChain;
var ws_1 = require("ws");
var https = require("https");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
/**
 * Chrome 122 TLS Cipher Suites (JA3 fingerprint simulation)
 * These are ordered to match Chrome's TLS handshake signature.
 * Reference: https://engineering.salesforce.com/tls-fingerprinting-with-ja3-and-ja3s-247362855967
 */
var CHROME_CIPHERS = [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-RSA-AES256-SHA',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
    'AES128-SHA',
    'AES256-SHA',
].join(':');
/**
 * Create HTTPS Agent with Chrome-like TLS fingerprint
 */
function createChromeAgent() {
    return new https.Agent({
        // TLS 1.2 and 1.3 (Chrome default)
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        // Chrome cipher order
        ciphers: CHROME_CIPHERS,
        // Chrome elliptic curves order
        ecdhCurve: 'X25519:P-256:P-384',
        // Enable session tickets (Chrome behavior)
        sessionTimeout: 300,
        // Keep connections alive
        keepAlive: true,
        keepAliveMsecs: 10000,
    });
}
var cfSession = null;
var CF_SESSION_TTL = 10 * 60 * 1000; // 10 minutes (Cloudflare cookies last ~15 min)
/**
 * Get or refresh Cloudflare session via FlareSolverr
 *
 * FlareSolverr runs a headless browser to solve Cloudflare challenges
 * and returns the session cookies needed for subsequent requests.
 *
 * @returns CloudflareSession or null if unavailable
 */
function getCloudflareSession() {
    return __awaiter(this, void 0, void 0, function () {
        var flareSolverrUrl, response, data, cookies, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    flareSolverrUrl = process.env.FLARESOLVERR_URL;
                    if (!flareSolverrUrl) {
                        return [2 /*return*/, null];
                    }
                    // Return cached session if still valid
                    if (cfSession && Date.now() < cfSession.expiresAt) {
                        return [2 /*return*/, cfSession];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'FlareSolverr: Requesting new Cloudflare session...');
                    return [4 /*yield*/, fetch(flareSolverrUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                cmd: 'request.get',
                                url: 'https://dexscreener.com/',
                                maxTimeout: 60000,
                            }),
                            signal: AbortSignal.timeout(65000),
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'FlareSolverr: HTTP error', { status: response.status });
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    if (data.status !== 'ok' || !data.solution) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'FlareSolverr: Challenge failed', { status: data.status });
                        return [2 /*return*/, null];
                    }
                    cookies = data.solution.cookies
                        .map(function (c) { return "".concat(c.name, "=").concat(c.value); })
                        .join('; ');
                    cfSession = {
                        cookies: cookies,
                        userAgent: data.solution.userAgent,
                        expiresAt: Date.now() + CF_SESSION_TTL,
                    };
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'FlareSolverr: Session obtained', {
                        cookieCount: data.solution.cookies.length,
                        userAgent: cfSession.userAgent.substring(0, 50) + '...'
                    });
                    return [2 /*return*/, cfSession];
                case 4:
                    error_1 = _a.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'FlareSolverr: Request failed', { error: error_1.message });
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ============== FREE ROTATING PROXY POOL ==============
/**
 * Free proxy sources (no registration required)
 */
var FREE_PROXY_SOURCES = [
    // ProxyScrape - SOCKS5 proxies, updated frequently
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=5000&country=all&ssl=all&anonymity=all',
    // ProxyScrape - SOCKS4 proxies (fallback)
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=5000&country=all&ssl=all&anonymity=all',
];
// Proxy pool cache
var proxyPool = [];
var lastProxyFetch = 0;
var currentProxyIndex = 0;
var PROXY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
/**
 * Fetch fresh proxies from free sources
 */
function fetchFreeProxies() {
    return __awaiter(this, void 0, void 0, function () {
        var proxies, _i, FREE_PROXY_SOURCES_1, sourceUrl, response, text, lines, _a, lines_1, line, trimmed, protocol, error_2, i, j;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    proxies = [];
                    _i = 0, FREE_PROXY_SOURCES_1 = FREE_PROXY_SOURCES;
                    _c.label = 1;
                case 1:
                    if (!(_i < FREE_PROXY_SOURCES_1.length)) return [3 /*break*/, 7];
                    sourceUrl = FREE_PROXY_SOURCES_1[_i];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, fetch(sourceUrl, {
                            signal: AbortSignal.timeout(10000)
                        })];
                case 3:
                    response = _c.sent();
                    if (!response.ok)
                        return [3 /*break*/, 6];
                    return [4 /*yield*/, response.text()];
                case 4:
                    text = _c.sent();
                    lines = text.split('\n').filter(function (line) { return line.trim(); });
                    for (_a = 0, lines_1 = lines; _a < lines_1.length; _a++) {
                        line = lines_1[_a];
                        trimmed = line.trim();
                        // Format: IP:PORT
                        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(trimmed)) {
                            protocol = sourceUrl.includes('socks5') ? 'socks5' : 'socks4';
                            proxies.push("".concat(protocol, "://").concat(trimmed));
                        }
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _c.sent();
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7:
                    // Shuffle to randomize
                    for (i = proxies.length - 1; i > 0; i--) {
                        j = Math.floor(Math.random() * (i + 1));
                        _b = [proxies[j], proxies[i]], proxies[i] = _b[0], proxies[j] = _b[1];
                    }
                    return [2 /*return*/, proxies];
            }
        });
    });
}
/**
 * Get a proxy from the rotating pool
 * Returns null if pool is empty or disabled
 */
function getRotatingProxy() {
    return __awaiter(this, void 0, void 0, function () {
        var staticProxy, now, proxy;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Check if free proxy pool is disabled
                    if (process.env.DISABLE_FREE_PROXY_POOL === 'true') {
                        return [2 /*return*/, null];
                    }
                    staticProxy = process.env.DEXSCREENER_PROXY ||
                        process.env.HTTPS_PROXY ||
                        process.env.HTTP_PROXY;
                    if (staticProxy) {
                        return [2 /*return*/, staticProxy];
                    }
                    now = Date.now();
                    if (!(proxyPool.length === 0 || now - lastProxyFetch > PROXY_CACHE_TTL)) return [3 /*break*/, 2];
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'Refreshing free proxy pool...');
                    return [4 /*yield*/, fetchFreeProxies()];
                case 1:
                    proxyPool = _a.sent();
                    lastProxyFetch = now;
                    currentProxyIndex = 0;
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'Free proxy pool refreshed', { count: proxyPool.length });
                    if (proxyPool.length === 0) {
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, 'No free proxies available');
                        return [2 /*return*/, null];
                    }
                    _a.label = 2;
                case 2:
                    proxy = proxyPool[currentProxyIndex];
                    currentProxyIndex = (currentProxyIndex + 1) % proxyPool.length;
                    return [2 /*return*/, proxy];
            }
        });
    });
}
/**
 * Mark a proxy as bad (remove from pool)
 */
function markProxyBad(proxyUrl) {
    var index = proxyPool.indexOf(proxyUrl);
    if (index > -1) {
        proxyPool.splice(index, 1);
        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'Removed bad proxy from pool', { remaining: proxyPool.length });
    }
}
/**
 * Create proxy agent for WebSocket connection
 * Supports HTTP/HTTPS and SOCKS5 proxies
 */
function createProxyAgent(proxyUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var SocksProxyAgent, HttpsProxyAgent, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    if (!proxyUrl.startsWith('socks')) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('socks-proxy-agent'); })];
                case 1:
                    SocksProxyAgent = (_a.sent()).SocksProxyAgent;
                    // SocksProxyAgent doesn't support TLS options directly, but it handles TLS internally
                    return [2 /*return*/, new SocksProxyAgent(proxyUrl)];
                case 2: return [4 /*yield*/, Promise.resolve().then(function () { return require('https-proxy-agent'); })];
                case 3:
                    HttpsProxyAgent = (_a.sent()).HttpsProxyAgent;
                    return [2 /*return*/, new HttpsProxyAgent(proxyUrl)];
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_ERROR, 'Failed to create proxy agent', { error: error_3.message });
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// DexScreener WebSocket base URL
var WS_BASE_URL = 'wss://io.dexscreener.com/dex/screener/v5/pairs';
// Supported chains for WebSocket trending
exports.WS_SUPPORTED_CHAINS = ['base', 'solana', 'ethereum', 'bsc'];
// Chain ID mapping for WebSocket filter
var CHAIN_ID_MAP = {
    'base': 'base',
    'solana': 'solana',
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'bsc': 'bsc',
};
/**
 * Fetch trending token addresses from DexScreener WebSocket
 *
 * Strategy:
 * 1. First attempt: Direct connection with Chrome TLS fingerprint
 * 2. Fallback: If proxy is configured and direct fails, retry via proxy
 *
 * @param options - WebSocket options (chain, timeFrame, rankBy)
 * @returns Promise<string[]> - Array of token addresses (lowercase)
 */
function fetchTrendingAddresses(options) {
    return __awaiter(this, void 0, void 0, function () {
        var chain, _a, timeFrame, _b, rankBy, _c, timeout, normalizedChain, url, directResult, cfSession, cfResult, MAX_PROXY_RETRIES, i, proxyUrl, proxyAgent, proxyResult;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    chain = options.chain, _a = options.timeFrame, timeFrame = _a === void 0 ? 'm5' : _a, _b = options.rankBy, rankBy = _b === void 0 ? 'trendingScoreM5' : _b, _c = options.timeout, timeout = _c === void 0 ? 10000 : _c;
                    normalizedChain = CHAIN_ID_MAP[chain.toLowerCase()] || chain.toLowerCase();
                    // Check if chain is supported
                    if (!exports.WS_SUPPORTED_CHAINS.includes(normalizedChain)) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Chain not supported', { chain: chain, normalizedChain: normalizedChain });
                        return [2 /*return*/, []];
                    }
                    url = "".concat(WS_BASE_URL, "/").concat(timeFrame, "/1?rankBy[key]=").concat(rankBy, "&rankBy[order]=desc&filters[chainIds][0]=").concat(normalizedChain);
                    // Attempt 1: Direct connection with Chrome TLS fingerprint
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Trying direct connection', { chain: normalizedChain });
                    return [4 /*yield*/, attemptWSConnection(url, normalizedChain, timeout, createChromeAgent())];
                case 1:
                    directResult = _d.sent();
                    if (directResult.length > 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Direct connection succeeded', { count: directResult.length });
                        return [2 /*return*/, directResult];
                    }
                    return [4 /*yield*/, getCloudflareSession()];
                case 2:
                    cfSession = _d.sent();
                    if (!cfSession) return [3 /*break*/, 4];
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Trying with FlareSolverr cookies', { chain: normalizedChain });
                    return [4 /*yield*/, attemptWSConnectionWithCookies(url, normalizedChain, timeout, cfSession)];
                case 3:
                    cfResult = _d.sent();
                    if (cfResult.length > 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: FlareSolverr connection succeeded', { count: cfResult.length });
                        return [2 /*return*/, cfResult];
                    }
                    _d.label = 4;
                case 4:
                    MAX_PROXY_RETRIES = 3;
                    i = 0;
                    _d.label = 5;
                case 5:
                    if (!(i < MAX_PROXY_RETRIES)) return [3 /*break*/, 10];
                    return [4 /*yield*/, getRotatingProxy()];
                case 6:
                    proxyUrl = _d.sent();
                    if (!proxyUrl) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: No proxy available, skipping proxy retry');
                        return [3 /*break*/, 10];
                    }
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, "DexScreener WS: Trying proxy ".concat(i + 1, "/").concat(MAX_PROXY_RETRIES), { chain: normalizedChain });
                    return [4 /*yield*/, createProxyAgent(proxyUrl)];
                case 7:
                    proxyAgent = _d.sent();
                    if (!proxyAgent) return [3 /*break*/, 9];
                    return [4 /*yield*/, attemptWSConnection(url, normalizedChain, Math.min(timeout, 8000), proxyAgent)];
                case 8:
                    proxyResult = _d.sent();
                    if (proxyResult.length > 0) {
                        logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Proxy connection succeeded', { count: proxyResult.length, proxyIndex: i + 1 });
                        return [2 /*return*/, proxyResult];
                    }
                    // Mark this proxy as bad
                    markProxyBad(proxyUrl);
                    _d.label = 9;
                case 9:
                    i++;
                    return [3 /*break*/, 5];
                case 10:
                    // All attempts failed
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener WS: All connection attempts failed', { chain: normalizedChain });
                    return [2 /*return*/, []];
            }
        });
    });
}
/**
 * Attempt WebSocket connection with FlareSolverr cookies
 * Uses the cf_clearance cookie to bypass Cloudflare
 */
function attemptWSConnectionWithCookies(url, normalizedChain, timeout, session) {
    return new Promise(function (resolve) {
        var startTime = Date.now();
        var resolved = false;
        var agent = createChromeAgent();
        var ws = new ws_1.default(url, {
            agent: agent,
            headers: {
                'Host': 'io.dexscreener.com',
                'Origin': 'https://dexscreener.com',
                'Referer': 'https://dexscreener.com/',
                'User-Agent': session.userAgent, // Use FlareSolverr's user-agent
                'Cookie': session.cookies, // Include cf_clearance cookie
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                'Sec-WebSocket-Version': '13',
            },
        });
        var timeoutId = setTimeout(function () {
            if (!resolved) {
                resolved = true;
                logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener WS: FlareSolverr timeout', { chain: normalizedChain });
                ws.close();
                resolve([]);
            }
        }, timeout);
        ws.on('open', function () {
            logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: FlareSolverr connected', { chain: normalizedChain });
        });
        ws.on('message', function (data) {
            if (resolved)
                return;
            try {
                var text = data.toString('utf8');
                if (text.length > 1000) {
                    var ethAddresses = text.match(/0x[0-9a-fA-F]{40}/g) || [];
                    var solAddresses = [];
                    if (normalizedChain === 'solana') {
                        var solMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
                        for (var _i = 0, solMatches_1 = solMatches; _i < solMatches_1.length; _i++) {
                            var match = solMatches_1[_i];
                            if (match.length >= 32 && match.length <= 44) {
                                var repeatedCharRatio = (match.match(/(.)\1{2,}/g) || []).length / match.length;
                                if (repeatedCharRatio < 0.1) {
                                    solAddresses.push(match);
                                }
                            }
                        }
                    }
                    var allAddresses = __spreadArray(__spreadArray([], ethAddresses.map(function (a) { return a.toLowerCase(); }), true), solAddresses, true);
                    var uniqueAddresses = __spreadArray([], new Set(allAddresses), true);
                    var duration = Date.now() - startTime;
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: FlareSolverr received addresses', {
                        chain: normalizedChain,
                        count: uniqueAddresses.length,
                        durationMs: duration
                    });
                    resolved = true;
                    clearTimeout(timeoutId);
                    ws.close();
                    resolve(uniqueAddresses);
                }
            }
            catch (error) {
                logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'DexScreener WS: FlareSolverr parse error', { error: error.message });
            }
        });
        ws.on('error', function (error) {
            if (!resolved) {
                logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'DexScreener WS: FlareSolverr connection error', { error: error.message, chain: normalizedChain });
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]);
            }
        });
        ws.on('close', function () {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]);
            }
        });
    });
}
/**
 * Internal: Attempt a single WebSocket connection
 */
function attemptWSConnection(url, normalizedChain, timeout, agent) {
    return new Promise(function (resolve) {
        var startTime = Date.now();
        var resolved = false;
        var ws = new ws_1.default(url, {
            agent: agent,
            headers: {
                // Full browser-like headers to bypass Cloudflare Bot detection
                'Host': 'io.dexscreener.com',
                'Origin': 'https://dexscreener.com',
                'Referer': 'https://dexscreener.com/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                'Sec-WebSocket-Version': '13',
            },
        });
        // Timeout handler
        var timeoutId = setTimeout(function () {
            if (!resolved) {
                resolved = true;
                logger_js_1.logger.debug(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'DexScreener WS: Timeout', { chain: normalizedChain, timeout: timeout });
                ws.close();
                resolve([]);
            }
        }, timeout);
        ws.on('open', function () {
            logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Connected', { chain: normalizedChain });
        });
        ws.on('message', function (data) {
            if (resolved)
                return;
            try {
                var text = data.toString('utf8');
                // Check if we received pair data
                if (text.length > 1000) {
                    // Extract Ethereum-style addresses (0x...)
                    var ethAddresses = text.match(/0x[0-9a-fA-F]{40}/g) || [];
                    // Extract Solana-style addresses (base58, 32-44 chars, no 0x)
                    // Solana addresses are alphanumeric, typically 43-44 chars
                    var solAddresses = [];
                    if (normalizedChain === 'solana') {
                        // Match potential Solana addresses (base58 encoded)
                        // Many pump.fun tokens end with 'pump' - DO include these
                        var solMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
                        // Known addresses to skip (wrappers, native tokens)
                        var SKIP_ADDRESSES = new Set([
                            'So11111111111111111111111111111111111111111', // Native SOL
                            'So11111111111111111111111111111111111111112', // wsol variant
                            'VSo11111111111111111111111111111111111111112', // Display variant
                        ]);
                        for (var _i = 0, solMatches_2 = solMatches; _i < solMatches_2.length; _i++) {
                            var match = solMatches_2[_i];
                            // Validate length (Solana addresses are exactly 32-44 chars)
                            if (match.length < 32 || match.length > 44)
                                continue;
                            // Skip known wrapper/native tokens
                            if (SKIP_ADDRESSES.has(match))
                                continue;
                            // Skip if contains http (part of URL)
                            if (match.includes('http'))
                                continue;
                            // Filter out common false positives
                            // Valid Solana addresses typically don't have repeated patterns
                            if (match.length >= 32 && match.length <= 44) {
                                // Skip if it looks like a hash or has too many repeated chars
                                var repeatedCharRatio = (match.match(/(.)\1{2,}/g) || []).length / match.length;
                                if (repeatedCharRatio < 0.1) {
                                    solAddresses.push(match);
                                }
                            }
                        }
                    }
                    // Deduplicate and normalize
                    var allAddresses = __spreadArray(__spreadArray([], ethAddresses.map(function (a) { return a.toLowerCase(); }), true), solAddresses, true);
                    var uniqueAddresses = __spreadArray([], new Set(allAddresses), true);
                    var duration = Date.now() - startTime;
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Received trending addresses', { chain: normalizedChain, count: uniqueAddresses.length, durationMs: duration });
                    resolved = true;
                    clearTimeout(timeoutId);
                    ws.close();
                    resolve(uniqueAddresses);
                }
            }
            catch (error) {
                logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'DexScreener WS: Error parsing message', { error: error.message });
            }
        });
        ws.on('error', function (error) {
            if (!resolved) {
                logger_js_1.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, 'DexScreener WS: Connection error', { error: error.message, chain: normalizedChain });
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]); // Return empty on error, don't reject
            }
        });
        ws.on('close', function () {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]);
            }
        });
    });
}
/**
 * Fetch trending addresses for multiple chains in parallel
 *
 * @param chains - Array of chain IDs
 * @param timeFrame - Time frame (default: m5)
 * @param rankBy - Ranking method (default: trendingScoreM5)
 * @returns Map of chain -> addresses
 */
function fetchTrendingAddressesMultiChain(chains_1) {
    return __awaiter(this, arguments, void 0, function (chains, timeFrame, rankBy) {
        var results, wsChains, promises, chainResults, _i, chainResults_1, _a, chain, addresses;
        var _this = this;
        if (timeFrame === void 0) { timeFrame = 'm5'; }
        if (rankBy === void 0) { rankBy = 'trendingScoreM5'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    results = new Map();
                    wsChains = chains.filter(function (chain) {
                        var normalized = CHAIN_ID_MAP[chain.toLowerCase()] || chain.toLowerCase();
                        return exports.WS_SUPPORTED_CHAINS.includes(normalized);
                    });
                    logger_js_1.logger.debug(logRegistry_js_1.LogCode.SYS_INFO, 'DexScreener WS: Fetching multi-chain trending', { chains: wsChains });
                    promises = wsChains.map(function (chain) { return __awaiter(_this, void 0, void 0, function () {
                        var addresses;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fetchTrendingAddresses({ chain: chain, timeFrame: timeFrame, rankBy: rankBy })];
                                case 1:
                                    addresses = _a.sent();
                                    return [2 /*return*/, { chain: chain, addresses: addresses }];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    chainResults = _b.sent();
                    for (_i = 0, chainResults_1 = chainResults; _i < chainResults_1.length; _i++) {
                        _a = chainResults_1[_i], chain = _a.chain, addresses = _a.addresses;
                        results.set(chain, addresses);
                    }
                    return [2 /*return*/, results];
            }
        });
    });
}
/**
 * Check if a chain is supported for WebSocket trending
 */
function isWSSupportedChain(chain) {
    var normalized = CHAIN_ID_MAP[chain.toLowerCase()] || chain.toLowerCase();
    return exports.WS_SUPPORTED_CHAINS.includes(normalized);
}
