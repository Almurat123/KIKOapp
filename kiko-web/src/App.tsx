import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Layout } from './components/Layout/Layout';
// import { ThemeProvider } from './contexts/ThemeContext'; // Moved to main.tsx
import { ChatInterface } from './components/Chat/ChatInterface';
import { SocialPage } from './pages/SocialPage';
import { OverviewPage } from './pages/OverviewPage';
import { TokensPage } from './pages/TokensPage';
import { ChainsPage } from './pages/ChainsPage';
import { SuperDefiPage } from './pages/SuperDefiPage';

import { TradePage } from './pages/TradePage';
import WalletPage from './pages/WalletPage';
import NewsPage from './pages/NewsPage';
import { useConversations } from './hooks/useConversations';
import type { Message } from './hooks/useConversations';
import { chatWSClient, type ChatEvent } from './utils/chatWebSocket';
import { chatApi } from './services/api';
import { ToastContainer, useToast } from './components/Toast';


function App() {
  const { authenticated, ready, getAccessToken } = usePrivy();

  const [activeTab, setActiveTab] = useState('chat');
  const [pendingAIPrompt, setPendingAIPrompt] = useState<string | null>(null);
  const [generatingConversationId, setGeneratingConversationId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<any | null>(null);

  // Global auto-reload if the page has been hidden for a long time (e.g. overnight)
  // AND Mobile recovery: sync messages when returning from background
  useEffect(() => {
    let lastHiddenTime = 0;
    const RELOAD_STALE_MS = 4 * 60 * 60 * 1000; // 4 hours
    const MIN_BACKGROUND_MS = 2000; // At least 2 seconds in background to trigger sync

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        lastHiddenTime = Date.now();
      } else if (lastHiddenTime > 0) {
        const inactiveDuration = Date.now() - lastHiddenTime;

        // If hidden for more than 4 hours, reload to refresh sessions/sockets
        if (inactiveDuration >= RELOAD_STALE_MS) {
          console.log(`[App] Page inactive for ${Math.round(inactiveDuration / 1000)}s - triggering auto-refresh...`);
          window.location.reload();
          return;
        }

        // Mobile recovery: If hidden for at least 2 seconds, force WebSocket reconnect
        // and reload current conversation messages from DB
        if (inactiveDuration >= MIN_BACKGROUND_MS) {
          console.log(`[App] Page returned from background after ${Math.round(inactiveDuration / 1000)}s - syncing...`);

          try {
            // 1. Force reconnect WebSocket
            const token = await getAccessToken();
            if (token) {
              chatWSClient.connect(token); // Will reconnect if disconnected
            }

            // 2. If there's an active conversation, reload messages from DB
            const currentConvId = conversationsRef.current.find(c => c.id === activeConversationId)?.id;
            if (currentConvId) {
              console.log(`[App] Syncing messages for conversation ${currentConvId}`);
              const resp = await chatApi.getSession(currentConvId);
              if (resp.success && resp.messages) {
                const dbMessages = resp.messages.map((m: any) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  reasoning_content: m.reasoning_content,
                  citations: m.citations,
                  usage: m.usage,
                  tool_calls: m.tool_calls,
                  tool_call_id: m.tool_call_id,
                  status: m.status,
                  message_index: m.message_index,
                  timestamp: m.created_at,
                  type: m.data?.type || 'text',
                  data: m.data,
                }));
                updateConversation(currentConvId, { messages: dbMessages });
                console.log(`[App] Synced ${dbMessages.length} messages from DB`);

                // 3. Check if there's an active task and restore UI state
                if (resp.activeTask && (resp.activeTask.status === 'running' || resp.activeTask.status === 'queued')) {
                  setActiveTask(resp.activeTask);
                  console.log(`[App] Restored active task: ${resp.activeTask.id}`);
                } else {
                  setActiveTask(null);
                }
              }
            }
          } catch (error) {
            console.error('[App] Failed to sync after visibility change:', error);
          }
        }

        lastHiddenTime = 0; // Reset
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [getAccessToken]); // Removed activeConversationId and updateConversation - using refs instead


  useEffect(() => {
    // Check for pre-filled AI query from session storage (e.g. from Token Detail page)
    try {
      const prefill = sessionStorage.getItem('ai_prefill_query');
      if (prefill) {
        sessionStorage.removeItem('ai_prefill_query');
        setPendingAIPrompt(prefill);
        setActiveTab('chat');
      }
    } catch (e) {
      // Ignored
    }

  }, []);

  // Wallet disconnection detection removed - not needed

  const {
    conversations,
    activeConversationId,
    createConversation,
    updateConversation,
    updateConversationTitle,
    loadConversation,
    getActiveConversation,
    deleteConversation,
    conversationsRef,
  } = useConversations();

  // Use refs to track messages being accumulated from WebSocket across multiple conversations
  // Map<sessionId, Map<messageId, Message>>
  const pendingByConversationRef = useRef<Map<string, Map<string, Message>>>(new Map());
  // Ref to track the last processed message completion to prevent duplicate handling
  const lastProcessedCompletionRef = useRef<string | null>(null);
  const pendingFlushTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Global WebSocket listener - persists across page navigation
  // This ensures message updates are captured even when not on chat page
  // CRITICAL: Prioritize generatingConversationId to ensure chunks are captured
  // even when user switches to a different conversation
  // Global WebSocket listener - persists across page navigation
  // This ensures message updates are captured even when not on chat page
  useEffect(() => {
    if (!authenticated || !ready) return;

    let isSubscribed = true;

    // Connect WebSocket to the user-level endpoint
    getAccessToken().then(token => {
      if (token && isSubscribed) {
        chatWSClient.connect(token);
      }
    });

    const handleGlobalChatEvent = async (event: ChatEvent) => {
      const targetSessionId = event.sessionId;
      if (!targetSessionId) return;

      // Get or create pending messages map for this specific session
      if (!pendingByConversationRef.current.has(targetSessionId)) {
        pendingByConversationRef.current.set(targetSessionId, new Map<string, Message>());
      }
      const sessionPending = pendingByConversationRef.current.get(targetSessionId)!;

      // CRITICAL: Handle message_start to create placeholder BEFORE chunks arrive
      if (event.type === 'message_start') {
        const messageId = event.data.messageId || event.data.message_id;
        if (!messageId) return;
        console.log(`[App] Global WS: message_start for session ${targetSessionId}, message: ${messageId}`);

        // Create placeholder in pending messages ref
        sessionPending.set(messageId, {
          id: messageId,
          role: 'assistant',
          content: '',
          reasoning_content: '',
          status: 'streaming',
          citations: [],
        });

        // Also update the conversation state so ChatInterface sees the message
        const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
        if (targetConv) {
          const exists = targetConv.messages.some(m => m.id === messageId);
          if (!exists) {
            const updatedMessages = [...targetConv.messages, {
              id: messageId,
              role: 'assistant' as const,
              content: '',
              reasoning_content: '',
              status: 'streaming' as const,
              timestamp: new Date().toISOString(),
              type: 'text' as const,
            }];
            updateConversation(targetSessionId, updatedMessages);
          }
        }
      } else if (event.type === 'chunk') {
        const messageId = event.data.messageId || event.data.message_id;
        const content = event.data.content;
        const delta = event.data.delta;
        const reasoning_content = event.data.reasoning_content;
        const type = event.data.type;
        if (!messageId) return;

        // Update pending messages ref for this session
        const msg: Message = sessionPending.get(messageId) || {
          id: messageId,
          role: 'assistant',
          content: '',
          reasoning_content: '',
          status: 'streaming',
          citations: [],
        };

        if (type === 'reasoning' && reasoning_content) {
          msg.reasoning_content = (msg.reasoning_content || '') + reasoning_content;
        } else if (content || delta) {
          msg.content = (msg.content || '') + (content || delta);
        }

        sessionPending.set(messageId, msg);

        // Background capture: if user navigates away from the generating conversation,
        // we still need to persist chunks into React state; otherwise switching back will
        // show partial/empty content until DB catches up.
        const shouldFlushBackground =
          targetSessionId === generatingConversationId &&
          activeConversationId !== targetSessionId;
        if (shouldFlushBackground && !pendingFlushTimersRef.current.has(targetSessionId)) {
          const timer = setTimeout(() => {
            pendingFlushTimersRef.current.delete(targetSessionId);
            const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
            if (!targetConv) return;

            const pending = pendingByConversationRef.current.get(targetSessionId);
            if (!pending || pending.size === 0) return;

            const updatedMessages = [...targetConv.messages];
            pending.forEach((pendingMsg, pendingId) => {
              const existingIdx = updatedMessages.findIndex(m => m.id === pendingId);
              if (existingIdx >= 0) {
                const existing = updatedMessages[existingIdx];
                const existingContent = existing.content || '';
                const pendingContent = pendingMsg.content || '';
                const existingReasoning = existing.reasoning_content || '';
                const pendingReasoning = pendingMsg.reasoning_content || '';
                updatedMessages[existingIdx] = {
                  ...existing,
                  content: existingContent.length >= pendingContent.length ? existingContent : pendingContent,
                  reasoning_content: existingReasoning.length >= pendingReasoning.length ? existingReasoning : pendingReasoning,
                  citations: pendingMsg.citations ?? existing.citations,
                  status: 'streaming',
                };
              } else {
                updatedMessages.push({ ...pendingMsg, status: 'streaming' });
              }
            });

            updateConversation(targetSessionId, { messages: updatedMessages });
          }, 250);
          pendingFlushTimersRef.current.set(targetSessionId, timer);
        }

      } else if (event.type === 'message_complete' || (event.type === 'task_status' && event.data.status === 'done')) {
        const completionId = event.data.messageId || event.data.task_id || (Array.from(sessionPending.keys())[0]);
        if (!completionId) return;

        // Prevent duplicate processing for the same completion
        const dedupKey = `${targetSessionId}:${completionId}`;
        if (lastProcessedCompletionRef.current === dedupKey && sessionPending.size === 0) return;
        lastProcessedCompletionRef.current = dedupKey;

        console.log(`[App] Global WS: message_complete for session ${targetSessionId}`);

        const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
        if (targetConv && sessionPending.size > 0) {
          const updatedMessages = [...targetConv.messages];
          sessionPending.forEach((msg, id) => {
            const existingIdx = updatedMessages.findIndex(m => m.id === id);
            if (existingIdx >= 0) {
              const existingContent = updatedMessages[existingIdx].content || '';
              const pendingContent = msg.content || '';
              const existingReasoning = updatedMessages[existingIdx].reasoning_content || '';
              const pendingReasoning = msg.reasoning_content || '';
              const pendingCitations = msg.citations;
              const existingCitations = updatedMessages[existingIdx].citations;

              updatedMessages[existingIdx] = {
                ...updatedMessages[existingIdx],
                content: existingContent.length >= pendingContent.length ? existingContent : pendingContent,
                reasoning_content: existingReasoning.length >= pendingReasoning.length ? existingReasoning : pendingReasoning,
                citations: pendingCitations ?? existingCitations,
                status: 'complete',
              };
            } else {
              updatedMessages.push({ ...msg, status: 'complete' });
            }
          });

          updateConversation(targetSessionId, {
            messages: updatedMessages,
            activeTask: null
          });

          sessionPending.clear();
          lastProcessedCompletionRef.current = 'processed-' + dedupKey;
        } else if (targetConv) {
          // Fallback: Reload from DB
          try {
            const resp = await chatApi.getSession(targetSessionId);
            if (resp.success && resp.messages) {
              const dbMessages = resp.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                reasoning_content: m.reasoning_content,
                citations: m.citations,
                usage: m.usage,
                tool_calls: m.tool_calls,
                tool_call_id: m.tool_call_id,
                status: m.status,
                message_index: m.message_index,
                timestamp: m.created_at,
                type: 'text',
              }));
              updateConversation(targetSessionId, { messages: dbMessages, activeTask: null });
            }
          } catch (error) {
            console.error('[App] Failed to reload messages from DB:', error);
          }
        }

        if (generatingConversationId === targetSessionId) {
          setGeneratingConversationId(null);
        }

        if (activeConversationId === targetSessionId) {
          setActiveTask(null);
        }
      } else if (event.type === 'usage') {
        const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
        if (targetConv) {
          const updatedMessages = targetConv.messages.map(m =>
            m.id === event.data.message_id ? { ...m, usage: event.data.usage } : m
          );
          updateConversation(targetSessionId, { messages: updatedMessages });
        }
      } else if (event.type === 'citations') {
        const targetConv = conversationsRef.current.find(c => c.id === targetSessionId);
        if (targetConv) {
          const updatedMessages = targetConv.messages.map(m =>
            m.id === event.data.message_id ? { ...m, citations: event.data.citations } : m
          );
          updateConversation(targetSessionId, { messages: updatedMessages });
        }
        if (event.data.message_id) {
          const pendingMsg: Message = sessionPending.get(event.data.message_id) || {
            id: event.data.message_id,
            role: 'assistant',
            content: '',
            reasoning_content: '',
            status: 'streaming',
            citations: [],
          };
          pendingMsg.citations = event.data.citations;
          sessionPending.set(event.data.message_id, pendingMsg);
        }
      }
    };

    const unsubscribe = chatWSClient.subscribe(handleGlobalChatEvent);
    return () => {
      isSubscribed = false;
      unsubscribe();
      pendingFlushTimersRef.current.forEach(t => clearTimeout(t));
      pendingFlushTimersRef.current.clear();
    };
  }, [authenticated, ready, updateConversation, generatingConversationId, getAccessToken, activeConversationId]);

  const handleNewChat = async () => {
    // Don't create conversation here - let ChatInterface create it when first message is sent
    // Clear the active conversation to show empty chat
    await loadConversation(''); // This will clear the active conversation
    setActiveTask(null);
    setActiveTab('chat');
  };

  const handleConversationClick = async (id: string) => {
    // Set activeTab FIRST for immediate UI feedback
    setActiveTab('chat');
    // Then load conversation data (async)
    const task = await loadConversation(id);
    setActiveTask(task);
  };

  const handleMessagesChange = (messages: Message[]) => {
    if (activeConversationId) {
      updateConversation(activeConversationId, messages);
    }
  };

  // Ref to prevent double conversation creation
  const isCreatingConversationRef = useRef(false);

  const handleNewConversation = async (firstMessage: string): Promise<string | null> => {
    if (isCreatingConversationRef.current) {
      console.warn('[App] Blocked duplicate conversation creation');
      return null;
    }

    isCreatingConversationRef.current = true;
    try {
      const title = firstMessage.length > 40
        ? firstMessage.substring(0, 40) + '...'
        : firstMessage;
      const newConvId = await createConversation(title);
      if (newConvId) {
        // Immediately load the new conversation so it becomes active
        const task = await loadConversation(newConvId);
        setActiveTask(task);
        // Navigate to chat tab to show the conversation
        setActiveTab('chat');
      }
      return newConvId;
    } finally {
      isCreatingConversationRef.current = false;
    }
  };

  const handleConversationRename = (id: string, newTitle: string) => {
    updateConversationTitle(id, newTitle);
  };

  const handleConversationDelete = (id: string) => {
    deleteConversation(id);
    // If deleted conversation was active, clear it
    if (activeConversationId === id) {
      setActiveTab('chat');
    }
  };



  const handleAIPromptSet = () => {
    setPendingAIPrompt(null);
  };

  const activeConv = getActiveConversation();


  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onConversationClick={handleConversationClick}
        onNewChat={handleNewChat}
        onConversationRename={handleConversationRename}
        onConversationDelete={handleConversationDelete}
        generatingConversationId={generatingConversationId}
        setGeneratingConversationId={setGeneratingConversationId}
      >
        {activeTab === 'chat' && (
          <ChatInterface
            conversationId={activeConversationId}
            initialMessages={activeConv?.messages || []}
            onMessagesChange={handleMessagesChange}
            onNewConversation={handleNewConversation}
            conversationTitle={activeConv?.title}
            onNewChat={handleNewChat}
            pendingAIPrompt={pendingAIPrompt}
            onAIPromptSet={handleAIPromptSet}
            activeTask={activeTask}
            onTaskUpdate={(task) => setActiveTask(task)}
          />
        )}
        {activeTab === 'news' && (
          <NewsPage />
        )}
        {activeTab === 'market-overview' && <OverviewPage />}
        {activeTab === 'market-tokens' && (
          <TokensPage />
        )}
        {activeTab === 'market-chains' && <ChainsPage />}
        {activeTab.startsWith('defi') && <SuperDefiPage />}
        {activeTab === 'social' && <SocialPage />}
        {activeTab === 'kol' && <WalletPage />}
        {activeTab === 'wallet' && <WalletPage />}

        {activeTab === 'trade' && <TradePage />}
      </Layout>
      <GlobalToast />
    </>
  );
}

// Global Toast Component
function GlobalToast() {
  const { toasts, handleClose } = useToast();
  return <ToastContainer toasts={toasts} onClose={handleClose} />;
}

export default App;
