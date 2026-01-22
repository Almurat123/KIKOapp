/**
 * AI Routes
 * Proxy for AI API calls to avoid CORS issues
 * Supports DeepSeek tool calls for web search with real-time streaming
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { toolRegistry } from '../tools/index.js';
import { searchWeb, formatSearchResults } from '../services/searchService.js';
import { requireAuth } from '../middleware/auth.js';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

interface ChatRequest {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    enable_search?: boolean;
    allowed_tools?: string[];
    chain_context?: {
        chainId: number;
        chainName: string;
    };
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Helper to get DeepSeek API Key
function getDeepSeekApiKey(): string {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
        throw new Error('DEEPSEEK_API_KEY is not set in environment variables');
    }
    return key;
}

/**
 * Convert internal tool definition to OpenAI/DeepSeek comptabile JSON schema
 * Optional: filter by allowed tool names
 */
function getOpenAITools(allowedTools?: string[]) {
    let definitions = toolRegistry.getAllDefinitions();

    // Filter if allowedTools is provided and not empty
    if (allowedTools && allowedTools.length > 0) {
        definitions = definitions.filter(def => allowedTools.includes(def.name));
    }

    return definitions.map(def => ({
        type: 'function',
        function: def
    }));
}

/**
 * Execute tool calls and return results
 */
