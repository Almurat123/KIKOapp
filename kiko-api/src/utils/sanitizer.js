"use strict";
/**
 * Sanitizer Utility
 * Provides functions to redact sensitive information from logs, objects, and strings.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.redact = redact;
exports.redactUrl = redactUrl;
var SENSITIVE_KEYS = [
    'api',
    'key',
    'apikey',
    'api_key',
    'secret',
    'token',
    'auth',
    'authorization',
    'bearer',
    'password',
    'pwd',
    'jwt',
    'database',
    'db_url',
    'jwks',
    'private',
    'mnemonic',
    'seed',
];
var URL_SENSITIVE_PARAMS = [
    'api_key',
    'apiKey',
    'key',
    'token',
    'auth',
    'access_token',
];
/**
 * Redacts sensitive information from a string or object.
 * Recursively scans objects and arrays.
 */
var MAX_DEPTH = 8;
function redact(data, visited, depth) {
    if (visited === void 0) { visited = new WeakSet(); }
    if (depth === void 0) { depth = 0; }
    if (data === null || data === undefined) {
        return data;
    }
    if (depth > MAX_DEPTH)
        return '[Max Depth Exceeded]';
    if (typeof data === 'string') {
        return redactString(data);
    }
    if (typeof data === 'object') {
        if (visited.has(data))
            return '[Circular]';
        visited.add(data);
    }
    if (Array.isArray(data)) {
        return data.map(function (item) { return redact(item, visited, depth + 1); });
    }
    if (typeof data === 'object') {
        // Handle Error objects specifically
        if (data instanceof Error) {
            return __assign({ message: redact(data.message, visited, depth + 1), name: data.name, stack: redact(data.stack, visited, depth + 1) }, redact(__assign({}, data), visited, depth + 1));
        }
        var redactedObj = {};
        var _loop_1 = function (key, value) {
            var lowerKey = key.toLowerCase();
            // If the key itself is sensitive, redact its value immediately
            if (SENSITIVE_KEYS.some(function (k) { return lowerKey.includes(k); })) {
                redactedObj[key] = '[REDACTED]';
            }
            else {
                // Otherwise, recursively redact the value
                redactedObj[key] = redact(value, visited, depth + 1);
            }
        };
        for (var _i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            _loop_1(key, value);
        }
        return redactedObj;
    }
    return data;
}
/**
 * Redacts sensitive patterns within a string using regex.
 */
function redactString(str) {
    var redacted = str;
    // 1. Redact Bearer tokens in headers or strings
    redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9\-_.]+/gi, 'Bearer [REDACTED]');
    // 2. Redact potential API keys/secrets in URL-like patterns
    // Pattern: key=VALUE or apiKey=VALUE
    URL_SENSITIVE_PARAMS.forEach(function (param) {
        var regex = new RegExp("(".concat(param, "=)([^&\\s]+)"), 'gi');
        redacted = redacted.replace(regex, '$1[REDACTED]');
    });
    // 3. Redact common API key patterns (hex or base64 looking long strings after a key identifier)
    // This is a bit aggressive but safer for logs
    // redacted = redacted.replace(/(key["']?\s*[:=]\s*["'])([a-zA-Z0-9\-_]{20,})/gi, '$1[REDACTED]');
    return redacted;
}
/**
 * Redacts sensitive query parameters from a URL string.
 */
function redactUrl(url) {
    try {
        if (!url.includes('?') && !url.includes('='))
            return url;
        // Simple regex-based redaction for speed in hooks
        var sanitized_1 = url;
        URL_SENSITIVE_PARAMS.forEach(function (param) {
            var regex = new RegExp("([?&]".concat(param, "=)([^&\\s]+)"), 'gi');
            sanitized_1 = sanitized_1.replace(regex, '$1[REDACTED]');
        });
        return sanitized_1;
    }
    catch (e) {
        return '[INVALID_URL]';
    }
}
