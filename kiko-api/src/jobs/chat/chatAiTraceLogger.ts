// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: production chat debugging needs one Railway-visible summary log per
//         AI reply so operators can inspect model routing, context reads, tool
//         choices, and final status without reproducing the task locally. A
//         2026-04-19 deploy-token loop showed failed mutation tools were logged
//         only as `ok:false`, which was not enough to see why receipt handoff
//         skipped and the model opened another generation round.
// Goal: collect safe per-turn orchestration telemetry into one structured log
//       line while avoiding raw prompts, assistant text, image URLs, full wallet
//       addresses, and tool arguments, while retaining failure reason, result
//       keys, and receipt-field presence for tool debugging.
// Owns: chat AI trace aggregation and Railway-visible summary metadata shaping.
// Does Not Own: model routing, tool execution, prompt assembly, or user-facing output.
// Design Language:
// - one task should produce one searchable summary line
// - log names and counts, not raw private content
// - context reads and business tools must be separated
// - failures should emit the same trace shape with status=failed
// - logging should be enabled by default and disabled only with CHAT_AI_TRACE_LOGS=false
// - tool-result summaries may include errors and keys, but not full result payloads
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: observable chat v2 context/tool routing
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-ai-trace-logging.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: Railway-visible per-turn AI trace summary
// - Verification: verified in code and targeted tests
// - Source: operator browser console and app.log trace cmo5a4f1h03sjj5et046ndecy
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: adding failed tool reason/result-key visibility to trace summaries
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-ai-trace-logging.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import type { ChatContextContract, ChatContextSnapshot, OrchestratorToolCall, OrchestratorToolResult } from './contracts.js';
import { CONTEXT_READ_TOOL_BY_BLOCK } from './contextReadTools.js';
import type { IntentEnvelope, SkillResolution, ToolPhase } from './nodeSkillResolver.js';

type TraceStatus = 'completed' | 'failed' | 'terminal';

type GenerationRoundTrace = {
    round: number;
    phase: ToolPhase;
    tool_count: number;
    allowed_tools: string[];
    forced_final_answer?: boolean;
    result?: {
        text_length: number;
        reasoning_length: number;
        tool_calls: string[];
        citation_count: number;
        finish_reason?: string;
        buffered_visible_output?: boolean;
    };
};

type ToolTrace = {
    round: number;
    tool: string;
    kind: 'context_read' | 'business_tool' | 'provider_native';
    ok?: boolean;
    source?: string;
    reason_code?: string;
    confirmation_required?: boolean;
    cached?: boolean;
    error?: string;
    result_keys?: string[];
    receipt_fields?: Record<string, boolean>;
};

type RequiredContextTrace = {
    round: number;
    missing_tools: string[];
};

const TRACE_ENABLED = String(process.env.CHAT_AI_TRACE_LOGS || 'true').trim().toLowerCase() !== 'false';

export class ChatAiTraceLogger {
    private readonly startedAt = Date.now();
    private readonly rounds: GenerationRoundTrace[] = [];
    private readonly tools: ToolTrace[] = [];
    private readonly requiredContextEnforcements: RequiredContextTrace[] = [];
    private providerNativeEvidenceCount = 0;
    private status: TraceStatus = 'completed';
    private terminalReason: string | undefined;
    private errorCode: string | undefined;
    private errorMessage: string | undefined;
    private emitted = false;
    private skillResolution: SkillResolution | null = null;
    private contextContract: ChatContextContract | null = null;
    private intentEnvelope: IntentEnvelope | null = null;

    constructor(private readonly snapshot: ChatContextSnapshot, private readonly provider: string) {}

    recordSkillResolution(skillResolution: SkillResolution) {
        this.skillResolution = skillResolution;
        this.contextContract = skillResolution.contextContract || null;
        this.intentEnvelope = skillResolution.intentEnvelope || null;
    }

    recordRoundStart(args: {
        round: number;
        phase: ToolPhase;
        toolCount: number;
        allowedTools: string[];
        forcedFinalAnswer?: boolean;
    }) {
        this.rounds.push({
            round: args.round,
            phase: args.phase,
            tool_count: args.toolCount,
            allowed_tools: limitStrings(args.allowedTools, 24),
            forced_final_answer: args.forcedFinalAnswer || undefined,
        });
    }

