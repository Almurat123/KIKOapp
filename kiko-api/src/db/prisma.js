"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.prisma = void 0;
exports.withRetry = withRetry;
require("../config/env.js");
var client_1 = require("@prisma/client");
var originalDbUrl = process.env.DATABASE_URL;
// Tuned connection settings: 20 connections is safer for shared RDS/Cloud DBs
var connectionLimit = 20;
var poolTimeout = 45; // Slightly lower timeout to catch issues faster
var connectionTimeout = 20;
var urlWithParams = originalDbUrl && !originalDbUrl.includes('connection_limit')
    ? "".concat(originalDbUrl).concat(originalDbUrl.includes('?') ? '&' : '?', "connection_limit=").concat(connectionLimit, "&pool_timeout=").concat(poolTimeout, "&connect_timeout=").concat(connectionTimeout)
    : originalDbUrl;
// Force override environment variable
if (urlWithParams) {
    process.env.DATABASE_URL = urlWithParams;
}
console.log("[Prisma] Initializing client (Pool: ".concat(connectionLimit, ", Timeout: ").concat(poolTimeout, "s, Connect: ").concat(connectionTimeout, "s)"));
exports.prisma = global.prisma || new client_1.PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
    ],
    datasources: {
        db: {
            url: urlWithParams
        }
    }
});
// Setup event-based logging for better production diagnostics
// @ts-ignore
exports.prisma.$on('error', function (e) {
    console.error("[Prisma-Error] ".concat(e.message), { target: e.target, timestamp: new Date() });
});
// @ts-ignore
exports.prisma.$on('warn', function (e) {
    console.warn("[Prisma-Warn] ".concat(e.message));
});
// Health check and auto-reconnect logic
function checkDbConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.prisma.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["SELECT 1"], ["SELECT 1"])))];
                case 1:
                    _a.sent();
                    console.log('[Prisma] DB connection is healthy');
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error('[Prisma] DB connection health check failed:', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Check connection on startup
checkDbConnection();
if (process.env.NODE_ENV !== 'production') {
    global.prisma = exports.prisma;
}
/**
 * Utility to wrap Prisma calls with a retry mechanism
 * specifically for P1017 (Server has closed the connection) errors.
 */
function withRetry(fn_1) {
    return __awaiter(this, arguments, void 0, function (fn, maxRetries, delay) {
        var lastError, _loop_1, i, state_1;
        var _a, _b, _c;
        if (maxRetries === void 0) { maxRetries = 3; }
        if (delay === void 0) { delay = 500; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _loop_1 = function (i) {
                        var _e, error_2;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    _f.trys.push([0, 2, , 5]);
                                    _e = {};
                                    return [4 /*yield*/, fn()];
                                case 1: return [2 /*return*/, (_e.value = _f.sent(), _e)];
                                case 2:
                                    error_2 = _f.sent();
                                    lastError = error_2;
                                    if (!((error_2 === null || error_2 === void 0 ? void 0 : error_2.code) === 'P1017' ||
                                        ((_a = error_2 === null || error_2 === void 0 ? void 0 : error_2.message) === null || _a === void 0 ? void 0 : _a.includes('closed the connection')) ||
                                        ((_b = error_2 === null || error_2 === void 0 ? void 0 : error_2.message) === null || _b === void 0 ? void 0 : _b.includes('Closed, cause: None')) ||
                                        ((_c = error_2 === null || error_2 === void 0 ? void 0 : error_2.message) === null || _c === void 0 ? void 0 : _c.includes('connection_limit')))) return [3 /*break*/, 4];
                                    console.warn("[Prisma] Connection issue detected (".concat(error_2.code || 'ECONNRESET', "), retry ").concat(i + 1, "/").concat(maxRetries, "..."));
                                    // Wait before retrying
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay * (i + 1)); })];
                                case 3:
                                    // Wait before retrying
                                    _f.sent();
                                    return [2 /*return*/, "continue"];
                                case 4: throw error_2; // If it's another error, don't retry
                                case 5: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _d.label = 1;
                case 1:
                    if (!(i < maxRetries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    state_1 = _d.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _d.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: throw lastError;
            }
        });
    });
}
exports.default = exports.prisma;
var templateObject_1;
