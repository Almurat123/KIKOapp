"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUtcDateString = getUtcDateString;
exports.normalizeModelForPricing = normalizeModelForPricing;
exports.getBillingCategory = getBillingCategory;
exports.getDailyFreeQuota = getDailyFreeQuota;
exports.getDailyFreeQuotaForModel = getDailyFreeQuotaForModel;
exports.computeXaiToolInvocationUsd = computeXaiToolInvocationUsd;
exports.getReasoningTokens = getReasoningTokens;
exports.computeTotalTokens = computeTotalTokens;
exports.computeUsdCost = computeUsdCost;
var env_js_1 = require("../../config/env.js");
var logger_js_1 = require("../../utils/logger.js");
var logRegistry_js_1 = require("../../config/logRegistry.js");
function getUtcDateString(date) {
    if (date === void 0) { date = new Date(); }
    var year = date.getUTCFullYear();
    var month = String(date.getUTCMonth() + 1).padStart(2, '0');
    var day = String(date.getUTCDate()).padStart(2, '0');
    return "".concat(year, "-").concat(month, "-").concat(day);
}
function normalizeModelForPricing(model) {
    if (!model)
        return '';
    return model.toLowerCase();
}
function getBillingCategory(model) {
    var normalized = normalizeModelForPricing(model);
    if (env_js_1.env.billing.freeModels.includes(normalized))
        return 'free';
    if (normalized.includes('kimi') || normalized.includes('moonshotai/'))
        return 'free';
    if (env_js_1.env.billing.premiumModels.includes(normalized))
        return 'premium';
    if (normalized.includes('grok'))
        return 'premium';
    if (normalized.startsWith('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4'))
        return 'premium';
    return 'other';
}
function getDailyFreeQuota(category) {
    if (category === 'free')
        return env_js_1.env.billing.dailyFreeModelLimit;
    if (category === 'premium')
        return env_js_1.env.billing.dailyFreePremium;
    return 0;
}
function getDailyFreeQuotaForModel(model) {
    return getDailyFreeQuota(getBillingCategory(model));
}
// xAI official tool invocation pricing (USD per 1 call)
// Source: https://docs.x.ai/developers/models#tool-invocation-costs
var XAI_TOOL_PRICE_USD = {
    web_search: 0.005, // $5 / 1k
    x_search: 0.005, // $5 / 1k
    code_execution: 0.005, // $5 / 1k
    code_interpreter: 0.005, // $5 / 1k
    attachment_search: 0.01, // $10 / 1k
    collections_search: 0.0025, // $2.50 / 1k
    file_search: 0.0025, // $2.50 / 1k
    view_image: 0, // token-based only
    view_x_video: 0, // token-based only
};
var XAI_TOOL_DEFAULT_USD_PER_CALL = 0.005;
function getToolName(input) {
    if (!input)
        return null;
    if (typeof input === 'string') {
        var normalized = input.trim().toLowerCase();
        return normalized || null;
    }
    var raw = String(input.name || '').trim().toLowerCase();
    return raw || null;
}
function computeXaiToolInvocationUsd(toolCalls) {
    if (toolCalls === void 0) { toolCalls = []; }
    if (!Array.isArray(toolCalls) || toolCalls.length === 0)
        return 0;
    var total = 0;
    for (var _i = 0, toolCalls_1 = toolCalls; _i < toolCalls_1.length; _i++) {
        var toolCall = toolCalls_1[_i];
        var name_1 = getToolName(toolCall);
        if (!name_1)
            continue;
        total += XAI_TOOL_PRICE_USD[name_1] || 0;
    }
    return Math.max(total, 0);
}
function getReasoningTokens(usage) {
    var _a;
    if (!usage)
        return 0;
    var topLevel = Number(usage.reasoning_tokens || 0);
    if (topLevel > 0)
        return topLevel;
    return Number(((_a = usage.completion_tokens_details) === null || _a === void 0 ? void 0 : _a.reasoning_tokens) || 0);
}
function isGrokModel(model) {
    return normalizeModelForPricing(model).includes('grok');
}
function isDeepSeekModel(model) {
    return normalizeModelForPricing(model).includes('deepseek');
}
function isOpenAiModel(model) {
    var normalized = normalizeModelForPricing(model);
    return normalized.startsWith('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4');
}
function getOpenAiCachedPromptTokens(usage) {
    var _a;
    if (!usage)
        return 0;
    return Number(((_a = usage.prompt_tokens_details) === null || _a === void 0 ? void 0 : _a.cached_tokens) || 0);
}
function getDeepSeekCacheHitTokens(usage) {
    if (!usage)
        return 0;
    return Number(usage.prompt_cache_hit_tokens || 0);
}
function getDeepSeekCacheMissTokens(usage) {
    if (!usage)
        return 0;
    return Number(usage.prompt_cache_miss_tokens || 0);
}
function computeTotalTokens(usage, model) {
    if (model === void 0) { model = ''; }
    if (!usage)
        return 0;
    var reportedTotal = Number(usage.total_tokens || 0);
    if (reportedTotal > 0)
        return reportedTotal;
    var promptTokens = Number(usage.prompt_tokens || 0);
    var completionTokens = Number(usage.completion_tokens || 0);
    if (isGrokModel(model)) {
        var reasoningTokens = getReasoningTokens(usage);
        return Math.max(promptTokens + completionTokens + reasoningTokens, 0);
    }
    return Math.max(promptTokens + completionTokens, 0);
}
function getXaiInferenceUsdFromTicks(usage) {
    if (!usage)
        return null;
    var ticks = Number(usage.cost_in_usd_ticks || 0);
    if (!Number.isFinite(ticks) || ticks <= 0)
        return null;
    // xAI reports cost_in_usd_ticks in 1e-10 USD units.
    return ticks / 10000000000;
}
function computeUsdCost(usage, model, toolCallsCountOrList) {
    if (toolCallsCountOrList === void 0) { toolCallsCountOrList = 0; }
    if (!usage)
        return 0;
    var normalized = normalizeModelForPricing(model);
    var pricing = env_js_1.env.billing.modelPricing[normalized];
    if (!pricing) {
        logger_js_1.logger.warn(logRegistry_js_1.LogCode.SYS_INFO, 'Billing pricing missing for model', { model: normalized });
        return 0;
    }
    var promptTokens = Number(usage.prompt_tokens || 0);
    var completionTokens = Number(usage.completion_tokens || 0);
    var grokInferenceUsd = isGrokModel(normalized) ? getXaiInferenceUsdFromTicks(usage) : null;
    var openAiCachedPromptTokens = getOpenAiCachedPromptTokens(usage);
    var deepSeekCacheHitTokens = getDeepSeekCacheHitTokens(usage);
    var deepSeekCacheMissTokens = getDeepSeekCacheMissTokens(usage);
    var total = 0;
    if (isGrokModel(normalized)) {
        var reasoningTokens = getReasoningTokens(usage);
        var promptCost_1 = (promptTokens / 1000000) * pricing.promptUsdPer1M;
        var outputCost_1 = ((completionTokens + reasoningTokens) / 1000000) * pricing.completionUsdPer1M;
        total = grokInferenceUsd !== null && grokInferenceUsd !== void 0 ? grokInferenceUsd : (promptCost_1 + outputCost_1);
        if (Array.isArray(toolCallsCountOrList)) {
            total += computeXaiToolInvocationUsd(toolCallsCountOrList);
        }
        else if (Number(toolCallsCountOrList) > 0) {
            // Backward compatibility for paths that only have a count.
            // Uses official baseline invocation price ($5 / 1k) for count-only legacy paths.
            total += Number(toolCallsCountOrList) * XAI_TOOL_DEFAULT_USD_PER_CALL;
        }
        return Math.max(total, 0);
    }
    if (isDeepSeekModel(normalized) && (deepSeekCacheHitTokens > 0 || deepSeekCacheMissTokens > 0)) {
        var cacheHitCost = (deepSeekCacheHitTokens / 1000000) * Number(pricing.cachedPromptUsdPer1M || pricing.promptUsdPer1M);
        var cacheMissCost = (deepSeekCacheMissTokens / 1000000) * pricing.promptUsdPer1M;
        var outputCost_2 = (completionTokens / 1000000) * pricing.completionUsdPer1M;
        return Math.max(cacheHitCost + cacheMissCost + outputCost_2, 0);
    }
    if (isOpenAiModel(normalized) && Number(pricing.cachedPromptUsdPer1M || 0) > 0) {
        var cachedPromptTokens = Math.min(openAiCachedPromptTokens, promptTokens);
        var uncachedPromptTokens = Math.max(promptTokens - cachedPromptTokens, 0);
        var cachedPromptCost = (cachedPromptTokens / 1000000) * Number(pricing.cachedPromptUsdPer1M || pricing.promptUsdPer1M);
        var uncachedPromptCost = (uncachedPromptTokens / 1000000) * pricing.promptUsdPer1M;
        var outputCost_3 = (completionTokens / 1000000) * pricing.completionUsdPer1M;
        return Math.max(cachedPromptCost + uncachedPromptCost + outputCost_3, 0);
    }
    var promptCost = (promptTokens / 1000000) * pricing.promptUsdPer1M;
    var outputCost = (completionTokens / 1000000) * pricing.completionUsdPer1M;
    return Math.max(promptCost + outputCost, 0);
}
