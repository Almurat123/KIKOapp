import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { GenerationMessage } from './nodePromptAssembler.js';

const GENERATION_SERVICE_URL = (process.env.GENERATION_SERVICE_URL || 'http://127.0.0.1:8000/generation').replace(/\/+$/, '');
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';
const STREAM_POLL_MS = Math.max(100, parseInt(process.env.GENERATION_STREAM_POLL_MS || '250', 10) || 250);
const FIRST_EVENT_WARN_MS = Math.max(1000, parseInt(process.env.GENERATION_FIRST_EVENT_WARN_MS || '5000', 10) || 5000);

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
        onProviderState?: (state: { previousResponseId?: string }) => Promise<void> | void;
    }): Promise<{ toolCalls: GenerationToolCall[]; text: string; reasoning: string; providerState?: { previousResponseId?: string } }> {
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
        const response = await fetch(`${GENERATION_SERVICE_URL}/internal/v1/stream`, {
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
        let text = '';
        let reasoning = '';
        let providerState: { previousResponseId?: string } | undefined;

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
                    text += delta;
                    await params.onTextDelta(delta);
                } else if (event.type === 'reasoning_delta') {
                    const delta = String(event.payload?.text || '');
                    reasoning += delta;
                    await params.onReasoningDelta(delta);
                } else if (event.type === 'usage') {
                    params.onUsage(event.payload?.usage || {});
                } else if (event.type === 'citation') {
                    params.onCitation(event.payload?.citation ?? event.payload?.citations);
                } else if (event.type === 'provider_state') {
                    providerState = {
                        previousResponseId: event.payload?.previous_response_id ? String(event.payload.previous_response_id) : undefined,
                    };
                    await params.onProviderState?.(providerState);
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
                    const message = String(event.payload?.message || 'Python generation failed');
                    const raw = typeof event.payload?.raw === 'string' ? event.payload.raw.trim() : '';
                    const requestTail = event.payload?.request_tail;
                    throw new Error(
                        [
                            message,
                            raw || undefined,
                            requestTail ? `request_tail=${JSON.stringify(requestTail)}` : undefined,
                        ].filter(Boolean).join(' | ')
                    );
                } else if (event.type === 'message_complete') {
                    logger.info(LogCode.AI_ORCHESTRATOR, 'PythonGenerationClient: message_complete received', {
                        sessionId: params.sessionId,
                        taskId: params.taskId,
                        elapsedMs: Date.now() - startedAt,
                        eventCount,
                        toolCalls: toolCalls.map((item) => item.name),
                    });
                    return { toolCalls, text, reasoning, providerState };
                }
            }
        }
        throw new Error('Generation stream ended without message_complete');
    }
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
