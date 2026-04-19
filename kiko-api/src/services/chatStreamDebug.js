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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChatStreamDebugEnabled = isChatStreamDebugEnabled;
exports.logChatStreamDebug = logChatStreamDebug;
exports.getTextMetrics = getTextMetrics;
var logger_js_1 = require("../utils/logger.js");
var TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);
var FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
function isChatStreamDebugEnabled() {
    var raw = String(process.env.CHAT_STREAM_DEBUG || process.env.DEBUG_CHAT_STREAM || '').trim().toLowerCase();
    if (TRUE_VALUES.has(raw))
        return true;
    if (FALSE_VALUES.has(raw))
        return false;
    return process.env.NODE_ENV !== 'production';
}
function logChatStreamDebug(code, message, metadata) {
    if (metadata === void 0) { metadata = {}; }
    if (!isChatStreamDebugEnabled())
        return;
    logger_js_1.logger.info(code, message, __assign(__assign({}, metadata), { streamDebug: true }));
}
function getTextMetrics(text) {
    var value = String(text || '');
    return {
        length: value.length,
        empty: value.length === 0,
    };
}
