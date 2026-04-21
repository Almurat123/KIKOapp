/**
 * Chat Routes - Backend-Task-Based Chat System
 * Replaces frontend-driven AI calls with backend worker + WebSocket streaming
 */

// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: chat message creation now also has to accept image uploads and keep
//         sent image bubbles visible after refresh. Generated-image replies now
//         share the same session/message/task surface, but they bypass the text
//         worker so this route owner must expose a dedicated image-generation
//         entrypoint while still coordinating upload preparation, task binding,
//         private message attachment persistence, and model eligibility checks
//         at the request boundary. It now also captures the selected
//         reasoning-effort hint so the downstream task snapshot can preserve
//         GPT-family thinking strength across the worker and gateway chain. A
//         2026-04-19 runtime trace showed text turns emitted `message_start`
//         both here and in ChatStreamBroker, so normal text start ownership was
//         moved back to the worker/broker boundary.
// Goal: preserve the existing chat session/task flow while allowing image
//       inputs to be uploaded, validated, bound to one text task, and
//       rehydrated into refreshed chat history without persisting image binaries
//       or public image URLs in the database for ordinary chat images, while
//       also allowing generated image replies to run through the same transcript
//       with a dedicated direct-execution task path. Farcaster-generated image
//       rows may carry an opt-in public URL because cast embeds require durable
//       fetchable media URLs.
// Owns: authenticated chat upload preparation endpoints, send-message request
//       validation, usage/task gating, task-time image binding, dedicated
//       generated-image route validation, and client-safe history attachment
//       hydration plus the persisted model/reasoning hint.
// Does Not Own: object storage internals, UI upload state, provider-specific
//               multimodal prompt assembly, or generated-image provider
//               execution order.
// Design Language:
// - Chat images are private durable message assets after a successful send.
// - Reject image turns for models that are not wired for image understanding.
// - Discard prepared uploads when the request is blocked before task execution.
// - Finalize prepared uploads as soon as browser PUT completes, before send.
// - Let the frontend discard prepared uploads that were selected but never sent.
// - Keep image-bearing tasks non-claimable until upload binding has completed.
// - Store private object references in ChatMessage.data, not signed/public URLs
//   for ordinary chat images.
// - Farcaster generated-image publication may persist a public URL attached to
//   that generated-image record; this exception belongs to the storage/task
//   owners, not this route owner.
// - Hydrate signed preview URLs at response time and never expose R2 object keys.
// - Preserve selected GPT reasoning effort in task context instead of inferring it later.
// - Persist the user-facing reasoning level on new chat sessions so refreshes
//   can restore GPT-family strength instead of collapsing to the default.
// - Generated-image turns reuse the chat transcript but must not be normalized into text model ids.
// - Generated-image route validation may create chat messages and tasks, but provider execution belongs to the generated-image task owner.
// - Session hydration must not revive a generated-image task whose assistant
//   message already reached a terminal state in durable storage.
// - Public generated-image embeds should be served through an API-owned public
//   route instead of assuming an external CDN can map raw object keys.
// - Text chat routes should broadcast task status only; assistant `message_start`
//   belongs to ChatStreamBroker so each assistant id starts once.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: request-bound upload preparation and task binding flow
// - Verification: verified in code
// - Source: Cloudflare R2 Presigned URLs / Configure CORS docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: browser upload preparation route and signed URL usage
// - Verification: verified in docs and code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: task queue handoff after image upload binding completes
// - Verification: verified in runtime log and code
// - Source: operator correction that refreshed chat history must preserve image bubbles
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: private message attachment persistence and client-safe signed preview hydration
// - Verification: verified in code
// - Source: OpenAI Image generation guide and xAI Image / Streaming docs
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: dedicated generated-image chat route and provider capability boundary
// - Verification: verified in docs
// - Source: operator correction on 2026-04-19 for production-stable Farcaster image embeds
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: documenting the Farcaster-generated-image public URL exception
// - Verification: verified in code
// - Source: operator browser console and app.log trace cmo5a4f1h03sjj5et046ndecy
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: removing duplicate text-route message_start broadcast
// - Verification: verified in runtime logs and code
// - Source: operator screenshots on 2026-04-20 showing a completed generated
//   image stuck behind a running front-end task and a Farcaster public image
//   embed resolving to a broken `cdn.kikoapp.app` card
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: stale active-task suppression during session hydration and
//   API-owned public generated-image proxy serving
// - Verification: verified in code
// - Source: operator Farcaster web screenshot and live Cloudflare resize URL
//   error `ERROR 9408: Could not fetch the image` on 2026-04-20
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: serving public generated-image proxy responses with
//   cross-origin-friendly image headers for web/CDN image transforms
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-public-proxy-and-task-hydration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-public-image-origin-and-message-preservation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import * as chatRepo from '../repositories/chatRepository.js';
import { trackChatMessage } from '../services/userActivityService.js';
import { chatWS } from '../services/chatWebSocket.js';
import { chatWorker } from '../jobs/chatWorker.js';
import prisma from '../db/prisma.js';
import { sanitizedErrorResponse } from '../utils/securityUtils.js';
import { evaluateUsageAccess, getUsageLimitMessage, isCurrentRequestFree } from '../services/usageAccess.js';
import { getWalletBalance } from '../services/alchemy.js';
import { ethers } from 'ethers';
import cacheClient from '../cache/cacheClient.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { normalizeSupportedChatModel } from '../config/chatModels.js';
import { resolveToolContextChainSwitchAck } from '../jobs/chat/toolContextChainState.js';
import { recordUsage } from '../services/usageCounter.js';
import {
    bindPreparedChatImageUploadsToTask,
    buildChatImageMessageAttachments,
    cleanupTaskChatImageUploads,
    discardPreparedChatImageUploads,
    finalizePreparedChatImageUploads,
    hydrateGeneratedChatImageDataForClient,
    hydrateChatImageAttachmentsForClient,
    isChatImageUploadError,
    loadPublicGeneratedChatImageObject,
    prepareChatImageUploads,
    supportsChatImageModel,
    type ChatImageUploadRequest,
} from '../services/chatImageUploads.js';
import { buildGeneratedImagePendingData, startGeneratedImageChatTask } from '../services/generatedImageChatTask.js';
import { supportsGeneratedImageReferenceInputModel } from '../services/generatedImageProviders.js';

