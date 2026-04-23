// CONTEXT MEMORY
// Updated: 2026-04-22
// Author: Rowan
// Reason: Node orchestration now needs to persist reasoning content for
//         contract previously reserved for DeepSeek reasoning turns. Runtime
//         traces also showed that trivial onboarding/meta turns were paying for
//         an extra hidden plan-model call even though the answer should have
//         been a direct response. A later runtime review showed obvious
//         non-chain turns should not be forced back into canonical
//         normalization after the worker already classified them as deterministic
//         bypasses. Chat v2 now also needs deterministic required-context
//         enforcement so the model cannot skip wallet/workflow/skill context
//         reads after the resolver declared them mandatory for the turn. Product
//         correction on 2026-04-18 removed backend clarification templates here
//         so invalid normalization falls through to the main model instead of a
//         worker-authored reply. Another product correction clarified that tool
//         messages need a stable continuation contract so the model knows
//         whether to answer, keep reading context, ask for confirmation, or call the next tool.
//         Product now also requires a tool-owned terminal path so transcript-
//         native generated-image execution can complete the reply without a
//         synthetic text answer. Product architecture review on 2026-04-19
//         moved tool choice to the main GPT path by default: this owner must
//         stop creating fake plan-card work after model-selected task routing.
//         registered tool catalog into provider generation after task
//         selection caused long planning loops, so tool visibility now returns
//         to resolver-matched skill packages plus explicit context reads.
//         Execution-receipt review then moved
//         hash/order/token URL replies out of prompt obligations and into a
//         post-tool runtime hook. A 2026-04-19 deploy-token loop incident also
//         showed this owner must log each local tool result and receipt-hook
//         decision before any follow-up generation round starts. A later
//         the entire tool catalog before any required context was read, which
//         made heavy thinking models spend tens of seconds planning against 70+
//         tools, answer prematurely, then get forced into extra rounds when
//         required-context enforcement rejected that answer after the fact.
//         Product correction on 2026-04-20 then moved fixed execution flows to
//         backend-prefetched required context reads so execution turns start
//         with the needed runtime state already loaded instead of burning a
//         first model round deciding which `read_*` tools to call. Farcaster
//         live logs on 2026-04-21 showed those backend-prefetched reads must not
//         be inserted as provider `tool` messages because no assistant
//         `tool_calls` preceded them; OpenAI rejects that shape with HTTP 400.
// Goal: keep the broker/runtime reasoning stream and stored assistant messages
//       consistent across reasoning-capable providers without changing the
//       downstream message schema, while avoiding unnecessary plan-model work
//       for direct-answer turns, respecting worker-level non-chain
//       normalization bypass decisions, and allowing tool-managed reply
//       channels to terminate a turn cleanly.
// Owns: orchestration-round execution, streamed reasoning emission, and
//       assistant/tool message assembly for the Node chat path.
// Does Not Own: provider request shaping, UI model labels, or billing buckets.
// Design Language:
// - reasoning is a provider-normalized internal channel, not a brand-specific one
// - assistant tool-call messages should preserve provider-safe content shapes
// - removed provider brands must not remain hard-coded in orchestration gates
// - direct onboarding/meta turns should not trigger extra hidden plan-model latency
// - worker-approved deterministic non-chain bypasses must not be re-normalized here
// - required context is a runtime contract and may force another round before a final answer
// - production debugging needs one safe Railway-visible trace summary per AI turn
// - invalid or missing canonical intent must not trigger backend-authored clarification prose
// - tool messages should carry continuation guidance instead of raw result blobs alone
// - model-selected task mode means the main model owns semantic task choice;
//   this orchestrator still owns execution rounds, scoped tool exposure,
//   policy checks, and terminal handoff
// - successful side-effecting tool receipts are deterministic runtime answers,
//   not another model-generation round
// - tool-result diagnostics must show ok/source/reason/result keys and receipt
//   decision without logging raw prompt or assistant content
// - required-context enforcement should narrow the visible tool menu before a
//   generation round starts, not only after a premature final answer arrives
// - fixed execution flows may prefetch required read-only context before the
//   first generation round so the model starts from loaded worker state
// - backend-prefetched context belongs in system context blocks, never as raw
//   provider tool messages without a preceding assistant tool call
// Document Provenance:
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: skipping plan-generation model calls for trivial onboarding/meta turns
// - Verification: verified in logs, applied in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: respecting deterministic non-chain normalization bypass in orchestration
// - Verification: verified in runtime and applied in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: required-context enforcement and runtime handoff for chat v2 context-read tools
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-ai-trace-logging.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: one-line per-turn orchestration trace summaries for Railway logs
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/Downloads/logs.1776445174160.json
// - Kind: runtime observation
// - Retrieved: 2026-04-18
// - Applied To: removing backend clarification templates from orchestration fallback paths
// - Verification: verified in runtime and then removed in code
// - Source: product owner correction in local runtime thread about real
//   multi-turn worker logic
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: carrying continuation contracts through tool messages
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: tool-owned terminal orchestration path for generated-image replies
// - Verification: verified in code
// - Source: operator architecture review on 2026-04-19
// - Kind: product instruction
// - Retrieved: 2026-04-19
// - Applied To: suppressing runtime scaffold cards after model-selected task routing
// - Verification: verified in code and later narrowed for tool visibility
// - Kind: runtime observation / product instruction
// - Retrieved: 2026-04-20
// - Applied To: keeping tool visibility scoped to the resolver package instead of the full registry
// - Verification: verified in runtime and targeted tests
// - Source: operator correction in local runtime thread about receipt prompt token waste
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-19
// - Applied To: post-tool execution receipt answer hook
// - Verification: verified in code and targeted tests
// - Source: operator browser console and app.log trace cmo5a4f1h03sjj5et046ndecy
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: local tool-result and receipt-decision diagnostics
// - Verification: verified in code
// - Source: /Users/almurat/Downloads/logs.1776695132347.json
// - Kind: runtime observation
// - Retrieved: 2026-04-20
//   execution turns that were looping after premature answers
// - Verification: verified in runtime trace and applied in code
// - Source: local live execution evals plus product-owner correction on 2026-04-20
// - Kind: runtime observation / product instruction
// - Retrieved: 2026-04-20
// - Applied To: backend-prefetching required context for fixed execution flows
// - Verification: verified in runtime and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-direct-answer-tool-pruning.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-non-chain-normalization-bypass.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-ai-trace-logging.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-hardcoded-reply-path-removal.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { containsPseudoToolCallOutput, stripPseudoToolCallOutput } from '../../services/ai/promptLeakSanitizer.js';
import type { ChatContextContract, ChatContextSnapshot, ChatHistoryMessage, OrchestratorToolResult, ProviderNativeEvidenceSnapshot } from './contracts.js';
import { CONTEXT_READ_TOOL_BY_BLOCK } from './contextReadTools.js';
import { buildProviderOptions, normalizeOpenAIReasoningEffort, resolveProviderInfo } from './providerPolicyBuilder.js';
import { resolveNodeSkills, type SkillResolution, type ToolPhase } from './nodeSkillResolver.js';
import { assembleGenerationMessages, buildRoundToolPolicySystemMessage, sanitizeProviderHistory, type GenerationMessage } from './nodePromptAssembler.js';
import { parseTradingIntent } from './tradingIntentResolver.js';
import { buildControlPolicySnapshot, checkToolAgainstPolicy, isProviderNativeTool, resolvePolicyToolBudget } from './controlPolicy.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import type { ChatStreamBroker } from './streamBroker.js';
import type { GenerationProviderState, PythonGenerationClient } from './pythonGenerationClient.js';
import {
    buildChainEvidencePlanStep,
    materializePlanCard,
    buildSocialPlanStep,
    buildSummaryPlanStep,
    buildTaskPlanningContext,
    buildWarmupPlan,
    resolvePlanStepForTool,
} from './taskPlanner.js';
import { generateModelPlan } from './modelPlanGenerator.js';
import {
    normalizeCanonicalIntent,
} from './canonicalIntentNormalizer.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import { applyConversationActionState } from './conversationStateResolver.js';
import { selectTaskRoute } from './taskRouteSelector.js';
import { ChatAiTraceLogger } from './chatAiTraceLogger.js';
import { isModelLedToolOrchestrationEnabled } from './modelLedToolOrchestration.js';
import { buildExecutionReceiptDecision } from './executionReceiptAnswer.js';

const CHAIN_EVIDENCE_TOOLS = new Set([
    'get_token_info',
    'get_wallet_info',
    'get_early_buyers',
    'analyze_creator',
]);
const IMAGE_GENERATION_TOOL_NAME = 'generate_image_from_intent';

export type NodeOrchestrationResult = {
    terminal: boolean;
    terminalOwner?: 'external';
};

function supportsStoredReasoning(model: string): boolean {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized === 'deepseek-reasoner'
        || normalized.startsWith('gpt')
        || normalized.startsWith('o1')
        || normalized.startsWith('o3')
        || normalized.startsWith('o4')
        || normalized.includes('grok');
}

function summarizeToolResultForLog(result: {
    name?: string;
    ok?: boolean;
    error?: string;
    reasonCode?: string;
    metadata?: Record<string, any>;
    result?: unknown;
}) {
    const resultRecord = result.result && typeof result.result === 'object' && !Array.isArray(result.result)
        ? result.result as Record<string, any>
        : null;
    const resultData = resultRecord?.data && typeof resultRecord.data === 'object' && !Array.isArray(resultRecord.data)
        ? resultRecord.data as Record<string, any>
        : null;
    const pick = (keys: string[]) => {
        for (const key of keys) {
            const direct = resultRecord?.[key];
            if (direct !== undefined && direct !== null && String(direct).trim()) return true;
            const nested = resultData?.[key];
            if (nested !== undefined && nested !== null && String(nested).trim()) return true;
        }
        return false;
    };
    return {
        tool: result.name || null,
        ok: Boolean(result.ok),
        source: result.metadata?.source || null,
        reasonCode: result.reasonCode || resultRecord?.reason_code || resultRecord?.reasonCode || null,
        confirmationRequired: result.metadata?.confirmationRequired === true || resultRecord?.requires_confirmation === true || undefined,
        error: result.error || resultRecord?.error || null,
        resultType: result.result === null ? 'null' : Array.isArray(result.result) ? 'array' : typeof result.result,
        resultKeys: resultRecord ? Object.keys(resultRecord).slice(0, 32) : [],
        receiptFieldPresence: {
            txHash: pick(['txHash', 'transactionHash', 'hash']),
            explorerUrl: pick(['explorerUrl', 'explorer_url', 'txUrl', 'tx_url']),
            tokenAddress: pick(['tokenAddress', 'token_address', 'address']),
            tokenUrl: pick(['tokenUrl', 'token_url']),
            orderId: pick(['order_id', 'orderId', 'id']),
            configId: pick(['configId', 'config_id', 'id']),
        },
    };
}

