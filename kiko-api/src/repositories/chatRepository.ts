/**
 * Chat Repository
 * Database operations for chat sessions, messages, and AI tasks
 */

import prisma, { withRetry } from '../db/prisma.js';


// Types (re-exported from Prisma or defined locally if needed)
export interface ChatSession {
    id: string;
    userId: string;
    title: string;
    model: string;
    status: 'active' | 'archived';
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
    status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
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
    model?: string
): Promise<any> {
    const normalizedModel = (() => {
        const normalized = (model || '').toLowerCase().trim();
        if (!normalized) return 'deepseek-chat';
        if (normalized === 'gpt5-2' || normalized === 'gpt-5.2') return 'gpt-5-mini';
        return normalized;
    })();
    return prisma.chatSession.create({
        data: {
            userId,
            title: title || 'New Chat',
            model: normalizedModel,
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
    updates: Partial<Pick<ChatSession, 'title' | 'model' | 'status'>>
): Promise<any> {
    return prisma.chatSession.update({
        where: { id: sessionId },
        data: updates
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
            type: options.type || 'text',
            data: options.data ? JSON.stringify(options.data) : null,
            transactionStatus: options.transactionStatus,
            transactionHash: options.transactionHash,
            messageIndex,
            status: options.status || 'complete',
        }
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
    toolContext?: any
): Promise<any> {
    const task = await prisma.aITask.create({
        data: {
            sessionId,
            model,
            userMessageId,
            assistantMessageId,
            toolContext: toolContext ? JSON.stringify(toolContext) : null,
            status: 'queued'
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

// For queue processing - simplistic approach
// Note: Prisma doesn't support 'FOR UPDATE SKIP LOCKED' easily without raw queries.
// We'll stick to raw query for the queue fetch to ensure concurrency safety.
export async function getQueuedTasks(limit = 10): Promise<AITask[]> {
    const tasks = await withRetry(async () => {
        return prisma.aITask.findMany({
            where: { status: 'queued' },
            orderBy: { createdAt: 'asc' },
            take: limit
        });
    });
    return tasks.map(mapPrismaTask);
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

export async function getSessionActiveTask(sessionId: string): Promise<any> {
    const task = await prisma.aITask.findFirst({
        where: {
            sessionId,
            status: { in: ['queued', 'running'] }
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
