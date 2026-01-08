/**
 * X.ai API Service
 * Handles communication with X.ai (Grok) API
 * Supports grok-4-1-fast (reasoning) and grok-4-fast-non-reasoning models
 * Note: Tools (web_search, x_search) only work with reasoning models
 */

import { getAuthToken } from '../utils/authToken';

export interface XaiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Removed XaiSearchSource interface - using simple string array

export interface XaiTool {
  type: 'live_search' | 'function';
  // For live_search: sources is required - array of source type strings
  sources?: string[];  // e.g., ['web', 'x']
  // For custom tools, use function field
  function?: {
    name: string;
    description?: string;
    parameters?: any;
  };
}

export interface WebSearchConfig {
  allowed_domains?: string[];  // Max 5 domains
  excluded_domains?: string[]; // Max 5 domains
  enable_image_understanding?: boolean;
}

export interface XSearchConfig {
  from_date?: string;  // ISO date string
  to_date?: string;    // ISO date string
  allowed_x_handles?: string[];  // Without @ symbol
  excluded_x_handles?: string[]; // Without @ symbol
  enable_image_understanding?: boolean;
  enable_video_understanding?: boolean;
}

export interface ToolConfig {
  web_search?: WebSearchConfig;
  x_search?: XSearchConfig;
}

export interface XaiRequest {
  model: string;
  messages: XaiMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  enable_search?: boolean; // For Python service
  tool_config?: ToolConfig; // Dynamic tool configuration
}

