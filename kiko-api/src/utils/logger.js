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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = exports.logStorage = void 0;
exports.installConsoleInterception = installConsoleInterception;
// CONTEXT MEMORY
// Updated: 2026-04-09
// Author: Almurat
// Reason: config-layer red teaming showed that structured logs could become a
//         secret exfiltration path if any caller accidentally logged headers,
//         tokens, cookies, or auth payloads.
// Goal: keep the default logger fail-safe by redacting sensitive strings and
//       metadata before anything reaches console or log files.
// Owns: structured log payload building, console interception, and default
//       metadata sanitization for logger-based output.
// Does Not Own: business-specific decisions about what should be logged.
// Design Language:
// - Redact before formatting, not after emission.
// - Treat metadata as untrusted input that may contain secrets.
// - Console interception must inherit the same redaction guarantees.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/conflicts.md
var logRegistry_js_1 = require("../config/logRegistry.js");
var env_js_1 = require("../config/env.js");
var node_async_hooks_1 = require("node:async_hooks");
var fs = require("fs");
var path = require("path");
var sanitizer_js_1 = require("./sanitizer.js");
exports.logStorage = new node_async_hooks_1.AsyncLocalStorage();
var LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}
var APP_LOG_PATH = path.join(LOG_DIR, 'app.log');
var ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');
var AUDIT_LOG_PATH = path.join(LOG_DIR, 'audit.log');
var appLogStream = fs.createWriteStream(APP_LOG_PATH, { flags: 'a' });
var errorLogStream = fs.createWriteStream(ERROR_LOG_PATH, { flags: 'a' });
var auditLogStream = fs.createWriteStream(AUDIT_LOG_PATH, { flags: 'a' });
var rawConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var LEVEL_SHORTHAND = (_a = {},
    _a[LogLevel.DEBUG] = 'dbg',
    _a[LogLevel.INFO] = 'inf',
    _a[LogLevel.WARN] = 'wrn',
    _a[LogLevel.ERROR] = 'err',
    _a);
