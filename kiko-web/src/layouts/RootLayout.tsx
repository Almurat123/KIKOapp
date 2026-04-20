// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: chat text could arrive through WebSocket but still appear all at once
//         if RootLayout buffered multiple chunks into one animation-frame flush.
//         Runtime logs later confirmed backend emitted 11 fast-path chunks while
//         the browser only rendered one update because `sessionPending` merged
//         them before the next frame. RootLayout also owns whether chat
//         completion events may refresh the sidebar quota summary; those
//         refreshes must stay on chat routes so browse pages do not inherit
//         chat-driven read traffic. Generated-image replies now also enter the
//         transcript through `message_start`, so this owner must preserve the
//         backend-declared message type and initial data instead of forcing every
//         assistant placeholder to start as plain text. Chat v2 now also needs
//         `message_start` to be able to retag an already-created assistant
//         placeholder as `generated-image` mid-turn when the model switches the
//         reply into the image tool path. A 2026-04-19 deploy-token loop showed
//         duplicate backend starts can look like frontend subscription leaks, so
//         this layer now logs duplicate starts by assistant id before mutating
//         state. Generated-image terminal payloads can also finish through
//         `update_message_data` before generic task completion cleanup lands, so
//         the active task record must retain the bound assistant message id.
// Goal: make the frontend state boundary observable: incoming chunk count,
//       pending buffer size, flush timing, and message length before/after merge,
//       while applying content/reasoning chunks immediately once the target
//       assistant message already exists in local state, preserving backend
//       message metadata such as generated-image placeholders, including
//       same-message type/data upgrades, and keeping usage refresh broadcasts
//       route-scoped.
// Owns: authenticated chat WebSocket subscription, conversation state merging,
//       and chat-route usage-refresh broadcasts.
// Does Not Own: backend chunk generation, browser WebSocket transport, or bubble styling.
// Design Language:
// - RootLayout stream logs should correlate ws-receive and MessageBubble render logs
// - diagnostics must log lengths/counts, not raw assistant text
// - requestAnimationFrame batching should be visible as flush logs
// - once a target assistant message exists locally, content/reasoning chunks should not wait for a coalescing flush
// - chat-driven quota refreshes must not leak onto non-chat browse pages
// - `message_start` must preserve backend-declared assistant message types and initial data
// - duplicate `message_start` diagnostics must be keyed by session/message id,
//   not by task id, because the route copy may lack task id while the broker copy has it
// - active task state must keep the assistant message id when the backend
//   provides it so later client-action terminal payloads can clear only the matching task
// - active task context matching must prefer the bound assistant message id,
//   not only a mutable task id string, so generated-image terminal events can
//   always clear the right loading state after hydration or reconnect
// Document Provenance:
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: diagnosing whether frontend buffering coalesces backend chunks
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: replacing chunk coalescing with immediate per-message chunk application
// - Verification: verified in runtime log and code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-token-page-read-burst-isolation.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: route-scoped suppression of chat usage-summary refreshes on token and other browse pages
// - Verification: verified in code
// - Source: operator request on 2026-04-18 to stream generated-image placeholders into chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: preserving generated-image message type/data from `message_start`
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: allowing `message_start` to retag an existing assistant row as generated-image
// - Verification: verified in code
// - Source: operator browser console and app.log trace cmo5a4f1h03sjj5et046ndecy
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: duplicate message_start diagnostics and stream event correlation
// - Verification: verified in code
// - Source: operator screenshot and runtime report on 2026-04-19 showing a
//   completed generated-image row while the task spinner stayed active
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: persisting active-task `messageId` context from websocket task events
// - Verification: verified in code
// - Source: operator screenshots on 2026-04-20 showing a generated image row
//   rendered in storage while the chat task still appeared running
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: binding RootLayout active-task cleanup to message context
//   instead of relying only on task id string heuristics
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-token-page-read-burst-isolation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-public-proxy-and-task-hydration.md
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { Layout } from '../components/Layout/Layout';
import { useConversations, type Message } from '../hooks/useConversations';
import { ConversationProvider } from '../contexts/ConversationContext';
import { chatWSClient, type ChatEvent } from '../utils/chatWebSocket';
import { clearActiveTask } from '../utils/taskLifecycle';
import { chatApi } from '../services/api';
import { ToastContainer, useToast } from '../components/Toast';
import { AgentRuntime } from '../agent/AgentRuntime';
import { logger } from '../utils/logger';
import { chatStreamDebug } from '../utils/chatStreamDebug';
import { doesActiveTaskMatchMessage } from '../components/Chat/generatedImageTaskState';

// Global Toast Component
function GlobalToast() {
    const { toasts, handleClose } = useToast();
    return <ToastContainer toasts={toasts} onClose={handleClose} />;
}

