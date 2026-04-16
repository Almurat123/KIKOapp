// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: Chat worker traces showed a simple "Hi, who are you?" turn still paid
//         for hidden GLM canonical normalization and then a full GLM main
//         generation, producing ~1 minute of latency before completion. A later
//         streaming test showed that the direct fast path then became a single
//         broker chunk, so the answer was fast but visually non-streaming. A
//         follow-up runtime review also showed that hidden normalization
//         reasoning left users staring at an idle UI even when the provider was
//         actively thinking. Another runtime review then showed obvious
//         non-chain turns still entering the canonical-intent JSON router,
//         which turned simple off-topic questions into long hidden reasoning.
// Goal: keep the full agent loop for real work, but let deterministic
//       assistant-introduction and greeting turns complete without invoking a
//       slow provider model, while surfacing normalization reasoning through the
//       normal assistant reasoning area so users get live runtime feedback, and
//       let obvious non-chain turns bypass canonical normalization entirely.
// Owns: worker-level task lifecycle, moderation gates, direct fast-lane
//       completion decisions, and orchestration handoff.
// Does Not Own: provider streaming transport, frontend chunk animation, or skill prompt content.
// Design Language:
// - direct assistant-intro turns should finish through the same broker/completion lifecycle
// - deterministic fast-path text should still be chunked so frontend streaming can be verified
// - slow provider models must not be called when the answer is deterministic product copy
// - billing and output moderation still run through the normal worker terminal path
// - normalization reasoning should stream into the same reasoning surface as the
//   assistant when available, with a short label that makes the phase obvious
// - obvious non-chain turns must bypass canonical normalization before any JSON routing prompt is built
// Document Provenance:
// - Source: local runtime log trace 5be7a239-eda6-4ef7-a8ea-7fb4b1160de3
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: bypassing NVIDIA GLM main generation for welcome/capabilities turns
// - Verification: verified in runtime log, applied in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: chunking direct fast-path output and adding stream diagnostics
// - Verification: verified in runtime log
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: exposing hidden normalization reasoning as user-visible runtime feedback
// - Verification: verified in code against runtime evidence
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: bypassing canonical normalization for obvious non-chain turns
// - Verification: verified in runtime and applied in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-direct-welcome-fast-path.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-normalization-reasoning-runtime-surface.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-direct-answer-tool-pruning.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-non-chain-normalization-bypass.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import * as chatRepo from '../repositories/chatRepository.js';
import { chatWS } from '../services/chatWebSocket.js';
import { moderationClient } from '../services/moderationClient.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { processClaimedTasks } from './chat/taskClaimRunner.js';
import { toolRegistry } from '../tooling/registry.js';
import { ensureToolRegistryInitialized } from '../tooling/bootstrap.js';
import { assembleChatContext } from './chat/contextAssembler.js';
import { ToolExecutionEngine } from './chat/toolExecutionEngine.js';
import { ChatStreamBroker } from './chat/streamBroker.js';
import { getToolStatusMessage, persistBillingUsage } from './chat/legacyCompat.js';
import { executeDirectTradeFollowup } from './chat/tradeFollowupExecutor.js';
import { maybeExecuteFastSwap } from './chat/fastSwapCoordinator.js';
import cacheClient from '../cache/cacheClient.js';
import { PythonGenerationClient } from './chat/pythonGenerationClient.js';
import { runNodeOrchestration } from './chat/nodeOrchestrator.js';
import { parseTradingIntent } from './chat/tradingIntentResolver.js';
import { resolveNodeSkills, type SkillResolution } from './chat/nodeSkillResolver.js';
import { buildTaskPlanningContext, buildWarmupPlan, materializePlanCard } from './chat/taskPlanner.js';
import { buildControlPolicySnapshot } from './chat/controlPolicy.js';
import {
    buildNonChainNormalizationBypass,
    isDeterministicNormalizationBypassState,
    normalizeCanonicalIntent,
} from './chat/canonicalIntentNormalizer.js';
import { buildCanonicalIntentClarification } from './chat/canonicalIntent.js';
import { applyConversationActionState } from './chat/conversationStateResolver.js';
import { resolveRuntimeDirectives } from './chat/runtimeDirectiveResolver.js';
import { enrichRequestedAddressClassifications } from './chat/addressEntityClassifier.js';
import { getWalletBalance } from '../services/alchemy.js';
import { walletService } from '../services/walletService.js';
import { ethers } from 'ethers';
import { isExplicitChainSwitchRequest } from './chat/chainIntent.js';
import { logChatStreamDebug } from '../services/chatStreamDebug.js';

