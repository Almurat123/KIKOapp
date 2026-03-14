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
            console.log(`[RootLayout] Rendering Streaming Frame. Content Len: ${lastMsg.content.length}`);
        }
    }

    // Derived: session with activeTask is "generating" (sidebar highlight)
    const generatingConversationId = useMemo(
        () => conversations.find(c => c.activeTask != null)?.id ?? null,
        [conversations]
    );

    // WebSocket message buffering refs
    const pendingByConversationRef = useRef<Map<string, Map<string, Message>>>(new Map());
    const lastProcessedCompletionRef = useRef<string | null>(null);
    const pendingFlushTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const rafScheduledByConversationRef = useRef<Map<string, number>>(new Map());
    const resumeSyncInFlightRef = useRef<Promise<void> | null>(null);
    const lastResumeSyncAtRef = useRef(0);
    const firstChunkLoggedRef = useRef<Set<string>>(new Set());

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
            const matchesTaskContext = (activeTaskIdRaw: unknown, messageIdRaw?: unknown, taskIdRaw?: unknown): boolean => {
                const activeTaskId = String(activeTaskIdRaw || '');
                if (!activeTaskId) return false;
                const taskId = String(taskIdRaw || '');
                if (taskId && activeTaskId === taskId) return true;
                const messageId = String(messageIdRaw || '');
                if (!messageId) return false;
                if (activeTaskId === `task-${messageId}`) return true;
                return activeTaskId.includes(messageId);
            };

            // --- Message Start ---
            if (event.type === 'message_start') {
                const messageId = event.data.messageId || event.data.message_id;
                console.log('[RootLayout] message_start:', messageId, targetSessionId);
                if (!messageId) return;
                logger.debug('[ChatStream] message_start received', {
                    sessionId: targetSessionId,
                    messageId,
                    taskId: event.data.taskId || event.data.task_id || null,
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
                    data: existingPending?.data,
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
                        type: 'text',
                        citations: [],
                        data: existingPending?.data,
                    };
                    updateConversation(targetSessionId, {
                        messages: [...targetConv.messages, newMsg],
                        activeTask: shouldKeepExistingTask
                            ? existingTask
                            : { id: `task-${messageId}`, status: 'running' }
                    });
                }
            }
            // --- Chunk ---
            else if (event.type === 'chunk') {
                const messageId = event.data.messageId || event.data.message_id;
                if (!messageId) return;

                const pendingMessage = sessionPending.get(messageId) || {
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    reasoning_content: '',
                    status: 'streaming',
                    citations: [],
                    usage: undefined
                };

                if (event.data.type === 'reasoning') {
                    pendingMessage.reasoning_content = (pendingMessage.reasoning_content || '') + (event.data.reasoning_content || '');
                } else {
                    pendingMessage.content = (pendingMessage.content || '') + (event.data.content || event.data.delta || '');
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
                const hasMatchingActiveTask = !!targetConvForChunk.activeTask && matchesTaskContext(localActiveTaskId, messageId);
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

                const existingRaf = rafScheduledByConversationRef.current.get(targetSessionId);
                if (existingRaf) {
                    return;
                }

                const rafId = requestAnimationFrame(() => {
                    rafScheduledByConversationRef.current.delete(targetSessionId);
                    const tConv = conversationsRef.current.find(c => c.id === targetSessionId);
                    if (!tConv || sessionPending.size === 0) return;

                    const updatedMessages = [...tConv.messages];
                    const msgMap = new Map(updatedMessages.map((m, i) => [m.id, i]));

                    sessionPending.forEach((pMsg) => {
                        const idx = msgMap.get(pMsg.id);
                        if (idx !== undefined) {
                            // APPEND new content from pending batch to existing message
                            // sessionPending holds deltas since last flush, so we must append
                            updatedMessages[idx] = {
                                ...updatedMessages[idx],
                                content: updatedMessages[idx].content + (pMsg.content || ''),
                                reasoning_content: (updatedMessages[idx].reasoning_content || '') + (pMsg.reasoning_content || ''),
                                usage: pMsg.usage ?? updatedMessages[idx].usage,
                                citations: mergeCitations(updatedMessages[idx].citations || [], pMsg.citations || []),
                                data: pMsg.data ?? updatedMessages[idx].data,
                                status: 'streaming'
                            };
                        } else {
                            // New message: just push it
                            updatedMessages.push({ ...pMsg, status: 'streaming' });
                            msgMap.set(pMsg.id, updatedMessages.length - 1);
                        }
                    });

                    sessionPending.clear();
                    updateConversation(targetSessionId, { messages: updatedMessages });
                });
                rafScheduledByConversationRef.current.set(targetSessionId, rafId);
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
                const shouldClearForTaskContext = !c?.activeTask || matchesTaskContext(c.activeTask.id, messageId, taskId);
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
                return;
            }
            // --- Complete (use only messageId so we don't process the same completion twice with messageId vs taskId) ---
            else if (event.type === 'message_complete') {
                const completionId = event.data.messageId || event.data.message_id;
                if (!completionId) return;
                const completionTaskId = event.data.taskId || event.data.task_id;
                const completionCitations = normalizeCitations(event.data.citations ?? event.data.citation);
                firstChunkLoggedRef.current.delete(`${targetSessionId}:${completionId}`);
                const dedupKey = `${targetSessionId}:${completionId}`;
                console.log('[RootLayout] message_complete:', completionId, 'Pending:', sessionPending.size);

                // Dispatch event to refresh sidebar usage count now that the message computation is done
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kiko-usage-refresh'));
                }

                // Dedup: skip only if we already processed AND state is already clean
                if (lastProcessedCompletionRef.current === dedupKey && sessionPending.size === 0) {
                    console.log('[RootLayout] Skipping duplicate complete with empty pending');
                    const c = conversationsRef.current.find(c => c.id === targetSessionId);
                    const shouldClearActiveTaskForCompletion = !!c?.activeTask &&
                        matchesTaskContext(c.activeTask.id, completionId, completionTaskId);
                    if (shouldClearActiveTaskForCompletion) {
                        clearActiveTask(targetSessionId, updateConversation, 'message_complete_dedup');
                    }
                    return;
                }
                lastProcessedCompletionRef.current = dedupKey;

                const tConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (tConv && sessionPending.size > 0) {
                    const shouldClearActiveTaskForCompletion = !tConv.activeTask ||
                        matchesTaskContext(tConv.activeTask.id, completionId, completionTaskId);
                    const updatedMessages = [...tConv.messages];
                    const msgMap = new Map(updatedMessages.map((m, i) => [m.id, i]));

                    sessionPending.forEach((pMsg) => {
                        const idx = msgMap.get(pMsg.id);
                        if (idx !== undefined) {
                            const baseCitations = mergeCitations(updatedMessages[idx].citations || [], pMsg.citations || []);
                            updatedMessages[idx] = {
                                ...updatedMessages[idx],
                                content: updatedMessages[idx].content + (pMsg.content || ''),
                                reasoning_content: (updatedMessages[idx].reasoning_content || '') + (pMsg.reasoning_content || ''),
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
                        matchesTaskContext(tConv.activeTask.id, completionId, completionTaskId);

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
                    const taskMatchesCurrent = !!currentTask && matchesTaskContext(currentTask.id, messageId, taskId);
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
                if (targetConv) {
                    const hasTarget = targetConv.messages.some(m => m.id === msgId);
                    if (hasTarget) {
                        const updatedMessages = targetConv.messages.map(m =>
                            m.id === msgId ? { ...m, citations: mergeCitations(m.citations || [], incomingCitations) } : m
                        );
                        updateConversation(targetSessionId, { messages: updatedMessages });
                    } else {
                        // Buffer citations if message not yet created (out-of-order WS events).
                        const pMsg: Message = sessionPending.get(msgId) || {
                            id: msgId, role: 'assistant', content: '', reasoning_content: '', status: 'streaming', citations: [], usage: undefined
                        };
                        pMsg.citations = mergeCitations(pMsg.citations || [], incomingCitations);
                        sessionPending.set(msgId, pMsg);
                    }
                } else {
                    // Buffer citations if message not yet created
                    const pMsg: Message = sessionPending.get(msgId) || {
                        id: msgId, role: 'assistant', content: '', reasoning_content: '', status: 'streaming', citations: [], usage: undefined
                    };
                    pMsg.citations = mergeCitations(pMsg.citations || [], incomingCitations);
                    sessionPending.set(msgId, pMsg);
                }
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
