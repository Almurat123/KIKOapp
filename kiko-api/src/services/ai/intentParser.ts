/**
 * Intent Parser Service (Backend)
 * Converts natural language to structured Intent for WebSocket architecture
 * Supports both high-level (5 types) and detailed (31 types) intent classification
 */

import type { UserContext } from './types.js';
import { v4 as uuidv4 } from 'uuid';

// High-level intent types (for system prompt selection)
export type HighLevelIntentType =
    | 'TRADING'
    | 'MARKET_ANALYSIS'
    | 'SOCIAL_SENSING'
    | 'RISK_SCAN'
    | 'GENERAL_CHAT';

// Detailed intent types (for precise API routing and tool selection)
export type DetailedIntentType =
    // Token intents
    | 'token_info'
    | 'token_search'
    | 'token_detail'
    | 'token_chart'
    | 'token_trending'
    // Swap/Trading intents
    | 'swap'
    | 'auto_buy'
    | 'auto_sell'
    | 'strategy_create'
    | 'strategy_list'
    | 'strategy_delete'
    // Wallet intents
    | 'wallet_info'
    | 'wallet_balance'
    | 'wallet_transactions'
    // Market intents
    | 'market_data'
    | 'market_overview'
    | 'market_chains'
    | 'market_protocols'
    // Social intents
    | 'social_trending'
    | 'social_user_info'
    // Security intents
    | 'token_security'
    // General
    | 'general_query';

// High-level intent result (for system prompt)
export interface HighLevelIntent {
    type: HighLevelIntentType;
    confidence: number;
}

// Detailed intent result (for API routing and tool selection)
export interface DetailedIntent {
    version: string;
    intent_id: string;
    correlation_id?: string;
    origin: 'chat' | 'market' | 'news' | 'defi';
    action: DetailedIntentType;
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
}

// Combined result
export interface ParsedIntent {
    highLevel: HighLevelIntent;
    detailed: DetailedIntent;
    contractAddress?: string;
    chainId?: number;
    swapIntent?: {
        tokenIn?: string;
        tokenOut?: string;
        amount?: string;
    };
}

// Mapping from detailed intent to high-level intent
const DETAILED_TO_HIGH_LEVEL: Record<DetailedIntentType, HighLevelIntentType> = {
    // TRADING
    'swap': 'TRADING',
    'auto_buy': 'TRADING',
    'auto_sell': 'TRADING',
    'strategy_create': 'TRADING',
    'strategy_list': 'TRADING',
    'strategy_delete': 'TRADING',
    // MARKET_ANALYSIS
    'token_info': 'MARKET_ANALYSIS',
    'token_search': 'MARKET_ANALYSIS',
    'token_detail': 'MARKET_ANALYSIS',
    'token_chart': 'MARKET_ANALYSIS',
    'token_trending': 'MARKET_ANALYSIS',
    'market_data': 'MARKET_ANALYSIS',
    'market_overview': 'MARKET_ANALYSIS',
    'market_chains': 'MARKET_ANALYSIS',
    'market_protocols': 'MARKET_ANALYSIS',
    'wallet_info': 'MARKET_ANALYSIS',
    'wallet_balance': 'MARKET_ANALYSIS',
    'wallet_transactions': 'MARKET_ANALYSIS',
    // SOCIAL_SENSING
    'social_trending': 'SOCIAL_SENSING',
    'social_user_info': 'SOCIAL_SENSING',
    // RISK_SCAN
    'token_security': 'RISK_SCAN',
    // GENERAL_CHAT
    'general_query': 'GENERAL_CHAT',
};

const DETAILED_INTENT_SYSTEM_PROMPT = `You are an AI assistant that helps users interact with Web3 DeFi protocols. Your job is to understand user intent and convert it to structured JSON.

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
- social_trending: Get trending social media posts (Farcaster)
- social_user_info: Get Farcaster user information
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
- Don't guess addresses. Only use what is explicitly provided.`;

/**
 * Detect contract address pattern
 */
function detectContractAddress(text: string): string | null {
    // EVM address: 0x + 40 hex
    const evmPattern = /0x[a-fA-F0-9]{40}/i;
    const evmMatch = text.match(evmPattern);
    if (evmMatch) return evmMatch[0];

    // Solana address: base58, 32-44 chars
    const solanaPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    const words = text.split(/\s+/);

    for (const word of words) {
        if (solanaPattern.test(word) && word.length >= 32 && word.length <= 44) {
            const hasMultipleVowels = (word.match(/[aeiou]/gi) || []).length > 3;
            if (!hasMultipleVowels || word.length > 40) {
                return word;
            }
        }
    }

    return null;
}

