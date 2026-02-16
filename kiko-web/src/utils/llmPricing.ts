/**
 * Utility for calculating LLM token costs
 * Based on official pricing
 * GPT pricing is configurable and can be overridden from backend billing config.
 * Grok 4.1 Fast (USD): https://x.ai/api/
 */

type Currency = 'USD';
type ToolCallLike = string | { name?: string; function?: { name?: string } } | null | undefined;

// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number; currency: Currency }> = {
    // Grok 4.1 Fast (USD)
    'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50, currency: 'USD' },
    'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50, currency: 'USD' },
    // GPT (USD)
    'deepseek-chat': { input: 0.285714, output: 0.428571, currency: 'USD' },
    'deepseek-reasoner': { input: 0.285714, output: 0.428571, currency: 'USD' },
    'gpt-4o-mini': { input: 0.15, output: 0.60, currency: 'USD' },
    'gpt-4.1': { input: 2.00, output: 8.00, currency: 'USD' },
    'gpt-5-mini': { input: 2.00, output: 8.00, currency: 'USD' },
    'gpt-5.2': { input: 2.00, output: 8.00, currency: 'USD' },
};

// xAI official tool invocation pricing (USD per 1 call)
// Source: https://docs.x.ai/developers/models#tool-invocation-costs
const XAI_TOOL_PRICE_PER_CALL: Record<string, number> = {
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

// Legacy fallback for call-count-only paths (no tool names available).
const LEGACY_TOOL_PRICE_PER_CALL = 0.005;

// Default fallback pricing
const DEFAULT_GPT_PRICING = { input: 0.15, output: 0.60, currency: 'USD' as const };
const DEFAULT_GROK_PRICING = { input: 0.20, output: 0.50, currency: 'USD' as const };

/**
 * Calculate the cost of an LLM request
 * @param model - The model identifier
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @param toolCallsCount - Number of tool calls (optional)
 * @returns Cost and currency
 */
export function calculateCost(
    model: string | undefined,
    promptTokens: number,
    completionTokens: number,
    toolCallsCountOrList: number | ToolCallLike[] = 0
): { amount: number; currency: Currency } {
    if (!model) return { amount: 0, currency: 'USD' };

    const isGrok = model.toLowerCase().includes('grok');
    const pricing = PRICING[model] || (isGrok ? DEFAULT_GROK_PRICING : DEFAULT_GPT_PRICING);
    const tokenCost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
    let total = tokenCost;

    // Add tool invocation costs for Grok based on xAI official tool pricing.
    if (model.toLowerCase().includes('grok')) {
        if (Array.isArray(toolCallsCountOrList)) {
            for (const toolCall of toolCallsCountOrList) {
                let name = '';
                if (typeof toolCall === 'string') {
                    name = toolCall;
                } else if (toolCall?.function?.name) {
                    name = toolCall.function.name;
                } else if (toolCall?.name) {
                    name = toolCall.name;
                }
                const normalized = name.trim().toLowerCase();
                if (!normalized) continue;
                total += XAI_TOOL_PRICE_PER_CALL[normalized] || 0;
            }
        } else if (toolCallsCountOrList > 0) {
            total += toolCallsCountOrList * LEGACY_TOOL_PRICE_PER_CALL;
        }
    }

    return { amount: total, currency: pricing.currency };
}

/**
 * Format cost to a readable currency string
 * Handles very small numbers by showing appropriate precision
 */
export function formatCost(cost: number, currency: Currency): string {
    const symbol = currency === 'USD' ? '$' : '$';
    if (cost === 0) return `${symbol}0`;
    if (cost < 0.0001) return `<${symbol}0.0001`;
    // Show 4 decimal places for precision
    return `${symbol}${cost.toFixed(4)}`;
}
