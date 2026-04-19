"use strict";
/**
 * Chat Repository
 * Database operations for chat sessions, messages, and AI tasks
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.getSession = getSession;
exports.getUserSessions = getUserSessions;
exports.updateSession = updateSession;
exports.updateSessionConversationState = updateSessionConversationState;
exports.deleteSession = deleteSession;
exports.createMessage = createMessage;
exports.getMessage = getMessage;
exports.getSessionMessages = getSessionMessages;
exports.updateMessage = updateMessage;
exports.createTask = createTask;
exports.getTask = getTask;
exports.getTaskStatus = getTaskStatus;
exports.claimQueuedTasks = claimQueuedTasks;
exports.updateTaskStatus = updateTaskStatus;
exports.updateTaskToolContext = updateTaskToolContext;
exports.getSessionActiveTask = getSessionActiveTask;
exports.createChunk = createChunk;
exports.getMessageChunks = getMessageChunks;
exports.getLatestChunkIndex = getLatestChunkIndex;
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
//       model that matches the product-default model policy, and let chat
//       tasks remain non-claimable until request-time prerequisites finish.
// Owns: chat session persistence defaults, task persistence defaults, and
//       model normalization at write time.
// Does Not Own: frontend dropdown state, model pricing, or X mention routing.
// Design Language:
// - Normalize model ids before persisting them into ChatSession.
// - Use one canonical default model across all new session creation paths.
// - Do not let empty model inputs silently fall back to a legacy model.
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
// - /Users/almurat/KiKo/system-journal/conflicts.md
var prisma_js_1 = require("../db/prisma.js");
var chatModels_js_1 = require("../config/chatModels.js");
// =============================================
// Session Operations
// =============================================
function createSession(userId, title, model) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedModel;
        return __generator(this, function (_a) {
            normalizedModel = (0, chatModels_js_1.normalizeSupportedChatModel)(model);
            return [2 /*return*/, prisma_js_1.default.chatSession.create({
                    data: {
                        userId: userId,
                        title: title || 'New Chat',
                        model: normalizedModel,
                        status: 'active'
                    }
                })];
        });
    });
}
function getSession(sessionId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma_js_1.default.chatSession.findUnique({
                    where: { id: sessionId }
                })];
        });
    });
}
function getUserSessions(userId_1) {
    return __awaiter(this, arguments, void 0, function (userId, limit, offset) {
        var take, skip;
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __generator(this, function (_a) {
            take = Number(limit) || 50;
            skip = Number(offset) || 0;
            return [2 /*return*/, prisma_js_1.default.chatSession.findMany({
                    where: { userId: userId, status: 'active' },
                    orderBy: { updatedAt: 'desc' },
                    take: take,
                    skip: skip
                })];
        });
    });
}
function updateSession(sessionId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma_js_1.default.chatSession.update({
                    where: { id: sessionId },
                    data: updates
                })];
        });
    });
}
function updateSessionConversationState(sessionId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma_js_1.default.chatSession.update({
                    where: { id: sessionId },
                    data: __assign(__assign(__assign({}, (updates.lastResponseId !== undefined ? { lastResponseId: updates.lastResponseId } : {})), (updates.compactionCursor !== undefined ? { compactionCursor: updates.compactionCursor } : {})), (updates.conversationStateVersion !== undefined ? { conversationStateVersion: updates.conversationStateVersion } : {})),
                })];
        });
    });
}
function deleteSession(sessionId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma_js_1.default.chatSession.delete({
                            where: { id: sessionId }
                        })];
                case 1:
                    _b.sent();
                    return [2 /*return*/, true];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// =============================================
