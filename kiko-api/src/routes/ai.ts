/**
 * AI Routes
 * Proxy for AI API calls to avoid CORS issues
 * Supports DeepSeek/GPT tool calls for web search with real-time streaming
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { toolRegistry } from '../tooling/index.js';
import { promptOrchestrator } from '../services/ai/PromptOrchestrator.js';
import { parseIntent } from '../services/ai/intentParser.js';
import { skillRegistryExec } from '../skills/registry.js';
import { searchWeb, formatSearchResults } from '../services/searchService.js';
import { requireAuth } from '../middleware/auth.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { resolveGeoFromIp } from '../services/ipGeo.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { evaluateUsageAccess } from '../services/usageAccess.js';
import { insertUsageRecord } from '../repositories/billingRepository.js';
import { computeUsdCost, getBillingCategory, getUtcDateString } from '../services/billing/billingService.js';
import { recordUsage } from '../services/usageCounter.js';
import { randomUUID } from 'crypto';
import { buildDailyMarketContext } from '../services/ai/dailyMarketContext.js';
import {
    createLeadingInternalScaffoldSuppressor,
    stripLeadingInternalScaffold,
} from '../services/ai/promptLeakSanitizer.js';

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
    walletAddress?: string;
    tool_config?: {
        web_search?: Record<string, any>;
        x_search?: Record<string, any>;
    };
    client_timezone?: string;
    chain_context?: {
        chainId: number;
        chainName: string;
    };
}

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

function normalizeModel(model?: string): string {
    const normalized = (model || '').toLowerCase().trim();
    if (!normalized) return 'deepseek-chat';
    if (normalized === 'gpt5-2' || normalized === 'gpt-5.2') return 'gpt-5-mini';
    return normalized;
}

// Helper to get API Key by model provider
function getApiKey(model: string): string {
    const normalized = normalizeModel(model);
    const useOpenAI = normalized.startsWith('gpt');
    const key = useOpenAI ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
    if (!key) {
        throw new Error(useOpenAI ? 'OPENAI_API_KEY is not set in environment variables' : 'DEEPSEEK_API_KEY is not set in environment variables');
    }
    return key;
}

/**
 * Execute tool calls and return results
 */
