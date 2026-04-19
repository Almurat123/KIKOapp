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
exports.getDailyUsageCount = getDailyUsageCount;
exports.getDailyUsageCountByModel = getDailyUsageCountByModel;
exports.getDailyTotalUsageCount = getDailyTotalUsageCount;
exports.getDailyPaidUsdTotal = getDailyPaidUsdTotal;
exports.insertUsageRecord = insertUsageRecord;
exports.hasBillingBlock = hasBillingBlock;
exports.createBillingBlock = createBillingBlock;
exports.clearBillingBlock = clearBillingBlock;
exports.getDailyAggregates = getDailyAggregates;
exports.findGeneratedImageUsageRecord = findGeneratedImageUsageRecord;
exports.getDailyGeneratedImageReservationSummary = getDailyGeneratedImageReservationSummary;
exports.insertGeneratedImageUsageReservation = insertGeneratedImageUsageReservation;
exports.updateGeneratedImageUsageStatus = updateGeneratedImageUsageStatus;
exports.upsertDailyBilling = upsertDailyBilling;
exports.getDailyBillingStatus = getDailyBillingStatus;
exports.updateDailyBillingStatus = updateDailyBillingStatus;
exports.getActiveBillingConsent = getActiveBillingConsent;
exports.upsertBillingConsent = upsertBillingConsent;
exports.revokeBillingConsent = revokeBillingConsent;
var prisma_js_1 = require("../db/prisma.js");
function getDailyUsageCount(userId, dateUtc, modelCategory) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n          AND model_category = ", "\n    "], ["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n          AND model_category = ", "\n    "])), userId, dateUtc, modelCategory)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, Number(((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.count) || 0)];
            }
        });
    });
}
function getDailyUsageCountByModel(userId, dateUtc, model) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n          AND LOWER(model) = LOWER(", ")\n    "], ["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n          AND LOWER(model) = LOWER(", ")\n    "])), userId, dateUtc, model)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, Number(((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.count) || 0)];
            }
        });
    });
}
function getDailyTotalUsageCount(userId, dateUtc) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "], ["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "])), userId, dateUtc)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, Number(((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.count) || 0)];
            }
        });
    });
}
function getDailyPaidUsdTotal(userId, dateUtc) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        SELECT COALESCE(SUM(total_usd), 0) AS total\n        FROM (\n            SELECT usd_cost AS total_usd\n            FROM billing_usage_ledger\n            WHERE user_id = ", "\n              AND date_utc = ", "::date\n              AND is_free = FALSE\n            UNION ALL\n            SELECT usd_cost AS total_usd\n            FROM generated_image_usage_ledger\n            WHERE user_id = ", "\n              AND date_utc = ", "::date\n              AND status = 'completed'\n              AND billed_image_count > 0\n        ) paid_usage\n    "], ["\n        SELECT COALESCE(SUM(total_usd), 0) AS total\n        FROM (\n            SELECT usd_cost AS total_usd\n            FROM billing_usage_ledger\n            WHERE user_id = ", "\n              AND date_utc = ", "::date\n              AND is_free = FALSE\n            UNION ALL\n            SELECT usd_cost AS total_usd\n            FROM generated_image_usage_ledger\n            WHERE user_id = ", "\n              AND date_utc = ", "::date\n              AND status = 'completed'\n              AND billed_image_count > 0\n        ) paid_usage\n    "])), userId, dateUtc, userId, dateUtc)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, Number(((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.total) || 0)];
            }
        });
    });
}
function insertUsageRecord(params_1) {
    return __awaiter(this, arguments, void 0, function (params, tx) {
        if (tx === void 0) { tx = prisma_js_1.default; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tx.$executeRaw(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n        INSERT INTO billing_usage_ledger (\n            id,\n            assistant_message_id,\n            user_id,\n            model,\n            model_category,\n            prompt_tokens,\n            completion_tokens,\n            total_tokens,\n            tool_calls_count,\n            usd_cost,\n            date_utc,\n            is_free\n        ) VALUES (\n            gen_random_uuid(),\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", "::date,\n            ", "\n        )\n        ON CONFLICT (assistant_message_id) DO NOTHING\n    "], ["\n        INSERT INTO billing_usage_ledger (\n            id,\n            assistant_message_id,\n            user_id,\n            model,\n            model_category,\n            prompt_tokens,\n            completion_tokens,\n            total_tokens,\n            tool_calls_count,\n            usd_cost,\n            date_utc,\n            is_free\n        ) VALUES (\n            gen_random_uuid(),\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", "::date,\n            ", "\n        )\n        ON CONFLICT (assistant_message_id) DO NOTHING\n    "])), params.assistantMessageId, params.userId, params.model, params.modelCategory, params.promptTokens, params.completionTokens, params.totalTokens, params.toolCallsCount, params.usdCost, params.dateUtc, params.isFree)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function hasBillingBlock(userId, dateUtc) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_blocks\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "], ["\n        SELECT COUNT(*)::bigint AS count\n        FROM billing_blocks\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "])), userId, dateUtc)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, Number(((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.count) || 0) > 0];
            }
        });
    });
}
function createBillingBlock(userId, dateUtc, reason) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$executeRaw(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n        INSERT INTO billing_blocks (user_id, date_utc, reason)\n        VALUES (", ", ", ", ", ")\n        ON CONFLICT (user_id, date_utc) DO NOTHING\n    "], ["\n        INSERT INTO billing_blocks (user_id, date_utc, reason)\n        VALUES (", ", ", ", ", ")\n        ON CONFLICT (user_id, date_utc) DO NOTHING\n    "])), userId, dateUtc, reason)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function clearBillingBlock(userId, dateUtc) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$executeRaw(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n        DELETE FROM billing_blocks\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "], ["\n        DELETE FROM billing_blocks\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "])), userId, dateUtc)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getDailyAggregates(dateUtc) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n        SELECT user_id, COALESCE(SUM(total_usd), 0) AS total_usd\n        FROM (\n            SELECT user_id, usd_cost AS total_usd\n            FROM billing_usage_ledger\n            WHERE date_utc = ", "::date\n              AND is_free = FALSE\n            UNION ALL\n            SELECT user_id, usd_cost AS total_usd\n            FROM generated_image_usage_ledger\n            WHERE date_utc = ", "::date\n              AND status = 'completed'\n              AND billed_image_count > 0\n        ) paid_usage\n        GROUP BY user_id\n    "], ["\n        SELECT user_id, COALESCE(SUM(total_usd), 0) AS total_usd\n        FROM (\n            SELECT user_id, usd_cost AS total_usd\n            FROM billing_usage_ledger\n            WHERE date_utc = ", "::date\n              AND is_free = FALSE\n            UNION ALL\n            SELECT user_id, usd_cost AS total_usd\n            FROM generated_image_usage_ledger\n            WHERE date_utc = ", "::date\n              AND status = 'completed'\n              AND billed_image_count > 0\n        ) paid_usage\n        GROUP BY user_id\n    "])), dateUtc, dateUtc)];
                case 1:
                    rows = _a.sent();
                    return [2 /*return*/, rows.map(function (row) { return ({
                            user_id: row.user_id,
                            total_usd: Number(row.total_usd || 0)
                        }); })];
            }
        });
    });
}
function findGeneratedImageUsageRecord(requestId) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n        SELECT\n            request_id,\n            user_id,\n            provider,\n            model,\n            model_family,\n            quality,\n            status,\n            image_count,\n            free_image_count,\n            billed_image_count,\n            usd_cost,\n            date_utc::text AS date_utc,\n            context_type,\n            context_id,\n            source,\n            failure_reason\n        FROM generated_image_usage_ledger\n        WHERE request_id = ", "\n        LIMIT 1\n    "], ["\n        SELECT\n            request_id,\n            user_id,\n            provider,\n            model,\n            model_family,\n            quality,\n            status,\n            image_count,\n            free_image_count,\n            billed_image_count,\n            usd_cost,\n            date_utc::text AS date_utc,\n            context_type,\n            context_id,\n            source,\n            failure_reason\n        FROM generated_image_usage_ledger\n        WHERE request_id = ", "\n        LIMIT 1\n    "])), requestId)];
                case 1:
                    rows = _a.sent();
                    row = rows[0];
                    if (!row)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            requestId: row.request_id,
                            userId: row.user_id,
                            provider: row.provider,
                            model: row.model,
                            modelFamily: row.model_family,
                            quality: row.quality,
                            status: row.status,
                            imageCount: Number(row.image_count || 0),
                            freeImageCount: Number(row.free_image_count || 0),
                            billedImageCount: Number(row.billed_image_count || 0),
                            usdCost: Number(row.usd_cost || 0),
                            dateUtc: row.date_utc,
                            contextType: row.context_type,
                            contextId: row.context_id,
                            source: row.source || null,
                            failureReason: row.failure_reason || null,
                        }];
            }
        });
    });
}
function getDailyGeneratedImageReservationSummary(params) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n        SELECT\n            COALESCE(SUM(image_count), 0)::bigint AS image_count,\n            COALESCE(SUM(free_image_count), 0)::bigint AS free_image_count,\n            COALESCE(SUM(billed_image_count), 0)::bigint AS billed_image_count,\n            COALESCE(SUM(usd_cost), 0) AS usd_cost\n        FROM generated_image_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n          AND model_family = ", "\n          AND status IN ('reserved', 'completed')\n    "], ["\n        SELECT\n            COALESCE(SUM(image_count), 0)::bigint AS image_count,\n            COALESCE(SUM(free_image_count), 0)::bigint AS free_image_count,\n            COALESCE(SUM(billed_image_count), 0)::bigint AS billed_image_count,\n            COALESCE(SUM(usd_cost), 0) AS usd_cost\n        FROM generated_image_usage_ledger\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n          AND model_family = ", "\n          AND status IN ('reserved', 'completed')\n    "])), params.userId, params.dateUtc, params.modelFamily)];
                case 1:
                    rows = _a.sent();
                    row = rows[0];
                    return [2 /*return*/, {
                            imageCount: Number((row === null || row === void 0 ? void 0 : row.image_count) || 0),
                            freeImageCount: Number((row === null || row === void 0 ? void 0 : row.free_image_count) || 0),
                            billedImageCount: Number((row === null || row === void 0 ? void 0 : row.billed_image_count) || 0),
                            usdCost: Number((row === null || row === void 0 ? void 0 : row.usd_cost) || 0),
                        }];
            }
        });
    });
}
function insertGeneratedImageUsageReservation(params_1) {
    return __awaiter(this, arguments, void 0, function (params, tx) {
        if (tx === void 0) { tx = prisma_js_1.default; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tx.$executeRaw(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n        INSERT INTO generated_image_usage_ledger (\n            id,\n            request_id,\n            user_id,\n            provider,\n            model,\n            model_family,\n            quality,\n            status,\n            image_count,\n            free_image_count,\n            billed_image_count,\n            usd_cost,\n            date_utc,\n            context_type,\n            context_id,\n            source\n        ) VALUES (\n            gen_random_uuid(),\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", "::date,\n            ", ",\n            ", ",\n            ", "\n        )\n        ON CONFLICT (request_id) DO NOTHING\n    "], ["\n        INSERT INTO generated_image_usage_ledger (\n            id,\n            request_id,\n            user_id,\n            provider,\n            model,\n            model_family,\n            quality,\n            status,\n            image_count,\n            free_image_count,\n            billed_image_count,\n            usd_cost,\n            date_utc,\n            context_type,\n            context_id,\n            source\n        ) VALUES (\n            gen_random_uuid(),\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", "::date,\n            ", ",\n            ", ",\n            ", "\n        )\n        ON CONFLICT (request_id) DO NOTHING\n    "])), params.requestId, params.userId, params.provider, params.model, params.modelFamily, params.quality, params.status || 'reserved', params.imageCount, params.freeImageCount, params.billedImageCount, params.usdCost, params.dateUtc, params.contextType, params.contextId, params.source || null)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function updateGeneratedImageUsageStatus(params_1) {
    return __awaiter(this, arguments, void 0, function (params, tx) {
        if (tx === void 0) { tx = prisma_js_1.default; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tx.$executeRaw(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\n        UPDATE generated_image_usage_ledger\n        SET status = ", ",\n            failure_reason = ", ",\n            updated_at = NOW()\n        WHERE request_id = ", "\n    "], ["\n        UPDATE generated_image_usage_ledger\n        SET status = ", ",\n            failure_reason = ", ",\n            updated_at = NOW()\n        WHERE request_id = ", "\n    "])), params.status, params.failureReason || null, params.requestId)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function upsertDailyBilling(params_1) {
    return __awaiter(this, arguments, void 0, function (params, tx) {
        if (tx === void 0) { tx = prisma_js_1.default; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tx.$executeRaw(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\n        INSERT INTO daily_billing (\n            user_id,\n            date_utc,\n            total_usd,\n            token_price_usd,\n            tokens_due,\n            token_address,\n            chain_id,\n            status\n        ) VALUES (\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            'pending'\n        )\n        ON CONFLICT (user_id, date_utc) DO UPDATE SET\n            total_usd = EXCLUDED.total_usd,\n            token_price_usd = EXCLUDED.token_price_usd,\n            tokens_due = EXCLUDED.tokens_due,\n            token_address = EXCLUDED.token_address,\n            chain_id = EXCLUDED.chain_id,\n            updated_at = NOW()\n    "], ["\n        INSERT INTO daily_billing (\n            user_id,\n            date_utc,\n            total_usd,\n            token_price_usd,\n            tokens_due,\n            token_address,\n            chain_id,\n            status\n        ) VALUES (\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            'pending'\n        )\n        ON CONFLICT (user_id, date_utc) DO UPDATE SET\n            total_usd = EXCLUDED.total_usd,\n            token_price_usd = EXCLUDED.token_price_usd,\n            tokens_due = EXCLUDED.tokens_due,\n            token_address = EXCLUDED.token_address,\n            chain_id = EXCLUDED.chain_id,\n            updated_at = NOW()\n    "])), params.userId, params.dateUtc, params.totalUsd, params.tokenPriceUsd, params.tokensDue, params.tokenAddress, params.chainId)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getDailyBillingStatus(userId, dateUtc) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_15 || (templateObject_15 = __makeTemplateObject(["\n        SELECT status, tx_hash\n        FROM daily_billing\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n        LIMIT 1\n    "], ["\n        SELECT status, tx_hash\n        FROM daily_billing\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n        LIMIT 1\n    "])), userId, dateUtc)];
                case 1:
                    rows = _a.sent();
                    row = rows[0];
                    if (!row)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            status: row.status,
                            txHash: row.tx_hash
                        }];
            }
        });
    });
}
function updateDailyBillingStatus(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$executeRaw(templateObject_16 || (templateObject_16 = __makeTemplateObject(["\n        UPDATE daily_billing\n        SET status = ", ",\n            attempts = ", ",\n            tx_hash = ", ",\n            failure_reason = ", ",\n            last_attempt_at = NOW(),\n            updated_at = NOW()\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "], ["\n        UPDATE daily_billing\n        SET status = ", ",\n            attempts = ", ",\n            tx_hash = ", ",\n            failure_reason = ", ",\n            last_attempt_at = NOW(),\n            updated_at = NOW()\n        WHERE user_id = ", "\n          AND date_utc = ", "::date\n    "])), params.status, params.attempts, params.txHash || null, params.failureReason || null, params.userId, params.dateUtc)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getActiveBillingConsent(userId, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$queryRaw(templateObject_17 || (templateObject_17 = __makeTemplateObject(["\n        SELECT id, terms_version\n        FROM billing_consents\n        WHERE user_id = ", "\n          AND chain_id = ", "\n          AND status = 'active'\n        LIMIT 1\n    "], ["\n        SELECT id, terms_version\n        FROM billing_consents\n        WHERE user_id = ", "\n          AND chain_id = ", "\n          AND status = 'active'\n        LIMIT 1\n    "])), userId, chainId)];
                case 1:
                    rows = _a.sent();
                    return [2 /*return*/, rows[0] || null];
            }
        });
    });
}
function upsertBillingConsent(params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$executeRaw(templateObject_18 || (templateObject_18 = __makeTemplateObject(["\n        INSERT INTO billing_consents (\n            user_id,\n            wallet_address,\n            chain_id,\n            auth_key_id,\n            terms_version,\n            status,\n            consented_at,\n            source\n        ) VALUES (\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            'active',\n            NOW(),\n            ", "\n        )\n        ON CONFLICT (user_id, chain_id) DO UPDATE SET\n            wallet_address = EXCLUDED.wallet_address,\n            auth_key_id = EXCLUDED.auth_key_id,\n            terms_version = EXCLUDED.terms_version,\n            status = 'active',\n            consented_at = NOW(),\n            revoked_at = NULL,\n            source = EXCLUDED.source,\n            updated_at = NOW()\n    "], ["\n        INSERT INTO billing_consents (\n            user_id,\n            wallet_address,\n            chain_id,\n            auth_key_id,\n            terms_version,\n            status,\n            consented_at,\n            source\n        ) VALUES (\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            ", ",\n            'active',\n            NOW(),\n            ", "\n        )\n        ON CONFLICT (user_id, chain_id) DO UPDATE SET\n            wallet_address = EXCLUDED.wallet_address,\n            auth_key_id = EXCLUDED.auth_key_id,\n            terms_version = EXCLUDED.terms_version,\n            status = 'active',\n            consented_at = NOW(),\n            revoked_at = NULL,\n            source = EXCLUDED.source,\n            updated_at = NOW()\n    "])), params.userId, params.walletAddress, params.chainId, params.authKeyId || null, params.termsVersion, params.source || null)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function revokeBillingConsent(userId, chainId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.$executeRaw(templateObject_19 || (templateObject_19 = __makeTemplateObject(["\n        UPDATE billing_consents\n        SET status = 'revoked',\n            revoked_at = NOW(),\n            updated_at = NOW()\n        WHERE user_id = ", "\n          AND chain_id = ", "\n    "], ["\n        UPDATE billing_consents\n        SET status = 'revoked',\n            revoked_at = NOW(),\n            updated_at = NOW()\n        WHERE user_id = ", "\n          AND chain_id = ", "\n    "])), userId, chainId)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19;
