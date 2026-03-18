import { getAuthToken } from '../utils/authToken';
import { type AIStreamChunk } from './aiTypes';

/**
 * DeepSeek API Service
 * Handles communication with DeepSeek AI API
 */

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  enable_search?: boolean; // Enable/disable search tools
  chain_context?: {
    chainId: number;
    chainName: string;
  };
  walletAddress?: string; // Optional wallet address for tools
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string; // Thinking process for reasoner model
    };
    finish_reason: string | null;
    message?: {
      citations?: string[];
      reasoning_content?: string; // Final thinking process
    };
  }>;
}

const DEFAULT_MODEL = 'deepseek-chat';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Map frontend model ID to model name
 * 
 * Current mapping:
 * - deepseek-chat/deepseek-reasoner: DeepSeek
 * - gpt-5.4-mini-2026-03-17: OpenAI GPT-5.4-mini
 * 
 * @param modelId - Frontend model identifier (e.g., 'deepseek-reasoner')
 * @param mode - Model mode ('thinking' or 'fast')
 * @returns Actual model name
 */
export function getModelName(modelId?: string, mode?: string): string {
  if (modelId) return modelId;
  if (mode === 'thinking') return 'deepseek-reasoner';
  return DEFAULT_MODEL;
}

/**
 * Get recommended max_tokens based on model type
 */