async function executeToolCalls(toolCalls: any[]): Promise<{ toolMessages: ChatMessage[]; citations: any[]; clientActions: any[] }> {
    const toolMessages: any[] = [];
    const allCitations: any[] = [];
    const clientActions: any[] = [];

    for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs: any = {};

        try {
            functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            logger.error(LogCode.AI_TOOL_USED, `[AI Routes] Failed to parse args for ${functionName}`, { args: toolCall.function.arguments });
            toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: Invalid JSON arguments for tool ${functionName}`
            });
            continue;
        }

        logger.info(LogCode.AI_TOOL_USED, `[AI Routes] Executing tool: ${functionName}`, { args: functionArgs });

        try {
            // Execute tool via registry with timeout (30 seconds max per tool)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Tool ${functionName} execution timeout (30s)`)), 30000);
            });
            let result = await Promise.race([
                toolRegistry.execute(functionName, functionArgs),
                timeoutPromise
            ]) as any;

            if (result && typeof result === 'object' && Array.isArray(result.citations)) {
                allCitations.push(...result.citations);
            }

            // Check for client action (Protocol: tool returns { __client_action: ... })
            if (result && typeof result === 'object' && result.__client_action) {
                logger.info(LogCode.AI_TOOL_USED, `[AI Routes] Tool ${functionName} returned client action`);
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
                result = result.results || JSON.stringify(result);
            }

            // Convert result to string if it's an object
            const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

            // Log tool result for debugging (summarized)
            // Log tool result for debugging (Full fidelity)
            logger.debug(LogCode.AI_TOOL_USED, `[AI Routes] Tool ${functionName} result`, { length: content.length, result: content });

            toolMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `TOOL RESULT - USE THIS DATA EXACTLY AS PROVIDED:\n${content}\n\nIMPORTANT: Copy all fields (names, symbols, prices, addresses) VERBATIM from the JSON above. Do NOT invent, round, or modify any values.`
            });

            logger.debug(LogCode.AI_TOOL_USED, `[AI Routes] Tool ${functionName} completed`);
        } catch (error: any) {
            logger.error(LogCode.AI_TOOL_USED, `[AI Routes] Tool ${functionName} error`, { error });

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
    const contentSuppressor = createLeadingInternalScaffoldSuppressor();
    let streamModel = '';

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

                let lineToForward = line;
                let skipForward = false;
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const choice = data.choices?.[0];
                        if (typeof data.model === 'string' && data.model) {
                            streamModel = data.model;
                        }

                        if (choice?.delta?.content) {
                            const visibleContent = contentSuppressor.push(choice.delta.content);
                            assistantContent += visibleContent;
                            if (visibleContent) {
                                choice.delta.content = visibleContent;
                            } else if (!choice.delta.reasoning_content && !choice.delta.tool_calls && !data.usage) {
                                skipForward = true;
                            } else {
                                delete choice.delta.content;
                            }
                            lineToForward = `data: ${JSON.stringify(data)}`;
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
                            logger.debug(LogCode.PERF_METRIC, '[AI Routes] DeepSeek usage extracted', { usage });
                        }
                    } catch (e) {
                        // Ignore parse errors
                        logger.warn(LogCode.AI_API_CALL, '[AI Routes] Failed to parse stream chunk', { chunk: line });
                    }
                }

                // Forward line to client if needed (but not [DONE])
                if (shouldForward && reply) {
                    try {
                        if (line.trim() !== 'data: [DONE]') {
                            if (skipForward) {
                                continue;
                            }
                            reply.raw.write(lineToForward + '\n');
                        }
                    } catch (writeError: any) {
                        // If write fails (client disconnected), stop forwarding
                        logger.error(LogCode.WS_ERROR, '[AI Routes] Failed to write to client stream', { error: writeError.message });
                        throw writeError;
                    }
                }
            }
        }
    } catch (error: any) {
        logger.error(LogCode.AI_API_CALL, '[AI Routes] Stream processing error', { error });
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

    const trailingVisibleContent = contentSuppressor.flush();
    if (trailingVisibleContent) {
        assistantContent += trailingVisibleContent;
        if (shouldForward && reply) {
            const trailingChunk = {
                id: 'sanitized-tail',
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: streamModel || 'deepseek-chat',
                choices: [{
                    index: 0,
                    delta: { content: trailingVisibleContent },
                    finish_reason: null,
                }],
            };
            reply.raw.write(`data: ${JSON.stringify(trailingChunk)}\n\n`);
        }
    }

    assistantContent = stripLeadingInternalScaffold(assistantContent);

    return { hasToolCalls, toolCalls, assistantContent, reasoningContent, usage };
}

