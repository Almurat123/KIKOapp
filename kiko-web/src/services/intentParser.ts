/**
 * Intent Parser
 * Converts natural language to structured Intent JSON
 */

export type IntentType =
  | 'token_info'
  | 'token_search'
  | 'token_detail'
  | 'token_chart'
  | 'token_trending'
  | 'swap'
  | 'auto_buy'
  | 'auto_sell'
  | 'strategy_create'
  | 'strategy_list'
  | 'strategy_delete'
  | 'wallet_info'
  | 'wallet_balance'
  | 'wallet_transactions'
  | 'market_data'
  | 'market_overview'
  | 'market_chains'
  | 'market_protocols'
  | 'news_flash'
  | 'news_articles'
  | 'news_featured'
  | 'social_trending'
  | 'social_user_info'
  | 'token_security'
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
  // List/Wallet
  wallet_address?: string;
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
  apiEndpoint?: string;
  type?: string; // Some services use 'type' as an alias for 'action'
  tradeIntent?: {
    tokenIn: { address: string; symbol: string; amount: string };
    tokenOut: { address: string; symbol: string };
    chainId: number;
    slippageBps?: number;
  };
}

const INTENT_SYSTEM_PROMPT = `You are an AI assistant that helps users interact with Web3 DeFi protocols. Your job is to understand user intent and convert it to structured JSON.

Available intent types:
- token_info: Get information about a token (price, liquidity, volume, risk score)
- token_search: Search for tokens by symbol or name
- token_detail: Get detailed token information
- token_chart: Get token price chart data
- token_trending: Get trending tokens
- swap: Execute a token swap
- auto_buy: Set up automatic buy when conditions are met
- auto_sell: Set up automatic sell when conditions are met
- strategy_create: Create a trading strategy
- strategy_list: List existing strategies
- strategy_delete: Delete a strategy
- wallet_info: Get wallet information (may show list card with transactions)
- wallet_balance: Check wallet balance
- wallet_transactions: Get wallet transactions
- market_data: Get market data (trends, charts, etc.) (may show list card with trending tokens)
- market_overview: Get market overview statistics
- market_chains: Get blockchain chains data
- market_protocols: Get DeFi protocols data
- news_flash: Get flash/breaking news
- news_articles: Get news articles by category
- news_featured: Get featured articles
- social_trending: Get trending social media posts (Farcaster)
- social_user_info: Get Farcaster user information
- list_holders: Get top holders of a token (shows list card)
- list_trending: Get trending tokens (shows list card)
- list_transactions: Get wallet transactions (shows list card)
- token_security: Scan token security
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

If the user's intent is unclear or not related to Web3/DeFi, use action: "general_query" and include a "query" field with the user's question.

IMPORTANT: If the user message contains:
- A contract address (EVM: 0x + 40 hex, or Solana: base58 32-44 chars)
- Swap keywords: "swap", "trade", "exchange", "convert", "buy", "sell", "swap to", "trade for"
- Token symbols mentioned together (e.g., "ETH to USDC", "swap 100 USDC for ETH", "用SOL买USDC")
Then the action should be "swap" and you must extract token_in, token_out, and amount if available.

CONTRACT ADDRESS HANDLING:
- If user provides a contract address (EVM or Solana format), it means they want to BUY that token
- Set token_out to the contract address
- Set token_address to the contract address
- For Solana addresses, also set chain_id to 900
- Default token_in to "USDC" unless user specifies otherwise (for Solana, use "SOL" if context suggests)
- Examples:
  - "I want to buy 0xabc..." → {token_in: "USDC", token_out: "0xabc...", token_address: "0xabc...", chain_id: 1}
  - "用SOL买 So11111..." → {token_in: "SOL", token_out: "So11111...", token_address: "So11111...", chain_id: 900}`;

/**
 * Detect contract address pattern
 * - EVM chains: 0x followed by 40 hex characters
 * - Solana: base58 encoded, 32-44 characters (no 0x prefix)
 */
function detectContractAddress(text: string): string | null {
  // Check for EVM address first (0x + 40 hex)
  const evmPattern = /0x[a-fA-F0-9]{40}/g;
  const evmMatch = text.match(evmPattern);
  if (evmMatch) return evmMatch[0];

  // Check for Solana address (base58, 32-44 chars, no 0x)
  // Solana addresses use base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const solanaPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const words = text.split(/\s+/);

  for (const word of words) {
    // Only consider as Solana address if it's a standalone word (not part of a sentence)
    // and matches the pattern
    if (solanaPattern.test(word) && word.length >= 32 && word.length <= 44) {
      // Additional validation: Solana addresses typically don't contain common English words
      // This is a heuristic to avoid false positives
      const hasMultipleVowels = (word.match(/[aeiou]/gi) || []).length > 3;
      if (!hasMultipleVowels || word.length > 40) {
        return word;
      }
    }
  }

  return null;
}

/**
 * Detect swap keywords in message
 */