// Message Operations
// =============================================
function createMessage(sessionId_1, role_1, content_1) {
    return __awaiter(this, arguments, void 0, function (sessionId, role, content, options) {
        var lastMessage, messageIndex, message;
        var _a;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.chatMessage.findFirst({
                        where: { sessionId: sessionId },
                        orderBy: { messageIndex: 'desc' },
                        select: { messageIndex: true }
                    })];
                case 1:
                    lastMessage = _b.sent();
                    messageIndex = ((_a = lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.messageIndex) !== null && _a !== void 0 ? _a : -1) + 1;
                    return [4 /*yield*/, prisma_js_1.default.chatMessage.create({
                            data: {
                                sessionId: sessionId,
                                role: role,
                                content: content,
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
                                messageIndex: messageIndex,
                                status: options.status || 'complete',
                            }
                        })];
                case 2:
                    message = _b.sent();
                    // Touch the parent session to bump its priority in sorting
                    return [4 /*yield*/, prisma_js_1.default.chatSession.update({
                            where: { id: sessionId },
                            data: { updatedAt: new Date() }
                        })];
                case 3:
                    // Touch the parent session to bump its priority in sorting
                    _b.sent();
                    // Convert back field names for compatibility if needed, or rely on Prisma types
                    return [2 /*return*/, mapPrismaMessage(message)];
            }
        });
    });
}
function getMessage(messageId) {
    return __awaiter(this, void 0, void 0, function () {
        var message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.chatMessage.findUnique({
                        where: { id: messageId }
                    })];
                case 1:
                    message = _a.sent();
                    return [2 /*return*/, message ? mapPrismaMessage(message) : null];
            }
        });
    });
}
function getSessionMessages(sessionId, afterIndex) {
    return __awaiter(this, void 0, void 0, function () {
        var messages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.chatMessage.findMany({
                        where: __assign({ sessionId: sessionId }, (afterIndex !== undefined ? { messageIndex: { gt: afterIndex } } : {})),
                        orderBy: { messageIndex: 'asc' }
                    })];
                case 1:
                    messages = _a.sent();
                    return [2 /*return*/, messages.map(mapPrismaMessage)];
            }
        });
    });
}
function updateMessage(messageId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var data, message;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    data = {};
                    if (updates.content !== undefined)
                        data.content = updates.content;
                    if (updates.reasoning_content !== undefined)
                        data.reasoningContent = updates.reasoning_content;
                    if (updates.citations !== undefined)
                        data.citations = JSON.stringify(updates.citations);
                    if (updates.usage !== undefined)
                        data.usage = JSON.stringify(updates.usage);
                    if (updates.tool_calls !== undefined)
                        data.toolCalls = JSON.stringify(updates.tool_calls);
                    if (updates.type !== undefined)
                        data.type = updates.type;
                    if (updates.data !== undefined)
                        data.data = JSON.stringify(updates.data);
                    if (updates.transactionStatus !== undefined)
                        data.transactionStatus = updates.transactionStatus;
                    if (updates.transactionHash !== undefined)
                        data.transactionHash = updates.transactionHash;
                    if (updates.status !== undefined)
                        data.status = updates.status;
                    if (updates.feedback !== undefined)
                        data.feedback = updates.feedback;
                    if (updates.compacted_data !== undefined)
                        data.compactedData = JSON.stringify(updates.compacted_data);
                    return [4 /*yield*/, (0, prisma_js_1.withRetry)(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, prisma_js_1.default.chatMessage.update({
                                        where: { id: messageId },
                                        data: data
                                    })];
                            });
                        }); })];
                case 1:
                    message = _a.sent();
                    return [2 /*return*/, mapPrismaMessage(message)];
            }
        });
    });
}
// Helper to map Prisma result to expected interface (snake_case conversion if needed)
function mapPrismaMessage(msg) {
    return __assign(__assign({}, msg), { reasoning_content: msg.reasoningContent, tool_calls: msg.toolCalls ? JSON.parse(msg.toolCalls) : undefined, data: msg.data ? JSON.parse(msg.data) : undefined, citations: msg.citations ? JSON.parse(msg.citations) : undefined, usage: msg.usage ? JSON.parse(msg.usage) : undefined, compacted_data: msg.compactedData ? JSON.parse(msg.compactedData) : undefined, created_at: msg.createdAt });
}
// =============================================
// AI Task Operations
// =============================================
function createTask(sessionId_1, model_1, userMessageId_1, assistantMessageId_1, toolContext_1) {
    return __awaiter(this, arguments, void 0, function (sessionId, model, userMessageId, assistantMessageId, toolContext, options) {
        var task;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.aITask.create({
                        data: {
                            sessionId: sessionId,
                            model: model,
                            userMessageId: userMessageId,
                            assistantMessageId: assistantMessageId,
                            toolContext: toolContext ? JSON.stringify(toolContext) : null,
                            status: options.status || 'queued',
                        }
                    })];
                case 1:
                    task = _a.sent();
                    return [2 /*return*/, mapPrismaTask(task)];
            }
        });
    });
}
function getTask(taskId) {
    return __awaiter(this, void 0, void 0, function () {
        var task;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.aITask.findUnique({
                        where: { id: taskId }
                    })];
                case 1:
                    task = _a.sent();
                    return [2 /*return*/, task ? mapPrismaTask(task) : null];
            }
        });
    });
}
function getTaskStatus(taskId) {
    return __awaiter(this, void 0, void 0, function () {
        var task;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.aITask.findUnique({
                        where: { id: taskId },
                        select: { status: true }
                    })];
                case 1:
                    task = _a.sent();
                    return [2 /*return*/, task];
            }
        });
    });
}
/**
 * Atomically claim queued tasks and mark them as running.
 * Uses Postgres row locking to avoid multi-worker duplicate processing.
 */
