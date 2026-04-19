"use strict";
// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: web chat now supports user-uploaded image turns and refreshed chat
//         history must still render the image bubble. Generated-image replies
//         now reuse the same private image boundary so assistant-created images
//         do not live as public provider URLs or oversized DB blobs. This owner
//         therefore provides the private storage boundary for both browser
//         uploads and assistant-generated output assets: browser-to-R2 upload,
//         Redis task bindings, server-side image sanitation, durable private
//         object references in ChatMessage.data, and short-lived signed read
//         URLs for model and UI consumption. Farcaster publication is the one
//         exception that needs a durable public URL because casts embed URLs
//         instead of uploaded binaries; that public copy is opt-in per
//         generated-image task and must not make ordinary web chat images public.
// Goal: let current-turn chat images reach vision-capable models and let
//       assistant-generated image replies remain visible in chat history without
//       persisting image binaries or public image URLs in the main database,
//       while enforcing type/size/dimension safety at the storage boundary, and
//       publish stable public generated-image URLs only for social surfaces that
//       require URL embeds.
// Owns: temporary chat-image upload preparation, Redis binding state, R2 object
//       validation/sanitation, private message attachment metadata for both
//       user uploads and assistant-generated replies, short-lived signed read
//       URLs, opt-in public generated-image publication copies, and post-task
//       Redis cleanup.
// Does Not Own: chat message persistence, UI draft previews, image-provider
//               invocation, or prompt assembly.
// Design Language:
// - Chat images are durable private history assets once the user sends them or the assistant generates them.
// - Store private object references in ChatMessage.data, never public image URLs.
// - Browser uploads should use short-lived presigned PUT URLs.
// - Browser-uploaded objects should be finalized immediately after PUT so send
//   can bind already-sanitized metadata instead of doing heavy image work.
// - Model and history reads should use short-lived signed GET URLs generated only when needed.
// - Farcaster generated-image replies must use durable public URL embeds, not
//   expiring signed preview URLs.
// - Public generated-image copies are opt-in by task source; do not publish
//   ordinary web chat images.
// - Strip metadata and normalize image formats before model access.
// - Reject mismatched content types, oversize files, and extreme image dimensions.
// - Task cleanup must remove Redis bindings, not user-sent history images.
// Document Provenance:
// - Source: Cloudflare R2 Presigned URLs docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: browser upload via presigned PUT and model fetch via signed GET
// - Verification: verified in docs and code
// - Source: Cloudflare R2 Configure CORS docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: requiring bucket CORS for browser-side presigned uploads
// - Verification: verified in docs and code
// - Source: Cloudflare R2 Object lifecycles docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: optional expiration guidance for unsent or failed chat uploads, not sent history images
// - Verification: verified in docs and code
// - Source: product correction from operator discussion on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: durable private chat image attachments with regenerated signed previews
// - Verification: verified in code
// - Source: operator request on 2026-04-18 to persist generated-image replies
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: reusing the same private R2 image boundary for assistant-generated image replies
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 for production-stable Farcaster image embeds
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: opt-in public generated-image URL publication for Farcaster cast embeds
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION = exports.CHAT_IMAGE_UPLOAD_MAX_BYTES = exports.CHAT_IMAGE_UPLOAD_MAX_COUNT = void 0;
exports.isChatImageUploadConfigured = isChatImageUploadConfigured;
exports.supportsChatImageModel = supportsChatImageModel;
exports.prepareChatImageUploads = prepareChatImageUploads;
exports.discardPreparedChatImageUploads = discardPreparedChatImageUploads;
exports.finalizePreparedChatImageUploads = finalizePreparedChatImageUploads;
exports.bindPreparedChatImageUploadsToTask = bindPreparedChatImageUploadsToTask;
exports.buildChatImageMessageAttachments = buildChatImageMessageAttachments;
exports.hydrateChatImageAttachmentListForClient = hydrateChatImageAttachmentListForClient;
exports.hydrateChatImageAttachmentsForClient = hydrateChatImageAttachmentsForClient;
exports.hydrateGeneratedChatImageDataForClient = hydrateGeneratedChatImageDataForClient;
exports.loadTaskChatImageInputs = loadTaskChatImageInputs;
exports.storeGeneratedChatImage = storeGeneratedChatImage;
exports.cleanupTaskChatImageUploads = cleanupTaskChatImageUploads;
exports.isChatImageUploadError = isChatImageUploadError;
var node_crypto_1 = require("node:crypto");
var client_s3_1 = require("@aws-sdk/client-s3");
var s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
var sharp_1 = require("sharp");
var cacheClient_js_1 = require("../cache/cacheClient.js");
var logger_js_1 = require("../utils/logger.js");
var logRegistry_js_1 = require("../config/logRegistry.js");
exports.CHAT_IMAGE_UPLOAD_MAX_COUNT = 4;
exports.CHAT_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION = 4096;
var ACCEPTED_UPLOAD_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
var PREPARED_UPLOAD_TTL_SECONDS = Math.max(60, Number(process.env.CHAT_IMAGE_UPLOAD_PREPARED_TTL_SECONDS || '900'));
var TASK_BINDING_TTL_SECONDS = Math.max(300, Number(process.env.CHAT_IMAGE_UPLOAD_TASK_TTL_SECONDS || '3600'));
var PRESIGNED_PUT_TTL_SECONDS = Math.max(60, Number(process.env.CHAT_IMAGE_UPLOAD_PUT_TTL_SECONDS || '300'));
var PRESIGNED_GET_TTL_SECONDS = Math.max(300, Number(process.env.CHAT_IMAGE_UPLOAD_GET_TTL_SECONDS || '3600'));
var IMAGE_CACHE_CONTROL = process.env.CHAT_IMAGE_UPLOAD_CACHE_CONTROL || 'private, max-age=3600';
var CHAT_IMAGE_PREFIX = String(process.env.CHAT_IMAGE_UPLOAD_PREFIX || 'chat-uploads').replace(/^\/+|\/+$/g, '');
var CHAT_GENERATED_IMAGE_PREFIX = String(process.env.CHAT_GENERATED_IMAGE_PREFIX || "".concat(CHAT_IMAGE_PREFIX, "/generated")).replace(/^\/+|\/+$/g, '');
var CHAT_GENERATED_IMAGE_PUBLIC_PREFIX = String(process.env.CHAT_GENERATED_IMAGE_PUBLIC_PREFIX || "".concat(CHAT_IMAGE_PREFIX, "/generated-public")).replace(/^\/+|\/+$/g, '');
var CHAT_GENERATED_IMAGE_PUBLIC_BASE_URL = String(process.env.CHAT_GENERATED_IMAGE_PUBLIC_BASE_URL || '').trim().replace(/\/+$/g, '');
var GENERATED_IMAGE_PUBLIC_CACHE_CONTROL = process.env.CHAT_GENERATED_IMAGE_PUBLIC_CACHE_CONTROL || 'public, max-age=31536000, immutable';
var MAX_IMAGE_PIXELS = exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION * exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION;
var ChatImageUploadError = /** @class */ (function (_super) {
    __extends(ChatImageUploadError, _super);
    function ChatImageUploadError(message, statusCode) {
        if (statusCode === void 0) { statusCode = 400; }
        var _this = _super.call(this, message) || this;
        _this.name = 'ChatImageUploadError';
        _this.statusCode = statusCode;
        return _this;
    }
    return ChatImageUploadError;
}(Error));
var s3Client = null;
function getPreparedUploadRedisKey(uploadId) {
    return "chat:image-upload:prepared:".concat(uploadId);
}
function getTaskBindingRedisKey(taskId) {
    return "chat:image-upload:task:".concat(taskId);
}
function normalizeMimeType(input) {
    var normalized = String(input || '').trim().toLowerCase();
    if (normalized === 'image/jpg')
        return 'image/jpeg';
    return normalized;
}
function normalizeOriginalFileName(input) {
    var trimmed = String(input || '').trim();
    if (!trimmed)
        return 'image';
    return trimmed.replace(/[^\w.\-()\s]+/g, '_').slice(0, 120) || 'image';
}
function safeUserPathSegment(userId) {
    return String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 96) || 'anonymous';
}
function getChatImageUploadConfig() {
    var accountId = String(process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '').trim();
    var bucket = String(process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || '').trim();
    var accessKeyId = String(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '').trim();
    var secretAccessKey = String(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '').trim();
    var endpoint = String(process.env.CLOUDFLARE_R2_ENDPOINT
        || process.env.R2_ENDPOINT
        || (accountId ? "https://".concat(accountId, ".r2.cloudflarestorage.com") : '')).trim();
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !endpoint) {
        return null;
    }
    return {
        accountId: accountId,
        bucket: bucket,
        endpoint: endpoint,
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    };
}
function getRequiredUploadConfig() {
    var config = getChatImageUploadConfig();
    if (!config) {
        throw new ChatImageUploadError('Chat image uploads are not configured on the server.', 503);
    }
    return config;
}
function getS3Client() {
    var config = getRequiredUploadConfig();
    if (!s3Client) {
        s3Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: config.endpoint,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }
    return s3Client;
}
function assertUploadRequestShape(files) {
    if (!Array.isArray(files) || files.length === 0) {
        throw new ChatImageUploadError('At least one image is required.');
    }
    if (files.length > exports.CHAT_IMAGE_UPLOAD_MAX_COUNT) {
        throw new ChatImageUploadError("You can upload up to ".concat(exports.CHAT_IMAGE_UPLOAD_MAX_COUNT, " images per message."));
    }
    for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
        var file = files_1[_i];
        var contentType = normalizeMimeType((file === null || file === void 0 ? void 0 : file.contentType) || '');
        var size = Number((file === null || file === void 0 ? void 0 : file.size) || 0);
        if (!ACCEPTED_UPLOAD_MIME_TYPES.has(contentType)) {
            throw new ChatImageUploadError('Unsupported image type. Use PNG, JPG, or WEBP.');
        }
        if (!Number.isFinite(size) || size <= 0) {
            throw new ChatImageUploadError('Image size is invalid.');
        }
        if (size > exports.CHAT_IMAGE_UPLOAD_MAX_BYTES) {
            throw new ChatImageUploadError("Each image must be ".concat(Math.floor(exports.CHAT_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024)), "MB or smaller."));
        }
    }
}
function readPreparedUploadRecord(uploadId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, cacheClient_js_1.default.getJson(getPreparedUploadRedisKey(uploadId))];
        });
    });
}
function writePreparedUploadRecord(record) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cacheClient_js_1.default.setJson(getPreparedUploadRedisKey(record.uploadId), record, PREPARED_UPLOAD_TTL_SECONDS)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function deletePreparedUploadRecord(uploadId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cacheClient_js_1.default.del(getPreparedUploadRedisKey(uploadId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function writeTaskBinding(binding) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cacheClient_js_1.default.setJson(getTaskBindingRedisKey(binding.taskId), binding, TASK_BINDING_TTL_SECONDS)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function readTaskBinding(taskId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, cacheClient_js_1.default.getJson(getTaskBindingRedisKey(taskId))];
        });
    });
}
function deleteTaskBinding(taskId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cacheClient_js_1.default.del(getTaskBindingRedisKey(taskId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function buildObjectKey(userId, uploadId) {
    var dayStamp = new Date().toISOString().slice(0, 10);
    return "".concat(CHAT_IMAGE_PREFIX, "/").concat(safeUserPathSegment(userId), "/").concat(dayStamp, "/").concat(uploadId);
}
function buildGeneratedObjectKey(userId, assistantMessageId) {
    var dayStamp = new Date().toISOString().slice(0, 10);
    var sanitizedMessageId = String(assistantMessageId || (0, node_crypto_1.randomUUID)()).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120) || (0, node_crypto_1.randomUUID)();
    return "".concat(CHAT_GENERATED_IMAGE_PREFIX, "/").concat(safeUserPathSegment(userId), "/").concat(dayStamp, "/").concat(sanitizedMessageId);
}
function buildGeneratedPublicObjectKey(userId, assistantMessageId) {
    var dayStamp = new Date().toISOString().slice(0, 10);
    var sanitizedMessageId = String(assistantMessageId || (0, node_crypto_1.randomUUID)()).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120) || (0, node_crypto_1.randomUUID)();
    return "".concat(CHAT_GENERATED_IMAGE_PUBLIC_PREFIX, "/farcaster/").concat(safeUserPathSegment(userId), "/").concat(dayStamp, "/").concat(sanitizedMessageId, ".png");
}
function buildPublicObjectUrl(objectKey) {
    if (!CHAT_GENERATED_IMAGE_PUBLIC_BASE_URL)
        return null;
    var encodedPath = String(objectKey || '')
        .split('/')
        .map(function (segment) { return encodeURIComponent(segment); })
        .join('/');
    return "".concat(CHAT_GENERATED_IMAGE_PUBLIC_BASE_URL, "/").concat(encodedPath);
}
function headObjectWithRetry(objectKey_1) {
    return __awaiter(this, arguments, void 0, function (objectKey, attempts) {
        var client, bucket, _loop_1, attempt, state_1;
        if (attempts === void 0) { attempts = 4; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = getS3Client();
                    bucket = getRequiredUploadConfig().bucket;
                    _loop_1 = function (attempt) {
                        var head, error_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 4]);
                                    return [4 /*yield*/, client.send(new client_s3_1.HeadObjectCommand({
                                            Bucket: bucket,
                                            Key: objectKey,
                                        }))];
                                case 1:
                                    head = _b.sent();
                                    return [2 /*return*/, { value: {
                                                contentLength: Number(head.ContentLength || 0),
                                                contentType: normalizeMimeType(String(head.ContentType || '')),
                                            } }];
                                case 2:
                                    error_1 = _b.sent();
                                    if (attempt === attempts - 1) {
                                        return [2 /*return*/, { value: null }];
                                    }
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200 * (attempt + 1)); })];
                                case 3:
                                    _b.sent();
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempt < attempts)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt += 1;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, null];
            }
        });
    });
}
function getObjectBuffer(objectKey) {
    return __awaiter(this, void 0, void 0, function () {
        var client, bucket, response, bytes;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = getS3Client();
                    bucket = getRequiredUploadConfig().bucket;
                    return [4 /*yield*/, client.send(new client_s3_1.GetObjectCommand({
                            Bucket: bucket,
                            Key: objectKey,
                        }))];
                case 1:
                    response = _b.sent();
                    return [4 /*yield*/, ((_a = response.Body) === null || _a === void 0 ? void 0 : _a.transformToByteArray())];
                case 2:
                    bytes = _b.sent();
                    return [2 /*return*/, Buffer.from(bytes || [])];
            }
        });
    });
}
function putObjectBuffer(objectKey_1, body_1, contentType_1) {
    return __awaiter(this, arguments, void 0, function (objectKey, body, contentType, cacheControl) {
        var client, bucket;
        if (cacheControl === void 0) { cacheControl = IMAGE_CACHE_CONTROL; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = getS3Client();
                    bucket = getRequiredUploadConfig().bucket;
                    return [4 /*yield*/, client.send(new client_s3_1.PutObjectCommand({
                            Bucket: bucket,
                            Key: objectKey,
                            Body: body,
                            ContentType: contentType,
                            CacheControl: cacheControl,
                        }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function deleteObjectQuietly(objectKey) {
    return __awaiter(this, void 0, void 0, function () {
        var client, bucket, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    client = getS3Client();
                    bucket = getRequiredUploadConfig().bucket;
                    return [4 /*yield*/, client.send(new client_s3_1.DeleteObjectCommand({
                            Bucket: bucket,
                            Key: objectKey,
                        }))];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image upload cleanup failed to delete object', {
                        objectKey: objectKey,
                        error: error_2 instanceof Error ? error_2.message : String(error_2),
                    });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function resolveNormalizedOutputFormat(inputFormat) {
    if (inputFormat === 'jpeg') {
        return { format: 'jpeg', contentType: 'image/jpeg' };
    }
    return { format: 'png', contentType: 'image/png' };
}
function sanitizeImageBufferToTaskRecord(params) {
    return __awaiter(this, void 0, void 0, function () {
        var objectBuffer, metadata, inputFormat, width, height, output, pipeline, sanitizedBuffer, _a, sanitizedMeta;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    objectBuffer = params.objectBuffer;
                    if (objectBuffer.length === 0) {
                        throw new ChatImageUploadError('Uploaded image could not be read from storage.');
                    }
                    if (objectBuffer.length > exports.CHAT_IMAGE_UPLOAD_MAX_BYTES) {
                        throw new ChatImageUploadError("Each image must be ".concat(Math.floor(exports.CHAT_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024)), "MB or smaller."));
                    }
                    return [4 /*yield*/, (0, sharp_1.default)(objectBuffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata()];
                case 1:
                    metadata = _b.sent();
                    inputFormat = String(metadata.format || '').toLowerCase();
                    if (!inputFormat || !['jpeg', 'png', 'webp'].includes(inputFormat)) {
                        throw new ChatImageUploadError('Uploaded file is not a supported image.');
                    }
                    width = Number(metadata.width || 0);
                    height = Number(metadata.height || 0);
                    if (!width || !height) {
                        throw new ChatImageUploadError('Uploaded image has invalid dimensions.');
                    }
                    output = resolveNormalizedOutputFormat(inputFormat);
                    pipeline = (0, sharp_1.default)(objectBuffer, { limitInputPixels: MAX_IMAGE_PIXELS })
                        .rotate()
                        .resize({
                        width: exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION,
                        height: exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION,
                        fit: 'inside',
                        withoutEnlargement: true,
                    });
                    if (!(output.format === 'jpeg')) return [3 /*break*/, 3];
                    return [4 /*yield*/, pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer()];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, pipeline.png({ compressionLevel: 9 }).toBuffer()];
                case 4:
                    _a = _b.sent();
                    _b.label = 5;
                case 5:
                    sanitizedBuffer = _a;
                    if (sanitizedBuffer.length > exports.CHAT_IMAGE_UPLOAD_MAX_BYTES) {
                        throw new ChatImageUploadError('Image is too large after normalization. Please upload a smaller image.');
                    }
                    return [4 /*yield*/, (0, sharp_1.default)(sanitizedBuffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata()];
                case 6:
                    sanitizedMeta = _b.sent();
                    if ((sanitizedMeta.width || 0) > exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION || (sanitizedMeta.height || 0) > exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION) {
                        throw new ChatImageUploadError("Images must be ".concat(exports.CHAT_IMAGE_UPLOAD_MAX_DIMENSION, "px or smaller on each side."));
                    }
                    return [4 /*yield*/, putObjectBuffer(params.objectKey, sanitizedBuffer, output.contentType)];
                case 7:
                    _b.sent();
                    if (!(params.publicObjectKey && params.publicUrl)) return [3 /*break*/, 9];
                    return [4 /*yield*/, putObjectBuffer(params.publicObjectKey, sanitizedBuffer, output.contentType, GENERATED_IMAGE_PUBLIC_CACHE_CONTROL)];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9: return [2 /*return*/, {
                        uploadId: params.uploadId,
                        objectKey: params.objectKey,
                        publicObjectKey: params.publicObjectKey || null,
                        publicUrl: params.publicUrl || null,
                        originalFileName: params.originalFileName,
                        contentType: output.contentType,
                        size: sanitizedBuffer.length,
                        width: sanitizedMeta.width || null,
                        height: sanitizedMeta.height || null,
                    }];
            }
        });
    });
}
function sanitizeStoredImage(record) {
    return __awaiter(this, void 0, void 0, function () {
        var objectBuffer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getObjectBuffer(record.objectKey)];
                case 1:
                    objectBuffer = _a.sent();
                    return [2 /*return*/, sanitizeImageBufferToTaskRecord({
                            uploadId: record.uploadId,
                            objectKey: record.objectKey,
                            originalFileName: record.originalFileName,
                            objectBuffer: objectBuffer,
                            preferredContentType: record.expectedContentType,
                        })];
            }
        });
    });
}
function isPreparedUploadFinalized(record) {
    return Boolean(record.finalizedAt && record.contentType && record.size && record.size > 0);
}
function taskImageRecordFromPrepared(record) {
    var _a, _b;
    return {
        uploadId: record.uploadId,
        objectKey: record.objectKey,
        originalFileName: record.originalFileName,
        contentType: record.contentType || record.expectedContentType,
        size: Number(record.size || record.expectedSize || 0),
        width: (_a = record.width) !== null && _a !== void 0 ? _a : null,
        height: (_b = record.height) !== null && _b !== void 0 ? _b : null,
    };
}
function assertUploadedObjectMatchesPrepared(record) {
    return __awaiter(this, void 0, void 0, function () {
        var head;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, headObjectWithRetry(record.objectKey)];
                case 1:
                    head = _a.sent();
                    if (!head) {
                        throw new ChatImageUploadError('One or more images did not finish uploading. Please try again.');
                    }
                    if (!ACCEPTED_UPLOAD_MIME_TYPES.has(head.contentType)) {
                        throw new ChatImageUploadError('Uploaded file type does not match the allowed image types.');
                    }
                    if (head.contentLength <= 0 || head.contentLength > exports.CHAT_IMAGE_UPLOAD_MAX_BYTES) {
                        throw new ChatImageUploadError("Each image must be ".concat(Math.floor(exports.CHAT_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024)), "MB or smaller."));
                    }
                    if (record.expectedSize > 0 && head.contentLength !== record.expectedSize) {
                        throw new ChatImageUploadError('Uploaded image size did not match the selected file.');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function finalizePreparedUploadRecord(record) {
    return __awaiter(this, void 0, void 0, function () {
        var image;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isPreparedUploadFinalized(record)) {
                        return [2 /*return*/, taskImageRecordFromPrepared(record)];
                    }
                    return [4 /*yield*/, assertUploadedObjectMatchesPrepared(record)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, sanitizeStoredImage(record)];
                case 2:
                    image = _a.sent();
                    return [4 /*yield*/, writePreparedUploadRecord(__assign(__assign({}, record), { finalizedAt: new Date().toISOString(), contentType: image.contentType, size: image.size, width: image.width, height: image.height }))];
                case 3:
                    _a.sent();
                    return [2 /*return*/, image];
            }
        });
    });
}
function toFinalizedChatImageUpload(image) {
    return {
        uploadId: image.uploadId,
        contentType: image.contentType,
        size: image.size,
        width: image.width,
        height: image.height,
    };
}
function buildSignedReadLabel(image, index) {
    var baseName = image.originalFileName ? " (".concat(image.originalFileName, ")") : '';
    return "Uploaded image ".concat(index + 1).concat(baseName);
}
function readAttachmentObjectKey(attachment) {
    var _a;
    return String((attachment === null || attachment === void 0 ? void 0 : attachment.objectKey)
        || (attachment === null || attachment === void 0 ? void 0 : attachment.storageObjectKey)
        || ((_a = attachment === null || attachment === void 0 ? void 0 : attachment.storage) === null || _a === void 0 ? void 0 : _a.objectKey)
        || '').trim();
}
function readAttachmentName(attachment, index) {
    return String((attachment === null || attachment === void 0 ? void 0 : attachment.name)
        || (attachment === null || attachment === void 0 ? void 0 : attachment.originalFileName)
        || "image-".concat(index + 1)).trim();
}
function readAttachmentType(attachment) {
    return normalizeMimeType(String((attachment === null || attachment === void 0 ? void 0 : attachment.type)
        || (attachment === null || attachment === void 0 ? void 0 : attachment.contentType)
        || 'image/png'));
}
function createSignedReadUrl(objectKey, contentType) {
    return __awaiter(this, void 0, void 0, function () {
        var client, bucket;
        return __generator(this, function (_a) {
            client = getS3Client();
            bucket = getRequiredUploadConfig().bucket;
            return [2 /*return*/, (0, s3_request_presigner_1.getSignedUrl)(client, new client_s3_1.GetObjectCommand({
                    Bucket: bucket,
                    Key: objectKey,
                    ResponseContentType: contentType,
                    ResponseCacheControl: IMAGE_CACHE_CONTROL,
                }), {
                    expiresIn: PRESIGNED_GET_TTL_SECONDS,
                })];
        });
    });
}
function isChatImageUploadConfigured() {
    return getChatImageUploadConfig() !== null;
}
function supportsChatImageModel(model) {
    var normalized = String(model || '').trim().toLowerCase();
    if (!normalized)
        return false;
    if (normalized.startsWith('gpt') || normalized.startsWith('o'))
        return true;
    if (normalized.includes('grok'))
        return true;
    return normalized.includes('kimi');
}
function prepareChatImageUploads(params) {
    return __awaiter(this, void 0, void 0, function () {
        var client, bucket, uploads;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    assertUploadRequestShape(params.files);
                    client = getS3Client();
                    bucket = getRequiredUploadConfig().bucket;
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: prepare start', {
                        userId: params.userId,
                        bucket: bucket,
                        fileCount: params.files.length,
                        files: params.files.map(function (file) { return ({
                            fileName: normalizeOriginalFileName(file.fileName),
                            contentType: normalizeMimeType(file.contentType),
                            size: Number(file.size || 0),
                        }); }),
                    });
                    return [4 /*yield*/, Promise.all(params.files.map(function (file) { return __awaiter(_this, void 0, void 0, function () {
                            var uploadId, contentType, objectKey, uploadUrl;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        uploadId = (0, node_crypto_1.randomUUID)();
                                        contentType = normalizeMimeType(file.contentType);
                                        objectKey = buildObjectKey(params.userId, uploadId);
                                        return [4 /*yield*/, (0, s3_request_presigner_1.getSignedUrl)(client, new client_s3_1.PutObjectCommand({
                                                Bucket: bucket,
                                                Key: objectKey,
                                                ContentType: contentType,
                                                CacheControl: IMAGE_CACHE_CONTROL,
                                            }), {
                                                expiresIn: PRESIGNED_PUT_TTL_SECONDS,
                                            })];
                                    case 1:
                                        uploadUrl = _a.sent();
                                        return [4 /*yield*/, writePreparedUploadRecord({
                                                uploadId: uploadId,
                                                userId: params.userId,
                                                objectKey: objectKey,
                                                originalFileName: normalizeOriginalFileName(file.fileName),
                                                expectedContentType: contentType,
                                                expectedSize: Number(file.size || 0),
                                                createdAt: new Date().toISOString(),
                                            })];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/, {
                                                uploadId: uploadId,
                                                uploadUrl: uploadUrl,
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': contentType,
                                                },
                                                expiresAt: new Date(Date.now() + PRESIGNED_PUT_TTL_SECONDS * 1000).toISOString(),
                                                maxBytes: exports.CHAT_IMAGE_UPLOAD_MAX_BYTES,
                                            }];
                                }
                            });
                        }); }))];
                case 1:
                    uploads = _a.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: prepare complete', {
                        userId: params.userId,
                        bucket: bucket,
                        fileCount: uploads.length,
                        uploadIds: uploads.map(function (upload) { return upload.uploadId; }),
                        putTtlSeconds: PRESIGNED_PUT_TTL_SECONDS,
                    });
                    return [2 /*return*/, uploads];
            }
        });
    });
}
function discardPreparedChatImageUploads(params) {
    return __awaiter(this, void 0, void 0, function () {
        var uploadIds;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    uploadIds = Array.from(new Set((params.uploadIds || []).map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
                    return [4 /*yield*/, Promise.all(uploadIds.map(function (uploadId) { return __awaiter(_this, void 0, void 0, function () {
                            var record;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, readPreparedUploadRecord(uploadId)];
                                    case 1:
                                        record = _a.sent();
                                        if (!record || record.userId !== params.userId)
                                            return [2 /*return*/];
                                        return [4 /*yield*/, deleteObjectQuietly(record.objectKey)];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, deletePreparedUploadRecord(uploadId)];
                                    case 3:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function finalizePreparedChatImageUploads(params) {
    return __awaiter(this, void 0, void 0, function () {
        var uploadIds, preparedRecords, _i, uploadIds_1, uploadId, record, finalized, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    uploadIds = Array.from(new Set((params.uploadIds || []).map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
                    if (uploadIds.length === 0)
                        return [2 /*return*/, []];
                    if (uploadIds.length > exports.CHAT_IMAGE_UPLOAD_MAX_COUNT) {
                        throw new ChatImageUploadError("You can upload up to ".concat(exports.CHAT_IMAGE_UPLOAD_MAX_COUNT, " images per message."));
                    }
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: finalize start', {
                        userId: params.userId,
                        uploadCount: uploadIds.length,
                        uploadIds: uploadIds,
                    });
                    preparedRecords = [];
                    _i = 0, uploadIds_1 = uploadIds;
                    _a.label = 1;
                case 1:
                    if (!(_i < uploadIds_1.length)) return [3 /*break*/, 4];
                    uploadId = uploadIds_1[_i];
                    return [4 /*yield*/, readPreparedUploadRecord(uploadId)];
                case 2:
                    record = _a.sent();
                    if (!record || record.userId !== params.userId) {
                        throw new ChatImageUploadError('One or more image uploads are invalid or expired.');
                    }
                    preparedRecords.push(record);
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    _a.trys.push([4, 6, , 9]);
                    return [4 /*yield*/, Promise.all(preparedRecords.map(function (record) { return finalizePreparedUploadRecord(record); }))];
                case 5:
                    finalized = _a.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: finalize complete', {
                        userId: params.userId,
                        imageCount: finalized.length,
                        images: finalized.map(function (image) { return ({
                            uploadId: image.uploadId,
                            contentType: image.contentType,
                            size: image.size,
                            width: image.width,
                            height: image.height,
                        }); }),
                    });
                    return [2 /*return*/, finalized.map(toFinalizedChatImageUpload)];
                case 6:
                    error_3 = _a.sent();
                    return [4 /*yield*/, Promise.all(preparedRecords.map(function (record) { return deleteObjectQuietly(record.objectKey); }))];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, Promise.all(preparedRecords.map(function (record) { return deletePreparedUploadRecord(record.uploadId); }))];
                case 8:
                    _a.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: finalize failed', {
                        userId: params.userId,
                        uploadCount: uploadIds.length,
                        error: error_3 instanceof Error ? error_3.message : String(error_3),
                    });
                    throw error_3;
                case 9: return [2 /*return*/];
            }
        });
    });
}
function bindPreparedChatImageUploadsToTask(params) {
    return __awaiter(this, void 0, void 0, function () {
        var uploadIds, preparedRecords, _i, uploadIds_2, uploadId, record, boundImages, _a, preparedRecords_1, record, _b, _c, error_4;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    uploadIds = Array.from(new Set((params.uploadIds || []).map(function (value) { return String(value || '').trim(); }).filter(Boolean)));
                    if (uploadIds.length === 0)
                        return [2 /*return*/, []];
                    if (uploadIds.length > exports.CHAT_IMAGE_UPLOAD_MAX_COUNT) {
                        throw new ChatImageUploadError("You can upload up to ".concat(exports.CHAT_IMAGE_UPLOAD_MAX_COUNT, " images per message."));
                    }
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: bind start', {
                        userId: params.userId,
                        taskId: params.taskId,
                        uploadCount: uploadIds.length,
                        uploadIds: uploadIds,
                    });
                    preparedRecords = [];
                    _i = 0, uploadIds_2 = uploadIds;
                    _d.label = 1;
                case 1:
                    if (!(_i < uploadIds_2.length)) return [3 /*break*/, 4];
                    uploadId = uploadIds_2[_i];
                    return [4 /*yield*/, readPreparedUploadRecord(uploadId)];
                case 2:
                    record = _d.sent();
                    if (!record || record.userId !== params.userId) {
                        throw new ChatImageUploadError('One or more image uploads are invalid or expired.');
                    }
                    preparedRecords.push(record);
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    boundImages = [];
                    _d.label = 5;
                case 5:
                    _d.trys.push([5, 12, , 15]);
                    _a = 0, preparedRecords_1 = preparedRecords;
                    _d.label = 6;
                case 6:
                    if (!(_a < preparedRecords_1.length)) return [3 /*break*/, 9];
                    record = preparedRecords_1[_a];
                    _c = (_b = boundImages).push;
                    return [4 /*yield*/, finalizePreparedUploadRecord(record)];
                case 7:
                    _c.apply(_b, [_d.sent()]);
                    _d.label = 8;
                case 8:
                    _a++;
                    return [3 /*break*/, 6];
                case 9: return [4 /*yield*/, writeTaskBinding({
                        taskId: params.taskId,
                        userId: params.userId,
                        createdAt: new Date().toISOString(),
                        images: boundImages,
                    })];
                case 10:
                    _d.sent();
                    return [4 /*yield*/, Promise.all(preparedRecords.map(function (record) { return deletePreparedUploadRecord(record.uploadId); }))];
                case 11:
                    _d.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: bind complete', {
                        userId: params.userId,
                        taskId: params.taskId,
                        imageCount: boundImages.length,
                        images: boundImages.map(function (image) { return ({
                            uploadId: image.uploadId,
                            contentType: image.contentType,
                            size: image.size,
                            width: image.width,
                            height: image.height,
                        }); }),
                    });
                    return [2 /*return*/, boundImages];
                case 12:
                    error_4 = _d.sent();
                    return [4 /*yield*/, Promise.all(preparedRecords.map(function (record) { return deleteObjectQuietly(record.objectKey); }))];
                case 13:
                    _d.sent();
                    return [4 /*yield*/, Promise.all(preparedRecords.map(function (record) { return deletePreparedUploadRecord(record.uploadId); }))];
                case 14:
                    _d.sent();
                    logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: bind failed', {
                        userId: params.userId,
                        taskId: params.taskId,
                        uploadCount: uploadIds.length,
                        error: error_4 instanceof Error ? error_4.message : String(error_4),
                    });
                    throw error_4;
                case 15: return [2 /*return*/];
            }
        });
    });
}
function buildChatImageMessageAttachments(images) {
    return images.map(function (image, index) { return ({
        id: image.uploadId || "image-".concat(index + 1),
        objectKey: image.objectKey,
        publicObjectKey: image.publicObjectKey || null,
        publicUrl: image.publicUrl || null,
        name: image.originalFileName || "image-".concat(index + 1),
        type: image.contentType,
        size: image.size,
        width: image.width,
        height: image.height,
    }); });
}
function hydrateChatImageAttachmentListForClient(attachments) {
    return __awaiter(this, void 0, void 0, function () {
        var hydratedAttachments;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!Array.isArray(attachments) || attachments.length === 0) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, Promise.all(attachments.map(function (attachment, index) { return __awaiter(_this, void 0, void 0, function () {
                            var objectKey, name, type, baseAttachment, previewUrl, previewUrl, error_5;
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        objectKey = readAttachmentObjectKey(attachment);
                                        name = readAttachmentName(attachment, index);
                                        type = readAttachmentType(attachment);
                                        baseAttachment = {
                                            id: String((attachment === null || attachment === void 0 ? void 0 : attachment.id) || (attachment === null || attachment === void 0 ? void 0 : attachment.uploadId) || "image-".concat(index + 1)),
                                            name: name,
                                            type: type,
                                            size: Number((attachment === null || attachment === void 0 ? void 0 : attachment.size) || 0),
                                            width: (_a = attachment === null || attachment === void 0 ? void 0 : attachment.width) !== null && _a !== void 0 ? _a : null,
                                            height: (_b = attachment === null || attachment === void 0 ? void 0 : attachment.height) !== null && _b !== void 0 ? _b : null,
                                            publicUrl: String((attachment === null || attachment === void 0 ? void 0 : attachment.publicUrl) || '').trim() || null,
                                        };
                                        if (!objectKey) {
                                            previewUrl = String((attachment === null || attachment === void 0 ? void 0 : attachment.previewUrl) || (attachment === null || attachment === void 0 ? void 0 : attachment.url) || '').trim();
                                            return [2 /*return*/, previewUrl ? __assign(__assign({}, baseAttachment), { previewUrl: previewUrl }) : null];
                                        }
                                        _c.label = 1;
                                    case 1:
                                        _c.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, createSignedReadUrl(objectKey, type)];
                                    case 2:
                                        previewUrl = _c.sent();
                                        return [2 /*return*/, __assign(__assign({}, baseAttachment), { previewUrl: previewUrl })];
                                    case 3:
                                        error_5 = _c.sent();
                                        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: failed to sign history attachment', {
                                            attachmentId: baseAttachment.id,
                                            objectKey: objectKey,
                                            error: error_5 instanceof Error ? error_5.message : String(error_5),
                                        });
                                        return [2 /*return*/, null];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 1:
                    hydratedAttachments = _a.sent();
                    return [2 /*return*/, hydratedAttachments.filter(function (attachment) { return Boolean(attachment); })];
            }
        });
    });
}
function hydrateChatImageAttachmentsForClient(data) {
    return __awaiter(this, void 0, void 0, function () {
        var attachments, hydratedAttachments;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attachments = data === null || data === void 0 ? void 0 : data.attachments;
                    if (!Array.isArray(attachments) || attachments.length === 0) {
                        return [2 /*return*/, data];
                    }
                    return [4 /*yield*/, hydrateChatImageAttachmentListForClient(attachments)];
                case 1:
                    hydratedAttachments = _a.sent();
                    return [2 /*return*/, __assign(__assign({}, (data || {})), { attachments: hydratedAttachments })];
            }
        });
    });
}
function hydrateGeneratedChatImageDataForClient(data) {
    return __awaiter(this, void 0, void 0, function () {
        var generatedImage, images, hydratedImages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    generatedImage = data === null || data === void 0 ? void 0 : data.generatedImage;
                    images = generatedImage === null || generatedImage === void 0 ? void 0 : generatedImage.images;
                    if (!generatedImage || !Array.isArray(images) || images.length === 0) {
                        return [2 /*return*/, data];
                    }
                    return [4 /*yield*/, hydrateChatImageAttachmentListForClient(images)];
                case 1:
                    hydratedImages = _a.sent();
                    return [2 /*return*/, __assign(__assign({}, (data || {})), { generatedImage: __assign(__assign({}, generatedImage), { images: hydratedImages }) })];
            }
        });
    });
}
function loadTaskChatImageInputs(taskId) {
    return __awaiter(this, void 0, void 0, function () {
        var binding, bucket, modelInputs;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readTaskBinding(taskId)];
                case 1:
                    binding = _a.sent();
                    if (!binding || !Array.isArray(binding.images) || binding.images.length === 0) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: load skipped', {
                            taskId: taskId,
                            reason: 'no_task_binding',
                        });
                        return [2 /*return*/, []];
                    }
                    bucket = getRequiredUploadConfig().bucket;
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: load start', {
                        taskId: taskId,
                        userId: binding.userId,
                        imageCount: binding.images.length,
                    });
                    return [4 /*yield*/, Promise.all(binding.images.map(function (image, index) { return __awaiter(_this, void 0, void 0, function () {
                            var url;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, createSignedReadUrl(image.objectKey, image.contentType)];
                                    case 1:
                                        url = _a.sent();
                                        return [2 /*return*/, {
                                                url: url,
                                                sourceLabel: buildSignedReadLabel(image, index),
                                            }];
                                }
                            });
                        }); }))];
                case 2:
                    modelInputs = _a.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: load complete', {
                        taskId: taskId,
                        userId: binding.userId,
                        bucket: bucket,
                        imageCount: modelInputs.length,
                        getTtlSeconds: PRESIGNED_GET_TTL_SECONDS,
                    });
                    return [2 /*return*/, modelInputs];
            }
        });
    });
}
function storeGeneratedChatImage(params) {
    return __awaiter(this, void 0, void 0, function () {
        var userId, assistantMessageId, objectKey, publicObjectKey, publicUrl, uploadId, originalFileName;
        return __generator(this, function (_a) {
            userId = String(params.userId || '').trim();
            assistantMessageId = String(params.assistantMessageId || '').trim();
            if (!userId) {
                throw new ChatImageUploadError('Generated image storage requires user id.', 500);
            }
            if (!assistantMessageId) {
                throw new ChatImageUploadError('Generated image storage requires assistant message id.', 500);
            }
            objectKey = buildGeneratedObjectKey(userId, assistantMessageId);
            publicObjectKey = params.publishPublic ? buildGeneratedPublicObjectKey(userId, assistantMessageId) : null;
            publicUrl = publicObjectKey ? buildPublicObjectUrl(publicObjectKey) : null;
            if (params.publishPublic && !publicUrl) {
                throw new ChatImageUploadError('Generated image public URL base is not configured for social publishing.', 503);
            }
            uploadId = "generated-".concat(assistantMessageId);
            originalFileName = normalizeOriginalFileName(params.fileName || 'generated-image');
            return [2 /*return*/, sanitizeImageBufferToTaskRecord({
                    uploadId: uploadId,
                    objectKey: objectKey,
                    publicObjectKey: publicObjectKey,
                    publicUrl: publicUrl,
                    originalFileName: originalFileName,
                    objectBuffer: Buffer.from(params.buffer || []),
                    preferredContentType: params.contentType || undefined,
                })];
        });
    });
}
function cleanupTaskChatImageUploads(taskId_1) {
    return __awaiter(this, arguments, void 0, function (taskId, options) {
        var binding;
        var _a, _b;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, readTaskBinding(taskId)];
                case 1:
                    binding = _c.sent();
                    if (!binding) {
                        logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: cleanup skipped', {
                            taskId: taskId,
                            reason: 'no_task_binding',
                        });
                        return [2 /*return*/];
                    }
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: cleanup start', {
                        taskId: taskId,
                        userId: binding.userId,
                        imageCount: ((_a = binding.images) === null || _a === void 0 ? void 0 : _a.length) || 0,
                        deleteObjects: options.deleteObjects === true,
                    });
                    if (!(options.deleteObjects === true)) return [3 /*break*/, 3];
                    return [4 /*yield*/, Promise.all((binding.images || []).map(function (image) { return deleteObjectQuietly(image.objectKey); }))];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3: return [4 /*yield*/, deleteTaskBinding(taskId)];
                case 4:
                    _c.sent();
                    logger_js_1.logger.info(logRegistry_js_1.LogCode.SYS_INFO, 'Chat image uploads: cleanup complete', {
                        taskId: taskId,
                        userId: binding.userId,
                        imageCount: ((_b = binding.images) === null || _b === void 0 ? void 0 : _b.length) || 0,
                        storageRetained: options.deleteObjects !== true,
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function isChatImageUploadError(error) {
    return error instanceof ChatImageUploadError;
}
