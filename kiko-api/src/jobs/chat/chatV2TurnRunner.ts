// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: chat v2 logic had grown directly inside `chatWorker`, which blurred
//         the boundary between task lifecycle ownership and turn-execution
//         ownership. The rewrite plan needs a dedicated owner for the v2 turn
//         pipeline so normalization, lean context routing, direct follow-up
//         execution, fast greeting bypass, and orchestration retries can evolve
//         without reopening worker lifecycle code.
// Goal: keep `chatWorker` focused on task lifecycle, moderation, persistence,
//       and cleanup, while this file owns the chat v2 turn pipeline from
//       normalized turn preparation through generation or direct execution.
//       Default new turns to model-selected task routing instead of calling a
//       separate LLM canonical normalizer before the main model.
// Owns: chat v2 turn normalization, policy/skill resolution handoff,
//       direct-followup execution, fast greeting shortcut, and orchestration retries.
// Does Not Own: task claiming, billing persistence, durable message writes,
//               or final worker cleanup.
// Design Language:
// - worker lifecycle and v2 turn execution are separate owner layers
// - only bare greetings may use deterministic direct-response copy
// - direct trade confirmation and fast swap remain pre-generation branches
// - v2 turn execution may mutate runtime snapshot, but worker owns durable task completion
// - stale provider continuation recovery belongs to the v2 turn runner, not the worker shell
// - terminal pre-orchestrator reply paths should still emit a Railway-visible AI trace summary
// - default task selection belongs to the main model via TASK_MENU; backend
//   canonical normalization is an opt-out compatibility path, not the default
// - TASK_MENU selection is one-or-more, not single-intent only
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
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-ai-trace-logging.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { LogCode } from '../../config/logRegistry.js';
import { logChatStreamDebug } from '../../services/chatStreamDebug.js';
import { logger } from '../../utils/logger.js';
import { buildCanonicalIntentClarification, type CanonicalIntentNormalizationState } from './canonicalIntent.js';
import {
    buildNonChainNormalizationBypass,
    isDeterministicNormalizationBypassState,
    normalizeCanonicalIntent,
} from './canonicalIntentNormalizer.js';
import { buildControlPolicySnapshot } from './controlPolicy.js';
import type { ChatContextSnapshot } from './contracts.js';
import { maybeExecuteFastSwap } from './fastSwapCoordinator.js';
import { runNodeOrchestration } from './nodeOrchestrator.js';
import { resolveNodeSkills, type SkillResolution } from './nodeSkillResolver.js';
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

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const BARE_DIRECT_GREETING_RE = /^\s*(?:hi|hello|hey|yo|gm|gn|good\s+(?:morning|afternoon|evening)|你好|您好|嗨|哈喽)\s*[?？!！.。,，]*\s*$/i;

export type ChatV2TurnRunnerResult = {
    terminal: boolean;
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

    if (!snapshot.normalizedIntent && !isDeterministicNormalizationBypassState(snapshot.normalizationState)) {
        await params.broker.pushText(buildCanonicalIntentClarification({
            snapshot,
            reasonCode: snapshot.normalizationState?.reasonCode,
        }));
        return { terminal: true, snapshot };
    }

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

    const fastDirectAssistantResponse = buildFastDirectAssistantResponse(snapshot, skillResolution);
    if (!fastDirectAssistantResponse) {
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
            return { terminal: true, snapshot };
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
        return { terminal: true, snapshot };
    }

    if (fastDirectAssistantResponse) {
        logger.info(LogCode.AI_ORCHESTRATOR, 'ChatV2TurnRunner: direct assistant intro fast path', {
            taskId: params.task.id,
            sessionId: params.task.sessionId,
            model: params.task.model,
        });
        await streamDirectAssistantFastPathResponse(params.broker, fastDirectAssistantResponse, {
            taskId: params.task.id,
            sessionId: params.task.sessionId,
            assistantMessageId: params.task.assistantMessageId!,
            model: params.task.model,
        });
        preOrchestratorTrace.markTerminal('direct_greeting_fast_path');
        preOrchestratorTrace.emit({ finalReason: 'direct_greeting_fast_path' });
        return { terminal: false, snapshot };
    }

    let orchestrationRetried = false;
    while (true) {
        try {
            await runNodeOrchestration({
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

    return { terminal: false, snapshot };
}

export function buildFastDirectAssistantResponse(
    snapshot: { lastUserMessage?: string; normalizedIntent?: any },
    skillResolution: SkillResolution,
): string | null {
    if (!skillResolution.querySignals.welcome) return null;
    const normalizedIntent = snapshot.normalizedIntent;
    if (normalizedIntent?.requiresRealtime || normalizedIntent?.requiresOnchainEvidence || normalizedIntent?.executionCandidate) {
        return null;
    }

    const query = String(snapshot.lastUserMessage || '').trim();
    if (!BARE_DIRECT_GREETING_RE.test(query)) return null;
    if (/\b0x[a-fA-F0-9]{40}\b/.test(query)) return null;
    if (/\b(pnl|balance|portfolio|wallet|token|swap|buy|sell|trade|copy\s*trade|risk|price|chart)\b/i.test(query)) {
        return null;
    }
    if (/钱包|余额|收益|盈利|代币|买|卖|换币|交易|跟单|风险|价格|图表/.test(query)) {
        return null;
    }

    const isZh = /[\u3400-\u9fff]/.test(query);
    if (isZh) {
        return '我是 KiKo，你的链上交易 Agent。可以查钱包 PnL、分析代币和风险、看市场线索，也能在连接钱包后帮你换币或配置跟单。发钱包、代币或交易问题就行。';
    }

    return "Hi, I'm KiKo, your on-chain trading agent. I can check wallet PnL, analyze tokens and risk, find market context, and help with swaps or copy-trade setup when your wallet is connected. Send a wallet, token, or trade question.";
}

async function streamDirectAssistantFastPathResponse(
    broker: ChatStreamBroker,
    text: string,
    context: {
        taskId: string;
        sessionId: string;
        assistantMessageId: string;
        model: string;
    },
) {
    const chunks = splitFastPathResponseIntoChunks(text);
    const delayMs = Math.max(0, Math.min(120, parseInt(process.env.CHAT_FAST_PATH_CHUNK_DELAY_MS || '55', 10) || 55));
    logChatStreamDebug(LogCode.AI_ORCHESTRATOR, 'ChatV2TurnRunner: direct fast-path streaming started', {
        ...context,
        chunkCount: chunks.length,
        totalLength: text.length,
        delayMs,
    });
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        await broker.pushText(chunk);
        logChatStreamDebug(LogCode.AI_ORCHESTRATOR, 'ChatV2TurnRunner: direct fast-path chunk pushed', {
            ...context,
            chunkIndex: index + 1,
            chunkCount: chunks.length,
            deltaLength: chunk.length,
        });
        if (delayMs > 0 && index < chunks.length - 1) {
            await wait(delayMs);
        }
    }
}

function splitFastPathResponseIntoChunks(text: string): string[] {
    const value = String(text || '');
    if (!value) return [];
    const targetLength = Math.max(8, Math.min(32, parseInt(process.env.CHAT_FAST_PATH_CHUNK_SIZE || '14', 10) || 14));
    const pieces = /\s/.test(value)
        ? (value.match(/\S+\s*/g) || [value])
        : Array.from(value);
    const chunks: string[] = [];
    let current = '';
    for (const piece of pieces) {
        current += piece;
        if (current.length >= targetLength) {
            chunks.push(current);
            current = '';
        }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [value];
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

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