export const RootLayout: React.FC = () => {
    const { authenticated, ready, getAccessToken } = usePrivy();
    const navigate = useNavigate();
    const location = useLocation();

    // Core conversation state
    const conversationUtils = useConversations();
    const {
        activeConversationId,
        updateConversation,
        conversationsRef,
        loadConversation,
        updateConversationTitle,
        deleteConversation,
        conversations,

    } = conversationUtils;

    // DEBUG LOG: Trace Component Rendering
    // console.log(`[RootLayout] Render. ActiveConv: ${activeConversationId}, Messages: ${conversations.find(c => c.id === activeConversationId)?.messages.length}`);
    const activeConv = conversations.find(c => c.id === activeConversationId);
    if (activeConv && activeConv.messages.length > 0) {
        const lastMsg = activeConv.messages[activeConv.messages.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
            chatStreamDebug('root-render-streaming-frame', {
                conversationId: activeConv.id,
                messageId: lastMsg.id,
                contentLength: lastMsg.content.length,
                reasoningLength: (lastMsg.reasoning_content || '').length,
            });
        }
    }

    // Derived: session with activeTask is "generating" (sidebar highlight)
    const generatingConversationId = useMemo(
        () => conversations.find(c => c.activeTask != null)?.id ?? null,
        [conversations]
    );
    const isChatRouteRef = useRef(location.pathname === '/' || location.pathname.startsWith('/chat/'));

    // WebSocket message buffering refs
    const pendingByConversationRef = useRef<Map<string, Map<string, Message>>>(new Map());
    const lastProcessedCompletionRef = useRef<string | null>(null);
    const pendingFlushTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const rafScheduledByConversationRef = useRef<Map<string, number>>(new Map());
    const resumeSyncInFlightRef = useRef<Promise<void> | null>(null);
    const lastResumeSyncAtRef = useRef(0);
    const firstChunkLoggedRef = useRef<Set<string>>(new Set());
    const streamChunkStatsRef = useRef<Map<string, { chunks: number; contentLength: number; reasoningLength: number; lastAtMs: number }>>(new Map());
    const messageStartSeenRef = useRef<Map<string, { seq: number | null; taskId: string | null; atMs: number }>>(new Map());

    useEffect(() => {
        isChatRouteRef.current = location.pathname === '/' || location.pathname.startsWith('/chat/');
    }, [location.pathname]);

    // --- WebSocket & Sync Logic (Identical to App.tsx) ---

    const getRouteConversationId = useCallback(() => {
        return location.pathname.startsWith('/chat/')
            ? location.pathname.slice('/chat/'.length).split(/[/?#]/)[0] || null
            : null;
    }, [location.pathname]);

    const syncForegroundConversationState = useCallback(async (reason: string, force = false) => {
        if (!authenticated || !ready) return;

        const routeConversationId = getRouteConversationId();
        const now = Date.now();
        if (!force && now - lastResumeSyncAtRef.current < 1200) {
            return;
        }
        lastResumeSyncAtRef.current = now;

        if (resumeSyncInFlightRef.current) {
            return resumeSyncInFlightRef.current;
        }

        const syncPromise = (async () => {
            try {
                const token = await getAccessToken();
                if (!token) return;

                chatWSClient.connect(token);

                // Only sync the current route conversation.
                // Do NOT revive a backgrounded conversation when the user is on "/".
                if (!routeConversationId) return;

                await loadConversation(routeConversationId);

                const latestConversation = conversationsRef.current.find(c => c.id === routeConversationId);
                if (!latestConversation) return;

                const activeStatus = String(latestConversation.activeTask?.status || '').toLowerCase();
                const hasServerActiveTask = ['queued', 'pending', 'running', 'streaming'].includes(activeStatus);
                const staleStreamingMessages = latestConversation.messages.filter(
                    m => m.role === 'assistant' && m.status === 'streaming'
                );

                if (!hasServerActiveTask && staleStreamingMessages.length > 0) {
                    const repairedMessages = latestConversation.messages.map((message) =>
                        message.role === 'assistant' && message.status === 'streaming'
                            ? { ...message, status: 'complete' as const }
                            : message
                    );
                    updateConversation(routeConversationId, {
                        messages: repairedMessages,
                        activeTask: null,
                    });
                    console.log('[RootLayout] Cleared stale streaming UI after foreground sync', {
                        reason,
                        routeConversationId,
                        repairedCount: staleStreamingMessages.length,
                    });
                    return;
                }

                if (!hasServerActiveTask && latestConversation.activeTask) {
                    clearActiveTask(routeConversationId, updateConversation, `foreground_sync_${reason}`);
                }
            } catch (error) {
                console.error('[RootLayout] Foreground sync failed:', error);
            } finally {
                resumeSyncInFlightRef.current = null;
            }
        })();

        resumeSyncInFlightRef.current = syncPromise;
        return syncPromise;
    }, [authenticated, ready, getAccessToken, getRouteConversationId, loadConversation, conversationsRef, updateConversation]);

    // 1. Visibility & Background Sync
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                void syncForegroundConversationState('visibilitychange');
            }
        };
        const handleFocus = () => {
            if (!document.hidden) {
                void syncForegroundConversationState('focus');
            }
        };
        const handlePageShow = () => {
            void syncForegroundConversationState('pageshow', true);
        };
        const handleOnline = () => {
            if (!document.hidden) {
                void syncForegroundConversationState('online');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('pageshow', handlePageShow);
            window.removeEventListener('online', handleOnline);
        };
    }, [syncForegroundConversationState]);

    // 2. Global WebSocket Listener
    // Use a ref to track if we've already initiated connection for the current auth state
    const hasInitiatedConnectionRef = useRef(false);

    useEffect(() => {
        if (!authenticated || !ready) return;

        // Prevent strictly redundant connection attempts
        if (hasInitiatedConnectionRef.current) return;

        hasInitiatedConnectionRef.current = true;

        getAccessToken().then(token => {
            if (token) chatWSClient.connect(token);
        });

        // No cleanup - we want the connection to persist as long as the user is authenticated.
        // If they logout, the entire app likely reloads or redirects, effectively cleaning up.
    }, [authenticated, ready]); // Removed getAccessToken from deps to be safe, though it should be stable

    // 3. Global Event Subscription
    useEffect(() => {
        if (!authenticated || !ready) return;

        const handleGlobalChatEvent = async (event: ChatEvent) => {
            const targetSessionId = event.sessionId;
            if (!targetSessionId) return;

            // Ensure pending map exists
            if (!pendingByConversationRef.current.has(targetSessionId)) {
                pendingByConversationRef.current.set(targetSessionId, new Map());
            }
            const sessionPending = pendingByConversationRef.current.get(targetSessionId)!;
            const normalizeCitations = (value: any): any[] => {
                if (!value) return [];
                const list = Array.isArray(value) ? value : [value];
                return list.filter((item) => {
                    if (item === null || item === undefined) return false;
                    if (typeof item === 'string') return item.trim().length > 0;
                    if (typeof item === 'object') return true;
                    return false;
                });
            };
            const mergeCitations = (existing: any[] = [], incomingRaw: any = []): any[] => {
                const incoming = normalizeCitations(incomingRaw);
                if (incoming.length === 0) return existing;
                const merged = [...existing];
                const seen = new Set(
                    merged.map((item) => {
                        try {
                            return typeof item?.url === 'string' ? item.url : JSON.stringify(item);
                        } catch {
                            return String(item);
                        }
                    }),
                );
                for (const item of incoming) {
                    let key: string;
                    try {
                        key = typeof item?.url === 'string' ? item.url : JSON.stringify(item);
                    } catch {
                        key = String(item);
                    }
                    if (seen.has(key)) continue;
                    seen.add(key);
                    merged.push(item);
                }
                return merged;
            };
            const appendUniqueText = (baseRaw: unknown, deltaRaw: unknown): string => {
                const base = String(baseRaw || '');
                const delta = String(deltaRaw || '');
                if (!delta) return base;
                if (!base) return delta;
                if (base === delta) return base;
                if (base.endsWith(delta)) return base;
                if (delta.startsWith(base)) return delta;

                const maxOverlap = Math.min(base.length, delta.length);
                for (let size = maxOverlap; size > 0; size -= 1) {
                    if (base.slice(-size) === delta.slice(0, size)) {
                        return base + delta.slice(size);
                    }
                }

                return base + delta;
            };
            const schedulePendingFlush = () => {
                const existingRaf = rafScheduledByConversationRef.current.get(targetSessionId);
                if (existingRaf) {
                    chatStreamDebug('root-flush-already-scheduled', {
                        sessionId: targetSessionId,
                        pendingMessageCount: sessionPending.size,
                    });
                    return;
                }

                chatStreamDebug('root-flush-scheduled', {
                    sessionId: targetSessionId,
                    pendingMessageCount: sessionPending.size,
                });
                const rafId = requestAnimationFrame(() => {
                    rafScheduledByConversationRef.current.delete(targetSessionId);
                    const tConv = conversationsRef.current.find(c => c.id === targetSessionId);
                    if (!tConv || sessionPending.size === 0) return;

                    const updatedMessages = [...tConv.messages];
                    const msgMap = new Map(updatedMessages.map((m, i) => [m.id, i]));

                    sessionPending.forEach((pMsg) => {
                        const idx = msgMap.get(pMsg.id);
                        const beforeContentLength = idx !== undefined ? updatedMessages[idx].content.length : 0;
                        const beforeReasoningLength = idx !== undefined ? (updatedMessages[idx].reasoning_content || '').length : 0;
                        if (idx !== undefined) {
                            updatedMessages[idx] = {
                                ...updatedMessages[idx],
                                content: appendUniqueText(updatedMessages[idx].content, pMsg.content || ''),
                                reasoning_content: appendUniqueText(updatedMessages[idx].reasoning_content || '', pMsg.reasoning_content || ''),
                                usage: pMsg.usage ?? updatedMessages[idx].usage,
                                citations: mergeCitations(updatedMessages[idx].citations || [], pMsg.citations || []),
                                data: pMsg.data ?? updatedMessages[idx].data,
                                status: 'streaming'
                            };
                        } else {
                            updatedMessages.push({ ...pMsg, status: 'streaming' });
                            msgMap.set(pMsg.id, updatedMessages.length - 1);
                        }
                        const afterIdx = msgMap.get(pMsg.id);
                        const afterMessage = afterIdx !== undefined ? updatedMessages[afterIdx] : pMsg;
                        chatStreamDebug('root-flush-applied', {
                            sessionId: targetSessionId,
                            messageId: pMsg.id,
                            pendingContentLength: (pMsg.content || '').length,
                            pendingReasoningLength: (pMsg.reasoning_content || '').length,
                            beforeContentLength,
                            afterContentLength: afterMessage.content.length,
                            beforeReasoningLength,
                            afterReasoningLength: (afterMessage.reasoning_content || '').length,
                        });
                    });

                    sessionPending.clear();
                    updateConversation(targetSessionId, { messages: updatedMessages });
                });
                rafScheduledByConversationRef.current.set(targetSessionId, rafId);
            };
            const matchesTaskContext = (
                activeTaskRaw: { id?: unknown; messageId?: unknown } | null | undefined,
                messageIdRaw?: unknown,
                taskIdRaw?: unknown,
            ): boolean => {
                const activeTaskId = String(activeTaskRaw?.id || '');
                if (!activeTaskId) return false;
                const taskId = String(taskIdRaw || '');
                if (taskId && activeTaskId === taskId) return true;
                return doesActiveTaskMatchMessage(activeTaskRaw, messageIdRaw);
            };

            // --- Message Start ---
            if (event.type === 'message_start') {
                const messageId = event.data.messageId || event.data.message_id;
                const messageType = event.data.messageType || event.data.message_type || 'text';
                const initialData = event.data.data;
                const startTaskId = event.data.taskId || event.data.task_id || null;
                console.log('[RootLayout] message_start:', messageId, targetSessionId);
                if (!messageId) return;
                const messageStartKey = `${targetSessionId}:${messageId}`;
                const previousStart = messageStartSeenRef.current.get(messageStartKey);
                const nowMs = performance.now();
                if (previousStart) {
                    chatStreamDebug('root-message-start-duplicate', {
                        sessionId: targetSessionId,
                        messageId,
                        seq: event.seq ?? null,
                        taskId: startTaskId,
                        previousSeq: previousStart.seq,
                        previousTaskId: previousStart.taskId,
                        msSincePreviousStart: Math.round(nowMs - previousStart.atMs),
                    });
                }
                messageStartSeenRef.current.set(messageStartKey, {
                    seq: event.seq ?? null,
                    taskId: startTaskId,
                    atMs: nowMs,
                });
                logger.debug('[ChatStream] message_start received', {
                    sessionId: targetSessionId,
                    messageId,
                    taskId: startTaskId,
                    activeConversationId,
                });

                // Preserve any out-of-order chunks/usage/citations that arrived before message_start.
                const existingPending = sessionPending.get(messageId);
                sessionPending.set(messageId, {
                    id: messageId,
                    role: 'assistant',
                    content: existingPending?.content || '',
                    reasoning_content: existingPending?.reasoning_content || '',
                    status: 'streaming',
                    citations: existingPending?.citations || [],
                    usage: existingPending?.usage,
                    type: messageType || existingPending?.type,
                    data: initialData ?? existingPending?.data,
                });

                // Update Conversation State
                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (targetConv && !targetConv.messages.some(m => m.id === messageId)) {
                    const existingTask = targetConv.activeTask;
                    const shouldKeepExistingTask = !!existingTask?.id && !String(existingTask.id).startsWith(`task-${messageId}`);
                    const newMsg: Message = {
                        id: messageId,
                        role: 'assistant',
                        content: '',
                        reasoning_content: '',
                        status: 'streaming',
                        timestamp: new Date().toISOString(),
                        type: messageType,
                        citations: [],
                        data: existingPending?.data || initialData,
                    };
                    updateConversation(targetSessionId, {
                        messages: [...targetConv.messages, newMsg],
                        activeTask: shouldKeepExistingTask
                            ? existingTask
                            : { id: `task-${messageId}`, messageId, status: 'running' }
                    });
                } else if (targetConv) {
                    updateConversation(targetSessionId, {
                        messages: targetConv.messages.map((message) => (
                            message.id === messageId
                                ? {
                                    ...message,
                                    type: messageType || message.type,
                                    data: initialData ?? message.data,
                                    status: 'streaming',
                                }
                                : message
                        )),
                    });
                }
            }
            // --- Chunk ---
            else if (event.type === 'chunk') {
                const messageId = event.data.messageId || event.data.message_id;
                if (!messageId) return;
                const isReasoningChunk = event.data.type === 'reasoning';
                const rawContentDelta = String(event.data.content || event.data.delta || '');
                const rawReasoningDelta = String(event.data.reasoning_content || '');

                const pendingMessage = sessionPending.get(messageId) || {
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    reasoning_content: '',
                    status: 'streaming',
                    citations: [],
                    usage: undefined
                };

                if (isReasoningChunk) {
                    pendingMessage.reasoning_content = appendUniqueText(pendingMessage.reasoning_content || '', rawReasoningDelta);
                } else {
                    pendingMessage.content = appendUniqueText(pendingMessage.content || '', rawContentDelta);
                    if (!firstChunkLoggedRef.current.has(`${targetSessionId}:${messageId}`) && (event.data.content || event.data.delta || '')) {
                        firstChunkLoggedRef.current.add(`${targetSessionId}:${messageId}`);
                        logger.debug('[ChatStream] first content chunk received', {
                            sessionId: targetSessionId,
                            messageId,
                            chunkLength: String(event.data.content || event.data.delta || '').length,
                            activeConversationId,
                        });
                    }
                }
                const statKey = `${targetSessionId}:${messageId}`;
                const prevStats = streamChunkStatsRef.current.get(statKey) || {
                    chunks: 0,
                    contentLength: 0,
                    reasoningLength: 0,
                    lastAtMs: 0,
                };
                const nowMs = performance.now();
                const contentDeltaLength = isReasoningChunk ? 0 : rawContentDelta.length;
                const reasoningDeltaLength = isReasoningChunk ? rawReasoningDelta.length : 0;
                const nextStats = {
                    chunks: prevStats.chunks + 1,
                    contentLength: prevStats.contentLength + contentDeltaLength,
                    reasoningLength: prevStats.reasoningLength + reasoningDeltaLength,
                    lastAtMs: nowMs,
                };
                streamChunkStatsRef.current.set(statKey, nextStats);
                chatStreamDebug('root-chunk-buffered', {
                    sessionId: targetSessionId,
                    messageId,
                    seq: event.seq ?? null,
                    chunkIndex: nextStats.chunks,
                    chunkType: isReasoningChunk ? 'reasoning' : 'content',
                    contentDeltaLength,
                    reasoningDeltaLength,
                    pendingContentLength: pendingMessage.content.length,
                    pendingReasoningLength: (pendingMessage.reasoning_content || '').length,
                    msSincePreviousChunk: prevStats.lastAtMs > 0 ? Math.round(nowMs - prevStats.lastAtMs) : null,
                });
                sessionPending.set(messageId, pendingMessage);

                const targetConvForChunk = conversationsRef.current.find(c => c.id === targetSessionId);
                if (!targetConvForChunk) {
                    console.debug('[RootLayout] Buffered chunk before conversation was loaded', {
                        targetSessionId,
                        messageId,
                    });
                    return;
                }

                const localActiveTaskId = targetConvForChunk?.activeTask?.id;
                const hasMatchingActiveTask = !!targetConvForChunk.activeTask && matchesTaskContext(targetConvForChunk.activeTask, messageId);
                const hasKnownTargetMessage = targetConvForChunk.messages.some(m => m.id === messageId);
                const targetMessageIndex = targetConvForChunk.messages.findIndex((m) => m.id === messageId);
                const hasNewerUserMessageAfterTarget = targetMessageIndex >= 0 &&
                    targetConvForChunk.messages.slice(targetMessageIndex + 1).some((m) => m.role === 'user');

                // Allow late chunks: if message_complete arrived before the last chunk(s), we still apply content for the target message
                const lastAssistantMsg = [...targetConvForChunk.messages].reverse().find(m => m.role === 'assistant');
                const isLateChunkForCurrentMessage = lastAssistantMsg?.id === messageId;

                if (hasNewerUserMessageAfterTarget && !hasMatchingActiveTask) {
                    console.debug('[RootLayout] Ignoring stale chunk for previous turn after newer user message', {
                        targetSessionId,
                        messageId,
                        activeTaskId: localActiveTaskId,
                    });
                    return;
                }

                if (!hasMatchingActiveTask && !isLateChunkForCurrentMessage && !hasKnownTargetMessage) {
                    console.debug('[RootLayout] Buffered out-of-order chunk until placeholder/task state catches up', {
                        targetSessionId,
                        messageId,
                        activeTaskId: localActiveTaskId,
                    });
                    return;
                }

                if (!hasKnownTargetMessage && hasMatchingActiveTask) {
                    const newAssistantMessage: Message = {
                        id: messageId,
                        role: 'assistant',
                        content: isReasoningChunk ? '' : rawContentDelta,
                        reasoning_content: isReasoningChunk ? rawReasoningDelta : '',
                        status: 'streaming',
                        timestamp: new Date().toISOString(),
                        type: 'text',
                        citations: [],
                    };
                    updateConversation(targetSessionId, {
                        messages: [...targetConvForChunk.messages, newAssistantMessage],
                    });
                    sessionPending.delete(messageId);
                    chatStreamDebug('root-placeholder-created-from-chunk', {
                        sessionId: targetSessionId,
                        messageId,
                        seq: event.seq ?? null,
                        chunkType: isReasoningChunk ? 'reasoning' : 'content',
                        contentDeltaLength,
                        reasoningDeltaLength,
                    });
                    return;
                }

                if (hasKnownTargetMessage || isLateChunkForCurrentMessage) {
                    const updatedMessages = targetConvForChunk.messages.map((message) => {
                        if (message.id !== messageId) return message;
                        return {
                            ...message,
                            content: isReasoningChunk
                                ? message.content
                                : appendUniqueText(message.content || '', rawContentDelta),
                            reasoning_content: isReasoningChunk
                                ? appendUniqueText(message.reasoning_content || '', rawReasoningDelta)
                                : message.reasoning_content,
                            status: 'streaming' as const,
                        };
                    });
                    updateConversation(targetSessionId, { messages: updatedMessages });
                    sessionPending.delete(messageId);
                    chatStreamDebug('root-chunk-applied-immediately', {
                        sessionId: targetSessionId,
                        messageId,
                        seq: event.seq ?? null,
                        chunkIndex: nextStats.chunks,
                        chunkType: isReasoningChunk ? 'reasoning' : 'content',
                        contentDeltaLength,
                        reasoningDeltaLength,
                    });
                    return;
                }

                schedulePendingFlush();
            }
            // --- Task done (only clear task indicator; message completion is handled by message_complete) ---
            else if (event.type === 'task_status' && (event.data.status === 'done' || event.data.status === 'completed')) {
                const c = conversationsRef.current.find(c => c.id === targetSessionId);
                const taskId = event.data.taskId || event.data.task_id;
                const messageId = event.data.messageId || event.data.message_id;
                const hasStreamingAssistant = !!c?.messages?.some(
                    m => m.role === 'assistant' && (m.status as string) === 'streaming'
                );
                const hasPendingChunks = sessionPending.size > 0;
                const shouldClearForTaskContext = !c?.activeTask || matchesTaskContext(c.activeTask, messageId, taskId);
                // Defer task clear if response is still visibly streaming.
                // This prevents transient UI "end -> resume" flicker on out-of-order events.
                if (c?.activeTask && shouldClearForTaskContext && !hasStreamingAssistant && !hasPendingChunks) {
                    clearActiveTask(targetSessionId, updateConversation, 'task_status_done');
                } else if (c?.activeTask && !shouldClearForTaskContext) {
                    console.log('[RootLayout] Ignoring stale task_status done for non-active task', {
                        targetSessionId,
                        taskId,
                        messageId,
                        activeTaskId: c.activeTask.id,
                    });
                }
                if (isChatRouteRef.current && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kiko-usage-refresh'));
                }
                return;
            }
            // --- Complete (use only messageId so we don't process the same completion twice with messageId vs taskId) ---
            else if (event.type === 'message_complete') {
                const completionId = event.data.messageId || event.data.message_id;
                if (!completionId) return;
                const completionTaskId = event.data.taskId || event.data.task_id;
                const completionCitations = normalizeCitations(event.data.citations ?? event.data.citation);
                firstChunkLoggedRef.current.delete(`${targetSessionId}:${completionId}`);
                const completedStats = streamChunkStatsRef.current.get(`${targetSessionId}:${completionId}`) || null;
                if (completedStats) {
                    streamChunkStatsRef.current.delete(`${targetSessionId}:${completionId}`);
                }
                const dedupKey = `${targetSessionId}:${completionId}`;
                console.log('[RootLayout] message_complete:', completionId, 'Pending:', sessionPending.size);
                chatStreamDebug('root-message-complete', {
                    sessionId: targetSessionId,
                    messageId: completionId,
                    seq: event.seq ?? null,
                    pendingMessageCount: sessionPending.size,
                    chunkStats: completedStats,
                });

                // Dispatch event to refresh sidebar usage count now that the message computation is done
                if (isChatRouteRef.current && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kiko-usage-refresh'));
                }

                // Dedup: skip only if we already processed AND state is already clean
                if (lastProcessedCompletionRef.current === dedupKey && sessionPending.size === 0) {
                    console.log('[RootLayout] Skipping duplicate complete with empty pending');
                    const c = conversationsRef.current.find(c => c.id === targetSessionId);
                    const shouldClearActiveTaskForCompletion = !!c?.activeTask &&
                        matchesTaskContext(c.activeTask, completionId, completionTaskId);
                    if (shouldClearActiveTaskForCompletion) {
                        clearActiveTask(targetSessionId, updateConversation, 'message_complete_dedup');
                    }
                    return;
                }
                lastProcessedCompletionRef.current = dedupKey;

                const tConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (tConv && sessionPending.size > 0) {
                    const shouldClearActiveTaskForCompletion = !tConv.activeTask ||
                        matchesTaskContext(tConv.activeTask, completionId, completionTaskId);
                    const updatedMessages = [...tConv.messages];
                    const msgMap = new Map(updatedMessages.map((m, i) => [m.id, i]));

                    sessionPending.forEach((pMsg) => {
                        const idx = msgMap.get(pMsg.id);
                        if (idx !== undefined) {
                            const baseCitations = mergeCitations(updatedMessages[idx].citations || [], pMsg.citations || []);
                            updatedMessages[idx] = {
                                ...updatedMessages[idx],
                                content: appendUniqueText(updatedMessages[idx].content, pMsg.content || ''),
                                reasoning_content: appendUniqueText(updatedMessages[idx].reasoning_content || '', pMsg.reasoning_content || ''),
                                status: 'complete',
                                usage: pMsg.id === completionId
                                    ? (pMsg.usage ?? event.data.usage ?? updatedMessages[idx].usage)
                                    : (pMsg.usage ?? updatedMessages[idx].usage),
                                citations: pMsg.id === completionId
                                    ? mergeCitations(baseCitations, completionCitations)
                                    : baseCitations,
                                data: pMsg.data ?? updatedMessages[idx].data,
                            };
                        } else {
                            updatedMessages.push({ ...pMsg, status: 'complete' });
                        }
                    });
                    // Atomic: clear activeTask with messages (task_lifecycle: message_complete_pending_flush)
                    updateConversation(targetSessionId, {
                        messages: updatedMessages,
                        activeTask: shouldClearActiveTaskForCompletion ? null : tConv.activeTask,
                    });
                    sessionPending.clear();

                    // Also refetch content when the completed message is empty after pending flush.
                    // This handles the bypass flow where no content chunks were streamed — the content was
                    // persisted to DB but never broadcast, so the assistant message stays empty after flush.
                    const flushedMsg = updatedMessages.find(m => m.id === completionId);
                    if (flushedMsg && flushedMsg.type !== 'transaction-status-card'
                        && (flushedMsg.content || '').trim() === ''
                        && (flushedMsg.reasoning_content || '').trim() === '') {
                        console.log('[RootLayout] message_complete pending-flush: empty content after flush, refetching from DB', { completionId });
                        chatApi.getSession(targetSessionId).then((resp: { success: boolean; messages?: any[] }) => {
                            if (!resp.success || !resp.messages?.length) return;
                            const fromDb = resp.messages.find((m: any) => m.id === completionId);
                            if (fromDb && ((fromDb.content || '').trim() !== '' || (fromDb.reasoning_content || '').trim() !== '')) {
                                const latest = conversationsRef.current.find(c => c.id === targetSessionId);
                                if (!latest) return;
                                const merged = latest.messages.map(m => {
                                    if (m.id !== completionId) return m;
                                    if (m.type === 'transaction-status-card') return m;
                                    return { ...m, content: fromDb.content ?? m.content, reasoning_content: fromDb.reasoning_content ?? m.reasoning_content, status: 'complete' as const };
                                });
                                updateConversation(targetSessionId, { messages: merged });
                                console.log('[RootLayout] message_complete pending-flush: refetch merged content', { completionId, contentLen: (fromDb.content || '').length });
                            }
                        }).catch(() => { });
                    }
                } else if (tConv) {
                    // No pending chunks — just finalize message status and clear task
                    // This fixes the bug where "Stop" button stays active if all chunks were already flushed
                    const txCardCount = tConv.messages.filter(m => m.type === 'transaction-status-card').length;
                    console.log('[RootLayout] message_complete fallback:', {
                        completionId,
                        messageCount: tConv.messages.length,
                        txCardCount,
                        messageIds: tConv.messages.map(m => ({ id: m.id, type: m.type })),
                    });
                    const shouldClearActiveTaskForCompletion = !tConv.activeTask ||
                        matchesTaskContext(tConv.activeTask, completionId, completionTaskId);

                    const updatedMessages = tConv.messages.map(m =>
                        (m.id === completionId || (shouldClearActiveTaskForCompletion && m.role === 'assistant' && m.status === 'streaming'))
                            ? {
                                ...m,
                                status: 'complete' as const,
                                usage: m.id === completionId ? (event.data.usage ?? m.usage) : m.usage,
                                citations: m.id === completionId
                                    ? mergeCitations(m.citations || [], completionCitations)
                                    : m.citations,
                            }
                            : m
                    );
                    // Atomic: clear activeTask with messages (task_lifecycle: message_complete_fallback)
                    updateConversation(targetSessionId, {
                        messages: updatedMessages,
                        activeTask: shouldClearActiveTaskForCompletion ? null : tConv.activeTask,
                    });
                    if (shouldClearActiveTaskForCompletion) {
                        console.log('[RootLayout] Cleared activeTask (fallback path)');
                    } else {
                        console.log('[RootLayout] Preserved activeTask for stale message_complete', {
                            completionId,
                            completionTaskId,
                            activeTaskId: tConv.activeTask?.id,
                        });
                    }

                    // Fallback: if the completed message still has no content (e.g. late chunks were lost), refetch from server
                    // Do NOT refetch/overwrite transaction-status-card — that would replace the card with DB text and make it disappear
                    const completedMsg = updatedMessages.find(m => m.id === completionId);
                    if (completedMsg && completedMsg.type === 'transaction-status-card') {
                        console.log('[RootLayout] Skipping empty-content refetch for transaction-status-card', { completionId });
                    } else if (completedMsg && (completedMsg.content || '').trim() === '' && (completedMsg.reasoning_content || '').trim() === '') {
                        chatApi.getSession(targetSessionId).then((resp: { success: boolean; messages?: any[] }) => {
                            if (!resp.success || !resp.messages?.length) return;
                            const fromDb = resp.messages.find((m: any) => m.id === completionId);
                            if (fromDb && ((fromDb.content || '').trim() !== '' || (fromDb.reasoning_content || '').trim() !== '')) {
                                const latest = conversationsRef.current.find(c => c.id === targetSessionId);
                                if (!latest) return;
                                // Preserve transaction-status-card: never replace a card message with DB text
                                const merged = latest.messages.map(m => {
                                    if (m.id !== completionId) return m;
                                    if (m.type === 'transaction-status-card') return m;
                                    return { ...m, content: fromDb.content ?? m.content, reasoning_content: fromDb.reasoning_content ?? m.reasoning_content, status: 'complete' as const };
                                });
                                updateConversation(targetSessionId, { messages: merged });
                            }
                        }).catch(() => { });
                    }
                }
            }
            else if (event.type === 'content_block') {
                const messageId = event.data.messageId || event.data.message_id;
                if (!messageId) return;
                const replacement = String(event.data.content || '');
                const shouldReplace = Boolean(event.data.replace);
                const shouldClearReasoning = Boolean(event.data.clearReasoning);

                const pendingMessage = sessionPending.get(messageId) || {
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    reasoning_content: '',
                    status: 'streaming',
                    citations: [],
                    usage: undefined,
                };
                pendingMessage.content = shouldReplace ? replacement : appendUniqueText(pendingMessage.content || '', replacement);
                if (shouldClearReasoning) {
                    pendingMessage.reasoning_content = '';
                }
                sessionPending.set(messageId, pendingMessage);

                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (!targetConv) {
                    return;
                }

                const updatedMessages = targetConv.messages.map((message) => {
                    if (message.id !== messageId) return message;
                    return {
                        ...message,
                        content: shouldReplace ? replacement : appendUniqueText(message.content || '', replacement),
                        reasoning_content: shouldClearReasoning ? '' : message.reasoning_content,
                    };
                });

                updateConversation(targetSessionId, { messages: updatedMessages });
            }
            // --- Error ---
            else if (event.type === 'error') {
                const errorText = String(event.data?.error || event.data?.message || 'Generation failed');
                const errorMessageId = event.data?.messageId || event.data?.message_id;
                const errorUsage = event.data?.usage;
                const errorCitations = normalizeCitations(event.data?.citations ?? event.data?.citation);
                if (errorMessageId) {
                    firstChunkLoggedRef.current.delete(`${targetSessionId}:${errorMessageId}`);
                }

                const tConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (!tConv) {
                    if (errorMessageId) {
                        const pMsg: Message = sessionPending.get(errorMessageId) || {
                            id: errorMessageId,
                            role: 'assistant',
                            content: '',
                            reasoning_content: '',
                            status: 'streaming',
                            citations: [],
                            usage: undefined,
                        };
                        pMsg.status = 'error';
                        pMsg.usage = pMsg.usage ?? errorUsage;
                        pMsg.citations = mergeCitations(pMsg.citations || [], errorCitations);
                        if (!(pMsg.content || '').trim()) {
                            pMsg.content = errorText;
                        }
                        sessionPending.set(errorMessageId, pMsg);
                    }
                    return;
                }

                const updatedMessages = [...tConv.messages];
                const msgMap = new Map(updatedMessages.map((m, i) => [m.id, i]));

                // Flush all pending deltas/citations first so source data is not lost on failure.
                if (sessionPending.size > 0) {
                    sessionPending.forEach((pMsg) => {
                        const idx = msgMap.get(pMsg.id);
                        if (idx !== undefined) {
                            updatedMessages[idx] = {
                                ...updatedMessages[idx],
                                content: updatedMessages[idx].content + (pMsg.content || ''),
                                reasoning_content: (updatedMessages[idx].reasoning_content || '') + (pMsg.reasoning_content || ''),
                                usage: pMsg.usage ?? updatedMessages[idx].usage,
                                citations: mergeCitations(updatedMessages[idx].citations || [], pMsg.citations || []),
                                data: pMsg.data ?? updatedMessages[idx].data,
                            };
                        } else {
                            updatedMessages.push({ ...pMsg });
                            msgMap.set(pMsg.id, updatedMessages.length - 1);
                        }
                    });
                    sessionPending.clear();
                }

                let targetIdx = -1;
                if (errorMessageId) {
                    targetIdx = updatedMessages.findIndex((m) => m.id === errorMessageId);
                }
                if (targetIdx === -1) {
                    for (let i = updatedMessages.length - 1; i >= 0; i -= 1) {
                        const message = updatedMessages[i];
                        if (message.role === 'assistant' && message.status === 'streaming') {
                            targetIdx = i;
                            break;
                        }
                    }
                }

                if (targetIdx >= 0) {
                    const target = updatedMessages[targetIdx];
                    updatedMessages[targetIdx] = {
                        ...target,
                        status: 'error',
                        content: (target.content || '').trim() ? target.content : errorText,
                        usage: target.usage ?? errorUsage,
                        citations: mergeCitations(target.citations || [], errorCitations),
                    };
                } else if (errorMessageId) {
                    updatedMessages.push({
                        id: errorMessageId,
                        role: 'assistant',
                        content: errorText,
                        reasoning_content: '',
                        status: 'error',
                        timestamp: new Date().toISOString(),
                        type: 'text',
                        citations: errorCitations,
                        usage: errorUsage,
                    } as Message);
                }

                // Hard stop residual "streaming" markers so plan/loading exits immediately.
                const finalizedMessages = updatedMessages.map((message) =>
                    message.role === 'assistant' && message.status === 'streaming'
                        ? { ...message, status: 'error' as const }
                        : message
                );

                updateConversation(targetSessionId, { messages: finalizedMessages, activeTask: null });
                return;
            }
            // --- Task Status ---
            else if (event.type === 'task_status') {
                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (targetConv) {
                    const status = event.data.status;
                    const taskId = event.data.taskId || event.data.task_id;
                    const messageId = event.data.messageId || event.data.message_id;
                    const currentTask = targetConv.activeTask;
                    const taskMatchesCurrent = !!currentTask && matchesTaskContext(currentTask, messageId, taskId);
                    const hasStreamingAssistant = targetConv.messages.some(
                        (message) => message.role === 'assistant' && message.status === 'streaming'
                    );
                    const latestAssistant = [...targetConv.messages].reverse().find((message) => message.role === 'assistant');

                    if (status === 'done' || status === 'completed') {
                        if (!currentTask || taskMatchesCurrent) {
                            clearActiveTask(targetSessionId, updateConversation, 'task_status_done');
                        } else {
                            console.log('[RootLayout] Ignoring stale task_status done in secondary handler', {
                                targetSessionId,
                                taskId,
                                messageId,
                                activeTaskId: currentTask.id,
                            });
                        }
                    } else if (status === 'failed' || status === 'error' || status === 'cancelled' || status === 'stopped') {
                        if (currentTask && !taskMatchesCurrent) {
                            console.log('[RootLayout] Ignoring stale task_status failure for non-active task', {
                                targetSessionId,
                                taskId,
                                messageId,
                                activeTaskId: currentTask.id,
                                status,
                            });
                            return;
                        }
                        const finalizedMessages = targetConv.messages.map((message) =>
                            message.role === 'assistant' && message.status === 'streaming'
                                ? { ...message, status: (status === 'cancelled' ? 'complete' : 'error') as Message['status'] }
                                : message
                        );
                        updateConversation(targetSessionId, {
                            messages: finalizedMessages,
                            activeTask: null,
                        });
                        if (isChatRouteRef.current && typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('kiko-usage-refresh'));
                        }
                    } else if (status === 'running' || status === 'pending') {
                        if (!currentTask && !hasStreamingAssistant && latestAssistant?.status === 'complete') {
                            console.log('[RootLayout] Ignoring stale running task_status after completion', {
                                targetSessionId,
                                taskId,
                                status,
                                latestAssistantId: latestAssistant.id,
                            });
                            return;
                        }
                        updateConversation(targetSessionId, {
                            activeTask: {
                                ...(currentTask || {}),
                                id: taskId || currentTask?.id || `task-${event.data.messageId || event.data.message_id || Date.now()}`,
                                messageId: event.data.messageId || event.data.message_id || currentTask?.messageId,
                                status: 'running',
                                message: event.data.message,
                            }
                        });
                    }
                }
            }
            // --- Usage ---
            else if (event.type === 'usage') {
                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                const msgId = event.data.message_id || event.data.messageId;
                if (!msgId) return;
                if (targetConv) {
                    const hasTarget = targetConv.messages.some(m => m.id === msgId);
                    if (hasTarget) {
                        const updatedMessages = targetConv.messages.map(m =>
                            m.id === msgId ? { ...m, usage: event.data.usage } : m
                        );
                        updateConversation(targetSessionId, { messages: updatedMessages });
                    } else {
                        // Buffer usage if message not yet created (out-of-order WS events).
                        const pMsg: Message = sessionPending.get(msgId) || {
                            id: msgId, role: 'assistant', content: '', reasoning_content: '', status: 'streaming', citations: [], usage: undefined
                        };
                        pMsg.usage = event.data.usage;
                        sessionPending.set(msgId, pMsg);
                    }
                } else {
                    // Buffer usage if conversation is not loaded yet.
                    const pMsg: Message = sessionPending.get(msgId) || {
                        id: msgId, role: 'assistant', content: '', reasoning_content: '', status: 'streaming', citations: [], usage: undefined
                    };
                    pMsg.usage = event.data.usage;
                    sessionPending.set(msgId, pMsg);
                }
            }
            // --- Citations ---
            else if (event.type === 'citations') {
                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                const msgId = event.data.message_id || event.data.messageId;
                if (!msgId) return;
                const incomingCitations = normalizeCitations(event.data.citations ?? event.data.citation);
                const pMsg: Message = sessionPending.get(msgId) || {
                    id: msgId, role: 'assistant', content: '', reasoning_content: '', status: 'streaming', citations: [], usage: undefined
                };
                pMsg.citations = mergeCitations(pMsg.citations || [], incomingCitations);
                sessionPending.set(msgId, pMsg);

                if (!targetConv) {
                    return;
                }

                schedulePendingFlush();
            }
            // --- Agent runtime ---
            else if (event.type === 'agent_runtime') {
                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                const msgId = event.data.messageId || event.data.message_id;
                const runtimeSnapshot = event.data.snapshot;
                if (!msgId || !runtimeSnapshot?.plan) return;

                if (!targetConv) {
                    const pMsg: Message = sessionPending.get(msgId) || {
                        id: msgId,
                        role: 'assistant',
                        content: '',
                        reasoning_content: '',
                        status: 'streaming',
                        citations: [],
                        usage: undefined,
                    };
                    pMsg.data = {
                        ...(pMsg.data || {}),
                        agentRuntime: runtimeSnapshot,
                    };
                    sessionPending.set(msgId, pMsg);
                    return;
                }

                const existingIdx = targetConv.messages.findIndex((m) => m.id === msgId);
                const nextMessage: Message = {
                    id: msgId,
                    role: 'assistant',
                    content: '',
                    reasoning_content: '',
                    status: 'streaming',
                    timestamp: new Date().toISOString(),
                    type: 'text',
                    data: { agentRuntime: runtimeSnapshot },
                    citations: [],
                };
                const updatedMessages = existingIdx >= 0
                    ? targetConv.messages.map((m, index) => index === existingIdx ? {
                        ...m,
                        type: m.type === 'plan-card' ? 'text' as const : m.type,
                        data: {
                            ...(m.data || {}),
                            agentRuntime: runtimeSnapshot,
                        },
                    } : m)
                    : [...targetConv.messages, nextMessage];

                updateConversation(targetSessionId, { messages: updatedMessages });
            }
        };

        const unsubscribe = chatWSClient.subscribe(handleGlobalChatEvent);
        return () => {
            unsubscribe();
            pendingFlushTimersRef.current.forEach(t => clearTimeout(t));
            pendingFlushTimersRef.current.clear();
            rafScheduledByConversationRef.current.forEach((id) => cancelAnimationFrame(id));
            rafScheduledByConversationRef.current.clear();
        };
    }, [authenticated, ready, activeConversationId, updateConversation]);



    // --- Navigation Handlers ---

    const handleNewChat = () => {
        loadConversation(null); // Clear active logic in context
        navigate('/');
    };

    const handleConversationRename = (id: string, newTitle: string) => {
        updateConversationTitle(id, newTitle);
    };

    const handleConversationDelete = (id: string) => {
        deleteConversation(id);
        if (activeConversationId === id) {
            navigate('/');
        }
    };

    // --- Layout Render ---

    return (
        <ConversationProvider value={conversationUtils}>
            <AgentRuntime />
            <Layout
                conversations={conversations}
                activeConversationId={activeConversationId}
                onNewChat={handleNewChat}
                onConversationRename={handleConversationRename}
                onConversationDelete={handleConversationDelete}
                generatingConversationId={generatingConversationId}
                onBack={location.pathname === '/settings' ? () => navigate('/wallet') : undefined}
            >
                <Outlet />
            </Layout>
            <GlobalToast />
        </ConversationProvider>
    );
};