type AITask = Awaited<ReturnType<typeof chatRepo.getTask>>;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export function isEmptyAssistantCompletion(
    content: string,
): boolean {
    return String(content || '').trim().length === 0;
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

function buildNormalizationReasoningPreamble(query: string): string {
    const isZh = /[\u3400-\u9fff]/.test(String(query || ''));
    return isZh
        ? '请求分析中:\n'
        : 'Analyzing the request:\n';
}

export class ChatWorker {
    private readonly repo = chatRepo;
    private readonly ws = chatWS;
    private readonly runningTasks = new Set<string>();
    private readonly maxConcurrentTasks = Math.max(1, parseInt(process.env.CHAT_WORKER_MAX_CONCURRENCY || '24', 10) || 24);
    private readonly generationClient = new PythonGenerationClient();
    private readonly toolExecutionEngine = new ToolExecutionEngine();
    private isRunning = false;
    private pollInterval: NodeJS.Timeout | null = null;

    start(intervalMs = Math.max(100, parseInt(process.env.CHAT_WORKER_POLL_MS || '250', 10) || 250)) {
        if (this.isRunning) return;
        this.isRunning = true;
        logger.info(LogCode.SYS_INFO, 'ChatWorker started polling', { intervalMs });

        const runLoop = async () => {
            if (!this.isRunning) return;
            try {
                await this.processQueuedTasks();
            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'ChatWorker run loop failed', {
                    error: error?.message || String(error),
                });
            }
            if (this.isRunning) {
                this.pollInterval = setTimeout(runLoop, intervalMs);
            }
        };

        runLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.pollInterval) {
            clearTimeout(this.pollInterval);
            this.pollInterval = null;
        }
        logger.info(LogCode.SYS_INFO, 'ChatWorker stopped');
    }

    async wake() {
        if (!this.isRunning) return;
        await this.processQueuedTasks();
    }

    private async processQueuedTasks() {
        await processClaimedTasks({
            repo: this.repo,
            runningTasks: this.runningTasks,
            maxConcurrentTasks: this.maxConcurrentTasks,
            claimLimit: 5,
            runTask: async (task) => this.runTask(task as NonNullable<AITask>),
        });
    }

    private async runTask(task: NonNullable<AITask>) {
        let userId: string | null = null;
        let broker: ChatStreamBroker | null = null;
        try {
            ensureToolRegistryInitialized();
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: starting task', {
                taskId: task.id,
                sessionId: task.sessionId,
                model: task.model,
            });
            const sessionPromise = this.repo.getSession(task.sessionId);
            const messagesPromise = this.repo.getSessionMessages(task.sessionId);
            const session = await sessionPromise;
            userId = session?.userId || null;

            if (!userId) {
                throw new Error('Missing session user');
            }

            broker = new ChatStreamBroker({
                userId,
                sessionId: task.sessionId,
                taskId: task.id,
                assistantMessageId: task.assistantMessageId!,
                model: task.model,
            });
            broker.start();
            const messages = await messagesPromise;
            const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
            await broker.bootstrapRuntime(buildWarmupPlan(lastUserMessage));
            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'running', message: 'Loading wallet and context' });

            const hydrationStartedAt = Date.now();
            await this.hydrateWalletSnapshotIfNeeded(task, messages);
            const hydrationMs = Date.now() - hydrationStartedAt;

            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'running', message: 'Analyzing query' });
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: task context loaded', {
                taskId: task.id,
                sessionId: task.sessionId,
                messageCount: messages.length,
                assistantMessageId: task.assistantMessageId,
                hydrationMs,
            });

            const moderation = await moderationClient.moderateInput(lastUserMessage, {}, userId, task.sessionId, task.model);
            if (!moderation.safe) {
                throw new Error(moderation.checks?.intent?.reason || 'Message blocked by moderation');
            }

            let snapshot = assembleChatContext({
                task,
                session,
                messages,
                toolDefinitions: toolRegistry.getAllDefinitions(),
                userId,
            });
            snapshot = await enrichRequestedAddressClassifications(snapshot);
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: snapshot assembled', {
                taskId: task.id,
                sessionId: task.sessionId,
                historyCount: snapshot.history.length,
                directiveCount: snapshot.runtime.systemDirectives?.length || 0,
                prefetchedKeys: Object.keys(snapshot.runtime.prefetchedToolResults || {}),
                requestedSymbols: snapshot.requestedTokenSymbols,
                requestedAddresses: snapshot.requestedTokenAddresses.length,
                requestedAddressClassifications: snapshot.requestedAddressClassifications,
            });
            const exposeNormalizationReasoning = shouldExposeNormalizationReasoning();
            let normalizationReasoningStarted = false;
            let streamedNormalizationReasoningLength = 0;
            const preNormalizationTradingIntent = parseTradingIntent(snapshot.lastUserMessage, snapshot, null);
            const pushNormalizationReasoningDebug = async (text: string) => {
                if (!broker || !exposeNormalizationReasoning || !text) return;
                if (!normalizationReasoningStarted) {
                    normalizationReasoningStarted = true;
                    await broker.pushReasoning(buildNormalizationReasoningPreamble(snapshot.lastUserMessage));
                }
                streamedNormalizationReasoningLength += text.length;
                await broker.pushReasoning(text);
            };
            const deterministicBypass = buildNonChainNormalizationBypass(snapshot, preNormalizationTradingIntent);
            if (deterministicBypass) {
                logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: skipped canonical normalization for deterministic non-chain turn', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    bypassKind: deterministicBypass.state.bypassKind,
                    model: task.model,
                });
                snapshot = applyConversationActionState(deterministicBypass.snapshot);
            } else {
                const normalization = await normalizeCanonicalIntent({
                    snapshot,
                    generationClient: this.generationClient,
                    shouldCancel: async () => this.checkTaskCancelled(task.id),
                    onReasoningDelta: pushNormalizationReasoningDebug,
                });
                snapshot = applyConversationActionState(normalization.snapshot);
            }
            const finalNormalizationReasoning = String(snapshot.normalizationState?.reasoningText || '');
            if (exposeNormalizationReasoning && finalNormalizationReasoning.length > streamedNormalizationReasoningLength) {
                if (!normalizationReasoningStarted) {
                    normalizationReasoningStarted = true;
                    await broker.pushReasoning(buildNormalizationReasoningPreamble(snapshot.lastUserMessage));
                }
                await broker.pushReasoning(finalNormalizationReasoning.slice(streamedNormalizationReasoningLength));
            }
            snapshot.runtime.systemDirectives = resolveRuntimeDirectives({
                task,
                lastUserMessage: snapshot.lastUserMessage,
                confirmationState: snapshot.confirmationState,
            });
            if (!snapshot.normalizedIntent && !isDeterministicNormalizationBypassState(snapshot.normalizationState)) {
                await broker.pushText(buildCanonicalIntentClarification({
                    snapshot,
                    reasonCode: snapshot.normalizationState?.reasonCode,
                }));
                await persistBillingUsage({
                    assistantMessageId: task.assistantMessageId!,
                    userId,
                    model: task.model,
                    usage: broker.getUsage(),
                    toolContext: task.toolContext,
                    toolCallNames: broker.getToolResults().map((item) => item.name),
                });
                await this.repo.updateTaskStatus(task.id, 'done');
                this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'done' });
                return;
            }
            const tradingIntent = snapshot.normalizedIntent
                ? parseTradingIntent(snapshot.lastUserMessage, snapshot, snapshot.normalizedIntent)
                : preNormalizationTradingIntent;
            const skillResolution = resolveNodeSkills(snapshot, tradingIntent, snapshot.normalizedIntent);
            snapshot.policySnapshot = buildControlPolicySnapshot({
                snapshot,
                tradingIntent,
                skillResolution,
            });
            const fastDirectAssistantResponse = buildFastDirectAssistantResponse(snapshot, skillResolution);
            if (!fastDirectAssistantResponse) {
                await broker.applyModelPlan(materializePlanCard(buildTaskPlanningContext(snapshot, skillResolution)));
            }

            if (!isExplicitChainSwitchRequest(lastUserMessage, snapshot.normalizedIntent)) {
                const directFollowup = await executeDirectTradeFollowup({
                    snapshot,
                    task,
                    userId,
                    broker,
                    toolExecutionEngine: this.toolExecutionEngine,
                });
                if (directFollowup.handled) {
                    await persistBillingUsage({
                        assistantMessageId: task.assistantMessageId!,
                        userId,
                        model: task.model,
                        usage: broker.getUsage(),
                        toolContext: task.toolContext,
                        toolCallNames: broker.getToolResults().map((item) => item.name),
                    });
                    await this.repo.updateTaskStatus(task.id, 'done');
                    this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'done' });
                    return;
                }
            }

            const fastSwapResult = await maybeExecuteFastSwap({
                snapshot,
                task,
                userId,
                broker,
            });
            if (fastSwapResult.handled) {
                await persistBillingUsage({
                    assistantMessageId: task.assistantMessageId!,
                    userId,
                    model: task.model,
                    usage: broker.getUsage(),
                    toolContext: task.toolContext,
                    toolCallNames: broker.getToolResults().map((item) => item.name),
                });
                await this.repo.updateTaskStatus(task.id, 'done');
                this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'done' });
                return;
            }

            if (fastDirectAssistantResponse) {
                logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: direct assistant intro fast path', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    model: task.model,
                });
                await streamDirectAssistantFastPathResponse(broker, fastDirectAssistantResponse, {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    assistantMessageId: task.assistantMessageId!,
                    model: task.model,
                });
            } else {
                let orchestrationRetried = false;
                while (true) {
                    try {
                        await runNodeOrchestration({
                            snapshot,
                            generationClient: this.generationClient,
                            toolExecutionEngine: this.toolExecutionEngine,
                            broker,
                            toolContext: {
                                ...(task.toolContext || {}),
                                prefetchedToolResults: snapshot.runtime.prefetchedToolResults || {},
                                recentToolTrace: snapshot.recentToolTrace,
                                __controlPolicy: snapshot.policySnapshot,
                                __snapshot: snapshot,
                            },
                            shouldCancel: async () => this.checkTaskCancelled(task.id),
                            onProviderState: async (state) => {
                                if (state.previousResponseId) {
                                    if (this.isSuspiciousProviderResponseId(state.previousResponseId)) {
                                        logger.warn(LogCode.AI_ORCHESTRATOR, 'ChatWorker: skip suspicious provider response id', {
                                            taskId: task.id,
                                            sessionId: task.sessionId,
                                            previousResponseId: state.previousResponseId,
                                        });
                                        return;
                                    }
                                    await this.repo.updateSessionConversationState(task.sessionId, {
                                        lastResponseId: state.previousResponseId,
                                    });
                                }
                            },
                            onToolStatus: async (toolName) => {
                                this.broadcastTaskStatus(userId, task, {
                                    taskId: task.id,
                                    status: 'running',
                                    message: getToolStatusMessage(toolName),
                                });
                            },
                        });
                        break;
                    } catch (orchestrationError: any) {
                        if (
                            !orchestrationRetried
                            && broker.getContent().trim().length === 0
                            && broker.getToolResults().length === 0
                            && this.shouldRecoverFromStalePreviousResponse(orchestrationError, snapshot.model, snapshot.previousResponseId)
                        ) {
                            orchestrationRetried = true;
                            logger.warn(LogCode.AI_ORCHESTRATOR, 'ChatWorker: stale previous_response_id detected, retrying without it', {
                                taskId: task.id,
                                sessionId: task.sessionId,
                                previousResponseId: snapshot.previousResponseId,
                            });
                            snapshot.previousResponseId = null;
                            await this.repo.updateSessionConversationState(task.sessionId, { lastResponseId: null });
                            continue;
                        }
                        throw orchestrationError;
                    }
                }
            }
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: generation loop finished', {
                taskId: task.id,
                sessionId: task.sessionId,
                contentLength: broker.getContent().length,
                toolCalls: broker.getToolResults().map((item) => item.name),
            });

            if (isEmptyAssistantCompletion(broker.getContent())) {
                const error = new Error('I could not produce a stable response for that turn. Please retry.');
                (error as any).code = 'EMPTY_ASSISTANT_RESPONSE';
                throw error;
            }

            const moderated = await moderationClient.moderateOutput(broker.getContent(), userId, task.sessionId, task.model);
            if (moderated.safe === false) {
                const moderationMessage = sanitizeUserFacingError(buildOutputModerationErrorMessage(moderated));
                await broker.blockContent(moderationMessage, { clearReasoning: true });
                const error = new Error(buildOutputModerationErrorMessage(moderated));
                (error as any).code = 'OUTPUT_MODERATION_BLOCK';
                throw error;
            }
            const finalContent = moderated.filtered_text || broker.getContent();
            if (isEmptyAssistantCompletion(finalContent)) {
                const error = new Error('I could not produce a stable response for that turn. Please retry.');
                (error as any).code = 'EMPTY_ASSISTANT_RESPONSE';
                throw error;
            }
            await broker.complete({ content: finalContent });
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: broker completion broadcast finished', {
                taskId: task.id,
                sessionId: task.sessionId,
                assistantMessageId: task.assistantMessageId,
            });
            await persistBillingUsage({
                assistantMessageId: task.assistantMessageId!,
                userId,
                model: task.model,
                usage: broker.getUsage(),
                toolContext: task.toolContext,
                toolCallNames: broker.getToolResults().map((item) => item.name),
            });
            await this.repo.updateTaskStatus(task.id, 'done');
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: task marked done', {
                taskId: task.id,
                sessionId: task.sessionId,
                assistantMessageId: task.assistantMessageId,
            });
            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'done' });
        } catch (error: any) {
            const message = error?.message || String(error);
            const userFacingError = sanitizeUserFacingError(message);
            const isCancelled = message === 'Task cancelled' || message === 'Task cancelled by user';
            logger.error(LogCode.SYS_ERROR, 'ChatWorker task failed', {
                taskId: task.id,
                sessionId: task.sessionId,
                error: message,
            });
            if (isCancelled) {
                logger.warn(LogCode.AI_ORCHESTRATOR, 'ChatWorker: task cancelled', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    assistantMessageId: task.assistantMessageId,
                });
                if (task.assistantMessageId) {
                    await this.repo.updateMessage(task.assistantMessageId, { status: 'complete' });
                }
                await this.repo.updateTaskStatus(task.id, 'cancelled');
                this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'cancelled', error: userFacingError });
                return;
            }
            if (task.assistantMessageId) {
                const failureBroker = broker || new ChatStreamBroker({
                    userId,
                    sessionId: task.sessionId,
                    taskId: task.id,
                    assistantMessageId: task.assistantMessageId,
                    model: task.model,
                });
                await failureBroker.fail(userFacingError, {
                    replaceContent: error?.code === 'OUTPUT_MODERATION_BLOCK',
                    clearReasoning: error?.code === 'OUTPUT_MODERATION_BLOCK',
                });
            }
            await this.repo.updateTaskStatus(task.id, 'error', userFacingError);
            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'error', error: userFacingError });
        }
    }

    private broadcastTaskStatus(userId: string | null, task: NonNullable<AITask>, data: Record<string, any>) {
        if (!userId) return;
        this.ws.broadcastToUser(userId, {
            type: 'task_status',
            sessionId: task.sessionId,
            data,
        });
    }

    private async checkTaskCancelled(taskId: string): Promise<boolean> {
        try {
            const redisCancel = await cacheClient.get(`chat:cancel:${taskId}`);
            if (redisCancel === '1') return true;
            const currentTask = await this.repo.getTaskStatus(taskId);
            return currentTask?.status === 'cancelled';
        } catch {
            return false;
        }
    }

    private shouldRecoverFromStalePreviousResponse(
        error: unknown,
        model: string,
        previousResponseId: string | null | undefined
    ): boolean {
        if (!previousResponseId) return false;
        if (!String(model || '').toLowerCase().includes('grok')) return false;
        const message = String((error as any)?.message || error || '').toLowerCase();
        return (
            (message.includes('response with id') && message.includes('not found'))
            || (message.includes('previous_response_id') && message.includes('not found'))
            || (message.includes('grpc error') && message.includes('not found'))
        );
    }

    private isSuspiciousProviderResponseId(value: string): boolean {
        const normalized = String(value || '').trim();
        if (!normalized) return true;
        // Grok error chunks in router can emit synthetic ids derived from hash(messages),
        // e.g. chatcmpl--8058831201540333229. These are not valid continuation anchors.
        return /^chatcmpl-?-?\d+$/.test(normalized);
    }

    private async hydrateWalletSnapshotIfNeeded(task: NonNullable<AITask>, prefetchedMessages?: Array<{ role?: string | null; content?: string | null }>): Promise<void> {
        const toolContext = task.toolContext || {};
        const walletAddress = toolContext.walletAddress || toolContext.userAddress;
        const chainId = Number(toolContext.chainId || 0);
        if (!walletAddress || !chainId) return;

        const messages = Array.isArray(prefetchedMessages)
            ? prefetchedMessages
            : await this.repo.getSessionMessages(task.sessionId).catch(() => []);
        const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
        const lower = String(lastUserMessage || '').toLowerCase();
        const isTradeLike = /\b(swap|buy|sell|trade|convert|ape|bridge|cross[\s-]?chain)\b/i.test(lower) || /买|卖|换|兑换|跨链/.test(lower);
        const wantsWallet = /\b(balance|portfolio|wallet|holdings|pnl)\b/i.test(lower) || /余额|钱包|持有/.test(lower);
        if (!isTradeLike && !wantsWallet) return;
        const requestedTokenAddresses = Array.from(new Set(
            messages
                .filter((msg) => msg.role === 'user')
                .flatMap((msg) => Array.from(String(msg.content || '').matchAll(/\b0x[a-fA-F0-9]{40}\b/g)).map((match) => String(match[0] || '').toLowerCase())),
        ));

        const chainMap: Record<number, string> = {
            1: 'eth',
            8453: 'base',
            56: 'bsc',
            42161: 'arbitrum',
            10: 'optimism',
            137: 'polygon',
            900: 'solana',
        };
        const nativeSymbolMap: Record<number, string> = {
            1: 'ETH',
            8453: 'ETH',
            56: 'BNB',
            42161: 'ETH',
            10: 'ETH',
            137: 'POL',
            900: 'SOL',
        };

        try {
            const hydratedBalance: Record<string, string> = {};
            const needsSingleChainSnapshot = !toolContext.balance || !toolContext.nativeBalance;
            if (needsSingleChainSnapshot) {
                const chainName = chainMap[chainId] || 'eth';
                const walletSnapshot = await getWalletBalance(walletAddress, chainName);

                if (walletSnapshot?.ethBalanceFormatted !== undefined && walletSnapshot?.ethBalanceFormatted !== null) {
                    const nativeSymbol = nativeSymbolMap[chainId] || 'ETH';
                    hydratedBalance[nativeSymbol] = String(walletSnapshot.ethBalanceFormatted);
                    toolContext.nativeBalance = String(walletSnapshot.ethBalanceFormatted);
                }

                for (const token of walletSnapshot?.tokens || []) {
                    const decimals = typeof token.decimals === 'number' ? token.decimals : 18;
                    let formatted = '0';
                    try {
                        formatted = ethers.formatUnits(token.tokenBalance || '0', decimals);
                    } catch {
                        formatted = '0';
                    }
                    if (token.symbol) {
                        hydratedBalance[token.symbol] = formatted;
                    }
                    if (token.contractAddress) {
                        hydratedBalance[token.contractAddress.toLowerCase()] = formatted;
                    }
                }
            }

            let allChainBalances = toolContext.allChainBalances;
            const hasAllChainSnapshot = !!allChainBalances && typeof allChainBalances === 'object' && Object.keys(allChainBalances).length > 0;
            if (!hasAllChainSnapshot) {
                const solanaAddress = toolContext.solanaWalletAddress || toolContext.solanaAddress || toolContext.userSolanaAddress;
                const fetchedAllBalances = await walletService.getAllChainBalances(walletAddress, solanaAddress, {
                    forceRefresh: false,
                });
                if (fetchedAllBalances && Object.keys(fetchedAllBalances).length > 0) {
                    allChainBalances = fetchedAllBalances;
                }
            }

            if (Object.keys(hydratedBalance).length > 0) {
                toolContext.balance = hydratedBalance;
                toolContext.balanceSnapshotAt = new Date().toISOString();
            }
            if (allChainBalances && typeof allChainBalances === 'object' && Object.keys(allChainBalances).length > 0) {
                toolContext.allChainBalances = allChainBalances;
                toolContext.allChainBalancesSnapshotAt = new Date().toISOString();
            }

            const exactBalanceChain = chainMap[chainId];
            if (exactBalanceChain && requestedTokenAddresses.length > 0) {
                const mergedBalance: Record<string, any> = {
                    ...(toolContext.balance && typeof toolContext.balance === 'object' ? toolContext.balance : {}),
                };

                for (const tokenAddress of requestedTokenAddresses) {
                    try {
                        const exactBalance = await walletService.getTokenBalance(walletAddress, exactBalanceChain, tokenAddress);
                        mergedBalance[tokenAddress] = {
                            balance: exactBalance.formatted,
                            tokenBalance: exactBalance.formatted,
                            decimals: exactBalance.decimals,
                            contractAddress: tokenAddress,
                        };
                    } catch (error: any) {
                        logger.warn(LogCode.API_FETCH_FAILED, 'ChatWorker: failed to hydrate exact requested token balance', {
                            taskId: task.id,
                            sessionId: task.sessionId,
                            walletAddress: walletAddress.slice(0, 10),
                            chainId,
                            tokenAddress,
                            error: error?.message || String(error),
                        });
                    }
                }

                if (Object.keys(mergedBalance).length > 0) {
                    toolContext.balance = mergedBalance;
                    toolContext.balanceSnapshotAt = new Date().toISOString();
                }
            }

            if (toolContext.balance || Object.keys(hydratedBalance).length > 0 || (allChainBalances && typeof allChainBalances === 'object')) {
                task.toolContext = toolContext;
            }
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'ChatWorker: failed to hydrate wallet snapshot', {
                taskId: task.id,
                sessionId: task.sessionId,
                walletAddress: walletAddress.slice(0, 10),
                chainId,
                error: error?.message || String(error),
            });
        }
    }
}