export async function runNodeOrchestration(params: {
    snapshot: ChatContextSnapshot;
    generationClient: PythonGenerationClient;
    toolExecutionEngine: ToolExecutionEngine;
    broker: ChatStreamBroker;
    toolContext: Record<string, any>;
    shouldCancel?: () => Promise<boolean>;
    onToolStatus?: (toolName: string) => Promise<void> | void;
    onProviderState?: (state: GenerationProviderState) => Promise<void> | void;
}): Promise<NodeOrchestrationResult> {
    const providerInfo = resolveProviderInfo(params.snapshot.model);
    const chatAiTrace = new ChatAiTraceLogger(params.snapshot, providerInfo.provider);
    const modelLedTools = isModelLedToolOrchestrationEnabled();
    try {
        if (!modelLedTools) {
            await params.broker.bootstrapRuntime(buildWarmupPlan(params.snapshot.lastUserMessage));
        }
    let normalizedSnapshot = params.snapshot;
    if (!normalizedSnapshot.taskRoute && !normalizedSnapshot.taskRouteSelectionState) {
        const routeSelection = await selectTaskRoute({
            snapshot: normalizedSnapshot,
            generationClient: params.generationClient,
            shouldCancel: params.shouldCancel,
        });
        normalizedSnapshot = routeSelection.snapshot;
    }
    if (!normalizedSnapshot.taskRoute && !normalizedSnapshot.normalizedIntent && !normalizedSnapshot.normalizationState) {
        const normalization = await normalizeCanonicalIntent({
            snapshot: normalizedSnapshot,
            generationClient: params.generationClient,
            shouldCancel: params.shouldCancel,
        });
        normalizedSnapshot = normalization.snapshot;
    }
    if ((normalizedSnapshot.taskRoute || normalizedSnapshot.normalizedIntent) && !normalizedSnapshot.conversationActionState) {
        normalizedSnapshot = applyConversationActionState(normalizedSnapshot);
    }
    const clarificationQuestion = normalizedSnapshot.taskRoute?.clarificationQuestion
        || normalizedSnapshot.normalizedIntent?.clarificationQuestion
        || null;
    const needsClarification = Boolean(
        normalizedSnapshot.taskRoute?.needsClarification
        || normalizedSnapshot.normalizedIntent?.needsClarification,
    );
    if (needsClarification && clarificationQuestion) {
        await params.broker.pushText(clarificationQuestion);
        chatAiTrace.markTerminal('task_route_clarification');
        chatAiTrace.emit();
        return { terminal: false };
    }
    let tradingIntent = (normalizedSnapshot.taskRoute || normalizedSnapshot.normalizedIntent)
        ? parseTradingIntent(
            normalizedSnapshot.lastUserMessage,
            normalizedSnapshot,
            normalizedSnapshot.normalizedIntent,
        )
        : null;
    let skillResolution = resolveNodeSkills(normalizedSnapshot, tradingIntent, normalizedSnapshot.normalizedIntent);
    chatAiTrace.recordSkillResolution(skillResolution);
    chatAiTrace.recordCanonicalIntentSelection({
        round: 1,
        canonicalIntent: normalizedSnapshot.normalizedIntent,
        model: normalizedSnapshot.model,
        toolPackageSource: skillResolution.toolPackageSource,
    });
    const strictPolicy = params.snapshot.policySnapshot?.enforcementLevel === 'hard';
    params.snapshot = normalizedSnapshot;
    let effectiveAllowedTools = strictPolicy && params.snapshot.policySnapshot
        ? params.snapshot.policySnapshot.allowedTools
        : skillResolution.allowedTools;
    let planning = buildTaskPlanningContext(params.snapshot, skillResolution);
    let plan = modelLedTools ? null : materializePlanCard(planning);
    const shouldGenerateModelPlan = !modelLedTools && !(skillResolution.querySignals.welcome || skillResolution.querySignals.metaDebug);
    if (shouldGenerateModelPlan) {
        void generateModelPlan({
            snapshot: params.snapshot,
            planning,
            skillResolution,
            generationClient: params.generationClient,
            shouldCancel: params.shouldCancel,
        }).then(async (modelPlan) => {
            if (!modelPlan) return;
            plan = modelPlan;
            await params.broker.applyModelPlan(modelPlan);
        }).catch((error) => {
            logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: async model plan update failed', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }
    const executedToolResults = new Map<string, {
        name: string;
        arguments: Record<string, any>;
        result: any;
        ok: boolean;
        error?: string;
        metadata?: Record<string, any>;
        continuation?: any;
    }>();
    let duplicateOnlyRounds = 0;
    const toolUsageCount = new Map<string, number>();
    const knownToolNames = new Set(params.snapshot.toolDefinitions.map((item) => item.name));
    const providerNativeEvidence: ProviderNativeEvidenceSnapshot[] = [];
    const intentSelectionHistory: ChatHistoryMessage[] = [];
    const deferredProviderCitations: any[] = [];
    let currentPhase = skillResolution.currentPhase;
    let previousResponseId: string | null | undefined = params.snapshot.previousResponseId;
    let lastRoundPolicyMessage = '';
    let forceAnswerFromEvidence = false;
    let forceBufferedVisibleOutput = false;
    let truncationContinuationCount = 0;
    let visibleFinalAnswerText = '';
    let requiredContextEnforcementCount = 0;
    let isReadOnlyTask = (params.snapshot.policySnapshot?.actionClass || 'READ_ONLY') === 'READ_ONLY';
    const prefetchedRequiredContextTools = new Set<string>();

    updateChatContextRuntime(params.toolContext, {
        snapshot: params.snapshot,
        executionPolicy: params.snapshot.policySnapshot || null,
        executionPlan: plan,
        skillPrompts: skillResolution.skillPrompts,
        providerNativeEvidence,
    });

    const messages: GenerationMessage[] = assembleGenerationMessages(
        params.snapshot,
        skillResolution.skillPrompts,
        providerInfo,
        {
            preferredTools: skillResolution.preferredTools,
            strategyNotes: skillResolution.strategyNotes,
            allowAllTools: skillResolution.allowAllTools,
            executionPlan: plan,
            rankedMatches: skillResolution.rankedMatches,
            searchMode: skillResolution.searchMode,
            searchReason: skillResolution.searchReason,
            toolPhase: currentPhase,
            intentEnvelope: skillResolution.intentEnvelope,
            contextContract: skillResolution.contextContract,
            providerNativeEvidence,
        },
    );

    const refreshIntentForNextRound = async (
        round: number,
        options?: { phaseAfterNativeSearch?: ToolPhase | null },
    ) => {
        const routeSelection = await selectTaskRoute({
            snapshot: buildIntentReentrySnapshot(params.snapshot, intentSelectionHistory),
            generationClient: params.generationClient,
            shouldCancel: params.shouldCancel,
        });
        normalizedSnapshot = routeSelection.snapshot;
        if (!normalizedSnapshot.taskRoute && !normalizedSnapshot.normalizedIntent && !normalizedSnapshot.normalizationState) {
            const normalization = await normalizeCanonicalIntent({
                snapshot: normalizedSnapshot,
                generationClient: params.generationClient,
                shouldCancel: params.shouldCancel,
            });
            normalizedSnapshot = normalization.snapshot;
        }
        normalizedSnapshot = applyConversationActionState(normalizedSnapshot);
        params.snapshot = normalizedSnapshot;
        tradingIntent = (normalizedSnapshot.taskRoute || normalizedSnapshot.normalizedIntent)
            ? parseTradingIntent(
                normalizedSnapshot.lastUserMessage,
                normalizedSnapshot,
                normalizedSnapshot.normalizedIntent,
            )
            : null;
        skillResolution = resolveNodeSkills(normalizedSnapshot, tradingIntent, normalizedSnapshot.normalizedIntent);
        normalizedSnapshot.policySnapshot = buildControlPolicySnapshot({
            snapshot: normalizedSnapshot,
            tradingIntent,
            skillResolution,
        });
        chatAiTrace.recordSkillResolution(skillResolution);
        chatAiTrace.recordCanonicalIntentSelection({
            round,
            canonicalIntent: normalizedSnapshot.normalizedIntent,
            model: normalizedSnapshot.model,
            toolPackageSource: skillResolution.toolPackageSource,
        });
        effectiveAllowedTools = strictPolicy && normalizedSnapshot.policySnapshot
            ? normalizedSnapshot.policySnapshot.allowedTools
            : skillResolution.allowedTools;
        isReadOnlyTask = (normalizedSnapshot.policySnapshot?.actionClass || 'READ_ONLY') === 'READ_ONLY';
        planning = buildTaskPlanningContext(normalizedSnapshot, skillResolution);
        if (!modelLedTools) {
            plan = materializePlanCard(planning);
        }
        currentPhase = options?.phaseAfterNativeSearch ?? skillResolution.currentPhase;
        lastRoundPolicyMessage = '';
        updateChatContextRuntime(params.toolContext, {
            snapshot: normalizedSnapshot,
            executionPolicy: null,
            executionPlan: plan,
            skillPrompts: skillResolution.skillPrompts,
            providerNativeEvidence,
        });
        const clarificationQuestion = normalizedSnapshot.taskRoute?.clarificationQuestion
            || normalizedSnapshot.normalizedIntent?.clarificationQuestion
            || null;
        const needsClarification = Boolean(
            normalizedSnapshot.taskRoute?.needsClarification
            || normalizedSnapshot.normalizedIntent?.needsClarification,
        );
        if (needsClarification && clarificationQuestion) {
            await params.broker.pushText(clarificationQuestion);
            chatAiTrace.markTerminal('task_route_clarification');
            chatAiTrace.emit({ finalRound: round, finalReason: 'task_route_clarification' });
            return true;
        }
        return false;
    };

    logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: starting generation loop', {
        sessionId: params.snapshot.sessionId,
        taskId: params.snapshot.taskId,
        provider: providerInfo.provider,
        skills: skillResolution.selectedSkills,
        rankedMatches: skillResolution.rankedMatches.map((item) => ({
            skillId: item.skillId,
            score: item.score,
        })),
        searchMode: skillResolution.searchMode,
        toolPhase: currentPhase,
        allowedTools: effectiveAllowedTools,
        planSteps: plan?.steps.length || 0,
    });

    const emitMissingTail = async (fullText: string, streamedText: string, emit: (text: string) => Promise<void>) => {
        if (!fullText) return;
        if (!streamedText) {
            await emit(fullText);
            return;
        }
        if (fullText.startsWith(streamedText)) {
            const tail = fullText.slice(streamedText.length);
            if (tail) {
                await emit(tail);
            }
        }
    };

    const flushDeferredProviderCitations = () => {
        if (deferredProviderCitations.length === 0) return;
        for (const citation of deferredProviderCitations.splice(0, deferredProviderCitations.length)) {
            params.broker.pushCitation(citation);
        }
    };

    const prefetchRequiredContextForFixedFlow = async () => {
        const missingRequiredContextTools = resolveMissingRequiredContextTools(
            skillResolution.contextContract,
            toolUsageCount,
            knownToolNames,
        );
        if (
            !shouldBackendPrefetchRequiredContextReads(skillResolution.contextContract)
            || missingRequiredContextTools.length === 0
        ) {
            return;
        }
        await params.broker.markPlanPhase(
            planning.locale === 'zh'
                ? '正在预读本轮固定流程所需上下文'
                : 'Preloading the required context for this execution flow',
        );
        logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: prefetching required context before first generation round', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            tools: missingRequiredContextTools,
            contextMode: skillResolution.contextContract?.mode || null,
        });
        for (const toolName of missingRequiredContextTools) {
            if (params.shouldCancel && await params.shouldCancel()) {
                throw new Error('Task cancelled');
            }
            const call = {
                id: `prefetch-${toolName}`,
                name: toolName,
                arguments: {},
            };
            toolUsageCount.set(toolName, (toolUsageCount.get(toolName) || 0) + 1);
            await params.onToolStatus?.(toolName);
            const result = await params.toolExecutionEngine.execute(call, params.toolContext);
            if (!result.ok && result.reasonCode && ['POLICY_UNAUTHORIZED_TOOL', 'POLICY_CONTROL_PLANE_VIOLATION'].includes(result.reasonCode)) {
                throw createOrchestrationError(result.reasonCode, result.error || 'Tool blocked by policy');
            }
            executedToolResults.set(buildToolCallKey(toolName, {}), {
                name: toolName,
                arguments: {},
                ok: result.ok,
                result: result.result,
                error: result.error,
                metadata: result.metadata,
                continuation: result.continuation,
            });
            if (result.ok) {
                prefetchedRequiredContextTools.add(toolName);
            }
            chatAiTrace.recordToolResult(0, result);
            await params.broker.recordToolResult(result);
            messages.push({
                role: 'system',
                content: buildPrefetchedContextSystemMessage(toolName, result),
            });
        }
    };

    await prefetchRequiredContextForFixedFlow();

    for (let round = 1; round <= 8; round += 1) {
        const effectivePhase = forceAnswerFromEvidence ? 'local_analysis' : currentPhase;
        if (params.shouldCancel && await params.shouldCancel()) {
            throw new Error('Task cancelled');
        }
        if (effectivePhase === 'native_search_only') {
            await params.broker.setRuntimeState?.(
                'search_in_progress',
                planning.locale === 'zh'
                    ? '正在检索公开来源并确认时间线'
                    : 'Searching public sources and confirming the timeline',
            );
        }
        logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: generation round start', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            round,
            toolPhase: effectivePhase,
            forceAnswerFromEvidence,
        });
        await params.broker.markPlanPhase(
            round === 1
                ? planning.locale === 'zh'
                    ? '正在分析问题并决定下一步'
                    : 'Analyzing the request and deciding the next step'
                : planning.locale === 'zh'
                    ? '正在根据最新结果调整后续步骤'
                    : 'Updating the next steps from the latest result'
        );
        const roundPolicyMessage = buildRoundToolPolicySystemMessage({
            preferredTools: skillResolution.preferredTools,
            strategyNotes: skillResolution.strategyNotes,
            allowAllTools: skillResolution.allowAllTools,
            executionPlan: plan,
            rankedMatches: skillResolution.rankedMatches,
            searchMode: skillResolution.searchMode,
            searchReason: skillResolution.searchReason,
            toolPhase: effectivePhase,
            intentEnvelope: skillResolution.intentEnvelope,
            contextContract: skillResolution.contextContract,
            providerNativeEvidence,
        });
        const roundPolicyContent = typeof roundPolicyMessage?.content === 'string'
            ? roundPolicyMessage.content
            : null;
        if (roundPolicyMessage && roundPolicyContent && roundPolicyContent !== lastRoundPolicyMessage) {
            messages.push(roundPolicyMessage);
            lastRoundPolicyMessage = roundPolicyContent;
        }
        if (forceAnswerFromEvidence) {
            messages.push({
                role: 'system',
                content: buildEvidenceOnlyAnswerInstruction(planning.locale),
            });
        }

        const providerReadyMessages = sanitizeProviderHistory(messages, params.snapshot.model);
        const phaseAllowedTools = resolvePhaseAllowedTools(
            effectiveAllowedTools,
            skillResolution,
            providerInfo.provider,
            effectivePhase,
        );
        const missingRequiredContextTools = resolveMissingRequiredContextTools(
            skillResolution.contextContract,
            toolUsageCount,
            knownToolNames,
        );
        const mustReadRequiredContextFirst =
            !forceAnswerFromEvidence
            && shouldEnforceRequiredContextReads(skillResolution.contextContract)
            && missingRequiredContextTools.length > 0;
        const roundAllowedTools = mustReadRequiredContextFirst
            ? missingRequiredContextTools
            : phaseAllowedTools.filter((toolName) => !prefetchedRequiredContextTools.has(toolName));
        const phaseAllowAllTools = strictPolicy
            ? false
            : mustReadRequiredContextFirst
                ? false
                : resolvePhaseAllowAllTools(skillResolution, providerInfo.provider, effectivePhase, skillResolution.allowAllTools);
        const roundTools = forceAnswerFromEvidence
            ? []
            : buildGenerationTools(
                params.snapshot.toolDefinitions,
                roundAllowedTools,
                skillResolution.blockedTools,
                skillResolution.preferredTools,
                phaseAllowAllTools,
                providerInfo.provider,
                effectivePhase,
            );
        const imageExecutionWorkMode =
            !forceAnswerFromEvidence
            && providerInfo.provider === 'openai'
            && isImageExecutionWorkMode(params.snapshot, skillResolution)
            && roundAllowedTools.includes(IMAGE_GENERATION_TOOL_NAME)
            && roundTools.some((tool: any) => tool?.function?.name === IMAGE_GENERATION_TOOL_NAME);
        chatAiTrace.recordRoundStart({
            round,
            phase: effectivePhase,
            toolCount: roundTools.length,
            allowedTools: roundAllowedTools,
            forcedFinalAnswer: forceAnswerFromEvidence,
        });
        const roundProviderOptions = forceAnswerFromEvidence
            ? buildEvidenceOnlyProviderOptions(params.snapshot, providerInfo, {
                previousResponseId,
                bufferVisibleOutput: forceBufferedVisibleOutput,
            })
            : buildProviderOptions(
                params.snapshot,
                providerInfo,
                params.snapshot.lastUserMessage,
                {
                    searchMode: skillResolution.searchMode,
                    searchReason: skillResolution.searchReason,
                    intentEnvelope: skillResolution.intentEnvelope,
                    currentPhase: effectivePhase,
                },
                {
                    currentPhase: effectivePhase,
                    searchAttempt: round,
                    previousResponseId,
                },
            );
        if (imageExecutionWorkMode) {
            (roundProviderOptions as any).tool_choice = {
                type: 'function',
                function: {
                    name: IMAGE_GENERATION_TOOL_NAME,
                },
            };
        }
        if (!forceAnswerFromEvidence && mustReadRequiredContextFirst) {
            (roundProviderOptions as any).buffer_visible_output = true;
        }
        updateChatContextRuntime(params.toolContext, {
            snapshot: params.snapshot,
            executionPolicy: params.snapshot.policySnapshot || null,
            executionPlan: plan,
            skillPrompts: skillResolution.skillPrompts,
            providerNativeEvidence,
        });
        const roundPreviousResponseId = typeof (roundProviderOptions as any)?.previous_response_id === 'string'
            ? String((roundProviderOptions as any).previous_response_id)
            : '';
        const roundBufferedVisibleOutput = Boolean((roundProviderOptions as any)?.buffer_visible_output);
        let roundResult;
        let streamedRoundText = '';
        let streamedRoundReasoning = '';
        let retriedWithoutPreviousResponse = false;
        while (true) {
            try {
                roundResult = await params.generationClient.generate({
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    model: params.snapshot.model,
                    messages: providerReadyMessages,
                    tools: roundTools,
                    providerOptions: roundProviderOptions,
                    shouldCancel: params.shouldCancel,
                    onTextDelta: async (text) => {
                        if (!text) return;
                        streamedRoundText += text;
                        await params.broker.pushText(text);
                    },
                    onReasoningDelta: async (text) => {
                        if (!text) return;
                        streamedRoundReasoning += text;
                        await params.broker.pushReasoning(text);
                    },
                    onUsage: params.broker.pushUsage.bind(params.broker),
                    onCitation: params.broker.pushCitation.bind(params.broker),
                    onClientAction: async (action) => {
                        await params.broker.emitProviderClientAction(action);
                    },
                    onProviderProgress: async (progress) => {
                        await params.broker.noteProviderProgress(progress);
                    },
                    onLatencyMetrics: async (metrics) => {
                        params.broker.recordProviderLatencyMetrics(metrics);
                    },
                    onProviderState: async (state) => {
                        let forwardedState = state;
                        if (state.previousResponseId) {
                            const candidate = String(state.previousResponseId || '').trim();
                            const suspicious = providerInfo.provider === 'grok' && isSuspiciousProviderResponseId(candidate);
                            if (!suspicious && candidate) {
                                previousResponseId = candidate;
                                forwardedState = { ...state, previousResponseId: candidate };
                            } else if (suspicious) {
                                logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: ignoring suspicious provider response id', {
                                    sessionId: params.snapshot.sessionId,
                                    taskId: params.snapshot.taskId,
                                    previousResponseId: candidate,
                                });
                                return;
                            }
                        }
                        await params.onProviderState?.(forwardedState);
                    },
                });
                if (roundResult.bufferedVisibleOutput && Array.isArray(roundResult.citations) && roundResult.citations.length > 0) {
                    deferredProviderCitations.push(...roundResult.citations);
                }
                break;
            } catch (error: any) {
                const errorMessage = error?.message || String(error);
                const canRetryWithoutPreviousResponse =
                    !retriedWithoutPreviousResponse
                    && providerInfo.provider === 'grok'
                    && roundPreviousResponseId.trim().length > 0
                    && isStalePreviousResponseError(errorMessage);

                logger.error(LogCode.AI_API_ERROR, 'NodeOrchestrator: generation round failed', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    model: params.snapshot.model,
                    error: errorMessage,
                    retryWithoutPreviousResponse: canRetryWithoutPreviousResponse,
                    recentMessages: providerReadyMessages.slice(-4).map((msg) => ({
                        role: msg.role,
                        contentType: msg.content === null ? 'null' : typeof msg.content,
                        contentLength: typeof msg.content === 'string' ? msg.content.length : null,
                        hasToolCalls: Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0,
                        toolCallCount: Array.isArray(msg.tool_calls) ? msg.tool_calls.length : 0,
                        hasReasoning: typeof (msg as any).reasoning_content === 'string',
                        reasoningLength: typeof (msg as any).reasoning_content === 'string' ? (msg as any).reasoning_content.length : null,
                        toolCallId: msg.tool_call_id || null,
                    })),
                });

                if (canRetryWithoutPreviousResponse) {
                    retriedWithoutPreviousResponse = true;
                    previousResponseId = undefined;
                    continue;
                }
                throw error;
            }
        }

        if (
            roundResult.toolCalls.length === 0
            && (containsPseudoToolCallOutput(roundResult.text || '') || containsPseudoToolCallOutput(roundResult.reasoning || ''))
        ) {
            const cleanedText = stripPseudoToolCallOutput(roundResult.text || '');
            const cleanedReasoning = stripPseudoToolCallOutput(roundResult.reasoning || '');
            const textChanged = cleanedText !== (roundResult.text || '');
            const reasoningChanged = cleanedReasoning !== (roundResult.reasoning || '');

            if (textChanged || reasoningChanged) {
                await params.broker.blockContent?.(cleanedText, { clearReasoning: reasoningChanged });
                streamedRoundText = cleanedText;
                streamedRoundReasoning = reasoningChanged ? '' : streamedRoundReasoning;
            }

            roundResult = {
                ...roundResult,
                text: cleanedText,
                reasoning: cleanedReasoning,
            };
        }
        chatAiTrace.recordGenerationResult({
            round,
            textLength: String(roundResult.text || '').length,
            reasoningLength: String(roundResult.reasoning || '').length,
            toolCalls: roundResult.toolCalls || [],
            citationCount: Array.isArray(roundResult.citations) ? roundResult.citations.length : 0,
            finishReason: roundResult.providerState?.finishReason,
            bufferedVisibleOutput: Boolean(roundResult.bufferedVisibleOutput),
        });

        if (roundResult.toolCalls.length === 0) {
            const hasUserFacingText = (roundResult.text || '').trim().length > 0;
            if (!hasUserFacingText) {
                throw createOrchestrationError(
                    'NO_FINAL_USER_FACING_OUTPUT',
                    planning.locale === 'zh'
                        ? '模型没有返回可见的最终回答'
                        : 'The model returned no visible final answer',
                );
            }
            const missingRequiredContextTools = resolveMissingRequiredContextTools(
                skillResolution.contextContract,
                toolUsageCount,
                knownToolNames,
            );
            if (
                shouldEnforceRequiredContextReads(skillResolution.contextContract)
                && missingRequiredContextTools.length > 0
                && requiredContextEnforcementCount < 2
                && !forceAnswerFromEvidence
            ) {
                requiredContextEnforcementCount += 1;
                chatAiTrace.recordRequiredContextEnforcement(round, missingRequiredContextTools);
                messages.push({
                    role: 'system',
                    content: buildRequiredContextReadInstruction(missingRequiredContextTools, planning.locale),
                });
                await params.broker.markPlanPhase(
                    planning.locale === 'zh'
                        ? '正在补充本轮必需上下文'
                        : 'Reading the required context for this turn',
                );
                continue;
            }
            if (
                shouldContinueTruncatedProviderAnswer(roundResult.providerState, providerInfo.provider)
                && String(previousResponseId || '').trim().length > 0
                && truncationContinuationCount < 2
            ) {
                truncationContinuationCount += 1;
                forceAnswerFromEvidence = true;
                forceBufferedVisibleOutput = true;
                currentPhase = 'local_analysis';
                visibleFinalAnswerText = appendNonOverlappingText(visibleFinalAnswerText, roundResult.text || '');
                messages.push({
                    role: 'system',
                    content: buildTruncationContinuationInstruction(planning.locale),
                });
                await params.broker.markPlanPhase(
                    planning.locale === 'zh'
                        ? '答案过长被截断，正在续写剩余内容'
                        : 'Answer hit the output limit; continuing the remaining content',
                );
                continue;
            }
            const summaryStep = buildSummaryPlanStep(params.snapshot.lastUserMessage);
            await params.broker.markAnswerStarted(summaryStep);
            await params.broker.setRuntimeState?.(undefined);
            await params.broker.markPlanPhase(
                planning.locale === 'zh'
                    ? '已完成证据整理，正在生成回答'
                    : 'Evidence gathered, generating the answer'
            );
            flushDeferredProviderCitations();
            await emitMissingTail(roundResult.reasoning || '', streamedRoundReasoning, (text) => params.broker.pushReasoning(text));
            if (roundBufferedVisibleOutput) {
                const tail = sliceNonOverlappingTail(roundResult.text || '', visibleFinalAnswerText);
                if (tail) {
                    await params.broker.pushText(tail);
                }
                visibleFinalAnswerText = appendNonOverlappingText(visibleFinalAnswerText, roundResult.text || '');
            } else {
                await emitMissingTail(roundResult.text || '', streamedRoundText, (text) => params.broker.pushText(text));
                visibleFinalAnswerText = appendNonOverlappingText(visibleFinalAnswerText, roundResult.text || '');
            }
            logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: generation loop complete', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                contentLength: roundResult.text.length,
            });
            chatAiTrace.emit({ finalRound: round, finalReason: 'direct_model_answer' });
            return { terminal: false };
        }

        const normalizedToolCalls = roundResult.toolCalls.map((call) =>
            applyCanonicalIntentOverridesToToolCall(
                normalizeToolCallForProvider(call, providerInfo.provider),
                params.snapshot.normalizedIntent || null,
                params.snapshot.taskRoute || null,
            )
        );
        const toolExecutionPolicy = buildRoundToolExecutionPolicy(params.snapshot.policySnapshot || null, round);
        if (round === 1) {
            for (const call of normalizedToolCalls) {
                const policyViolation = checkToolAgainstPolicy({
                    call,
                    policy: toolExecutionPolicy,
                    knownToolNames,
                });
                if (policyViolation) {
                    throw createOrchestrationError(policyViolation.code, policyViolation.message);
                }
            }
        }
        params.toolContext.__controlPolicy = toolExecutionPolicy;
        const actionableToolCalls = normalizedToolCalls.filter((call) => !isProviderManagedNativeTool(call.name, providerInfo.provider));
        const providerManagedOnlyRound = normalizedToolCalls.length > 0 && actionableToolCalls.length === 0;

        if (providerManagedOnlyRound) {
            const evidenceSnapshot = buildProviderNativeEvidenceSnapshot({
                round,
                query: params.snapshot.lastUserMessage,
                toolCalls: normalizedToolCalls,
                citations: roundResult.citations || [],
                finalText: roundResult.text || '',
            });
            await recordProviderManagedToolRound({
                broker: params.broker,
                toolCalls: normalizedToolCalls,
                planning,
                skillResolution,
                query: params.snapshot.lastUserMessage,
                round,
                provider: providerInfo.provider,
                evidenceSnapshot,
            });
            if (evidenceSnapshot) {
                providerNativeEvidence.push(evidenceSnapshot);
                await params.broker.recordProviderNativeEvidence?.(evidenceSnapshot);
            }
            chatAiTrace.recordProviderNativeToolRound(round, normalizedToolCalls, Boolean(evidenceSnapshot));
            intentSelectionHistory.push(
                buildProviderIntentHistoryEntry(round, normalizedToolCalls, evidenceSnapshot, roundResult.text || ''),
            );

            if (effectivePhase === 'native_search_only') {
                if (evidenceSnapshot && skillResolution.toolPhasePolicy.nextPhaseAfterNativeSearch) {
                    const nextPhaseAfterNativeSearch = skillResolution.toolPhasePolicy.nextPhaseAfterNativeSearch;
                    const intentHandled = await refreshIntentForNextRound(round + 1, {
                        phaseAfterNativeSearch: nextPhaseAfterNativeSearch,
                    });
                    if (intentHandled) {
                        return { terminal: false };
                    }
                    await params.broker.setRuntimeState?.(
                        'chain_query_in_progress',
                        planning.locale === 'zh'
                            ? '已确认公开来源，正在收集链上证据'
                            : 'Public-source timing confirmed; gathering chain-side evidence',
                    );
                    continue;
                }
                if (evidenceSnapshot && (roundResult.text || '').trim().length > 0) {
                    const missingRequiredContextTools = resolveMissingRequiredContextTools(
                        skillResolution.contextContract,
                        toolUsageCount,
                        knownToolNames,
                    );
                    if (
                        shouldEnforceRequiredContextReads(skillResolution.contextContract)
                        && missingRequiredContextTools.length > 0
                        && requiredContextEnforcementCount < 2
                        && !forceAnswerFromEvidence
                    ) {
                        requiredContextEnforcementCount += 1;
                        chatAiTrace.recordRequiredContextEnforcement(round, missingRequiredContextTools);
                        messages.push({
                            role: 'system',
                            content: buildRequiredContextReadInstruction(missingRequiredContextTools, planning.locale),
                        });
                        await params.broker.markPlanPhase(
                            planning.locale === 'zh'
                                ? '正在补充本轮必需上下文'
                                : 'Reading the required context for this turn',
                        );
                        continue;
                    }
                    const summaryStep = buildSummaryPlanStep(params.snapshot.lastUserMessage);
                    await params.broker.markAnswerStarted(summaryStep);
                    await params.broker.markPlanPhase(
                        planning.locale === 'zh'
                            ? '已完成证据整理，正在生成回答'
                            : 'Evidence gathered, generating the answer'
                    );
                    flushDeferredProviderCitations();
                    await emitMissingTail(roundResult.reasoning || '', streamedRoundReasoning, (text) => params.broker.pushReasoning(text));
                    if (roundBufferedVisibleOutput) {
                        const tail = sliceNonOverlappingTail(roundResult.text || '', visibleFinalAnswerText);
                        if (tail) {
                            await params.broker.pushText(tail);
                        }
                        visibleFinalAnswerText = appendNonOverlappingText(visibleFinalAnswerText, roundResult.text || '');
                    } else {
                        await emitMissingTail(roundResult.text || '', streamedRoundText, (text) => params.broker.pushText(text));
                        visibleFinalAnswerText = appendNonOverlappingText(visibleFinalAnswerText, roundResult.text || '');
                    }
                    logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: native search phase completed with final answer', {
                        sessionId: params.snapshot.sessionId,
                        taskId: params.snapshot.taskId,
                        round,
                        contentLength: roundResult.text.length,
                    });
                    chatAiTrace.emit({ finalRound: round, finalReason: 'provider_native_search_answer' });
                    return { terminal: false };
                }
                messages.push({
                    role: 'system',
                    content: planning.locale === 'zh'
                        ? '已收到搜索工具结果。你可以继续使用任何相关工具，或直接基于现有证据回答。'
                        : 'Search tool output is available. You may continue with any relevant tools or answer directly from the evidence you already have.',
                });
                if (await refreshIntentForNextRound(round + 1)) {
                    return { terminal: false };
                }
                continue;
            }

            if ((roundResult.text || '').trim().length > 0) {
                const missingRequiredContextTools = resolveMissingRequiredContextTools(
                    skillResolution.contextContract,
                    toolUsageCount,
                    knownToolNames,
                );
                if (
                    shouldEnforceRequiredContextReads(skillResolution.contextContract)
                    && missingRequiredContextTools.length > 0
                    && requiredContextEnforcementCount < 2
                    && !forceAnswerFromEvidence
                ) {
                    requiredContextEnforcementCount += 1;
                    chatAiTrace.recordRequiredContextEnforcement(round, missingRequiredContextTools);
                    messages.push({
                        role: 'system',
                        content: buildRequiredContextReadInstruction(missingRequiredContextTools, planning.locale),
                    });
                    await params.broker.markPlanPhase(
                        planning.locale === 'zh'
                            ? '正在补充本轮必需上下文'
                            : 'Reading the required context for this turn',
                    );
                    continue;
                }
                const summaryStep = buildSummaryPlanStep(params.snapshot.lastUserMessage);
                await params.broker.markAnswerStarted(summaryStep);
                await params.broker.setRuntimeState?.(undefined);
                await params.broker.markPlanPhase(
                    planning.locale === 'zh'
                        ? '已完成证据整理，正在生成回答'
                    : 'Evidence gathered, generating the answer'
                );
                flushDeferredProviderCitations();
                await emitMissingTail(roundResult.reasoning || '', streamedRoundReasoning, (text) => params.broker.pushReasoning(text));
                if (roundBufferedVisibleOutput) {
                    const tail = sliceNonOverlappingTail(roundResult.text || '', visibleFinalAnswerText);
                    if (tail) {
                        await params.broker.pushText(tail);
                    }
                    visibleFinalAnswerText = appendNonOverlappingText(visibleFinalAnswerText, roundResult.text || '');
                } else {
                    await emitMissingTail(roundResult.text || '', streamedRoundText, (text) => params.broker.pushText(text));
                    visibleFinalAnswerText = appendNonOverlappingText(visibleFinalAnswerText, roundResult.text || '');
                }
                logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: provider-managed tool round already produced answer text', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    contentLength: roundResult.text.length,
                });
                chatAiTrace.emit({ finalRound: round, finalReason: 'provider_managed_tool_answer' });
                return { terminal: false };
            }

            logger.error(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: provider-managed tool chain produced no stable final text', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                tools: normalizedToolCalls.map((call) => call.name),
            });

            throw createOrchestrationError(
                'NO_FINAL_TEXT_AFTER_TOOL_CHAIN',
                planning.locale === 'zh'
                    ? '工具调用已完成，但模型没有产出稳定的最终回答'
                    : 'Tool chain completed, but the model did not return a stable final answer',
            );
        }

        await params.broker.markPlanPhase(
            actionableToolCalls.length > 0
                ? planning.locale === 'zh'
                    ? `已确定 ${actionableToolCalls.length} 个下一步动作`
                    : `Selected ${actionableToolCalls.length} next action(s)`
                : planning.locale === 'zh'
                    ? '已决定直接生成最终回答'
                    : 'Decided to answer directly'
        );
        await params.broker.ensurePlanStep(buildSummaryPlanStep(params.snapshot.lastUserMessage));
        for (const call of actionableToolCalls) {
            const plannedStep = resolvePlanStepForTool(call.name, planning, skillResolution, params.snapshot.lastUserMessage)
                || (planning.asksOnChainEvidence && planning.requestedToken
                    ? buildChainEvidencePlanStep(skillResolution, params.snapshot.lastUserMessage)
                    : null);
            await params.broker.noteToolSelected(call, plannedStep || undefined);
        }
        messages.push({
            role: 'assistant',
            content: actionableToolCalls.length > 0
                ? ''
                : roundResult.text,
            ...(supportsStoredReasoning(params.snapshot.model || '')
                && actionableToolCalls.length === 0
                ? { reasoning_content: roundResult.reasoning || '' }
                : {}),
            ...(actionableToolCalls.length > 0 ? { tool_calls: actionableToolCalls.map(toAssistantToolCall) } : {}),
        });

        let executedFreshTool = false;
        let shouldForceAnswerAfterRound: boolean = forceAnswerFromEvidence;
        for (const call of actionableToolCalls) {
            if (params.shouldCancel && await params.shouldCancel()) {
                throw new Error('Task cancelled');
            }
            const polymarketOrderGuard = resolvePolymarketOrderGuardResult(
                call,
                executedToolResults,
                params.snapshot,
            );
            if (polymarketOrderGuard) {
                chatAiTrace.recordToolResult(round, polymarketOrderGuard);
                await params.broker.recordToolResult(polymarketOrderGuard);
                messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: buildModelToolMessageContent({
                        ok: false,
                        error: polymarketOrderGuard.error,
                        reasonCode: polymarketOrderGuard.reasonCode,
                        continuation: {
                            next_action: 'call_another_tool',
                            can_answer_now: true,
                            reason: 'Execution precheck is incomplete. Gather the required preparation tools before placing the order.',
                            missing_evidence: polymarketOrderGuard.result?.required_tools || [],
                            reusable_for_next_turn: true,
                        },
                    }),
                });
                continue;
            }
            const toolKey = buildToolCallKey(call.name, call.arguments || {});
            const cached = executedToolResults.get(toolKey);
            const usageCount = (toolUsageCount.get(call.name) || 0) + 1;
            toolUsageCount.set(call.name, usageCount);
            const toolBudget = resolvePolicyToolBudget(params.snapshot.policySnapshot || null, call.name);
            if (usageCount > toolBudget) {
                logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: tool budget exceeded', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    tool: call.name,
                    usageCount,
                    toolBudget,
                });
                const budgetResult = cached
                    ? {
                        id: call.id,
                        name: call.name,
                        arguments: call.arguments || {},
                        ok: cached.ok,
                        result: cached.result,
                        error: cached.error,
                        metadata: {
                            ...(cached.metadata || {}),
                            source: 'repeat_cache',
                            stop_reason: 'tool_budget_guard',
                        },
                        continuation: cached.continuation,
                    }
                    : {
                        id: call.id,
                        name: call.name,
                        arguments: call.arguments || {},
                        ok: false,
                        error: buildToolBudgetMessage(call.name, planning.locale),
                        reasonCode: 'TOOL_BUDGET_EXCEEDED',
                        policyDecisionId: params.snapshot.policySnapshot?.policyDecisionId,
                        result: {
                            error: buildToolBudgetMessage(call.name, planning.locale),
                            reasonCode: 'TOOL_BUDGET_EXCEEDED',
                            reason_code: 'TOOL_BUDGET_EXCEEDED',
                            policy_decision_id: params.snapshot.policySnapshot?.policyDecisionId,
                            tool: call.name,
                            usageCount,
                            toolBudget,
                        },
                        metadata: { source: 'tool_budget_guard' },
                        continuation: {
                            next_action: 'answer_now',
                            can_answer_now: true,
                            reason: buildToolBudgetMessage(call.name, planning.locale),
                            reusable_for_next_turn: false,
                        },
                    };
                if (isReadOnlyTask) {
                    shouldForceAnswerAfterRound = true;
                }
                chatAiTrace.recordToolResult(round, budgetResult as any, { cached: Boolean(cached) });
                await params.broker.recordToolResult(budgetResult as any);
                messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: buildModelToolMessageContent(
                        cached
                            ? budgetResult as any
                            : {
                                ok: false,
                                error: (budgetResult as any).error,
                                reasonCode: 'TOOL_BUDGET_EXCEEDED',
                                continuation: (budgetResult as any).continuation,
                            },
                    ),
                });
                continue;
            }
            await params.onToolStatus?.(call.name);
            const plannedStep = resolvePlanStepForTool(call.name, planning, skillResolution, params.snapshot.lastUserMessage)
                || (planning.asksOnChainEvidence && planning.requestedToken
                    ? buildChainEvidencePlanStep(skillResolution, params.snapshot.lastUserMessage)
                    : null);
            if (CHAIN_EVIDENCE_TOOLS.has(call.name)) {
                await params.broker.setRuntimeState?.(
                    'chain_query_in_progress',
                    planning.locale === 'zh'
                        ? '正在执行链上查询'
                        : 'Running chain-side queries',
                );
            }
            await params.broker.markPlanStepStarted(call, plannedStep || undefined);
            let result: OrchestratorToolResult;
            if (cached) {
                logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: duplicate tool call reused from cache', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    tool: call.name,
                    toolKey,
                });
                result = {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: cached.ok,
                    result: cached.result,
                    error: cached.error,
                    metadata: {
                        ...(cached.metadata || {}),
                        source: 'repeat_cache',
                    },
                    continuation: cached.continuation,
                };
            } else {
                executedFreshTool = true;
                result = await params.toolExecutionEngine.execute(call, params.toolContext);
                if (!result.ok && result.reasonCode && ['POLICY_UNAUTHORIZED_TOOL', 'POLICY_CONTROL_PLANE_VIOLATION'].includes(result.reasonCode)) {
                    throw createOrchestrationError(result.reasonCode, result.error || 'Tool blocked by policy');
                }
                executedToolResults.set(toolKey, {
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: result.ok,
                    result: result.result,
                    error: result.error,
                    metadata: result.metadata,
                    continuation: result.continuation,
                });
            }
            chatAiTrace.recordToolResult(round, result, { cached: Boolean(cached) });
            await params.broker.recordToolResult(result);
            const receiptDecision = buildExecutionReceiptDecision(result, planning.locale);
            logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: local tool execution result', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                cached: Boolean(cached),
                ...summarizeToolResultForLog(result),
                receiptDecision: {
                    reason: receiptDecision.reason,
                    answerBuilt: Boolean(receiptDecision.answer),
                    resultKeys: receiptDecision.resultKeys,
                },
            });
            if (receiptDecision.answer) {
                await params.broker.setRuntimeState?.(undefined);
                await params.broker.markAnswerStarted(buildSummaryPlanStep(params.snapshot.lastUserMessage));
                await params.broker.pushText(receiptDecision.answer);
                chatAiTrace.emit({ finalRound: round, finalReason: 'tool_receipt_answer_hook' });
                return { terminal: false };
            }
            if (result.continuation?.next_action === 'complete_with_side_effect') {
                await params.broker.setRuntimeState?.(undefined);
                chatAiTrace.markTerminal('tool_managed_side_effect_response');
                chatAiTrace.emit({ finalRound: round, finalReason: 'tool_managed_side_effect_response' });
                return {
                    terminal: true,
                    terminalOwner: 'external',
                };
            }
            messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: buildModelToolMessageContent(result),
            });
            intentSelectionHistory.push(buildToolIntentHistoryEntry(result));
        }
        if (!executedFreshTool) {
            duplicateOnlyRounds += 1;
            logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: duplicate-only tool round detected', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                duplicateOnlyRounds,
                tools: actionableToolCalls.map((call) => call.name),
            });
            if (isReadOnlyTask && actionableToolCalls.length > 0) {
                shouldForceAnswerAfterRound = true;
            }
        } else {
            duplicateOnlyRounds = 0;
        }
        forceAnswerFromEvidence = shouldForceAnswerAfterRound;
        if (await refreshIntentForNextRound(round + 1)) {
            return { terminal: false };
        }
    }

    throw new Error('Max orchestration rounds exceeded');
    } catch (error) {
        chatAiTrace.markFailed(error);
        chatAiTrace.emit();
        throw error;
    }
}

