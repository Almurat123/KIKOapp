import * as chatRepo from '../repositories/chatRepository.js';
import { chatWS } from '../services/chatWebSocket.js';
import { moderationClient } from '../services/moderationClient.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { processClaimedTasks } from './chat/taskClaimRunner.js';
import { toolRegistry } from '../tooling/registry.js';
import { assembleChatContext } from './chat/contextAssembler.js';
import { ToolExecutionEngine } from './chat/toolExecutionEngine.js';
import { ChatStreamBroker } from './chat/streamBroker.js';
import { getToolStatusMessage, persistBillingUsage } from './chat/legacyCompat.js';
import { executeDirectTradeFollowup } from './chat/tradeFollowupExecutor.js';
import { maybeExecuteFastSwap } from './chat/fastSwapCoordinator.js';
import cacheClient from '../cache/cacheClient.js';
import { PythonGenerationClient } from './chat/pythonGenerationClient.js';
import { runNodeOrchestration } from './chat/nodeOrchestrator.js';

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
        try {
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: starting task', {
                taskId: task.id,
                sessionId: task.sessionId,
                model: task.model,
            });
            const [session, messages] = await Promise.all([
                this.repo.getSession(task.sessionId),
                this.repo.getSessionMessages(task.sessionId),
            ]);
            userId = session?.userId || null;

            if (!userId) {
                throw new Error('Missing session user');
            }

            const broker = new ChatStreamBroker({
                userId,
                sessionId: task.sessionId,
                assistantMessageId: task.assistantMessageId!,
                model: task.model,
            });
            broker.start();
            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'running', message: 'Analyzing query' });
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: task context loaded', {
                taskId: task.id,
                sessionId: task.sessionId,
                messageCount: messages.length,
                assistantMessageId: task.assistantMessageId,
            });

            const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
            const moderation = await moderationClient.moderateInput(lastUserMessage, {}, userId, task.sessionId, task.model);
            if (!moderation.safe) {
                throw new Error(moderation.checks?.intent?.reason || 'Message blocked by moderation');
            }

            const snapshot = assembleChatContext({
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

            const directFollowup = await executeDirectTradeFollowup({
                snapshot,
                task,
                userId,
                broker,
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

            await runNodeOrchestration({
                snapshot,
                generationClient: this.generationClient,
                toolExecutionEngine: this.toolExecutionEngine,
                broker,
                toolContext: {
                    ...(task.toolContext || {}),
                    prefetchedToolResults: snapshot.runtime.prefetchedToolResults || {},
                },
                shouldCancel: async () => this.checkTaskCancelled(task.id),
                onProviderState: async (state) => {
                    if (state.previousResponseId) {
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
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: generation loop finished', {
                taskId: task.id,
                sessionId: task.sessionId,
                contentLength: broker.getContent().length,
                toolCalls: broker.getToolResults().map((item) => item.name),
            });

            const moderated = await moderationClient.moderateOutput(broker.getContent(), userId, task.sessionId, task.model);
            if (moderated.safe === false) {
                throw new Error('Assistant output blocked by moderation');
            }
            await broker.complete({ content: moderated.filtered_text || broker.getContent() });
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
        } catch (error: any) {
            const message = error?.message || String(error);
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
                this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'cancelled', error: message });
                return;
            }
            if (task.assistantMessageId) {
                const broker = new ChatStreamBroker({
                    userId,
                    sessionId: task.sessionId,
                    assistantMessageId: task.assistantMessageId,
                    model: task.model,
                });
                await broker.fail(message);
            }
            await this.repo.updateTaskStatus(task.id, 'error', message);
            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'error', error: message });
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
}

export const chatWorker = new ChatWorker();