// Request body types
interface CreateSessionBody {
    title?: string;
    model?: string;
    reasoningLevel?: string;
}

interface PrepareImageUploadsBody {
    files: ChatImageUploadRequest[];
}

interface DiscardImageUploadsBody {
    uploadIds: string[];
}

interface FinalizeImageUploadsBody {
    uploadIds: string[];
}

interface SendMessageBody {
    content: string;
    model?: string;
    reasoningEffort?: string;
    imageUploadIds?: string[];
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

interface GenerateImageBody {
    prompt: string;
    model?: string;
    imageQuality?: string;
    imageUploadIds?: string[];
}

interface UpdateSessionBody {
    title?: string;
    model?: string;
    reasoningLevel?: string;
    status?: 'active' | 'archived';
}

interface ReportChainSwitchBody {
    chainId?: number;
    chainName?: string;
    status: 'success' | 'failed';
    error?: string;
}

function normalizeTaskModel(model?: string): string {
    return normalizeSupportedChatModel(model);
}

function isGeneratedImageModel(model?: string | null): boolean {
    const normalized = String(model || '').trim().toLowerCase();
    return normalized.startsWith('gpt-image-1-mini')
        || normalized.startsWith('gpt-image-1.5')
        || normalized.startsWith('grok-imagine-image');
}

async function discardPreparedUploadsSafely(
    fastify: FastifyInstance,
    userId: string | undefined,
    uploadIds: string[],
): Promise<void> {
    if (!userId || uploadIds.length === 0) return;
    try {
        await discardPreparedChatImageUploads({ userId, uploadIds });
    } catch (error) {
        fastify.log.warn({ err: error, userId, uploadCount: uploadIds.length }, 'Failed to discard prepared chat image uploads');
    }
}

async function hydrateChatMessageForClient(message: any): Promise<any> {
    if (!message?.data) return message;
    let hydratedData = message.data;
    if (hydratedData?.attachments) {
        hydratedData = await hydrateChatImageAttachmentsForClient(hydratedData);
    }
    if (hydratedData?.generatedImage?.images) {
        hydratedData = await hydrateGeneratedChatImageDataForClient(hydratedData);
    }
    return {
        ...message,
        data: hydratedData,
    };
}

async function hydrateChatMessagesForClient(messages: any[]): Promise<any[]> {
    return Promise.all(messages.map((message) => hydrateChatMessageForClient(message)));
}

function resolveGeneratedImageTerminalStatus(data: any): 'complete' | 'failed' | null {
    const generatedImage = data?.generatedImage;
    const status = String(generatedImage?.status || '').trim().toLowerCase();
    if (status === 'complete') return 'complete';
    if (status === 'failed') return 'failed';
    return null;
}

function shouldSuppressActiveTaskForHydratedMessages(activeTask: any, rawMessages: any[]): boolean {
    if (!activeTask || !Array.isArray(rawMessages) || rawMessages.length === 0) {
        return false;
    }

    const assistantMessageId = String(activeTask.assistantMessageId || activeTask.assistant_message_id || '').trim();
    if (!assistantMessageId) {
        return false;
    }

    const assistantMessage = rawMessages.find((message) => String(message?.id || '').trim() === assistantMessageId);
    if (!assistantMessage) {
        return false;
    }

    const messageStatus = String(assistantMessage.status || '').trim().toLowerCase();
    if (messageStatus === 'complete' || messageStatus === 'error') {
        return true;
    }

    return resolveGeneratedImageTerminalStatus(assistantMessage.data) !== null;
}

export async function chatRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/generated-images/public/*',
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const wildcardPath = String((request.params as Record<string, unknown>)['*'] || '').trim();
                const objectKey = wildcardPath
                    .split('/')
                    .map((segment) => decodeURIComponent(segment))
                    .join('/');
                const asset = await loadPublicGeneratedChatImageObject(objectKey);
                reply
                    .header('Cache-Control', asset.cacheControl)
                    .header('Access-Control-Allow-Origin', '*')
                    .header('Cross-Origin-Resource-Policy', 'cross-origin')
                    .header('Content-Disposition', 'inline')
                    .type(asset.contentType);
                return reply.send(asset.body);
            } catch (error: any) {
                if (isChatImageUploadError(error)) {
                    return reply.code(error.statusCode || 404).send(error.message);
                }
                fastify.log.warn({ err: error }, 'Error serving public generated chat image');
                return reply.code(404).send('Generated image not found.');
            }
        }
    );

    // =============================================
    // Upload Endpoints
    // =============================================

    fastify.post<{ Body: PrepareImageUploadsBody }>(
        '/uploads/images/prepare',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: PrepareImageUploadsBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }

                const files = Array.isArray(request.body?.files) ? request.body.files : [];
                logger.info(LogCode.AI_API_CALL, 'Chat route: prepareImageUploads received', {
                    userId,
                    fileCount: files.length,
                });
                const uploads = await prepareChatImageUploads({
                    userId,
                    files,
                });

                logger.info(LogCode.AI_API_CALL, 'Chat route: prepareImageUploads complete', {
                    userId,
                    fileCount: uploads.length,
                    uploadIds: uploads.map((upload) => upload.uploadId),
                });

                return reply.send({
                    success: true,
                    uploads,
                });
            } catch (error: any) {
                if (isChatImageUploadError(error)) {
                    return reply.code(error.statusCode || 400).send({ error: error.message });
                }
                fastify.log.error('Error preparing chat image uploads:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'prepareChatImageUploads'));
            }
        }
    );

    fastify.post<{ Body: DiscardImageUploadsBody }>(
        '/uploads/images/discard',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: DiscardImageUploadsBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }

                const uploadIds = Array.from(
                    new Set((Array.isArray(request.body?.uploadIds) ? request.body.uploadIds : [])
                        .map((value) => String(value || '').trim())
                        .filter(Boolean))
                );

                logger.info(LogCode.AI_API_CALL, 'Chat route: discardImageUploads received', {
                    userId,
                    uploadCount: uploadIds.length,
                });

                await discardPreparedChatImageUploads({ userId, uploadIds });

                return reply.send({
                    success: true,
                });
            } catch (error: any) {
                fastify.log.error('Error discarding chat image uploads:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'discardChatImageUploads'));
            }
        }
    );

    fastify.post<{ Body: FinalizeImageUploadsBody }>(
        '/uploads/images/finalize',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Body: FinalizeImageUploadsBody }>, reply: FastifyReply) => {
            try {
                const userId = (request as any).user?.sub;
                if (!userId) {
                    return reply.code(401).send({ error: 'Unauthorized' });
                }

                const uploadIds = Array.from(
                    new Set((Array.isArray(request.body?.uploadIds) ? request.body.uploadIds : [])
                        .map((value) => String(value || '').trim())
                        .filter(Boolean))
                );

                logger.info(LogCode.AI_API_CALL, 'Chat route: finalizeImageUploads received', {
                    userId,
                    uploadCount: uploadIds.length,
                });

                const uploads = await finalizePreparedChatImageUploads({ userId, uploadIds });

                return reply.send({
                    success: true,
                    uploads,
                });
            } catch (error: any) {
                if (isChatImageUploadError(error)) {
                    return reply.code(error.statusCode || 400).send({ error: error.message });
                }
                fastify.log.error('Error finalizing chat image uploads:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'finalizeChatImageUploads'));
            }
        }
    );

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

                const { title, model, reasoningLevel } = request.body;
                const session = await chatRepo.createSession(userId, title, model, reasoningLevel);

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

                const [rawMessages, activeTask] = await Promise.all([
                    chatRepo.getSessionMessages(sessionId),
                    chatRepo.getSessionActiveTask(sessionId)
                ]);
                const messages = await hydrateChatMessagesForClient(rawMessages);
                const clientActiveTask = shouldSuppressActiveTaskForHydratedMessages(activeTask, rawMessages)
                    ? null
                    : activeTask;

                return reply.send({
                    success: true,
                    session,
                    messages,
                    activeTask: clientActiveTask,
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
            let createdTaskId: string | null = null;
            let createdAssistantMessageId: string | null = null;
            let createdTaskReleasedToWorker = false;
            let createdImageAttachmentsPersisted = false;
            try {
                const requestStartedAt = Date.now();
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;
                const {
                    content,
                    model,
                    reasoningEffort,
                    imageUploadIds,
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
                const normalizedImageUploadIds = Array.from(
                    new Set((Array.isArray(imageUploadIds) ? imageUploadIds : []).map((value) => String(value || '').trim()).filter(Boolean))
                );
                const trimmedContent = typeof content === 'string' ? content.trim() : '';
                logger.info(LogCode.AI_API_CALL, 'Chat route: sendMessage received', {
                    userId,
                    sessionId,
                    model: model || null,
                    chainId: chainId ?? undefined,
                    contentLength: trimmedContent.length,
                    imageCount: normalizedImageUploadIds.length,
                });

                if (!trimmedContent && normalizedImageUploadIds.length === 0) {
                    return reply.code(400).send({ error: 'Message content or image input is required' });
                }

                // Verify session ownership
                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(404).send({ error: 'Session not found' });
                }
                if (session.userId !== userId) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(403).send({ error: 'Access denied' });
                }

                const taskModel = normalizeTaskModel(model || session.model);
                if (normalizedImageUploadIds.length > 0 && !supportsChatImageModel(taskModel)) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(400).send({ error: 'The selected model does not support image input.' });
                }

                // Create user message first to ensure it's persisted even if checks fail
                let userMessage = await chatRepo.createMessage(sessionId, 'user', trimmedContent);
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
                let usageDateUtc: string | undefined;

                try {
                    const [activeTask, usageDecision] = await Promise.all([
                        chatRepo.getSessionActiveTask(sessionId),
                        evaluateUsageAccess({
                            userId,
                            model: taskModel
                        })
                    ]);

                    if (activeTask) {
                        await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                        return reply.code(409).send({
                            error: 'An AI task is already running for this session',
                            taskId: activeTask.id,
                            status: activeTask.status,
                            userMessage, // Include userMessage so frontend can sync it
                        });
                    }

                    if (!usageDecision.allowed) {
                        await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                        const limitContent = getUsageLimitMessage(usageDecision);

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
                    usageDateUtc = usageDecision.dateUtc;
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
                createdAssistantMessageId = assistantMessage.id;

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

                let task = await chatRepo.createTask(
                    sessionId,
                    taskModel,
                    userMessage.id,
                    assistantMessage.id,
                    {
                        userId,
                        assistantMessageId: assistantMessage.id,
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
                        reasoningEffort,
                        allowanceMode,
                        balance: resolvedBalance,
                        nativeBalance: resolvedNativeBalance,
                        accessToken,
                        currentPage,
                        pageContext: normalizedPageContext,
                        billing: billingContext,
                    },
                    {
                        status: normalizedImageUploadIds.length > 0 ? 'pending' : 'queued',
                    }
                );
                createdTaskId = task.id;
                if (normalizedImageUploadIds.length > 0) {
                    const boundImages = await bindPreparedChatImageUploadsToTask({
                        userId,
                        taskId: task.id,
                        uploadIds: normalizedImageUploadIds,
                    });
                    if (boundImages.length > 0) {
                        userMessage = await chatRepo.updateMessage(userMessage.id, {
                            data: {
                                ...(userMessage.data || {}),
                                attachments: buildChatImageMessageAttachments(boundImages),
                            },
                        });
                        createdImageAttachmentsPersisted = true;
                    }
                    task = await chatRepo.updateTaskStatus(task.id, 'queued');
                }
                createdTaskReleasedToWorker = true;
                if (billingContext?.modelCategory && usageDateUtc) {
                    try {
                        await recordUsage({
                            userId,
                            dateUtc: usageDateUtc,
                            modelCategory: billingContext.modelCategory,
                            model: taskModel,
                            assistantMessageId: assistantMessage.id,
                        });
                    } catch (usageError) {
                        fastify.log.warn({ err: usageError, sessionId, assistantMessageId: assistantMessage.id }, 'Failed to eagerly record usage count');
                    }
                }
                logger.info(LogCode.AI_API_CALL, 'Chat route: task created', {
                    userId,
                    sessionId,
                    taskId: task.id,
                    assistantMessageId: assistantMessage.id,
                    userMessageId: userMessage.id,
                    model: taskModel,
                    imageCount: normalizedImageUploadIds.length,
                    taskStatus: task.status,
                    routeStageMs: Date.now() - requestStartedAt,
                    walletHydrationMs,
                    walletHydrationAttempted: shouldHydrateWalletSnapshot,
                });

                // Immediately notify frontend to show Thinking. ChatStreamBroker owns
                // assistant message_start so the same assistant id is not started twice.
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
                logger.info(LogCode.AI_API_CALL, 'Chat route: message_start deferred to broker', {
                    userId,
                    sessionId,
                    taskId: task.id,
                    assistantMessageId: assistantMessage.id,
                    model: taskModel,
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
                    const titleSource = trimmedContent || 'Image upload';
                    const title = titleSource.slice(0, 50) + (titleSource.length > 50 ? '...' : '');
                    await chatRepo.updateSession(sessionId, { title });
                }

                const [clientUserMessage, clientAssistantMessage] = await Promise.all([
                    hydrateChatMessageForClient(userMessage),
                    hydrateChatMessageForClient(assistantMessage),
                ]);

                return reply.send({
                    success: true,
                    userMessage: clientUserMessage,
                    assistantMessage: clientAssistantMessage,
                    task,
                });
            } catch (error: any) {
                const userId = (request as any).user?.sub;
                const uploadIds = Array.from(
                    new Set((Array.isArray(request.body?.imageUploadIds) ? request.body.imageUploadIds : []).map((value) => String(value || '').trim()).filter(Boolean))
                );
                await discardPreparedUploadsSafely(fastify, userId, uploadIds);
                if (createdTaskId && !createdTaskReleasedToWorker) {
                    try {
                        await chatRepo.updateTaskStatus(createdTaskId, 'cancelled');
                        await cleanupTaskChatImageUploads(createdTaskId, { deleteObjects: !createdImageAttachmentsPersisted });
                    } catch (cleanupError) {
                        fastify.log.warn({ err: cleanupError, taskId: createdTaskId }, 'Failed to cleanup task-bound chat images after sendMessage error');
                    }
                }
                if (createdAssistantMessageId && !createdTaskReleasedToWorker) {
                    try {
                        await chatRepo.updateMessage(createdAssistantMessageId, { status: 'error' });
                    } catch (messageError) {
                        fastify.log.warn({ err: messageError, messageId: createdAssistantMessageId }, 'Failed to mark assistant message errored after sendMessage error');
                    }
                }
                if (isChatImageUploadError(error)) {
                    return reply.code(error.statusCode || 400).send({ error: error.message });
                }
                fastify.log.error('Error sending message:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'sendMessage'));
            }
        }
    );

    // Generate image inside chat session (creates user message + assistant image placeholder + direct task)
    fastify.post<{ Params: { sessionId: string }; Body: GenerateImageBody }>(
        '/sessions/:sessionId/generated-images',
        { preHandler: requireAuth },
        async (request: FastifyRequest<{ Params: { sessionId: string }; Body: GenerateImageBody }>, reply: FastifyReply) => {
            let createdTaskId: string | null = null;
            let createdAssistantMessageId: string | null = null;
            let createdImageAttachmentsPersisted = false;
            try {
                const userId = (request as any).user?.sub;
                const { sessionId } = request.params;
                const prompt = String(request.body?.prompt || '').trim();
                const requestedModel = String(request.body?.model || '').trim().toLowerCase();
                const imageQuality = String(request.body?.imageQuality || '').trim().toLowerCase() || undefined;
                const normalizedImageUploadIds = Array.from(
                    new Set((Array.isArray(request.body?.imageUploadIds) ? request.body.imageUploadIds : [])
                        .map((value) => String(value || '').trim())
                        .filter(Boolean))
                );

                if (!prompt) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(400).send({ error: 'Image prompt is required' });
                }
                if (!isGeneratedImageModel(requestedModel)) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(400).send({ error: 'Unsupported image model' });
                }
                if (normalizedImageUploadIds.length > 0 && !supportsGeneratedImageReferenceInputModel(requestedModel)) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(400).send({ error: 'The selected image model does not support uploaded-image input yet.' });
                }

                const session = await chatRepo.getSession(sessionId);
                if (!session) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(404).send({ error: 'Session not found' });
                }
                if (session.userId !== userId) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    return reply.code(403).send({ error: 'Access denied' });
                }

                let userMessage = await chatRepo.createMessage(sessionId, 'user', prompt);

                const userRecord = await prisma.user.findUnique({ where: { privyDid: userId } });
                if (userRecord) {
                    trackChatMessage(userRecord.privyDid);
                }

                const activeTask = await chatRepo.getSessionActiveTask(sessionId);
                if (activeTask) {
                    await discardPreparedUploadsSafely(fastify, userId, normalizedImageUploadIds);
                    const assistantMessage = await chatRepo.createMessage(
                        sessionId,
                        'assistant',
                        'Another image or chat task is already running in this session.',
                        { status: 'complete' },
                    );
                    const [clientUserMessage, clientAssistantMessage] = await Promise.all([
                        hydrateChatMessageForClient(userMessage),
                        hydrateChatMessageForClient(assistantMessage),
                    ]);
                    return reply.send({
                        success: true,
                        userMessage: clientUserMessage,
                        assistantMessage: clientAssistantMessage,
                        task: {
                            id: `generated-image-busy-${Date.now()}`,
                            status: 'completed',
                            sessionId,
                            model: requestedModel,
                            createdAt: new Date(),
                        },
                    });
                }

                const pendingGeneratedImage = buildGeneratedImagePendingData({
                    requestedModel,
                    quality: imageQuality,
                    prompt,
                });
                const assistantMessage = await chatRepo.createMessage(sessionId, 'assistant', '', {
                    type: 'generated-image',
                    data: {
                        generatedImage: pendingGeneratedImage,
                    },
                    status: 'streaming',
                });
                createdAssistantMessageId = assistantMessage.id;

                const task = await chatRepo.createTask(
                    sessionId,
                    requestedModel,
                    userMessage.id,
                    assistantMessage.id,
                    {
                        userId,
                        assistantMessageId: assistantMessage.id,
                        sessionId,
                        generatedImage: {
                            requestedModel,
                            quality: imageQuality || null,
                            prompt,
                        },
                    },
                    { status: 'pending' },
                );
                if (normalizedImageUploadIds.length > 0) {
                    const boundImages = await bindPreparedChatImageUploadsToTask({
                        userId,
                        taskId: task.id,
                        uploadIds: normalizedImageUploadIds,
                    });
                    if (boundImages.length > 0) {
                        userMessage = await chatRepo.updateMessage(userMessage.id, {
                            data: {
                                ...(userMessage.data || {}),
                                attachments: buildChatImageMessageAttachments(boundImages),
                            },
                        });
                        createdImageAttachmentsPersisted = true;
                    }
                }
                createdTaskId = task.id;

                chatWS.broadcastToUser(userId, {
                    type: 'task_status',
                    sessionId,
                    data: {
                        taskId: task.id,
                        messageId: assistantMessage.id,
                        status: 'running',
                        message: 'Generating image',
                        taskType: 'image',
                    },
                });
                chatWS.broadcastToUser(userId, {
                    type: 'message_start',
                    sessionId,
                    data: {
                        messageId: assistantMessage.id,
                        role: 'assistant',
                        model: requestedModel,
                        messageType: 'generated-image',
                        data: {
                            generatedImage: pendingGeneratedImage,
                        },
                    },
                });

                const messages = await chatRepo.getSessionMessages(sessionId);
                if (messages.length <= 2) {
                    const title = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');
                    await chatRepo.updateSession(sessionId, { title });
                }

                const [clientUserMessage, clientAssistantMessage] = await Promise.all([
                    hydrateChatMessageForClient(userMessage),
                    hydrateChatMessageForClient(assistantMessage),
                ]);

                const payload = {
                    success: true,
                    userMessage: clientUserMessage,
                    assistantMessage: clientAssistantMessage,
                    task,
                };

                startGeneratedImageChatTask({
                    taskId: task.id,
                    userId,
                    sessionId,
                    assistantMessageId: assistantMessage.id,
                    requestedModel,
                    quality: imageQuality || null,
                    prompt,
                    source: 'web',
                });

                return reply.send(payload);
            } catch (error: any) {
                const userId = (request as any).user?.sub;
                const uploadIds = Array.from(
                    new Set((Array.isArray(request.body?.imageUploadIds) ? request.body.imageUploadIds : []).map((value) => String(value || '').trim()).filter(Boolean))
                );
                await discardPreparedUploadsSafely(fastify, userId, uploadIds);
                if (createdTaskId) {
                    try {
                        await chatRepo.updateTaskStatus(createdTaskId, 'cancelled');
                        await cleanupTaskChatImageUploads(createdTaskId, { deleteObjects: !createdImageAttachmentsPersisted });
                    } catch (taskError) {
                        fastify.log.warn({ err: taskError, taskId: createdTaskId }, 'Failed to cancel generated image task after route error');
                    }
                }
                if (createdAssistantMessageId) {
                    try {
                        await chatRepo.updateMessage(createdAssistantMessageId, { status: 'error' });
                    } catch (messageError) {
                        fastify.log.warn({ err: messageError, messageId: createdAssistantMessageId }, 'Failed to mark generated image assistant errored after route error');
                    }
                }
                fastify.log.error('Error generating image:', error);
                return reply.code(500).send(sanitizedErrorResponse(error, 'generateImage'));
            }
        },
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

                const rawMessages = await chatRepo.getSessionMessages(
                    sessionId,
                    afterIndex !== undefined ? parseInt(afterIndex, 10) : undefined
                );
                const messages = await hydrateChatMessagesForClient(rawMessages);

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

                if (task.status !== 'pending' && task.status !== 'queued' && task.status !== 'running') {
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
