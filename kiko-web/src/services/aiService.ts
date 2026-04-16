/**
 * AI Service
 * Main service for AI interactions (backend-orchestrated)
 */

// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Almurat
// Reason: the legacy one-shot AI helper can omit a model and then relies on the
//         OpenAI-compatible proxy fallback. That fallback now needs to read as
//         Kimi 2.5 Instant/Fast instead of GPT in logs and inline docs.
// Goal: prevent debugging output from suggesting GPT is still the product
//       default after the canonical default moved to Kimi Instant.
// Owns: frontend AI helper logging and fallback-call documentation.
// Does Not Own: model catalog selection, backend normalization, or provider
//               request construction.
// Design Language:
// - Log the actual fallback family used by the proxy helper.
// - Do not duplicate default model ids here; deepseek.ts owns that literal.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: frontend AI fallback logging/documentation
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md

import { chatCompletion, streamChatCompletion, getModelName, type DeepSeekMessage } from './deepseek';
import { streamChatCompletion as xaiStreamChatCompletion, getXaiModelName, getRecommendedMaxTokens as getXaiRecommendedMaxTokens, type XaiMessage } from './xai';
import type { Intent, IntentType } from './intentTypes';
import { logger } from '../utils/logger';

import { type AIStreamChunk, type AIClientAction, type AICitation } from './aiTypes';

// Export these for backward compatibility if needed by other files
export type { AIClientAction, AICitation };

export interface StreamResponse extends AIStreamChunk {
  intent?: Intent;
}
export interface AIResponse {
  content: string;
  intent?: Intent;
  intentType?: IntentType;
  shouldShowCard?: boolean;
  cardData?: Record<string, unknown>;
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
  _conversationId?: string,
  userContext?: UserContext
): Promise<AIResponse> {
  try {
    // Build conversation context
    const messages: DeepSeekMessage[] = [
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
    // Uses the proxy fallback model from deepseek.ts with chat-oriented settings.
    logger.ai('request', 'Kimi Instant', { temperature: 0.8 });
    const response = await chatCompletion(messages, {
      temperature: 0.8, // Better for conversational chat
      enable_search: true, // Enable tools (gas_price, token_info, etc.)
      chain_context: userContext?.chainId && userContext?.chainName ? {
        chainId: userContext.chainId,
        chainName: userContext.chainName
      } : undefined
    });
    logger.ai('response', 'Kimi Instant', { tokens: response.usage?.total_tokens });

    const content = response.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';

    return {
      content,
    };
  } catch (error: unknown) {
    logger.error('AI', 'AI service error', error);
    return {
      content: 'I apologize, but I encountered an error. Please try again.',
    };
  }
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
  _conversationId?: string,
  signal?: AbortSignal,
  userContext?: UserContext,
  modelId?: string,
  mode?: string,
  _customSettings?: CustomAISettings
): AsyncGenerator<StreamResponse, void, unknown> {
  try {
    // Yield initial status
    yield { content: '', tool_status: 'Analyzing request...' };

    const messages: DeepSeekMessage[] = [
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

        // Frontend no longer decides tool usage; backend orchestrator handles it.
        const shouldEnableSearch = true;

        // Default: enable image/video understanding but do not constrain dates/handles.
        const toolConfig = shouldEnableSearch ? {
          web_search: { enable_image_understanding: true },
          x_search: { enable_image_understanding: true, enable_video_understanding: true },
        } : undefined;

        let xaiCitations: Array<{ url: string; avatar_url?: string }> | undefined;
        const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        for await (const chunk of xaiStreamChatCompletion(xaiMessages, {
          // Use lower temperature for fast mode to reduce latency
          temperature: isReasoningModel ? 0.8 : 0.3, // Fast mode: 0.3 for speed, Reasoning: 0.8 for quality
          // Reduce max_tokens for fast mode to encourage quicker responses
          max_tokens: isReasoningModel ? getXaiRecommendedMaxTokens(xaiModelName) : 2048,
          model: xaiModelName,
          signal,
          enable_search: shouldEnableSearch, // Only enable for reasoning models
          tool_config: toolConfig, // Only enable image/video understanding by default
          client_timezone: clientTimezone,
        })) {
          fullContent += chunk.content;
          // Collect citations from X.ai response
          if (chunk.citations) {
            xaiCitations = chunk.citations;
          }

          // Extract usage from Grok chunk if available
          const grokUsage = chunk.usage ? {
            prompt_tokens: chunk.usage.prompt_tokens || 0,
            completion_tokens: chunk.usage.completion_tokens || 0,
            total_tokens: chunk.usage.total_tokens || 0
          } : undefined;

          if (grokUsage) {
            console.log('[aiService] Grok usage data:', grokUsage);
          }

          yield {
            content: chunk.content,
            citations: xaiCitations,
            reasoning_content: chunk.reasoning_content,
            tool_call: chunk.tool_call,
            tool_status: chunk.tool_status,
            client_actions: chunk.client_actions as AIClientAction[] | undefined,
            usage: grokUsage
          };
        }
      } catch (xaiError: unknown) {
        const err = xaiError as Error;
        // The frontend talks to the authenticated backend route, so surface the backend error directly.
        console.error('[aiService] X.ai API error:', err);
        throw new Error(`X.ai API error: ${err.message || 'Failed to call the authenticated X.ai backend route.'} `);
      }
    } else {
      // Use DeepSeek API (default)
      console.log('[aiService] Using DeepSeek API');
      const modelName = getModelName(modelId, mode);

      // Frontend no longer decides tool usage; backend orchestrator handles it.
      const shouldEnableTools = true;

      console.log('[aiService] Tool gating handled by backend orchestrator.');

      let deepseekCitations: Array<{ url: string; avatar_url?: string }> | undefined;

      for await (const chunk of streamChatCompletion(messages, {
        temperature: 0.8, // Better for conversational chat (0.8-0.9 range)
        // max_tokens will automatically use model's recommended default
        // (4K for chat, 32K for reasoner)
        model: modelName,
        signal,
        enable_search: shouldEnableTools, // Enable backend tool registry
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

        // Citations are now pre-formatted by deepseek service
        const formattedCitations = deepseekCitations;

        // Extract usage from DeepSeek chunk if available
        const deepseekUsage = chunk.usage ? {
          prompt_tokens: chunk.usage.prompt_tokens || 0,
          completion_tokens: chunk.usage.completion_tokens || 0,
          total_tokens: chunk.usage.total_tokens || 0
        } : undefined;

        if (deepseekUsage) {
          console.log('[aiService] DeepSeek usage data:', deepseekUsage);
        }

        yield {
          content: chunk.content,
          citations: formattedCitations,
          reasoning_content: chunk.reasoning_content, // Pass thinking process to frontend
          client_actions: chunk.client_actions as AIClientAction[] | undefined, // Pass client actions to frontend
          usage: deepseekUsage
        };
      }
    }

    yield { content: '' };
  } catch (error: unknown) {
    const err = error as Error;
    // If aborted, don't yield error message - just stop
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      return;
    }

    // Log other errors with more details
    console.error('[aiService] AI streaming error:', err);
    console.error('[aiService] Error details:', {
      message: err.message,
      name: err.name,
      stack: err.stack,
    });

    // Frontend no longer relies on a browser-exposed X.ai API key.
    if (err.message?.includes('Authentication required')) {
      yield {
        content: `❌ X.ai API error: authentication is required.\n\nDetails: ${err.message} `,
      };
    } else {
      yield {
        content: `❌ Error: ${err.message || 'Something went wrong, please try again later.'} `,
      };
    }
  }
}