    recordGenerationResult(args: {
        round: number;
        textLength: number;
        reasoningLength: number;
        toolCalls: OrchestratorToolCall[];
        citationCount?: number;
        finishReason?: string;
        bufferedVisibleOutput?: boolean;
    }) {
        const round = this.rounds.find((item) => item.round === args.round);
        const result = {
            text_length: args.textLength,
            reasoning_length: args.reasoningLength,
            tool_calls: limitStrings(args.toolCalls.map((call) => call.name), 24),
            citation_count: args.citationCount || 0,
            finish_reason: normalizeString(args.finishReason),
            buffered_visible_output: args.bufferedVisibleOutput || undefined,
        };
        if (round) {
            round.result = result;
        } else {
            this.rounds.push({
                round: args.round,
                phase: 'local_analysis',
                tool_count: args.toolCalls.length,
                allowed_tools: [],
                result,
            });
        }
    }

    recordRequiredContextEnforcement(round: number, missingTools: string[]) {
        this.requiredContextEnforcements.push({
            round,
            missing_tools: limitStrings(missingTools, 16),
        });
    }

    recordProviderNativeToolRound(round: number, toolCalls: OrchestratorToolCall[], evidenceRecorded: boolean) {
        for (const call of toolCalls) {
            this.tools.push({
                round,
                tool: call.name,
                kind: 'provider_native',
                ok: true,
            });
        }
        if (evidenceRecorded) {
            this.providerNativeEvidenceCount += 1;
        }
    }

    recordToolResult(round: number, result: OrchestratorToolResult, options?: { cached?: boolean }) {
        const resultRecord = result.result && typeof result.result === 'object' && !Array.isArray(result.result)
            ? result.result as Record<string, any>
            : null;
        const resultData = resultRecord?.data && typeof resultRecord.data === 'object' && !Array.isArray(resultRecord.data)
            ? resultRecord.data as Record<string, any>
            : null;
        const hasField = (keys: string[]) => keys.some((key) => {
            const direct = resultRecord?.[key];
            if (direct !== undefined && direct !== null && String(direct).trim()) return true;
            const nested = resultData?.[key];
            return nested !== undefined && nested !== null && String(nested).trim().length > 0;
        });
        this.tools.push({
            round,
            tool: result.name,
            kind: isContextReadTool(result.name) ? 'context_read' : 'business_tool',
            ok: Boolean(result.ok),
            source: normalizeString(result.metadata?.source),
            reason_code: normalizeString(result.reasonCode || result.result?.reason_code || result.result?.reasonCode),
            confirmation_required: result.metadata?.confirmationRequired === true || result.result?.requires_confirmation === true || undefined,
            cached: options?.cached || undefined,
            error: normalizeString(result.error || resultRecord?.error),
            result_keys: resultRecord ? limitStrings(Object.keys(resultRecord), 24) : undefined,
            receipt_fields: resultRecord ? {
                txHash: hasField(['txHash', 'transactionHash', 'hash']),
                explorerUrl: hasField(['explorerUrl', 'explorer_url', 'txUrl', 'tx_url']),
                tokenAddress: hasField(['tokenAddress', 'token_address', 'address']),
                tokenUrl: hasField(['tokenUrl', 'token_url']),
                orderId: hasField(['order_id', 'orderId', 'id']),
                configId: hasField(['configId', 'config_id', 'id']),
            } : undefined,
        });
    }

    markTerminal(reason: string) {
        this.status = 'terminal';
        this.terminalReason = normalizeString(reason);
    }

    markFailed(error: unknown) {
        this.status = 'failed';
        const anyError = error as any;
        this.errorCode = normalizeString(anyError?.code || anyError?.reasonCode);
        this.errorMessage = normalizeString(anyError?.message || String(error));
    }

    emit(extra?: Record<string, unknown>) {
        if (!TRACE_ENABLED || this.emitted) return;
        this.emitted = true;
        const payload = this.toLogMetadata(extra);
        const message = 'ChatAITrace: turn summary';
        if (this.status === 'failed') {
            logger.warn(LogCode.AI_ORCHESTRATOR, message, payload);
            return;
        }
        logger.info(LogCode.AI_ORCHESTRATOR, message, payload);
    }