async function persistProxyUsage(params: {
    userId?: string;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    toolCallsCount?: number;
    toolCallNames?: string[];
    isFree?: boolean;
}): Promise<void> {
    if (!params.userId) return;

    const assistantMessageId = `ai-route-${randomUUID()}`;
    const usage = params.usage || {};
    const promptTokens = Number(usage.prompt_tokens || 0);
    const completionTokens = Number(usage.completion_tokens || 0);
    const totalTokens = Number(usage.total_tokens || promptTokens + completionTokens);
    const modelCategory = getBillingCategory(params.model);
    const toolCallsCount = Number(params.toolCallsCount || 0);
    const usdCost = computeUsdCost(
        params.usage,
        params.model,
        Array.isArray(params.toolCallNames) && params.toolCallNames.length > 0
            ? params.toolCallNames
            : toolCallsCount
    );
    const dateUtc = getUtcDateString();

    try {
        await insertUsageRecord({
            assistantMessageId,
            userId: params.userId,
            model: params.model,
            modelCategory,
            promptTokens,
            completionTokens,
            totalTokens,
            toolCallsCount,
            usdCost,
            dateUtc,
            isFree: params.isFree !== false,
        });
        await recordUsage({
            userId: params.userId,
            dateUtc,
            modelCategory,
            assistantMessageId,
        });
    } catch (error: any) {
        logger.warn(LogCode.DB_TRANSACTION_FAILED, '[AI Routes] Usage ledger insert failed', {
            error: error?.message || error
        });
    }
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

                const normalizedModel = normalizeModel(model);
                const userId = (request as any).user?.sub;
                logger.info(LogCode.AI_API_CALL, '[AI Routes] Legacy /api/ai/chat invoked', {
                    model: normalizedModel,
                    userId: userId || undefined,
                    stream,
                    messageCount: Array.isArray(messages) ? messages.length : 0,
                });

                if (!userId) {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }

                let usageDecision: Awaited<ReturnType<typeof evaluateUsageAccess>>;
                try {
                    usageDecision = await evaluateUsageAccess({
                        userId,
                        model: normalizedModel
                    });
                } catch (usageError: any) {
                    logger.error(LogCode.SYS_ERROR, '[AI Routes] Usage limit check failed', { error: usageError?.message || usageError });
                    return reply.code(500).send({
                        error: 'Usage limit check failed',
                        reason: 'USAGE_CHECK_FAILED'
                    });
                }

                if (!usageDecision.allowed) {
                    return reply.code(429).send({
                        error: 'Daily limit reached',
                        reason: usageDecision.reason,
                        dateUtc: usageDecision.dateUtc,
                        totalUsed: usageDecision.totalUsed,
                        totalLimit: usageDecision.totalLimit,
                        tokenBalance: usageDecision.tokenBalance
                    });
                }

                // -----------------------------------------------------------------
                // GROK PROXY: Forward to kiko-python if model is grok-*
                // This keeps Grok logic (tool use, search) in the Python service
                // while providing a unified CORS-safe endpoint for the frontend.
                // -----------------------------------------------------------------
                if (normalizedModel.startsWith('grok-')) {
                    const grokServiceUrl = process.env.GROK_SERVICE_URL || 'http://localhost:8000/grok';
                    logger.info(LogCode.AI_MODE_ROUTED, `[AI Routes] Routing Grok request to ${grokServiceUrl}`);

                    try {
                        const grokMessages = Array.isArray(request.body.messages) ? [...request.body.messages] : [];
                        const lastUserMessage = grokMessages.filter(m => m.role === 'user').pop()?.content || '';
                        const parsedIntent = await parseIntent(lastUserMessage, {
                            userAddress: request.body.walletAddress,
                            chainId: request.body.chain_context?.chainId,
                            chainName: request.body.chain_context?.chainName,
                            isWalletConnected: !!request.body.walletAddress,
                        });
                        const intentType = parsedIntent.highLevel.type;
                        const routingMode: 'execution' = 'execution';
                        logger.info(LogCode.AI_MODE_ROUTED, '[AI Routes] Intent routed', {
                            intent: intentType,
                            routingMode,
                            model: normalizedModel,
                        });
                        const systemPrompt = promptOrchestrator.getSystemPrompt('grok', intentType, { routingMode });

                        const dailyMarketContext: string | null = null;

                        const bodyAny = request.body as any;
                        const toolContext = bodyAny?.tool_context || {};
                        const walletAddress = request.body.walletAddress || toolContext.walletAddress || toolContext.userAddress;
                        const nativeBalance = toolContext.nativeBalance ?? bodyAny.nativeBalance;
                        const balanceSnapshot = toolContext.balance ?? bodyAny.balance;
                        const balanceSnapshotAt =
                            toolContext.balanceSnapshotAt ||
                            toolContext.balanceFetchedAt ||
                            toolContext.balanceUpdatedAt ||
                            toolContext.balanceTimestamp;

                        const contextLines: string[] = [];
                        if (walletAddress) contextLines.push(`- Wallet: ${walletAddress}`);
                        if (request.body.chain_context?.chainId && request.body.chain_context?.chainName) {
                            contextLines.push(`- Chain: ${request.body.chain_context.chainName} (${request.body.chain_context.chainId})`);
                        }
                        const contextBlock = contextLines.length > 0
                            ? `[CONTEXT]\n${contextLines.join('\n')}`
                            : null;

                        const walletStateLines: string[] = [];
                        if (nativeBalance !== undefined && nativeBalance !== null && String(nativeBalance).trim() !== '') {
                            walletStateLines.push(`Native: ${nativeBalance}`);
                        }
                        if (balanceSnapshot && typeof balanceSnapshot === 'object') {
                            try {
                                const serialized = JSON.stringify(balanceSnapshot);
                                if (serialized && serialized !== '{}') {
                                    walletStateLines.push(`Balances: ${serialized}`);
                                }
                            } catch {
                                // Ignore non-serializable balance payloads.
                            }
                        }
                        if (balanceSnapshotAt) {
                            walletStateLines.push(`Snapshot: ${balanceSnapshotAt}`);
                        }
                        const walletStateBlock = walletStateLines.length > 0
                            ? `[WALLET_STATE]\n${walletStateLines.join('\n')}`
                            : null;

                        const systemMessages: ChatMessage[] = [
                            { role: 'system', content: systemPrompt },
                            ...(dailyMarketContext ? [{ role: 'system' as const, content: dailyMarketContext }] : []),
                            ...(contextBlock ? [{ role: 'system' as const, content: contextBlock }] : []),
                            ...(walletStateBlock ? [{ role: 'system' as const, content: walletStateBlock }] : [])
                        ];

                        const mergedMessages = [...systemMessages, ...grokMessages.filter(m => m.role !== 'system')];

                        const headers = request.headers as Record<string, string | string[] | undefined>;
                        const forwarded = headers['x-forwarded-for'];
                        const cfConnectingIp = headers['cf-connecting-ip'];
                        const headerIp = Array.isArray(forwarded) ? forwarded[0] : (forwarded || cfConnectingIp || '');
                        const clientIp = (headerIp || request.ip || '').toString();
                        const geo = await resolveGeoFromIp(clientIp);
                        const clientTimezone = request.body.client_timezone || geo.timezone;

                        let toolConfig = request.body.tool_config || {};
                        if (enable_search) {
                            const webSearch = { ...(toolConfig.web_search || {}) } as Record<string, any>;
                            if (clientTimezone && !webSearch.user_location_timezone) {
                                webSearch.user_location_timezone = clientTimezone;
                            }
                            if (geo.country && !webSearch.user_location_country) {
                                webSearch.user_location_country = geo.country;
                            }
                            if (geo.region && !webSearch.user_location_region) {
                                webSearch.user_location_region = geo.region;
                            }
                            if (geo.city && !webSearch.user_location_city) {
                                webSearch.user_location_city = geo.city;
                            }
                            if (Object.keys(webSearch).length > 0) {
                                toolConfig = { ...toolConfig, web_search: webSearch };
                            }
                        }

                        const requestBody = {
                            ...request.body,
                            messages: mergedMessages,
                            tool_config: toolConfig,
                        };

                        const response = await fetch(`${grokServiceUrl}/v1/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': request.headers.authorization as string,
                            },
                            body: JSON.stringify(requestBody),
                        });

                        if (!response.ok) {
                            const status = response.status;
                            const errorText = await response.text();
                            logger.error(LogCode.WTC_RPC_ERROR, `[AI Routes] Grok service error (${status})`, { error: errorText });
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
                            let grokBuffer = '';
                            let grokUsage: any = null;
                            const grokToolCallsById = new Map<string, string>();
                            let grokToolCallSeq = 0;

                            try {
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    reply.raw.write(value);

                                    grokBuffer += decoder.decode(value, { stream: true });
                                    const lines = grokBuffer.split('\n');
                                    grokBuffer = lines.pop() || '';

                                    for (const line of lines) {
                                        if (!line.startsWith('data: ')) continue;
                                        const data = line.slice(6).trim();
                                        if (!data || data === '[DONE]') continue;
                                        try {
                                            const parsed = JSON.parse(data);
                                            if (parsed.usage) grokUsage = parsed.usage;
                                            const deltaToolCalls = parsed?.choices?.[0]?.delta?.tool_calls;
                                            if (Array.isArray(deltaToolCalls)) {
                                                for (const tc of deltaToolCalls) {
                                                    const name = String(tc?.function?.name || '').trim().toLowerCase();
                                                    if (!name) continue;
                                                    const key = String(tc?.id || `idx_${tc?.index ?? grokToolCallSeq++}`);
                                                    if (!grokToolCallsById.has(key)) {
                                                        grokToolCallsById.set(key, name);
                                                    }
                                                }
                                            }
                                        } catch {
                                            // ignore malformed intermediate chunks
                                        }
                                    }
                                }
                            } catch (error) {
                                logger.error(LogCode.WS_ERROR, '[AI Routes] Grok stream interrupted', { error });
                            } finally {
                                await persistProxyUsage({
                                    userId,
                                    model: normalizedModel,
                                    usage: grokUsage,
                                    toolCallsCount: grokToolCallsById.size,
                                    toolCallNames: Array.from(grokToolCallsById.values()),
                                    isFree: true
                                });
                                reply.raw.end();
                                reader.releaseLock();
                            }
                            return;
                        } else {
                            const data = await response.json();
                            await persistProxyUsage({
                                userId,
                                model: normalizedModel,
                                usage: data?.usage,
                                toolCallsCount: Array.isArray(data?.choices?.[0]?.message?.tool_calls)
                                    ? data.choices[0].message.tool_calls.length
                                    : 0,
                                toolCallNames: Array.isArray(data?.choices?.[0]?.message?.tool_calls)
                                    ? data.choices[0].message.tool_calls
                                        .map((tc: any) => String(tc?.function?.name || '').trim().toLowerCase())
                                        .filter(Boolean)
                                    : [],
                                isFree: true
                            });
                            return reply.send(data);
                        }
                    } catch (error: any) {
                        logger.error(LogCode.API_FETCH_FAILED, '[AI Routes] Failed to proxy to Grok service', { error });
                        return reply.code(500).send({ error: `Grok service unreachable: ${error.message}` });
                    }
                }
                // -----------------------------------------------------------------

                if (!messages || !Array.isArray(messages) || messages.length === 0) {
                    return reply.code(400).send({
                        error: 'Invalid request: messages array is required',
                    });
                }

                const apiKey = getApiKey(normalizedModel);
                const targetUrl = normalizedModel.startsWith('gpt') ? OPENAI_API_URL : DEEPSEEK_API_URL;
                const origin = request.headers.origin || 'http://localhost:5173';
                let conversationMessages = [...messages];

                const lastUserMessage = conversationMessages.filter(m => m.role === 'user').pop()?.content || '';
                const parsedIntent = await parseIntent(lastUserMessage, {
                    userAddress: request.body.walletAddress,
                    chainId: request.body.chain_context?.chainId,
                    chainName: request.body.chain_context?.chainName,
                    isWalletConnected: !!request.body.walletAddress,
                });
                const intentType = parsedIntent.highLevel.type;
                const routingMode: 'execution' = 'execution';
                logger.info(LogCode.AI_MODE_ROUTED, '[AI Routes] Intent routed', {
                    intent: intentType,
                    routingMode,
                    model: normalizedModel,
                });
                const systemPrompt = promptOrchestrator.getSystemPrompt('deepseek', intentType, { routingMode });

                const dailyMarketContext: string | null = null;

                const contextLines: string[] = [];
                if (request.body.walletAddress) contextLines.push(`- Wallet: ${request.body.walletAddress}`);
                if (request.body.chain_context?.chainId && request.body.chain_context?.chainName) {
                    contextLines.push(`- Chain: ${request.body.chain_context.chainName} (${request.body.chain_context.chainId})`);
                }
                const contextBlock = contextLines.length > 0
                    ? `[CONTEXT]\n${contextLines.join('\n')}`
                    : null;

                const systemMessages: ChatMessage[] = [
                    { role: 'system', content: systemPrompt },
                    ...(dailyMarketContext ? [{ role: 'system' as const, content: dailyMarketContext }] : []),
                    ...(contextBlock ? [{ role: 'system' as const, content: contextBlock }] : [])
                ];

                // Prepend unified system prompt (and optional context) for backend-only prompt control
                conversationMessages = [...systemMessages, ...conversationMessages.filter(m => m.role !== 'system')];
                // -------------------------------

                const collectedCitations: string[] = [];
                const collectedClientActions: any[] = [];
                let iteration = 0;
                let totalToolCallsCount = 0;
                const totalToolCallNames: string[] = [];
                let lastUsage: any = null;
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
                        model: normalizedModel,
                        messages: conversationMessages,
                        temperature,
                        max_tokens,
                        stream: true, // Always use streaming for real-time output
                    };
                    if (normalizedModel.startsWith('gpt')) {
                        // OpenAI streaming requires include_usage to emit token usage chunks.
                        requestBody.stream_options = { include_usage: true };
                    }

                    if (enable_search) {
                        const intentStr = String(intentType).toUpperCase();
                        const matchedSkills = skillRegistryExec.getSkillsByIntent(intentStr);
                        const allowedToolNames = new Set<string>();
                        for (const skill of matchedSkills) {
                            for (const name of skill.metadata.tools || []) {
                                allowedToolNames.add(name);
                            }
                        }
                        if (!normalizedModel.startsWith('grok-')) {
                            allowedToolNames.add('external_web_search');
                        }

                        const definitions = toolRegistry.getAllDefinitions();
                        const blockedForGrok = normalizedModel.startsWith('grok-')
                            ? new Set(['external_web_search', 'get_trending_casts', 'get_farcaster_user', 'search_farcaster_casts'])
                            : null;
                        const filtered = definitions.filter(def => allowedToolNames.has(def.name) && !(blockedForGrok?.has(def.name)));
                        requestBody.tools = filtered.map(def => ({ type: 'function', function: def }));

                        if (requestBody.tools.length > 0) {
                            requestBody.tool_choice = 'auto';
                            const toolNames = requestBody.tools.map((t: any) => t.function?.name || t.name);
                            logger.info(LogCode.AI_TOOL_FILTERED, `[AI Routes] Attached tools`, { tools: toolNames, choice: requestBody.tool_choice });
                        } else {
                            logger.warn(LogCode.AI_TOOL_FILTERED, '[AI Routes] enable_search was true but no tools were attached');
                        }
                    } else {
                        logger.debug(LogCode.AI_TOOL_FILTERED, '[AI Routes] enable_search=false, tools will not be sent');
                    }

                    // Observability: log high-level request intent (safe, no message content)
                    const toolCount = requestBody.tools?.length || 0;
                    logger.info(LogCode.AI_API_CALL, `[AI Routes] DeepSeek request summary`, { model: normalizedModel, enable_search, toolCount, tool_choice: requestBody.tool_choice || 'none' });

                    logger.debug(LogCode.AI_API_CALL, `[AI Routes] Iteration ${iteration}: Streaming request to DeepSeek`);

                    // Retry logic for DeepSeek API calls
                    let response: Response | null = null;
                    let streamResult: { hasToolCalls: boolean; toolCalls: any[]; assistantContent: string; reasoningContent: string } | null = null;
                    const maxRetries = 3;

                    for (let attempt = 0; attempt < maxRetries; attempt++) {
                        try {
                            response = await fetch(targetUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${apiKey}`,
                                },
                                body: JSON.stringify(requestBody),
                            });

                            if (!response.ok || !response.body) {
                                const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
                                logger.error(LogCode.AI_API_ERROR, `[AI Routes] DeepSeek API error`, { iteration, attempt: attempt + 1, error: errorData });
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

                            logger.debug(LogCode.AI_API_CALL, `[AI Routes] DeepSeek response received`, { iteration, attempt: attempt + 1 });

                            // Process stream and detect tool calls (forwards to client in real-time)
                            streamResult = await processStreamResponse(response, stream ? reply : null);

                            // If we get here, stream processing succeeded
                            break;

                        } catch (streamError: any) {
                            logger.error(LogCode.WS_ERROR, `[AI Routes] Stream error`, { attempt: attempt + 1, maxRetries, error: streamError.message });

                            // Check if it's a socket/connection error that we should retry
                            const isRetryable = streamError.message?.includes('terminated') ||
                                streamError.message?.includes('SocketError') ||
                                streamError.code === 'UND_ERR_SOCKET' ||
                                streamError.cause?.code === 'UND_ERR_SOCKET';

                            if (isRetryable && attempt < maxRetries - 1) {
                                logger.info(LogCode.AI_API_CALL, `[AI Routes] Retryable error, waiting before retry...`);
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
                        logger.error(LogCode.AI_API_ERROR, `[AI Routes] Failed to get stream result after ${maxRetries} attempts`);
                        if (stream) {
                            reply.raw.write(`data: ${JSON.stringify({ error: 'Failed to connect to AI service after multiple attempts' })}\n\n`);
                            reply.raw.end();
                        }
                        return;
                    }

                    const result = streamResult as any;
                    const { hasToolCalls, toolCalls, assistantContent, reasoningContent, usage } = result;
                    if (usage) {
                        lastUsage = usage;
                    }

                    logger.debug(LogCode.AI_API_CALL, `[AI Routes] Stream processed`, { hasToolCalls, toolCallsCount: toolCalls.length, contentLength: assistantContent.length });

                    if (hasToolCalls && toolCalls.length > 0) {
                        totalToolCallsCount += toolCalls.length;
                        for (const tc of toolCalls) {
                            const name = String(tc?.function?.name || '').trim().toLowerCase();
                            if (name) totalToolCallNames.push(name);
                        }
                        logger.info(LogCode.AI_TOOL_USED, `[AI Routes] Tool calls detected`, { count: toolCalls.length });

                        // Send tool call status to client
                        if (stream) {
                            const statusChunk = {
                                id: 'tool-status',
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: normalizedModel,
                                choices: [{
                                    index: 0,
                                    delta: { tool_status: 'Searching the web...' },
                                    finish_reason: null
                                }]
                            };
                            reply.raw.write(`data: ${JSON.stringify(statusChunk)}\n\n`);
                        }

                        // Add assistant message with tool calls.
                        // Keep reasoning_content for provider compatibility when available.
                        conversationMessages.push({
                            role: 'assistant',
                            content: assistantContent || '',
                            tool_calls: toolCalls,
                            reasoning_content: reasoningContent || ''
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

                            logger.debug(LogCode.AI_TOOL_USED, `[AI Routes] Tool execution complete, continuing to iteration ${iteration + 1}`);
                            // Continue loop for follow-up response
                            continue;
                        } catch (toolError: any) {
                            logger.error(LogCode.AI_TOOL_USED, `[AI Routes] Tool execution failed`, { error: toolError });
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
                    logger.info(LogCode.AI_API_CALL, `[AI Routes] Final streaming response completed (iteration ${iteration})`);

                    // Send citations, client actions, and usage if we have them
                    if (stream && (collectedCitations.length > 0 || collectedClientActions.length > 0 || usage)) {
                        const extraDataChunk = {
                            id: 'extras',
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: normalizedModel,
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
                        logger.debug(LogCode.PERF_METRIC, '[AI Routes] Sending usage data to client', { usage });
                        reply.raw.write(`data: ${JSON.stringify(extraDataChunk)}\n\n`);
                    }

                    if (stream) {
                        await persistProxyUsage({
                            userId,
                            model: normalizedModel,
                            usage: lastUsage,
                            toolCallsCount: totalToolCallsCount,
                            toolCallNames: totalToolCallNames,
                            isFree: true
                        });
                        // Send [DONE] marker to indicate stream completion
                        reply.raw.write('data: [DONE]\n\n');
                        reply.raw.end();
                    } else {
                        await persistProxyUsage({
                            userId,
                            model: normalizedModel,
                            usage: lastUsage,
                            toolCallsCount: totalToolCallsCount,
                            toolCallNames: totalToolCallNames,
                            isFree: true
                        });
                        // Non-streaming response
                        return reply.send({
                            id: 'response',
                            object: 'chat.completion',
                            created: Math.floor(Date.now() / 1000),
                            model: normalizedModel,
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
                logger.warn(LogCode.AI_API_CALL, `[AI Routes] Maximum iterations (${maxIterations}) reached. Attempting to send summary response.`);

                if (stream) {
                    // Try to get a final summary response from AI about what was accomplished
                    try {
                        // Add a system message asking for summary
                        const summaryRequest = {
                            model: normalizedModel,
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

                        const summaryResponse = await fetch(targetUrl, {
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
                                logger.info(LogCode.AI_API_CALL, '[AI Routes] Summary response sent successfully');
                            }
                        }
                    } catch (summaryError: any) {
                        logger.error(LogCode.AI_API_ERROR, '[AI Routes] Failed to generate summary', { error: summaryError });
                        // Fallback to error message
                        reply.raw.write(`data: ${JSON.stringify({
                            error: `Maximum iterations (${maxIterations}) reached. Please try breaking your request into smaller parts.`,
                            tool_status: 'Iteration limit reached'
                        })}\n\n`);
                    }

                    // Send [DONE] marker
                    await persistProxyUsage({
                        userId,
                        model: normalizedModel,
                        usage: lastUsage,
                        toolCallsCount: totalToolCallsCount,
                        toolCallNames: totalToolCallNames,
                        isFree: true
                    });
                    reply.raw.write('data: [DONE]\n\n');
                    reply.raw.end();
                } else {
                    await persistProxyUsage({
                        userId,
                        model: normalizedModel,
                        usage: lastUsage,
                        toolCallsCount: totalToolCallsCount,
                        toolCallNames: totalToolCallNames,
                        isFree: true
                    });
                    return reply.code(500).send({
                        error: `Maximum tool call iterations (${maxIterations}) reached. Please try breaking your request into smaller parts.`,
                        iterations: maxIterations
                    });
                }

            } catch (error: any) {
                logger.error(LogCode.API_FETCH_FAILED, 'Error in AI chat endpoint', { error });

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
                        logger.error(LogCode.API_NOTIFY_FAILED, 'Error writing error response');
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
    fastify.get('/agent/skills', { preHandler: requireAuth }, async (request, reply) => {
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
            logger.error(LogCode.SYS_ERROR, 'Error fetching skills', { error });
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
            logger.error(LogCode.AI_TOOL_USED, 'Error executing tool', { error });
            return reply.code(500).send({
                error: error.message || 'Tool execution failed',
            });
        }
    });

    fastify.get('/health', async (request, reply) => {
        try {
            return reply.send({ status: 'ok' });
        } catch (error: any) {
            return reply.code(500).send({ status: 'error', message: error.message });
        }
    });
}