var ConsoleRateLimiter = /** @class */ (function () {
    function ConsoleRateLimiter(maxPerSecond, dropSummaryIntervalMs) {
        this.lastRefillAt = Date.now();
        this.dropped = 0;
        this.lastSummaryAt = Date.now();
        var safeRate = Math.max(1, maxPerSecond);
        this.maxTokens = safeRate;
        this.refillPerSec = safeRate;
        this.tokens = safeRate;
        this.dropSummaryIntervalMs = Math.max(1000, dropSummaryIntervalMs);
    }
    ConsoleRateLimiter.prototype.allow = function () {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        this.dropped += 1;
        return false;
    };
    ConsoleRateLimiter.prototype.maybeEmitDropSummary = function (emit) {
        if (this.dropped === 0)
            return;
        var now = Date.now();
        if (now - this.lastSummaryAt < this.dropSummaryIntervalMs)
            return;
        emit(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            role: logRegistry_js_1.LogRole.EVENT,
            code: 'SYS-LOG-DROP',
            message: 'Console logs dropped by rate limiter',
            metadata: { dropped: this.dropped, intervalMs: now - this.lastSummaryAt },
            service: 'kiko-api',
            env: process.env.NODE_ENV,
        }));
        this.dropped = 0;
        this.lastSummaryAt = now;
    };
    ConsoleRateLimiter.prototype.refill = function () {
        var now = Date.now();
        var elapsedMs = now - this.lastRefillAt;
        if (elapsedMs <= 0)
            return;
        this.lastRefillAt = now;
        var refill = (elapsedMs / 1000) * this.refillPerSec;
        this.tokens = Math.min(this.maxTokens, this.tokens + refill);
    };
    return ConsoleRateLimiter;
}());
var Logger = /** @class */ (function () {
    function Logger() {
        this.throttleMap = new Map();
        this.timers = new Map();
        this.logLevel = this.parseLogLevel(env_js_1.env.logLevel || 'info');
        this.throttleWindowMs = this.parsePositiveInt(process.env.LOG_THROTTLE_WINDOW_MS, 5000);
        var defaultConsoleRps = process.env.NODE_ENV === 'production' ? 60 : 5000;
        this.maxConsolePerSecond = this.parsePositiveInt(process.env.LOG_MAX_PER_SECOND, defaultConsoleRps);
        var dropSummaryIntervalMs = this.parsePositiveInt(process.env.LOG_DROP_SUMMARY_INTERVAL_MS, 10000);
        this.consoleLimiter = new ConsoleRateLimiter(this.maxConsolePerSecond, dropSummaryIntervalMs);
        this.aggregator = new LogAggregator(this, this.parsePositiveInt(process.env.LOG_AGGREGATE_INTERVAL_MS, 15 * 60 * 1000));
    }
    Object.defineProperty(Logger.prototype, "isProduction", {
        get: function () {
            return process.env.NODE_ENV === 'production';
        },
        enumerable: false,
        configurable: true
    });
    Logger.prototype.parsePositiveInt = function (input, fallback) {
        var parsed = Number(input);
        if (!Number.isFinite(parsed) || parsed <= 0)
            return fallback;
        return Math.floor(parsed);
    };
    Logger.prototype.parseLogLevel = function (level) {
        switch (level.toLowerCase()) {
            case 'debug': return LogLevel.DEBUG;
            case 'info': return LogLevel.INFO;
            case 'warn': return LogLevel.WARN;
            case 'error': return LogLevel.ERROR;
            default: return LogLevel.INFO;
        }
    };
    Logger.prototype.writeStream = function (stream, line) {
        stream.write("".concat(line, "\n"));
    };
    Logger.prototype.formatConsoleLine = function (level, payload) {
        var _a;
        if (this.isProduction) {
            return JSON.stringify(payload);
        }
        var levelShort = LEVEL_SHORTHAND[level];
        var timeShort = ((_a = payload.timestamp.split('T')[1]) === null || _a === void 0 ? void 0 : _a.split('.')[0]) || payload.timestamp;
        var header = "[".concat(timeShort, "] [").concat(levelShort, "] [").concat(payload.role, "] [").concat(payload.code, "]");
        var context = this.formatContextToKV(payload.metadata);
        return context.length > 0
            ? "".concat(header, " ").concat(payload.message, " | ").concat(context.join(' '))
            : "".concat(header, " ").concat(payload.message);
    };
    Logger.prototype.formatContextToKV = function (meta) {
        var values = [];
        for (var _i = 0, _a = Object.entries(meta); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value === null || value === undefined)
                continue;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                values.push("".concat(key, "=").concat(String(value)));
                continue;
            }
            if (value instanceof Date) {
                values.push("".concat(key, "=").concat(value.toISOString()));
                continue;
            }
            if (Array.isArray(value)) {
                values.push("".concat(key, "=[").concat(value.length, "]"));
                continue;
            }
            try {
                var str = JSON.stringify(value);
                values.push("".concat(key, "=").concat(str.length > 80 ? '{Obj}' : str));
            }
            catch (_c) {
                values.push("".concat(key, "={Obj}"));
            }
        }
        return values;
    };
    Logger.prototype.processMetadata = function (meta) {
        var processed = {};
        for (var _i = 0, _a = Object.entries(meta); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value instanceof Error) {
                processed[key] = this.simplifyError(value);
                continue;
            }
            processed[key] = (0, sanitizer_js_1.redact)(value);
        }
        return processed;
    };
    Logger.prototype.simplifyError = function (err) {
        var stack = err.stack || '';
        var businessFrame = stack.split('\n').find(function (line) { return line.includes('/src/') && !line.includes('node_modules'); }) || stack.split('\n')[1] || '';
        return {
            name: err.name,
            message: String((0, sanitizer_js_1.redact)(err.message)),
            at: String((0, sanitizer_js_1.redact)(businessFrame.trim())),
        };
    };
    Logger.prototype.getDefaultRole = function (code) {
        if (code.startsWith('EXE-') || code === logRegistry_js_1.LogCode.WTC_SWAP_DETECTED)
            return logRegistry_js_1.LogRole.AUDIT;
        if (code.startsWith('API-') || code.startsWith('PRF-') || code.startsWith('CH-'))
            return logRegistry_js_1.LogRole.METRIC;
        if (code.startsWith('SYS-'))
            return logRegistry_js_1.LogRole.EVENT;
        return logRegistry_js_1.LogRole.TRACE;
    };
    Logger.prototype.buildPayload = function (level, code, message, metadata) {
        var timestamp = new Date().toISOString();
        var storageMeta = exports.logStorage.getStore() || {};
        var combinedMeta = this.processMetadata(__assign(__assign({}, storageMeta), (metadata || {})));
        var role = combinedMeta.role || this.getDefaultRole(code);
        combinedMeta.role = role;
        var safeMessage = String((0, sanitizer_js_1.redact)(message));
        return {
            timestamp: timestamp,
            level: LogLevel[level],
            role: role,
            code: code,
            message: safeMessage,
            metadata: combinedMeta,
            service: 'kiko-api',
            env: process.env.NODE_ENV,
        };
    };
    Logger.prototype.emit = function (level, code, message, metadata) {
        var payload = this.buildPayload(level, code, message, metadata);
        var line = JSON.stringify(payload);
        this.writeStream(appLogStream, line);
        if (level >= LogLevel.WARN)
            this.writeStream(errorLogStream, line);
        if (payload.role === logRegistry_js_1.LogRole.AUDIT)
            this.writeStream(auditLogStream, line);
        this.consoleLimiter.maybeEmitDropSummary(function (summary) { return rawConsole.warn(summary); });
        if (!this.consoleLimiter.allow())
            return;
        var consoleLine = this.formatConsoleLine(level, payload);
        switch (level) {
            case LogLevel.ERROR:
                rawConsole.error(consoleLine);
                break;
            case LogLevel.WARN:
                rawConsole.warn(consoleLine);
                break;
            case LogLevel.INFO:
                rawConsole.info(consoleLine);
                break;
            default:
                rawConsole.log(consoleLine);
                break;
        }
    };
    Logger.prototype.startTimer = function (label) {
        this.timers.set(label, Date.now());
    };
    Logger.prototype.endTimer = function (label, code, metadata, level) {
        if (code === void 0) { code = logRegistry_js_1.LogCode.PERF_METRIC; }
        if (metadata === void 0) { metadata = {}; }
        if (level === void 0) { level = 'debug'; }
        var startTime = this.timers.get(label);
        if (!startTime)
            return;
        var durationMs = Date.now() - startTime;
        this.timers.delete(label);
        var payload = __assign(__assign({}, metadata), { durationMs: durationMs, timerLabel: label });
        if (level === 'debug') {
            this.debug(code, "Timer finished: ".concat(label), payload);
        }
        else {
            this.info(code, "Timer finished: ".concat(label), payload);
        }
    };
    Logger.prototype.shouldThrottle = function (code, message, windowMs) {
        var key = "".concat(code, ":").concat(message);
        var now = Date.now();
        var entry = this.throttleMap.get(key);
        var effectiveWindowMs = windowMs && windowMs > 0 ? windowMs : this.throttleWindowMs;
        if (!entry) {
            this.throttleMap.set(key, { count: 1, lastTime: now });
            return false;
        }
        if (now - entry.lastTime < effectiveWindowMs) {
            entry.count++;
            return true;
        }
        if (entry.count > 1) {
            this.emit(LogLevel.INFO, logRegistry_js_1.LogCode.SYS_INFO, 'Suppressed repeated logs', {
                repeated: entry.count,
                original: key,
                windowMs: effectiveWindowMs,
            });
        }
        this.throttleMap.set(key, { count: 1, lastTime: now });
        return false;
    };
    Logger.prototype.debug = function (code, message, metadata) {
        if (this.logLevel > LogLevel.DEBUG)
            return;
        this.emit(LogLevel.DEBUG, code, message, metadata);
    };
    Logger.prototype.info = function (code, message, metadata) {
        if (this.logLevel > LogLevel.INFO)
            return;
        this.emit(LogLevel.INFO, code, message, metadata);
    };
    Logger.prototype.warn = function (code, message, metadata) {
        if (this.logLevel > LogLevel.WARN)
            return;
        this.emit(LogLevel.WARN, code, message, metadata);
    };
    Logger.prototype.error = function (code, message, metadata) {
        if (this.logLevel > LogLevel.ERROR)
            return;
        var storageMeta = exports.logStorage.getStore() || {};
        var combinedMeta = __assign(__assign({}, storageMeta), metadata);
        if (combinedMeta.action) {
            message = "".concat(message, " | ACTION REQUIRED: ").concat(combinedMeta.action);
        }
        this.emit(LogLevel.ERROR, code, message, metadata);
    };
    Logger.prototype.throttled = function (code, message, metadata, windowMs) {
        if (this.logLevel > LogLevel.INFO)
            return;
        if (this.shouldThrottle(code, message, windowMs))
            return;
        this.emit(LogLevel.INFO, code, message, metadata);
    };
    Logger.prototype.throttledError = function (code, message, metadata, windowMs) {
        if (this.logLevel > LogLevel.ERROR)
            return;
        if (this.shouldThrottle(code, message, windowMs))
            return;
        this.emit(LogLevel.ERROR, code, message, metadata);
    };
    Logger.prototype.aggregate = function (code, message, metadata) {
        if (this.logLevel > LogLevel.INFO)
            return;
        this.aggregator.add(code, message, metadata);
    };
    return Logger;
}());
var LogAggregator = /** @class */ (function () {
    function LogAggregator(logger, intervalMs) {
        var _this = this;
        this.logs = new Map();
        this.logger = logger;
        this.timer = setInterval(function () { return _this.flush(); }, intervalMs);
        this.timer.unref();
    }
    LogAggregator.prototype.add = function (code, message, metadata) {
        var key = "".concat(code, "|").concat(message);
        var now = Date.now();
        var entry = this.logs.get(key);
        if (!entry) {
            this.logs.set(key, {
                count: 1,
                firstTime: now,
                lastTime: now,
                metadata: metadata,
            });
            return;
        }
        entry.count += 1;
        entry.lastTime = now;
    };
    LogAggregator.prototype.flush = function () {
        var _this = this;
        if (this.logs.size === 0)
            return;
        this.logs.forEach(function (stats, key) {
            var _a = key.split('|'), code = _a[0], rest = _a.slice(1);
            var message = rest.join('|');
            var spanMs = Math.max(1, stats.lastTime - stats.firstTime);
            var ratePerMin = Number((stats.count / (spanMs / 60000)).toFixed(2));
            _this.logger.info(logRegistry_js_1.LogCode.SYS_AGG_REPORT, 'Aggregated repetitive logs', {
                code: code,
                message: message,
                count: stats.count,
                spanMs: spanMs,
                ratePerMin: ratePerMin,
                sample: stats.metadata,
            });
        });
        this.logs.clear();
    };
    return LogAggregator;
}());
exports.logger = new Logger();
exports.default = exports.logger;
var consoleInterceptInstalled = false;
function stringifyConsoleArgs(args) {
    return args.map(function (arg) {
        if (typeof arg === 'string')
            return arg;
        if (arg instanceof Error)
            return "".concat(arg.name, ": ").concat(arg.message);
        try {
            return JSON.stringify(arg);
        }
        catch (_a) {
            return String(arg);
        }
    }).join(' ');
}
function installConsoleInterception() {
    if (consoleInterceptInstalled)
        return;
    var captureEnabled = (process.env.LOG_INTERCEPT_CONSOLE || '').toLowerCase();
    var enabled = captureEnabled === '1' || captureEnabled === 'true' || (captureEnabled === '' && process.env.NODE_ENV === 'production');
    if (!enabled)
        return;
    consoleInterceptInstalled = true;
    console.log = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return exports.logger.throttled(logRegistry_js_1.LogCode.SYS_INFO, stringifyConsoleArgs(args), { role: logRegistry_js_1.LogRole.TRACE, source: 'console.log' });
    };
    console.info = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return exports.logger.throttled(logRegistry_js_1.LogCode.SYS_INFO, stringifyConsoleArgs(args), { role: logRegistry_js_1.LogRole.TRACE, source: 'console.info' });
    };
    console.warn = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return exports.logger.throttled(logRegistry_js_1.LogCode.SYS_INFO, stringifyConsoleArgs(args), { role: logRegistry_js_1.LogRole.EVENT, source: 'console.warn' });
    };
    console.error = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return exports.logger.error(logRegistry_js_1.LogCode.SYS_ERROR, stringifyConsoleArgs(args), { role: logRegistry_js_1.LogRole.EVENT, source: 'console.error' });
    };
}
