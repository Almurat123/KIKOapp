import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

export type BillingCategory = 'deepseek' | 'grok' | 'other';

export function getUtcDateString(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function normalizeModelForPricing(model: string): string {
    if (!model) return '';
    const lower = model.toLowerCase();
    return lower;
}

export function getBillingCategory(model: string): BillingCategory {
    const normalized = normalizeModelForPricing(model);

    if (env.billing.grokModels.includes(normalized)) return 'grok';
    if (normalized.includes('grok')) return 'grok';
    if (env.billing.deepseekModels.includes(normalized)) return 'deepseek';
    if (normalized.includes('deepseek')) return 'deepseek';

    return 'other';
}

export function getDailyFreeQuota(category: BillingCategory): number {
    if (category === 'deepseek') return env.billing.dailyFreeDeepseek;
    if (category === 'grok') return env.billing.dailyFreeGrok;
    return 0;
}

type ToolCallLike = string | { name?: string | null } | null | undefined;
type UsageLike = {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
    cost_in_usd_ticks?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    prompt_tokens_details?: {
        text_tokens?: number;
        audio_tokens?: number;
        image_tokens?: number;
        cached_tokens?: number;
    } | null;
    completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
        accepted_prediction_tokens?: number;
        rejected_prediction_tokens?: number;
    } | null;
} | null | undefined;

// xAI official tool invocation pricing (USD per 1 call)
// Source: https://docs.x.ai/developers/models#tool-invocation-costs
const XAI_TOOL_PRICE_USD: Record<string, number> = {
    web_search: 0.005,          // $5 / 1k
    x_search: 0.005,            // $5 / 1k
    code_execution: 0.005,      // $5 / 1k
    code_interpreter: 0.005,    // $5 / 1k
    attachment_search: 0.01,    // $10 / 1k
    collections_search: 0.0025, // $2.50 / 1k
    file_search: 0.0025,        // $2.50 / 1k
    view_image: 0,              // token-based only
    view_x_video: 0,            // token-based only
};
const XAI_TOOL_DEFAULT_USD_PER_CALL = 0.005;

function getToolName(input: ToolCallLike): string | null {
    if (!input) return null;
    if (typeof input === 'string') {
        const normalized = input.trim().toLowerCase();
        return normalized || null;
    }
    const raw = String(input.name || '').trim().toLowerCase();
    return raw || null;
}

export function computeXaiToolInvocationUsd(toolCalls: ToolCallLike[] = []): number {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) return 0;
    let total = 0;
    for (const toolCall of toolCalls) {
        const name = getToolName(toolCall);
        if (!name) continue;
        total += XAI_TOOL_PRICE_USD[name] || 0;
    }
    return Math.max(total, 0);
}

export function getReasoningTokens(usage: UsageLike): number {
    if (!usage) return 0;
    const topLevel = Number(usage.reasoning_tokens || 0);
    if (topLevel > 0) return topLevel;
    return Number(usage.completion_tokens_details?.reasoning_tokens || 0);
}

function isGrokModel(model: string): boolean {
    return normalizeModelForPricing(model).includes('grok');
}

function isDeepSeekModel(model: string): boolean {
    return normalizeModelForPricing(model).includes('deepseek');
}

function isOpenAiModel(model: string): boolean {
    const normalized = normalizeModelForPricing(model);
    return normalized.startsWith('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4');
}

function getOpenAiCachedPromptTokens(usage: UsageLike): number {
    if (!usage) return 0;
    return Number(usage.prompt_tokens_details?.cached_tokens || 0);
}

function getDeepSeekCacheHitTokens(usage: UsageLike): number {
    if (!usage) return 0;
    return Number(usage.prompt_cache_hit_tokens || 0);
}

function getDeepSeekCacheMissTokens(usage: UsageLike): number {
    if (!usage) return 0;
    return Number(usage.prompt_cache_miss_tokens || 0);
}

