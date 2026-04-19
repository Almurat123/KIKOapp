"use strict";
// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: generated-image models need a stricter safety boundary than ordinary
//         chat because unsafe imagery can become a durable public Farcaster
//         asset. The strict policy must stay out of normal chat paths.
// Goal: require fail-closed moderation before prompt submission, after image
//       generation, and before social publication.
// Owns: generated-image safety stage orchestration and block/error semantics.
// Does Not Own: image model invocation, R2 storage, chat worker moderation, or
//               Farcaster cast publication.
// Design Language:
// - generated-image prompts must be checked before provider calls
// - generated outputs must be checked while still private or quarantined
// - Farcaster publish payloads must be checked immediately before exposure
// - moderation outage blocks generated-image flow instead of falling back open
// - normal chat must not import or depend on this strict generated-image owner
// Document Provenance:
// - Source: OpenAI Moderation guide and Moderations API OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: strict generated-image text + image_url moderation stages
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md
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
exports.__generatedImageSafetyTest = exports.GeneratedImageSafetyError = void 0;
exports.evaluateGeneratedImageSafety = evaluateGeneratedImageSafety;
exports.isGeneratedImageSafetyError = isGeneratedImageSafetyError;
exports.assertGeneratedImagePromptSafe = assertGeneratedImagePromptSafe;
exports.assertGeneratedImageReferenceInputSafe = assertGeneratedImageReferenceInputSafe;
exports.assertGeneratedImageOutputSafe = assertGeneratedImageOutputSafe;
exports.assertGeneratedImagePublishSafe = assertGeneratedImagePublishSafe;
var moderationClient_js_1 = require("./moderationClient.js");
var GeneratedImageSafetyError = /** @class */ (function (_super) {
    __extends(GeneratedImageSafetyError, _super);
    function GeneratedImageSafetyError(params) {
        var _this = _super.call(this, params.message || buildBlockedMessage(params.stage, params.categories || [])) || this;
        _this.statusCode = 400;
        _this.code = 'GENERATED_IMAGE_SAFETY_BLOCKED';
        _this.name = 'GeneratedImageSafetyError';
        _this.stage = params.stage;
        _this.categories = params.categories || [];
        _this.moderation = params.moderation || null;
        return _this;
    }
    return GeneratedImageSafetyError;
}(Error));
exports.GeneratedImageSafetyError = GeneratedImageSafetyError;
function normalizeText(value) {
    return String(value || '').trim();
}
function normalizeImageUrls(values) {
    return (Array.isArray(values) ? values : [])
        .map(function (value) { return String(value || '').trim(); })
        .filter(Boolean);
}
function extractFlaggedCategories(moderation) {
    var _a, _b, _c;
    var categories = (((_b = (_a = moderation === null || moderation === void 0 ? void 0 : moderation.checks) === null || _a === void 0 ? void 0 : _a.openai) === null || _b === void 0 ? void 0 : _b.categories)
        || ((_c = moderation === null || moderation === void 0 ? void 0 : moderation.verification) === null || _c === void 0 ? void 0 : _c.categories)
        || {});
    return Object.entries(categories)
        .filter(function (_a) {
        var flagged = _a[1];
        return Boolean(flagged);
    })
        .map(function (_a) {
        var category = _a[0];
        return category;
    });
}
function buildBlockedMessage(stage, categories) {
    var suffix = categories.length > 0 ? " (".concat(categories.join(', '), ")") : '';
    return "Generated image ".concat(stage, " blocked by safety policy").concat(suffix);
}
function assertCheckablePayload(stage, text, imageUrls) {
    if (text || imageUrls.length > 0)
        return;
    throw new GeneratedImageSafetyError({
        stage: stage,
        message: 'Generated image safety check requires text or image input',
        categories: ['empty_image_generation_moderation_input'],
        moderation: null,
    });
}
function evaluateGeneratedImageSafety(request) {
    return __awaiter(this, void 0, void 0, function () {
        var text, imageUrls, moderation, categories;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    text = normalizeText(request.text);
                    imageUrls = normalizeImageUrls(request.imageUrls);
                    assertCheckablePayload(request.stage, text, imageUrls);
                    return [4 /*yield*/, moderationClient_js_1.moderationClient.moderateGeneratedImage({
                            text: text,
                            imageUrls: imageUrls,
                            stage: request.stage,
                            userId: request.userId,
                            sessionId: request.sessionId,
                            model: request.model,
                            context: {
                                assetId: request.assetId || undefined,
                                provider: request.provider || undefined,
                                source: request.source || undefined,
                            },
                        })];
                case 1:
                    moderation = _a.sent();
                    if (moderation.safe !== true || moderation.action === 'block') {
                        categories = extractFlaggedCategories(moderation);
                        throw new GeneratedImageSafetyError({
                            stage: request.stage,
                            categories: categories,
                            moderation: moderation,
                        });
                    }
                    return [2 /*return*/, {
                            safe: true,
                            stage: request.stage,
                            moderation: moderation,
                        }];
            }
        });
    });
}
function isGeneratedImageSafetyError(error) {
    return error instanceof GeneratedImageSafetyError
        || String((error === null || error === void 0 ? void 0 : error.code) || '') === 'GENERATED_IMAGE_SAFETY_BLOCKED';
}
function assertGeneratedImagePromptSafe(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, evaluateGeneratedImageSafety(__assign(__assign({}, params), { stage: 'prompt' }))];
        });
    });
}
function assertGeneratedImageReferenceInputSafe(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, evaluateGeneratedImageSafety(__assign(__assign({}, params), { stage: 'reference_input' }))];
        });
    });
}
function assertGeneratedImageOutputSafe(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, evaluateGeneratedImageSafety(__assign(__assign({}, params), { stage: 'generated_output' }))];
        });
    });
}
function assertGeneratedImagePublishSafe(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, evaluateGeneratedImageSafety(__assign(__assign({}, params), { stage: 'publish' }))];
        });
    });
}
exports.__generatedImageSafetyTest = {
    extractFlaggedCategories: extractFlaggedCategories,
    normalizeImageUrls: normalizeImageUrls,
};