function buildIntentReentrySnapshot(
    snapshot: ChatContextSnapshot,
    intentSelectionHistory: ChatHistoryMessage[],
): ChatContextSnapshot {
    const mergedHistory = [
        ...(Array.isArray(snapshot.history) ? snapshot.history : []),
        ...intentSelectionHistory,
    ].slice(-12);
    return {
        ...snapshot,
        history: mergedHistory,
        normalizedIntent: null,
        normalizationState: null,
    };
}

function buildProviderIntentHistoryEntry(
    round: number,
    toolCalls: Array<{ name?: string; arguments?: Record<string, any> }>,
    evidenceSnapshot: ProviderNativeEvidenceSnapshot | null,
    finalText: string,
): ChatHistoryMessage {
    return {
        role: 'assistant',
        content: JSON.stringify({
            type: 'provider_native_round',
            round,
            tools: toolCalls.map((call) => String(call?.name || '').trim()).filter(Boolean),
            sourceTypes: Array.isArray(evidenceSnapshot?.sourceTypes) ? evidenceSnapshot.sourceTypes : [],
            resultCount: Array.isArray(evidenceSnapshot?.results) ? evidenceSnapshot.results.length : 0,
            provisionalText: truncateForIntentHistory(finalText, 280),
        }),
    };
}

