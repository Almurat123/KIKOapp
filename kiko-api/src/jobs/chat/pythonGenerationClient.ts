import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { GenerationMessage } from './nodePromptAssembler.js';

const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';
const STREAM_POLL_MS = Math.max(100, parseInt(process.env.GENERATION_STREAM_POLL_MS || '250', 10) || 250);
const FIRST_EVENT_WARN_MS = Math.max(1000, parseInt(process.env.GENERATION_FIRST_EVENT_WARN_MS || '5000', 10) || 5000);

function getGenerationServiceUrl(): string {
    return (process.env.GENERATION_SERVICE_URL || 'http://127.0.0.1:8000/generation').replace(/\/+$/, '');
}

function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SERVICE_KEY) {
        headers['X-Service-Key'] = INTERNAL_SERVICE_KEY;
        headers['X-Internal-Service-Key'] = INTERNAL_SERVICE_KEY;
    }
    return headers;
}

export interface GenerationToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

type GenerationTerminalState = 'open' | 'completed' | 'errored';

function createGenerationStreamError(args: {
    message: string;
    code?: string;
    raw?: string;
    requestTail?: unknown;
}) {
    const fragments = [
        args.code ? `[${args.code}]` : undefined,
        args.message,
    ].filter(Boolean) as string[];
    const error = new Error(fragments.join(' | '));
    if (args.code) {
        (error as any).code = args.code;
    }
    if (args.raw) {
        (error as any).raw = args.raw;
    }
    if (args.requestTail) {
        (error as any).requestTail = args.requestTail;
    }
    return error;
}

