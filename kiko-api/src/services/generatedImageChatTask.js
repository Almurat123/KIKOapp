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
exports.buildGeneratedImagePendingData = buildGeneratedImagePendingData;
exports.executeGeneratedImageChatTask = executeGeneratedImageChatTask;
exports.startGeneratedImageChatTask = startGeneratedImageChatTask;
var p_limit_1 = require("p-limit");
var node_crypto_1 = require("node:crypto");
var chatRepo = require("../repositories/chatRepository.js");
var chatWebSocket_js_1 = require("./chatWebSocket.js");
var cacheClient_js_1 = require("../cache/cacheClient.js");
var chatImageUploads_js_1 = require("./chatImageUploads.js");
var generatedImageBilling_js_1 = require("./generatedImageBilling.js");
var generatedImageSafety_js_1 = require("./generatedImageSafety.js");
var generatedImageProviders_js_1 = require("./generatedImageProviders.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: generated-image chat turns do not fit the text worker contract. They
//         need one owner that can acquire per-user concurrency, reserve billing
//         against a server-owned context, moderate prompts and outputs, store
//         private image assets, and stream state updates back into the existing
//         chat transcript without going through text chunk brokers. The first
//         pass leaked fake stage semantics into the transcript because it had
//         no real provider progress signal. This owner now has to preserve the
//         distinction between true OpenAI partial-image progress, Grok's lack
//         of image streaming, and KiKo's own post-generation safety/storage
//         phases. Chat v2 now also needs a synchronous execution entry so an
//         internal tool can reuse this owner inside the main chat turn and let
//         the tool manage the reply without fabricating a text completion.
//         Farcaster-bound generated-image replies also require a stable public
//         image URL because casts embed URLs instead of uploaded binaries. A
//         short-lived watermark experiment previously modified the final image
//         pixels inside this owner, but product direction removed that
//         requirement entirely. This owner now has to preserve provider output
//         bytes through moderation and storage without post-generation
//         watermark rewriting.
// Goal: execute one generated-image chat task end to end while preserving the
//       chat session/message/task model, strict image safety gates, billing
//       reservation semantics, provider-specific capability metadata and
//       progress semantics, and a tool-call-friendly awaitable result contract.
// Owns: generated-image chat task execution, per-user concurrency locking,
//       staged message-data updates, provider invocation order, success/fail
//       finalization for assistant image replies, and the awaitable execution
//       contract used by chat-v2 image tools.
// Does Not Own: authenticated route validation, provider HTTP request-shape
//               details, private image storage internals, or frontend rendering.
// Design Language:
// - generated-image turns must reserve billing before provider execution
// - one authenticated user may run only one generated-image task at a time
// - generated-image replies update message data in stages instead of text chunks
// - client-facing generated-image broadcasts must carry hydrated preview URLs,
//   while database persistence keeps private object keys
// - task failure must leave a durable assistant row explaining the failure state
// - OpenAI partial-image events may update progress semantics, but this owner
//   must not reveal unmoderated image bytes to the user-facing transcript
// - blurred preview reveals are only allowed after output moderation has passed
// - Grok image generation must not fabricate partial-progress stages that the
//   provider does not emit
// - forbidden local patch pattern: sending provider URLs directly to the client as durable chat history
// - moderation and storage should preserve provider output bytes; this owner
//   must not rewrite final pixels with a server watermark
// - publish a public generated-image copy only when the source surface requires
//   durable URL embeds; ordinary web chat generated images stay private
// Document Provenance:
// - Source: OpenAI Image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: OpenAI image generation path and real partial-image progress semantics
// - Verification: verified in docs
// - Source: OpenAI `/v1/images/generations` OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: using `image_generation.partial_image` / `image_generation.completed`
//   for OpenAI-only progress updates
// - Verification: verified in docs
// - Source: xAI Streaming guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: Grok image generation remains single-stage because image-output models do not stream
// - Verification: verified in docs
// - Source: operator requirement on 2026-04-18 for strict image safety
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: blocking any pre-moderation partial-image preview from reaching the transcript
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: generated-image execution, concurrency control, and OpenAI-style reveal UI preparation in chat
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: awaitable generated-image execution for chat-v2 internal tools
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 for production-stable Farcaster image embeds
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: requesting public generated-image storage copies for Farcaster sources
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 to remove generated-image
//   watermarking entirely
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: removing all server-side pixel watermark rewriting from this owner
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
var GENERATED_IMAGE_MAX_CONCURRENCY = Math.max(1, Number(process.env.GENERATED_IMAGE_MAX_CONCURRENCY || '2') || 2);
var GENERATED_IMAGE_USER_LOCK_TTL_SECONDS = Math.max(60, Number(process.env.GENERATED_IMAGE_USER_LOCK_TTL_SECONDS || '300') || 300);
var OPENAI_PARTIAL_IMAGE_PROGRESS_STEPS = 2;
var generatedImageExecutionLimit = (0, p_limit_1.default)(GENERATED_IMAGE_MAX_CONCURRENCY);
function inferProvider(requestedModel) {
    var normalized = String(requestedModel || '').trim().toLowerCase();
    if (normalized.startsWith('gpt-image-1.5'))
        return 'openai';
    if (normalized.startsWith('grok-imagine-image'))
        return 'xai';
    return null;
}
function inferProviderModel(requestedModel) {
    var normalized = String(requestedModel || '').trim().toLowerCase();
    if (normalized.startsWith('gpt-image-1.5'))
        return 'gpt-image-1.5';
    if (normalized.startsWith('grok-imagine-image-pro'))
        return 'grok-imagine-image-pro';
    if (normalized.startsWith('grok-imagine-image'))
        return 'grok-imagine-image';
    return null;
}
function normalizeQuality(requestedModel, quality) {
    var normalizedModel = String(requestedModel || '').trim().toLowerCase();
    var normalizedQuality = String(quality || '').trim().toLowerCase();
    if (normalizedModel.startsWith('gpt-image-1.5')) {
        if (normalizedQuality === 'low' || normalizedQuality === 'high')
            return normalizedQuality;
        return 'medium';
    }
    if (normalizedModel.startsWith('grok-imagine-image-pro'))
        return 'pro';
    if (normalizedModel.startsWith('grok-imagine-image'))
        return 'normal';
    return normalizedQuality || null;
}
function buildGeneratedImagePendingData(params) {
    var provider = inferProvider(params.requestedModel);
    var providerModel = inferProviderModel(params.requestedModel);
    return {
        requestedModel: String(params.requestedModel || '').trim().toLowerCase(),
        provider: provider,
        providerModel: providerModel,
        quality: normalizeQuality(params.requestedModel, params.quality),
        prompt: String(params.prompt || '').trim(),
        status: 'queued',
        stageLabel: 'Queued',
        supportsProgressiveReveal: provider === 'openai',
        partialImageIndex: null,
        partialImageCount: provider === 'openai' ? OPENAI_PARTIAL_IMAGE_PROGRESS_STEPS : null,
        images: [],
        revisedPrompt: null,
        errorMessage: null,
    };
}
function buildFailureMessage(params) {
    var requestedModel = String(params.requestedModel || '').trim().toLowerCase();
    var reason = String(params.reason || '').trim().toUpperCase();
    if (reason === 'BILLING_CONSENT_REQUIRED') {
        return 'Authorize billing in Wallet settings before using this image model.';
    }
    if (reason === 'MODEL_DISABLED') {
        if (requestedModel.startsWith('gpt-image-1.5')) {
            return 'GPT Image 1.5 is unavailable right now.';
        }
        if (requestedModel.startsWith('grok-imagine-image-pro')) {
            return 'Grok Imagine Pro is unavailable right now.';
        }
        return 'This image model is unavailable right now.';
    }
    if (reason === 'MODEL_NOT_SUPPORTED') {
        return 'This image model is not supported yet.';
    }
    if (reason === 'GENERATED_IMAGE_CONCURRENCY_LOCKED') {
        return 'Another image generation is already running for this account.';
    }
    if (reason === 'GENERATED_IMAGE_SAFETY_BLOCKED') {
        return 'This image request was blocked by safety policy.';
    }
    return String(params.fallback || 'Image generation failed. Please try again.');
}
function buildUserLockKey(userId) {
    return "generated-image:running:".concat(userId);
}
function publishGeneratedImageMessageState(params) {
    return __awaiter(this, void 0, void 0, function () {
        var clientGeneratedImage, hydratedData, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(params.persist !== false)) return [3 /*break*/, 2];
                    return [4 /*yield*/, chatRepo.updateMessage(params.assistantMessageId, {
                            type: 'generated-image',
                            data: { generatedImage: params.state },
                            status: params.messageStatus,
                        })];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2:
                    clientGeneratedImage = params.state;
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, (0, chatImageUploads_js_1.hydrateGeneratedChatImageDataForClient)({
                            generatedImage: params.state,
                        })];
                case 4:
                    hydratedData = _b.sent();
                    if (hydratedData === null || hydratedData === void 0 ? void 0 : hydratedData.generatedImage) {
                        clientGeneratedImage = hydratedData.generatedImage;
                    }
                    return [3 /*break*/, 6];
                case 5:
                    _a = _b.sent();
                    return [3 /*break*/, 6];
                case 6:
                    chatWebSocket_js_1.chatWS.broadcastToUser(params.userId, {
                        type: 'client_action',
                        sessionId: params.sessionId,
                        data: {
                            message_id: params.assistantMessageId,
                            targetMessageId: params.assistantMessageId,
                            action: {
                                type: 'update_message_data',
                                data: {
                                    generatedImage: clientGeneratedImage,
                                },
                            },
                        },
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function broadcastTaskStatus(params) {
    chatWebSocket_js_1.chatWS.broadcastToUser(params.userId, {
        type: 'task_status',
        sessionId: params.sessionId,
        data: {
            taskId: params.taskId,
            messageId: params.assistantMessageId,
            status: params.status,
            message: params.message,
            taskType: 'image',
        },
    });
}
function failGeneratedImageTask(params) {
    return __awaiter(this, void 0, void 0, function () {
        var failedState;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    failedState = __assign(__assign({}, params.state), { status: 'failed', stageLabel: 'Failed', errorMessage: params.errorMessage });
                    if (!(((_a = params.reservation) === null || _a === void 0 ? void 0 : _a.status) === 'reserved')) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, generatedImageBilling_js_1.markGeneratedImageUsageFailed)(params.taskId, params.failureReason || params.errorMessage)];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2: return [4 /*yield*/, publishGeneratedImageMessageState({
                        userId: params.userId,
                        sessionId: params.sessionId,
                        assistantMessageId: params.assistantMessageId,
                        messageStatus: 'error',
                        state: failedState,
                    })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, chatRepo.updateTaskStatus(params.taskId, 'error', params.errorMessage)];
                case 4:
                    _b.sent();
                    broadcastTaskStatus({
                        userId: params.userId,
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        assistantMessageId: params.assistantMessageId,
                        status: 'failed',
                        message: params.errorMessage,
                    });
                    return [2 /*return*/, {
                            status: 'failed',
                            taskId: params.taskId,
                            assistantMessageId: params.assistantMessageId,
                            state: failedState,
                            images: failedState.images,
                            errorMessage: params.errorMessage,
                        }];
            }
        });
    });
}
function buildEphemeralGeneratedImagePreview(params) {
    return {
        id: "".concat(params.assistantMessageId, "-preview"),
        previewUrl: "data:".concat(params.contentType, ";base64,").concat(params.imageBuffer.toString('base64')),
        name: 'generated-image-preview',
        type: params.contentType,
        size: params.imageBuffer.byteLength,
        width: null,
        height: null,
    };
}
function runGeneratedImageChatTask(params) {
    return __awaiter(this, void 0, void 0, function () {
        var initialState, currentState, lockValue, userLockKey, hasUserLock, reservation, generatingState_1, providerResult, moderatingState, moderationImageUrl, savingState, storedImage, completedState, error_1, failureReason;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    initialState = buildGeneratedImagePendingData({
                        requestedModel: params.requestedModel,
                        quality: params.quality,
                        prompt: params.prompt,
                    });
                    currentState = initialState;
                    lockValue = (0, node_crypto_1.randomUUID)();
                    userLockKey = buildUserLockKey(params.userId);
                    return [4 /*yield*/, (0, cacheClient_js_1.acquireLock)(userLockKey, GENERATED_IMAGE_USER_LOCK_TTL_SECONDS, lockValue)];
                case 1:
                    hasUserLock = _a.sent();
                    if (!hasUserLock) {
                        return [2 /*return*/, failGeneratedImageTask({
                                taskId: params.taskId,
                                userId: params.userId,
                                sessionId: params.sessionId,
                                assistantMessageId: params.assistantMessageId,
                                state: initialState,
                                errorMessage: buildFailureMessage({
                                    requestedModel: params.requestedModel,
                                    reason: 'GENERATED_IMAGE_CONCURRENCY_LOCKED',
                                }),
                                failureReason: 'GENERATED_IMAGE_CONCURRENCY_LOCKED',
                            })];
                    }
                    reservation = null;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 16, 18, 20]);
                    return [4 /*yield*/, chatRepo.updateTaskStatus(params.taskId, 'running')];
                case 3:
                    _a.sent();
                    broadcastTaskStatus({
                        userId: params.userId,
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        assistantMessageId: params.assistantMessageId,
                        status: 'running',
                        message: 'Generating image',
                    });
                    return [4 /*yield*/, (0, generatedImageBilling_js_1.reserveGeneratedImageUsage)({
                            requestId: params.taskId,
                            userId: params.userId,
                            model: params.requestedModel,
                            quality: params.quality,
                            imageCount: 1,
                            source: params.source || 'web',
                            contextType: 'assistant_message',
                            contextId: params.assistantMessageId,
                        })];
                case 4:
                    reservation = _a.sent();
                    if (!reservation.allowed || !reservation.provider || !reservation.providerModel || !reservation.quality) {
                        return [2 /*return*/, failGeneratedImageTask({
                                taskId: params.taskId,
                                userId: params.userId,
                                sessionId: params.sessionId,
                                assistantMessageId: params.assistantMessageId,
                                state: initialState,
                                reservation: reservation,
                                errorMessage: buildFailureMessage({
                                    requestedModel: params.requestedModel,
                                    reason: reservation.reason,
                                }),
                                failureReason: reservation.reason || 'GENERATED_IMAGE_BILLING_BLOCKED',
                            })];
                    }
                    generatingState_1 = __assign(__assign({}, initialState), { provider: reservation.provider, providerModel: reservation.providerModel, quality: reservation.quality, status: 'generating', stageLabel: 'Generating', supportsProgressiveReveal: reservation.provider === 'openai', partialImageIndex: null, partialImageCount: reservation.provider === 'openai' ? OPENAI_PARTIAL_IMAGE_PROGRESS_STEPS : null });
                    return [4 /*yield*/, publishGeneratedImageMessageState({
                            userId: params.userId,
                            sessionId: params.sessionId,
                            assistantMessageId: params.assistantMessageId,
                            messageStatus: 'streaming',
                            state: generatingState_1,
                        })];
                case 5:
                    _a.sent();
                    currentState = generatingState_1;
                    return [4 /*yield*/, (0, generatedImageSafety_js_1.assertGeneratedImagePromptSafe)({
                            userId: params.userId,
                            sessionId: params.sessionId,
                            model: reservation.providerModel,
                            provider: reservation.provider,
                            source: params.source || 'web',
                            text: params.prompt,
                        })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, generatedImageProviders_js_1.generateImageWithProvider)({
                            provider: reservation.provider,
                            model: reservation.providerModel,
                            prompt: params.prompt,
                            quality: reservation.quality,
                            onProgress: reservation.provider === 'openai'
                                ? function (event) { return __awaiter(_this, void 0, void 0, function () {
                                    var progressState;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                progressState = __assign(__assign({}, generatingState_1), { partialImageIndex: event.partialImageIndex, partialImageCount: event.partialImageCount });
                                                return [4 /*yield*/, publishGeneratedImageMessageState({
                                                        userId: params.userId,
                                                        sessionId: params.sessionId,
                                                        assistantMessageId: params.assistantMessageId,
                                                        messageStatus: 'streaming',
                                                        state: progressState,
                                                        persist: false,
                                                    })];
                                            case 1:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); }
                                : null,
                        })];
                case 7:
                    providerResult = _a.sent();
                    moderatingState = __assign(__assign({}, generatingState_1), { revisedPrompt: providerResult.revisedPrompt || null, supportsProgressiveReveal: providerResult.supportsProgressiveReveal, status: 'moderating', stageLabel: 'Safety check', partialImageIndex: null, partialImageCount: null });
                    return [4 /*yield*/, publishGeneratedImageMessageState({
                            userId: params.userId,
                            sessionId: params.sessionId,
                            assistantMessageId: params.assistantMessageId,
                            messageStatus: 'streaming',
                            state: moderatingState,
                        })];
                case 8:
                    _a.sent();
                    currentState = moderatingState;
                    moderationImageUrl = "data:".concat(providerResult.contentType, ";base64,").concat(providerResult.imageBuffer.toString('base64'));
                    return [4 /*yield*/, (0, generatedImageSafety_js_1.assertGeneratedImageOutputSafe)({
                            userId: params.userId,
                            sessionId: params.sessionId,
                            model: reservation.providerModel,
                            provider: reservation.provider,
                            source: params.source || 'web',
                            text: providerResult.revisedPrompt || params.prompt,
                            imageUrls: [moderationImageUrl],
                        })];
                case 9:
                    _a.sent();
                    savingState = __assign(__assign({}, moderatingState), { status: 'saving', stageLabel: 'Saving' });
                    return [4 /*yield*/, publishGeneratedImageMessageState({
                            userId: params.userId,
                            sessionId: params.sessionId,
                            assistantMessageId: params.assistantMessageId,
                            messageStatus: 'streaming',
                            state: savingState,
                        })];
                case 10:
                    _a.sent();
                    currentState = savingState;
                    return [4 /*yield*/, publishGeneratedImageMessageState({
                            userId: params.userId,
                            sessionId: params.sessionId,
                            assistantMessageId: params.assistantMessageId,
                            messageStatus: 'streaming',
                            state: __assign(__assign({}, savingState), { images: [
                                    buildEphemeralGeneratedImagePreview({
                                        assistantMessageId: params.assistantMessageId,
                                        contentType: providerResult.contentType,
                                        imageBuffer: providerResult.imageBuffer,
                                    }),
                                ] }),
                            persist: false,
                        })];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, (0, chatImageUploads_js_1.storeGeneratedChatImage)({
                            userId: params.userId,
                            assistantMessageId: params.assistantMessageId,
                            buffer: providerResult.imageBuffer,
                            contentType: providerResult.contentType,
                            fileName: "".concat(reservation.providerModel, ".png"),
                            publishPublic: String(params.source || '').trim().toLowerCase() === 'farcaster',
                        })];
                case 12:
                    storedImage = _a.sent();
                    completedState = __assign(__assign({}, savingState), { status: 'complete', stageLabel: 'Complete', images: (0, chatImageUploads_js_1.buildChatImageMessageAttachments)([storedImage]) });
                    return [4 /*yield*/, publishGeneratedImageMessageState({
                            userId: params.userId,
                            sessionId: params.sessionId,
                            assistantMessageId: params.assistantMessageId,
                            messageStatus: 'complete',
                            state: completedState,
                        })];
                case 13:
                    _a.sent();
                    currentState = completedState;
                    return [4 /*yield*/, (0, generatedImageBilling_js_1.markGeneratedImageUsageCompleted)(params.taskId)];
                case 14:
                    _a.sent();
                    return [4 /*yield*/, chatRepo.updateTaskStatus(params.taskId, 'done')];
                case 15:
                    _a.sent();
                    chatWebSocket_js_1.chatWS.broadcastToUser(params.userId, {
                        type: 'message_complete',
                        sessionId: params.sessionId,
                        data: {
                            messageId: params.assistantMessageId,
                            taskId: params.taskId,
                        },
                    });
                    broadcastTaskStatus({
                        userId: params.userId,
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        assistantMessageId: params.assistantMessageId,
                        status: 'completed',
                        message: 'Image complete',
                    });
                    return [2 /*return*/, {
                            status: 'complete',
                            taskId: params.taskId,
                            assistantMessageId: params.assistantMessageId,
                            state: completedState,
                            images: completedState.images,
                            errorMessage: null,
                        }];
                case 16:
                    error_1 = _a.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.AI_API_CALL, 'Generated image chat task failed', {
                        taskId: params.taskId,
                        assistantMessageId: params.assistantMessageId,
                        userId: params.userId,
                        model: params.requestedModel,
                        error: (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1),
                    });
                    failureReason = (0, generatedImageSafety_js_1.isGeneratedImageSafetyError)(error_1)
                        ? 'GENERATED_IMAGE_SAFETY_BLOCKED'
                        : (0, generatedImageProviders_js_1.isGeneratedImageProviderError)(error_1)
                            ? error_1.code
                            : 'GENERATED_IMAGE_PROVIDER_FAILED';
                    return [4 /*yield*/, failGeneratedImageTask({
                            taskId: params.taskId,
                            userId: params.userId,
                            sessionId: params.sessionId,
                            assistantMessageId: params.assistantMessageId,
                            state: currentState,
                            reservation: reservation,
                            errorMessage: buildFailureMessage({
                                requestedModel: params.requestedModel,
                                reason: failureReason,
                                fallback: error_1 === null || error_1 === void 0 ? void 0 : error_1.message,
                            }),
                            failureReason: failureReason,
                        })];
                case 17: return [2 /*return*/, _a.sent()];
                case 18: return [4 /*yield*/, (0, cacheClient_js_1.releaseLock)(userLockKey, lockValue).catch(function () { return undefined; })];
                case 19:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 20: return [2 /*return*/];
            }
        });
    });
}
function executeGeneratedImageChatTask(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, generatedImageExecutionLimit(function () { return runGeneratedImageChatTask(params); })];
        });
    });
}
function startGeneratedImageChatTask(params) {
    void executeGeneratedImageChatTask(params).catch(function (error) {
        logger_js_1.logger.error(logRegistry_js_1.LogCode.AI_API_CALL, 'Generated image chat task crashed outside task runner', {
            taskId: params.taskId,
            assistantMessageId: params.assistantMessageId,
            error: (error === null || error === void 0 ? void 0 : error.message) || String(error),
        });
    });
}
