import React, { useState } from 'react';
import { Layout } from './components/Layout/Layout';
import { ChatInterface } from './components/Chat/ChatInterface';
import { MarketDataPage } from './pages/MarketDataPage';
import { TestCardsPage } from './pages/TestCardsPage';
import { useConversations } from './hooks/useConversations';
import type { Message } from './hooks/useConversations';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const {
    conversations,
    activeConversationId,
    isLoading,
    createConversation,
    updateConversation,
    updateConversationTitle,
    loadConversation,
    getActiveConversation,
    deleteConversation,
  } = useConversations();

  const handleNewChat = () => {
    // Don't create conversation here - let ChatInterface create it when first message is sent
    // Clear the active conversation to show empty chat
    loadConversation(''); // This will clear the active conversation
    setActiveTab('chat');
  };

  const handleConversationClick = (id: string) => {
    loadConversation(id);
    setActiveTab('chat');
  };

  const handleMessagesChange = (messages: Message[]) => {
    if (activeConversationId) {
      updateConversation(activeConversationId, messages);
    }
  };

  const handleNewConversation = (firstMessage: string): string => {
    const title = firstMessage.length > 40
      ? firstMessage.substring(0, 40) + '...'
      : firstMessage;
    const newConvId = createConversation(title);
    // Immediately load the new conversation so it becomes active
    loadConversation(newConvId);
    return newConvId;
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

  const activeConv = getActiveConversation();

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onConversationClick={handleConversationClick}
      onNewChat={handleNewChat}
      onConversationRename={handleConversationRename}
      onConversationDelete={handleConversationDelete}
    >
      {activeTab === 'chat' && (
        <ChatInterface
          conversationId={activeConversationId}
          initialMessages={activeConv?.messages || []}
          onMessagesChange={handleMessagesChange}
          onNewConversation={handleNewConversation}
        />
      )}
      {activeTab === 'market' && <MarketDataPage />}
      {activeTab === 'news' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          News Feed Placeholder
        </div>
      )}
      {activeTab === 'defi' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          SuperDefi Placeholder
        </div>
      )}
      {activeTab === 'test' && <TestCardsPage />}
    </Layout>
  );
}

export default App;
