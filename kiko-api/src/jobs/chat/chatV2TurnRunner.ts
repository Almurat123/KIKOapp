// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: chat v2 logic had grown directly inside `chatWorker`, which blurred
//         the boundary between task lifecycle ownership and turn-execution
//         ownership. The rewrite plan needs a dedicated owner for the v2 turn
//         pipeline so normalization, lean context routing, direct follow-up
//         execution, and orchestration retries can evolve without reopening
//         worker lifecycle code. Product correction on 2026-04-18 removed the
//         last worker-authored greeting macro and backend clarification macro so
//         user-visible reply text always comes from the main model or
//         tool-authored output. Chat v2 now also needs to distinguish terminal
//         turns whose task lifecycle is already owned by a tool-managed reply
//         channel, such as transcript-native generated-image execution.
//         Product architecture review on 2026-04-19 moved GPT-5.4-class tool
//         selection to the main model by default, so this owner must not create
//         a fake model-plan card before real tool use.
// Goal: keep `chatWorker` focused on task lifecycle, moderation, persistence,
//       and cleanup, while this file owns the chat v2 turn pipeline from
//       normalized turn preparation through generation or direct execution.
//       Default new turns to model-selected task routing instead of calling a
//       separate LLM canonical normalizer before the main model.
// Owns: chat v2 turn normalization, policy/skill resolution handoff,
//       direct-followup execution, orchestration retries, and terminal-owner
//       handoff back to the worker.
// Does Not Own: task claiming, billing persistence, durable message writes,
//               or final worker cleanup.
// Design Language:
// - worker lifecycle and v2 turn execution are separate owner layers
// - direct trade confirmation and fast swap remain pre-generation branches
// - v2 turn execution may mutate runtime snapshot, but worker owns durable task completion
// - stale provider continuation recovery belongs to the v2 turn runner, not the worker shell
// - terminal pre-orchestrator reply paths should still emit a Railway-visible AI trace summary
// - default task selection belongs to the main model via TASK_MENU; backend
//   canonical normalization is an opt-out compatibility path, not the default
// - TASK_MENU selection is one-or-more, not single-intent only
// - user-visible reply text must come from model generation or tool-authored summaries, not worker-authored macros
// - model-led tool mode suppresses pre-orchestration plan cards; real tool
//   status and generated-image placeholders remain visible through their owners
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: extracting the v2 turn runner owner from chatWorker
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: keeping lean prompt/context-read orchestration inside a dedicated v2 runtime layer
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: worker-to-runner ownership split for chat v2
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-ai-trace-logging.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: trace summaries for direct fast-path and pre-orchestrator terminal replies
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: default model-selected task-menu bypass before orchestration
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/Downloads/logs.1776445174160.json
// - Kind: runtime observation
// - Retrieved: 2026-04-18
// - Applied To: removing the bare-greeting direct reply fast path after it produced a worker-authored intro
// - Verification: verified in runtime and then removed in code
// - Source: /Users/almurat/KiKo/system-journal/design-language/chat-direct-response-policy.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: forbidding worker-authored greeting and clarification reply text in the chat runtime
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: terminalOwner handoff for externally managed generated-image replies
// - Verification: verified in code
// - Source: operator architecture review on 2026-04-19
// - Kind: product instruction
// - Retrieved: 2026-04-19
// - Applied To: suppressing fake pre-tool plan cards in model-led mode
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-ai-trace-logging.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-hardcoded-reply-path-removal.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import type { CanonicalIntentNormalizationState } from './canonicalIntent.js';
import {
    buildNonChainNormalizationBypass,
    isDeterministicNormalizationBypassState,
    normalizeCanonicalIntent,
} from './canonicalIntentNormalizer.js';
import { buildControlPolicySnapshot } from './controlPolicy.js';
import type { ChatContextSnapshot } from './contracts.js';
import { maybeExecuteFastSwap } from './fastSwapCoordinator.js';
import { runNodeOrchestration } from './nodeOrchestrator.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import type { PythonGenerationClient } from './pythonGenerationClient.js';
import { applyConversationActionState } from './conversationStateResolver.js';
import { resolveRuntimeDirectives } from './runtimeDirectiveResolver.js';
import { ChatStreamBroker } from './streamBroker.js';
import { buildTaskPlanningContext, materializePlanCard } from './taskPlanner.js';
import { executeDirectTradeFollowup } from './tradeFollowupExecutor.js';
import { parseTradingIntent } from './tradingIntentResolver.js';
import { ToolExecutionEngine } from './toolExecutionEngine.js';
import { isExplicitChainSwitchRequest } from './chainIntent.js';
import { ChatAiTraceLogger } from './chatAiTraceLogger.js';
import { resolveProviderInfo } from './providerPolicyBuilder.js';
import { isModelLedToolOrchestrationEnabled } from './modelLedToolOrchestration.js';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export type ChatV2TurnRunnerResult = {
    terminal: boolean;
    terminalOwner?: 'worker' | 'external';
    snapshot: ChatContextSnapshot;
};

