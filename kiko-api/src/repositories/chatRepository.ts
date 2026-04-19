/**
 * Chat Repository
 * Database operations for chat sessions, messages, and AI tasks
 */

// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Almurat
// Reason: session creation previously defaulted to `deepseek-chat`, which
//         drifted from the website default selector and from X mention reply
//         expectations. New sessions now need one canonical default model,
//         currently free Kimi 2.5 Instant/Fast. The chat-image upload flow also
//         exposed a task-claim race: tasks were inserted as `queued`, so the
//         worker could claim them before upload binding finished and then
//         generate without images.
// Goal: ensure every newly created chat session gets a normalized supported
//       model that matches the product-default model policy, preserve the
//       selected reasoning level for split-effort families, and let chat
//       tasks remain non-claimable until request-time prerequisites finish.
// Owns: chat session persistence defaults, persisted reasoning level defaults,
//       task persistence defaults, and model normalization at write time.
// Does Not Own: frontend dropdown state, model pricing, or X mention routing.
// Design Language:
// - Normalize model ids before persisting them into ChatSession.
// - Use one canonical default model across all new session creation paths.
// - Do not let empty model inputs silently fall back to a legacy model.
// - Persisted sessions must retain the selected reasoning level alongside the
//   normalized model id.
// - Chat tasks that still depend on upload binding must not enter the queued
//   worker pool.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: aligning new ChatSession defaults with website and X mention model policy
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: preserving repository session defaults through backend model normalization
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: preventing worker claim before chat-image task binding completes
// - Verification: verified in runtime log and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import prisma, { withRetry } from '../db/prisma.js';
import {
    inferSupportedChatReasoningLevel,
    normalizeSupportedChatModel,
    normalizeSupportedChatReasoningLevel,
} from '../config/chatModels.js';


// Types (re-exported from Prisma or defined locally if needed)
export interface ChatSession {
    id: string;
    userId: string;
    title: string;
    model: string;
    reasoningLevel: string;
    status: 'active' | 'archived';
    lastResponseId?: string;
    compactionCursor?: string;
    conversationStateVersion?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    reasoningContent?: string;
    citations?: any[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    toolCalls?: any[];
    toolCallId?: string;
    compactedData?: any;
    type: string;
    data?: any;
    transactionStatus?: string;
    transactionHash?: string;
    messageIndex: number;
    status: 'streaming' | 'complete' | 'error';
    createdAt: Date;
}

export interface AITask {
    id: string;
    sessionId: string;
    userMessageId?: string;
    assistantMessageId?: string;
    model: string;
    status: 'pending' | 'queued' | 'running' | 'done' | 'error' | 'cancelled';
    errorMessage?: string;
    toolContext?: any;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
}

export interface MessageChunk {
    id: number;
    messageId: string;
    chunkIndex: number;
    content?: string;
    reasoningContent?: string;
    chunkType: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'citation';
    metadata?: any;
    created_at: Date;
}

// =============================================
// Session Operations
// =============================================

export async function createSession(
    userId: string,
    title?: string,
    model?: string,
    reasoningLevel?: string
): Promise<any> {
    const normalizedModel = normalizeSupportedChatModel(model);
    const normalizedReasoningLevel =
        normalizeSupportedChatReasoningLevel(reasoningLevel) ||
        inferSupportedChatReasoningLevel(normalizedModel);
    return prisma.chatSession.create({
        data: {
            userId,
            title: title || 'New Chat',
            model: normalizedModel,
            reasoningLevel: normalizedReasoningLevel,
            status: 'active'
        }
    });
}

export async function getSession(sessionId: string): Promise<any> {
    return prisma.chatSession.findUnique({
        where: { id: sessionId }
    });
}

export async function getUserSessions(
    userId: string,
    limit = 50,
    offset = 0
): Promise<any[]> {
    const take = Number(limit) || 50;
    const skip = Number(offset) || 0;

    return prisma.chatSession.findMany({
        where: { userId, status: 'active' },
        orderBy: { updatedAt: 'desc' },
        take,
        skip
    });
}

export async function updateSession(
    sessionId: string,
    updates: Partial<Pick<ChatSession, 'title' | 'model' | 'reasoningLevel' | 'status'>>
): Promise<any> {
    const normalizedModel = updates.model !== undefined
        ? normalizeSupportedChatModel(updates.model)
        : undefined;
    const normalizedReasoningLevel = updates.reasoningLevel !== undefined
        ? normalizeSupportedChatReasoningLevel(updates.reasoningLevel)
        : updates.model !== undefined
            ? inferSupportedChatReasoningLevel(updates.model)
            : undefined;

    return prisma.chatSession.update({
        where: { id: sessionId },
        data: {
            ...(updates.title !== undefined ? { title: updates.title } : {}),
            ...(normalizedModel !== undefined ? { model: normalizedModel } : {}),
            ...(normalizedReasoningLevel !== undefined ? { reasoningLevel: normalizedReasoningLevel } : {}),
            ...(updates.status !== undefined ? { status: updates.status } : {}),
        }
    });
}

export async function updateSessionConversationState(
    sessionId: string,
    updates: {
        lastResponseId?: string | null;
        compactionCursor?: string | null;
        conversationStateVersion?: number;
    }
): Promise<any> {
    return prisma.chatSession.update({
        where: { id: sessionId },
        data: {
            ...(updates.lastResponseId !== undefined ? { lastResponseId: updates.lastResponseId } : {}),
            ...(updates.compactionCursor !== undefined ? { compactionCursor: updates.compactionCursor } : {}),
            ...(updates.conversationStateVersion !== undefined ? { conversationStateVersion: updates.conversationStateVersion } : {}),
        },
    });
}

export async function deleteSession(sessionId: string): Promise<boolean> {
    try {
        await prisma.chatSession.delete({
            where: { id: sessionId }
        });
        return true;
    } catch {
        return false;
    }
}

// =============================================
// Message Operations
// =============================================

export async function createMessage(
    sessionId: string,
    role: any,
    content: string,
    options: any = {}
): Promise<any> {
    // Get next message index
    const lastMessage = await prisma.chatMessage.findFirst({
        where: { sessionId },
        orderBy: { messageIndex: 'desc' },
        select: { messageIndex: true }
    });
    const messageIndex = (lastMessage?.messageIndex ?? -1) + 1;

    // Create message with relations
    const message = await prisma.chatMessage.create({
        data: {
            sessionId,
            role,
            content,
            reasoningContent: options.reasoning_content,
            citations: options.citations ? JSON.stringify(options.citations) : null,
            usage: options.usage ? JSON.stringify(options.usage) : null,
            toolCalls: options.tool_calls ? JSON.stringify(options.tool_calls) : null,
            toolCallId: options.tool_call_id,
            compactedData: options.compacted_data ? JSON.stringify(options.compacted_data) : null,
            type: options.type || 'text',
            data: options.data ? JSON.stringify(options.data) : null,
            transactionStatus: options.transactionStatus,
            transactionHash: options.transactionHash,
            messageIndex,
            status: options.status || 'complete',
        }
    });

    // Touch the parent session to bump its priority in sorting
    await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() }
    });

    // Convert back field names for compatibility if needed, or rely on Prisma types
    return mapPrismaMessage(message);
}