function buildToolIntentHistoryEntry(result: OrchestratorToolResult): ChatHistoryMessage {
    const resultRecord = result.result && typeof result.result === 'object' && !Array.isArray(result.result)
        ? result.result as Record<string, any>
        : null;
    return {
        role: 'tool',
        content: JSON.stringify({
            type: 'tool_result',
            tool: String(result.name || '').trim(),
            ok: Boolean(result.ok),
            source: normalizeIntentHistoryString(result.metadata?.source),
            reasonCode: normalizeIntentHistoryString(result.reasonCode || resultRecord?.reason_code || resultRecord?.reasonCode),
            continuation: summarizeContinuationForIntentHistory(result.continuation),
            resultKeys: resultRecord ? Object.keys(resultRecord).slice(0, 16) : [],
        }),
    };
}

function buildToolCallKey(name: string, args: Record<string, any>): string {
    return `${name}:${stableStringify(args || {})}`;
}

function summarizeContinuationForIntentHistory(continuation: any) {
    if (!continuation || typeof continuation !== 'object') return null;
    const missingEvidence = Array.isArray(continuation.missing_evidence)
        ? continuation.missing_evidence.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 8)
        : [];
    return {
        next_action: normalizeIntentHistoryString(continuation.next_action),
        can_answer_now: continuation.can_answer_now === true,
        missing_evidence: missingEvidence,
        reusable_for_next_turn: continuation.reusable_for_next_turn === true,
    };
}

