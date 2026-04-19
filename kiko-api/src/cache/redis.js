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
exports.redis = exports.initRedis = void 0;
exports.connectRedis = connectRedis;
exports.get = get;
exports.set = set;
exports.setIfNotExists = setIfNotExists;
exports.incrBy = incrBy;
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
exports.del = del;
var dbCache = require("./dbCache.js");
var prisma_js_1 = require("../db/prisma.js");
var redis_1 = require("redis");
var redisUrl = process.env.REDIS_URL;
var redisHost = process.env.REDIS_HOST;
var redisPort = Number(process.env.REDIS_PORT || '6379');
var redisPassword = process.env.REDIS_PASSWORD;
var REDIS_ENABLED = (process.env.REDIS_ENABLED || 'true').toLowerCase() !== 'false';
// Keep the exported redis client for compatibility (rate limiter checks for existence)
var redis = null;
exports.redis = redis;
function buildRedisClient() {
    if (redisUrl) {
        return (0, redis_1.createClient)({ url: redisUrl });
    }
    return (0, redis_1.createClient)({
        socket: {
            host: redisHost || 'localhost',
            port: Number.isFinite(redisPort) ? redisPort : 6379,
        },
        password: redisPassword || undefined,
    });
}
function connectRedis() {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!REDIS_ENABLED)
                        return [2 /*return*/, false];
                    if (redis === null || redis === void 0 ? void 0 : redis.isOpen)
                        return [2 /*return*/, true];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    exports.redis = redis = buildRedisClient();
                    redis.on('error', function (err) {
                        console.error('[Redis] client error:', (err === null || err === void 0 ? void 0 : err.message) || String(err));
                    });
                    return [4 /*yield*/, redis.connect()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    error_1 = _a.sent();
                    console.error('[Redis] connect failed, fallback to DB cache:', (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1));
                    exports.redis = redis = null;
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Alias for backwards compatibility
exports.initRedis = connectRedis;
function get(key) {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(redis === null || redis === void 0 ? void 0 : redis.isOpen)) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.get(key)];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_2 = _a.sent();
                    console.error('[Redis] get failed, fallback to DB cache:', (error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || String(error_2));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, dbCache.get(key)];
            }
        });
    });
}
function set(key, value, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(redis === null || redis === void 0 ? void 0 : redis.isOpen)) return [3 /*break*/, 7];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    if (!(ttlSeconds && ttlSeconds > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, redis.set(key, value, { EX: Math.floor(ttlSeconds) })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, redis.set(key, value)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/];
                case 6:
                    error_3 = _a.sent();
                    console.error('[Redis] set failed, fallback to DB cache:', (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || String(error_3));
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, dbCache.set(key, value, ttlSeconds)];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setIfNotExists(key, value, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var result_1, result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(redis === null || redis === void 0 ? void 0 : redis.isOpen)) return [3 /*break*/, 6];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    if (!(ttlSeconds && ttlSeconds > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, redis.set(key, value, { NX: true, EX: Math.floor(ttlSeconds) })];
                case 2:
                    result_1 = _a.sent();
                    return [2 /*return*/, result_1 === 'OK'];
                case 3: return [4 /*yield*/, redis.set(key, value, { NX: true })];
                case 4:
                    result = _a.sent();
                    return [2 /*return*/, result === 'OK'];
                case 5:
                    error_4 = _a.sent();
                    console.error('[Redis] setIfNotExists failed, fallback to DB cache:', (error_4 === null || error_4 === void 0 ? void 0 : error_4.message) || String(error_4));
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/, dbCache.setIfNotExists(key, value, ttlSeconds)];
            }
        });
    });
}
function incrBy(key, amount, ttlSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var next, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(redis === null || redis === void 0 ? void 0 : redis.isOpen)) return [3 /*break*/, 6];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, redis.incrBy(key, amount)];
                case 2:
                    next = _a.sent();
                    if (!(ttlSeconds && ttlSeconds > 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, redis.expire(key, Math.floor(ttlSeconds))];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/, Number(next)];
                case 5:
                    error_5 = _a.sent();
                    console.error('[Redis] incrBy failed, fallback to DB cache:', (error_5 === null || error_5 === void 0 ? void 0 : error_5.message) || String(error_5));
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/, dbCache.incrBy(key, amount, ttlSeconds)];
            }
        });
    });
}
function acquireLock(key, ttlSeconds, value) {
    return __awaiter(this, void 0, void 0, function () {
        var safeTtl, result, error_6, safeTtl, expiresAt, rows, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(redis === null || redis === void 0 ? void 0 : redis.isOpen)) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : 30;
                    return [4 /*yield*/, redis.set(key, value, { NX: true, EX: safeTtl })];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result === 'OK'];
                case 3:
                    error_6 = _a.sent();
                    console.error('[Redis] acquireLock failed, fallback to DB lock:', {
                        key: key,
                        error: (error_6 === null || error_6 === void 0 ? void 0 : error_6.message) || String(error_6)
                    });
                    return [3 /*break*/, 4];
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : 30;
                    expiresAt = new Date(Date.now() + safeTtl * 1000);
                    return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            INSERT INTO \"Cache\" (\"key\", \"value\", \"expiresAt\", \"createdAt\", \"updatedAt\")\n            VALUES (", ", ", ", ", ", NOW(), NOW())\n            ON CONFLICT (\"key\") DO UPDATE\n            SET \"value\" = EXCLUDED.\"value\",\n                \"expiresAt\" = EXCLUDED.\"expiresAt\",\n                \"updatedAt\" = NOW()\n            WHERE \"Cache\".\"expiresAt\" IS NULL OR \"Cache\".\"expiresAt\" < NOW()\n            RETURNING \"key\"\n        "], ["\n            INSERT INTO \"Cache\" (\"key\", \"value\", \"expiresAt\", \"createdAt\", \"updatedAt\")\n            VALUES (", ", ", ", ", ", NOW(), NOW())\n            ON CONFLICT (\"key\") DO UPDATE\n            SET \"value\" = EXCLUDED.\"value\",\n                \"expiresAt\" = EXCLUDED.\"expiresAt\",\n                \"updatedAt\" = NOW()\n            WHERE \"Cache\".\"expiresAt\" IS NULL OR \"Cache\".\"expiresAt\" < NOW()\n            RETURNING \"key\"\n        "])), key, value, expiresAt)];
                case 5:
                    rows = _a.sent();
                    return [2 /*return*/, rows.length > 0];
                case 6:
                    error_7 = _a.sent();
                    console.error('[DBLock] acquireLock failed', {
                        key: key,
                        error: (error_7 === null || error_7 === void 0 ? void 0 : error_7.message) || String(error_7)
                    });
                    return [2 /*return*/, false];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function releaseLock(key, value) {
    return __awaiter(this, void 0, void 0, function () {
        var error_8, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(redis === null || redis === void 0 ? void 0 : redis.isOpen)) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", { keys: [key], arguments: [value] })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3:
                    error_8 = _a.sent();
                    console.error('[Redis] releaseLock failed, fallback to DB lock:', {
                        key: key,
                        error: (error_8 === null || error_8 === void 0 ? void 0 : error_8.message) || String(error_8)
                    });
                    return [3 /*break*/, 4];
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, prisma_js_1.default.$executeRaw(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            DELETE FROM \"Cache\"\n            WHERE \"key\" = ", "\n              AND \"value\" = ", "\n        "], ["\n            DELETE FROM \"Cache\"\n            WHERE \"key\" = ", "\n              AND \"value\" = ", "\n        "])), key, value)];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 6:
                    error_9 = _a.sent();
                    console.error('[DBLock] releaseLock failed', {
                        key: key,
                        error: (error_9 === null || error_9 === void 0 ? void 0 : error_9.message) || String(error_9)
                    });
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function del(key) {
    return __awaiter(this, void 0, void 0, function () {
        var error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(redis === null || redis === void 0 ? void 0 : redis.isOpen)) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.del(key)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3:
                    error_10 = _a.sent();
                    console.error('[Redis] del failed, fallback to DB cache:', (error_10 === null || error_10 === void 0 ? void 0 : error_10.message) || String(error_10));
                    return [3 /*break*/, 4];
                case 4: return [4 /*yield*/, dbCache.del(key)];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Default export for common usage
exports.default = {
    get: get,
    set: set,
    setIfNotExists: setIfNotExists,
    incrBy: incrBy,
    del: del,
    connect: connectRedis,
    get client() {
        return redis;
    }
};
var templateObject_1, templateObject_2;
