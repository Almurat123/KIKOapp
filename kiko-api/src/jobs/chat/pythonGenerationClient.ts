// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: frontend-visible streaming can only be diagnosed if provider SSE
//         deltas are logged before they enter the broker. A later NVIDIA/Kimi
//         regression showed some providers can continue emitting reasoning
//         deltas after visible assistant content has already started, and may
//         even place content and reasoning in the same raw provider chunk. The
//         Node generation client therefore needs an explicit answer-phase fence
//         so user-visible reasoning stops once the final answer stream begins.
// Goal: expose provider delta cadence, forwarding decisions, and cumulative
//       generated lengths without logging raw assistant text, while keeping the
//       visible reasoning stream bounded to the pre-answer phase.
// Owns: Node-to-Python generation stream parsing and callback forwarding.
// Does Not Own: broker broadcast, WebSocket delivery, or frontend rendering.
// Design Language:
// - provider delta logs should include whether the delta was forwarded or buffered
// - diagnostics log counts, lengths, and elapsed timing, not raw content
// - provider logs must correlate with broker chunk indices by task id
// - visible reasoning is a pre-answer channel and must freeze once visible answer text begins
// - if a provider delta carries both content and reasoning, content wins for the user-visible stream
// Document Provenance:
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: tracing whether model/provider streaming reaches the broker
// - Verification: verified in code
// - Source: DeepSeek reasoning model streaming example
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: preserving the reasoning-then-content stream boundary instead
//   of letting reasoning continue after visible answer text starts
// - Verification: verified in docs and code
// - Source: NVIDIA Kimi K2.5 model page
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: treating Instant-vs-Thinking as a provider intent that still
//   requires local fencing because observed runtime ordering may interleave
//   reasoning with visible answer text
// - Verification: verified in docs, observed in runtime, applied in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-reasoning-stream-answer-phase-fence.md
import { logger } from "../../utils/logger.js";
import { LogCode } from "../../config/logRegistry.js";
import { logChatStreamDebug } from "../../services/chatStreamDebug.js";
import type { GenerationMessage } from "./nodePromptAssembler.js";

const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || "";
const STREAM_POLL_MS = Math.max(
  100,
  parseInt(process.env.GENERATION_STREAM_POLL_MS || "250", 10) || 250,
);
const FIRST_EVENT_WARN_MS = Math.max(
  1000,
  parseInt(process.env.GENERATION_FIRST_EVENT_WARN_MS || "5000", 10) || 5000,
);
const STREAM_OPEN_MAX_ATTEMPTS = Math.max(
  1,
  parseInt(process.env.GENERATION_STREAM_OPEN_MAX_ATTEMPTS || "2", 10) || 2,
);
const STREAM_OPEN_RETRY_DELAY_MS = Math.max(
  50,
  parseInt(process.env.GENERATION_STREAM_OPEN_RETRY_DELAY_MS || "250", 10) ||
    250,
);
const GENERATION_STREAM_DEBUG_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "prod" &&
  process.env.GENERATION_STREAM_DEBUG !== "false";

function resolveStreamPhase(taskId: string): "normalize" | "assistant" {
  return String(taskId || "").endsWith(":normalize")
    ? "normalize"
    : "assistant";
}

function getGenerationServiceUrl(): string {
  return (
    process.env.GENERATION_SERVICE_URL || "http://127.0.0.1:8000/generation"
  ).replace(/\/+$/, "");
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (INTERNAL_SERVICE_KEY) {
    headers["X-Service-Key"] = INTERNAL_SERVICE_KEY;
    headers["X-Internal-Service-Key"] = INTERNAL_SERVICE_KEY;
  }
  return headers;
}

export interface GenerationToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface GenerationProviderState {
  previousResponseId?: string;
  finishReason?: string;
}