/**
 * Detect swap keywords
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
 * Extract token symbols from message
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

    // Pattern: "ETH to USDC" or "swap ETH for USDC"
    // IMPORTANT: Only match if both sides are actual token symbols, not numbers
    // "buy 0xabc for 0.01 BNB" should NOT match "0.01" as tokenIn
    const toPattern = /\b([A-Z]{2,10})\s+(?:to|for|->)\s+([A-Z]{2,10})\b/i;
    const toMatch = text.match(toPattern);
    if (toMatch) {
        const maybeTokenIn = toMatch[1].toUpperCase();
        const maybeTokenOut = toMatch[2].toUpperCase();
        // Only use if they look like token symbols (not numbers)
        if (commonTokens.includes(maybeTokenIn) || commonTokens.includes(maybeTokenOut)) {
            return {
                tokenIn: maybeTokenIn,
                tokenOut: maybeTokenOut,
            };
        }
    }

    // Pattern: "buy X for Y BNB" - the native token is what we're spending
    // In this case, BNB is tokenIn, and X (contract address) is tokenOut
    const buyForPattern = /\bfor\s+([\d.]+)\s+(ETH|BNB|SOL|MATIC|AVAX)\b/i;
    const buyForMatch = text.match(buyForPattern);
    if (buyForMatch) {
        const nativeToken = buyForMatch[2].toUpperCase();
        return {
            tokenIn: nativeToken,
            tokenOut: undefined, // Will be set from contract address
        };
    }

    if (found.length >= 2) {
        return {
            tokenIn: found[0],
            tokenOut: found[1],
        };
    }

    // If only one token found and it's a native token, it's likely tokenIn for a buy
    if (found.length === 1 && ['ETH', 'BNB', 'SOL', 'MATIC', 'AVAX'].includes(found[0])) {
        return {
            tokenIn: found[0],
            tokenOut: undefined,
        };
    }

    return {};
}

/**
 * Parse high-level intent using simple heuristics (fast, no API call)
 */
function parseHighLevelIntentHeuristic(
    userMessage: string,
    userContext?: UserContext
): HighLevelIntent {
    const lowerMessage = userMessage.toLowerCase();
    const contractAddress = detectContractAddress(userMessage);
    const hasSwap = hasSwapKeywords(userMessage);
    const tokenSymbols = extractTokenSymbols(userMessage);

    // TRADING intent
    if (hasSwap || contractAddress || (tokenSymbols.tokenIn && tokenSymbols.tokenOut)) {
        return {
            type: 'TRADING',
            confidence: 0.9,
        };
    }

    // RISK_SCAN intent
    if (/\b(risk|safe|honeypot|security|scan|check.*safe|is.*safe)\b/i.test(userMessage)) {
        return {
            type: 'RISK_SCAN',
            confidence: 0.85,
        };
    }

    // SOCIAL_SENSING intent
    if (/\b(trending|social|farcaster|twitter|sentiment|what.*people|what.*saying)\b/i.test(userMessage)) {
        return {
            type: 'SOCIAL_SENSING',
            confidence: 0.8,
        };
    }

    // MARKET_ANALYSIS intent
    if (/\b(price|chart|trending|volume|liquidity|market.*cap|token.*info|token.*data)\b/i.test(userMessage)) {
        return {
            type: 'MARKET_ANALYSIS',
            confidence: 0.75,
        };
    }

    // Default to GENERAL_CHAT
    return {
        type: 'GENERAL_CHAT',
        confidence: 0.5,
    };
}

/**
 * Parse detailed intent using AI (DeepSeek API)
 */
