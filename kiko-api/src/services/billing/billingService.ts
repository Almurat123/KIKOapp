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

    // Explicit whitelists from env
    if (env.billing.deepseekModels.includes(normalized)) return 'deepseek';
    if (env.billing.grokModels.includes(normalized)) return 'grok';

    return 'other';
}

export function getDailyFreeQuota(category: BillingCategory): number {
    if (category === 'deepseek') return env.billing.dailyFreeDeepseek;
    if (category === 'grok') return env.billing.dailyFreeGrok;
    return 0;
}

type ToolCallLike = string | { name?: string | null } | null | undefined;

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

export function computeUsdCost(
    usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
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
    const promptCost = (promptTokens / 1_000_000) * pricing.promptUsdPer1M;
    const completionCost = (completionTokens / 1_000_000) * pricing.completionUsdPer1M;
    let total = promptCost + completionCost;
    if (normalized.includes('grok')) {
        if (Array.isArray(toolCallsCountOrList)) {
            total += computeXaiToolInvocationUsd(toolCallsCountOrList);
        } else if (Number(toolCallsCountOrList) > 0) {
            // Backward compatibility for paths that only have a count.
            // Uses official baseline invocation price ($5 / 1k) for count-only legacy paths.
            total += Number(toolCallsCountOrList) * XAI_TOOL_DEFAULT_USD_PER_CALL;
        }
    }
    return Math.max(total, 0);
}
