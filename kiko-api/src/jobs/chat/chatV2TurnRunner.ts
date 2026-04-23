// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: mixed
// Why: Chat V2 now starts with thin task-route owner selection, with legacy
// canonical intent left as a compatibility view. The runner must attempt route
// selection first, only fall back to canonical normalization when routing
// fails, and keep the downstream resolver/tool path aligned with the chosen
// owner.
// Debug Goal: every new turn enters orchestration with same-model stage-1 task
// routing already attempted, and long prompts keep one primary owner.
// Search Tags: runner task route before canonical normalization primary owner
// Invariants:
// - worker lifecycle and v2 turn execution remain separate owner layers
// - direct trade confirmation and fast swap remain pre-generation branches
// - explicit swap syntax can short-circuit task-route LLM selection when the
//   request is already structurally complete
// - new turns attempt task route selection before canonical normalization
// - legacy canonical intent is a compatibility bridge, not the routing source
// Failure Modes:
// - explicit swap quotes spend seconds in route selection before deterministic parsing
// - runtime silently restores canonical-first routing
// - greetings or image turns lose their route owner before resolver/tool scope

import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import {
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
import { selectTaskRoute } from './taskRouteSelector.js';
import { tryBuildFastLaneSwapIntent } from './swapFastLane.js';

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
    let snapshot = tryBuildFastLaneSwapIntent(params.snapshot).snapshot;
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

    if (
        preNormalizationTradingIntent?.kind === 'trade_confirmation'
        && snapshot.confirmationState?.kind
        && !isExplicitChainSwitchRequest(snapshot.lastUserMessage, snapshot.normalizedIntent, snapshot.taskRoute || null)
    ) {
        const directFollowup = await executeDirectTradeFollowup({
            snapshot,
            task: params.task,
            userId: params.userId,
            broker: params.broker,
            toolExecutionEngine: params.toolExecutionEngine,
        });
        if (directFollowup.handled) {
            const preOrchestratorTrace = new ChatAiTraceLogger(snapshot, resolveProviderInfo(snapshot.model).provider);
            preOrchestratorTrace.markTerminal('direct_trade_followup');
            preOrchestratorTrace.emit({ finalReason: 'direct_trade_followup' });
            return { terminal: true, terminalOwner: 'worker', snapshot };
        }
    }

    if (!snapshot.taskRoute && !snapshot.taskRouteSelectionState) {
        const routeSelection = await selectTaskRoute({
            snapshot,
            generationClient: params.generationClient,
            shouldCancel: params.shouldCancel,
            onReasoningDelta: pushNormalizationReasoningDebug,
        });
        snapshot = routeSelection.snapshot;
    }

    if (!snapshot.taskRoute && !snapshot.normalizedIntent && !snapshot.normalizationState) {
        const normalization = await normalizeCanonicalIntent({
            snapshot,
            generationClient: params.generationClient,
            shouldCancel: params.shouldCancel,
            onReasoningDelta: pushNormalizationReasoningDebug,
        });
        snapshot = normalization.snapshot;
    }

    if ((snapshot.taskRoute || snapshot.normalizedIntent) && !snapshot.conversationActionState) {
        snapshot = applyConversationActionState(snapshot);
    }

    const finalNormalizationReasoning = String(
        snapshot.taskRouteSelectionState?.reasoningText
        || snapshot.normalizationState?.reasoningText
        || '',
    );
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

    const tradingIntent = (snapshot.taskRoute || snapshot.normalizedIntent)
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

    if (!isExplicitChainSwitchRequest(snapshot.lastUserMessage, snapshot.normalizedIntent, snapshot.taskRoute || null)) {
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

function shouldExposeNormalizationReasoning(): boolean {
    const normalized = String(process.env.CHAT_EXPOSE_NORMALIZATION_REASONING ?? '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'debug'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return true;
}

function buildNormalizationReasoningPreamble(query: string): string {
    const isZh = /[\u3400-\u9fff]/.test(String(query || ''));
    return isZh
        ? '请求分析中:\n'
        : 'Analyzing the request:\n';
}