export function getRecommendedMaxTokens(modelName: string): number {
  if (modelName === 'deepseek-reasoner') {
    return 32000;
  }
  if (modelName.includes('gpt-5.4')) {
    return 16384;
  }
  if (modelName === 'gpt-5-mini' || modelName.includes('gpt-5')) {
    return 8192;
  }
  return 4096;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make request to DeepSeek API with retry logic
 */
async function makeRequest(
  request: DeepSeekRequest,
  retries = MAX_RETRIES
): Promise<Response> {
  // Use backend proxy instead of calling DeepSeek API directly
  const BACKEND_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  try {
    // Get Privy auth token - REQUIRED for API access
    const authToken = await getAuthToken();

    if (!authToken) {
      throw new Error('Authentication required: Please log in to use DeepSeek. No auth token available.');
    }

    const response = await fetch(`${BACKEND_API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,  // Always required
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed: Please log in again. Your session may have expired.');
      }
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`DeepSeek API error: ${error.error?.message || response.statusText}`);
    }

    return response;

  } catch (error) {
    if (retries > 0 && error instanceof Error) {
      // Retry on network errors or 5xx errors
      const isRetryable =
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('500') ||
        error.message.includes('502') ||
        error.message.includes('503');

      if (isRetryable) {
        await sleep(RETRY_DELAY * (MAX_RETRIES - retries + 1));
        return makeRequest(request, retries - 1);
      }
    }
    throw error;
  }
}

/**
 * Send a chat completion request to DeepSeek
 */
export async function chatCompletion(
  messages: DeepSeekMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    enable_search?: boolean; // Disable search tools for intent parsing
    chain_context?: {
      chainId: number;
      chainName: string;
    };
    walletAddress?: string;
  } = {}
): Promise<DeepSeekResponse> {
  const model = options.model || DEFAULT_MODEL;
  const request: DeepSeekRequest = {
    model,
    messages,
    // Temperature: Lower to 0.3 for more deterministic, fact-based responses
    // This helps reduce hallucination when working with tool data
    temperature: options.temperature ?? 0.3,
    // Use recommended max_tokens based on model if not specified
    max_tokens: options.max_tokens ?? getRecommendedMaxTokens(model),
    stream: false,
    enable_search: options.enable_search, // Pass enable_search to backend
    chain_context: options.chain_context,
    walletAddress: options.walletAddress,
  };

  const response = await makeRequest(request);
  return response.json();
}

/**
 * Stream chat completion from DeepSeek via backend proxy
 * Now supports citations from web search tool calls
 * And reasoning_content for thinking mode (deepseek-reasoner)
 */
export async function* streamChatCompletion(
  messages: DeepSeekMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    signal?: AbortSignal;
    enable_search?: boolean; // Enable search/tools
    chain_context?: {
      chainId: number;
      chainName: string;
    };
    walletAddress?: string;
  } = {}
): AsyncGenerator<AIStreamChunk, void, unknown> {
  // Use backend proxy instead of calling DeepSeek API directly
  const BACKEND_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const model = options.model || DEFAULT_MODEL;
  const request: DeepSeekRequest = {
    model,
    messages,
    // Temperature: Lower to 0.3 for more deterministic, fact-based responses
    // This helps reduce hallucination when working with tool data
    temperature: options.temperature ?? 0.3,
    // Use recommended max_tokens based on model if not specified
    max_tokens: options.max_tokens ?? getRecommendedMaxTokens(model),
    stream: true,
    enable_search: options.enable_search, // Pass enable_search to backend
    chain_context: options.chain_context,
    walletAddress: options.walletAddress,
  };

  let retries = MAX_RETRIES;
  let response: Response | null = null;

  while (retries > 0) {
    try {
      // Get Privy auth token - REQUIRED for API access
      const authToken = await getAuthToken();

      if (!authToken) {
        throw new Error('Authentication required: Please log in to use DeepSeek. No auth token available.');
      }

      response = await fetch(`${BACKEND_API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,  // Always required
        },
        body: JSON.stringify(request),
        signal: options.signal,
      });


      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed: Please log in again. Your session may have expired.');
        }
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`DeepSeek API error: ${error.error?.message || response.statusText}`);
      }

      break; // Success, exit retry loop
    } catch (error) {
      retries--;
      if (retries > 0) {
        await sleep(RETRY_DELAY * (MAX_RETRIES - retries + 1));
      } else {
        throw error;
      }
    }
  }

  if (!response || !response.body) {
    throw new Error('Failed to get response stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let citations: Array<{ url: string; avatar_url?: string }> | undefined;
  let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            // Yield final citations and usage if available
            if ((citations && citations.length > 0) || usage) {
              console.log('[deepseek] Stream complete - yielding final usage:', usage);
              yield { content: '', citations, usage };
            }
            return;
          }
          try {
            const chunk: DeepSeekStreamChunk = JSON.parse(data);

            // Check for error in chunk
            const chunkWithError = chunk as unknown as { error?: string };
            if (chunkWithError.error) {
              const errorMsg = chunkWithError.error;
              console.error('[deepseek] Error in stream:', errorMsg);

              // Special handling for iteration limit
              if (errorMsg.includes('Maximum iterations') || errorMsg.includes('iteration')) {
                throw new Error('The AI reached the maximum number of tool calls. This usually happens with complex requests. Please try breaking your question into smaller parts or rephrase your request.');
              }

              throw new Error(errorMsg);
            }

            // Check for tool_status messages (informational)
            const chunkWithStatus = chunk as unknown as { tool_status?: string };
            if (chunkWithStatus.tool_status) {
              console.log('[deepseek] Tool status:', chunkWithStatus.tool_status);
              // Don't throw, just log - this is informational
            }

            const choice = chunk.choices?.[0];
            if (!choice) continue;

            // Extract content
            const content = choice?.delta?.content || '';

            // Extract reasoning_content (thinking process for reasoner model)
            const reasoning_content = choice?.delta?.reasoning_content;

            // Extract citations from message (sent in final chunk by backend)
            if (choice?.message?.citations) {
              const rawCitations = choice.message.citations as (string | { url: string; avatar_url?: string })[];
              citations = rawCitations.map(c => typeof c === 'string' ? { url: c } : c);
              console.log('[deepseek] Citations received:', citations.length, 'sources');
            }

            // Extract client actions from message (sent in final chunk by backend)
            let clientActions: Array<{ type: string; payload: Record<string, unknown> }> | undefined;
            // Debug: log when message object is present
            if (choice?.message) {
              console.log('[deepseek] Message object received:', JSON.stringify(choice.message).slice(0, 200));
            }
            const messageWithActions = choice?.message as unknown as { client_actions?: Array<{ type: string; payload: Record<string, unknown> }> };
            if (messageWithActions?.client_actions) {
              clientActions = messageWithActions.client_actions;
              console.log('[deepseek] Client actions received:', clientActions?.length, JSON.stringify(clientActions));
            }

            // Extract usage from chunk (sent by backend in extras chunk)
            const chunkWithUsage = chunk as unknown as { usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
            if (chunkWithUsage.usage) {
              usage = chunkWithUsage.usage;
              console.log('[deepseek] Usage received:', usage);
            }

            // Yield content, reasoning_content, client_actions, or usage
            if (content || reasoning_content || clientActions || usage) {
              yield {
                content,
                citations: citations,
                reasoning_content,
                client_actions: clientActions,
                usage: usage // Always include current usage
              };
            }
          } catch (e: unknown) {
            const err = e as Error;
            // If it's a JSON parse error, ignore (incomplete chunk)
            if (err.name === 'SyntaxError') {
              console.warn('[deepseek] Failed to parse chunk (incomplete):', data.substring(0, 100));
              continue;
            }
            // For other errors, rethrow
            throw err;
          }
        }
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    // If error is due to network/stream interruption, provide helpful message
    if (err.name === 'TypeError' && err.message.includes('network')) {
      console.error('[deepseek] Network error - stream interrupted');
      throw new Error('Stream connection interrupted. Please try again.');
    }
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader already released
    }
  }
}