export function computeTotalTokens(usage: UsageLike, model = ''): number {
    if (!usage) return 0;
    const reportedTotal = Number(usage.total_tokens || 0);
    if (reportedTotal > 0) return reportedTotal;
    const promptTokens = Number(usage.prompt_tokens || 0);
    const completionTokens = Number(usage.completion_tokens || 0);
    if (isGrokModel(model)) {
        const reasoningTokens = getReasoningTokens(usage);
        return Math.max(promptTokens + completionTokens + reasoningTokens, 0);
    }
    return Math.max(promptTokens + completionTokens, 0);
}

function getXaiInferenceUsdFromTicks(usage: UsageLike): number | null {
    if (!usage) return null;
    const ticks = Number(usage.cost_in_usd_ticks || 0);
    if (!Number.isFinite(ticks) || ticks <= 0) return null;
    // xAI reports cost_in_usd_ticks in 1e-10 USD units.
    return ticks / 10_000_000_000;
}

export function computeUsdCost(
    usage: UsageLike,
    model: string,
    toolCallsCountOrList: number | ToolCallLike[] = 0
): number {
    if (!usage) return 0;
    const normalized = normalizeModelForPricing(model);
    const pricing = env.billing.modelPricing[normalized];
    if (!pricing) {
        logger.warn(LogCode.SYS_INFO, 'Billing pricing missing for model', { model: normalized });
        return 0;
    }

    const promptTokens = Number(usage.prompt_tokens || 0);
    const completionTokens = Number(usage.completion_tokens || 0);
    const grokInferenceUsd = isGrokModel(normalized) ? getXaiInferenceUsdFromTicks(usage) : null;
    const openAiCachedPromptTokens = getOpenAiCachedPromptTokens(usage);
    const deepSeekCacheHitTokens = getDeepSeekCacheHitTokens(usage);
    const deepSeekCacheMissTokens = getDeepSeekCacheMissTokens(usage);
    let total = 0;

    if (isGrokModel(normalized)) {
        const reasoningTokens = getReasoningTokens(usage);
        const promptCost = (promptTokens / 1_000_000) * pricing.promptUsdPer1M;
        const outputCost = ((completionTokens + reasoningTokens) / 1_000_000) * pricing.completionUsdPer1M;
        total = grokInferenceUsd ?? (promptCost + outputCost);
        if (Array.isArray(toolCallsCountOrList)) {
            total += computeXaiToolInvocationUsd(toolCallsCountOrList);
        } else if (Number(toolCallsCountOrList) > 0) {
            // Backward compatibility for paths that only have a count.
            // Uses official baseline invocation price ($5 / 1k) for count-only legacy paths.
            total += Number(toolCallsCountOrList) * XAI_TOOL_DEFAULT_USD_PER_CALL;
        }
        return Math.max(total, 0);
    }

    if (isDeepSeekModel(normalized) && (deepSeekCacheHitTokens > 0 || deepSeekCacheMissTokens > 0)) {
        const cacheHitCost = (deepSeekCacheHitTokens / 1_000_000) * Number(pricing.cachedPromptUsdPer1M || pricing.promptUsdPer1M);
        const cacheMissCost = (deepSeekCacheMissTokens / 1_000_000) * pricing.promptUsdPer1M;
        const outputCost = (completionTokens / 1_000_000) * pricing.completionUsdPer1M;
        return Math.max(cacheHitCost + cacheMissCost + outputCost, 0);
    }

    if (isOpenAiModel(normalized) && Number(pricing.cachedPromptUsdPer1M || 0) > 0) {
        const cachedPromptTokens = Math.min(openAiCachedPromptTokens, promptTokens);
        const uncachedPromptTokens = Math.max(promptTokens - cachedPromptTokens, 0);
        const cachedPromptCost = (cachedPromptTokens / 1_000_000) * Number(pricing.cachedPromptUsdPer1M || pricing.promptUsdPer1M);
        const uncachedPromptCost = (uncachedPromptTokens / 1_000_000) * pricing.promptUsdPer1M;
        const outputCost = (completionTokens / 1_000_000) * pricing.completionUsdPer1M;
        return Math.max(cachedPromptCost + uncachedPromptCost + outputCost, 0);
    }

    const promptCost = (promptTokens / 1_000_000) * pricing.promptUsdPer1M;
    const outputCost = (completionTokens / 1_000_000) * pricing.completionUsdPer1M;
    return Math.max(promptCost + outputCost, 0);
}