export interface XaiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      citations?: Array<string | { url: string; avatar_url?: string }>; // URLs or objects with url and avatar_url
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface XaiStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string; // Thinking process for reasoning mode
      tool_calls?: Array<{
        index: number;
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
    message?: {
      citations?: Array<string | { url: string; avatar_url?: string }>;
    };
    tool_calls?: Array<{
      index: number;
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
    error?: {
      message: string;
      type: string;
    };
  }>;
  // Usage data (sent in final chunk)
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface XaiStreamResponse {
  content: string;
  citations?: Array<{ url: string; avatar_url?: string }>;
  tool_call?: string;
  tool_status?: string;
  reasoning_content?: string; // Thinking process for reasoning mode
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// X.ai API endpoint - Now routed through Node.js API to kiko-python
// This secures the Python service URL and provides unified authentication
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const XAI_API_URL = `${API_BASE_URL}/api/ai/chat`;
const DEFAULT_MODEL = 'grok-4-1-fast-reasoning'; // Use reasoning model for tool support
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Map frontend model ID to X.ai API model name
 * 
 * Available Models (Grok 4.1):
 * - grok-4-1-fast-reasoning: Grok 4.1 Fast (Reasoning mode) - supports tools
 * - grok-4-1-fast-non-reasoning: Grok 4.1 Fast (Non-reasoning mode) - faster, no tools
 * 
 * @param modelId - Frontend model identifier (e.g., 'grok-4-reasoning')
 * @param mode - Model mode ('thinking' or 'fast')
 * @returns Actual X.ai API model name
 */
export function getXaiModelName(modelId?: string, mode?: string): string {
  // If modelId contains 'reasoning' (but not 'non-reasoning') or mode is 'thinking', use reasoning model
  if ((modelId?.includes('reasoning') && !modelId?.includes('non-reasoning')) || mode === 'thinking') {
    return 'grok-4-1-fast-reasoning';
  }

  // For fast mode or default, use non-reasoning model
  return 'grok-4-1-fast-non-reasoning';
}

/**
 * Get recommended max_tokens based on model type
 * According to X.ai documentation:
 * - Both models support up to 2M token context window
 * - Default max_tokens: 8192 for both models
 */
export function getRecommendedMaxTokens(_modelName: string): number {
  // Both models support large context, default to 8192
  return 8192;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make request to Python Grok service with retry logic
 */
async function makeRequest(
  request: XaiRequest,
  retries = MAX_RETRIES
): Promise<Response> {
  try {
    // Get Privy auth token
    const authToken = await getAuthToken();
    if (!authToken) {
      throw new Error('Authentication required: Please log in to use Grok.');
    }

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      interface ErrorData {
        error?: {
          message?: string;
        };
        message?: string;
      }
      let errorData: ErrorData = {};
      try {
        const text = await response.text();
        console.error('[xai] Error response text:', text);
        errorData = JSON.parse(text) as ErrorData;
      } catch {
        errorData = { error: { message: `HTTP ${response.status}: ${response.statusText}` } };
      }

      const errorMessage = errorData.error?.message || errorData.message || response.statusText || 'Unknown error';
      console.error('[xai] API error response:', errorData);
      console.error('[xai] Request body:', JSON.stringify(request, null, 2));
      console.error('[xai] Response status:', response.status, response.statusText);
      throw new Error(`X.ai API error (${response.status}): ${errorMessage}`);
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
 * Send a chat completion request via Python Grok service
 */
export async function chatCompletion(
  messages: XaiMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    enable_search?: boolean; // Enable search via Python service
  } = {}
): Promise<XaiResponse> {
  const model = options.model || DEFAULT_MODEL;
  const request: XaiRequest = {
    model,
    messages,
    // Temperature: 0.8-0.9 is better for conversational chat
    temperature: options.temperature ?? 0.8,
    // Use recommended max_tokens based on model if not specified
    max_tokens: options.max_tokens ?? getRecommendedMaxTokens(model),
    stream: false,
    enable_search: options.enable_search !== false, // Enable by default
  };

  const response = await makeRequest(request);
  return response.json();
}

/**
 * Stream chat completion from X.ai
 */
export async function* streamChatCompletion(
  messages: XaiMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    signal?: AbortSignal;
    enable_search?: boolean; // Enable search via Python service
    tool_config?: ToolConfig; // Dynamic tool configuration
  } = {}
): AsyncGenerator<{ content: string; citations?: Array<{ url: string; avatar_url?: string }>; tool_call?: string; tool_status?: string; client_actions?: any[]; reasoning_content?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }, void, unknown> {
  // [xai] Starting streamChatCompletion via Python service
  const model = options.model || DEFAULT_MODEL;

  // Debug logs removed - contained sensitive info

  const request: XaiRequest = {
    model,
    messages,
    // Temperature: 0.8-0.9 is better for conversational chat
    temperature: options.temperature ?? 0.8,
    // Use recommended max_tokens based on model if not specified
    max_tokens: options.max_tokens ?? getRecommendedMaxTokens(model),
    stream: true,
    enable_search: options.enable_search !== false, // Enable by default
    tool_config: options.tool_config, // Pass dynamic tool configuration
  };

  // Request model log removed for security

  let retries = MAX_RETRIES;
  let response: Response | null = null;

  while (retries > 0) {
    try {
      const requestBody = JSON.stringify(request);
      // Full request body log REMOVED - contains sensitive user data

      // Get Privy auth token for Python service authentication
      // This is REQUIRED - without it, the Python service will reject the request
      const authToken = await getAuthToken();

      if (!authToken) {
        console.error('[xai] CRITICAL: No auth token available! User may not be logged in.');
        throw new Error('Authentication required: Please log in to use Grok. No auth token available.');
      }

      // Auth token obtained - log removed for security

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,  // Always required for Python service
      };

      response = await fetch(XAI_API_URL, {
        method: 'POST',
        headers,
        body: requestBody,
        signal: options.signal,
      });

      // Handle 401 Unauthorized specifically - might need to refresh token
      if (response.status === 401) {
        console.warn('[xai] Received 401 Unauthorized. Token may be expired.');
        const errorText = await response.text();
        console.error('[xai] 401 Error details:', errorText);

        // On retries, the token provider might return a fresh token
        if (retries > 1) {
          console.log('[xai] Retrying with fresh token...');
          retries--;
          await sleep(RETRY_DELAY);
          continue;  // Retry - getAuthToken() will be called again
        }

        throw new Error('Authentication failed: Please log in again. Your session may have expired.');
      }



      if (!response.ok) {
        interface ErrorData {
          error?: {
            message?: string;
          };
          message?: string;
        }
        let errorData: ErrorData = {};
        let errorText = '';
        try {
          errorText = await response.text();
          console.error('[xai] Error response text:', errorText);
          errorData = JSON.parse(errorText) as ErrorData;
        } catch {
          console.error('[xai] Failed to parse error response, raw text:', errorText);
          errorData = { error: { message: errorText || `HTTP ${response.status}: ${response.statusText}` } };
        }

        const errorMessage = errorData.error?.message || errorData.message || errorText || response.statusText || 'Unknown error';
        console.error('[xai] API error response:', errorData);
        console.error('[xai] Request body:', JSON.stringify(request, null, 2));
        console.error('[xai] Response status:', response.status, response.statusText);
        throw new Error(`X.ai API error (${response.status}): ${errorMessage}`);
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
  let chunkCount = 0;

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
            // Clear processed tool calls when stream ends
            if ((globalThis as any).__processedToolCalls) {
              (globalThis as any).__processedToolCalls.clear();
            }
            console.log('[xai] Stream completed. Total chunks:', chunkCount);
            // Yield any remaining citations before finishing
            if (citations && citations.length > 0) {
              console.log('[xai] Final citations:', citations.length, 'sources');
              // Ensure citations are in object format
              const normalizedCitations = citations.map(cite =>
                typeof cite === 'string' ? { url: cite } : cite
              );
              yield { content: '', citations: normalizedCitations };
            }
            return;
          }
          try {
            const chunk: XaiStreamChunk = JSON.parse(data);
            const choice = chunk.choices[0];
            chunkCount++;

            // DEBUG: Log every parsed chunk to trace Grok blank message issue
            console.log('[xai DEBUG] Parsed chunk:', {
              chunkCount,
              hasChoice: !!choice,
              deltaContent: choice?.delta?.content?.substring(0, 30),
              hasToolCalls: !!(choice?.delta?.tool_calls || choice?.tool_calls || (chunk as any).tool_call),
              finishReason: choice?.finish_reason
            });

            // Handle tool calls - send status to frontend
            // Check both delta.tool_calls and choice.tool_calls (OpenAI format)
            const toolCalls = choice?.delta?.tool_calls || choice?.tool_calls;

            // Handle client actions (custom extension for swaps)
            const clientActions = (choice?.delta as any)?.client_actions || (chunk as any).client_actions;
            if (clientActions && clientActions.length > 0) {
              console.log('[xai] Client actions detected:', clientActions.length);
              yield {
                content: '',
                client_actions: clientActions
              };
            }

            // UNIFIED TOOL CALL DETECTION: Check both delta.tool_calls and top-level tool_call
            // DEDUPLICATION: Track processed tool calls to avoid duplicates
            const toolCallFromDelta = toolCalls && toolCalls.length > 0;
            const toolCallFromTopLevel = (chunk as any).tool_call;

            // Use a static Set to track processed tool calls across chunks
            if (!(globalThis as any).__processedToolCalls) {
              (globalThis as any).__processedToolCalls = new Set<string>();
            }
            const processedToolCalls = (globalThis as any).__processedToolCalls;

            if (toolCallFromDelta || toolCallFromTopLevel) {
              // Prioritize delta.tool_calls over top-level tool_call to avoid duplicates
              if (toolCallFromDelta && toolCalls) {
                // Process each tool call from delta (primary source)
                for (const toolCall of toolCalls) {
                  const toolName = toolCall.function?.name || 'unknown';
                  const toolCallId = toolCall.id || `call_${Date.now()}_${toolName}`;

                  // Skip if already processed
                  if (processedToolCalls.has(toolCallId)) {
                    console.log('[xai] Skipping duplicate tool call:', toolName, toolCallId);
                    continue;
                  }

                  processedToolCalls.add(toolCallId);

                  console.log('[xai] Tool calls detected:', {
                    fromDelta: true,
                    fromTopLevel: false,
                    toolName,
                    toolCallId
                  });

                  // Map tool names to user-friendly English text
                  const toolNameMap: Record<string, string> = {
                    'web_search': 'Web Search',
                    'web_search_with_snippets': 'Web Search',
                    'x_search': 'X (Twitter) Search',
                    'x_keyword_search': 'X Keyword Search',
                    'x_semantic_search': 'X Semantic Search',
                    'x_user_search': 'X User Search',
                    'check_token_risk': 'Token Security Analysis',
                    'get_token_price': 'Token Price Lookup',
                    'get_trending_tokens': 'Trending Tokens',
                    'prepare_swap_transaction': 'Swap Transaction',
                  };
                  const toolDisplayName = toolNameMap[toolName] || toolName;
                  console.log('[xai] Tool call detected:', toolName, '->', toolDisplayName);

                  // Yield tool call status (frontend can use this to update thinking text)
                  yield {
                    content: '',
                    tool_call: toolName,
                    tool_call_id: toolCallId,
                    tool_status: `Fetching info from ${toolDisplayName}...`
                  } as { content: string; tool_call?: string; tool_call_id?: string; tool_status?: string; citations?: Array<{ url: string; avatar_url?: string }> };
                }
              } else if (toolCallFromTopLevel) {
                // Fallback: use top-level tool_call if delta doesn't have it
                const toolName = toolCallFromTopLevel;
                const toolCallId = (chunk as any).tool_call_id || `call_${Date.now()}_${toolName}`;

                // Skip if already processed
                if (processedToolCalls.has(toolCallId)) {
                  console.log('[xai] Skipping duplicate top-level tool call:', toolName, toolCallId);
                } else {
                  processedToolCalls.add(toolCallId);

                  console.log('[xai] Tool calls detected:', {
                    fromDelta: false,
                    fromTopLevel: true,
                    toolName,
                    toolCallId
                  });

                  const toolNameMap: Record<string, string> = {
                    'web_search': 'Web Search',
                    'web_search_with_snippets': 'Web Search',
                    'x_search': 'X (Twitter) Search',
                    'x_keyword_search': 'X Keyword Search',
                    'x_semantic_search': 'X Semantic Search',
                    'x_user_search': 'X User Search',
                    'check_token_risk': 'Token Security Analysis',
                    'get_token_price': 'Token Price Lookup',
                    'get_trending_tokens': 'Trending Tokens',
                    'prepare_swap_transaction': 'Swap Transaction',
                  };
                  const toolDisplayName = toolNameMap[toolName] || toolName;

                  yield {
                    content: '',
                    tool_call: toolName,
                    tool_call_id: toolCallId,
                    tool_status: `Fetching info from ${toolDisplayName}...`
                  } as { content: string; tool_call?: string; tool_call_id?: string; tool_status?: string; citations?: Array<{ url: string; avatar_url?: string }> };
                }
              }
            }

            // Clear processed tool calls when stream ends (detected by [DONE] marker)
            // This will be handled when we detect the end of stream

            // Collect citations from message object (usually in final chunk)
            if (choice?.message?.citations) {
              const newCitations = choice.message.citations;
              if (newCitations && newCitations.length > 0) {
                // Normalize citations: convert strings to objects for consistency
                const normalized: Array<{ url: string; avatar_url?: string } | Array<{ url: string; avatar_url?: string }>> = [];

                for (const cite of newCitations) {
                  // Handle string that might be a list representation
                  if (typeof cite === 'string') {
                    // Check if it's a string representation of a list
                    if (cite.startsWith('[') && cite.endsWith(']')) {
                      try {
                        const parsed = JSON.parse(cite.replace(/'/g, '"'));
                        if (Array.isArray(parsed)) {
                          // Return array of objects - will be flattened later
                          normalized.push(parsed.map((url: string) => ({ url })));
                          continue;
                        }
                      } catch {
                        // Not a valid JSON list, treat as single URL
                      }
                    }
                    normalized.push({ url: cite });
                  } else if (typeof cite === 'object' && cite !== null) {
                    // Already an object, ensure it has url field
                    const urlValue = cite.url || String(cite);
                    if (typeof urlValue === 'string' && urlValue.startsWith('[') && urlValue.endsWith(']')) {
                      try {
                        const parsed = JSON.parse(urlValue.replace(/'/g, '"'));
                        if (Array.isArray(parsed)) {
                          // Return array of objects - will be flattened later
                          normalized.push(parsed.map((url: string) => ({
                            url,
                            avatar_url: (cite as any).avatar_url || (cite as any).avatarUrl
                          })));
                          continue;
                        }
                      } catch {
                        // Not a valid JSON list, treat as single URL
                      }
                    }
                    normalized.push({
                      url: urlValue,
                      avatar_url: (cite as any).avatar_url || (cite as any).avatarUrl || undefined
                    });
                  } else {
                    normalized.push({ url: String(cite) });
                  }
                }

                // Flatten any nested arrays
                const flattened: Array<{ url: string; avatar_url?: string }> = [];
                for (const item of normalized) {
                  if (Array.isArray(item)) {
                    flattened.push(...item);
                  } else {
                    flattened.push(item);
                  }
                }
                citations = flattened;

                console.log('[xai] Citations received in chunk', chunkCount, ':', citations.length, 'sources');
                if (citations.length > 0) {
                  console.log('[xai] Citations sample:', JSON.stringify(citations[0], null, 2));
                  console.log('[xai] All citations:', JSON.stringify(citations, null, 2));
                  // Debug avatar_url specifically
                  citations.forEach((cite, idx) => {
                    console.log(`[xai] Citation ${idx} avatar_url:`, cite.avatar_url);
                  });
                }
              }
            }

            // Yield reasoning content (thinking process)
            const reasoningContent = choice?.delta?.reasoning_content;
            if (reasoningContent) {
              yield {
                content: '',
                reasoning_content: reasoningContent,
              } as XaiStreamResponse;
            }

            // Extract usage from final chunk (Grok sends this with finish_reason: 'stop')
            if (chunk.usage) {
              console.log('[xai] Usage received:', chunk.usage);
              yield {
                content: '',
                usage: chunk.usage,
              } as XaiStreamResponse;
            }

            // Yield tool_status from delta (sent by backend for custom tools)
            const toolStatus = (choice?.delta as any)?.tool_status;
            if (toolStatus) {
              console.log('[xai] Tool status received:', toolStatus);
              yield {
                content: '',
                tool_status: toolStatus
              } as XaiStreamResponse;
            }

            // Yield content chunks
            const content = choice?.delta?.content;
            if (content) {
              console.log('[xai] Content chunk received, length:', content.length, 'preview:', content.substring(0, 50));
              yield {
                content,
                citations: citations && citations.length > 0 ? citations as Array<{ url: string; avatar_url?: string }> : undefined
              };
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

