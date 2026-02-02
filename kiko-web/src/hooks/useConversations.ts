import { useState, useEffect, useCallback, useRef } from 'react';
import { chatApi } from '../services/api';
import { usePrivy } from '@privy-io/react-auth';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  date?: string;
  type?: 'text' | 'swap-card' | 'token-card' | 'strategy-card' | 'launchpad-card' | 'chart-card' | 'transaction-status-card';
  data?: any;
  citations?: Array<string | { url: string; avatar_url?: string }>;
  reasoning_content?: string;
  transactionStatus?: 'waiting' | 'success' | 'failed' | 'cancelled';
  transactionHash?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  tool_calls?: any[];
  tool_call_id?: string;
  status?: 'streaming' | 'complete' | 'error';
  message_index?: number;
  feedback?: 'like' | 'dislike' | null;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  activeTask?: {
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    [key: string]: any;
  } | null;
}

export const useConversations = () => {
  const { authenticated, ready, getAccessToken } = usePrivy();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // CRITICAL: Keep a ref in sync with conversations state for synchronous access.
  // This fixes the race condition where ChatInterface unmount saves messages,
  // but state update is async and remount reads stale data.
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Load user sessions from backend
  useEffect(() => {
    if (ready && authenticated) {
      const loadSessions = async () => {
        setIsLoading(true);
        try {
          // Wait for token to be available
          const token = await getAccessToken();
          if (!token) {
            console.warn('[useConversations] No auth token available, skipping session load');
            return;
          }
          const sessions = await chatApi.getSessions();
          const newConversations = sessions.map((s: any) => ({
            id: s.id,
            title: s.title,
            messages: [],
            createdAt: new Date(s.createdAt || s.created_at).getTime(),
            updatedAt: new Date(s.updatedAt || s.updated_at).getTime(),
            model: s.model,
          }));
          setConversations(newConversations);
          conversationsRef.current = newConversations; // Sync ref immediately
        } catch (error) {
          console.error('[useConversations] Failed to load sessions:', error);
        } finally {
          setIsLoading(false);
        }
      };
      loadSessions();
    }
  }, [ready, authenticated, getAccessToken]);

  const createConversation = useCallback(async (title?: string, model?: string) => {
    if (!authenticated) {
      console.warn('[useConversations] Cannot create conversation: not authenticated');
      return null;
    }
    try {
      const resp = await chatApi.createSession(title, model);
      if (resp && resp.success) {
        const s = resp.session;
        const newConv: Conversation = {
          id: s.id,
          title: s.title,
          messages: [],
          createdAt: new Date((s as any).createdAt || (s as any).created_at).getTime(),
          updatedAt: new Date((s as any).updatedAt || (s as any).updated_at).getTime(),
          model: s.model,
        };
        setConversations(prev => {
          const updated = [newConv, ...prev];
          conversationsRef.current = updated; // Sync ref immediately
          return updated;
        });
        setActiveConversationId(newConv.id);
        return newConv.id;
      }
    } catch (error) {
      console.error('[useConversations] Failed to create session:', error);
    }
    return null;
  }, [authenticated]);

  const updateConversation = useCallback((id: string, updates: Message[] | Partial<Conversation>) => {
    // Handle both legacy (Message[]) and new (Partial<Conversation>) signatures
    const partialUpdates = Array.isArray(updates) ? { messages: updates } : updates;

    // CRITICAL: Synchronously update ref FIRST for immediate access
    conversationsRef.current = conversationsRef.current.map(conv =>
      conv.id === id ? { ...conv, ...partialUpdates, updatedAt: Date.now() } : conv
    );
    // Then update React state (async)
    setConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, ...partialUpdates, updatedAt: Date.now() } : conv
      )
    );
  }, []);

  const updateConversationTitle = useCallback(async (id: string, title: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv
      )
    );
    try {
      await chatApi.updateSession(id, { title });
    } catch (error) {
      console.error('[useConversations] Failed to update title on backend:', error);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    if (!id) {
      setActiveConversationId(null);
      return null;
    }

    setActiveConversationId(id);

    // CRITICAL: Get current local messages BEFORE loading from database
    // This preserves messages that haven't been saved to DB yet (e.g., during AI thinking)
    const currentConv = conversationsRef.current.find(c => c.id === id);
    const localMessages = currentConv?.messages || [];

    // Fetch full session with messages
    try {
      const resp = await chatApi.getSession(id);
      console.log('[useConversations] loadConversation response:', {
        success: resp.success,
        messageCount: resp.messages?.length,
        messages: resp.messages?.map((m: any) => ({
          id: m.id,
          role: m.role,
          type: m.type,
          hasData: !!m.data,
          content: m.content?.substring(0, 50)
        })),
      });
      if (resp.success) {
        // Map backend messages to frontend format
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
          type: m.type || 'text',
          data: m.data,
          transactionStatus: m.transactionStatus,
          transactionHash: m.transactionHash,
          feedback: m.feedback,
        }));

        // MERGE: Start with db messages, then add any local messages not in db
        // This preserves user messages and AI placeholders that haven't been saved yet
        // IMPORTANT: Check by content+role too, not just ID, because local temp IDs differ from DB IDs
        const mergedMessages = [...dbMessages];

        // Check if DB has any assistant message (to know if processing is complete)
        const hasAssistantInDb = dbMessages.some((m: any) => m.role === 'assistant');

        for (const localMsg of localMessages) {
          // Check if exists by ID
          const existsById = dbMessages.find((m: any) => m.id === localMsg.id);
          if (existsById) continue; // Already in DB

          // Check if same content exists (for user messages with different IDs)
          // This prevents duplicates when local temp ID differs from DB ID
          const existsByContent = localMsg.role === 'user' && dbMessages.find(
            (m: any) => m.role === 'user' && (m.content || '').trim() === (localMsg.content || '').trim()
          );
          if (existsByContent) {
            console.log('[useConversations] Skipping duplicate user message (content match):', localMsg.id);
            continue;
          }

          // For assistant messages: 
          // - If DB has an assistant message with content, skip empty local placeholder
          // - If DB has NO assistant message, preserve local placeholder for streaming
          if (localMsg.role === 'assistant') {
            const hasContent = localMsg.content && localMsg.content.length > 0;
            // If DB has the real message (any assistant message), and local is empty/placeholder, skip it
            if (!hasContent && hasAssistantInDb) {
              console.log('[useConversations] Skipping empty assistant placeholder (DB has msg):', localMsg.id);
              continue;
            }

            // If DB matches content (partial or full), skip local
            const existsByContent = dbMessages.find(
              (m: any) => m.role === 'assistant' && (m.content || '').includes(localMsg.content || '')
            );
            if (existsByContent) {
              console.log('[useConversations] Skipping duplicate assistant message (content subset):', localMsg.id);
              continue;
            }
          }

          // Local message not in DB yet - preserve it, but with strict checks

          // 1. Timestamp check: If local message is older than the last DB message, it's likely stale/orphaned
          const lastDbMsg = dbMessages[dbMessages.length - 1];
          if (lastDbMsg && lastDbMsg.timestamp) {
            const localTime = new Date(localMsg.timestamp || 0).getTime();
            const dbTime = new Date(lastDbMsg.timestamp).getTime();
            // Allow 5s buffer for clock skew, but if local is >5s older than latest DB msg, drop it
            if (localTime < dbTime - 5000) {
              console.log('[useConversations] Dropping stale local message:', localMsg.id, localMsg.role);
              continue;
            }
          }

          console.log('[useConversations] Preserving local message not in DB:', localMsg.id, localMsg.role);
          mergedMessages.push(localMsg as typeof dbMessages[number]);
        }

        updateConversation(id, mergedMessages);

        // Return activeTask if exists for UI state restoration
        return resp.activeTask || null;
      }
    } catch (error) {
      console.error('[useConversations] Failed to load session messages:', error);
    }
    return null;
  }, [updateConversation]);

  const getActiveConversation = useCallback(() => {
    // Use ref for synchronous access to the latest data
    // This ensures we get the most up-to-date conversations even during React's async state updates
    return conversationsRef.current.find(c => c.id === activeConversationId);
  }, [activeConversationId]);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
    try {
      await chatApi.deleteSession(id);
    } catch (error) {
      console.error('[useConversations] Failed to delete session on backend:', error);
    }
  }, [activeConversationId]);

  const clearAllConversations = useCallback(() => {
    // We don't want to delete ALL backend sessions at once usually, 
    // but we can clear the local state
    setConversations([]);
    setActiveConversationId(null);
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
    conversationsRef,
  };
};


