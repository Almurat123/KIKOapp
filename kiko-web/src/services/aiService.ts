/**
 * AI Service
 * Main service for AI interactions, combining DeepSeek API and Intent parsing
 */

import { chatCompletion, streamChatCompletion, type DeepSeekMessage } from './deepseek';
import { parseIntent, getIntentDescription, type Intent, type IntentType } from './intentParser';

export interface AIResponse {
  content: string;
  intent?: Intent;
  intentType?: IntentType;
  shouldShowCard?: boolean;
  cardData?: any;
}

const CHAT_SYSTEM_PROMPT = `You are KIKO, an AI assistant for Web3 DeFi operations. You help users:
- Query token information (price, liquidity, volume, risk)
- Execute token swaps
- Set up automated trading strategies
- Analyze market data
- Answer questions about DeFi and blockchain

Important principles:
- You provide information and execute user commands, but never make investment decisions
- You don't predict prices or give investment advice
- You explain risks clearly
- You use clear, concise language
- When showing token data, format it nicely

When the user asks about a token, provide comprehensive information including:
- Current price and 24h change
- Liquidity and trading volume
- Risk assessment
- Recent transaction activity

Be helpful, accurate, and safety-focused.`;

/**
 * Generate AI response with intent parsing
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'ai'; content: string }> = [],
  conversationId?: string
): Promise<AIResponse> {
  try {
    // Parse intent first
    const intent = await parseIntent(userMessage, conversationId);

    // Build conversation context
    const messages: DeepSeekMessage[] = [
      {
        role: 'system',
        content: CHAT_SYSTEM_PROMPT,
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
    const response = await chatCompletion(messages, {
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';

    // Determine if we should show a card based on intent
    const shouldShowCard = intent.action === 'token_info' && intent.token_symbol;
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
    console.error('AI service error:', error);
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
 * Stream AI response with intent parsing
 */
export async function* streamAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'ai'; content: string }> = [],
  conversationId?: string
): AsyncGenerator<{ content: string; intent?: Intent }, void, unknown> {
  try {
    // Parse intent first
    const intent = await parseIntent(userMessage, conversationId);

    // Build conversation context
    const messages: DeepSeekMessage[] = [
      {
        role: 'system',
        content: CHAT_SYSTEM_PROMPT,
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

    // Stream response
    let fullContent = '';
    for await (const chunk of streamChatCompletion(messages, {
      temperature: 0.7,
      max_tokens: 2000,
    })) {
      fullContent += chunk;
      yield { content: chunk, intent: fullContent.length < 50 ? intent : undefined };
    }

    // Yield final intent after streaming completes
    yield { content: '', intent };
  } catch (error) {
    console.error('AI streaming error:', error);
    yield {
      content: 'I apologize, but I encountered an error. Please try again.',
      intent: {
        version: '1.0',
        intent_id: `error-${Date.now()}`,
        origin: 'chat',
        action: 'general_query',
        query: userMessage,
      },
    };
  }
}

/**
 * Get intent description for display
 */
export { getIntentDescription } from './intentParser';