async function executeToolCalls(toolCalls: any[]): Promise<{ toolMessages: ChatMessage[]; citations: string[]; clientActions: any[] }> {
    const toolMessages: any[] = [];
    const allCitations: string[] = [];
    const clientActions: any[] = [];

    for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs: any = {};

        try {
            functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            console.error(`[AI Routes] Failed to parse args for ${functionName}:`, toolCall.function.arguments);
            toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: Invalid JSON arguments for tool ${functionName}`
            });
            continue;
        }

        console.log(`[AI Routes] Executing tool: ${functionName}`, functionArgs);

        try {
            // Execute tool via registry with timeout (30 seconds max per tool)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Tool ${functionName} execution timeout (30s)`)), 30000);
            });
            let result = await Promise.race([
                toolRegistry.execute(functionName, functionArgs),
                timeoutPromise
            ]) as any;

            // Check for client action (Protocol: tool returns { __client_action: ... })
            if (result && typeof result === 'object' && result.__client_action) {
                console.log(`[AI Routes] Tool ${functionName} returned client action`);
                clientActions.push(result.__client_action);

                // If the tool return has a 'summary' field, use that as the content for LLM
                // otherwise remove the special field to avoid confusing LLM
                if (result.summary) {
                    result = result.summary;
                } else {
                    const { __client_action, ...rest } = result;
                    result = rest;
                }
            }

            // Special handling for external web search citations
            if (functionName === 'external_web_search' && result && typeof result === 'object' && result.citations) {
                if (Array.isArray(result.citations)) {
                    allCitations.push(...result.citations);
                }
                result = result.results || JSON.stringify(result);
            }

            // Convert result to string if it's an object
            const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

            // Log tool result for debugging
            console.log(`[AI Routes] Tool ${functionName} result (first 500 chars):`, content.substring(0, 500));

            toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `TOOL RESULT - USE THIS DATA EXACTLY AS PROVIDED:\n${content}\n\nIMPORTANT: Copy all fields (names, symbols, prices, addresses) VERBATIM from the JSON above. Do NOT invent, round, or modify any values.`
            });

            console.log(`[AI Routes] Tool ${functionName} completed`);
        } catch (error: any) {
            console.error(`[AI Routes] Tool ${functionName} error:`, error);

            // enhanced error handling for network/socket errors
            let errorMessage = error.message || 'Tool execution failed';

            // Check for specific GeckoTerminal connection errors
            if (errorMessage.includes('terminated') || errorMessage.includes('SocketError') || errorMessage.includes('UND_ERR_SOCKET')) {
                errorMessage = `Network error: The external service (GeckoTerminal) is currently unreachable. Please try again later.`;
            } else if (errorMessage.includes('timeout')) {
                errorMessage = `Timeout error: The external service took too long to respond.`;
            }

            toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error executing tool ${functionName}: ${errorMessage}`
            });
        }
    }

    return { toolMessages, citations: allCitations, clientActions };
}

/**
 * Process streaming response and detect tool calls
 */
async function processStreamResponse(
    response: Response,
    reply: any,
    shouldForward: boolean = true
): Promise<{ hasToolCalls: boolean; toolCalls: any[]; assistantContent: string; reasoningContent: string; usage?: any }> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let assistantContent = '';
    let reasoningContent = '';
    let toolCalls: any[] = [];
    let hasToolCalls = false;
    let usage: any = undefined;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Parse chunks to detect tool calls BEFORE forwarding
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                // Skip [DONE] marker - we'll handle it later
                if (line.trim() === 'data: [DONE]') {
                    continue;
                }

                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const choice = data.choices?.[0];

                        if (choice?.delta?.content) {
                            assistantContent += choice.delta.content;
                        }
                        if (choice?.delta?.reasoning_content) {
                            reasoningContent += choice.delta.reasoning_content;
                        }
                        if (choice?.delta?.tool_calls) {
                            hasToolCalls = true;
                            // Accumulate tool calls
                            for (const tc of choice.delta.tool_calls) {
                                const idx = tc.index || 0;
                                if (!toolCalls[idx]) {
                                    toolCalls[idx] = {
                                        id: tc.id || '',
                                        type: tc.type || 'function',
                                        function: { name: '', arguments: '' }
                                    };
                                }
                                if (tc.id) toolCalls[idx].id = tc.id;
                                if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                                if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                            }
                        }

                        // Extract usage data if present
                        if (data.usage) {
                            usage = data.usage;
                            console.log('[AI Routes] DeepSeek usage extracted:', usage);
                        }
                    } catch (e) {
                        // Ignore parse errors
                        console.warn('[AI Routes] Failed to parse stream chunk:', line.substring(0, 100));
                    }
                }

                // Forward line to client if needed (but not [DONE])
                if (shouldForward && reply) {
                    try {
                        if (line.trim() !== 'data: [DONE]') {
                            reply.raw.write(line + '\n');
                        }
                    } catch (writeError: any) {
                        // If write fails (client disconnected), stop forwarding
                        console.error('[AI Routes] Failed to write to client stream:', writeError.message);
                        throw writeError;
                    }
                }
            }
        }
    } catch (error: any) {
        console.error('[AI Routes] Stream processing error:', error);
        // Ensure we release the reader even on error
        if (error.name !== 'AbortError') {
            throw error;
        }
    } finally {
        try {
            reader.releaseLock();
        } catch (e) {
            // Reader already released
        }
    }

    return { hasToolCalls, toolCalls, assistantContent, reasoningContent, usage };
}

export async function aiRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: ChatRequest }>(
        '/chat',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
            try {
                const {
                    messages,
                    model = 'deepseek-chat',
                    temperature = 0.8,
                    max_tokens,
                    stream = false,
                    enable_search = true
                } = request.body;

                // -----------------------------------------------------------------
                // GROK PROXY: Forward to kiko-python if model is grok-*
                // This keeps Grok logic (tool use, search) in the Python service
                // while providing a unified CORS-safe endpoint for the frontend.
                // -----------------------------------------------------------------
                if (model.startsWith('grok-')) {
                    const grokServiceUrl = process.env.GROK_SERVICE_URL || 'http://localhost:8000/grok';
                    console.log(`[AI Routes] Routing Grok request to ${grokServiceUrl}`);

                    try {
                        const response = await fetch(`${grokServiceUrl}/v1/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': request.headers.authorization as string,
                            },
                            body: JSON.stringify(request.body),
                        });

                        if (!response.ok) {
                            const status = response.status;
                            const errorText = await response.text();
                            console.error(`[AI Routes] Grok service error (${status}):`, errorText);
                            try {
                                const errorJson = JSON.parse(errorText);
                                return reply.code(status).send(errorJson);
                            } catch {
                                return reply.code(status).send({ error: errorText || 'Grok service error' });
                            }
                        }

                        if (stream) {
                            const origin = request.headers.origin || 'http://localhost:5173';
                            reply.raw.writeHead(200, {
                                'Content-Type': 'text/event-stream',
                                'Cache-Control': 'no-cache',
                                'Connection': 'keep-alive',
                                'Access-Control-Allow-Origin': origin,
                                'Access-Control-Allow-Credentials': 'true',
                            });

                            const reader = response.body!.getReader();
                            const decoder = new TextDecoder();
                            const encoder = new TextEncoder();

                            try {
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    reply.raw.write(value);
                                }
                            } catch (error) {
                                console.error('[AI Routes] Grok stream interrupted:', error);
                            } finally {
                                reply.raw.end();
                                reader.releaseLock();
                            }
                            return;
                        } else {
                            const data = await response.json();
                            return reply.send(data);
                        }
                    } catch (error: any) {
                        console.error('[AI Routes] Failed to proxy to Grok service:', error);
                        return reply.code(500).send({ error: `Grok service unreachable: ${error.message}` });
                    }
                }
                // -----------------------------------------------------------------

                if (!messages || !Array.isArray(messages) || messages.length === 0) {
                    return reply.code(400).send({
                        error: 'Invalid request: messages array is required',
                    });
                }

                const apiKey = getDeepSeekApiKey();
                const origin = request.headers.origin || 'http://localhost:5173';
                let conversationMessages = [...messages];

                const SYSTEM_PROMPT = `You are KIKO, an advanced AI ecosystem agent for crypto and DeFi.

**CORE DIRECTIVE**: You are a TOOL-FIRST agent. 
WARNING: You have NO internal knowledge of real-time crypto prices, trending tokens, or market data. 
You MUST use the provided tools for ANY market-related query (prices, trending, new pairs, etc). 
DO NOT answer from your training data. 
If a tool fails, try an alternative tool (e.g., if GeckoTerminal fails, try external_web_search).
NEVER fabricate data.

**AVAILABLE TOOLS & USAGE**:

1.  **MARKET DATA (Prices & Trends)**
    -   **get_token_price**: Use for CURRENT prices of any token (BTC, ETH, SOL, PEPE, etc.).
    -   **get_historical_price**: Use for charts, price history, "price yesterday", or percentage changes over time.
    -   **get_trending_tokens**: Use for "what's trending?", "hot tokens", "top gainers".
    -   **get_gas_price**: Use for current gas fees (wei/gwei) on any chain.
    -   **get_economic_calendar**: Use for macro events (CPI, Fed rates) affecting crypto.

2.  **TRADING & TRANSACTIONS**
    -   **prepare_swap_transaction**: Use when user wants to SWAP, BUY, or SELL tokens.
        -   *Requirement*: You MUST have a valid 'tokenIn', 'tokenOut', and 'amount'.
        -   *Default*: If 'tokenIn' not specified for a buy, assume 'USDC' or native token.
    -   **check_token_risk**: MANDATORY check before any swap for low-cap/meme tokens!
        -   Use for "is this safe?", "scan this token", or voluntarily before high-risk swaps.

3.  **TOKEN ANALYSIS**
    -   **get_token_info**: Use for contract addresses, decimals, social links of a token.
    -   **get_early_buyers**: Use for "early buyers", "who bought first", "smart money", "snipers".
    -   **analyze_creator**: Use for "analyze creator", "deployer risk", "is creator safe".
    -   **check_token_risk**: Use for security analysis (honeypot, taxes, ownership).

4.  **NEWS & RESEARCH**
    -   **external_web_search**: Use for news, general research, "why is crypto down?", "what is project X?".
        -   For "crypto news" or "news about Solana", use external_web_search with appropriate query.

5.  **WALLET & PORTFOLIO**
    -   **get_wallet_info**: Use for "my balance", "monitor wallet 0x...", "portfolio value".

6.  **ZORA CREATOR COINS**
    -   **get_zora_trending**: Use for "Zora trending", "new Zora coins", "hot on Zora".
    -   **get_zora_profile**: Use for "Zora profile of X", "who is X on Zora".

**CRITICAL RULES - ANTI-HALLUCINATION**:
-   **VERBATIM DATA COPYING**: When a tool returns data, you MUST:
    1.  Count the exact number of items in the tool result array
    2.  Copy EVERY field (name, symbol, price, volume, liquidity, address) EXACTLY as provided
    3.  Use the EXACT same numbers, decimals, and formatting from the JSON
    4.  If the tool returns 5 tokens, show EXACTLY 5 tokens - not 10, not "top 5 of 10"
    5.  DO NOT add tokens, prices, or data that are not in the tool result
    6.  DO NOT round numbers, change decimals, or "clean up" addresses
    7.  DO NOT invent placeholder data like "$0.001637" if the tool didn't return it
-   **FORBIDDEN**: You are FORBIDDEN from:
    -   Saying "Top X" when the tool returned fewer items
    -   Adding example/placeholder rows to "fill out" a table
    -   Guessing prices, volumes, or addresses
    -   Using your training data for ANY crypto market information
-   **Chain Detection**: Infer chain from context (e.g., "on Solana", "CA: 0x..."). Default to Ethereum (1) if ambiguous.
-   **Step-by-Step**: For complex requests (e.g., "Analyze this token"), chain tools:
    1.  get_token_info (verify CA)
    2.  get_token_price (market cap)
    3.  check_token_risk (safety)
    4.  get_early_buyers (smart money)
    5.  external_web_search (news/sentiment if needed)
-   **JSON Only**: Do not output markdown or text when calling tools. Just the tool call.
-   **Gas Calculation**: Fee = Gas Limit * Gas Price. (ETH Tx ~21k, Swap ~200k).

**RESPONSE STYLE**:
-   Be concise.
-   Present data in tables or bullet points.
-   Highlight risks immediately.
-   ALWAYS state how many results the tool returned (e.g., "The tool returned 5 tokens:")`;


                // Add or append to system prompt
                if (conversationMessages.length > 0 && conversationMessages[0].role === 'system') {
                    conversationMessages[0].content += `\n\n${SYSTEM_PROMPT}`;
                } else {
                    conversationMessages.unshift({
                        role: 'system',
                        content: SYSTEM_PROMPT
                    });
                }
                // -------------------------------

                const collectedCitations: string[] = [];
                const collectedClientActions: any[] = [];
                let iteration = 0;
                // Set up streaming response headers
                if (stream) {
                    reply.raw.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': origin,
                        'Access-Control-Allow-Credentials': 'true',
                        'Vary': 'Origin',
                    });
                }

                // Increased max iterations for complex tool chains (e.g., multiple security checks)
                let maxIterations = 10; // Allow more iterations for complex queries with multiple tools

                while (iteration < maxIterations) {
                    iteration++;

                    const requestBody: any = {
                        model,
                        messages: conversationMessages,
                        temperature,
                        max_tokens,
                        stream: true, // Always use streaming for real-time output
                    };

                    if (enable_search) {
                        // Load tools from registry (filter if allowed_tools is provided)
                        requestBody.tools = getOpenAITools((request.body as any).allowed_tools);
                        // Let model decide; avoid forcing endless tool chains
                        if (requestBody.tools && requestBody.tools.length > 0) {
                            requestBody.tool_choice = 'auto';

                            // Debug log to confirm tools are attached
                            const toolNames = requestBody.tools.map((t: any) => t.function?.name || t.name);
                            console.log(`[AI Routes] Attached tools: ${toolNames.join(', ')}, tool_choice: ${requestBody.tool_choice}`);
                        } else {
                            console.warn('[AI Routes] enable_search was true but no tools were attached');
                        }
                    } else {
                        console.log('[AI Routes] enable_search=false, tools will not be sent');
                    }

                    // Observability: log high-level request intent (safe, no message content)
                    const toolCount = requestBody.tools?.length || 0;
                    console.log(`[AI Routes] DeepSeek request summary => model: ${model}, enable_search: ${enable_search}, tool_count: ${toolCount}, tool_choice: ${requestBody.tool_choice || 'none'}`);

                    console.log(`[AI Routes] Iteration ${iteration}: Streaming request to DeepSeek`);

                    // Retry logic for DeepSeek API calls
                    let response: Response | null = null;
                    let streamResult: { hasToolCalls: boolean; toolCalls: any[]; assistantContent: string; reasoningContent: string } | null = null;
                    const maxRetries = 3;

                    for (let attempt = 0; attempt < maxRetries; attempt++) {
                        try {
                            response = await fetch(DEEPSEEK_API_URL, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${apiKey}`,
                                },
                                body: JSON.stringify(requestBody),
                            });

                            if (!response.ok || !response.body) {
                                const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
                                console.error(`[AI Routes] DeepSeek API error (iteration ${iteration}, attempt ${attempt + 1}):`, errorData);
                                if (stream) {
                                    reply.raw.write(`data: ${JSON.stringify({ error: errorData.error?.message || 'API error' })}\n\n`);
                                    reply.raw.end();
                                } else {
                                    return reply.code(response.status).send({
                                        error: errorData.error?.message || 'DeepSeek API error',
                                    });
                                }
                                return;
                            }

                            console.log(`[AI Routes] DeepSeek response received (iteration ${iteration}, attempt ${attempt + 1}), processing stream...`);

                            // Process stream and detect tool calls (forwards to client in real-time)
                            streamResult = await processStreamResponse(response, stream ? reply : null);

                            // If we get here, stream processing succeeded
                            break;

                        } catch (streamError: any) {
                            console.error(`[AI Routes] Stream error (attempt ${attempt + 1}/${maxRetries}):`, streamError.message);

                            // Check if it's a socket/connection error that we should retry
                            const isRetryable = streamError.message?.includes('terminated') ||
                                streamError.message?.includes('SocketError') ||
                                streamError.code === 'UND_ERR_SOCKET' ||
                                streamError.cause?.code === 'UND_ERR_SOCKET';

                            if (isRetryable && attempt < maxRetries - 1) {
                                console.log(`[AI Routes] Retryable error, waiting before retry...`);
                                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                                continue;
                            }

                            // If not retryable or out of retries, send error to client
                            if (stream) {
                                try {
                                    reply.raw.write(`data: ${JSON.stringify({
                                        error: 'Connection to AI service was interrupted. Please try again.',
                                        tool_status: 'Connection error'
                                    })}\n\n`);
                                    reply.raw.write('data: [DONE]\n\n');
                                    reply.raw.end();
                                } catch (e) {
                                    // Client already disconnected
                                }
                            }
                            return;
                        }
                    }

                    if (!streamResult) {
                        console.error(`[AI Routes] Failed to get stream result after ${maxRetries} attempts`);
                        if (stream) {
                            reply.raw.write(`data: ${JSON.stringify({ error: 'Failed to connect to AI service after multiple attempts' })}\n\n`);
                            reply.raw.end();
                        }
                        return;
                    }

                    const result = streamResult as any;
                    const { hasToolCalls, toolCalls, assistantContent, reasoningContent, usage } = result;

                    console.log(`[AI Routes] Stream processed - hasToolCalls: ${hasToolCalls}, toolCalls: ${toolCalls.length}, contentLength: ${assistantContent.length}`);

                    if (hasToolCalls && toolCalls.length > 0) {
                        console.log(`[AI Routes] Tool calls detected:`, toolCalls.length);

                        // Send tool call status to client
                        if (stream) {
                            const statusChunk = {
                                id: 'tool-status',
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model,
                                choices: [{
                                    index: 0,
                                    delta: { tool_status: 'Searching the web...' },
                                    finish_reason: null
                                }]
                            };
                            reply.raw.write(`data: ${JSON.stringify(statusChunk)}\n\n`);
                        }

                        // Add assistant message with tool calls
                        // IMPORTANT: For thinking mode, we must include reasoning_content
                        conversationMessages.push({
                            role: 'assistant',
                            content: assistantContent || '',
                            tool_calls: toolCalls,
                            reasoning_content: reasoningContent || '' // Required for thinking mode
                        } as any);

                        // Execute tool calls with timeout protection
                        try {
                            const { toolMessages, citations, clientActions } = await executeToolCalls(toolCalls);
                            collectedCitations.push(...citations);

                            // Collect client actions
                            if (clientActions && clientActions.length > 0) {
                                (collectedClientActions as any[]).push(...clientActions);
                            }

                            conversationMessages.push(...toolMessages);

                            console.log(`[AI Routes] Tool execution complete, continuing to iteration ${iteration + 1}`);
                            // Continue loop for follow-up response
                            continue;
                        } catch (toolError: any) {
                            console.error(`[AI Routes] Tool execution failed:`, toolError);
                            // Send error message to client and continue
                            if (stream) {
                                reply.raw.write(`data: ${JSON.stringify({
                                    error: `Tool execution failed: ${toolError.message}`,
                                    tool_status: 'Error executing tools'
                                })}\n\n`);
                            }
                            // Add error message to conversation and continue
                            conversationMessages.push({
                                role: 'tool',
                                content: `Error: ${toolError.message || 'Tool execution failed'}`,
                            } as any);
                            continue;
                        }
                    }

                    // No tool calls - this is the final response
                    console.log(`[AI Routes] Final streaming response completed (iteration ${iteration})`);

                    // Send citations, client actions, and usage if we have them
                    if (stream && (collectedCitations.length > 0 || collectedClientActions.length > 0 || usage)) {
                        const extraDataChunk = {
                            id: 'extras',
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model,
                            choices: [{
                                index: 0,
                                delta: {},
                                finish_reason: null,
                                message: {
                                    citations: collectedCitations.length > 0 ? collectedCitations : undefined,
                                    client_actions: collectedClientActions.length > 0 ? collectedClientActions : undefined
                                }
                            }],
                            usage: usage // Add usage data at the top level
                        };
                        console.log('[AI Routes] Sending usage data to client:', usage);
                        reply.raw.write(`data: ${JSON.stringify(extraDataChunk)}\n\n`);
                    }

                    if (stream) {
                        // Send [DONE] marker to indicate stream completion
                        reply.raw.write('data: [DONE]\n\n');
                        reply.raw.end();
                    } else {
                        // Non-streaming response
                        return reply.send({
                            id: 'response',
                            object: 'chat.completion',
                            created: Math.floor(Date.now() / 1000),
                            model,
                            choices: [{
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: assistantContent,
                                    citations: collectedCitations.length > 0 ? collectedCitations : undefined
                                },
                                finish_reason: 'stop'
                            }]
                        });
                    }
                    return;
                }

                // Reached max iterations - try to send a helpful message instead of just error
                console.warn(`[AI Routes] Maximum iterations (${maxIterations}) reached. Attempting to send summary response.`);

                if (stream) {
                    // Try to get a final summary response from AI about what was accomplished
                    try {
                        // Add a system message asking for summary
                        const summaryRequest = {
                            model,
                            messages: [
                                ...conversationMessages.slice(0, -1), // Remove last assistant message
                                {
                                    role: 'user',
                                    content: 'Please provide a brief summary of what we accomplished so far. The conversation reached the maximum tool call limit, but please summarize the key findings.'
                                }
                            ],
                            temperature: 0.7,
                            max_tokens: 500,
                            stream: true,
                        };

                        const summaryResponse = await fetch(DEEPSEEK_API_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`,
                            },
                            body: JSON.stringify(summaryRequest),
                        });

                        if (summaryResponse.ok && summaryResponse.body) {
                            const { assistantContent } = await processStreamResponse(summaryResponse, reply, true);
                            if (assistantContent) {
                                console.log('[AI Routes] Summary response sent successfully');
                            }
                        }
                    } catch (summaryError: any) {
                        console.error('[AI Routes] Failed to generate summary:', summaryError);
                        // Fallback to error message
                        reply.raw.write(`data: ${JSON.stringify({
                            error: `Maximum iterations (${maxIterations}) reached. Please try breaking your request into smaller parts.`,
                            tool_status: 'Iteration limit reached'
                        })}\n\n`);
                    }

                    // Send [DONE] marker
                    reply.raw.write('data: [DONE]\n\n');
                    reply.raw.end();
                } else {
                    return reply.code(500).send({
                        error: `Maximum tool call iterations (${maxIterations}) reached. Please try breaking your request into smaller parts.`,
                        iterations: maxIterations
                    });
                }

            } catch (error: any) {
                fastify.log.error('Error in AI chat endpoint:', error);

                // Get these from request body safely if possible, or fallback
                const stream = (request.body as any)?.stream || false;
                const origin = request.headers.origin || 'http://localhost:5173';

                // Handle errors differently for streaming vs non-streaming
                if (stream) {
                    // For streaming, write error as SSE event if headers not sent yet
                    try {
                        if (!reply.raw.headersSent) {
                            reply.raw.writeHead(200, {
                                'Content-Type': 'text/event-stream',
                                'Cache-Control': 'no-cache',
                                'Connection': 'keep-alive',
                                'Access-Control-Allow-Origin': origin,
                                'Access-Control-Allow-Credentials': 'true',
                                'Vary': 'Origin',
                            });
                        }
                        reply.raw.write(`data: ${JSON.stringify({ error: error.message || 'Internal server error' })}\n\n`);
                        reply.raw.end();
                    } catch (writeError) {
                        // If we can't write, just log it
                        fastify.log.error('Error writing error response');
                    }
                } else {
                    // For non-streaming, use standard error response
                    return reply.code(500).send({
                        error: error.message || 'Internal server error',
                    });
                }
            }
        }
    );

    // Skills metadata endpoint for frontend
    fastify.get('/agent/skills', async (request, reply) => {
        try {
            const { skillRegistryExec } = await import('../skills/registry.js');
            const allSkills = skillRegistryExec.getAllSkills();

            // Transform skills into frontend-friendly format
            const skillsMetadata = allSkills.map(skill => ({
                id: skill.metadata.id,
                name: skill.metadata.name,
                description: skill.metadata.description,
                examples: skill.metadata.examples,
                tools: skill.metadata.tools
            }));

            return reply.send({
                skills: skillsMetadata,
                count: skillsMetadata.length
            });
        } catch (error: any) {
            fastify.log.error('Error fetching skills:', error);
            return reply.code(500).send({
                error: 'Failed to fetch skills',
                message: error.message
            });
        }
    });

    // Unified tool execution endpoint (used by Grok service)
    fastify.post('/tools/execute', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const body = request.body as any;
            const toolName = body?.name;
            const args = body?.arguments || {};
            const toolContext = body?.tool_context || {};

            if (!toolName) {
                return reply.code(400).send({ error: 'Missing tool name' });
            }

            const user = (request as any).user;
            const context = {
                ...toolContext,
                userId: toolContext.userId || user?.sub,
                userAddress: toolContext.userAddress || toolContext.walletAddress,
            };

            const result = await toolRegistry.execute(toolName, args, context);
            return reply.send({ result });
        } catch (error: any) {
            fastify.log.error('Error executing tool:', error);
            return reply.code(500).send({
                error: error.message || 'Tool execution failed',
            });
        }
    });

    fastify.get('/health', async (request, reply) => {
        try {
            const apiKey = getDeepSeekApiKey();
            return reply.send({ status: 'ok', hasApiKey: !!apiKey });
        } catch (error: any) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });
}