export async function runChatV2Turn(params: {
    snapshot: ChatContextSnapshot;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
    generationClient: PythonGenerationClient;
    toolExecutionEngine: ToolExecutionEngine;
    toolContext?: Record<string, any>;
    shouldCancel?: () => Promise<boolean>;
    onToolStatus?: (toolName: string) => Promise<void> | void;
    updateSessionConversationState?: (state: Record<string, any>) => Promise<void>;
    shouldRecoverFromStalePreviousResponse?: (
        error: unknown,
        model: string,
        previousResponseId: string | null | undefined,
    ) => boolean;
    isSuspiciousProviderResponseId?: (value: string) => boolean;
}): Promise<ChatV2TurnRunnerResult> {
    let snapshot = params.snapshot;
    const exposeNormalizationReasoning = shouldExposeNormalizationReasoning();
    let normalizationReasoningStarted = false;
    let streamedNormalizationReasoningLength = 0;
    const preNormalizationTradingIntent = parseTradingIntent(snapshot.lastUserMessage, snapshot, null);

    const pushNormalizationReasoningDebug = async (text: string) => {
        if (!exposeNormalizationReasoning || !text) return;
        if (!normalizationReasoningStarted) {
            normalizationReasoningStarted = true;
            await params.broker.pushReasoning(buildNormalizationReasoningPreamble(snapshot.lastUserMessage));
        }
        streamedNormalizationReasoningLength += text.length;
        await params.broker.pushReasoning(text);
    };

    if (!snapshot.normalizedIntent && !snapshot.normalizationState) {
        if (shouldUseModelSelectedTaskMenu()) {
            snapshot = applyConversationActionState(buildModelSelectedTaskMenuBypass(snapshot));
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatV2TurnRunner: skipped canonical normalization for model-selected task menu', {
                taskId: params.task.id,
                sessionId: params.task.sessionId,
                model: params.task.model,
                bypassKind: snapshot.normalizationState?.bypassKind,
            });
        } else {
            const deterministicBypass = buildNonChainNormalizationBypass(snapshot, preNormalizationTradingIntent);
            if (deterministicBypass) {
                logger.info(LogCode.AI_ORCHESTRATOR, 'ChatV2TurnRunner: skipped canonical normalization for deterministic non-chain turn', {
                    taskId: params.task.id,
                    sessionId: params.task.sessionId,
                    bypassKind: deterministicBypass.state.bypassKind,
                    model: params.task.model,
                });
                snapshot = applyConversationActionState(deterministicBypass.snapshot);
            } else {
                const normalization = await normalizeCanonicalIntent({
                    snapshot,
                    generationClient: params.generationClient,
                    shouldCancel: params.shouldCancel,
                    onReasoningDelta: pushNormalizationReasoningDebug,
                });
                snapshot = applyConversationActionState(normalization.snapshot);
            }
        }
    }

    if (snapshot.normalizedIntent && !snapshot.conversationActionState) {
        snapshot = applyConversationActionState(snapshot);
    }

    const finalNormalizationReasoning = String(snapshot.normalizationState?.reasoningText || '');
    if (exposeNormalizationReasoning && finalNormalizationReasoning.length > streamedNormalizationReasoningLength) {
        if (!normalizationReasoningStarted) {
            normalizationReasoningStarted = true;
            await params.broker.pushReasoning(buildNormalizationReasoningPreamble(snapshot.lastUserMessage));
        }
        await params.broker.pushReasoning(finalNormalizationReasoning.slice(streamedNormalizationReasoningLength));
    }

    snapshot.runtime.systemDirectives = resolveRuntimeDirectives({
        task: params.task,
        lastUserMessage: snapshot.lastUserMessage,
        confirmationState: snapshot.confirmationState,
    });

    const tradingIntent = snapshot.normalizedIntent
        ? parseTradingIntent(snapshot.lastUserMessage, snapshot, snapshot.normalizedIntent)
        : preNormalizationTradingIntent;
    const skillResolution = resolveNodeSkills(snapshot, tradingIntent, snapshot.normalizedIntent);
    snapshot.runtime.contextContract = skillResolution.contextContract;
    snapshot.policySnapshot = buildControlPolicySnapshot({
        snapshot,
        tradingIntent,
        skillResolution,
    });
    const preOrchestratorTrace = new ChatAiTraceLogger(snapshot, resolveProviderInfo(snapshot.model).provider);
    preOrchestratorTrace.recordSkillResolution(skillResolution);
    if (!isModelLedToolOrchestrationEnabled()) {
        await params.broker.applyModelPlan(materializePlanCard(buildTaskPlanningContext(snapshot, skillResolution)));
    }

    if (!isExplicitChainSwitchRequest(snapshot.lastUserMessage, snapshot.normalizedIntent)) {
        const directFollowup = await executeDirectTradeFollowup({
            snapshot,
            task: params.task,
            userId: params.userId,
            broker: params.broker,
            toolExecutionEngine: params.toolExecutionEngine,
        });
        if (directFollowup.handled) {
            preOrchestratorTrace.markTerminal('direct_trade_followup');
            preOrchestratorTrace.emit({ finalReason: 'direct_trade_followup' });
            return { terminal: true, terminalOwner: 'worker', snapshot };
        }
    }

    const fastSwapResult = await maybeExecuteFastSwap({
        snapshot,
        task: params.task,
        userId: params.userId,
        broker: params.broker,
    });
    if (fastSwapResult.handled) {
        preOrchestratorTrace.markTerminal('fast_swap_coordinator');
        preOrchestratorTrace.emit({ finalReason: 'fast_swap_coordinator' });
        return { terminal: true, terminalOwner: 'worker', snapshot };
    }

    let orchestrationRetried = false;
    while (true) {
        try {
            const orchestrationResult = await runNodeOrchestration({
                snapshot,
                generationClient: params.generationClient,
                toolExecutionEngine: params.toolExecutionEngine,
                broker: params.broker,
                toolContext: {
                    ...(params.toolContext || {}),
                    prefetchedToolResults: snapshot.runtime.prefetchedToolResults || {},
                    recentToolTrace: snapshot.recentToolTrace,
                    __controlPolicy: snapshot.policySnapshot,
                    __snapshot: snapshot,
                },
                shouldCancel: params.shouldCancel,
                onProviderState: async (state) => {
                    if (!state.previousResponseId || !params.updateSessionConversationState) {
                        return;
                    }
                    if (params.isSuspiciousProviderResponseId?.(state.previousResponseId)) {
                        logger.warn(LogCode.AI_ORCHESTRATOR, 'ChatV2TurnRunner: skip suspicious provider response id', {
                            taskId: params.task.id,
                            sessionId: params.task.sessionId,
                            previousResponseId: state.previousResponseId,
                        });
                        return;
                    }
                    await params.updateSessionConversationState({
                        lastResponseId: state.previousResponseId,
                    });
                },
                onToolStatus: params.onToolStatus,
            });
            if (orchestrationResult.terminal) {
                return {
                    terminal: true,
                    terminalOwner: orchestrationResult.terminalOwner || 'worker',
                    snapshot,
                };
            }
            break;
        } catch (orchestrationError: any) {
            const shouldRetry = params.shouldRecoverFromStalePreviousResponse?.(
                orchestrationError,
                snapshot.model,
                snapshot.previousResponseId,
            ) ?? false;
            if (
                !orchestrationRetried
                && params.broker.getContent().trim().length === 0
                && params.broker.getToolResults().length === 0
                && shouldRetry
            ) {
                orchestrationRetried = true;
                logger.warn(LogCode.AI_ORCHESTRATOR, 'ChatV2TurnRunner: stale previous_response_id detected, retrying without it', {
                    taskId: params.task.id,
                    sessionId: params.task.sessionId,
                    previousResponseId: snapshot.previousResponseId,
                });
                snapshot.previousResponseId = null;
                await params.updateSessionConversationState?.({ lastResponseId: null });
                continue;
            }
            throw orchestrationError;
        }
    }

    return { terminal: false, terminalOwner: 'worker', snapshot };
}
function readBooleanFlag(value: unknown): boolean | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return null;
    if (TRUE_VALUES.has(normalized)) return true;
    if (FALSE_VALUES.has(normalized)) return false;
    return null;
}

function shouldExposeNormalizationReasoning(): boolean {
    const override = readBooleanFlag(process.env.CHAT_EXPOSE_NORMALIZATION_REASONING);
    if (override !== null) return override;
    return true;
}

function shouldUseModelSelectedTaskMenu(): boolean {
    const override = readBooleanFlag(process.env.CHAT_V2_MODEL_SELECTED_TASK_MENU);
    if (override !== null) return override;
    return true;
}

function buildModelSelectedTaskMenuBypass(snapshot: ChatContextSnapshot): ChatContextSnapshot {
    const state: CanonicalIntentNormalizationState = {
        status: 'ok',
        source: 'deterministic',
        bypassKind: 'model_selected_task_menu',
        rawText: JSON.stringify({
            fast_path: 'model_selected_task_menu',
            task_selection_owner: 'model',
            task_selection_cardinality: 'one_or_more',
        }),
    };
    return {
        ...snapshot,
        normalizedIntent: null,
        normalizationState: state,
    };
}

function buildNormalizationReasoningPreamble(query: string): string {
    const isZh = /[\u3400-\u9fff]/.test(String(query || ''));
    return isZh
        ? '请求分析中:\n'
        : 'Analyzing the request:\n';
}
