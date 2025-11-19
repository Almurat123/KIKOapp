/**
 * Intent Parser
 * Converts natural language to structured Intent JSON
 */

export type IntentType = 
  | 'token_info' 
  | 'swap' 
  | 'auto_buy' 
  | 'auto_sell' 
  | 'strategy_create'
  | 'strategy_list'
  | 'strategy_delete'
  | 'wallet_info'
  | 'market_data'
  | 'general_query';

export interface Intent {
  version: string;
  intent_id: string;
  correlation_id?: string;
  origin: 'chat' | 'market' | 'news' | 'defi';
  action: IntentType;
  // Token info
  token_address?: string;
  token_symbol?: string;
  chain_id?: number;
  // Swap
  token_in?: string;
  token_out?: string;
  amount?: string;
  amount_asset?: string;
  slippage_bps?: number;
  deadline_s?: number;
  max_gas?: string | 'auto';
  // Strategy
  trigger?: {
    type: 'price_drop_pct' | 'price_rise_pct' | 'price_target' | 'time' | 'wallet_action';
    value?: number;
    window_s?: number;
    min_duration_s?: number;
    target_price?: string;
    wallet_address?: string;
  };
  allowance_mode?: 'one_shot' | 'unlimited';
  validation?: string[];
  // General
  query?: string;
  parameters?: Record<string, any>;
}

const INTENT_SYSTEM_PROMPT = `You are an AI assistant that helps users interact with Web3 DeFi protocols. Your job is to understand user intent and convert it to structured JSON.

Available intent types:
- token_info: Get information about a token (price, liquidity, volume, risk score)
- swap: Execute a token swap
- auto_buy: Set up automatic buy when conditions are met
- auto_sell: Set up automatic sell when conditions are met
- strategy_create: Create a trading strategy
- strategy_list: List existing strategies
- strategy_delete: Delete a strategy
- wallet_info: Get wallet information
- market_data: Get market data (trends, charts, etc.)
- general_query: General questions or chat

For token queries, extract:
- token_symbol (e.g., "ETH", "USDC")
- token_address (if provided)
- chain_id (default: 1 for Ethereum, 8453 for Base, etc.)

For swap queries, extract:
- token_in: input token symbol or address
- token_out: output token symbol or address
- amount: amount to swap
- amount_asset: unit of amount (e.g., "USDC", "ETH")
- slippage_bps: slippage tolerance in basis points (default: 50 = 0.5%)
- chain_id: blockchain network

For auto_buy/auto_sell, extract:
- token_in, token_out, amount, amount_asset
- trigger: conditions for execution
  - type: "price_drop_pct" | "price_rise_pct" | "price_target" | "time" | "wallet_action"
  - value: percentage or target value
  - window_s: time window in seconds
- allowance_mode: "one_shot" or "unlimited"

Always respond with valid JSON in this format:
{
  "version": "1.0",
  "intent_id": "generated-uuid",
  "origin": "chat",
  "action": "intent_type",
  ...relevant_fields...
}

If the user's intent is unclear or not related to Web3/DeFi, use action: "general_query" and include a "query" field with the user's question.`;

/**
 * Parse user message to Intent using DeepSeek API
 */
export async function parseIntent(
  userMessage: string,
  conversationId?: string
): Promise<Intent> {
  const { chatCompletion } = await import('./deepseek');

  const messages = [
    {
      role: 'system' as const,
      content: INTENT_SYSTEM_PROMPT,
    },
    {
      role: 'user' as const,
      content: userMessage,
    },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.3, // Lower temperature for more consistent JSON
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    // Extract JSON from response (might be wrapped in markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const intent: Intent = JSON.parse(jsonStr);
    
    // Ensure required fields
    if (!intent.intent_id) {
      intent.intent_id = `intent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!intent.version) {
      intent.version = '1.0';
    }
    if (!intent.origin) {
      intent.origin = 'chat';
    }
    if (conversationId) {
      intent.correlation_id = conversationId;
    }

    return intent;
  } catch (error) {
    console.error('Intent parsing error:', error);
    // Fallback to general query
    return {
      version: '1.0',
      intent_id: `intent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      origin: 'chat',
      action: 'general_query',
      query: userMessage,
      correlation_id: conversationId,
    };
  }
}

/**
 * Map intent to human-readable description
 */
export function getIntentDescription(intent: Intent): string {
  switch (intent.action) {
    case 'token_info':
      return `Get information about ${intent.token_symbol || 'token'}`;
    case 'swap':
      return `Swap ${intent.amount || ''} ${intent.amount_asset || ''} ${intent.token_in || ''} → ${intent.token_out || ''}`;
    case 'auto_buy':
      return `Set up auto-buy for ${intent.token_out || 'token'}`;
    case 'auto_sell':
      return `Set up auto-sell for ${intent.token_in || 'token'}`;
    case 'strategy_create':
      return 'Create trading strategy';
    case 'strategy_list':
      return 'List strategies';
    case 'strategy_delete':
      return 'Delete strategy';
    case 'wallet_info':
      return 'Get wallet information';
    case 'market_data':
      return 'Get market data';
    case 'general_query':
      return intent.query || 'General query';
    default:
      return 'Unknown intent';
  }
}