function truncateForIntentHistory(text: string, limit: number): string | null {
    const normalized = String(text || '').trim();
    if (!normalized) return null;
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function normalizeIntentHistoryString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
}

function updateChatContextRuntime(
    toolContext: Record<string, any>,
    runtime: {
        snapshot: ChatContextSnapshot;
        executionPolicy?: import('./controlPolicy.js').ControlPolicySnapshot | null;
        executionPlan: any;
        skillPrompts: string[];
        providerNativeEvidence: ProviderNativeEvidenceSnapshot[];
    },
) {
    toolContext.__snapshot = runtime.snapshot;
    toolContext.__controlPolicy = runtime.executionPolicy === undefined
        ? runtime.snapshot.policySnapshot || null
        : runtime.executionPolicy;
    toolContext.__chatContextRuntime = {
        executionPlan: runtime.executionPlan || null,
        skillPrompts: Array.isArray(runtime.skillPrompts) ? runtime.skillPrompts : [],
        providerNativeEvidence: Array.isArray(runtime.providerNativeEvidence) ? runtime.providerNativeEvidence : [],
    };
}

function buildRoundToolExecutionPolicy(
    policy: import('./controlPolicy.js').ControlPolicySnapshot | null | undefined,
    round: number,
): import('./controlPolicy.js').ControlPolicySnapshot | null {
    if (!policy) return null;
    if (round <= 1) return policy;
    return {
        ...policy,
        enforceIntentAllowlist: false,
    };
}

