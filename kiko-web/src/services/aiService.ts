/**
 * AI Service
 * Main service for AI interactions, combining DeepSeek API and Intent parsing
 */

import { chatCompletion, streamChatCompletion, getModelName, type DeepSeekMessage } from './deepseek';
import { streamChatCompletion as xaiStreamChatCompletion, getXaiModelName, getRecommendedMaxTokens as getXaiRecommendedMaxTokens, type XaiMessage, type ToolConfig } from './xai';
import { parseIntent, type Intent, type IntentType } from './intentParser';
import { buildContextPrompt, GROK_CORE_PROMPT, DEEPSEEK_CORE_PROMPT } from '../config/aiPrompts';
import { AIApiService } from './aiApiService';
import { AIExtendedIntentParser } from './aiExtendedIntentParser';
import { logger } from '../utils/logger';

// Types that have their own API handlers in AIApiService
const typesWithOwnHandlersInApi = ['TOKEN_SECURITY', 'RISK_ASSESSMENT'];
export interface StreamResponse {
  content: string;
  intent?: Intent;
  citations?: Array<{ url: string; avatar_url?: string }>;
  tool_call?: string;
  tool_status?: string;
  reasoning_content?: string;
  client_actions?: any[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
export interface AIResponse {
  content: string;
  intent?: Intent;
  intentType?: IntentType;
  shouldShowCard?: boolean;
  cardData?: any;
}

export interface UserContext {
  userAddress?: string;
  chainId?: number;
  chainName?: string;
  isWalletConnected?: boolean;
  recentTrades?: number;
  balance?: Record<string, string>;
  nativeBalance?: string;
}

/**
 * Generate AI response with intent parsing
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  conversationId?: string,
  userContext?: UserContext
): Promise<AIResponse> {
  try {
    // Parse intent first
    logger.intent('parse', { message: userMessage });
    const intent = await parseIntent(userMessage, conversationId, userContext);
    logger.intent('result', { action: intent.action });

    // Build system prompt with user context
    // Default to DeepSeek prompt for generateAIResponse as it doesn't take modelId yet
    let systemPrompt = DEEPSEEK_CORE_PROMPT;
    if (userContext) {
      const contextPrompt = buildContextPrompt(userContext);
      systemPrompt += contextPrompt;
    }

    // Build conversation context
    const messages: DeepSeekMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Generate response
    // Note: generateAIResponse doesn't currently accept model params
    // If needed, add modelId and mode parameters to this function
    // Using default model (deepseek-chat) with recommended settings for chat
    logger.ai('request', 'DeepSeek-V3.2', { temperature: 0.8 });
    const response = await chatCompletion(messages, {
      temperature: 0.8, // Better for conversational chat
      enable_search: true, // Enable tools (gas_price, token_info, etc.)
      chain_context: userContext?.chainId && userContext?.chainName ? {
        chainId: userContext.chainId,
        chainName: userContext.chainName
      } : undefined
    });
    logger.ai('response', 'DeepSeek-V3.2', { tokens: response.usage?.total_tokens });

    const content = response.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';

    // Determine if we should show a card based on intent
    const shouldShowCard = !!(intent.action === 'token_info' && intent.token_symbol);
    const cardData = shouldShowCard ? {
      symbol: intent.token_symbol,
      // In real implementation, fetch actual data from market APIs
      // For now, return placeholder structure
    } : undefined;

    return {
      content,
      intent,
      intentType: intent.action,
      shouldShowCard,
      cardData,
    };
  } catch (error) {
    logger.error('AI', 'AI service error', error);
    return {
      content: 'I apologize, but I encountered an error. Please try again.',
      intent: {
        version: '1.0',
        intent_id: `error-${Date.now()}`,
        origin: 'chat',
        action: 'general_query',
        query: userMessage,
      },
      intentType: 'general_query',
    };
  }
}

/**
 * Generate intelligent tool configuration based on user message
 */
function generateToolConfig(userMessage: string): ToolConfig | undefined {
  const toolConfig: ToolConfig = {};

  // Crypto/Trading related keywords
  const isCryptoRelated = /\b(crypto|bitcoin|btc|ethereum|eth|token|coin|swap|trade|defi|nft|blockchain|price|market)\b/i.test(userMessage);

  // News/Research keywords
  const isNewsRelated = /\b(news|latest|recent|update|announcement|happening|trend)\b/i.test(userMessage);

  // Social/Sentiment keywords
  const isSocialRelated = /\b(twitter|x\.com|tweet|post|social|sentiment|opinion|discussion)\b/i.test(userMessage);

  // Configure web_search
  if (isCryptoRelated) {
    toolConfig.web_search = {
      allowed_domains: [
        'bloomberg.com',
        'reuters.com',
        'cointelegraph.com',
        'coindesk.com',
        'beincrypto.com'
      ].slice(0, 5), // Max 5 domains - using official Grok's recommended sources
      enable_image_understanding: false // Faster without image processing
    };
  }

  // Configure x_search with date filter for recent content
  if (isNewsRelated || isSocialRelated) {
    // Shortened to 3 days for faster search
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    toolConfig.x_search = {
      from_date: threeDaysAgo.toISOString().split('T')[0], // YYYY-MM-DD format
      enable_image_understanding: false,
      enable_video_understanding: false // Faster without media processing
    };

    // Add crypto-related X handles if it's crypto + social
    if (isCryptoRelated) {
      toolConfig.x_search.allowed_x_handles = [
        'VitalikButerin',
        'cz_binance',
        'coinbase',
        'ethereum',
        'bitcoin'
      ].slice(0, 5); // Max 5 handles
    }
  }

  // Return undefined if no config was set (use defaults)
  return Object.keys(toolConfig).length > 0 ? toolConfig : undefined;
}

/**
 * Check if message is a simple greeting that doesn't need search
 */
function isSimpleGreeting(message: string): boolean {
  const greetingPatterns = [
    /^(hi|hello|hey|yo|gm|gn)\b/i,
    /^(how are you|what's up|sup)\b/i,
    /^(thanks|thank you|ty)\b/i,
    /^(bye|goodbye|see you|later)\b/i,
  ];

  return greetingPatterns.some(pattern => pattern.test(message.trim()));
}

/**
 * Stream AI response with intent parsing
 * Supports reasoning_content for thinking mode
 */
export interface CustomAISettings {
  aiRole: string;
  userRole: string;
  autoExplain: boolean;
  additionalInstructions: string;
  defaultSwapAmount: number;
  defaultSwapUnit: string;
  checkTokenBeforeSwap: boolean;


}

export async function* streamAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'ai'; content: string }> = [],
  conversationId?: string,
  signal?: AbortSignal,
  userContext?: UserContext,
  modelId?: string,
  mode?: string,
  customSettings?: CustomAISettings
): AsyncGenerator<StreamResponse, void, unknown> {
  try {
    // Yield initial status
    yield { content: '', tool_status: 'Analyzing request...' };

    // Parse intent first
    const intent = await parseIntent(userMessage, conversationId, userContext);

    // If intent has a contract address, detect which chain it's on and update chain_id
    const contractAddress = intent.token_out?.match(/^0x[a-fA-F0-9]{40}$/) ? intent.token_out :
      intent.token_address?.match(/^0x[a-fA-F0-9]{40}$/) ? intent.token_address :
        null;

    console.log('[aiService] Contract address detection:', { contractAddress, token_out: intent.token_out, token_address: intent.token_address });

    if (contractAddress && intent.action === 'swap') {
      try {
        yield { content: '', tool_status: 'Checking contract address...' };
        const { findTokenOnAnyChain } = await import('./tokenDataService');
        console.log('[aiService] Calling findTokenOnAnyChain for:', contractAddress);
        const tokenData = await findTokenOnAnyChain(contractAddress);
        console.log('[aiService] findTokenOnAnyChain result:', tokenData);
        if (tokenData && tokenData.chainId) {
          console.log(`[aiService] Updating intent.chain_id from ${intent.chain_id} to ${tokenData.chainId}`);
          intent.chain_id = tokenData.chainId;
        } else {
          console.warn('[aiService] No chainId found in tokenData');
        }
      } catch (error) {
        console.warn('[aiService] Failed to detect chain for contract address:', error);
      }
    }

    // Check for "thinking" or Grok models to determine prompt
    const isGrokModel = (modelId ?? '').startsWith('grok-');

    // Select correct system prompt based on model
    // This resolves the "thinking mistake" issue by strictly separating personas
    const BASE_SYSTEM_PROMPT = isGrokModel ? GROK_CORE_PROMPT : DEEPSEEK_CORE_PROMPT;

    // Build system prompt with user context
    // Note: SAFETY_PROMPT is already included in CORE_PROMPT definitions now, 
    // but FULL_SYSTEM_PROMPT legacy usage might rely on it. 
    // Since we are using specific CORE prompts which include SAFETY, we don't need to append it again 
    // UNLESS we want to be doubly sure or if the CORE definitions change.
    // Looking at aiPrompts.ts:
    // DEEPSEEK_CORE_PROMPT = IDENTITY + SAFETY + RULES
    // GROK_CORE_PROMPT = IDENTITY + SAFETY + RULES
    // so we just use the BASE_SYSTEM_PROMPT.

    let systemPrompt = BASE_SYSTEM_PROMPT;

    // Add Grok thinking mode instructions if using reasoning/thinking mode
    console.log('[aiService] Model ID:', modelId, 'Mode:', mode);
    // Check both modelId and mode to determine if we should add thinking instructions
    const grokReasoningModelIds = new Set([
      'grok-4-1-fast-reasoning',
      'grok-4-reasoning',
    ]);
    // isGrokModel is already defined above
    const isGrokThinkingMode = isGrokModel && (
      mode === 'thinking' || grokReasoningModelIds.has(modelId ?? '')
    );

    // Grok thinking mode - feature abandoned, no special prompts needed
    // The model will output directly
    if (isGrokThinkingMode) {
      console.log('[aiService] Grok thinking mode - no special prompts (feature disabled)');
    } else {
      console.log('[aiService] Not using thinking mode. Mode:', mode, 'Model:', modelId);

      // For Grok Fast mode (which has no tools enabled in backend), explicitly forbid tool usage
      // This prevents the model from hallucinating tool calls like <tool>check_token_risk</tool>
      if (isGrokModel && (mode === 'fast' || modelId?.includes('fast')) && !modelId?.includes('reasoning')) {
        console.log('[aiService] Adding Grok Fast mode PARTIAL-TOOL instructions');
        systemPrompt += `\n\nCRITICAL SYSTEM NOTE: You are in FAST MODE.You HAVE access to Web Search and X Search.Use them for market data / prices.You do NOT have access to internal tools(check_token_risk, etc).Do NOT output < tool > tags for internal tools.`;
      }
    }

    if (userContext) {
      const contextPrompt = buildContextPrompt(userContext);
      systemPrompt += contextPrompt;
    }

    // Add custom settings to system prompt
    if (customSettings) {
      console.log('[aiService] Applying custom AI settings');
      let customInstructions = '\n\n[Custom User Preferences]';

      if (customSettings.aiRole && customSettings.aiRole !== 'default') {
        const roleMap: Record<string, string> = {
          'crypto_analyst': 'an expert Crypto Analyst',
          'defi_expert': 'a DeFi Expert',
          'nft_collector': 'an avid NFT Collector',
          'auditor': 'a Smart Contract Auditor',
          'beginner': 'a Beginner',
          'trader': 'a Trader',
          'developer': 'a Developer'
        };
        const roleName = roleMap[customSettings.aiRole] || customSettings.aiRole;
        customInstructions += `\nAct as ${roleName}.`;
      }

      if (customSettings.userRole && customSettings.userRole !== 'default') {
        const roleMap: Record<string, string> = {
          'beginner': 'a Beginner in crypto',
          'trader': 'an experienced Trader',
          'developer': 'a Developer'
        };
        const roleName = roleMap[customSettings.userRole] || customSettings.userRole;
        customInstructions += `\nThe user is ${roleName}. Adjust your explanation accordingly.`;
      }

      if (customSettings.autoExplain) {
        customInstructions += `\nAuto - explain: Always explain technical terms and jargon in simple terms.`;
      }

      if (customSettings.additionalInstructions) {
        customInstructions += `\nAdditional Instructions: ${customSettings.additionalInstructions} `;
      }

      if (customSettings.checkTokenBeforeSwap) {
        customInstructions += `\nSecurity Check: Always check token security and risk before suggesting a swap.`;
      }





      if (customSettings.defaultSwapAmount) {
        customInstructions += `\nDefault Swap Amount: ${customSettings.defaultSwapAmount} (Native Token).`;
      }

      systemPrompt += customInstructions;
    }


    // Check for contract addresses in user message and fetch info
    const contractAddressMatch = userMessage.match(/0x[a-fA-F0-9]{40}/);
    if (contractAddressMatch) {
      const address = contractAddressMatch[0];
      try {
        const { getTokenData, findTokenOnAnyChain } = await import('./tokenDataService');
        // Default to Ethereum (1) if no chain specified, or try to detect from context
        const chainId = userContext?.chainId || 1;

        // Try current chain first
        let tokenData = await getTokenData(address, chainId);

        // If not found, try global search
        if (!tokenData || tokenData.symbol === 'UNKNOWN') {
          const globalToken = await findTokenOnAnyChain(address);
          if (globalToken) {
            tokenData = globalToken;
          }
        }

        if (tokenData && tokenData.symbol !== 'UNKNOWN') {
          systemPrompt += `\n\n[Token Context]\nUser mentioned token: ${address} \nSymbol: ${tokenData.symbol} \nName: ${tokenData.name} \nChain ID: ${tokenData.chainId} \nPrice: $${tokenData.price || 'Unknown'} \nMarket Cap: $${tokenData.marketCap || 'Unknown'} \n24h Change: ${tokenData.priceChange24h || 0}%\n`;
        }
      } catch (error) {
        console.warn('[aiService] Failed to fetch token info for context:', error);
      }
    }

    // Build conversation context
    const messages: DeepSeekMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Check if we should call an API based on intent
    // For swap intents, also call API to get quote and balance info
    const shouldCallApi = intent.action !== 'general_query' &&
      (intent.action.startsWith('news_') ||
        intent.action.startsWith('social_') ||
        intent.action.startsWith('market_') ||
        intent.action.startsWith('token_') ||
        intent.action.startsWith('wallet_') ||
        intent.action === 'swap'); // Include swap to get quote

    let apiData: any = null;
    if (shouldCallApi) {
      try {
        // Parse extended intent for API calls
        const extendedIntent = await AIExtendedIntentParser.parseUserIntent(userMessage);
        const actionType = (extendedIntent?.type || extendedIntent?.action || 'UNKNOWN').toUpperCase();

        if (extendedIntent && actionType !== 'UNKNOWN' && (extendedIntent.apiEndpoint || typesWithOwnHandlersInApi.includes(actionType))) {
          yield { content: '', tool_status: `Fetching ${actionType.toLowerCase().replace(/_/g, ' ')}...` };
          const apiResponse = await AIApiService.callApiByIntent(extendedIntent);
          if (apiResponse.success && apiResponse.data) {
            apiData = apiResponse.data;
            // Add API data to system prompt for context
            systemPrompt += `\n\nAPI Response Data: \n${JSON.stringify(apiData, null, 2).slice(0, 2000)} `;
            // Rebuild messages with API data
            messages[0].content = systemPrompt;
          }
        } else if (intent.action === 'swap' && intent.token_in && intent.token_out && userContext?.userAddress) {
          // For swap, also get price data and balance
          try {
            const { getPriceData } = await import('./swapService');
            const { getUserBalance } = await import('./swapService');

            // Get token addresses
            const getTokenAddress = (symbolOrAddress: string, chainId: number): string => {
              // If it looks like an address, return it
              if (symbolOrAddress.startsWith('0x') && symbolOrAddress.length === 42) {
                return symbolOrAddress;
              }

              const tokenMap: Record<string, Record<number, string>> = {
                'ETH': { 1: '0x0000000000000000000000000000000000000000', 8453: '0x4200000000000000000000000000000000000006' },
                'USDC': { 1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
                'USDT': { 1: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
                'DAI': { 1: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
                'WBTC': { 1: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
                'WETH': { 1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
              };
              return tokenMap[symbolOrAddress.toUpperCase()]?.[chainId] || '';
            };

            const chainId = intent.chain_id || userContext.chainId || 1;
            // Use token_in/out directly to resolve address, fallback to token_address only if it matches
            let tokenInAddress = getTokenAddress(intent.token_in || '', chainId);
            const tokenOutAddress = getTokenAddress(intent.token_out || '', chainId);

            // Safety check: if tokenIn and tokenOut are the same, default tokenIn to USDC
            if (tokenInAddress && tokenOutAddress && tokenInAddress.toLowerCase() === tokenOutAddress.toLowerCase()) {
              console.warn('[aiService] tokenIn and tokenOut are identical, defaulting tokenIn to USDC');
              tokenInAddress = getTokenAddress('USDC', chainId);
            }

            if (tokenInAddress && tokenOutAddress) {
              yield { content: '', tool_status: 'Fetching swap prices...' };
              // Get prices
              const priceData = await getPriceData(tokenInAddress, tokenOutAddress, chainId);

              // Get balance for tokenIn
              const balance = await getUserBalance(userContext.userAddress, tokenInAddress, chainId);

              if (priceData || balance) {
                const swapInfo: any = {};
                if (priceData) {
                  swapInfo.prices = priceData;
                  swapInfo.estimatedAmountOut = intent.amount && priceData.tokenInPrice && priceData.tokenOutPrice
                    ? (parseFloat(intent.amount) * priceData.tokenOutPrice) / priceData.tokenInPrice
                    : null;
                }
                if (balance) {
                  // Convert hex balance to readable format
                  const balanceBigInt = balance.startsWith('0x') ? BigInt(balance) : BigInt(parseInt(balance));
                  const decimals = intent.token_in?.toUpperCase() === 'USDC' || intent.token_in?.toUpperCase() === 'USDT' ? 6 : 18;
                  swapInfo.userBalance = Number(balanceBigInt) / Math.pow(10, decimals);
                }

                systemPrompt += `\n\nSwap Information: \n${JSON.stringify(swapInfo, null, 2)} `;
                messages[0].content = systemPrompt;
              }
            }
          } catch (error) {
            console.error('[AI Service] Error fetching swap info:', error);
          }
        }
      } catch (error) {
        console.error('[AI Service] Error calling API:', error);
        // Continue without API data
      }
    }

    // Stream response
    // Determine which API to use based on modelId
    const isXaiModel = modelId?.startsWith('grok-');

    // Debug logging
    console.log('[aiService] Model selection:', { modelId, mode, isXaiModel });

    let fullContent = '';

    if (isXaiModel) {
      console.log('[aiService] Using X.ai API');
      // Use X.ai API
      try {
        const xaiModelName = getXaiModelName(modelId, mode);
        console.log('[aiService] X.ai model name:', xaiModelName);
        // Convert DeepSeekMessage format to XaiMessage format (they're compatible)
        const xaiMessages: XaiMessage[] = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        // Enable search tools via Python service
        console.log('[aiService] Calling xaiStreamChatCompletion');

        // CRITICAL: ALL Grok models should have search enabled
        // Backend (grok-service) handles the distinction:
        // - Fast models: ONLY web_search (x_search disabled for unreliable data)
        // - Reasoning models: Both web_search and x_search
        const isReasoningModel = xaiModelName.includes('reasoning') && !xaiModelName.includes('non-reasoning');

        // Enable search for ALL models EXCEPT simple greetings
        // Fast models will only get web_search from backend, not x_search
        const shouldEnableSearch = !isSimpleGreeting(userMessage);

        // Generate intelligent tool configuration based on user message
        const toolConfig = shouldEnableSearch ? generateToolConfig(userMessage) : undefined;
        if (toolConfig) {
          console.log('[aiService] Using intelligent tool config:', toolConfig);
        } else if (!shouldEnableSearch) {
          console.log('[aiService] Simple greeting detected - search disabled for faster response');
        }

        let xaiCitations: Array<{ url: string; avatar_url?: string }> | undefined;
        for await (const chunk of xaiStreamChatCompletion(xaiMessages, {
          // Use lower temperature for fast mode to reduce latency
          temperature: isReasoningModel ? 0.8 : 0.3, // Fast mode: 0.3 for speed, Reasoning: 0.8 for quality
          // Reduce max_tokens for fast mode to encourage quicker responses
          max_tokens: isReasoningModel ? getXaiRecommendedMaxTokens(xaiModelName) : 2048,
          model: xaiModelName,
          signal,
          enable_search: shouldEnableSearch, // Only enable for reasoning models
          tool_config: toolConfig, // Pass intelligent tool configuration
        })) {
          fullContent += chunk.content;
          // Collect citations from X.ai response
          if (chunk.citations) {
            xaiCitations = chunk.citations;
          }

          // Extract usage from Grok chunk if available
          const grokUsage = (chunk as any).usage ? {
            prompt_tokens: (chunk as any).usage.prompt_tokens || 0,
            completion_tokens: (chunk as any).usage.completion_tokens || 0,
            total_tokens: (chunk as any).usage.total_tokens || 0
          } : undefined;

          if (grokUsage) {
            console.log('[aiService] Grok usage data:', grokUsage);
          }

          yield {
            content: chunk.content,
            intent: fullContent.length < 50 ? intent : undefined,
            citations: xaiCitations,
            reasoning_content: (chunk as any).reasoning_content,
            tool_call: (chunk as any).tool_call,
            tool_status: (chunk as any).tool_status,
            client_actions: (chunk as any).client_actions,
            usage: grokUsage
          };
        }
      } catch (xaiError: any) {
        // If X.ai API fails (e.g., API key not set), throw error instead of falling back
        console.error('[aiService] X.ai API error:', xaiError);
        throw new Error(`X.ai API error: ${xaiError.message || 'Failed to call X.ai API. Please check your VITE_XAI_API_KEY environment variable.'} `);
      }
    } else {
      // Use DeepSeek API (default)
      console.log('[aiService] Using DeepSeek API');
      const modelName = getModelName(modelId, mode);

      // Enable tools if intent is token related or contains crypto keywords
      const isCryptoQuery = /\b(price|token|coin|market|chart|volume|trending|buy|sell|swap|contract|address)\b/i.test(userMessage);
      // IMPORTANT: fast 模式默认开启工具，除非是简单问候；避免意外被视为 enable_search=false
      // Fast 模式：仅在非问候且存在市场/代币意图时开启工具，避免过度调用
      const shouldEnableTools =
        !isSimpleGreeting(userMessage) &&
        (intent.action !== 'general_query' || isCryptoQuery);

      console.log('[aiService] Tool enable check (DeepSeek):', {
        intentAction: intent.action,
        isCryptoQuery,
        shouldEnableTools,
        isGreeting: isSimpleGreeting(userMessage)
      });

      // Configure allowed tools based on mode
      // Remove tool restrictions - allow all tools in both fast and thinking modes
      // Thinking mode only affects reasoning_content display, not tool availability
      let allowedTools: string[] | undefined = undefined; // undefined = no filter, allow all tools

      console.log('[aiService] Allowing ALL tools for mode:', mode);

      let deepseekCitations: string[] | undefined;

      for await (const chunk of streamChatCompletion(messages, {
        temperature: 0.8, // Better for conversational chat (0.8-0.9 range)
        // max_tokens will automatically use model's recommended default
        // (4K for chat, 32K for reasoner)
        model: modelName,
        signal,
        enable_search: shouldEnableTools, // Enable backend tool registry
        allowed_tools: allowedTools, // Apply tool restrictions
        chain_context: userContext?.chainId && userContext?.chainName ? {
          chainId: userContext.chainId,
          chainName: userContext.chainName
        } : undefined,
        walletAddress: userContext?.userAddress
      })) {
        // Collect citations from DeepSeek response
        if (chunk.citations && chunk.citations.length > 0) {
          deepseekCitations = chunk.citations;
          console.log('[aiService] DeepSeek citations received:', deepseekCitations.length, 'sources');
        }

        fullContent += chunk.content;

        // Convert citations to Grok-compatible format (array of objects with url)
        const formattedCitations = deepseekCitations?.map(url => ({ url }));

        // Extract usage from DeepSeek chunk if available
        const deepseekUsage = (chunk as any).usage ? {
          prompt_tokens: (chunk as any).usage.prompt_tokens || 0,
          completion_tokens: (chunk as any).usage.completion_tokens || 0,
          total_tokens: (chunk as any).usage.total_tokens || 0
        } : undefined;

        if (deepseekUsage) {
          console.log('[aiService] DeepSeek usage data:', deepseekUsage);
        }

        yield {
          content: chunk.content,
          intent: fullContent.length < 50 ? intent : undefined,
          citations: formattedCitations,
          reasoning_content: chunk.reasoning_content, // Pass thinking process to frontend
          client_actions: chunk.client_actions, // Pass client actions to frontend
          usage: deepseekUsage
        };
      }
    }

    // Yield final intent after streaming completes
    yield { content: '', intent };
  } catch (error: any) {
    // If aborted, don't yield error message - just stop
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      return;
    }

    // Log other errors with more details
    console.error('[aiService] AI streaming error:', error);
    console.error('[aiService] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    // Check if it's an X.ai API key error
    if (error.message?.includes('VITE_XAI_API_KEY')) {
      yield {
        content: `❌ X.ai API error: please check VITE_XAI_API_KEY is set.\n\nDetails: ${error.message} `,
        intent: {
          version: '1.0',
          intent_id: `error - ${Date.now()} `,
          origin: 'chat',
          action: 'general_query',
          query: userMessage,
        },
      };
    } else {
      yield {
        content: `❌ Error: ${error.message || 'Something went wrong, please try again later.'} `,
        intent: {
          version: '1.0',
          intent_id: `error - ${Date.now()} `,
          origin: 'chat',
          action: 'general_query',
          query: userMessage,
        },
      };
    }
  }
}

/**
 * Get intent description for display
 */
export { getIntentDescription } from './intentParser';