export async function getMessage(messageId: string): Promise<any> {
    const message = await prisma.chatMessage.findUnique({
        where: { id: messageId }
    });
    return message ? mapPrismaMessage(message) : null;
}

export async function getSessionMessages(
    sessionId: string,
    afterIndex?: number
): Promise<any[]> {
    const messages = await prisma.chatMessage.findMany({
        where: {
            sessionId,
            ...(afterIndex !== undefined ? { messageIndex: { gt: afterIndex } } : {})
        },
        orderBy: { messageIndex: 'asc' }
    });
    return messages.map(mapPrismaMessage);
}

export async function updateMessage(
    messageId: string,
    updates: any
): Promise<any> {
    const data: any = {};
    if (updates.content !== undefined) data.content = updates.content;
    if (updates.reasoning_content !== undefined) data.reasoningContent = updates.reasoning_content;
    if (updates.citations !== undefined) data.citations = JSON.stringify(updates.citations);
    if (updates.usage !== undefined) data.usage = JSON.stringify(updates.usage);
    if (updates.tool_calls !== undefined) data.toolCalls = JSON.stringify(updates.tool_calls);
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.data !== undefined) data.data = JSON.stringify(updates.data);
    if (updates.transactionStatus !== undefined) data.transactionStatus = updates.transactionStatus;
    if (updates.transactionHash !== undefined) data.transactionHash = updates.transactionHash;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.feedback !== undefined) data.feedback = updates.feedback;
    if (updates.compacted_data !== undefined) data.compactedData = JSON.stringify(updates.compacted_data);

    const message = await withRetry(async () => {
        return prisma.chatMessage.update({
            where: { id: messageId },
            data
        });
    });
    return mapPrismaMessage(message);
}

// Helper to map Prisma result to expected interface (snake_case conversion if needed)
function mapPrismaMessage(msg: any): any {
    return {
        ...msg,
        reasoning_content: msg.reasoningContent,
        tool_calls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined,
        data: msg.data ? JSON.parse(msg.data) : undefined,
        citations: msg.citations ? JSON.parse(msg.citations) : undefined,
        usage: msg.usage ? JSON.parse(msg.usage) : undefined,
        compacted_data: msg.compactedData ? JSON.parse(msg.compactedData) : undefined,
        created_at: msg.createdAt,
    };
}

// =============================================
// AI Task Operations
// =============================================