function resolveMissingRequiredContextTools(
    contextContract: ChatContextContract | null | undefined,
    toolUsageCount: Map<string, number>,
    knownToolNames: Set<string>,
): string[] {
    const requiredContexts = contextContract?.requiredContexts || [];
    return Array.from(new Set(
        requiredContexts
            .map((contextName) => CONTEXT_READ_TOOL_BY_BLOCK[contextName])
            .filter((toolName): toolName is string => typeof toolName === 'string' && knownToolNames.has(toolName))
            .filter((toolName) => (toolUsageCount.get(toolName) || 0) === 0),
    ));
}

function shouldEnforceRequiredContextReads(contextContract: ChatContextContract | null | undefined): boolean {
    const contract = contextContract || null;
    if (!contract) return false;
    if (contract.mode === 'execution' || contract.mode === 'debug') {
        return true;
    }
    const highRiskContexts = new Set<ChatContextContract['requiredContexts'][number]>([
        'user_settings',
        'wallet_state',
        'token_context',
        'launchpad_context',
    ]);
    return (contract.requiredContexts || []).some((contextName) => highRiskContexts.has(contextName));
}

function shouldBackendPrefetchRequiredContextReads(contextContract: ChatContextContract | null | undefined): boolean {
    const contract = contextContract || null;
    if (!contract) return false;
    return contract.mode === 'execution' && shouldEnforceRequiredContextReads(contract);
}

function isImageExecutionWorkMode(
    snapshot: ChatContextSnapshot,
    skillResolution: SkillResolution,
): boolean {
    const taskRoute = snapshot.taskRoute || null;
    const intentEnvelope = skillResolution.intentEnvelope;
    const normalizedIntent = snapshot.normalizedIntent || null;
    // CONTEXT MEMORY
    // Updated: 2026-04-23
    // Status: mixed
    // Why: Farcaster image traces showed GPT selected image_generation execute
    // but stayed in chat-answer mode when image tools were merely optional.
    // Debug Goal: image execution turns must enter tool work mode before the
    // first provider call, so clear image requests call the image business tool.
    // Search Tags: image execution work mode generate_image_from_intent tool_choice
    // Invariants:
    // - Prompt-only image advice must not be forced into generation.
    // - Only OpenAI calls that can see generate_image_from_intent receive forced tool_choice upstream.
    // Failure Modes:
    // - Long image prompts end in a public "what should I do" reply.
    // - Prompt-coaching requests accidentally generate images.
    return intentEnvelope.primary_intent === 'image_generation'
        && (
            intentEnvelope.task_mode === 'execute'
            || taskRoute?.phase === 'execute'
            || normalizedIntent?.executionCandidate === true
        );
}

function buildRequiredContextReadInstruction(missingToolNames: string[], locale: 'en' | 'zh'): string {
    if (locale === 'zh') {
        return `你还没有读取本轮必需上下文。先调用这些 read_* 工具补齐缺失上下文，再继续最终回答：${missingToolNames.join(', ')}。不要跳过。`;
    }
    return `You have not read the required context for this turn yet. Call these read_* tools first, then continue the final answer: ${missingToolNames.join(', ')}. Do not skip them.`;
}

function buildEvidenceOnlyAnswerInstruction(locale: 'en' | 'zh'): string {
    if (locale === 'zh') {
        return '基于当前对话里已经拿到的工具结果、缓存结果和公开来源证据，直接给出最终回答。';
    }
    return 'Use the tool results, cached evidence, and public-source evidence already gathered in this conversation, then answer the user directly.';
}

function buildModelToolMessageContent(result: Record<string, any>): string {
    return JSON.stringify(
        result.ok
            ? {
                ok: true,
                result: result.result ?? null,
                continuation: result.continuation || null,
            }
            : {
                ok: false,
                error: result.error || 'tool execution failed',
                reasonCode: result.reasonCode,
                continuation: result.continuation || null,
            },
    );
}

function buildPrefetchedContextSystemMessage(toolName: string, result: Record<string, any>): string {
    return [
        '[BACKEND_PREFETCHED_CONTEXT]',
        `tool: ${toolName}`,
        'source: backend_required_context_prefetch',
        'Use this as already-read context for the current turn. Do not call the same read_* tool again unless the user changes the relevant state.',
        buildModelToolMessageContent(result),
    ].join('\n');
}

function buildTruncationContinuationInstruction(locale: 'en' | 'zh'): string {
    if (locale === 'zh') {
        return '你上一条最终回答因为输出长度限制被截断了。请从刚才停止的位置继续，不要重复已经写过的内容，不要重新开头，也不要再调用任何工具。只补全剩余答案并自然收尾。';
    }
    return 'Your previous final answer was cut off by the output limit. Continue exactly where you stopped. Do not repeat earlier text, do not restart the answer, and do not call any tools. Only finish the remaining content and close naturally.';
}

