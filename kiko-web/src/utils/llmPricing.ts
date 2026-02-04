/**
 * Utility for calculating LLM token costs
 * Based on official pricing
 * DeepSeek V3.2 (CNY converted to USD @ 1 USD = 7.00 CNY): https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
 * Grok 4.1 Fast (USD): https://x.ai/api/
 */

type Currency = 'USD';

// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number; currency: Currency }> = {
    // Grok 4.1 Fast (USD)
    'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50, currency: 'USD' },
    'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50, currency: 'USD' },
    // DeepSeek V3.2 (CNY converted to USD @ 1 USD = 7.00 CNY)
    // 2 CNY -> 0.285714 USD, 3 CNY -> 0.428571 USD
    'deepseek-chat': { input: 0.285714, output: 0.428571, currency: 'USD' },
    'deepseek-reasoner': { input: 0.285714, output: 0.428571, currency: 'USD' },
};

// Tool pricing in USD per 1 call (based on $5/1000 calls)
const TOOL_PRICE_PER_CALL = 0.005;

// Default fallback pricing
const DEFAULT_DEEPSEEK_PRICING = { input: 0.285714, output: 0.428571, currency: 'USD' as const };
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
    toolCallsCount: number = 0
): { amount: number; currency: Currency } {
    if (!model) return { amount: 0, currency: 'USD' };

    const isGrok = model.toLowerCase().includes('grok');
    const pricing = PRICING[model] || (isGrok ? DEFAULT_GROK_PRICING : DEFAULT_DEEPSEEK_PRICING);
    const tokenCost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
    let total = tokenCost;

    // Add tool invocation costs if model is Grok (DeepSeek doesn't charge per tool call separately usually, or it's implicitly tokens)
    // Check if model string contains 'grok' (case insensitive)
    if (toolCallsCount > 0 && model.toLowerCase().includes('grok')) {
        total += toolCallsCount * TOOL_PRICE_PER_CALL;
    }

    return { amount: total, currency: pricing.currency };
}

/**
 * Format cost to a readable currency string
 * Handles very small numbers by showing appropriate precision
 */
export function formatCost(cost: number, currency: Currency): string {
    const symbol = '$';
    if (cost === 0) return `${symbol}0`;
    if (cost < 0.0001) return `<${symbol}0.0001`;
    // Show 4 decimal places for precision
    return `${symbol}${cost.toFixed(4)}`;
}
