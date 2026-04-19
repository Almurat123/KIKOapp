"use strict";
/**
 * Authentication middleware using Privy JWT
 * Validates Bearer token against Privy JWKS
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPrivyToken = verifyPrivyToken;
exports.requireAuth = requireAuth;
exports.requireEndUserAuth = requireEndUserAuth;
exports.getUserId = getUserId;
var jose_1 = require("jose");
var errorHandler_js_1 = require("./errorHandler.js");
var privy_js_1 = require("../config/privy.js");
var farcasterIdentityService_js_1 = require("../services/farcaster-agent/farcasterIdentityService.js");
var xIdentityService_js_1 = require("../services/x/xIdentityService.js");
var PRIVY_JWKS_URL = process.env.PRIVY_JWKS_URL || '';
var PRIVY_APP_ID = (0, privy_js_1.resolvePrivyServerConfig)().appId;
var NODE_ENV = String(process.env.NODE_ENV || '').toLowerCase();
var RAILWAY_ENVIRONMENT = String(process.env.RAILWAY_ENVIRONMENT || '').toLowerCase();
var APP_ENV = String(process.env.APP_ENV || '').toLowerCase();
var isLocalDev = NODE_ENV === 'development' ||
    NODE_ENV === 'dev' ||
    NODE_ENV === 'test' ||
    APP_ENV === 'local' ||
    RAILWAY_ENVIRONMENT === 'development';
var ALLOW_DEV_AUTH_BYPASS = process.env.ALLOW_DEV_AUTH_BYPASS === 'true' && isLocalDev;
var PRIVY_SKIP_VERIFY = process.env.PRIVY_SKIP_VERIFY === 'true' && ALLOW_DEV_AUTH_BYPASS;
// Only create JWKS fetcher if URL is provided
var jwks = PRIVY_JWKS_URL ? (0, jose_1.createRemoteJWKSet)(new URL(PRIVY_JWKS_URL)) : null;
/**
 * Verify Privy JWT token
 * Exported for use in WebSocket and other contexts
 */
