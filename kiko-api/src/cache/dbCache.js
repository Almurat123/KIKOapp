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
exports.redisClient = void 0;
exports.get = get;
exports.getEntry = getEntry;
exports.set = set;
exports.setIfNotExists = setIfNotExists;
exports.incrBy = incrBy;
exports.del = del;
exports.initCache = initCache;
var prisma_js_1 = require("../db/prisma.js");
/**
 * Get item from PostgreSQL Cache
 */
function get(key) {
    return __awaiter(this, void 0, void 0, function () {
        var item, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, prisma_js_1.default.cache.findUnique({
                            where: { key: key }
                        })];
                case 1:
                    item = _a.sent();
                    if (!(item && item.expiresAt && new Date() > item.expiresAt)) return [3 /*break*/, 3];
                    // Delete expired item asynchronously
                    return [4 /*yield*/, del(key)];
                case 2:
                    // Delete expired item asynchronously
                    _a.sent(); // Using existing del function
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/, (item === null || item === void 0 ? void 0 : item.value) || null];
                case 4:
                    error_1 = _a.sent();
                    console.error("[DBCache] Get error for ".concat(key, ":"), error_1);
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get cache entry with metadata (no auto-delete of expired items).
 */
function getEntry(key) {
    return __awaiter(this, void 0, void 0, function () {
        var item, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma_js_1.default.cache.findUnique({
                            where: { key: key },
                            select: { value: true, expiresAt: true, updatedAt: true }
                        })];
                case 1:
                    item = _a.sent();
                    if (!item)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            value: item.value,
                            expiresAt: item.expiresAt,
                            updatedAt: item.updatedAt
                        }];
                case 2:
                    error_2 = _a.sent();
                    console.error("[DBCache] GetEntry error for ".concat(key, ":"), error_2);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Set item in PostgreSQL Cache
 * ttl: Time to live in seconds
 */
function set(key, value, ttl) {
    return __awaiter(this, void 0, void 0, function () {
        var expiresAt, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    expiresAt = null;
                    if (ttl) {
                        expiresAt = new Date();
                        expiresAt.setSeconds(expiresAt.getSeconds() + ttl);
                    }
                    return [4 /*yield*/, prisma_js_1.default.cache.upsert({
                            where: { key: key },
                            update: {
                                value: value,
                                expiresAt: expiresAt,
                                updatedAt: new Date()
                            },
                            create: {
                                key: key,
                                value: value,
                                expiresAt: expiresAt
                            }
                        })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error("[DBCache] Set error for ".concat(key, ":"), error_3);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function setIfNotExists(key, value, ttl) {
    return __awaiter(this, void 0, void 0, function () {
        var expiresAt, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    expiresAt = null;
                    if (ttl) {
                        expiresAt = new Date();
                        expiresAt.setSeconds(expiresAt.getSeconds() + ttl);
                    }
                    return [4 /*yield*/, prisma_js_1.default.cache.createMany({
                            data: [{
                                    key: key,
                                    value: value,
                                    expiresAt: expiresAt
                                }],
                            skipDuplicates: true
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.count > 0];
                case 2:
                    error_4 = _a.sent();
                    console.error("[DBCache] SetIfNotExists error for ".concat(key, ":"), error_4);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function incrBy(key, amount, ttl) {
    return __awaiter(this, void 0, void 0, function () {
        var entry, current, next, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, getEntry(key)];
                case 1:
                    entry = _a.sent();
                    current = entry ? Number(entry.value) : 0;
                    next = current + amount;
                    return [4 /*yield*/, set(key, String(next), ttl)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, next];
                case 3:
                    error_5 = _a.sent();
                    console.error("[DBCache] IncrBy error for ".concat(key, ":"), error_5);
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Delete item from PostgreSQL Cache
 */
function del(key) {
    return __awaiter(this, void 0, void 0, function () {
        var error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma_js_1.default.cache.deleteMany({
                            where: { key: key }
                        })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_6 = _a.sent();
                    console.error("[DBCache] Del error for ".concat(key, ":"), error_6);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Initialize Cache (Cleanup expired items on startup)
 */
function initCache() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log('[DBCache] Initializing PostgreSQL Cache...');
                    return [4 /*yield*/, prisma_js_1.default.cache.deleteMany({
                            where: {
                                expiresAt: {
                                    lt: new Date()
                                }
                            }
                        })];
                case 1:
                    result = _a.sent();
                    console.log("[DBCache] Cleaned ".concat(result.count, " expired items."));
                    return [3 /*break*/, 3];
                case 2:
                    error_7 = _a.sent();
                    console.error('[DBCache] Init error:', error_7);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Export for backward compatibility with redis.ts (if needed directly)
exports.redisClient = {
    get: get,
    set: set,
    del: del,
    // Add mock quit/disconnect if needed
    quit: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); },
    disconnect: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); }
};
