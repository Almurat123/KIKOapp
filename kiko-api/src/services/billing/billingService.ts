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
    if (env.billing.deepseekModels.includes(normalized)) return 'deepseek';
    if (env.billing.grokModels.includes(normalized)) return 'grok';
    if (normalized.includes('gpt') || normalized.includes('openai')) return 'deepseek';
    if (normalized.includes('deepseek')) return 'deepseek';
    if (normalized.includes('grok')) return 'grok';
    return 'other';
}

export function getDailyFreeQuota(category: BillingCategory): number {
    if (category === 'deepseek') return env.billing.dailyFreeDeepseek;
    if (category === 'grok') return env.billing.dailyFreeGrok;
    return 0;
}

export function computeUsdCost(
    usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
    model: string,
    toolCallsCount: number = 0
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
    if (toolCallsCount > 0 && normalized.includes('grok')) {
        total += toolCallsCount * env.billing.toolPricePerCall;
    }
    return Math.max(total, 0);
}