function claimQueuedTasks() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var rows;
        var _this = this;
        if (limit === void 0) { limit = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, prisma_js_1.withRetry)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var _this = this;
                        return __generator(this, function (_a) {
                            return [2 /*return*/, prisma_js_1.default.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var claimed;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.$queryRawUnsafe("\n                WITH picked AS (\n                    SELECT id\n                    FROM \"AITask\"\n                    WHERE status = 'queued'\n                    ORDER BY \"createdAt\" ASC\n                    FOR UPDATE SKIP LOCKED\n                    LIMIT $1\n                )\n                UPDATE \"AITask\" t\n                SET\n                    status = 'running',\n                    \"startedAt\" = NOW()\n                FROM picked\n                WHERE t.id = picked.id\n                RETURNING t.*;\n            ", limit)];
                                            case 1:
                                                claimed = _a.sent();
                                                return [2 /*return*/, claimed];
                                        }
                                    });
                                }); })];
                        });
                    }); })];
                case 1:
                    rows = _a.sent();
                    return [2 /*return*/, rows.map(mapPrismaTask)];
            }
        });
    });
}
function updateTaskStatus(taskId, status, errorMessage) {
    return __awaiter(this, void 0, void 0, function () {
        var data, task;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    data = { status: status };
                    if (status === 'running')
                        data.startedAt = new Date();
                    if (['done', 'error', 'cancelled'].includes(status))
                        data.completedAt = new Date();
                    if (errorMessage)
                        data.errorMessage = errorMessage;
                    return [4 /*yield*/, prisma_js_1.default.aITask.update({
                            where: { id: taskId },
                            data: data
                        })];
                case 1:
                    task = _a.sent();
                    return [2 /*return*/, mapPrismaTask(task)];
            }
        });
    });
}
function updateTaskToolContext(taskId, toolContext) {
    return __awaiter(this, void 0, void 0, function () {
        var task;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.aITask.update({
                        where: { id: taskId },
                        data: {
                            toolContext: toolContext ? JSON.stringify(toolContext) : null,
                        },
                    })];
                case 1:
                    task = _a.sent();
                    return [2 /*return*/, mapPrismaTask(task)];
            }
        });
    });
}
function getSessionActiveTask(sessionId) {
    return __awaiter(this, void 0, void 0, function () {
        var task;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.aITask.findFirst({
                        where: {
                            sessionId: sessionId,
                            status: { in: ['pending', 'queued', 'running'] }
                        },
                        orderBy: { createdAt: 'desc' }
                    })];
                case 1:
                    task = _a.sent();
                    return [2 /*return*/, task ? mapPrismaTask(task) : null];
            }
        });
    });
}
function mapPrismaTask(task) {
    var parsedToolContext = task.toolContext ? JSON.parse(task.toolContext) : undefined;
    return __assign(__assign({}, task), { session_id: task.sessionId, user_message_id: task.userMessageId, assistant_message_id: task.assistantMessageId, toolContext: parsedToolContext, tool_context: parsedToolContext, error_message: task.errorMessage, started_at: task.startedAt, completed_at: task.completedAt, created_at: task.createdAt });
}
// =============================================
// Message Chunk Operations
// =============================================
function createChunk(messageId, chunkIndex, chunkType, content, reasoningContent, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, prisma_js_1.withRetry)(function () { return __awaiter(_this, void 0, void 0, function () {
                    var chunk;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, prisma_js_1.default.messageChunk.upsert({
                                    where: {
                                        messageId_chunkIndex: {
                                            messageId: messageId,
                                            chunkIndex: chunkIndex
                                        }
                                    },
                                    update: {
                                        content: content,
                                        reasoningContent: reasoningContent,
                                        metadata: metadata ? JSON.stringify(metadata) : null
                                    },
                                    create: {
                                        messageId: messageId,
                                        chunkIndex: chunkIndex,
                                        chunkType: chunkType,
                                        content: content,
                                        reasoningContent: reasoningContent,
                                        metadata: metadata ? JSON.stringify(metadata) : null
                                    }
                                })];
                            case 1:
                                chunk = _a.sent();
                                return [2 /*return*/, __assign(__assign({}, chunk), { message_id: chunk.messageId, reasoning_content: chunk.reasoningContent })];
                        }
                    });
                }); })];
        });
    });
}
function getMessageChunks(messageId, afterIndex) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, prisma_js_1.default.messageChunk.findMany({
                    where: __assign({ messageId: messageId }, (afterIndex !== undefined ? { chunkIndex: { gt: afterIndex } } : {})),
                    orderBy: { chunkIndex: 'asc' }
                })];
        });
    });
}
function getLatestChunkIndex(messageId) {
    return __awaiter(this, void 0, void 0, function () {
        var chunk;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma_js_1.default.messageChunk.findFirst({
                        where: { messageId: messageId },
                        orderBy: { chunkIndex: 'desc' },
                        select: { chunkIndex: true }
                    })];
                case 1:
                    chunk = _b.sent();
                    return [2 /*return*/, (_a = chunk === null || chunk === void 0 ? void 0 : chunk.chunkIndex) !== null && _a !== void 0 ? _a : -1];
            }
        });
    });
}