async function parseDetailedIntentAI(
    userMessage: string,
    userContext?: UserContext
): Promise<DetailedIntent> {
    const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

    if (!DEEPSEEK_API_KEY) {
        console.warn('[IntentParser] DEEPSEEK_API_KEY not set, falling back to heuristic');
        return parseDetailedIntentHeuristic(userMessage, userContext);
    }

    // Build context-aware system prompt
    let systemPrompt = DETAILED_INTENT_SYSTEM_PROMPT;
    if (userContext?.chainId && userContext?.chainName) {
        systemPrompt += `\n\nUSER CONTEXT: \n- Current Chain: ${userContext.chainName} (ID: ${userContext.chainId}) \n - Wallet Connected: ${userContext.isWalletConnected ? 'Yes' : 'No'} \n\nIMPORTANT: Default to chain_id ${userContext.chainId} (${userContext.chainName}) unless the user explicitly mentions another network.`;
    }

    const messages = [
        {
            role: 'system' as const,
            content: systemPrompt,
        },
        {
            role: 'user' as const,
            content: userMessage,
        },
    ];

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY} `,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                temperature: 0.3, // Lower temperature for more consistent JSON
                max_tokens: 500,
                enable_search: false, // Disable search tools for intent parsing
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[IntentParser] DeepSeek API error:', error);
            return parseDetailedIntentHeuristic(userMessage, userContext);
        }

        const data = await response.json() as any;
        const content = data.choices[0]?.message?.content || '{}';

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

        const intent: DetailedIntent = JSON.parse(jsonStr);

        // Validate and enhance intent
        if (!intent.intent_id) {
            intent.intent_id = uuidv4();
        }
        if (!intent.version) {
            intent.version = '1.0';
        }
        if (!intent.origin) {
            intent.origin = 'chat';
        }

        // Enhance swap intent with detected information
        const contractAddress = detectContractAddress(userMessage);
        const hasSwap = hasSwapKeywords(userMessage);
        const tokenSymbols = extractTokenSymbols(userMessage);

        if (intent.action === 'swap' || hasSwap || contractAddress) {
            // If AI didn't detect swap but we did, override it
            if (intent.action !== 'swap' && (hasSwap || contractAddress)) {
                intent.action = 'swap';
            }

            // Fill in missing swap fields from detection
            if (contractAddress) {
                intent.token_address = contractAddress;
                if (!intent.token_out) {
                    intent.token_out = contractAddress;
                }

                // Detect if this is a Solana address
                const isSolanaAddress = !contractAddress.startsWith('0x') &&
                    contractAddress.length >= 32 &&
                    contractAddress.length <= 44 &&
                    /^[1-9A-HJ-NP-Za-km-z]+$/.test(contractAddress);

                if (isSolanaAddress && !intent.chain_id) {
                    intent.chain_id = 900;
                }

                // CRITICAL FIX: Ensure tokenIn is not the same as tokenOut
                if (!intent.token_in || intent.token_in === contractAddress) {
                    intent.token_in = isSolanaAddress ? 'SOL' : 'ETH';
                }
            }

            if (!intent.token_in && tokenSymbols.tokenIn) {
                intent.token_in = tokenSymbols.tokenIn;
            }
            if (!intent.token_out && tokenSymbols.tokenOut) {
                intent.token_out = tokenSymbols.tokenOut;
            }

            // FINAL VALIDATION: Ensure tokenIn and tokenOut are different
            if (intent.token_in === intent.token_out) {
                console.warn('[IntentParser] AI set tokenIn === tokenOut, fixing...');
                if (contractAddress) {
                    intent.token_out = contractAddress;
                    const isSolanaAddress = !contractAddress.startsWith('0x');
                    intent.token_in = isSolanaAddress ? 'SOL' : 'ETH';
                }
            }

            if (!intent.amount) {
                // Try to extract amount with various patterns
                const amountPatterns = [
                    /(\d+\.?\d*)\s*(?:USDC|ETH|SOL|USDT|BNB)/i,
                    /swap\s+(\d+\.?\d*)/i,
                    /buy\s+(\d+\.?\d*)/i,
                    /(\d+\.?\d*)\s*(?:to|for)/i
                ];

                for (const pattern of amountPatterns) {
                    const match = userMessage.match(pattern);
                    if (match) {
                        intent.amount = match[1];
                        // Try to extract the asset from the same match
                        const assetMatch = userMessage.match(/(\d+\.?\d*)\s*(USDC|ETH|SOL|USDT|BNB)/i);
                        if (assetMatch) {
                            intent.amount_asset = assetMatch[2].toUpperCase();
                        }
                        break;
                    }
                }
            }
        }

        // Set default chain_id if not provided
        if (!intent.chain_id && userContext?.chainId) {
            intent.chain_id = userContext.chainId;
        }

        return intent;
    } catch (error: any) {
        console.error('[IntentParser] Error parsing intent with AI:', error);
        return parseDetailedIntentHeuristic(userMessage, userContext);
    }
}

/**
 * Parse detailed intent using heuristics (fallback)
 */
function parseDetailedIntentHeuristic(
    userMessage: string,
    userContext?: UserContext
): DetailedIntent {
    const contractAddress = detectContractAddress(userMessage);
    const hasSwap = hasSwapKeywords(userMessage);
    const tokenSymbols = extractTokenSymbols(userMessage);
    const isSolana = contractAddress && !contractAddress.startsWith('0x') && contractAddress.length >= 32;

    // Default intent
    let action: DetailedIntentType = 'general_query';
    let tokenIn: string | undefined;
    let tokenOut: string | undefined;
    let amount: string | undefined;
    let isSellOperation = false;

    // Detect swap
    if (hasSwap || contractAddress || (tokenSymbols.tokenIn && tokenSymbols.tokenOut)) {
        action = 'swap';

        // Detect if this is a SELL operation (selling the contract address token)
        isSellOperation = /\b(sell|卖)\b/i.test(userMessage) && !!contractAddress;

        // Detect native token based on chain
        const isBsc = /\bBNB\b/i.test(userMessage) || userContext?.chainId === 56;
        const nativeToken = isSolana ? 'SOL' : (isBsc ? 'BNB' : 'ETH');

        if (isSellOperation) {
            // Selling: contract address is tokenIn, native token is tokenOut
            tokenIn = contractAddress || undefined;
            tokenOut = tokenSymbols.tokenOut || nativeToken;
        } else {
            // Buying: native token is tokenIn, contract address is tokenOut
            tokenIn = tokenSymbols.tokenIn || nativeToken;
            tokenOut = contractAddress || tokenSymbols.tokenOut;
        }

        // CRITICAL FIX: Ensure tokenIn and tokenOut are different
        // Use case-insensitive comparison for addresses
        const tokenInLower = tokenIn?.toLowerCase();
        const tokenOutLower = tokenOut?.toLowerCase();
        if (tokenInLower && tokenOutLower && tokenInLower === tokenOutLower) {
            console.warn('[IntentParser] tokenIn and tokenOut are the same (case-insensitive), fixing...');
            if (contractAddress) {
                // If we have a contract address, it should be tokenOut (buying)
                tokenOut = contractAddress;
                // Detect native token based on context - check for BNB mention
                const isBsc = /\bBNB\b/i.test(userMessage) || userContext?.chainId === 56;
                tokenIn = isSolana ? 'SOL' : (isBsc ? 'BNB' : 'ETH');
            }
        }

        // Parse amount - support percentage and quantity keywords
        // Priority: explicit percentage > quantity keywords > numeric values

        // Check for percentage keywords (all, half, quarter, etc.)
        const percentageKeywords: { [key: string]: string } = {
            // English keywords
            'all': 'all',
            '100%': 'all',
            '100': 'all',  // Only if followed by %
            'half': '50%',
            '50%': '50%',
            'quarter': '25%',
            '25%': '25%',
            '75%': '75%',
            '10%': '10%',
            '20%': '20%',
            '30%': '30%',
            '40%': '40%',
            '60%': '60%',
            '70%': '70%',
            '80%': '80%',
            '90%': '90%',
            // Chinese keywords
            '全部': 'all',
            '一半': '50%',
            '四分之一': '25%',
            '四分之三': '75%',
        };

        // First check for percentage patterns
        const percentMatch = userMessage.match(/\b(\d{1,3})%/);
        if (percentMatch) {
            const percent = parseInt(percentMatch[1]);
            if (percent > 0 && percent <= 100) {
                amount = percent === 100 ? 'all' : `${percent}%`;
            }
        }

        // Check for keyword-based percentages
        if (!amount) {
            for (const [keyword, value] of Object.entries(percentageKeywords)) {
                // Use word boundary for English, direct match for Chinese
                const isChineseKeyword = /[\u4e00-\u9fff]/.test(keyword);
                const pattern = isChineseKeyword
                    ? new RegExp(keyword, 'i')
                    : new RegExp(`\\b${keyword}\\b`, 'i');

                if (pattern.test(userMessage)) {
                    amount = value;
                    break;
                }
            }
        }

        // Fall back to numeric amount parsing
        if (!amount) {
            amount = userMessage.match(/(\d+\.?\d*)\s*(?:USDC|ETH|SOL|USDT|BNB)/i)?.[1] ||
                userMessage.match(/for\s+(\d+\.?\d*)\s*(?:USDC|ETH|SOL|USDT|BNB)/i)?.[1] ||
                userMessage.match(/swap\s+(\d+\.?\d*)/i)?.[1] ||
                userMessage.match(/(?:buy|sell)\s+(\d+\.?\d*)/i)?.[1] ||
                userMessage.match(/(\d+\.?\d*)\s+(?:worth|of)/i)?.[1];
        }

        console.log('[IntentParser] Amount parsing result:', {
            rawMessage: userMessage.slice(0, 50),
            parsedAmount: amount,
            isSellOperation: isSellOperation
        });
    }
    // Detect token security
    else if (/\b(risk|safe|honeypot|security|scan|check.*safe|is.*safe)\b/i.test(userMessage)) {
        action = 'token_security';
    }
    // Detect token info
    else if (/\b(price|chart|info|data|detail).*(?:token|coin|eth|btc|usdc)\b/i.test(userMessage)) {
        action = 'token_info';
    }
    // Detect trending
    else if (/\b(trending|hot|popular|top)\b/i.test(userMessage)) {
        if (/\b(social|farcaster|twitter)\b/i.test(userMessage)) {
            action = 'social_trending';
        } else {
            action = 'token_trending';
        }
    }
    // Detect wallet
    else if (/\b(wallet|balance|transaction)\b/i.test(userMessage)) {
        if (/\b(balance)\b/i.test(userMessage)) {
            action = 'wallet_balance';
        } else if (/\b(transaction|tx|history)\b/i.test(userMessage)) {
            action = 'wallet_transactions';
        } else {
            action = 'wallet_info';
        }
    }
    // Detect market
    else if (/\b(market|overview|chains|protocols)\b/i.test(userMessage)) {
        if (/\b(overview|summary)\b/i.test(userMessage)) {
            action = 'market_overview';
        } else if (/\b(chains|blockchain)\b/i.test(userMessage)) {
            action = 'market_chains';
        } else if (/\b(protocols|defi)\b/i.test(userMessage)) {
            action = 'market_protocols';
        } else {
            action = 'market_data';
        }
    }

    return {
        version: '1.0',
        intent_id: uuidv4(),
        origin: 'chat',
        action,
        token_address: contractAddress || undefined,
        token_symbol: tokenSymbols.tokenOut,
        chain_id: isSolana ? 900 : (userContext?.chainId || 1),
        token_in: tokenIn,
        token_out: tokenOut,
        amount,
        amount_asset: amount ? (isSellOperation ? tokenIn : (tokenOut || 'USDC')) : undefined,
    };
}

/**
 * Main intent parser (hybrid: heuristic + AI fallback)
 */
export async function parseIntent(
    userMessage: string,
    userContext?: UserContext
): Promise<ParsedIntent> {
    // Step 1: Parse high-level intent (always use heuristic - fast)
    const highLevel = parseHighLevelIntentHeuristic(userMessage, userContext);

    // Step 2: Parse detailed intent
    let detailed: DetailedIntent;

    // Use AI if:
    // - Confidence is low (< 0.7)
    // - Message is complex (long or contains multiple concepts)
    const shouldUseAI = highLevel.confidence < 0.7 ||
        userMessage.length > 100 ||
        /(?:and|also|then|after|when)/i.test(userMessage);

    if (shouldUseAI) {
        console.log('[IntentParser] Using AI for detailed intent parsing');
        detailed = await parseDetailedIntentAI(userMessage, userContext);
    } else {
        console.log('[IntentParser] Using heuristic for detailed intent parsing');
        detailed = parseDetailedIntentHeuristic(userMessage, userContext);
    }

    // Step 3: Map detailed intent to high-level (if mismatch, trust detailed)
    const mappedHighLevel = DETAILED_TO_HIGH_LEVEL[detailed.action] || highLevel.type;
    if (mappedHighLevel !== highLevel.type) {
        console.log(`[IntentParser] High-level intent corrected: ${highLevel.type} -> ${mappedHighLevel}`);
        highLevel.type = mappedHighLevel;
    }

    // Step 4: Extract additional metadata
    // CRITICAL: Force regex result over AI hallucination
    // The AI sometimes invents addresses (e.g., 0x123...) when none are provided
    // We ONLY trust what the regex explicitly finds in the user's message
    const contractAddress = detectContractAddress(userMessage);
    const tokenSymbols = extractTokenSymbols(userMessage);

    return {
        highLevel,
        detailed,
        contractAddress: contractAddress || undefined, // IGNORE detailed.token_address
        chainId: detailed.chain_id,
        swapIntent: detailed.action === 'swap' ? {
            tokenIn: detailed.token_in,
            tokenOut: detailed.token_out,
            amount: detailed.amount,
        } : undefined,
    };
}

// Export types for backward compatibility
export type IntentType = HighLevelIntentType;