function hasSwapKeywords(text: string): boolean {
  const swapKeywords = [
    'swap', 'trade', 'exchange', 'convert',
    'buy', 'sell', 'swap to', 'trade for',
    'exchange for', 'convert to'
  ];
  const lowerText = text.toLowerCase();
  return swapKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract token symbols from message (simple pattern matching)
 */
function extractTokenSymbols(text: string): { tokenIn?: string; tokenOut?: string } {
  const commonTokens = ['ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'BTC', 'BNB', 'MATIC', 'AVAX', 'SOL'];
  const upperText = text.toUpperCase();
  const found: string[] = [];

  for (const token of commonTokens) {
    if (upperText.includes(token)) {
      found.push(token);
    }
  }

  // Try to detect pattern like "ETH to USDC" or "swap ETH for USDC"
  const toPattern = /(\w+)\s+(?:to|for|->)\s+(\w+)/i;
  const toMatch = text.match(toPattern);
  if (toMatch) {
    return {
      tokenIn: toMatch[1].toUpperCase(),
      tokenOut: toMatch[2].toUpperCase(),
    };
  }

  if (found.length >= 2) {
    return {
      tokenIn: found[0],
      tokenOut: found[1],
    };
  }

  return {};
}

// Import UserContext type
import type { UserContext } from './aiService';

// ... (existing imports)

/**
 * Parse user message to Intent using DeepSeek API
 */
export async function parseIntent(
  userMessage: string,
  conversationId?: string,
  userContext?: UserContext
): Promise<Intent> {
  // Pre-detect swap intent from contract addresses or keywords
  const contractAddress = detectContractAddress(userMessage);
  const hasSwap = hasSwapKeywords(userMessage);
  const tokenSymbols = extractTokenSymbols(userMessage);

  // Build context-aware system prompt
  let systemPrompt = INTENT_SYSTEM_PROMPT;

  // Add user context if available
  if (userContext?.chainId && userContext?.chainName) {
    systemPrompt += `\n\nUSER CONTEXT:\n- Current Chain: ${userContext.chainName} (ID: ${userContext.chainId})\n- Wallet Connected: ${userContext.isWalletConnected ? 'Yes' : 'No'}\n\nIMPORTANT: Default to chain_id ${userContext.chainId} (${userContext.chainName}) unless the user explicitly mentions another network.`;
  }

  // If we detect swap indicators, enhance the prompt
  const enhancedPrompt = contractAddress || hasSwap || (tokenSymbols.tokenIn && tokenSymbols.tokenOut)
    ? `${systemPrompt}\n\nDETECTION HINT: The user message contains swap indicators (contract address, swap keywords, or token pairs). Prioritize "swap" action if appropriate.`
    : systemPrompt;
  const { chatCompletion } = await import('./deepseek');

  const messages = [
    {
      role: 'system' as const,
      content: enhancedPrompt,
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
      enable_search: false, // IMPORTANT: Disable search tools for intent parsing
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

    // Enhance swap intent with detected information
    if (intent.action === 'swap' || hasSwap || contractAddress) {
      // If AI didn't detect swap but we did, override it
      if (intent.action !== 'swap' && (hasSwap || contractAddress)) {
        intent.action = 'swap';
      }

      // Fill in missing swap fields from detection
      if (contractAddress) {
        intent.token_address = contractAddress;

        // Detect if this is a Solana address (base58, no 0x prefix)
        const isSolanaAddress = !contractAddress.startsWith('0x') &&
          contractAddress.length >= 32 &&
          contractAddress.length <= 44 &&
          /^[1-9A-HJ-NP-Za-km-z]+$/.test(contractAddress);

        // If Solana address detected, set chain_id to 900
        if (isSolanaAddress && !intent.chain_id) {
          intent.chain_id = 900;
        }

        // If LLM put contract address in token_in, move it to token_out (unless it's a sell intent?)
        // For "Buy ... to 0x...", 0x... is definitely token_out.
        if (intent.token_in && intent.token_in.toLowerCase() === contractAddress.toLowerCase()) {
          intent.token_out = contractAddress;
          // For Solana, default to SOL; for others, default to USDC
          intent.token_in = isSolanaAddress ? 'SOL' : 'USDC';
        }

        // Contract address is the highest priority for token_out (what we are buying)
        // If token_out was already set to something else (e.g., "ETH" in "Buy ETH to 0x..."),
        // it likely means the user meant "Buy with ETH" or the LLM got confused.
        // So we move the old token_out to token_in.
        if (intent.token_out && intent.token_out.toLowerCase() !== contractAddress.toLowerCase()) {
          if (!intent.token_in || intent.token_in === 'USDC' || intent.token_in === 'SOL') {
            intent.token_in = intent.token_out;
          }
        }

        // Force token_out to be the contract address
        intent.token_out = contractAddress;

        // Default tokenIn based on chain if not specified
        if (!intent.token_in) {
          intent.token_in = isSolanaAddress ? 'SOL' : 'USDC';
        }
      }

      // Auto-detect Solana chain if SOL is mentioned
      if ((intent.token_in?.toUpperCase() === 'SOL' || intent.token_out?.toUpperCase() === 'SOL') && !intent.chain_id) {
        intent.chain_id = 900;
      }

      if (tokenSymbols.tokenIn && !intent.token_in) {
        intent.token_in = tokenSymbols.tokenIn;
      }

      if (tokenSymbols.tokenOut && !intent.token_out) {
        intent.token_out = tokenSymbols.tokenOut;
      }
    }

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

