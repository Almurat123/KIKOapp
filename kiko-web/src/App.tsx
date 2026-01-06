import { useState, useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Layout } from './components/Layout/Layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { ChatInterface } from './components/Chat/ChatInterface';
import { SocialPage } from './pages/SocialPage';
import { OverviewPage } from './pages/OverviewPage';
import { TokensPage } from './pages/TokensPage';
import { ChainsPage } from './pages/ChainsPage';
import { SuperDefiPage } from './pages/SuperDefiPage';
import { TestCardsPage } from './pages/TestCardsPage';
import { TradePage } from './pages/TradePage';
import WalletPage from './pages/WalletPage';
import NewsPage from './pages/NewsPage';
import { SearchBox } from './components/SearchBox';
import { useConversations } from './hooks/useConversations';
import type { Message } from './hooks/useConversations';
import { chatWSClient, type ChatEvent } from './utils/chatWebSocket';
import { chatApi } from './services/api';
import { MandatoryExportModal } from './components/Wallet/MandatoryExportModal';


function App() {
  const { authenticated, ready, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [activeTab, setActiveTab] = useState('chat');
  const [tokensSearchQuery, setTokensSearchQuery] = useState('');
  const [pendingAIPrompt, setPendingAIPrompt] = useState<string | null>(null);
  const [generatingConversationId, setGeneratingConversationId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<any | null>(null);

  // Automatically detect wallet disconnection via browser events
  useEffect(() => {
    // Check for pre-filled AI query from session storage (e.g. from Token Detail page)
    const prefill = sessionStorage.getItem('ai_prefill_query');
    if (prefill) {
      sessionStorage.removeItem('ai_prefill_query');
      setPendingAIPrompt(prefill);
      setActiveTab('chat');
    }

    if (typeof window === 'undefined') return;

    const handleDisconnect = async () => {
      console.log('[App] Wallet disconnected via browser event');
      // If user is authenticated but wallet disconnected, clear Privy state
      if (authenticated && wallets.length > 0) {
        console.log('[App] Clearing Privy state due to wallet disconnect');
        try {
          await logout();
        } catch (error) {
          console.error('[App] Error during logout:', error);
        }
      }
    };

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[App] Accounts changed:', accounts);
      // If accounts become empty, wallet is disconnected
      if (accounts.length === 0) {
        handleDisconnect();
      }
    };

    // Listen to Ethereum wallet events
    if (window.ethereum) {
      window.ethereum.on('disconnect', handleDisconnect);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }

    // Listen to Solana wallet events
    const solanaWallet = (window as any).okxwallet?.solana || (window as any).phantom?.solana || (window as any).solana;
    if (solanaWallet) {
      solanaWallet.on?.('disconnect', handleDisconnect);
      solanaWallet.on?.('accountChanged', (publicKey: any) => {
        if (!publicKey) {
          handleDisconnect();
        }
      });
    }

    // Cleanup
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener?.('disconnect', handleDisconnect);
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      }
      if (solanaWallet) {
        solanaWallet.off?.('disconnect', handleDisconnect);
        solanaWallet.off?.('accountChanged', handleDisconnect);
      }
    };
  }, [authenticated, wallets.length, logout]);

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
        pendingByConversationRef.current.set(targetSessionId, new Map());
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
        const { messageId, content, delta, reasoning_content, type } = event.data;
        if (!messageId) return;

        // Update pending messages ref for this session
        const msg = sessionPending.get(messageId) || {
          id: messageId,
          role: 'assistant',
          content: '',
          reasoning_content: '',
          status: 'streaming',
        };

        if (type === 'reasoning' && reasoning_content) {
          msg.reasoning_content = (msg.reasoning_content || '') + reasoning_content;
        } else if (content || delta) {
          msg.content = (msg.content || '') + (content || delta);
        }

        sessionPending.set(messageId, msg);

        // Background capture: We don't update React state for every chunk to avoid lag.
        // ChatInterface has its own local WS listener for the ACTIVE conversation.

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

              updatedMessages[existingIdx] = {
                ...updatedMessages[existingIdx],
                content: existingContent.length >= pendingContent.length ? existingContent : pendingContent,
                reasoning_content: existingReasoning.length >= pendingReasoning.length ? existingReasoning : pendingReasoning,
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
      }
    };

    const unsubscribe = chatWSClient.subscribe(handleGlobalChatEvent);
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [authenticated, ready, updateConversation, generatingConversationId, getAccessToken]);

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

  const handleAIAnalyzeComplete = (prompt: string) => {
    setPendingAIPrompt(prompt);
    setActiveTab('chat');
  };

  const handleAIPromptSet = () => {
    setPendingAIPrompt(null);
  };

  const activeConv = getActiveConversation();

  // Determine header content based on active tab
  // All pages should have a header (even if empty) to avoid hamburger menu conflicts
  const getHeaderContent = () => {
    switch (activeTab) {
      case 'market-tokens':
        return (
          <SearchBox
            value={tokensSearchQuery}
            onChange={setTokensSearchQuery}
            placeholder="Search tokens by name, symbol, or chain..."
          />
        );
      default:
        // Return empty div for pages without search to ensure header exists
        return <div />;
    }
  };

  return (
    <ThemeProvider>
      <MandatoryExportModal />
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onConversationClick={handleConversationClick}
        onNewChat={handleNewChat}
        onConversationRename={handleConversationRename}
        onConversationDelete={handleConversationDelete}
        headerContent={getHeaderContent()}
        onAIAnalyzeComplete={handleAIAnalyzeComplete}
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
          <TokensPage
            searchQuery={tokensSearchQuery}
            onSearchChange={setTokensSearchQuery}
          />
        )}
        {activeTab === 'market-chains' && <ChainsPage />}
        {activeTab.startsWith('defi') && <SuperDefiPage />}
        {activeTab === 'social' && <SocialPage />}
        {activeTab === 'kol' && <WalletPage />}
        {activeTab === 'wallet' && <WalletPage />}
        {activeTab === 'test' && <TestCardsPage />}
        {activeTab === 'trade' && <TradePage />}
      </Layout>
    </ThemeProvider>
  );
}

export default App;
