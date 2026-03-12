import type { ChatContextSnapshot, OrchestratorToolCall, OrchestratorToolResult } from './contracts.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

const ORCHESTRATION_SERVICE_URL = (process.env.ORCHESTRATION_SERVICE_URL || 'http://127.0.0.1:8000/orchestration').replace(/\/+$/, '');
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';
const STREAM_POLL_MS = Math.max(100, parseInt(process.env.ORCHESTRATION_STREAM_POLL_MS || '250', 10) || 250);
const FIRST_EVENT_WARN_MS = Math.max(1000, parseInt(process.env.ORCHESTRATION_FIRST_EVENT_WARN_MS || '5000', 10) || 5000);

function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (INTERNAL_SERVICE_KEY) {
        headers['X-Service-Key'] = INTERNAL_SERVICE_KEY;
        headers['X-Internal-Service-Key'] = INTERNAL_SERVICE_KEY;
    }
    return headers;
}

export class PythonOrchestratorClient {
    async run(params: {
        snapshot: ChatContextSnapshot;
        onTextDelta: (text: string) => Promise<void>;
        onReasoningDelta: (text: string) => Promise<void>;
        onUsage: (usage: Record<string, any>) => void;
        onCitation: (citation: any) => void;
        onToolCall: (call: OrchestratorToolCall) => Promise<OrchestratorToolResult>;
        onConversationState?: (state: { previousResponseId?: string }) => Promise<void> | void;
        shouldCancel?: () => Promise<boolean>;
    }) {
        const headers = buildHeaders();
        const startedAt = Date.now();
        logger.info(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: creating run', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            model: params.snapshot.model,
            messageLength: params.snapshot.lastUserMessage?.length || 0,
        });
        const createResp = await fetch(`${ORCHESTRATION_SERVICE_URL}/internal/v1/runs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ snapshot: params.snapshot }),
        });
        if (!createResp.ok) {
            throw new Error(`Failed to start orchestration run: ${await createResp.text()}`);
        }
        const createData = await createResp.json() as { run_id: string };
        const runId = createData.run_id;
        logger.info(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: run created', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            runId,
            elapsedMs: Date.now() - startedAt,
        });
        const streamAbort = new AbortController();

        const streamResp = await fetch(`${ORCHESTRATION_SERVICE_URL}/internal/v1/runs/${runId}/stream`, {
            method: 'GET',
            headers,
            signal: streamAbort.signal,
        });
        if (!streamResp.ok || !streamResp.body) {
            throw new Error(`Failed to open orchestration stream: ${await streamResp.text()}`);
        }
        logger.info(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: stream opened', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            runId,
            elapsedMs: Date.now() - startedAt,
        });

        const reader = streamResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null = reader.read();
        let firstEventLogged = false;
        let firstEventWarned = false;
        let eventCount = 0;

        while (true) {
            if (params.shouldCancel && await params.shouldCancel()) {
                logger.warn(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: cancellation requested during stream', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    runId,
                    elapsedMs: Date.now() - startedAt,
                    eventCount,
                });
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
                    logger.warn(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: no orchestration event yet', {
                        sessionId: params.snapshot.sessionId,
                        taskId: params.snapshot.taskId,
                        runId,
                        waitedMs: Date.now() - startedAt,
                        model: params.snapshot.model,
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
                    logger.info(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: first orchestration event received', {
                        sessionId: params.snapshot.sessionId,
                        taskId: params.snapshot.taskId,
                        runId,
                        eventType: event.type,
                        elapsedMs: Date.now() - startedAt,
                    });
                }
                if (event.type === 'assistant_delta') {
                    await params.onTextDelta(String(event.payload?.text || ''));
                } else if (event.type === 'reasoning_delta') {
                    await params.onReasoningDelta(String(event.payload?.text || ''));
                } else if (event.type === 'usage') {
                    params.onUsage(event.payload?.usage || {});
                } else if (event.type === 'citation') {
                    params.onCitation(event.payload?.citation ?? event.payload?.citations);
                } else if (event.type === 'conversation_state') {
                    await params.onConversationState?.({
                        previousResponseId: event.payload?.previous_response_id ? String(event.payload.previous_response_id) : undefined,
                    });
                } else if (event.type === 'tool_call') {
                    if (params.shouldCancel && await params.shouldCancel()) {
                        logger.warn(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: cancellation requested before tool execution', {
                            sessionId: params.snapshot.sessionId,
                            taskId: params.snapshot.taskId,
                            runId,
                            toolName: event.payload?.name,
                        });
                        streamAbort.abort();
                        throw new Error('Task cancelled');
                    }
                    const call: OrchestratorToolCall = {
                        id: String(event.payload?.id || ''),
                        name: String(event.payload?.name || ''),
                        arguments: event.payload?.arguments || {},
                    };
                    const result = await params.onToolCall(call);
                    await fetch(`${ORCHESTRATION_SERVICE_URL}/internal/v1/runs/${runId}/tool-results`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(result),
                    });
                } else if (event.type === 'error') {
                    throw new Error(String(event.payload?.message || 'Python orchestration failed'));
                } else if (event.type === 'message_complete') {
                    logger.info(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: message_complete received', {
                        sessionId: params.snapshot.sessionId,
                        taskId: params.snapshot.taskId,
                        runId,
                        elapsedMs: Date.now() - startedAt,
                        eventCount,
                    });
                    return;
                }
            }
        }
        logger.warn(LogCode.AI_ORCHESTRATOR, 'PythonOrchestratorClient: stream ended without message_complete', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            runId,
            elapsedMs: Date.now() - startedAt,
            eventCount,
        });
    }
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
