/**
 * Utility for calculating user-facing LLM message charges.
 * This should mirror the backend credits pricing table, converted to USD at
 * 1 USD = 10 credits, instead of showing raw provider cost.
 */
// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Almurat
// Reason: chat message-bubble cost display must recognize the same real model
// ids and user-facing text price table as the backend credits ledger. Showing
// provider USD cost in the bubble while the backend deducts credits causes
// visible price mismatch and user confusion.
// Goal: keep displayed per-message charge aligned with backend-billed model ids
// and the actual credits pricing policy.
// Owns: frontend-only user charge lookup used in chat bubbles.
// Does Not Own: quota enforcement, free-message application, or backend billing.
// Design Language:
// - Price actual model ids, not synthetic effort labels.
// - GPT and Grok entries mirror backend billing ids exactly.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: keeping chat-bubble cost display aligned with the selector's fast/thinking model ids
// - Verification: inferred
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - /Users/almurat/KiKo/kiko-api/src/config/env.ts

type Currency = 'USD';
type ToolCallLike = string | { name?: string; function?: { name?: string } } | null | undefined;

const CREDITS_PER_USD = 10;

// Backend-aligned user pricing, expressed in credits and converted to USD here.
const USER_TEXT_PRICING: Record<string, {
    baseCreditsPerMessage: number;
    inputCreditsPer1kTokens: number;
    outputCreditsPer1kTokens: number;
    currency: Currency;
}> = {
    'grok-4-1-fast-reasoning': {
        baseCreditsPerMessage: 0.05,
        inputCreditsPer1kTokens: 0.003,
        outputCreditsPer1kTokens: 0.0075,
        currency: 'USD',
    },
    'grok-4-1-fast-non-reasoning': {
        baseCreditsPerMessage: 0.05,
        inputCreditsPer1kTokens: 0.003,
        outputCreditsPer1kTokens: 0.0075,
        currency: 'USD',
    },
    'gpt-5.4-mini-2026-03-17': {
        baseCreditsPerMessage: 0.1,
        inputCreditsPer1kTokens: 0.01125,
        outputCreditsPer1kTokens: 0.0675,
        currency: 'USD',
    },
};

function normalizePricingModelId(model?: string): string {
    return String(model || '').trim().toLowerCase();
}

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
    void toolCallsCountOrList;
    if (!model) return { amount: 0, currency: 'USD' };

    const normalizedModel = normalizePricingModelId(model);
    const pricing = USER_TEXT_PRICING[normalizedModel];
    if (!pricing) return { amount: 0, currency: 'USD' };

    const totalCredits = pricing.baseCreditsPerMessage
        + (promptTokens * pricing.inputCreditsPer1kTokens) / 1000
        + (completionTokens * pricing.outputCreditsPer1kTokens) / 1000;
    const total = totalCredits / CREDITS_PER_USD;

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
