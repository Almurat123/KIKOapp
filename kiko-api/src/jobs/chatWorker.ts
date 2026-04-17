// CONTEXT MEMORY
// Updated: 2026-04-17
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
//         The worker now also has to load current-turn uploaded chat images from
//         private storage, merge them into runtime multimodal context, and clear
//         the Redis task binding once the task finishes without deleting sent
//         history images. Runtime transcripts later showed the direct welcome
//         fast path was too broad: capability/skill/meta-debug questions could
//         be replaced by a fixed product-intro macro instead of being answered
//         by the selected skill and model. The chat v2 rewrite now also needs
//         a dedicated turn-runner owner so task lifecycle code does not keep
//         owning normalization, skill resolution, direct follow-up execution,
//         and orchestration retries. The rewrite now also needs an explicit
//         runtime-mode switch above that runner so rollout and fallback policy
//         live at the entry boundary instead of inside hidden worker branches.
// Goal: keep the full agent loop for real work, but let deterministic
//       bare greetings complete without invoking a slow provider model, while
//       surfacing normalization reasoning through the normal assistant reasoning
//       area so users get live runtime feedback, and let obvious non-chain turns
//       bypass canonical normalization entirely, while treating uploaded chat
//       images as one-turn model inputs whose private objects can still back
//       refreshed chat history.
// Owns: worker-level task lifecycle, moderation gates, broker completion,
//       persistence handoff, and task-time image binding cleanup.
// Does Not Own: provider streaming transport, frontend chunk animation, skill
//               prompt content, or the internal chat v2 turn pipeline.
// Design Language:
// - only bare greetings should use deterministic direct-response copy
// - assistant capability, skill, and meta-debug questions must go through normal model generation
// - deterministic fast-path text should still be chunked so frontend streaming can be verified
// - slow provider models must not be called for bare greetings, but product-copy shortcuts must not override substantive questions
// - billing and output moderation still run through the normal worker terminal path
// - normalization reasoning should stream into the same reasoning surface as the
//   assistant when available, with a short label that makes the phase obvious
// - obvious non-chain turns must bypass canonical normalization before any JSON routing prompt is built
// - uploaded chat images belong only to the current model turn, but sent image
//   objects must remain available for refreshed chat-history previews
// - worker cleanup removes task bindings, not durable sent image objects
// - chat v2 turn execution belongs to a dedicated runner owner, not the worker shell
// - runtime mode selection belongs above turn execution and must stay explicit
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
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: loading uploaded task images into runtime socialInput and clearing task bindings after completion
// - Verification: verified in code
// - Source: operator correction that refreshed chat history must preserve image bubbles
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: retaining sent image objects while still cleaning worker task bindings
// - Verification: verified in code
// - Source: operator runtime transcript where "your skill / previous behavior"
//           questions were answered with the fixed KiKo intro macro
// - Kind: runtime observation
// - Retrieved: 2026-04-17
// - Applied To: restricting the direct fast path to bare greetings only
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: moving chat v2 turn execution out of chatWorker and into a dedicated runner owner
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: explicit runtime-mode dispatch before chat turn execution
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-direct-response-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-direct-welcome-fast-path-hardcoded-reply-guard.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-direct-welcome-fast-path.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-normalization-reasoning-runtime-surface.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-direct-answer-tool-pruning.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-non-chain-normalization-bypass.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
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
import { runChatV2Turn } from './chat/chatV2TurnRunner.js';
import { resolveChatRuntimeMode, runChatTurnByRuntimeMode } from './chat/chatRuntimeMode.js';
import { ToolExecutionEngine } from './chat/toolExecutionEngine.js';
import { ChatStreamBroker } from './chat/streamBroker.js';
import { getToolStatusMessage, persistBillingUsage } from './chat/legacyCompat.js';
import cacheClient from '../cache/cacheClient.js';
import { PythonGenerationClient } from './chat/pythonGenerationClient.js';
import { buildWarmupPlan } from './chat/taskPlanner.js';
import { enrichRequestedAddressClassifications } from './chat/addressEntityClassifier.js';
import { getWalletBalance } from '../services/alchemy.js';
import { walletService } from '../services/walletService.js';
import { ethers } from 'ethers';
import { cleanupTaskChatImageUploads, loadTaskChatImageInputs } from '../services/chatImageUploads.js';

type AITask = Awaited<ReturnType<typeof chatRepo.getTask>>;

export function isEmptyAssistantCompletion(
    content: string,
): boolean {
    return String(content || '').trim().length === 0;
}

function mergeRuntimeSocialInput(
    existing: Record<string, any> | null | undefined,
    uploadedImages: Array<{ url: string; sourceLabel: string }>,
): Record<string, any> | null {
    if (!Array.isArray(uploadedImages) || uploadedImages.length === 0) {
        return existing || null;
    }

    const prior = existing && typeof existing === 'object' ? existing : {};
    const priorImages = Array.isArray(prior.images) ? prior.images : [];

    return {
        ...prior,
        images: [...priorImages, ...uploadedImages],
    };
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
            const uploadedTaskImages = await loadTaskChatImageInputs(task.id).catch((error) => {
                logger.warn(LogCode.SYS_INFO, 'ChatWorker: failed to load uploaded task images', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    error: error instanceof Error ? error.message : String(error),
                });
                return [];
            });
            if (uploadedTaskImages.length > 0) {
                task.toolContext = {
                    ...(task.toolContext || {}),
                    socialInput: mergeRuntimeSocialInput(task.toolContext?.socialInput, uploadedTaskImages),
                };
            }
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
            const runtimeMode = resolveChatRuntimeMode();
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: resolved runtime mode', {
                taskId: task.id,
                sessionId: task.sessionId,
                runtimeMode,
            });
            const turnResult = await runChatTurnByRuntimeMode({
                snapshot,
                task,
                userId,
                broker,
                generationClient: this.generationClient,
                toolExecutionEngine: this.toolExecutionEngine,
                toolContext: task.toolContext || {},
                runtimeMode,
                shouldCancel: async () => this.checkTaskCancelled(task.id),
                updateSessionConversationState: async (state) => {
                    await this.repo.updateSessionConversationState(task.sessionId, state);
                },
                shouldRecoverFromStalePreviousResponse: (error, model, previousResponseId) => (
                    this.shouldRecoverFromStalePreviousResponse(error, model, previousResponseId)
                ),
                isSuspiciousProviderResponseId: (value) => this.isSuspiciousProviderResponseId(value),
                onToolStatus: async (toolName) => {
                    this.broadcastTaskStatus(userId, task, {
                        taskId: task.id,
                        status: 'running',
                        message: getToolStatusMessage(toolName),
                    });
                },
            }, {
                runChatV2Turn,
            });
            snapshot = turnResult.snapshot;
            if (turnResult.terminal) {
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
        } finally {
            await cleanupTaskChatImageUploads(task.id).catch((cleanupError) => {
                logger.warn(LogCode.SYS_INFO, 'ChatWorker: failed to cleanup task image uploads', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
                });
            });
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

export const chatWorker = new ChatWorker();
export { buildFastDirectAssistantResponse } from './chat/chatV2TurnRunner.js';