    toLogMetadata(extra?: Record<string, unknown>) {
        const contextReadTools = this.tools.filter((tool) => tool.kind === 'context_read').map((tool) => tool.tool);
        const businessTools = this.tools.filter((tool) => tool.kind === 'business_tool').map((tool) => tool.tool);
        const providerTools = this.tools.filter((tool) => tool.kind === 'provider_native').map((tool) => tool.tool);
        const contextNamesRead = contextReadTools
            .map((toolName) => contextNameForTool(toolName))
            .filter((name): name is string => Boolean(name));

        return {
            traceType: 'chat_ai_turn_summary',
            sessionId: this.snapshot.sessionId,
            taskId: this.snapshot.taskId,
            assistantMessageId: this.snapshot.assistantMessageId || null,
            model: this.snapshot.model,
            provider: this.provider,
            status: this.status,
            terminalReason: this.terminalReason,
            errorCode: this.errorCode,
            errorMessage: this.errorMessage ? truncate(this.errorMessage, 220) : undefined,
            durationMs: Date.now() - this.startedAt,
            queryLength: String(this.snapshot.lastUserMessage || '').length,
            historyCount: Array.isArray(this.snapshot.history) ? this.snapshot.history.length : 0,
            hasImages: Boolean(this.snapshot.runtime?.socialInput?.images?.length),
            imageCount: Array.isArray(this.snapshot.runtime?.socialInput?.images) ? this.snapshot.runtime.socialInput.images.length : 0,
            normalizedIntent: this.snapshot.normalizedIntent
                ? {
                    domain: this.snapshot.normalizedIntent.domain,
                    intent: this.snapshot.normalizedIntent.intent,
                    taskMode: this.snapshot.normalizedIntent.taskMode,
                    searchMode: this.snapshot.normalizedIntent.searchMode,
                    executionCandidate: this.snapshot.normalizedIntent.executionCandidate,
                }
                : null,
            intentEnvelope: this.intentEnvelope
                ? {
                    primary_intent: this.intentEnvelope.primary_intent,
                    task_mode: this.intentEnvelope.task_mode,
                    domain: this.intentEnvelope.domain,
                    execution_risk: this.intentEnvelope.execution_risk,
                    search_mode: this.intentEnvelope.search_mode,
                }
                : null,
            contextContract: this.contextContract
                ? {
                    mode: this.contextContract.mode,
                    required: this.contextContract.requiredContexts || [],
                    optional: this.contextContract.optionalContexts || [],
                    reason: this.contextContract.reason || null,
                }
                : null,
            selectedSkills: this.skillResolution?.selectedSkills || [],
            preferredTools: limitStrings(this.skillResolution?.preferredTools || [], 24),
            allowedToolCount: this.skillResolution?.allowedTools?.length || 0,
            allowAllTools: Boolean(this.skillResolution?.allowAllTools),
            searchMode: this.skillResolution?.searchMode || null,
            toolPhase: this.skillResolution?.currentPhase || null,
            rounds: this.rounds,
            contextReads: unique(contextReadTools),
            contextNamesRead: unique(contextNamesRead),
            businessTools: unique(businessTools),
            providerNativeTools: unique(providerTools),
            toolResults: this.tools.slice(-24),
            requiredContextEnforcements: this.requiredContextEnforcements,
            providerNativeEvidenceCount: this.providerNativeEvidenceCount,
            ...extra,
        };
    }
}

function isContextReadTool(toolName: string): boolean {
    return Object.values(CONTEXT_READ_TOOL_BY_BLOCK).includes(toolName);
}

function contextNameForTool(toolName: string): string | undefined {
    for (const [contextName, mappedToolName] of Object.entries(CONTEXT_READ_TOOL_BY_BLOCK)) {
        if (mappedToolName === toolName) return contextName;
    }
    return undefined;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
}

function limitStrings(values: string[], limit: number): string[] {
    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, limit);
}

function normalizeString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const text = String(value).trim();
    return text ? text : undefined;
}

function truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}