type GenerationTerminalState = "open" | "completed" | "errored";
type GenerationFunctionTool = {
  name: string;
  properties: Set<string>;
  required: Set<string>;
  index: number;
};

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
  const error = new Error(fragments.join(" | "));
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
    onProviderProgress?: (progress: {
      status?: string;
      toolBatch?: Record<string, any>;
    }) => Promise<void> | void;
    onLatencyMetrics?: (metrics: Record<string, any>) => Promise<void> | void;
    onProviderState?: (state: GenerationProviderState) => Promise<void> | void;
  }): Promise<{
    toolCalls: GenerationToolCall[];
    text: string;
    reasoning: string;
    citations: any[];
    providerState?: GenerationProviderState;
    bufferedVisibleOutput?: boolean;
  }> {
    const headers = buildHeaders();
    const startedAt = Date.now();
    logger.info(
      LogCode.AI_ORCHESTRATOR,
      "PythonGenerationClient: opening generation stream",
      {
        sessionId: params.sessionId,
        taskId: params.taskId,
        model: params.model,
        messageCount: params.messages.length,
        toolCount: params.tools.length,
      },
    );

    const requestBody = JSON.stringify({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
      provider_options: params.providerOptions || {},
      metadata: {
        session_id: params.sessionId,
        task_id: params.taskId,
      },
    });
    const streamAbort = new AbortController();
    const response = await openGenerationStreamWithRetry({
      sessionId: params.sessionId,
      taskId: params.taskId,
      headers,
      body: requestBody,
      signal: streamAbort.signal,
    });

    const responseBody = response.body;
    if (!responseBody) {
      throw new Error(
        "Failed to open generation stream: missing response body",
      );
    }
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let pendingRead: Promise<ReadableStreamReadResult<Uint8Array>> | null =
      reader.read();
    let buffer = "";
    let firstEventLogged = false;
    let firstEventWarned = false;
    let eventCount = 0;
    let assistantDeltaCount = 0;
    let reasoningDeltaCount = 0;
    const toolCalls: GenerationToolCall[] = [];
    let textBuffer = "";
    let reasoningBuffer = "";
    let latestUsage: Record<string, any> | null = null;
    const bufferedCitations: any[] = [];
    let providerState: GenerationProviderState | undefined;
    let terminalState: GenerationTerminalState = "open";
    let toolCallSignalReceived = false;
    let visibleAnswerStarted = false;
    const bufferVisibleOutput = shouldBufferVisibleOutputForNativeSearchPhase(
      params.providerOptions,
      params.tools,
    );
    const allowVisibleStreamingAfterToolSignal =
      !bufferVisibleOutput &&
      shouldAllowVisibleStreamingAfterToolSignal(
        params.providerOptions,
        params.tools,
      );
    const streamPhase = resolveStreamPhase(params.taskId);

    const flushFinalCallbacks = async () => {
      if (latestUsage) {
        params.onUsage(latestUsage);
      }
      for (const citation of bufferedCitations) {
        params.onCitation(citation);
      }
    };

    while (true) {
      if (params.shouldCancel && (await params.shouldCancel())) {
        streamAbort.abort();
        throw new Error("Task cancelled");
      }
      const next:
        | { type: "read"; result: ReadableStreamReadResult<Uint8Array> }
        | { type: "tick" } = await Promise.race([
        pendingRead!.then((result) => ({ type: "read" as const, result })),
        wait(STREAM_POLL_MS).then(() => ({ type: "tick" as const })),
      ]);
      if (next.type === "tick") {
        if (
          !firstEventLogged &&
          !firstEventWarned &&
          Date.now() - startedAt >= FIRST_EVENT_WARN_MS
        ) {
          firstEventWarned = true;
          logger.warn(
            LogCode.AI_ORCHESTRATOR,
            "PythonGenerationClient: no generation event yet",
            {
              sessionId: params.sessionId,
              taskId: params.taskId,
              waitedMs: Date.now() - startedAt,
              model: params.model,
            },
          );
        }
        continue;
      }
      const readResult: ReadableStreamReadResult<Uint8Array> = next.result;
      const done: boolean = readResult.done;
      const value: Uint8Array | undefined = readResult.value;
      pendingRead = done ? null : reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        const event = JSON.parse(raw) as { type: string; payload?: any };
        if (terminalState !== "open") {
          logger.warn(
            LogCode.AI_ORCHESTRATOR,
            "PythonGenerationClient: ignoring post-terminal generation event",
            {
              sessionId: params.sessionId,
              taskId: params.taskId,
              eventType: event.type,
              terminalState,
            },
          );
          continue;
        }
        eventCount += 1;
        if (!firstEventLogged) {
          firstEventLogged = true;
          logger.info(
            LogCode.AI_ORCHESTRATOR,
            "PythonGenerationClient: first generation event received",
            {
              sessionId: params.sessionId,
              taskId: params.taskId,
              eventType: event.type,
              elapsedMs: Date.now() - startedAt,
            },
          );
        }
        if (event.type === "assistant_delta") {
          const delta = String(event.payload?.text || "");
          textBuffer += delta;
          const shouldForward = Boolean(
            delta &&
            !bufferVisibleOutput &&
            (!toolCallSignalReceived || allowVisibleStreamingAfterToolSignal),
          );
          if (delta) {
            assistantDeltaCount += 1;
            logChatStreamDebug(
              LogCode.AI_ORCHESTRATOR,
              "PythonGenerationClient: assistant delta received",
              {
                sessionId: params.sessionId,
                taskId: params.taskId,
                streamPhase,
                model: params.model,
                eventIndex: eventCount,
                deltaIndex: assistantDeltaCount,
                deltaLength: delta.length,
                cumulativeTextLength: textBuffer.length,
                shouldForward,
                bufferVisibleOutput,
                toolCallSignalReceived,
                elapsedMs: Date.now() - startedAt,
              },
            );
          }
          if (shouldForward) {
            visibleAnswerStarted = true;
            await params.onTextDelta(delta);
          }
        } else if (event.type === "reasoning_delta") {
          const delta = String(event.payload?.text || "");
          reasoningBuffer += delta;
          const shouldForward = Boolean(
            delta &&
            !bufferVisibleOutput &&
            !visibleAnswerStarted &&
            (!toolCallSignalReceived || allowVisibleStreamingAfterToolSignal),
          );
          if (delta) {
            reasoningDeltaCount += 1;
            logChatStreamDebug(
              LogCode.AI_ORCHESTRATOR,
              "PythonGenerationClient: reasoning delta received",
              {
                sessionId: params.sessionId,
                taskId: params.taskId,
                streamPhase,
                model: params.model,
                eventIndex: eventCount,
                deltaIndex: reasoningDeltaCount,
                deltaLength: delta.length,
                cumulativeReasoningLength: reasoningBuffer.length,
                shouldForward,
                bufferVisibleOutput,
                visibleAnswerStarted,
                toolCallSignalReceived,
                elapsedMs: Date.now() - startedAt,
              },
            );
          }
          if (shouldForward) {
            await params.onReasoningDelta(delta);
          }
        } else if (event.type === "usage") {
          latestUsage = event.payload?.usage || {};
        } else if (event.type === "citation") {
          const citation = event.payload?.citation ?? event.payload?.citations;
          if (!bufferVisibleOutput && allowVisibleStreamingAfterToolSignal) {
            params.onCitation(citation);
          } else {
            bufferedCitations.push(citation);
          }
        } else if (event.type === "tool_call_signal") {
          toolCallSignalReceived = true;
        } else if (event.type === "provider_state") {
          providerState = {
            previousResponseId: event.payload?.previous_response_id
              ? String(event.payload.previous_response_id)
              : undefined,
            finishReason: event.payload?.finish_reason
              ? String(event.payload.finish_reason)
              : undefined,
          };
          await params.onProviderState?.(providerState);
        } else if (event.type === "client_action") {
          const actions = Array.isArray(event.payload?.client_actions)
            ? event.payload.client_actions
            : [];
          for (const action of actions) {
            await params.onClientAction?.(action);
          }
        } else if (event.type === "tool_progress") {
          await params.onProviderProgress?.({
            status: event.payload?.status
              ? String(event.payload.status)
              : undefined,
            toolBatch:
              event.payload?.tool_batch &&
              typeof event.payload.tool_batch === "object"
                ? event.payload.tool_batch
                : undefined,
          });
        } else if (event.type === "latency_metrics") {
          await params.onLatencyMetrics?.(event.payload || {});
        } else if (event.type === "tool_call") {
          const argumentsObject = normalizeToolCallArguments(
            event.payload?.arguments,
          );
          let name = String(event.payload?.name || "").trim();
          if (!name) {
            const inferredName = inferToolNameFromArguments(
              params.tools,
              argumentsObject,
            );
            if (inferredName) {
              name = inferredName;
              logger.warn(
                LogCode.AI_ORCHESTRATOR,
                "PythonGenerationClient: repaired empty tool call name",
                {
                  sessionId: params.sessionId,
                  taskId: params.taskId,
                  inferredName,
                  arguments: argumentsObject,
                },
              );
            } else {
              logger.warn(
                LogCode.AI_ORCHESTRATOR,
                "PythonGenerationClient: ignoring empty tool call",
                {
                  sessionId: params.sessionId,
                  taskId: params.taskId,
                  payload: event.payload,
                },
              );
              continue;
            }
          }
          toolCalls.push({
            id: String(event.payload?.id || ""),
            name,
            arguments: argumentsObject,
          });
        } else if (event.type === "error") {
          terminalState = "errored";
          const message = String(
            event.payload?.message || "Generation stream failed",
          );
          const code = String(event.payload?.code || "").trim() || undefined;
          const errorRaw =
            typeof event.payload?.raw === "string"
              ? event.payload.raw.trim()
              : "";
          const requestTail = event.payload?.request_tail;
          throw createGenerationStreamError({
            message,
            code,
            raw: errorRaw || undefined,
            requestTail,
          });
        } else if (event.type === "message_complete") {
          terminalState = "completed";
          const hasToolCalls = toolCalls.length > 0;
          const finalText = textBuffer;
          const finalReasoning = reasoningBuffer;
          if (!bufferVisibleOutput) {
            await flushFinalCallbacks();
          } else if (latestUsage) {
            params.onUsage(latestUsage);
          }
          logger.info(
            LogCode.AI_ORCHESTRATOR,
            "PythonGenerationClient: message_complete received",
            {
              sessionId: params.sessionId,
              taskId: params.taskId,
              elapsedMs: Date.now() - startedAt,
              eventCount,
              hasToolCalls,
              toolCallSignalReceived,
              finalTextLength: finalText.length,
              toolCalls: toolCalls.map((item) => item.name),
              bufferedVisibleOutput: bufferVisibleOutput,
            },
          );
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
    throw new Error("Generation stream ended without message_complete");
  }
}

async function openGenerationStreamWithRetry(params: {
  sessionId: string;
  taskId: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}): Promise<Response> {
  let lastError: unknown;
  const streamUrl = `${getGenerationServiceUrl()}/internal/v1/stream`;
  for (let attempt = 1; attempt <= STREAM_OPEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(streamUrl, {
        method: "POST",
        headers: params.headers,
        body: params.body,
        signal: params.signal,
      });
      if (!response.ok || !response.body) {
        const error = await createStreamOpenHttpError(response);
        logGenerationStreamDebug("http_failure", {
          sessionId: params.sessionId,
          taskId: params.taskId,
          attempt,
          url: streamUrl,
          error,
          responseBodySnippet: (error as any).responseBodySnippet,
        });
        (error as any).__generationStreamDebugLogged = true;
        if (
          attempt < STREAM_OPEN_MAX_ATTEMPTS &&
          isRetriableGenerationOpenFailure(error)
        ) {
          logger.warn(
            LogCode.AI_ORCHESTRATOR,
            "PythonGenerationClient: retrying generation stream open after transient HTTP failure",
            {
              sessionId: params.sessionId,
              taskId: params.taskId,
              attempt,
              maxAttempts: STREAM_OPEN_MAX_ATTEMPTS,
              error: error.message,
            },
          );
          await wait(STREAM_OPEN_RETRY_DELAY_MS);
          continue;
        }
        throw error;
      }
      return response;
    } catch (error: any) {
      lastError = error;
      if (!(error as any)?.__generationStreamDebugLogged) {
        logGenerationStreamDebug("transport_failure", {
          sessionId: params.sessionId,
          taskId: params.taskId,
          attempt,
          url: streamUrl,
          error,
        });
      }
      if (
        attempt < STREAM_OPEN_MAX_ATTEMPTS &&
        isRetriableGenerationOpenFailure(error)
      ) {
        logger.warn(
          LogCode.AI_ORCHESTRATOR,
          "PythonGenerationClient: retrying generation stream open after transport failure",
          {
            sessionId: params.sessionId,
            taskId: params.taskId,
            attempt,
            maxAttempts: STREAM_OPEN_MAX_ATTEMPTS,
            error: error?.message || String(error),
          },
        );
        await wait(STREAM_OPEN_RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "Failed to open generation stream"));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createStreamOpenHttpError(response: Response): Promise<Error> {
  const bodyText = await response.text().catch(() => "");
  const suffix = bodyText ? `: ${bodyText}` : "";
  const error = new Error(
    `Failed to open generation stream: HTTP ${response.status}${suffix}`,
  );
  (error as any).status = response.status;
  (error as any).responseBodySnippet = bodyText ? bodyText.slice(0, 400) : "";
  return error;
}

function isRetriableGenerationOpenFailure(error: unknown): boolean {
  const status = Number((error as any)?.status);
  if ([408, 429, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String((error as any)?.message || error || "").toLowerCase();
  if (!message) return false;
  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up") ||
    message.includes("other side closed") ||
    message.includes("network") ||
    message.includes("headers timeout") ||
    message.includes("body timeout") ||
    message.includes("terminated")
  );
}

function logGenerationStreamDebug(
  stage: "transport_failure" | "http_failure",
  params: {
    sessionId: string;
    taskId: string;
    attempt: number;
    url: string;
    error: unknown;
    responseBodySnippet?: string;
  },
) {
  if (!GENERATION_STREAM_DEBUG_ENABLED) return;
  logger.warn(
    LogCode.AI_ORCHESTRATOR,
    "PythonGenerationClient: local generation stream debug",
    {
      sessionId: params.sessionId,
      taskId: params.taskId,
      stage,
      attempt: params.attempt,
      url: params.url,
      errorDetails: summarizeGenerationStreamDebugError(params.error),
      responseBodySnippet: params.responseBodySnippet || undefined,
    },
  );
}

function summarizeGenerationStreamDebugError(
  error: unknown,
): Record<string, unknown> {
  const candidate = error as any;
  const cause = candidate?.cause;
  return {
    name: candidate?.name,
    message: candidate?.message || String(error || ""),
    code: candidate?.code,
    errno: candidate?.errno,
    type: candidate?.type,
    status: candidate?.status,
    stack:
      typeof candidate?.stack === "string"
        ? candidate.stack.split("\n").slice(0, 6).join("\n")
        : undefined,
    cause: cause
      ? {
          name: cause?.name,
          message: cause?.message,
          code: cause?.code,
          errno: cause?.errno,
          stack:
            typeof cause?.stack === "string"
              ? cause.stack.split("\n").slice(0, 4).join("\n")
              : undefined,
        }
      : undefined,
  };
}

function normalizeToolCallArguments(
  rawArguments: unknown,
): Record<string, any> {
  if (!rawArguments) return {};
  if (typeof rawArguments === "string") {
    try {
      const parsed = JSON.parse(rawArguments);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }
  return typeof rawArguments === "object" && !Array.isArray(rawArguments)
    ? { ...(rawArguments as Record<string, any>) }
    : {};
}

function inferToolNameFromArguments(
  tools: any[],
  args: Record<string, any>,
): string | null {
  const argKeys = Object.keys(args || {}).filter(Boolean);
  if (argKeys.length === 0) return null;

  const candidates = extractFunctionTools(tools)
    .map((tool) => ({ tool, score: scoreToolArgumentMatch(tool, argKeys) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.tool.index - b.tool.index;
    });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].tool.name;

  const [best, second] = candidates;
  if (best.score === second.score) {
    return best.score >= 10 ? best.tool.name : null;
  }
  if (best.score - second.score < 2 && second.tool.index < best.tool.index) {
    return null;
  }
  return best.tool.name;
}

function extractFunctionTools(tools: any[]): GenerationFunctionTool[] {
  return (tools || [])
    .map((tool, index) => {
      const fn = tool?.function;
      const name = String(fn?.name || "").trim();
      if (!name) return null;
      const parameters =
        fn?.parameters && typeof fn.parameters === "object"
          ? fn.parameters
          : {};
      const properties =
        parameters?.properties && typeof parameters.properties === "object"
          ? new Set(Object.keys(parameters.properties))
          : new Set<string>();
      const required = Array.isArray(parameters?.required)
        ? new Set(parameters.required.map((item: unknown) => String(item)))
        : new Set<string>();
      return { name, properties, required, index };
    })
    .filter((tool): tool is GenerationFunctionTool => Boolean(tool));
}

function scoreToolArgumentMatch(
  tool: GenerationFunctionTool,
  argKeys: string[],
): number {
  let matched = 0;
  let missingRequired = 0;
  let extra = 0;

  for (const key of argKeys) {
    if (tool.properties.has(key)) {
      matched += 1;
    } else {
      extra += 1;
    }
  }

  for (const key of tool.required) {
    if (!argKeys.includes(key)) {
      missingRequired += 1;
    }
  }

  if (matched === 0) return 0;

  let score = matched * 10;
  score -= extra * 6;
  score -= missingRequired * 12;

  if (missingRequired === 0) score += 4;
  if (extra === 0) score += 2;
  if (matched === argKeys.length && tool.required.size > 0) score += 1;

  return score;
}

function shouldAllowVisibleStreamingAfterToolSignal(
  providerOptions: Record<string, any> | undefined,
  tools: any[],
): boolean {
  if (providerOptions?.buffer_visible_output === true) {
    return false;
  }
  const nativeTools = providerOptions?.tool_policy?.native_tools;
  const nativeSearchEnabled = Boolean(nativeTools?.enable_search);
  return nativeSearchEnabled && Array.isArray(tools) && tools.length === 0;
}

function shouldBufferVisibleOutputForNativeSearchPhase(
  providerOptions: Record<string, any> | undefined,
  tools: any[],
): boolean {
  if (providerOptions?.buffer_visible_output === true) {
    return true;
  }
  const nativeTools = providerOptions?.tool_policy?.native_tools;
  const nativeSearchEnabled = Boolean(nativeTools?.enable_search);
  return nativeSearchEnabled && Array.isArray(tools) && tools.length === 0;
}

function flattenCitations(citations: any[]): any[] {
  return citations
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .filter(Boolean);
}