export class PythonGenerationClient {
    async generate(params: {
        sessionId: string;
        taskId: string;
        model: string;
        messages: GenerationMessage[];
        tools: any[];
        providerOptions?: Record<string, any>;
        shouldCancel?: () => Promise<boolean>;
        onTextDelta: (text: string) => Promise<void>;
        onReasoningDelta: (text: string) => Promise<void>;
        onUsage: (usage: Record<string, any>) => void;
        onCitation: (citation: any) => void;
        onClientAction?: (action: any) => Promise<void> | void;
        onProviderProgress?: (progress: { status?: string; toolBatch?: Record<string, any> }) => Promise<void> | void;
        onLatencyMetrics?: (metrics: Record<string, any>) => Promise<void> | void;
        onProviderState?: (state: { previousResponseId?: string }) => Promise<void> | void;
    }): Promise<{
        toolCalls: GenerationToolCall[];
        text: string;
        reasoning: string;
        citations: any[];
        providerState?: { previousResponseId?: string };
        bufferedVisibleOutput?: boolean;
    }> {
        const headers = buildHeaders();
        const startedAt = Date.now();
        logger.info(LogCode.AI_ORCHESTRATOR, 'PythonGenerationClient: opening generation stream', {
            sessionId: params.sessionId,
            taskId: params.taskId,
            model: params.model,
            messageCount: params.messages.length,
            toolCount: params.tools.length,
        });

        const streamAbort = new AbortController();
        const response = await fetch(`${getGenerationServiceUrl()}/internal/v1/stream`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: params.model,
                messages: params.messages,
                tools: params.tools,
                provider_options: params.providerOptions || {},
                metadata: {
                    session_id: params.sessionId,
                    task_id: params.taskId,
                },
            }),
            signal: streamAbort.signal,
        });
        if (!response.ok || !response.body) {
            throw new Error(`Failed to open generation stream: ${await response.text()}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = reader.read();
        let buffer = '';
        let firstEventLogged = false;
        let firstEventWarned = false;
        let eventCount = 0;
        const toolCalls: GenerationToolCall[] = [];
        let textBuffer = '';
        let reasoningBuffer = '';
        let latestUsage: Record<string, any> | null = null;
        const bufferedCitations: any[] = [];
        let providerState: { previousResponseId?: string } | undefined;
        let terminalState: GenerationTerminalState = 'open';
        let toolCallSignalReceived = false;
        const bufferVisibleOutput = shouldBufferVisibleOutputForNativeSearchPhase(params.providerOptions, params.tools);
        const allowVisibleStreamingAfterToolSignal = !bufferVisibleOutput
            && shouldAllowVisibleStreamingAfterToolSignal(params.providerOptions, params.tools);

        const flushFinalCallbacks = async () => {
            if (latestUsage) {
                params.onUsage(latestUsage);
            }
            for (const citation of bufferedCitations) {
                params.onCitation(citation);
            }
        };

        while (true) {
            if (params.shouldCancel && await params.shouldCancel()) {
                streamAbort.abort();
                throw new Error('Task cancelled');
            }
            const next: { type: 'read'; result: ReadableStreamReadResult<Uint8Array> } | { type: 'tick' } = await Promise.race([
                pendingRead!.then((result) => ({ type: 'read' as const, result })),
                wait(STREAM_POLL_MS).then(() => ({ type: 'tick' as const })),
            ]);
            if (next.type === 'tick') {
                if (!firstEventLogged && !firstEventWarned && Date.now() - startedAt >= FIRST_EVENT_WARN_MS) {
                    firstEventWarned = true;
                    logger.warn(LogCode.AI_ORCHESTRATOR, 'PythonGenerationClient: no generation event yet', {
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        waitedMs: Date.now() - startedAt,
                        model: params.model,
                    });
                }
                continue;
            }
            const readResult: ReadableStreamReadResult<Uint8Array> = next.result;
            const done: boolean = readResult.done;
            const value: Uint8Array | undefined = readResult.value;
            pendingRead = done ? null : reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === '[DONE]') continue;
                const event = JSON.parse(raw) as { type: string; payload?: any };
                if (terminalState !== 'open') {
                    logger.warn(LogCode.AI_ORCHESTRATOR, 'PythonGenerationClient: ignoring post-terminal generation event', {
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        eventType: event.type,
                        terminalState,
                    });
                    continue;
                }
                eventCount += 1;
                if (!firstEventLogged) {
                    firstEventLogged = true;
                    logger.info(LogCode.AI_ORCHESTRATOR, 'PythonGenerationClient: first generation event received', {
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        eventType: event.type,
                        elapsedMs: Date.now() - startedAt,
                    });
                }
                if (event.type === 'assistant_delta') {
                    const delta = String(event.payload?.text || '');
                    textBuffer += delta;
                    if (delta && !bufferVisibleOutput && (!toolCallSignalReceived || allowVisibleStreamingAfterToolSignal)) {
                        await params.onTextDelta(delta);
                    }
                } else if (event.type === 'reasoning_delta') {
                    const delta = String(event.payload?.text || '');
                    reasoningBuffer += delta;
                    if (delta && !bufferVisibleOutput && (!toolCallSignalReceived || allowVisibleStreamingAfterToolSignal)) {
                        await params.onReasoningDelta(delta);
                    }
                } else if (event.type === 'usage') {
                    latestUsage = event.payload?.usage || {};
                } else if (event.type === 'citation') {
                    const citation = event.payload?.citation ?? event.payload?.citations;
                    if (!bufferVisibleOutput && allowVisibleStreamingAfterToolSignal) {
                        params.onCitation(citation);
                    } else {
                        bufferedCitations.push(citation);
                    }
                } else if (event.type === 'tool_call_signal') {
                    toolCallSignalReceived = true;
                } else if (event.type === 'provider_state') {
                    providerState = {
                        previousResponseId: event.payload?.previous_response_id ? String(event.payload.previous_response_id) : undefined,
                    };
                    await params.onProviderState?.(providerState);
                } else if (event.type === 'client_action') {
                    const actions = Array.isArray(event.payload?.client_actions)
                        ? event.payload.client_actions
                        : [];
                    for (const action of actions) {
                        await params.onClientAction?.(action);
                    }
                } else if (event.type === 'tool_progress') {
                    await params.onProviderProgress?.({
                        status: event.payload?.status ? String(event.payload.status) : undefined,
                        toolBatch: event.payload?.tool_batch && typeof event.payload.tool_batch === 'object'
                            ? event.payload.tool_batch
                            : undefined,
                    });
                } else if (event.type === 'latency_metrics') {
                    await params.onLatencyMetrics?.(event.payload || {});
                } else if (event.type === 'tool_call') {
                    const name = String(event.payload?.name || '').trim();
                    if (!name) {
                        logger.warn(LogCode.AI_ORCHESTRATOR, 'PythonGenerationClient: ignoring empty tool call', {
                            sessionId: params.sessionId,
                            taskId: params.taskId,
                            payload: event.payload,
                        });
                        continue;
                    }
                    toolCalls.push({
                        id: String(event.payload?.id || ''),
                        name,
                        arguments: event.payload?.arguments || {},
                    });
                } else if (event.type === 'error') {
                    terminalState = 'errored';
                    const message = String(event.payload?.message || 'Generation stream failed');
                    const code = String(event.payload?.code || '').trim() || undefined;
                    const errorRaw = typeof event.payload?.raw === 'string' ? event.payload.raw.trim() : '';
                    const requestTail = event.payload?.request_tail;
                    throw createGenerationStreamError({
                        message,
                        code,
                        raw: errorRaw || undefined,
                        requestTail,
                    });
                } else if (event.type === 'message_complete') {
                    terminalState = 'completed';
                    const hasToolCalls = toolCalls.length > 0;
                    const finalText = textBuffer;
                    const finalReasoning = reasoningBuffer;
                    if (!bufferVisibleOutput) {
                        await flushFinalCallbacks();
                    } else if (latestUsage) {
                        params.onUsage(latestUsage);
                    }
                    logger.info(LogCode.AI_ORCHESTRATOR, 'PythonGenerationClient: message_complete received', {
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        elapsedMs: Date.now() - startedAt,
                        eventCount,
                        hasToolCalls,
                        toolCallSignalReceived,
                        finalTextLength: finalText.length,
                        toolCalls: toolCalls.map((item) => item.name),
                        bufferedVisibleOutput: bufferVisibleOutput,
                    });
                    return {
                        toolCalls,
                        text: finalText,
                        reasoning: finalReasoning,
                        citations: flattenCitations(bufferedCitations),
                        providerState,
                        bufferedVisibleOutput: bufferVisibleOutput,
                    };
                }
            }
        }
        throw new Error('Generation stream ended without message_complete');
    }
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldAllowVisibleStreamingAfterToolSignal(
    providerOptions: Record<string, any> | undefined,
    tools: any[],
): boolean {
    const nativeTools = providerOptions?.tool_policy?.native_tools;
    const nativeSearchEnabled = Boolean(nativeTools?.enable_search);
    return nativeSearchEnabled && Array.isArray(tools) && tools.length === 0;
}

function shouldBufferVisibleOutputForNativeSearchPhase(
    providerOptions: Record<string, any> | undefined,
    tools: any[],
): boolean {
    const nativeTools = providerOptions?.tool_policy?.native_tools;
    const nativeSearchEnabled = Boolean(nativeTools?.enable_search);
    return nativeSearchEnabled && Array.isArray(tools) && tools.length === 0;
}

function flattenCitations(citations: any[]): any[] {
    return citations.flatMap((item) => Array.isArray(item) ? item : [item]).filter(Boolean);
}
