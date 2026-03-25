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
import { resolveNodeSkills } from './chat/nodeSkillResolver.js';
import { buildTaskPlanningContext } from './chat/taskPlanner.js';
import { buildControlPolicySnapshot } from './chat/controlPolicy.js';
import { normalizeCanonicalIntent } from './chat/canonicalIntentNormalizer.js';
import { getWalletBalance } from '../services/alchemy.js';
import { walletService } from '../services/walletService.js';
import { ethers } from 'ethers';
import { isExplicitChainSwitchRequest } from './chat/chainIntent.js';

type AITask = Awaited<ReturnType<typeof chatRepo.getTask>>;

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
            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'running', message: 'Loading wallet and context' });

            const messages = await messagesPromise;
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

            const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
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
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: snapshot assembled', {
                taskId: task.id,
                sessionId: task.sessionId,
                historyCount: snapshot.history.length,
                directiveCount: snapshot.runtime.systemDirectives?.length || 0,
                prefetchedKeys: Object.keys(snapshot.runtime.prefetchedToolResults || {}),
                requestedSymbols: snapshot.requestedTokenSymbols,
                requestedAddresses: snapshot.requestedTokenAddresses.length,
            });
            const normalization = await normalizeCanonicalIntent({
                snapshot,
                generationClient: this.generationClient,
                shouldCancel: async () => this.checkTaskCancelled(task.id),
            });
            snapshot = normalization.snapshot;
            const tradingIntent = parseTradingIntent(snapshot.lastUserMessage, snapshot, snapshot.normalizedIntent);
            const skillResolution = resolveNodeSkills(snapshot, tradingIntent, snapshot.normalizedIntent);
            snapshot.policySnapshot = buildControlPolicySnapshot({
                snapshot,
                tradingIntent,
                skillResolution,
            });
            await broker.bootstrapRuntime(buildTaskPlanningContext(snapshot, skillResolution).plan);

            if (!isExplicitChainSwitchRequest(lastUserMessage)) {
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
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: generation loop finished', {
                taskId: task.id,
                sessionId: task.sessionId,
                contentLength: broker.getContent().length,
                toolCalls: broker.getToolResults().map((item) => item.name),
            });

            const moderated = await moderationClient.moderateOutput(broker.getContent(), userId, task.sessionId, task.model);
            if (moderated.safe === false) {
                const moderationMessage = sanitizeUserFacingError(buildOutputModerationErrorMessage(moderated));
                await broker.blockContent(moderationMessage, { clearReasoning: true });
                const error = new Error(buildOutputModerationErrorMessage(moderated));
                (error as any).code = 'OUTPUT_MODERATION_BLOCK';
                throw error;
            }
            await broker.complete({ content: moderated.filtered_text || broker.getContent() });
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

export const chatWorker = new ChatWorker();
