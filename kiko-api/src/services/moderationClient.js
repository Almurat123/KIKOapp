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
exports.moderationClient = exports.ModerationClient = void 0;
// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: generated-image flows need strict safety gates backed by OpenAI
//         moderation for prompt text, reference images, generated outputs, and
//         Farcaster-bound publish payloads, without changing ordinary chat's
//         existing moderation behavior.
// Goal: keep chat moderation compatibility while exposing a separate
//       fail-closed generated-image moderation client path.
// Owns: Node-to-Python moderation service requests and fallback semantics.
// Does Not Own: chat worker policy, generated image storage, or Farcaster
//               publication.
// Design Language:
// - ordinary chat text moderation keeps its existing fail-open behavior
// - generated-image moderation is fail-closed on service errors
// - generated-image moderation may send text and image URLs together
// - do not import generated-image strict policy into normal chat paths
// Document Provenance:
// - Source: OpenAI Moderation guide and Moderations API OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: strict generated-image text + image_url moderation client
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md
var unifiedApiService_js_1 = require("../config/unifiedApiService.js");
var dotenv = require("dotenv");
var scrubber_js_1 = require("../utils/scrubber.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
dotenv.config();
var MODERATION_SERVICE_URL = process.env.MODERATION_SERVICE_URL || 'http://localhost:8000';
var MODERATION_TIMEOUT_MS = Number(process.env.MODERATION_TIMEOUT_MS || '5000');
var INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';
function buildInternalHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (INTERNAL_SERVICE_KEY) {
        headers['X-Service-Key'] = INTERNAL_SERVICE_KEY;
        headers['X-Internal-Service-Key'] = INTERNAL_SERVICE_KEY;
    }
    return headers;
}
var ModerationClient = /** @class */ (function () {
    function ModerationClient() {
    }
    ModerationClient.getInstance = function () {
        if (!ModerationClient.instance) {
            ModerationClient.instance = new ModerationClient();
        }
        return ModerationClient.instance;
    };
    /**
     * Moderate user input before sending to LLM
     */
    ModerationClient.prototype.moderateInput = function (text_1) {
        return __awaiter(this, arguments, void 0, function (text, context, userId, sessionId, model) {
            var response, error_1;
            if (context === void 0) { context = {}; }
            if (userId === void 0) { userId = null; }
            if (sessionId === void 0) { sessionId = null; }
            if (model === void 0) { model = null; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                                url: "".concat(MODERATION_SERVICE_URL, "/input"),
                                method: 'POST',
                                headers: buildInternalHeaders(),
                                body: JSON.stringify({
                                    text: text,
                                    context: context
                                }),
                                timeout: MODERATION_TIMEOUT_MS
                            })];
                    case 1:
                        response = _a.sent();
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Moderation Input check result', { safe: response.safe, action: response.action, userId: userId !== null && userId !== void 0 ? userId : undefined });
                        return [2 /*return*/, response];
                    case 2:
                        error_1 = _a.sent();
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Input moderation request failed, defaulting to safe', { error: error_1.message });
                        return [2 /*return*/, { safe: true, action: 'allow' }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Moderate LLM output before sending to user
     */
    ModerationClient.prototype.moderateOutput = function (text_1) {
        return __awaiter(this, arguments, void 0, function (text, userId, sessionId, model) {
            var response, error_2;
            if (userId === void 0) { userId = null; }
            if (sessionId === void 0) { sessionId = null; }
            if (model === void 0) { model = null; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                                url: "".concat(MODERATION_SERVICE_URL, "/output"),
                                method: 'POST',
                                headers: buildInternalHeaders(),
                                body: JSON.stringify({
                                    text: text
                                }),
                                timeout: MODERATION_TIMEOUT_MS
                            })];
                    case 1:
                        response = _a.sent();
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Moderation Output check result', { safe: response.safe, userId: userId !== null && userId !== void 0 ? userId : undefined });
                        return [2 /*return*/, response];
                    case 2:
                        error_2 = _a.sent();
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Output moderation request failed, defaulting to original', { error: error_2.message });
                        return [2 /*return*/, { safe: true, filtered_text: (0, scrubber_js_1.scrub)(text) }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Strict generated-image moderation. Unlike ordinary chat moderation, this
     * fails closed because blocked imagery must not be generated or published.
     */
    ModerationClient.prototype.moderateGeneratedImage = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var imageUrls, text, response, error_3, message;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        imageUrls = (Array.isArray(params.imageUrls) ? params.imageUrls : [])
                            .map(function (value) { return String(value || '').trim(); })
                            .filter(Boolean);
                        text = String(params.text || '').trim();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, unifiedApiService_js_1.fetchJson)({
                                url: "".concat(MODERATION_SERVICE_URL, "/image-generation"),
                                method: 'POST',
                                headers: buildInternalHeaders(),
                                body: JSON.stringify({
                                    text: text,
                                    image_urls: imageUrls,
                                    stage: params.stage,
                                    context: __assign(__assign({}, (params.context || {})), { sessionId: params.sessionId || undefined, model: params.model || undefined }),
                                }),
                                timeout: MODERATION_TIMEOUT_MS,
                            })];
                    case 2:
                        response = _c.sent();
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Generated image moderation result', {
                            safe: response.safe,
                            action: response.action,
                            stage: params.stage,
                            imageCount: imageUrls.length,
                            userId: (_a = params.userId) !== null && _a !== void 0 ? _a : undefined,
                        });
                        return [2 /*return*/, response];
                    case 3:
                        error_3 = _c.sent();
                        message = String((error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || error_3 || 'unknown_error');
                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.API_FETCH_FAILED, 'Generated image moderation request failed, blocking by policy', {
                            error: message,
                            stage: params.stage,
                            userId: (_b = params.userId) !== null && _b !== void 0 ? _b : undefined,
                        });
                        return [2 /*return*/, {
                                safe: false,
                                action: 'block',
                                stage: params.stage,
                                strict: true,
                                checks: {
                                    openai: {
                                        flagged: true,
                                        categories: { moderation_service_error: true },
                                        scores: {},
                                        error: message,
                                    },
                                },
                                verification: {
                                    flagged: true,
                                    categories: { moderation_service_error: true },
                                    error: message,
                                },
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return ModerationClient;
}());
exports.ModerationClient = ModerationClient;
exports.moderationClient = ModerationClient.getInstance();
