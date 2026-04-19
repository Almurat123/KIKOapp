import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: DeepSeek was removed from the product model catalog. NVIDIA-hosted
//         GLM/Kimi models are now free-model traffic with one optional shared
//         cap, while GPT and Grok share one premium daily free quota. Billing
//         classification must no longer expose Normal/Advanced or DeepSeek/Grok
//         quota buckets. Official NVIDIA doc verification later removed the
//         synthetic GLM Fast/Reasoning split, so historical `glm-5-reasoning`
//         rows now need to normalize back to the one canonical GLM id instead
//         of preserving duplicate billing keys forever.
// Goal: keep quota/billing classification stable around the product policy:
//       free models share one optional cap, premium models share one quota.
// Owns: model-family pricing classification, quota lookup helpers, and token/cost aggregation helpers.
// Does Not Own: UI model lists, provider routing, or external vendor pricing policy.
// Design Language:
// - Quota buckets are product policy, not vendor-brand names.
// - NVIDIA GLM/Kimi models belong to the shared free bucket.
// - GPT and Grok models belong to one shared premium quota bucket.
// - Do not reintroduce separate Normal/Advanced free-count buckets.
// - Reasoning-token handling must remain provider-aware.
// - Historical removed model ids should normalize to the surviving canonical id.
// Document Provenance:
// - Source: operator quota-policy correction after DeepSeek removal
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: classifying GLM/Kimi as free and GPT/Grok as one premium bucket
// - Verification: verified in code
// - Source: operator quota-policy correction for optional free-model cap
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: returning one env-driven shared limit for free-model traffic
// - Verification: verified in code
// - Source: NVIDIA NIM model page for z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: collapsing removed GLM reasoning aliases into the canonical
//   `glm-5` billing id
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type BillingCategory = 'free' | 'premium' | 'other';

export function getUtcDateString(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function normalizeModelForPricing(model: string): string {
    if (!model) return '';
    const lower = model.toLowerCase();
    if (
        lower === 'glm-5-reasoning'
        || lower === 'glm5-reasoning'
        || lower === 'z-ai/glm5-reasoning'
        || lower === 'z-ai/glm-5-reasoning'
        || lower === 'glm5'
        || lower === 'z-ai/glm5'
        || lower === 'z-ai/glm-5'
    ) {
        return 'glm-5';
    }
    return lower;
}

export function getBillingCategory(model: string): BillingCategory {
    const normalized = normalizeModelForPricing(model);

    if (env.billing.freeModels.includes(normalized)) return 'free';
    if (normalized.includes('kimi') || normalized.includes('glm') || normalized.includes('moonshotai/') || normalized.includes('z-ai/')) return 'free';
    if (env.billing.premiumModels.includes(normalized)) return 'premium';
    if (normalized.includes('grok')) return 'premium';
    if (normalized.startsWith('gpt') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4')) return 'premium';
    return 'other';
}

export function getDailyFreeQuota(category: BillingCategory): number {
    if (category === 'free') return env.billing.dailyFreeModelLimit;
    if (category === 'premium') return env.billing.dailyFreePremium;
    return 0;
}

export function getDailyFreeQuotaForModel(model: string): number {
    return getDailyFreeQuota(getBillingCategory(model));
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
