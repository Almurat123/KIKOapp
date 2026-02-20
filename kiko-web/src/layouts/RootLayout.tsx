import React, { useEffect, useMemo, useRef } from 'react';
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

    // --- WebSocket & Sync Logic (Identical to App.tsx) ---

    // 1. Visibility & Background Sync
    useEffect(() => {
        let lastHiddenTime = 0;
        const RELOAD_STALE_MS = 4 * 60 * 60 * 1000; // 4 hours
        const MIN_BACKGROUND_MS = 2000;

        const handleVisibilityChange = async () => {
            if (document.hidden) {
                lastHiddenTime = Date.now();
            } else if (lastHiddenTime > 0) {
                const inactiveDuration = Date.now() - lastHiddenTime;

                if (inactiveDuration >= RELOAD_STALE_MS) {
                    try {
                        const token = await getAccessToken();
                        if (token) {
                            chatWSClient.connect(token);
                        }
                    } catch (error) {
                        console.error('[RootLayout] Reconnect after long background failed:', error);
                    }
                    lastHiddenTime = 0;
                    return;
                }

                if (inactiveDuration >= MIN_BACKGROUND_MS) {
                    try {
                        const token = await getAccessToken();
                        if (!token) {
                            lastHiddenTime = 0;
                            return;
                        }
                        chatWSClient.connect(token);

                        // Only sync the current conversation context.
                        // Do NOT fall back to conversations[0], otherwise iOS Safari background/foreground
                        // can unexpectedly open a chat when user was on home or another page.
                        const routeConversationId = location.pathname.startsWith('/chat/')
                            ? location.pathname.slice('/chat/'.length).split(/[/?#]/)[0] || null
                            : null;
                        // Only sync if user is currently on /chat/:id.
                        // On "/" do not revive stale activeConversationId from a backgrounded tab.
                        if (routeConversationId) {
                            await loadConversation(routeConversationId);
                        }
                    } catch (error) {
                        console.error('[RootLayout] Sync failed:', error);
                    }
                }
                lastHiddenTime = 0;
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [getAccessToken, loadConversation, location.pathname]);

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

            // --- Message Start ---
            if (event.type === 'message_start') {
                const messageId = event.data.messageId || event.data.message_id;
                console.log('[RootLayout] message_start:', messageId, targetSessionId);
                if (!messageId) return;

                // Create pending placeholder
                sessionPending.set(messageId, {
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    reasoning_content: '',
                    status: 'streaming',
                    citations: [], // Initialize citations
                    usage: undefined
                });

                // Update Conversation State
                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (targetConv && !targetConv.messages.some(m => m.id === messageId)) {
                    const newMsg: Message = {
                        id: messageId,
                        role: 'assistant',
                        content: '',
                        reasoning_content: '',
                        status: 'streaming',
                        timestamp: new Date().toISOString(),
                        type: 'text',
                        citations: []
                    };
                    updateConversation(targetSessionId, {
                        messages: [...targetConv.messages, newMsg],
                        activeTask: { id: `task-${messageId}`, status: 'running' } // Implicit task
                    });
                }
            }
            // --- Chunk ---
            else if (event.type === 'chunk') {
                const messageId = event.data.messageId || event.data.message_id;
                if (!messageId) return;

                const targetConvForChunk = conversationsRef.current.find(c => c.id === targetSessionId);
                if (!targetConvForChunk) return;

                const localActiveTaskId = targetConvForChunk?.activeTask?.id;
                const expectedTaskId = `task-${messageId}`;
                const hasMatchingActiveTask = targetConvForChunk.activeTask && (localActiveTaskId === expectedTaskId || localActiveTaskId?.includes(messageId));

                // Allow late chunks: if message_complete arrived before the last chunk(s), we still apply content for the target message
                const lastAssistantMsg = [...targetConvForChunk.messages].reverse().find(m => m.role === 'assistant');
                const isLateChunkForCurrentMessage = lastAssistantMsg?.id === messageId;

                if (!hasMatchingActiveTask && !isLateChunkForCurrentMessage) {
                    console.warn('[RootLayout] Zombie chunk detected, discarding:', messageId);
                    return;
                }

                const msg = sessionPending.get(messageId) || {
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    reasoning_content: '',
                    status: 'streaming',
                    citations: [],
                    usage: undefined
                };

                if (event.data.type === 'reasoning') {
                    // Accumulate reasoning delta for this pending batch
                    msg.reasoning_content = (msg.reasoning_content || '') + (event.data.reasoning_content || '');
                } else {
                    // Accumulate content delta for this pending batch
                    msg.content = (msg.content || '') + (event.data.content || event.data.delta || '');
                }

                sessionPending.set(messageId, msg);

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
                                citations: pMsg.citations ?? updatedMessages[idx].citations,
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
                const hasStreamingAssistant = !!c?.messages?.some(
                    m => m.role === 'assistant' && (m.status as string) === 'streaming'
                );
                const hasPendingChunks = sessionPending.size > 0;
                // Defer task clear if response is still visibly streaming.
                // This prevents transient UI "end -> resume" flicker on out-of-order events.
                if (c?.activeTask && !hasStreamingAssistant && !hasPendingChunks) {
                    clearActiveTask(targetSessionId, updateConversation, 'task_status_done');
                }
                return;
            }
            // --- Complete (use only messageId so we don't process the same completion twice with messageId vs taskId) ---
            else if (event.type === 'message_complete') {
                const completionId = event.data.messageId || event.data.message_id;
                if (!completionId) return;
                const dedupKey = `${targetSessionId}:${completionId}`;
                console.log('[RootLayout] message_complete:', completionId, 'Pending:', sessionPending.size);

                // Dedup: skip only if we already processed AND state is already clean
                if (lastProcessedCompletionRef.current === dedupKey && sessionPending.size === 0) {
                    console.log('[RootLayout] Skipping duplicate complete with empty pending');
                    const c = conversationsRef.current.find(c => c.id === targetSessionId);
                    if (c?.activeTask) clearActiveTask(targetSessionId, updateConversation, 'message_complete_dedup');
                    return;
                }
                lastProcessedCompletionRef.current = dedupKey;

                const tConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (tConv && sessionPending.size > 0) {
                    const updatedMessages = [...tConv.messages];
                    const msgMap = new Map(updatedMessages.map((m, i) => [m.id, i]));

                    sessionPending.forEach((pMsg) => {
                        const idx = msgMap.get(pMsg.id);
                        if (idx !== undefined) {
                            updatedMessages[idx] = {
                                ...updatedMessages[idx],
                                content: updatedMessages[idx].content + (pMsg.content || ''),
                                reasoning_content: (updatedMessages[idx].reasoning_content || '') + (pMsg.reasoning_content || ''),
                                status: 'complete',
                                usage: pMsg.usage ?? event.data.usage ?? updatedMessages[idx].usage,
                                citations: pMsg.citations ?? updatedMessages[idx].citations
                            };
                        } else {
                            updatedMessages.push({ ...pMsg, status: 'complete' });
                        }
                    });
                    // Atomic: clear activeTask with messages (task_lifecycle: message_complete_pending_flush)
                    updateConversation(targetSessionId, { messages: updatedMessages, activeTask: null });
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
                        }).catch(() => {});
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

                    const updatedMessages = tConv.messages.map(m =>
                        (m.id === completionId || (m.role === 'assistant' && m.status === 'streaming'))
                            ? { ...m, status: 'complete' as const, usage: event.data.usage ?? m.usage }
                            : m
                    );
                    // Atomic: clear activeTask with messages (task_lifecycle: message_complete_fallback)
                    updateConversation(targetSessionId, { messages: updatedMessages, activeTask: null });
                    console.log('[RootLayout] Cleared activeTask (fallback path)');

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
                        }).catch(() => {});
                    }
                }
            }
            // --- Task Status ---
            else if (event.type === 'task_status') {
                const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
                if (targetConv) {
                    const status = event.data.status;
                    const taskId = event.data.taskId || event.data.task_id;

                    if (status === 'done' || status === 'completed') {
                        clearActiveTask(targetSessionId, updateConversation, 'task_status_done');
                    } else if (status === 'running' || status === 'pending') {
                        updateConversation(targetSessionId, {
                            activeTask: { id: taskId, status: 'running', message: event.data.message }
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
                if (targetConv) {
                    const msgId = event.data.message_id || event.data.messageId;
                    const updatedMessages = targetConv.messages.map(m =>
                        m.id === msgId ? { ...m, citations: event.data.citations } : m
                    );
                    updateConversation(targetSessionId, { messages: updatedMessages });
                } else {
                    // Buffer citations if message not yet created
                    const msgId = event.data.message_id || event.data.messageId;
                    const pMsg: Message = sessionPending.get(msgId) || {
                        id: msgId, role: 'assistant', content: '', reasoning_content: '', status: 'streaming', citations: [], usage: undefined
                    };
                    pMsg.citations = event.data.citations;
                    sessionPending.set(msgId, pMsg);
                }
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
