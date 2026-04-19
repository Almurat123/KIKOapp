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
exports.getGeneratedImageDailyFreeLimit = getGeneratedImageDailyFreeLimit;
exports.buildGeneratedImageBillingDecision = buildGeneratedImageBillingDecision;
exports.reserveGeneratedImageUsage = reserveGeneratedImageUsage;
exports.markGeneratedImageUsageCompleted = markGeneratedImageUsageCompleted;
exports.markGeneratedImageUsageFailed = markGeneratedImageUsageFailed;
exports.markGeneratedImageUsageCancelled = markGeneratedImageUsageCancelled;
var node_crypto_1 = require("node:crypto");
var cacheClient_js_1 = require("../cache/cacheClient.js");
var env_js_1 = require("../config/env.js");
var billingRepository_js_1 = require("../repositories/billingRepository.js");
var billingService_js_1 = require("./billing/billingService.js");
// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: generated-image billing must not reuse chat quota logic. Image
//         generation has stricter anti-abuse requirements: the free allowance
//         is per authenticated user per UTC day, GPT Image remains temporarily
//         disabled even though pricing is already known, unavailable variants
//         must fail closed, and generated-image reservations must stay bound to
//         one server-owned request context so frontend state cannot mint extra
//         free runs or replay a reservation across contexts. The Grok normal
//         free-image allowance is env-driven so ops can raise or lower the
//         daily count without code changes.
// Goal: expose one server-side owner for generated-image availability,
//       free-image accounting, paid-cost calculation, and reservation/finalize
//       transitions.
// Owns: generated-image model normalization, free-vs-paid reservation
//       decisions, per-user daily free-image counting, and reservation status
//       updates for future image routes.
// Does Not Own: prompt rewriting, image safety moderation, provider HTTP
//               invocation, or frontend selector rendering.
// Design Language:
// - generated-image billing must be separate from chat usage quota
// - free-image allowance is resolved on the backend from authenticated user id
// - free-image allowance may be tuned from env, but the backend remains the only source of truth
// - reservation ids must be bound to a server-owned context id
// - unavailable image models fail closed even if the frontend exposes them
// - generated-image reservation replays must match the original server-owned context
// - paid generated-image calls require active billing consent before provider execution
// - forbidden local patch patterns: relying on localStorage or client-side counters for image freebies
// Document Provenance:
// - Source: xAI Grok Imagine Image model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: normal-mode price of `$n200000000` ticks per output image and model id `grok-imagine-image`
// - Verification: verified in docs
// - Source: xAI Grok Imagine Image Pro model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: pro-mode price of `$n700000000` ticks per output image and temporary disable state
// - Verification: verified in docs
// - Source: OpenAI GPT Image 1.5 model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: recognizing `gpt-image-1.5` as a paid image model with low / medium / high quality tiers
// - Verification: verified in docs
// - Source: OpenAI Image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: fixed 1024x1024 per-image pricing for GPT Image low / medium / high quality in current product UI
// - Verification: verified in docs
// - Source: operator requirement on 2026-04-18
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: GPT image disabled with no free allowance, Grok normal daily free allowance, Grok Pro disabled, and consent-required paid fallback
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: env-driven generated-image free-output allowance
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: configurable image free-count default and env knob
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
var GENERATED_IMAGE_RESERVATION_LOCK_TTL_SECONDS = 8;
var GPT_IMAGE_15_LOW_PRICE_USD_PER_OUTPUT = 0.009;
var GPT_IMAGE_15_MEDIUM_PRICE_USD_PER_OUTPUT = 0.034;
var GPT_IMAGE_15_HIGH_PRICE_USD_PER_OUTPUT = 0.133;
var GROK_IMAGE_PRICE_USD_PER_OUTPUT = 0.02;
var GROK_IMAGE_PRO_PRICE_USD_PER_OUTPUT = 0.07;
function getGrokImageFreeOutputsPerDay() {
    return Math.max(0, Number(env_js_1.env.generatedImage.dailyFreeOutputs || 0));
}
function normalizeImageCount(value) {
    var normalized = Math.floor(Number(value || 1));
    if (!Number.isFinite(normalized) || normalized <= 0)
        return 1;
    return normalized;
}
function normalizeQuality(value) {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'normal' || normalized === 'pro') {
        return normalized;
    }
    return null;
}
function normalizeGeneratedImageRequest(model, quality) {
    var requestedModel = String(model || '').trim().toLowerCase();
    var normalizedQuality = normalizeQuality(quality);
    if (!requestedModel) {
        return {
            requestedModel: requestedModel,
            provider: null,
            providerModel: null,
            modelFamily: null,
            quality: null,
            enabled: false,
            freeOutputImageLimit: 0,
            pricePerOutputImageUsd: 0,
        };
    }
    if (requestedModel.startsWith('grok-imagine-image-pro') || (requestedModel.startsWith('grok-imagine-image') && normalizedQuality === 'pro')) {
        return {
            requestedModel: requestedModel,
            provider: 'xai',
            providerModel: 'grok-imagine-image-pro',
            modelFamily: 'grok-imagine-image',
            quality: 'pro',
            enabled: false,
            freeOutputImageLimit: 0,
            pricePerOutputImageUsd: GROK_IMAGE_PRO_PRICE_USD_PER_OUTPUT,
        };
    }
    if (requestedModel.startsWith('grok-imagine-image')) {
        return {
            requestedModel: requestedModel,
            provider: 'xai',
            providerModel: 'grok-imagine-image',
            modelFamily: 'grok-imagine-image',
            quality: 'normal',
            enabled: true,
            freeOutputImageLimit: getGrokImageFreeOutputsPerDay(),
            pricePerOutputImageUsd: GROK_IMAGE_PRICE_USD_PER_OUTPUT,
        };
    }
    if (requestedModel.startsWith('gpt-image-1.5')) {
        var normalizedGptQuality = normalizedQuality === 'low' || normalizedQuality === 'high'
            ? normalizedQuality
            : 'medium';
        var pricePerOutputImageUsd = normalizedGptQuality === 'low'
            ? GPT_IMAGE_15_LOW_PRICE_USD_PER_OUTPUT
            : normalizedGptQuality === 'high'
                ? GPT_IMAGE_15_HIGH_PRICE_USD_PER_OUTPUT
                : GPT_IMAGE_15_MEDIUM_PRICE_USD_PER_OUTPUT;
        return {
            requestedModel: requestedModel,
            provider: 'openai',
            providerModel: 'gpt-image-1.5',
            modelFamily: 'gpt-image-1.5',
            quality: normalizedGptQuality,
            enabled: false,
            freeOutputImageLimit: 0,
            pricePerOutputImageUsd: pricePerOutputImageUsd,
        };
    }
    return {
        requestedModel: requestedModel,
        provider: null,
        providerModel: null,
        modelFamily: null,
        quality: null,
        enabled: false,
        freeOutputImageLimit: 0,
        pricePerOutputImageUsd: 0,
    };
}
function getGeneratedImageDailyFreeLimit(model, quality) {
    return normalizeGeneratedImageRequest(model, quality).freeOutputImageLimit;
}
function buildDisabledDecision(normalized, reason, dateUtc, imageCount) {
    return {
        allowed: false,
        reason: reason,
        dateUtc: dateUtc,
        requestedModel: normalized.requestedModel,
        provider: normalized.provider,
        providerModel: normalized.providerModel,
        modelFamily: normalized.modelFamily,
        quality: normalized.quality,
        imageCount: imageCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed: 0,
        freeOutputImagesRemaining: normalized.freeOutputImageLimit,
        freeImageCount: 0,
        billedImageCount: 0,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: 0,
        requiresBillingConsent: false,
    };
}
function buildGeneratedImageBillingDecision(snapshot) {
    var normalized = normalizeGeneratedImageRequest(snapshot.model, snapshot.quality);
    var imageCount = normalizeImageCount(snapshot.imageCount);
    var freeOutputImagesUsed = Math.max(0, snapshot.freeOutputImagesUsed);
    if (!normalized.providerModel || !normalized.modelFamily) {
        return buildDisabledDecision(normalized, 'MODEL_NOT_SUPPORTED', snapshot.dateUtc, imageCount);
    }
    if (!normalized.enabled) {
        return buildDisabledDecision(normalized, 'MODEL_DISABLED', snapshot.dateUtc, imageCount);
    }
    var freeOutputImagesRemaining = Math.max(normalized.freeOutputImageLimit - freeOutputImagesUsed, 0);
    var freeImageCount = Math.min(freeOutputImagesRemaining, imageCount);
    var billedImageCount = Math.max(imageCount - freeImageCount, 0);
    var requiresBillingConsent = billedImageCount > 0;
    if (requiresBillingConsent && !snapshot.hasBillingConsent) {
        return {
            allowed: false,
            reason: 'BILLING_CONSENT_REQUIRED',
            dateUtc: snapshot.dateUtc,
            requestedModel: normalized.requestedModel,
            provider: normalized.provider,
            providerModel: normalized.providerModel,
            modelFamily: normalized.modelFamily,
            quality: normalized.quality,
            imageCount: imageCount,
            freeOutputImageLimit: normalized.freeOutputImageLimit,
            freeOutputImagesUsed: freeOutputImagesUsed,
            freeOutputImagesRemaining: freeOutputImagesRemaining,
            freeImageCount: freeImageCount,
            billedImageCount: billedImageCount,
            pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
            usdCost: billedImageCount * normalized.pricePerOutputImageUsd,
            requiresBillingConsent: true,
        };
    }
    return {
        allowed: true,
        dateUtc: snapshot.dateUtc,
        requestedModel: normalized.requestedModel,
        provider: normalized.provider,
        providerModel: normalized.providerModel,
        modelFamily: normalized.modelFamily,
        quality: normalized.quality,
        imageCount: imageCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed: freeOutputImagesUsed,
        freeOutputImagesRemaining: freeOutputImagesRemaining,
        freeImageCount: freeImageCount,
        billedImageCount: billedImageCount,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: billedImageCount * normalized.pricePerOutputImageUsd,
        requiresBillingConsent: requiresBillingConsent,
    };
}
function toReservationLockKey(userId, dateUtc, modelFamily) {
    return "generated-image:billing:".concat(dateUtc, ":").concat(userId, ":").concat(modelFamily);
}
function assertReservationBindingMatches(record, binding) {
    if (!record)
        return;
    var normalized = normalizeGeneratedImageRequest(binding.model, binding.quality);
    var normalizedQuality = normalized.quality || null;
    var recordQuality = normalizeQuality(record.quality) || null;
    if (record.userId !== binding.userId
        || record.contextType !== binding.contextType
        || record.contextId !== binding.contextId
        || record.model !== (normalized.providerModel || record.model)
        || recordQuality !== normalizedQuality) {
        throw new Error('Generated image reservation binding mismatch');
    }
}
function toUsageReservation(record) {
    if (!record)
        return null;
    var normalized = normalizeGeneratedImageRequest(record.model, record.quality);
    var isReusableReservation = record.status === 'reserved' || record.status === 'completed';
    return {
        allowed: isReusableReservation,
        dateUtc: record.dateUtc,
        requestedModel: record.model,
        provider: normalized.provider,
        providerModel: normalized.providerModel,
        modelFamily: normalized.modelFamily,
        quality: normalized.quality,
        imageCount: record.imageCount,
        freeOutputImageLimit: normalized.freeOutputImageLimit,
        freeOutputImagesUsed: record.freeImageCount,
        freeOutputImagesRemaining: Math.max(normalized.freeOutputImageLimit - record.freeImageCount, 0),
        freeImageCount: record.freeImageCount,
        billedImageCount: record.billedImageCount,
        pricePerOutputImageUsd: normalized.pricePerOutputImageUsd,
        usdCost: record.usdCost,
        requiresBillingConsent: record.billedImageCount > 0,
        requestId: record.requestId,
        contextType: record.contextType,
        contextId: record.contextId,
        source: record.source,
        status: record.status,
        existing: true,
    };
}
function reserveGeneratedImageUsage(params) {
    return __awaiter(this, void 0, void 0, function () {
        var requestId, userId, contextType, contextId, existingRecord, existing, dateUtc, normalized, imageCount, lockKey, lockValue, hasLock, lockedExistingRecord, lockedExisting, summary, remainingFreeOutputs, needsBillingConsent, hasBillingConsent, _a, decision;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    requestId = String(params.requestId || '').trim();
                    userId = String(params.userId || '').trim();
                    contextType = String(params.contextType || '').trim();
                    contextId = String(params.contextId || '').trim();
                    if (!requestId)
                        throw new Error('Generated image reservation requires requestId');
                    if (!userId)
                        throw new Error('Generated image reservation requires userId');
                    if (!contextType || !contextId) {
                        throw new Error('Generated image reservation requires server-owned context binding');
                    }
                    return [4 /*yield*/, (0, billingRepository_js_1.findGeneratedImageUsageRecord)(requestId)];
                case 1:
                    existingRecord = _b.sent();
                    assertReservationBindingMatches(existingRecord, {
                        userId: userId,
                        contextType: contextType,
                        contextId: contextId,
                        model: params.model,
                        quality: params.quality,
                    });
                    existing = toUsageReservation(existingRecord);
                    if (existing)
                        return [2 /*return*/, existing];
                    dateUtc = (0, billingService_js_1.getUtcDateString)();
                    normalized = normalizeGeneratedImageRequest(params.model, params.quality);
                    imageCount = normalizeImageCount(params.imageCount);
                    if (!normalized.providerModel || !normalized.modelFamily) {
                        return [2 /*return*/, __assign(__assign({}, buildDisabledDecision(normalized, 'MODEL_NOT_SUPPORTED', dateUtc, imageCount)), { requestId: requestId, contextType: contextType, contextId: contextId, source: params.source || null, status: 'failed', existing: false })];
                    }
                    if (!normalized.enabled) {
                        return [2 /*return*/, __assign(__assign({}, buildDisabledDecision(normalized, 'MODEL_DISABLED', dateUtc, imageCount)), { requestId: requestId, contextType: contextType, contextId: contextId, source: params.source || null, status: 'failed', existing: false })];
                    }
                    lockKey = toReservationLockKey(userId, dateUtc, normalized.modelFamily);
                    lockValue = (0, node_crypto_1.randomUUID)();
                    return [4 /*yield*/, (0, cacheClient_js_1.acquireLock)(lockKey, GENERATED_IMAGE_RESERVATION_LOCK_TTL_SECONDS, lockValue)];
                case 2:
                    hasLock = _b.sent();
                    if (!hasLock) {
                        throw new Error('Generated image billing reservation is busy');
                    }
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, , 10, 12]);
                    return [4 /*yield*/, (0, billingRepository_js_1.findGeneratedImageUsageRecord)(requestId)];
                case 4:
                    lockedExistingRecord = _b.sent();
                    assertReservationBindingMatches(lockedExistingRecord, {
                        userId: userId,
                        contextType: contextType,
                        contextId: contextId,
                        model: params.model,
                        quality: params.quality,
                    });
                    lockedExisting = toUsageReservation(lockedExistingRecord);
                    if (lockedExisting)
                        return [2 /*return*/, lockedExisting];
                    return [4 /*yield*/, (0, billingRepository_js_1.getDailyGeneratedImageReservationSummary)({
                            userId: userId,
                            dateUtc: dateUtc,
                            modelFamily: normalized.modelFamily,
                        })];
                case 5:
                    summary = _b.sent();
                    remainingFreeOutputs = Math.max(normalized.freeOutputImageLimit - summary.freeImageCount, 0);
                    needsBillingConsent = imageCount > remainingFreeOutputs;
                    if (!needsBillingConsent) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, billingRepository_js_1.getActiveBillingConsent)(userId, env_js_1.env.billing.chainId)];
                case 6:
                    _a = !!(_b.sent());
                    return [3 /*break*/, 8];
                case 7:
                    _a = false;
                    _b.label = 8;
                case 8:
                    hasBillingConsent = _a;
                    decision = buildGeneratedImageBillingDecision({
                        dateUtc: dateUtc,
                        model: normalized.providerModel,
                        quality: normalized.quality,
                        imageCount: imageCount,
                        freeOutputImagesUsed: summary.freeImageCount,
                        hasBillingConsent: hasBillingConsent,
                    });
                    if (!decision.allowed || !decision.provider || !decision.providerModel || !decision.modelFamily || !decision.quality) {
                        return [2 /*return*/, __assign(__assign({}, decision), { requestId: requestId, contextType: contextType, contextId: contextId, source: params.source || null, status: 'failed', existing: false })];
                    }
                    return [4 /*yield*/, (0, billingRepository_js_1.insertGeneratedImageUsageReservation)({
                            requestId: requestId,
                            userId: userId,
                            provider: decision.provider,
                            model: decision.providerModel,
                            modelFamily: decision.modelFamily,
                            quality: decision.quality,
                            imageCount: decision.imageCount,
                            freeImageCount: decision.freeImageCount,
                            billedImageCount: decision.billedImageCount,
                            usdCost: decision.usdCost,
                            dateUtc: dateUtc,
                            contextType: contextType,
                            contextId: contextId,
                            source: params.source || null,
                        })];
                case 9:
                    _b.sent();
                    return [2 /*return*/, __assign(__assign({}, decision), { requestId: requestId, contextType: contextType, contextId: contextId, source: params.source || null, status: 'reserved', existing: false })];
                case 10: return [4 /*yield*/, (0, cacheClient_js_1.releaseLock)(lockKey, lockValue).catch(function () { return undefined; })];
                case 11:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function markGeneratedImageUsageCompleted(requestId) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedRequestId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    normalizedRequestId = String(requestId || '').trim();
                    if (!normalizedRequestId)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, billingRepository_js_1.updateGeneratedImageUsageStatus)({
                            requestId: normalizedRequestId,
                            status: 'completed',
                            failureReason: null,
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function markGeneratedImageUsageFailed(requestId, failureReason) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedRequestId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    normalizedRequestId = String(requestId || '').trim();
                    if (!normalizedRequestId)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, billingRepository_js_1.updateGeneratedImageUsageStatus)({
                            requestId: normalizedRequestId,
                            status: 'failed',
                            failureReason: failureReason || 'GENERATED_IMAGE_PROVIDER_FAILED',
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function markGeneratedImageUsageCancelled(requestId, failureReason) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedRequestId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    normalizedRequestId = String(requestId || '').trim();
                    if (!normalizedRequestId)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, billingRepository_js_1.updateGeneratedImageUsageStatus)({
                            requestId: normalizedRequestId,
                            status: 'cancelled',
                            failureReason: failureReason || 'GENERATED_IMAGE_REQUEST_CANCELLED',
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