export async function createTask(
    sessionId: string,
    model: string,
    userMessageId: string,
    assistantMessageId: string,
    toolContext?: any,
    options: {
        status?: AITask['status'];
    } = {},
): Promise<any> {
    const task = await prisma.aITask.create({
        data: {
            sessionId,
            model,
            userMessageId,
            assistantMessageId,
            toolContext: toolContext ? JSON.stringify(toolContext) : null,
            status: options.status || 'queued',
        }
    });
    return mapPrismaTask(task);
}

export async function getTask(taskId: string): Promise<any> {
    const task = await prisma.aITask.findUnique({
        where: { id: taskId }
    });
    return task ? mapPrismaTask(task) : null;
}

export async function getTaskStatus(taskId: string): Promise<{ status: string } | null> {
    const task = await prisma.aITask.findUnique({
        where: { id: taskId },
        select: { status: true }
    });
    return task;
}

/**
 * Atomically claim queued tasks and mark them as running.
 * Uses Postgres row locking to avoid multi-worker duplicate processing.
 */
export async function claimQueuedTasks(limit = 10): Promise<AITask[]> {
    const rows = await withRetry(async () => {
        return prisma.$transaction(async (tx) => {
            const claimed = await tx.$queryRawUnsafe<any[]>(`
                WITH picked AS (
                    SELECT id
                    FROM "AITask"
                    WHERE status = 'queued'
                    ORDER BY "createdAt" ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT $1
                )
                UPDATE "AITask" t
                SET
                    status = 'running',
                    "startedAt" = NOW()
                FROM picked
                WHERE t.id = picked.id
                RETURNING t.*;
            `, limit);
            return claimed;
        });
    });
    return rows.map(mapPrismaTask);
}

export async function updateTaskStatus(
    taskId: string,
    status: AITask['status'],
    errorMessage?: string
): Promise<any> {
    const data: any = { status };
    if (status === 'running') data.startedAt = new Date();
    if (['done', 'error', 'cancelled'].includes(status)) data.completedAt = new Date();
    if (errorMessage) data.errorMessage = errorMessage;

    const task = await prisma.aITask.update({
        where: { id: taskId },
        data
    });
    return mapPrismaTask(task);
}

export async function updateTaskToolContext(
    taskId: string,
    toolContext: any,
): Promise<any> {
    const task = await prisma.aITask.update({
        where: { id: taskId },
        data: {
            toolContext: toolContext ? JSON.stringify(toolContext) : null,
        },
    });
    return mapPrismaTask(task);
}

export async function getSessionActiveTask(sessionId: string): Promise<any> {
    const task = await prisma.aITask.findFirst({
        where: {
            sessionId,
            status: { in: ['pending', 'queued', 'running'] }
        },
        orderBy: { createdAt: 'desc' }
    });
    return task ? mapPrismaTask(task) : null;
}

function mapPrismaTask(task: any): any {
    const parsedToolContext = task.toolContext ? JSON.parse(task.toolContext) : undefined;
    return {
        ...task,
        session_id: task.sessionId,
        user_message_id: task.userMessageId,
        assistant_message_id: task.assistantMessageId,
        toolContext: parsedToolContext, // Overwrite with parsed object (chatWorker uses camelCase)
        tool_context: parsedToolContext, // Also keep snake_case for compatibility
        error_message: task.errorMessage,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        created_at: task.createdAt
    };
}

// =============================================
// Message Chunk Operations
// =============================================

export async function createChunk(
    messageId: string,
    chunkIndex: number,
    chunkType: string,
    content?: string,
    reasoningContent?: string,
    metadata?: any
): Promise<any> {
    return withRetry(async () => {
        const chunk = await prisma.messageChunk.upsert({
            where: {
                messageId_chunkIndex: {
                    messageId,
                    chunkIndex
                }
            },
            update: {
                content,
                reasoningContent,
                metadata: metadata ? JSON.stringify(metadata) : null
            },
            create: {
                messageId,
                chunkIndex,
                chunkType,
                content,
                reasoningContent,
                metadata: metadata ? JSON.stringify(metadata) : null
            }
        });
        return {
            ...chunk,
            message_id: chunk.messageId,
            reasoning_content: chunk.reasoningContent
        };
    });
}

export async function getMessageChunks(
    messageId: string,
    afterIndex?: number
): Promise<any[]> {
    return prisma.messageChunk.findMany({
        where: {
            messageId,
            ...(afterIndex !== undefined ? { chunkIndex: { gt: afterIndex } } : {})
        },
        orderBy: { chunkIndex: 'asc' }
    });
}

export async function getLatestChunkIndex(messageId: string): Promise<number> {
    const chunk = await prisma.messageChunk.findFirst({
        where: { messageId },
        orderBy: { chunkIndex: 'desc' },
        select: { chunkIndex: true }
    });
    return chunk?.chunkIndex ?? -1;
}
