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
    };
    finish_reason: string | null;
  }>;
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const key = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!key) {
    console.error('Environment variable VITE_DEEPSEEK_API_KEY is not set.');
    console.error('Please create a .env file in the project root with:');
    console.error('VITE_DEEPSEEK_API_KEY=your_api_key_here');
    throw new Error('VITE_DEEPSEEK_API_KEY is not set in environment variables. Please check your .env file.');
  }
  return key;
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
  const apiKey = getApiKey();

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
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
  } = {}
): Promise<DeepSeekResponse> {
  const request: DeepSeekRequest = {
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2000,
    stream: false,
  };

  const response = await makeRequest(request);
  return response.json();
}

/**
 * Stream chat completion from DeepSeek
 */
export async function* streamChatCompletion(
  messages: DeepSeekMessage[],
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const apiKey = getApiKey();
  const request: DeepSeekRequest = {
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2000,
    stream: true,
  };

  let retries = MAX_RETRIES;
  let response: Response | null = null;

  while (retries > 0) {
    try {
      response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
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
            return;
          }
          try {
            const chunk: DeepSeekStreamChunk = JSON.parse(data);
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