function sanitizeUserFacingError(input: string): string {
    const raw = String(input || '');
    if (!raw) return 'Task failed';

    // Strip debug fields that may include prompt/context payloads.
    const stripped = raw
        .replace(/\s*\|\s*request_tail=.*$/s, '')
        .replace(/\s*\|\s*raw=.*$/s, '')
        .trim();

    if (stripped.startsWith('Assistant output blocked by moderation')) {
        return 'The final answer was blocked by the output safety filter before delivery.';
    }

    // Keep concise reason while preserving explicit code prefix if present.
    return stripped || 'Task failed';
}

function buildOutputModerationErrorMessage(moderated: { verification?: any }): string {
    const categories = Object.entries(moderated?.verification?.categories || {})
        .filter(([, flagged]) => Boolean(flagged))
        .map(([name]) => name);

    if (categories.length > 0) {
        return `Assistant output blocked by moderation (${categories.join(', ')})`;
    }

    return 'Assistant output blocked by moderation';
}

function buildFastDirectAssistantResponse(
    snapshot: { lastUserMessage?: string; normalizedIntent?: any },
    skillResolution: SkillResolution,
): string | null {
    if (!skillResolution.querySignals.welcome) return null;
    const normalizedIntent = snapshot.normalizedIntent;
    if (normalizedIntent?.requiresRealtime || normalizedIntent?.requiresOnchainEvidence || normalizedIntent?.executionCandidate) {
        return null;
    }

    const query = String(snapshot.lastUserMessage || '').trim();
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
    logChatStreamDebug(LogCode.AI_ORCHESTRATOR, 'ChatWorker: direct fast-path streaming started', {
        ...context,
        chunkCount: chunks.length,
        totalLength: text.length,
        delayMs,
    });
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        await broker.pushText(chunk);
        logChatStreamDebug(LogCode.AI_ORCHESTRATOR, 'ChatWorker: direct fast-path chunk pushed', {
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

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const chatWorker = new ChatWorker();