function verifyPrivyToken(token) {
    return __awaiter(this, void 0, void 0, function () {
        var payload, payload, error_1, msg, isJwksFetchError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Dev escape hatch: skip signature verification if explicitly enabled
                    if (PRIVY_SKIP_VERIFY) {
                        payload = (0, jose_1.decodeJwt)(token);
                        // Still check expiration even in dev mode
                        if (payload.exp && Date.now() >= payload.exp * 1000) {
                            throw new errorHandler_js_1.AppError(401, 'Token expired', 'TOKEN_EXPIRED');
                        }
                        console.warn('[auth] PRIVY_SKIP_VERIFY=true, accepting token without signature check');
                        return [2 /*return*/, payload];
                    }
                    if (!jwks) {
                        throw new errorHandler_js_1.AppError(503, 'Privy JWKS URL not configured (set PRIVY_JWKS_URL) and signature verification is required', 'PRIVY_JWKS_MISSING');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, jose_1.jwtVerify)(token, jwks, {
                            issuer: 'privy.io',
                            audience: PRIVY_APP_ID || undefined, // Allow any if not set, but enforce if it is
                        })];
                case 2:
                    payload = (_a.sent()).payload;
                    // Double-check expiration (should be validated by jwtVerify but being explicit)
                    if (payload.exp && Date.now() >= payload.exp * 1000) {
                        throw new errorHandler_js_1.AppError(401, 'Token expired', 'TOKEN_EXPIRED');
                    }
                    return [2 /*return*/, payload];
                case 3:
                    error_1 = _a.sent();
                    // If it's already an AppError, rethrow
                    if (error_1 instanceof errorHandler_js_1.AppError)
                        throw error_1;
                    msg = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || '';
                    isJwksFetchError = msg.includes('JSON Web Key Set') ||
                        msg.includes('fetch') ||
                        msg.includes('Expected 200 OK') ||
                        msg.includes('failed to fetch');
                    if (isJwksFetchError) {
                        throw new errorHandler_js_1.AppError(503, 'Privy JWKS fetch failed; please verify PRIVY_JWKS_URL or enable PRIVY_SKIP_VERIFY only for local development', 'PRIVY_JWKS_UNAVAILABLE');
                    }
                    // Check for expiration error from jose
                    if (msg.includes('expired') || msg.includes('exp')) {
                        throw new errorHandler_js_1.AppError(401, 'Token expired', 'TOKEN_EXPIRED');
                    }
                    throw new errorHandler_js_1.AppError(401, "Invalid Privy token: ".concat(msg || 'unauthorized'), 'UNAUTHORIZED');
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fastify preHandler to require Privy auth
 */
function requireAuth(request, _reply) {
    return __awaiter(this, void 0, void 0, function () {
        var TEST_MODE, serviceKey, internalKey, auth, token, _a, endUserId;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    TEST_MODE = process.env.TEST_MODE === 'true' && ALLOW_DEV_AUTH_BYPASS;
                    if (TEST_MODE) {
                        console.warn('[auth] TEST_MODE=true, using mock user for testing');
                        request.user = {
                            sub: 'test-user-123',
                            iat: Math.floor(Date.now() / 1000),
                            iss: 'privy.io',
                            aud: 'test'
                        };
                        return [2 /*return*/];
                    }
                    serviceKey = request.headers['x-internal-service-key'] ||
                        request.headers['x-service-key'] ||
                        '';
                    internalKey = process.env.INTERNAL_SERVICE_KEY;
                    if (internalKey && serviceKey === internalKey) {
                        // Grant access as system service
                        request.user = {
                            sub: 'system-service',
                            role: 'service',
                            permissions: ['*']
                        };
                        return [2 /*return*/];
                    }
                    auth = request.headers.authorization || '';
                    token = auth.toLowerCase().startsWith('bearer ')
                        ? auth.substring(7).trim()
                        : auth.trim();
                    if (!token) {
                        console.warn('[auth] Missing Authorization Bearer token', {
                            url: request.url,
                            method: request.method,
                            ip: request.ip,
                            origin: request.headers.origin || 'none',
                            referer: request.headers.referer || 'none',
                            userAgent: (request.headers['user-agent'] || '').toString().substring(0, 120),
                        });
                        throw new errorHandler_js_1.AppError(401, 'Missing Authorization Bearer token', 'UNAUTHORIZED');
                    }
                    // Attach decoded payload for downstream use if needed
                    _a = request;
                    return [4 /*yield*/, verifyPrivyToken(token)];
                case 1:
                    // Attach decoded payload for downstream use if needed
                    _a.user = _e.sent();
                    endUserId = String(((_b = request.user) === null || _b === void 0 ? void 0 : _b.sub) || '').trim();
                    if (!(endUserId && ((_c = request.user) === null || _c === void 0 ? void 0 : _c.role) !== 'service')) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, xIdentityService_js_1.maybeAutoSyncVerifiedPrivyXUser)(endUserId).catch(function () { return undefined; })];
                case 2:
                    _e.sent();
                    return [4 /*yield*/, (0, farcasterIdentityService_js_1.maybeAutoSyncVerifiedPrivyFarcasterUser)(endUserId).catch(function () { return undefined; })];
                case 3:
                    _e.sent();
                    _e.label = 4;
                case 4:
                    // Log successful authentication (only in dev or for debugging)
                    if (process.env.AUTH_DEBUG === 'true') {
                        console.log('[auth] ✅ Authenticated:', {
                            sub: ((_d = request.user.sub) === null || _d === void 0 ? void 0 : _d.substring(0, 25)) + '...',
                            exp: request.user.exp
                        });
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Route guard for endpoints that must be called by end-users only.
 * Rejects service-key authenticated requests.
 */
function requireEndUserAuth(request, reply) {
    return __awaiter(this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, requireAuth(request, reply)];
                case 1:
                    _a.sent();
                    user = request.user;
                    if ((user === null || user === void 0 ? void 0 : user.role) === 'service' || (user === null || user === void 0 ? void 0 : user.sub) === 'system-service') {
                        console.warn('COPYTRADE_SERVICE_AUTH_BLOCKED', {
                            url: request.url,
                            method: request.method,
                            ip: request.ip,
                        });
                        throw new errorHandler_js_1.AppError(403, 'Service authentication is not allowed for this endpoint', 'END_USER_AUTH_REQUIRED');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Helper function to extract userId from authenticated request
 * Use this instead of directly accessing request.user.sub
 */
function getUserId(request) {
    var user = request.user;
    if (!user) {
        console.warn('[auth] getUserId called on unauthenticated request');
        return null;
    }
    return user.sub || user.id || null;
}
