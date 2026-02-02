/**
 * Chat Routes - Backend-Task-Based Chat System
 * Replaces frontend-driven AI calls with backend worker + WebSocket streaming
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import * as chatRepo from '../repositories/chatRepository.js';
import { trackChatMessage } from '../services/userActivityService.js';
import prisma from '../db/prisma.js';
import { redact } from '../utils/sanitizer.js';
import { sanitizedErrorResponse } from '../utils/securityUtils.js';
import { evaluateUsageAccess } from '../services/usageAccess.js';
import { getWalletBalance } from '../services/alchemy.js';
import { ethers } from 'ethers';

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

                const messages = await chatRepo.getSessionMessages(sessionId);
                const activeTask = await chatRepo.getSessionActiveTask(sessionId);

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
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;
                const {
                    content,
                    model,
                    walletAddress,
                    chainId,
                    toolConfig,
                    balance,
                    nativeBalance,
                    currentPage,
                    pageContext,
                    context,
                } = request.body;

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

                // Check for active task (prevent concurrent messages)
                const activeTask = await chatRepo.getSessionActiveTask(sessionId);
                if (activeTask) {
                    return reply.code(409).send({
                        error: 'An AI task is already running for this session',
                        taskId: activeTask.id,
                        status: activeTask.status,
                    });
                }

                const taskModel = model || session.model || 'deepseek-chat';
                let billingContext: { isFree: boolean; modelCategory: string } | undefined;

                try {
                    const usageDecision = await evaluateUsageAccess({
                        userId,
                        model: taskModel
                    });

                    if (!usageDecision.allowed) {
                        return reply.code(429).send({
                            error: 'Daily limit reached',
                            reason: usageDecision.reason,
                            dateUtc: usageDecision.dateUtc,
                            totalUsed: usageDecision.totalUsed,
                            totalLimit: usageDecision.totalLimit,
                            tokenBalance: usageDecision.tokenBalance
                        });
                    }

                    billingContext = {
                        isFree: true,
                        modelCategory: usageDecision.modelCategory
                    };
                } catch (usageError: any) {
                    fastify.log.error('Usage limit check failed:', usageError);
                    return reply.code(500).send({
                        error: 'Usage limit check failed',
                        reason: 'USAGE_CHECK_FAILED'
                    });
                }

                // Create user message
                const userMessage = await chatRepo.createMessage(sessionId, 'user', content.trim());

                // Track user activity (need internal User ID, not privyDid)
                // Session.userId IS privyDid in this context, so we need to look up the User
                const userRecord = await prisma.user.findUnique({ where: { privyDid: userId } });
                if (userRecord) {
                    trackChatMessage(userRecord.id);
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
                    // FORCED: All users use allowance_trade mode (instant execution)
                    allowanceMode = 'instant'; // Always instant now
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
                if (!resolvedWalletAddress && userId) {
                    try {
                        if (chainId === 900) {
                            const { getSolanaEmbeddedWalletAddress } = await import('../services/privyWallet.js');
                            resolvedWalletAddress = (await getSolanaEmbeddedWalletAddress(userId)) || undefined;
                        } else {
                            const { getEmbeddedWalletAddress } = await import('../services/privyWallet.js');
                            resolvedWalletAddress = (await getEmbeddedWalletAddress(userId)) || undefined;
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
                    137: 'MATIC',
                };

                let resolvedBalance = balance;
                let resolvedNativeBalance = nativeBalance;
                const needsNativeBalance =
                    resolvedNativeBalance === undefined ||
                    resolvedNativeBalance === null ||
                    resolvedNativeBalance === '';
                const needsTokenBalances = !resolvedBalance || Object.keys(resolvedBalance).length === 0;
                const shouldHydrateWalletSnapshot =
                    resolvedWalletAddress &&
                    chainId &&
                    chainId !== 900 &&
                    (needsTokenBalances || needsNativeBalance);

                if (shouldHydrateWalletSnapshot && resolvedWalletAddress) {
                    try {
                        const chainName = chainIdToName[chainId] || 'eth';
                        const walletSnapshot = await getWalletBalance(resolvedWalletAddress, chainName);
                        const tokenBalances = walletSnapshot?.tokens || [];
                        const hydrated: Record<string, string> = needsTokenBalances ? {} : { ...(resolvedBalance || {}) };

                        if (walletSnapshot?.ethBalanceFormatted !== undefined) {
                            const nativeSymbol = nativeSymbolMap[chainId] || 'ETH';
                            hydrated[nativeSymbol] = String(walletSnapshot.ethBalanceFormatted);
                            resolvedNativeBalance = String(walletSnapshot.ethBalanceFormatted);
                        }

                        if (needsTokenBalances) {
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
                        }

                        resolvedBalance = hydrated;
                    } catch (e) {
                        fastify.log.warn({ err: e }, 'Failed to hydrate wallet balance for chat task');
                    }
                }

                const task = await chatRepo.createTask(
                    sessionId,
                    taskModel,
                    userMessage.id,
                    assistantMessage.id,
                    {
                        userId,
                        sessionId, // Add sessionId to toolContext for backend execution
                        walletAddress: resolvedWalletAddress,
                        chainId,
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

                // Update session model if different
                if (model && model !== session.model) {
                    await chatRepo.updateSession(sessionId, { model });
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

                // Mark task as cancelled
                const updatedTask = await chatRepo.updateTaskStatus(taskId, 'cancelled');

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

    // =============================================
    // Moderation Logging (Frontend Checks)
    // =============================================

    fastify.post(
        '/moderation/log',
        { preHandler: requireAuth },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                const { channel, content, result, sessionId, model } = request.body as any;

                const sanitizedContent = redact(content);
                console.log(`[ModerationLog] Received backend request: channel=${channel}, userId=${userId}, content=${sanitizedContent?.slice(0, 20)}...`);

                await chatRepo.createModerationLog(
                    userId,
                    channel || 'frontend',
                    content,
                    result,
                    sessionId,
                    model
                );

                return reply.send({ success: true });
            } catch (error: any) {
                fastify.log.error('Error logging moderation:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'logModeration'));
            }
        }
    );
}
