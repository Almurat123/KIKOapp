import { useState, useEffect, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  date?: string; // ISO date string for date separator
  type?: 'text' | 'token-card';
  data?: any;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'kiko-conversations';
const MAX_CONVERSATIONS = 100; // Limit to prevent storage overflow

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
        // Restore last active conversation if exists
        const lastActive = localStorage.getItem('kiko-active-conversation');
        if (lastActive && parsed.find((c: Conversation) => c.id === lastActive)) {
          setActiveConversationId(lastActive);
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage whenever conversations change
  const saveConversations = useCallback((convs: Conversation[]) => {
    try {
      // Keep only the most recent conversations
      const toSave = convs.slice(0, MAX_CONVERSATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      if (activeConversationId) {
        localStorage.setItem('kiko-active-conversation', activeConversationId);
      }
    } catch (error) {
      console.error('Failed to save conversations:', error);
      // If quota exceeded, try to remove oldest conversations
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        const reduced = convs.slice(0, Math.floor(MAX_CONVERSATIONS / 2));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
        } catch (e) {
          console.error('Failed to save even after reduction:', e);
        }
      }
    }
  }, [activeConversationId]);

  useEffect(() => {
    if (!isLoading && conversations.length > 0) {
      // Only save conversations that have messages (filter out empty ones)
      const conversationsWithMessages = conversations.filter(conv => conv.messages.length > 0);
      if (conversationsWithMessages.length > 0) {
        saveConversations(conversationsWithMessages);
      } else {
        // If all conversations are empty, clear storage
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [conversations, isLoading, saveConversations]);

  const createConversation = useCallback((title?: string) => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    return newConv.id;
  }, []);

  const updateConversation = useCallback((id: string, messages: Message[]) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === id) {
          // Auto-generate title from first user message if still default
          let title = conv.title;
          if (title === 'New Chat' && messages.length > 0) {
            const firstUserMsg = messages.find(m => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.content.length > 40
                ? firstUserMsg.content.substring(0, 40) + '...'
                : firstUserMsg.content;
            }
          }
          return {
            ...conv,
            title,
            messages,
            updatedAt: Date.now(),
          };
        }
        return conv;
      })
    );
  }, []);

  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv
      )
    );
  }, []);

  const loadConversation = useCallback((id: string) => {
    if (!id) {
      // Clear active conversation
      setActiveConversationId(null);
      return;
    }
    const exists = conversations.find(c => c.id === id);
    if (exists) {
      setActiveConversationId(id);
    }
  }, [conversations]);

  const getActiveConversation = useCallback(() => {
    return conversations.find(c => c.id === activeConversationId);
  }, [conversations, activeConversationId]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  }, [activeConversationId]);

  const clearAllConversations = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('kiko-active-conversation');
  }, []);

  return {
    conversations,
    activeConversationId,
    isLoading,
    createConversation,
    updateConversation,
    updateConversationTitle,
    loadConversation,
    getActiveConversation,
    deleteConversation,
    clearAllConversations,
  };
};

