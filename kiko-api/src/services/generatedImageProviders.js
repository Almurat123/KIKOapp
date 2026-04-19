"use strict";
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImageWithProvider = generateImageWithProvider;
exports.isGeneratedImageProviderError = isGeneratedImageProviderError;
var node_buffer_1 = require("node:buffer");
var PROVIDER_TIMEOUT_MS = Math.max(15000, Number(process.env.GENERATED_IMAGE_PROVIDER_TIMEOUT_MS || '120000'));
var OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
var XAI_IMAGE_ENDPOINT = 'https://api.x.ai/v1/images/generations';
var OPENAI_PARTIAL_IMAGE_COUNT = 2;
var GeneratedImageProviderError = /** @class */ (function (_super) {
    __extends(GeneratedImageProviderError, _super);
    function GeneratedImageProviderError(message, code, statusCode) {
        if (code === void 0) { code = 'GENERATED_IMAGE_PROVIDER_FAILED'; }
        if (statusCode === void 0) { statusCode = 502; }
        var _this = _super.call(this, message) || this;
        _this.name = 'GeneratedImageProviderError';
        _this.code = code;
        _this.statusCode = statusCode;
        return _this;
    }
    return GeneratedImageProviderError;
}(Error));
function createAbortController(timeoutMs) {
    var _a, _b;
    var controller = new AbortController();
    (_b = (_a = setTimeout(function () { return controller.abort(); }, timeoutMs)).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    return controller;
}
function parseJsonSafely(response) {
    return __awaiter(this, void 0, void 0, function () {
        var raw;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, response.text()];
                case 1:
                    raw = _a.sent();
                    if (!raw)
                        return [2 /*return*/, {}];
                    try {
                        return [2 /*return*/, JSON.parse(raw)];
                    }
                    catch (_b) {
                        return [2 /*return*/, { message: raw }];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function extractProviderErrorMessage(response, payload, fallbackLabel) {
    var _a;
    var directError = typeof (payload === null || payload === void 0 ? void 0 : payload.error) === 'string'
        ? payload.error
        : typeof (payload === null || payload === void 0 ? void 0 : payload.message) === 'string'
            ? payload.message
            : typeof ((_a = payload === null || payload === void 0 ? void 0 : payload.error) === null || _a === void 0 ? void 0 : _a.message) === 'string'
                ? payload.error.message
                : '';
    var code = typeof (payload === null || payload === void 0 ? void 0 : payload.code) === 'string' ? payload.code.trim() : '';
    var requestId = String(response.headers.get('x-request-id')
        || response.headers.get('request-id')
        || response.headers.get('cf-ray')
        || '').trim();
    var detail = directError.trim() || "".concat(fallbackLabel, " failed (").concat(response.status, ")");
    var suffixes = [
        code && code !== directError ? code : '',
        requestId ? "request ".concat(requestId) : '',
    ].filter(Boolean);
    return suffixes.length > 0 ? "".concat(detail, " (").concat(suffixes.join(', '), ")") : detail;
}
function inferContentTypeFromUrl(url) {
    var normalized = String(url || '').toLowerCase();
    if (normalized.includes('.webp'))
        return 'image/webp';
    if (normalized.includes('.jpg') || normalized.includes('.jpeg'))
        return 'image/jpeg';
    return 'image/png';
}
function fetchBinaryFromUrl(url) {
    return __awaiter(this, void 0, void 0, function () {
        var controller, response, arrayBuffer, contentType;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    controller = createAbortController(PROVIDER_TIMEOUT_MS);
                    return [4 /*yield*/, fetch(url, {
                            method: 'GET',
                            signal: controller.signal,
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new GeneratedImageProviderError("Failed to fetch generated image asset (".concat(response.status, ")"));
                    }
                    return [4 /*yield*/, response.arrayBuffer()];
                case 2:
                    arrayBuffer = _a.sent();
                    contentType = String(response.headers.get('content-type') || '').trim().toLowerCase() || inferContentTypeFromUrl(url);
                    return [2 /*return*/, {
                            buffer: node_buffer_1.Buffer.from(arrayBuffer),
                            contentType: contentType.startsWith('image/') ? contentType : inferContentTypeFromUrl(url),
                        }];
            }
        });
    });
}
function parseSseBlock(rawBlock) {
    var lines = rawBlock
        .split('\n')
        .map(function (line) { return line.trimEnd(); });
    var event = 'message';
    var dataLines = [];
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        if (!line)
            continue;
        if (line.startsWith(':'))
            continue;
        if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim();
            continue;
        }
        if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trimStart());
        }
    }
    if (dataLines.length === 0)
        return null;
    return {
        event: event,
        data: dataLines.join('\n'),
    };
}
function iterateSseBlocks(stream) {
    return __asyncGenerator(this, arguments, function iterateSseBlocks_1() {
        var reader, decoder, buffer, _a, done, value, boundary, rawBlock, parsed, tail, parsed;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    reader = stream.getReader();
                    decoder = new TextDecoder();
                    buffer = '';
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 13, 14]);
                    _b.label = 2;
                case 2:
                    if (!true) return [3 /*break*/, 9];
                    return [4 /*yield*/, __await(reader.read())];
                case 3:
                    _a = _b.sent(), done = _a.done, value = _a.value;
                    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
                    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    boundary = buffer.indexOf('\n\n');
                    _b.label = 4;
                case 4:
                    if (!(boundary >= 0)) return [3 /*break*/, 8];
                    rawBlock = buffer.slice(0, boundary).trim();
                    buffer = buffer.slice(boundary + 2);
                    if (!rawBlock) return [3 /*break*/, 7];
                    parsed = parseSseBlock(rawBlock);
                    if (!parsed) return [3 /*break*/, 7];
                    return [4 /*yield*/, __await(parsed)];
                case 5: return [4 /*yield*/, _b.sent()];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7:
                    boundary = buffer.indexOf('\n\n');
                    return [3 /*break*/, 4];
                case 8:
                    if (done)
                        return [3 /*break*/, 9];
                    return [3 /*break*/, 2];
                case 9:
                    tail = buffer.trim();
                    if (!tail) return [3 /*break*/, 12];
                    parsed = parseSseBlock(tail);
                    if (!parsed) return [3 /*break*/, 12];
                    return [4 /*yield*/, __await(parsed)];
                case 10: return [4 /*yield*/, _b.sent()];
                case 11:
                    _b.sent();
                    _b.label = 12;
                case 12: return [3 /*break*/, 14];
                case 13:
                    reader.releaseLock();
                    return [7 /*endfinally*/];
                case 14: return [2 /*return*/];
            }
        });
    });
}
function generateOpenAiImage(prompt, quality, onProgress) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, controller, response, payload_1, normalizedQuality, contentType, completedImageBuffer, revisedPrompt, _a, _b, _c, chunk, eventPayload, eventType, partialImageIndex, b64_1, e_1_1, payload, item, b64, url, downloaded;
        var _d, e_1, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    apiKey = String(process.env.OPENAI_API_KEY || '').trim();
                    if (!apiKey) {
                        throw new GeneratedImageProviderError('OpenAI image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
                    }
                    controller = createAbortController(PROVIDER_TIMEOUT_MS);
                    return [4 /*yield*/, fetch(OPENAI_IMAGE_ENDPOINT, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: "Bearer ".concat(apiKey),
                            },
                            body: JSON.stringify(__assign({ model: 'gpt-image-1.5', prompt: prompt, size: '1024x1024', quality: quality === 'low' || quality === 'high' ? quality : 'medium', moderation: 'auto', output_format: 'png', n: 1 }, (onProgress ? {
                                stream: true,
                                partial_images: OPENAI_PARTIAL_IMAGE_COUNT,
                            } : {}))),
                            signal: controller.signal,
                        })];
                case 1:
                    response = _g.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, parseJsonSafely(response)];
                case 2:
                    payload_1 = _g.sent();
                    throw new GeneratedImageProviderError(extractProviderErrorMessage(response, payload_1, 'OpenAI image generation'));
                case 3:
                    normalizedQuality = quality === 'low' || quality === 'high' ? quality : 'medium';
                    contentType = String(response.headers.get('content-type') || '').toLowerCase();
                    if (!(onProgress && contentType.includes('text/event-stream'))) return [3 /*break*/, 19];
                    if (!response.body) {
                        throw new GeneratedImageProviderError('OpenAI image generation returned an empty event stream.');
                    }
                    completedImageBuffer = null;
                    revisedPrompt = null;
                    _g.label = 4;
                case 4:
                    _g.trys.push([4, 12, 13, 18]);
                    _a = true, _b = __asyncValues(iterateSseBlocks(response.body));
                    _g.label = 5;
                case 5: return [4 /*yield*/, _b.next()];
                case 6:
                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 11];
                    _f = _c.value;
                    _a = false;
                    chunk = _f;
                    if (chunk.data === '[DONE]') {
                        return [3 /*break*/, 10];
                    }
                    eventPayload = null;
                    try {
                        eventPayload = JSON.parse(chunk.data);
                    }
                    catch (_h) {
                        return [3 /*break*/, 10];
                    }
                    eventType = String((eventPayload === null || eventPayload === void 0 ? void 0 : eventPayload.type) || chunk.event || '').trim();
                    if (!(eventType === 'image_generation.partial_image')) return [3 /*break*/, 9];
                    partialImageIndex = Number(eventPayload === null || eventPayload === void 0 ? void 0 : eventPayload.partial_image_index);
                    if (!(Number.isFinite(partialImageIndex) && partialImageIndex >= 0)) return [3 /*break*/, 8];
                    return [4 /*yield*/, onProgress({
                            type: 'partial_image',
                            provider: 'openai',
                            model: 'gpt-image-1.5',
                            quality: normalizedQuality,
                            partialImageIndex: partialImageIndex,
                            partialImageCount: OPENAI_PARTIAL_IMAGE_COUNT,
                        })];
                case 7:
                    _g.sent();
                    _g.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    if (eventType === 'image_generation.completed') {
                        b64_1 = String((eventPayload === null || eventPayload === void 0 ? void 0 : eventPayload.b64_json) || '').trim();
                        if (b64_1) {
                            completedImageBuffer = node_buffer_1.Buffer.from(b64_1, 'base64');
                        }
                        revisedPrompt = typeof (eventPayload === null || eventPayload === void 0 ? void 0 : eventPayload.revised_prompt) === 'string'
                            ? eventPayload.revised_prompt
                            : null;
                    }
                    _g.label = 10;
                case 10:
                    _a = true;
                    return [3 /*break*/, 5];
                case 11: return [3 /*break*/, 18];
                case 12:
                    e_1_1 = _g.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 18];
                case 13:
                    _g.trys.push([13, , 16, 17]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 15];
                    return [4 /*yield*/, _e.call(_b)];
                case 14:
                    _g.sent();
                    _g.label = 15;
                case 15: return [3 /*break*/, 17];
                case 16:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 17: return [7 /*endfinally*/];
                case 18:
                    if (!completedImageBuffer) {
                        throw new GeneratedImageProviderError('OpenAI image generation stream completed without a final image payload.');
                    }
                    return [2 /*return*/, {
                            provider: 'openai',
                            model: 'gpt-image-1.5',
                            quality: normalizedQuality,
                            imageBuffer: completedImageBuffer,
                            contentType: 'image/png',
                            revisedPrompt: revisedPrompt,
                            supportsProgressiveReveal: true,
                        }];
                case 19: return [4 /*yield*/, parseJsonSafely(response)];
                case 20:
                    payload = _g.sent();
                    item = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.data) ? payload.data[0] : null;
                    b64 = String((item === null || item === void 0 ? void 0 : item.b64_json) || '').trim();
                    if (b64) {
                        return [2 /*return*/, {
                                provider: 'openai',
                                model: 'gpt-image-1.5',
                                quality: normalizedQuality,
                                imageBuffer: node_buffer_1.Buffer.from(b64, 'base64'),
                                contentType: 'image/png',
                                revisedPrompt: typeof (item === null || item === void 0 ? void 0 : item.revised_prompt) === 'string' ? item.revised_prompt : null,
                                supportsProgressiveReveal: true,
                            }];
                    }
                    url = String((item === null || item === void 0 ? void 0 : item.url) || '').trim();
                    if (!url) {
                        throw new GeneratedImageProviderError('OpenAI image generation returned no image payload.');
                    }
                    return [4 /*yield*/, fetchBinaryFromUrl(url)];
                case 21:
                    downloaded = _g.sent();
                    return [2 /*return*/, {
                            provider: 'openai',
                            model: 'gpt-image-1.5',
                            quality: normalizedQuality,
                            imageBuffer: downloaded.buffer,
                            contentType: downloaded.contentType,
                            revisedPrompt: typeof (item === null || item === void 0 ? void 0 : item.revised_prompt) === 'string' ? item.revised_prompt : null,
                            supportsProgressiveReveal: true,
                        }];
            }
        });
    });
}
function generateXaiImage(prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, controller, response, payload, item, url, b64, downloaded;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiKey = String(process.env.XAI_API_KEY || '').trim();
                    if (!apiKey) {
                        throw new GeneratedImageProviderError('xAI image generation is not configured on the server.', 'GENERATED_IMAGE_PROVIDER_NOT_CONFIGURED', 503);
                    }
                    controller = createAbortController(PROVIDER_TIMEOUT_MS);
                    return [4 /*yield*/, fetch(XAI_IMAGE_ENDPOINT, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: "Bearer ".concat(apiKey),
                            },
                            body: JSON.stringify({
                                model: 'grok-imagine-image',
                                prompt: prompt,
                                n: 1,
                                aspect_ratio: '1:1',
                                response_format: 'url',
                            }),
                            signal: controller.signal,
                        })];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, parseJsonSafely(response)];
                case 2:
                    payload = _a.sent();
                    if (!response.ok) {
                        throw new GeneratedImageProviderError(extractProviderErrorMessage(response, payload, 'xAI image generation'));
                    }
                    item = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.data) ? payload.data[0] : null;
                    url = String((item === null || item === void 0 ? void 0 : item.url) || '').trim();
                    if (!url) {
                        b64 = String((item === null || item === void 0 ? void 0 : item.b64_json) || '').trim();
                        if (!b64) {
                            throw new GeneratedImageProviderError('xAI image generation returned no image payload.');
                        }
                        return [2 /*return*/, {
                                provider: 'xai',
                                model: 'grok-imagine-image',
                                quality: 'normal',
                                imageBuffer: node_buffer_1.Buffer.from(b64, 'base64'),
                                contentType: 'image/png',
                                revisedPrompt: null,
                                supportsProgressiveReveal: false,
                            }];
                    }
                    return [4 /*yield*/, fetchBinaryFromUrl(url)];
                case 3:
                    downloaded = _a.sent();
                    return [2 /*return*/, {
                            provider: 'xai',
                            model: 'grok-imagine-image',
                            quality: 'normal',
                            imageBuffer: downloaded.buffer,
                            contentType: downloaded.contentType,
                            revisedPrompt: null,
                            supportsProgressiveReveal: false,
                        }];
            }
        });
    });
}
function generateImageWithProvider(params) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt;
        return __generator(this, function (_a) {
            prompt = String(params.prompt || '').trim();
            if (!prompt) {
                throw new GeneratedImageProviderError('Generated image prompt is required.', 'GENERATED_IMAGE_PROMPT_REQUIRED', 400);
            }
            if (params.provider === 'openai' || params.model === 'gpt-image-1.5') {
                return [2 /*return*/, generateOpenAiImage(prompt, params.quality === 'low' || params.quality === 'high' ? params.quality : 'medium', params.onProgress)];
            }
            if (params.provider === 'xai' || params.model === 'grok-imagine-image') {
                return [2 /*return*/, generateXaiImage(prompt)];
            }
            throw new GeneratedImageProviderError('Unsupported generated image provider model.', 'GENERATED_IMAGE_MODEL_NOT_SUPPORTED', 400);
        });
    });
}
function isGeneratedImageProviderError(error) {
    return error instanceof GeneratedImageProviderError;
}