function buildEvidenceOnlyProviderOptions(
    snapshot: ChatContextSnapshot,
    providerInfo: { provider: 'openai' | 'grok' | 'deepseek' },
    options?: { previousResponseId?: string | null; bufferVisibleOutput?: boolean },
) {
    const reasoningEffort = normalizeOpenAIReasoningEffort(snapshot.runtime.toolContext?.reasoningEffort);
    if (providerInfo.provider !== 'grok') {
        return {
            metadata: {
                session_id: String(snapshot.sessionId || ''),
                task_id: String(snapshot.taskId || ''),
            },
            tool_context: snapshot.runtime.toolContext || {},
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
            enable_search: false,
            ...(options?.bufferVisibleOutput ? { buffer_visible_output: true } : {}),
        };
    }

    return {
        metadata: {
            session_id: String(snapshot.sessionId || ''),
            task_id: String(snapshot.taskId || ''),
        },
        tool_context: snapshot.runtime.toolContext || {},
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        enable_search: false,
        ...(options?.previousResponseId ? { previous_response_id: String(options.previousResponseId) } : {}),
        ...(options?.bufferVisibleOutput ? { buffer_visible_output: true } : {}),
        tool_policy: {
            control_plane: 'node',
            action_class: snapshot.policySnapshot?.actionClass || 'READ_ONLY',
            mutation_allowed: Boolean(snapshot.policySnapshot?.mutationAllowed),
            enforcement_level: snapshot.policySnapshot?.enforcementLevel || 'hard',
            native_tools: {
                enable_search: false,
                enabled_tools: [],
                required: false,
                preferred_required_tool: null,
                include_options: [],
                allow_extra_sdk_tools: false,
                reason: 'forced_final_answer',
            },
            execution: {
                per_tool_timeout_ms: 20000,
                total_tool_budget_ms: 45000,
            },
        },
    };
}

function shouldContinueTruncatedProviderAnswer(
    providerState: GenerationProviderState | undefined,
    provider: 'openai' | 'grok' | 'deepseek',
): boolean {
    if (provider !== 'grok') {
        return false;
    }
    const finishReason = String(providerState?.finishReason || '').trim().toLowerCase();
    return finishReason === 'length' || finishReason === 'max_tokens';
}

function sliceNonOverlappingTail(candidate: string, alreadyVisible: string): string {
    if (!candidate) return '';
    if (!alreadyVisible) return candidate;
    if (candidate.startsWith(alreadyVisible)) {
        return candidate.slice(alreadyVisible.length);
    }
    const maxOverlap = Math.min(candidate.length, alreadyVisible.length);
    for (let size = maxOverlap; size > 0; size -= 1) {
        if (alreadyVisible.endsWith(candidate.slice(0, size))) {
            return candidate.slice(size);
        }
    }
    return candidate;
}

function appendNonOverlappingText(existing: string, incoming: string): string {
    if (!incoming) return existing;
    return `${existing}${sliceNonOverlappingTail(incoming, existing)}`;
}

function isStalePreviousResponseError(message: string): boolean {
    const normalized = String(message || '').toLowerCase();
    return (
        (normalized.includes('response with id') && normalized.includes('not found'))
        || (normalized.includes('previous_response_id') && normalized.includes('not found'))
        || (normalized.includes('grpc error') && normalized.includes('not found'))
    );
}

export function normalizeToolCallForProvider(
    call: { id: string; name: string; arguments: Record<string, any> },
    provider: 'openai' | 'grok' | 'deepseek',
) {
    // Hard-policy mode does not perform provider fallback tool remapping.
    // Tool names must be validated as-is by the policy layer.
    void provider;
    if (String(call.name || '') !== 'get_early_buyers') {
        return call;
    }

    const args = { ...(call.arguments || {}) };
    if (!args.address && typeof args.token_address === 'string') {
        args.address = args.token_address;
    }

    const explicitStart = normalizeTimeValue(args.start_time);
    const explicitEnd = normalizeTimeValue(args.end_time);
    let startTime = explicitStart;
    let endTime = explicitEnd;

    if ((!startTime || !endTime) && typeof args.timestamp_range === 'string') {
        const rawRange = String(args.timestamp_range).trim();
        const explicitRange = rawRange.match(/^(\d{10,13})\s*-\s*(\d{10,13})$/)
            || rawRange.match(/^(.+?)\s*(?:to|->)\s*(.+)$/i);
        if (explicitRange) {
            startTime ||= normalizeTimeValue(explicitRange[1]);
            endTime ||= normalizeTimeValue(explicitRange[2]);
        }
    }

    if (!startTime && !endTime) {
        const centerTime = normalizeTimeValue(args.timestamp ?? args.center_time ?? args.post_time ?? args.time);
        if (centerTime) {
            const windowHours = normalizeWindowHours(args.window_hours ?? args.time_window_hours);
            const windowMs = windowHours * 60 * 60 * 1000;
            startTime = new Date(Date.parse(centerTime) - windowMs).toISOString();
            endTime = new Date(Date.parse(centerTime) + windowMs).toISOString();
        }
    }

    if (startTime) args.start_time = startTime;
    if (endTime) args.end_time = endTime;
    delete args.token_address;
    delete args.timestamp_range;
    delete args.timestamp;
    delete args.center_time;
    delete args.post_time;
    delete args.time;
    delete args.window_hours;
    delete args.time_window_hours;

    return {
        ...call,
        arguments: args,
    };
}

export function applyCanonicalIntentOverridesToToolCall(
    call: { id: string; name: string; arguments: Record<string, any> },
    canonicalIntent: CanonicalIntent | null | undefined,
    taskRoute?: ChatContextSnapshot['taskRoute'] | null,
) {
    if (String(call.name || '') !== 'get_early_buyers') {
        return call;
    }

    const timeContext = taskRoute?.timeContext || canonicalIntent?.timeContext;
    if (!timeContext?.isTimeBound) {
        return call;
    }

    const args = { ...(call.arguments || {}) };
    if (timeContext.startTime) {
        args.start_time = timeContext.startTime;
    }
    if (timeContext.endTime) {
        args.end_time = timeContext.endTime;
    }

    return {
        ...call,
        arguments: args,
    };
}

function isProviderManagedNativeTool(toolName: string, provider: 'openai' | 'grok' | 'deepseek') {
    if (provider !== 'grok') return false;
    return isProviderNativeTool(toolName, null);
}

function isSuspiciousProviderResponseId(value: string): boolean {
    const normalized = String(value || '').trim();
    if (!normalized) return true;
    return /^chatcmpl-?-?\d+$/.test(normalized);
}

function resolveToolBudget(toolName: string): number {
    return resolvePolicyToolBudget(null, toolName);
}

function buildToolBudgetMessage(toolName: string, locale: 'en' | 'zh'): string {
    if (locale === 'zh') {
        return `工具 ${toolName} 已达到本轮调用上限。请基于现有证据直接给出结论，不要继续重复搜索。`;
    }
    return `Tool budget reached for ${toolName}. Answer from the current evidence and do not continue repeating searches.`;
}

function createOrchestrationError(code: string, message: string): Error {
    const error = new Error(`[${code}] ${message}`);
    (error as any).code = code;
    return error;
}

function isTrustedPolymarketEvidenceSource(toolName: string, result: any): boolean {
    const normalizedTool = String(toolName || '').trim();
    if (!normalizedTool) return false;

    if (result && typeof result === 'object') {
        const source = String((result as Record<string, any>).source || '').trim().toLowerCase();
        const type = String((result as Record<string, any>).type || '').trim().toLowerCase();
        const selectionValid = Boolean((result as Record<string, any>)?.selection_validation?.valid);
        const authoritativeValid = Boolean((result as Record<string, any>)?.authoritative_resolution?.valid);
        const hasMarketList = Array.isArray((result as Record<string, any>).markets);
        const hasBuckets = Boolean((result as Record<string, any>).buckets && typeof (result as Record<string, any>).buckets === 'object');
        const hasPrimaryCandidate = Boolean((result as Record<string, any>).primary_candidate || (result as Record<string, any>).current_candidate || (result as Record<string, any>).execution_candidate);

        if (selectionValid || authoritativeValid) return true;
        if (normalizedTool === 'get_new_markets' && hasMarketList) return true;
        if (normalizedTool.startsWith('get_polymarket_') && (hasMarketList || hasBuckets || hasPrimaryCandidate)) return true;
        if (source.includes('polymarket') && (type.includes('coin up/down') || type.includes('market overview'))) return true;
    }

    return false;
}

export function resolvePolymarketOrderGuardResult(
    call: { id: string; name: string; arguments: Record<string, any> },
    executedToolResults: Map<string, { name?: string; arguments?: Record<string, any>; ok?: boolean; result?: any; metadata?: Record<string, any> }>,
    snapshot: ChatContextSnapshot,
) {
    if (String(call.name || '') !== 'place_polymarket_order') {
        return null;
    }

    const tokenId = String(call.arguments?.token_id || '').trim();
    const verifiedTokenIds = collectVerifiedPolymarketTokenIds(executedToolResults, snapshot);
    if (tokenId && verifiedTokenIds.has(tokenId)) {
        return null;
    }

    const error = tokenId
        ? 'Polymarket order blocked: token_id was not verified by a trusted Polymarket discovery or preparation result in the current evidence chain.'
        : 'Polymarket order blocked: missing concrete token_id. Resolve the exact selected outcome with a trusted Polymarket discovery or preparation tool first.';

    return {
        id: call.id,
        name: call.name,
        arguments: call.arguments || {},
        ok: false,
        error,
        reasonCode: 'PRECHECK_REQUIRED' as const,
        result: {
            error,
            reasonCode: 'PRECHECK_REQUIRED',
            required_tools: ['trusted_polymarket_discovery_or_prep'],
            token_id: tokenId || null,
        },
        metadata: { source: 'polymarket_token_guard' },
    };
}

export function collectVerifiedPolymarketTokenIds(
    executedToolResults: Map<string, { name?: string; arguments?: Record<string, any>; ok?: boolean; result?: any; metadata?: Record<string, any> }>,
    snapshot: ChatContextSnapshot,
): Set<string> {
    const tokenIds = new Set<string>();

    for (const item of executedToolResults.values()) {
        if (!item?.ok) continue;
        const toolName = String(item?.name || '').trim();
        if (!isTrustedPolymarketEvidenceSource(toolName, item.result)) continue;
        for (const tokenId of extractPolymarketTokenIds(item.result)) {
            tokenIds.add(tokenId);
        }
    }

    const recentCalls = snapshot.recentToolTrace?.toolCalls || [];
    for (const toolCall of recentCalls) {
        const toolName = String(toolCall?.tool || '').trim();
        const status = String(toolCall?.status || '').trim().toLowerCase();
        if (!isTrustedPolymarketEvidenceSource(toolName, toolCall?.result)) continue;
        if (!['success', 'cached'].includes(status)) continue;
        for (const tokenId of extractPolymarketTokenIds(toolCall?.result)) {
            tokenIds.add(tokenId);
        }
    }

    const selection = snapshot.polymarketSelection || null;
    if (selection) {
        const prepared = selection.preparedSelection;
        const preparedToken = String(prepared?.tokenId || '').trim();
        if (preparedToken) {
            tokenIds.add(preparedToken);
        }
        for (const candidate of selection.candidates || []) {
            for (const outcome of candidate.outcomes || []) {
                const tokenId = String(outcome.tokenId || '').trim();
                if (tokenId) {
                    tokenIds.add(tokenId);
                }
            }
        }
    }

    return tokenIds;
}

