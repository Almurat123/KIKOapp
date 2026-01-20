/**
 * Utility for calculating LLM token costs
 * Based on official pricing from January 2025
 * DeepSeek V3.2: https://api-docs.deepseek.com/quick_start/pricing
 * Grok 4.1 Fast: https://docs.x.ai/docs/models
 */

// Pricing in USD per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
    // Grok 4.1 Fast (Reasoning) - Frontend IDs
    'grok-4-reasoning': { input: 0.20, output: 0.50 },
    // Grok 4.1 Fast (Non-Reasoning) - Frontend IDs
    'grok-4-non-reasoning': { input: 0.20, output: 0.50 },
    // Grok 4.1 Fast - API Model Names (backend may return these)
    'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50 },
    'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50 },
    // DeepSeek V3.2 (cache miss pricing - most common case)
    'deepseek-v3-fast': { input: 0.28, output: 0.42 },
    'deepseek-v3-thinking': { input: 0.28, output: 0.42 },
    // Fallbacks
    'deepseek-chat': { input: 0.28, output: 0.42 },
    'deepseek-reasoner': { input: 0.28, output: 0.42 },
};

// Tool pricing in USD per 1 call (based on $5/1000 calls)
const TOOL_PRICE_PER_CALL = 0.005;

// Default fallback pricing (DeepSeek V3.2 cache miss)
const DEFAULT_PRICING = { input: 0.28, output: 0.42 };

/**
 * Calculate the cost of an LLM request in USD
 * @param model - The model identifier
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @param toolCallsCount - Number of tool calls (optional)
 * @returns Cost in USD
 */
export function calculateCost(model: string | undefined, promptTokens: number, completionTokens: number, toolCallsCount: number = 0): number {
    if (!model) return 0;

    // Normalize model string to match keys if needed, or find best match
    // This handles accurate matching for the IDs defined in ChatInterface.tsx
    const pricing = PRICING[model] || DEFAULT_PRICING;

    const tokenCost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

    // Add tool invocation costs if model is Grok (DeepSeek doesn't charge per tool call separately usually, or it's implicitly tokens)
    // Check if model string contains 'grok' (case insensitive)
    if (toolCallsCount > 0 && model.toLowerCase().includes('grok')) {
        return tokenCost + (toolCallsCount * TOOL_PRICE_PER_CALL);
    }

    return tokenCost;
}

/**
 * Format cost to a readable USD string
 * Handles very small numbers by showing appropriate precision
 */
export function formatCost(cost: number): string {
    if (cost === 0) return '$0';
    if (cost < 0.0001) return '<$0.0001';
    // Show 4 decimal places for precision
    return `$${cost.toFixed(4)}`;
}
