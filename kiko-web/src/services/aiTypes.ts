/**
 * AI Communication Layer Shared Types
 * Used to ensure consistency between deepseek, xai, and aiService
 */

export interface AIClientAction {
    type: string;
    payload: Record<string, unknown>;
}

export interface AICitation {
    url: string;
    avatar_url?: string;
}

export interface AIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

/**
 * Common chunk structure for all AI streaming implementations
 */
export interface AIStreamChunk {
    content: string;
    citations?: AICitation[];
    tool_call?: string;
    tool_call_id?: string;
    tool_status?: string;
    reasoning_content?: string;
    client_actions?: AIClientAction[];
    usage?: AIUsage;
}