function extractPolymarketTokenIds(result: any): string[] {
    const found = new Set<string>();

    const visit = (value: any) => {
        if (value == null) return;
        if (Array.isArray(value)) {
            for (const item of value) visit(item);
            return;
        }
        if (typeof value !== 'object') return;

        const tokenId = value.token_id ?? value.tokenId;
        if (tokenId != null) {
            const normalized = String(tokenId).trim();
            if (normalized) {
                found.add(normalized);
            }
        }

        for (const child of Object.values(value)) {
            if (child && typeof child === 'object') {
                visit(child);
            }
        }
    };

    visit(result);
    return Array.from(found);
}

function stableStringify(value: any): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}


function normalizeTimeValue(value: unknown): string | undefined {
    if (value == null) return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) {
        const millis = numeric < 1e12 ? numeric * 1000 : numeric;
        return new Date(millis).toISOString();
    }
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return undefined;
    return new Date(parsed).toISOString();
}

function normalizeWindowHours(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 1;
    return Math.min(24, numeric);
}

export function buildFinalizationEvidenceSnapshot(
    executedToolResults: Map<string, { name?: string; arguments?: Record<string, any>; ok?: boolean; result?: any; metadata?: Record<string, any> }>,
    providerNativeEvidence: ProviderNativeEvidenceSnapshot[],
): string | null {
    const payload: Record<string, any> = {};

    for (const item of executedToolResults.values()) {
        const toolName = String(item?.name || '').trim();
        if (!toolName) continue;
        payload[toolName] = {
            ok: item?.ok !== false,
            arguments: item?.arguments || {},
            result: item?.result ?? null,
            source: item?.metadata?.source || 'tool_runtime',
        };
    }

    const normalizedProviderResults = (providerNativeEvidence || [])
        .flatMap((entry) => Array.isArray(entry?.results) ? entry.results : [])
        .map((entry) => ({
            title: entry?.title || undefined,
            url: entry?.url || undefined,
            snippet: entry?.snippet || undefined,
            sourceType: entry?.sourceType || undefined,
        }))
        .filter((entry) => entry.title || entry.url || entry.snippet);
    if (normalizedProviderResults.length > 0) {
        payload.provider_native_results = normalizedProviderResults;
    }

    if (Object.keys(payload).length === 0) return null;
    return JSON.stringify(payload);
}

export function buildGenerationTools(
    toolDefinitions: Array<{ name: string; description: string; parameters: any }>,
    allowedTools: string[],
    blockedTools: string[] = [],
    preferredTools: string[] = [],
    allowAllTools = true,
    provider: 'openai' | 'grok' | 'deepseek' = 'openai',
    phase: 'native_search_only' | 'local_analysis' | 'execution' = 'local_analysis',
) {
    const allowedSet = new Set(allowedTools);
    const blockedSet = new Set(blockedTools);
    const preferredOrder = new Map(preferredTools.map((name, index) => [name, index]));
    return (toolDefinitions || [])
        .filter((definition) => !blockedSet.has(definition.name))
        .filter((definition) => allowAllTools || allowedSet.has(definition.name))
        .sort((a, b) => {
            const aRank = preferredOrder.has(a.name) ? preferredOrder.get(a.name)! : Number.MAX_SAFE_INTEGER;
            const bRank = preferredOrder.has(b.name) ? preferredOrder.get(b.name)! : Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.name.localeCompare(b.name);
        })
        .map((definition) => ({
            type: 'function',
            function: {
                name: definition.name,
                description: definition.description,
                parameters: definition.parameters,
            },
        }));
}

function resolvePhaseAllowedTools(
    allowedTools: string[],
    skillResolution: ReturnType<typeof resolveNodeSkills>,
    provider: 'openai' | 'grok' | 'deepseek',
    phase: 'native_search_only' | 'local_analysis' | 'execution',
): string[] {
    if (provider === 'grok' && phase === 'native_search_only') {
        return [];
    }
    return allowedTools;
}

function resolvePhaseAllowAllTools(
    skillResolution: ReturnType<typeof resolveNodeSkills>,
    provider: 'openai' | 'grok' | 'deepseek',
    phase: 'native_search_only' | 'local_analysis' | 'execution',
    defaultAllowAllTools: boolean,
): boolean {
    if (provider === 'grok' && phase === 'native_search_only') {
        return false;
    }
    return defaultAllowAllTools;
}

function toAssistantToolCall(call: { id: string; name: string; arguments: Record<string, any> }) {
    return {
        id: call.id,
        type: 'function',
        function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments || {}),
        },
    };
}

function buildProviderNativeEvidenceSnapshot(params: {
    round: number;
    query: string;
    toolCalls: Array<{ name?: string; arguments?: Record<string, any> }>;
    citations: any[];
    finalText: string;
}): ProviderNativeEvidenceSnapshot | null {
    const sourceTypes = Array.from(new Set(
        params.toolCalls
            .map((call) => normalizeProviderNativeSourceType(call.name))
            .filter((item): item is 'x_search' | 'web_search' => Boolean(item)),
    ));
    const retrievedAt = new Date().toISOString();
    const querySummary = extractProviderNativeQuerySummary(params.toolCalls, params.query);
    const results = (params.citations || [])
        .flatMap((item) => Array.isArray(item) ? item : [item])
        .map((item) => normalizeProviderNativeCitation(item, sourceTypes[0] || 'web_search', params.round, retrievedAt))
        .filter(Boolean) as ProviderNativeEvidenceSnapshot['results'];

    if (results.length === 0 && sourceTypes.length > 0 && String(params.finalText || '').trim()) {
        results.push({
            sourceType: sourceTypes[0],
            title: 'Provider-native search summary',
            snippet: String(params.finalText || '').trim().slice(0, 800),
            query: querySummary,
            retrievedAt,
            round: params.round,
        });
    }

    if (sourceTypes.length === 0 || results.length === 0) {
        return null;
    }

    return {
        sourceTypes,
        querySummary,
        results,
        retrievedAt,
        round: params.round,
    };
}

async function recordProviderManagedToolRound(params: {
    broker: ChatStreamBroker;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }>;
    planning: ReturnType<typeof buildTaskPlanningContext>;
    skillResolution: ReturnType<typeof resolveNodeSkills>;
    query: string;
    round: number;
    provider: 'openai' | 'grok' | 'deepseek';
    evidenceSnapshot: ProviderNativeEvidenceSnapshot | null;
}) {
    if (params.provider !== 'grok' || params.toolCalls.length === 0) {
        return;
    }
    for (const call of params.toolCalls) {
        const plannedStep = resolvePlanStepForProviderManagedTool(call.name, params.planning, params.skillResolution, params.query);
        await params.broker.noteToolSelected(call, plannedStep || undefined);
        await params.broker.markPlanStepStarted(call, plannedStep || undefined);
        await params.broker.recordToolResult(
            buildProviderManagedToolResult(call, params.round, params.evidenceSnapshot),
        );
    }
}

function resolvePlanStepForProviderManagedTool(
    toolName: string,
    planning: ReturnType<typeof buildTaskPlanningContext>,
    skillResolution: ReturnType<typeof resolveNodeSkills>,
    query: string,
) {
    if (isProviderManagedNativeTool(toolName, 'grok')) {
        return buildSocialPlanStep(skillResolution, query);
    }
    return resolvePlanStepForTool(toolName, planning, skillResolution, query);
}

function buildProviderManagedToolResult(
    call: { id: string; name: string; arguments: Record<string, any> },
    round: number,
    evidenceSnapshot: ProviderNativeEvidenceSnapshot | null,
): { id: string; name: string; arguments: Record<string, any>; ok: boolean; result: Record<string, any>; metadata: Record<string, any> } {
    const sourceType = normalizeProviderNativeSourceType(call.name);
    const matchingResults = sourceType && evidenceSnapshot
        ? (evidenceSnapshot.results || []).filter((item) => item.sourceType === sourceType)
        : [];
    return {
        id: call.id,
        name: call.name,
        arguments: call.arguments || {},
        ok: true,
        result: {
            source: 'provider_native',
            provider: 'grok',
            round,
            query: extractProviderManagedToolQuery(call.arguments || {}),
            source_type: sourceType || 'provider_native',
            result_count: matchingResults.length,
            preview: matchingResults.slice(0, 3).map((item) => ({
                title: item.title || null,
                url: item.url || null,
            })),
        },
        metadata: {
            source: 'provider_native',
            provider: 'grok',
            round,
        },
    };
}

function extractProviderManagedToolQuery(args: Record<string, any>): string | null {
    for (const key of ['query', 'q', 'search_query', 'keyword']) {
        const value = String(args?.[key] || '').trim();
        if (value) return value;
    }
    return null;
}

function normalizeProviderNativeCitation(
    citation: any,
    sourceType: 'x_search' | 'web_search',
    round: number,
    retrievedAt: string,
) {
    if (!citation) return null;
    if (typeof citation === 'string') {
        return {
            sourceType,
            url: citation,
            retrievedAt,
            round,
        };
    }
    if (typeof citation !== 'object') return null;
    const title = typeof citation.title === 'string' ? citation.title.trim() : '';
    const url = typeof citation.url === 'string' ? citation.url.trim() : '';
    const snippet = typeof citation.snippet === 'string'
        ? citation.snippet.trim()
        : typeof citation.text === 'string'
            ? citation.text.trim()
            : '';
    if (!title && !url && !snippet) return null;
    return {
        sourceType,
        title: title || undefined,
        url: url || undefined,
        snippet: snippet || undefined,
        retrievedAt,
        round,
    };
}

function extractProviderNativeQuerySummary(
    toolCalls: Array<{ name?: string; arguments?: Record<string, any> }>,
    fallbackQuery: string,
): string {
    for (const call of toolCalls) {
        const args = call.arguments || {};
        for (const key of ['query', 'q', 'search_query', 'keyword']) {
            const value = String(args[key] || '').trim();
            if (value) return value;
        }
    }
    return String(fallbackQuery || '').trim();
}

function normalizeProviderNativeSourceType(name: string | undefined): 'x_search' | 'web_search' | null {
    const normalized = String(name || '').trim();
    if (!normalized) return null;
    if (normalized.startsWith('x_') || normalized === 'x_search') return 'x_search';
    if (normalized.startsWith('web_') || normalized === 'browse_page' || normalized === 'open_page') return 'web_search';
    return null;
}

function isLikelyExecutionTool(toolName: string): boolean {
    return ['prepare_', 'create_', 'execute_', 'place_', 'submit_', 'confirm_'].some((prefix) => toolName.startsWith(prefix));
}
