/**
 * Chat Routes - Backend-Task-Based Chat System
 * Replaces frontend-driven AI calls with backend worker + WebSocket streaming
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import * as chatRepo from '../repositories/chatRepository.js';
import { trackChatMessage } from '../services/userActivityService.js';
import { chatWS } from '../services/chatWebSocket.js';
import { chatWorker } from '../jobs/chatWorker.js';
import prisma from '../db/prisma.js';
import { sanitizedErrorResponse } from '../utils/securityUtils.js';
import { evaluateUsageAccess, isCurrentRequestFree } from '../services/usageAccess.js';
import { getWalletBalance } from '../services/alchemy.js';
import { ethers } from 'ethers';
import cacheClient from '../cache/cacheClient.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { resolveToolContextChainSwitchAck } from '../jobs/chat/toolContextChainState.js';

// Request body types
interface CreateSessionBody {
    title?: string;
    model?: string;
}

interface SendMessageBody {
    content: string;
    model?: string;
    walletAddress?: string;
    chainId?: number;
    farcaster?: {
        followsKiko?: boolean | null;
        followStatus?: 'following' | 'not_following' | 'unknown';
        checkedAt?: string | null;
        kikoHandle?: string;
        profileUrl?: string;
    };
    toolConfig?: any;
    allowanceMode?: string;
    balance?: any;
    nativeBalance?: string;
    currentPage?: string;
    pageContext?: string;
    context?: any;
}

interface UpdateSessionBody {
    title?: string;
    model?: string;
    status?: 'active' | 'archived';
}

interface ReportChainSwitchBody {
    chainId?: number;
    chainName?: string;
    status: 'success' | 'failed';
    error?: string;
}

function normalizeTaskModel(model?: string): string {
    const normalized = (model || '').toLowerCase().trim();
    if (!normalized) return 'deepseek-chat';
    return normalized;
}

export async function chatRoutes(fastify: FastifyInstance) {
    // =============================================
    // Session Endpoints
    // =============================================

    // Create new chat session
    fastify.post<{ Body: CreateSessionBody }>(
        '/sessions',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: CreateSessionBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }

                const { title, model } = request.body;
                const session = await chatRepo.createSession(userId, title, model);

                return reply.send({
                    success: true,
                    session,
                });
            } catch (error: any) {
                fastify.log.error('Error creating session:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'createSession'));
            }
        }
    );

    // List user's sessions
    fastify.get(
        '/sessions',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }

                const limit = (request.query as any).limit || 50;
                const offset = (request.query as any).offset || 0;

                const sessions = await chatRepo.getUserSessions(userId, limit, offset);

                return reply.send({
                    success: true,
                    sessions,
                });
            } catch (error: any) {
                fastify.log.error('Error listing sessions:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'listSessions'));
            }
        }
    );

    // Get session with messages
    fastify.get<{ Params: { sessionId: string } }>(
        '/sessions/:sessionId',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;

                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    return reply.code(404).send({ error: 'Session not found' });
                }

                // Verify ownership
                if (session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                const [messages, activeTask] = await Promise.all([
                    chatRepo.getSessionMessages(sessionId),
                    chatRepo.getSessionActiveTask(sessionId)
                ]);

                return reply.send({
                    success: true,
                    session,
                    messages,
                    activeTask,
                });
            } catch (error: any) {
                fastify.log.error('Error getting session:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'getSession'));
            }
        }
    );

    // Update session
    fastify.patch<{ Params: { sessionId: string }; Body: UpdateSessionBody }>(
        '/sessions/:sessionId',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { sessionId: string }; Body: UpdateSessionBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;

                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    return reply.code(404).send({ error: 'Session not found' });
                }

                if (session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                const updatedSession = await chatRepo.updateSession(sessionId, request.body);

                return reply.send({
                    success: true,
                    session: updatedSession,
                });
            } catch (error: any) {
                fastify.log.error('Error updating session:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'updateSession'));
            }
        }
    );

    // Delete session
    fastify.delete<{ Params: { sessionId: string } }>(
        '/sessions/:sessionId',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;

                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    return reply.code(404).send({ error: 'Session not found' });
                }

                if (session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                await chatRepo.deleteSession(sessionId);

                return reply.send({
                    success: true,
                    message: 'Session deleted',
                });
            } catch (error: any) {
                fastify.log.error('Error deleting session:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'deleteSession'));
            }
        }
    );

    // =============================================
    // Message Endpoints
    // =============================================

    // Send message (creates user message + assistant message + AI task)
    fastify.post<{ Params: { sessionId: string }; Body: SendMessageBody }>(
        '/sessions/:sessionId/messages',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { sessionId: string }; Body: SendMessageBody }>, reply: FastifyReply) => {
            try {
                const requestStartedAt = Date.now();
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;
                const {
                    content,
                    model,
                    walletAddress,
                    chainId,
                    farcaster,
                    toolConfig,
                    balance,
                    nativeBalance,
                    currentPage,
                    pageContext,
                    context,
                } = request.body;
                logger.info(LogCode.AI_API_CALL, 'Chat route: sendMessage received', {
                    userId,
                    sessionId,
                    model: model || null,
                    chainId: chainId ?? undefined,
                    contentLength: content?.trim()?.length || 0,
                });

                if (!content?.trim()) {
                    return reply.code(400).send({ error: 'Message content is required' });
                }

                // Verify session ownership
                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    return reply.code(404).send({ error: 'Session not found' });
                }
                if (session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                const taskModel = normalizeTaskModel(model || session.model || 'deepseek-chat');

                // Create user message first to ensure it's persisted even if checks fail
                const userMessage = await chatRepo.createMessage(sessionId, 'user', content.trim());
                logger.info(LogCode.AI_API_CALL, 'Chat route: user message persisted', {
                    userId,
                    sessionId,
                    model: taskModel,
                    userMessageId: userMessage.id,
                    routeStageMs: Date.now() - requestStartedAt,
                });

                // Track user activity (using privyDid as required by UserActivity schema)
                const userRecord = await prisma.user.findUnique({ where: { privyDid: userId } });
                if (userRecord) {
                    trackChatMessage(userRecord.privyDid);
                }

                let billingContext: { isFree: boolean; modelCategory: string } | undefined;

                try {
                    const [activeTask, usageDecision] = await Promise.all([
                        chatRepo.getSessionActiveTask(sessionId),
                        evaluateUsageAccess({
                            userId,
                            model: taskModel
                        })
                    ]);

                    if (activeTask) {
                        return reply.code(409).send({
                            error: 'An AI task is already running for this session',
                            taskId: activeTask.id,
                            status: activeTask.status,
                            userMessage, // Include userMessage so frontend can sync it
                        });
                    }

                    if (!usageDecision.allowed) {
                        // Create persistent limit notification as an assistant message
                        let limitContent = 'Daily limit reached.';
                        if (usageDecision.reason === 'DAILY_TOTAL_LIMIT_REACHED') {
                            limitContent = `You have reached your daily total usage limit (${usageDecision.totalLimit} messages). Please check back tomorrow or increase your token balance to raise your limit.`;
                        } else if (usageDecision.reason === 'DAILY_ADVANCED_LIMIT_REACHED') {
                            limitContent = 'You have reached your daily limit for Advanced models. You can continue using Normal models or wait until tomorrow.';
                        } else if (usageDecision.reason === 'DAILY_NORMAL_LIMIT_REACHED') {
                            limitContent = 'You have reached your daily limit for Normal models. Please check back tomorrow.';
                        }

                        const assistantMessage = await chatRepo.createMessage(sessionId, 'assistant', limitContent, {
                            status: 'complete',
                        });

                        // Return success so frontend persists messages and shows the notification
                        return reply.send({
                            success: true,
                            userMessage,
                            assistantMessage,
                            task: {
                                id: `limit-${Date.now()}`,
                                status: 'done',
                                sessionId,
                                model: taskModel,
                                createdAt: new Date(),
                            }
                        });
                    }

                    billingContext = {
                        isFree: isCurrentRequestFree(usageDecision),
                        modelCategory: usageDecision.modelCategory
                    };
                } catch (usageError: any) {
                    fastify.log.error('Usage limit check failed:', usageError);
                    return reply.code(500).send({
                        error: 'Usage limit check failed',
                        reason: 'USAGE_CHECK_FAILED'
                    });
                }

                // Create empty assistant message (will be populated by worker)
                const assistantMessage = await chatRepo.createMessage(sessionId, 'assistant', '', {
                    status: 'streaming',
                });

                // Create AI task
                // Extract allowanceMode from toolConfig if not provided explicitly
                // toolConfig is already destructured above
                let allowanceMode = request.body.allowanceMode;

                if (!allowanceMode) {
                    const fastSwapEnabled = Boolean((toolConfig as any)?.fastSwapMode);
                    allowanceMode = fastSwapEnabled ? 'instant' : 'confirm';
                }

                // Extract access token for backend swap execution
                const authHeader = request.headers.authorization || '';
                const accessToken = authHeader.replace('Bearer ', '');

                const normalizedPageContext =
                    typeof pageContext === 'string'
                        ? pageContext
                        : context
                            ? JSON.stringify(context)
                            : undefined;

                let resolvedWalletAddress: string | undefined = walletAddress || undefined;
                let evmWalletAddress: string | undefined = chainId === 900 ? undefined : walletAddress || undefined;
                let solanaWalletAddress: string | undefined = chainId === 900 ? walletAddress || undefined : undefined;
                if (userId) {
                    try {
                        const { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress } = await import('../services/privyWallet.js');
                        const [resolvedEvmWallet, resolvedSolanaWallet] = await Promise.all([
                            getEmbeddedWalletAddress(userId).catch(() => null),
                            getSolanaEmbeddedWalletAddress(userId).catch(() => null),
                        ]);
                        evmWalletAddress = resolvedEvmWallet || evmWalletAddress;
                        solanaWalletAddress = resolvedSolanaWallet || solanaWalletAddress;
                        if (!resolvedWalletAddress) {
                            resolvedWalletAddress = chainId === 900
                                ? (resolvedSolanaWallet || undefined)
                                : (resolvedEvmWallet || undefined);
                        }
                    } catch (e) {
                        fastify.log.warn({ err: e }, 'Failed to resolve embedded wallet address for chat task');
                    }
                }

                const chainIdToName: Record<number, string> = {
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
                };

                let resolvedBalance = balance;
                let resolvedNativeBalance = nativeBalance;
                const needsTokenBalances = !resolvedBalance || Object.keys(resolvedBalance).length === 0;
                const needsNativeBalance =
                    resolvedNativeBalance === undefined ||
                    resolvedNativeBalance === null ||
                    resolvedNativeBalance === '';

                // OPTIMIZATION: Only hydrate from Alchemy when frontend sent NO balance data.
                // The frontend already sends userBalances from its wallet state.
                // The worker has its own fallback mechanisms (resolveTokenContext, direct balance query)
                // so missing/stale data is self-healing at the worker level.
                const shouldHydrateWalletSnapshot =
                    resolvedWalletAddress &&
                    chainId &&
                    chainId !== 900 &&
                    needsTokenBalances &&
                    needsNativeBalance;
                const walletHydrationStartedAt = shouldHydrateWalletSnapshot ? Date.now() : null;

                if (shouldHydrateWalletSnapshot && resolvedWalletAddress) {
                    try {
                        const chainName = chainIdToName[chainId] || 'eth';
                        // getWalletBalance now has a 15s in-memory cache — fast on cache hit
                        const walletSnapshot = await getWalletBalance(resolvedWalletAddress, chainName);
                        const tokenBalances = walletSnapshot?.tokens || [];
                        const hydrated: Record<string, string> = {};

                        if (walletSnapshot?.ethBalanceFormatted !== undefined) {
                            const nativeSymbol = nativeSymbolMap[chainId] || 'ETH';
                            hydrated[nativeSymbol] = String(walletSnapshot.ethBalanceFormatted);
                            resolvedNativeBalance = String(walletSnapshot.ethBalanceFormatted);
                        }

                        for (const token of tokenBalances || []) {
                            const decimals = typeof token.decimals === 'number' ? token.decimals : 18;
                            let formatted = '0';
                            try {
                                formatted = ethers.formatUnits(token.tokenBalance || '0', decimals);
                            } catch {
                                formatted = '0';
                            }
                            if (token.symbol) {
                                hydrated[token.symbol] = formatted;
                            }
                            if (token.contractAddress) {
                                hydrated[token.contractAddress.toLowerCase()] = formatted;
                            }
                        }

                        resolvedBalance = hydrated;
                    } catch (e) {
                        fastify.log.warn({ err: e }, 'Failed to hydrate wallet balance for chat task');
                    }
                }
                const walletHydrationMs = walletHydrationStartedAt ? Date.now() - walletHydrationStartedAt : 0;

                const mergedFarcasterContext = userRecord?.farcasterFid || farcaster
                    ? {
                        ...farcaster,
                        kikoHandle: farcaster?.kikoHandle || 'kikoapp',
                        profileUrl: farcaster?.profileUrl || (
                            userRecord?.farcasterUsername
                                ? `https://warpcast.com/${String(userRecord.farcasterUsername).replace(/^@/, '')}`
                                : undefined
                        ),
                    }
                    : null;

                const task = await chatRepo.createTask(
                    sessionId,
                    taskModel,
                    userMessage.id,
                    assistantMessage.id,
                    {
                        userId,
                        sessionId, // Add sessionId to toolContext for backend execution
                        walletAddress: resolvedWalletAddress,
                        userAddress: resolvedWalletAddress,
                        evmWalletAddress,
                        solanaWalletAddress,
                        solanaAddress: solanaWalletAddress,
                        userSolanaAddress: solanaWalletAddress,
                        chainId,
                        farcaster: mergedFarcasterContext,
                        toolConfig,
                        allowanceMode,
                        balance: resolvedBalance,
                        nativeBalance: resolvedNativeBalance,
                        accessToken,
                        currentPage,
                        pageContext: normalizedPageContext,
                        billing: billingContext,
                    }
                );
                logger.info(LogCode.AI_API_CALL, 'Chat route: task created', {
                    userId,
                    sessionId,
                    taskId: task.id,
                    assistantMessageId: assistantMessage.id,
                    userMessageId: userMessage.id,
                    model: taskModel,
                    routeStageMs: Date.now() - requestStartedAt,
                    walletHydrationMs,
                    walletHydrationAttempted: shouldHydrateWalletSnapshot,
                });

                // Immediately notify frontend to show Thinking and create assistant placeholder
                chatWS.broadcastToUser(userId, {
                    type: 'task_status',
                    sessionId,
                    data: {
                        taskId: task.id,
                        status: 'running',
                        iteration: 1,
                        maxIterations: 10,
                        message: 'Thinking',
                        taskType: 'text'
                    }
                });
                chatWS.broadcastToUser(userId, {
                    type: 'message_start',
                    sessionId,
                    data: {
                        messageId: assistantMessage.id,
                        role: 'assistant',
                        model: taskModel
                    }
                });
                // Wake the worker immediately so we do not wait for next poll tick.
                chatWorker.wake().catch((err: any) => {
                    fastify.log.warn({ err }, 'Chat worker wake failed');
                });
                logger.info(LogCode.AI_API_CALL, 'Chat route: task queued and wake triggered', {
                    userId,
                    sessionId,
                    taskId: task.id,
                    assistantMessageId: assistantMessage.id,
                    model: taskModel,
                    routeTotalMs: Date.now() - requestStartedAt,
                });

                // Update session model if different
                if (taskModel !== session.model) {
                    await chatRepo.updateSession(sessionId, { model: taskModel });
                }

                // Update session title if this is the first message
                const messages = await chatRepo.getSessionMessages(sessionId);
                if (messages.length <= 2) { // user + assistant
                    // Generate title from first user message (truncate to 50 chars)
                    const title = content.trim().slice(0, 50) + (content.length > 50 ? '...' : '');
                    await chatRepo.updateSession(sessionId, { title });
                }

                return reply.send({
                    success: true,
                    userMessage,
                    assistantMessage,
                    task,
                });
            } catch (error: any) {
                fastify.log.error('Error sending message:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'sendMessage'));
            }
        }
    );

    // Update message feedback
    fastify.put<{ Params: { sessionId: string; messageId: string }; Body: { feedback: 'like' | 'dislike' | null } }>(
        '/sessions/:sessionId/messages/:messageId/feedback',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { sessionId: string; messageId: string }; Body: { feedback: 'like' | 'dislike' | null } }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                const { sessionId, messageId } = request.params;
                const { feedback } = request.body;

                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    return reply.code(404).send({ error: 'Session not found' });
                }
                if (session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                // Verify message belongs to session
                const message = await chatRepo.getMessage(messageId);
                if (!message || message.sessionId !== sessionId) {
                    return reply.code(404).send({ error: 'Message not found in this session' });
                }

                const updatedMessage = await chatRepo.updateMessage(messageId, { feedback });

                return reply.send({
                    success: true,
                    message: updatedMessage
                });
            } catch (error: any) {
                fastify.log.error('Error updating feedback:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'updateFeedback'));
            }
        }
    );

    // Get session messages
    fastify.get<{ Params: { sessionId: string } }>(
        '/sessions/:sessionId/messages',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;
                const afterIndex = (request.query as any).after;

                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    return reply.code(404).send({ error: 'Session not found' });
                }
                if (session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                const messages = await chatRepo.getSessionMessages(
                    sessionId,
                    afterIndex !== undefined ? parseInt(afterIndex, 10) : undefined
                );

                return reply.send({
                    success: true,
                    messages,
                });
            } catch (error: any) {
                fastify.log.error('Error getting messages:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'getMessages'));
            }
        }
    );

    // =============================================
    // Task Endpoints
    // =============================================

    // Get task status
    fastify.get<{ Params: { taskId: string } }>(
        '/tasks/:taskId',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
            try {
                const { taskId } = request.params;
                const task = await chatRepo.getTask(taskId);

                if (!task) {
                    return reply.code(404).send({ error: 'Task not found' });
                }

                // Verify ownership - must belong to a session owned by this user
                const userId = (request as any).user?.sub;
                const session = await chatRepo.getSession(task.sessionId);
                if (!session || session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                // Get associated message if exists
                let assistantMessage = null;
                if (task.assistant_message_id) {
                    assistantMessage = await chatRepo.getMessage(task.assistant_message_id);
                }

                return reply.send({
                    success: true,
                    task,
                    assistantMessage,
                });
            } catch (error: any) {
                fastify.log.error('Error getting task:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'getTask'));
            }
        }
    );

    // Stop/cancel task
    fastify.post<{ Params: { taskId: string } }>(
        '/tasks/:taskId/stop',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
            try {
                const { taskId } = request.params;
                const task = await chatRepo.getTask(taskId);

                if (!task) {
                    return reply.code(404).send({ error: 'Task not found' });
                }

                // Verify ownership
                const userId = (request as any).user?.sub;
                const session = await chatRepo.getSession(task.sessionId);
                if (!session || session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                if (task.status !== 'queued' && task.status !== 'running') {
                    return reply.code(400).send({
                        error: 'Task is not active',
                        status: task.status,
                    });
                }

                // Mark task as cancelled in database
                const updatedTask = await chatRepo.updateTaskStatus(taskId, 'cancelled');

                // Set fast-signaling cancellation flag in Redis (1 minute TTL)
                // This allows the worker to stop mid-stream within milliseconds
                await cacheClient.set(`chat:cancel:${taskId}`, '1', 60);

                // Mark assistant message as complete (with partial content)
                if (task.assistant_message_id) {
                    await chatRepo.updateMessage(task.assistant_message_id, { status: 'complete' });
                }

                return reply.send({
                    success: true,
                    task: updatedTask,
                });
            } catch (error: any) {
                fastify.log.error('Error stopping task:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'stopTask'));
            }
        }
    );

    fastify.post<{ Params: { taskId: string }; Body: ReportChainSwitchBody }>(
        '/tasks/:taskId/chain-switch',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { taskId: string }; Body: ReportChainSwitchBody }>, reply: FastifyReply) => {
            try {
                const { taskId } = request.params;
                const task = await chatRepo.getTask(taskId);

                if (!task) {
                    return reply.code(404).send({ error: 'Task not found' });
                }

                const userId = (request as any).user?.sub;
                const session = await chatRepo.getSession(task.sessionId);
                if (!session || session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                const toolContext = task.toolContext && typeof task.toolContext === 'object'
                    ? task.toolContext
                    : {};
                const pending = toolContext.pendingChainSwitch && typeof toolContext.pendingChainSwitch === 'object'
                    ? toolContext.pendingChainSwitch
                    : null;
                if (request.body.status !== 'success' && request.body.status !== 'failed') {
                    return reply.code(400).send({ error: 'status must be success or failed' });
                }
                const chainId = Number(request.body?.chainId || pending?.targetChainId || 0) || 0;
                const chainName = request.body?.chainName || pending?.targetChainName;

                if (!chainId) {
                    return reply.code(400).send({ error: 'Target chainId is required' });
                }

                if (pending?.targetChainId && Number(pending.targetChainId) !== chainId) {
                    return reply.code(409).send({
                        error: 'Pending chain switch target does not match the reported chain',
                        pendingChainId: pending.targetChainId,
                        chainId,
                    });
                }

                const nextToolContext = resolveToolContextChainSwitchAck({
                    toolContext,
                    chainId,
                    chainName,
                    evmWalletAddress: toolContext.evmWalletAddress,
                    solanaWalletAddress: toolContext.solanaWalletAddress || toolContext.solanaAddress || toolContext.userSolanaAddress,
                    status: request.body.status,
                    error: request.body.error,
                });

                const updatedTask = await chatRepo.updateTaskToolContext(taskId, nextToolContext);
                return reply.send({
                    success: true,
                    task: updatedTask,
                });
            } catch (error: any) {
                fastify.log.error('Error reporting chain switch result:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'reportChainSwitchResult'));
            }
        }
    );

    // =============================================
    // Chunk Polling Endpoint (for non-WebSocket clients)
    // =============================================

    // Poll for new chunks
    fastify.get<{ Params: { messageId: string } }>(
        '/messages/:messageId/chunks',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { messageId: string } }>, reply: FastifyReply) => {
            try {
                const { messageId } = request.params;
                const afterIndex = (request.query as any).after;

                const chunks = await chatRepo.getMessageChunks(
                    messageId,
                    afterIndex !== undefined ? parseInt(afterIndex, 10) : undefined
                );

                const message = await chatRepo.getMessage(messageId);
                if (!message) {
                    return reply.code(404).send({ error: 'Message not found' });
                }

                // Verify ownership (message -> session -> user)
                const userId = (request as any).user?.sub;
                const session = await chatRepo.getSession(message.sessionId);
                if (!session || session.userId !== userId) {
                    return reply.code(403).send({ error: 'Access denied' });
                }

                return reply.send({
                    success: true,
                    chunks,
                    messageStatus: message?.status,
                    isComplete: message?.status === 'complete' || message?.status === 'error',
                });
            } catch (error: any) {
                fastify.log.error('Error getting chunks:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'getChunks'));
            }
        }
    );

    // =============================================
    // Suggestions Endpoint
    // =============================================

    fastify.get(
        '/suggestions',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }

                // Inline suggestion logic (Service stub removed)
                const suggestions = [
                    { text: "What's trending in crypto today?", category: 'market', priority: 1 },
                    { text: "Show me my wallet balance", category: 'wallet', priority: 2 },
                    { text: "What are the top gainers?", category: 'market', priority: 3 },
                ];

                return reply.send({
                    success: true,
                    suggestions
                });
            } catch (error: any) {
                fastify.log.error('Error generating suggestions:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'getSuggestions'));
            }
        }
    );

    // Deprecated endpoint kept for compatibility; moderation DB logging has been removed.
    fastify.post(
        '/moderation/log',
        { preHandler: requireAuth },
        async (_request: FastifyRequest, reply: FastifyReply) => {
            return reply.send({ success: true, skipped: true });
        }
    );
}
