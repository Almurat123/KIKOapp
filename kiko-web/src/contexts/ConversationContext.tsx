// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan Hale
// Reason: the conversation context is the typed contract between the frontend
//         chat owners and the shared conversation store. Its surface must stay
//         aligned with `useConversations`, including the optional reasoning
//         level used when creating new sessions, or downstream chat owners will
//         compile against a stale API shape.
// Goal: keep the exported context type synchronized with the real
//       `useConversations` implementation so chat owners can create and mutate
//       conversations without local type forks.
// Owns: the React context type and provider boundary for conversation state.
// Does Not Own: conversation persistence, websocket state reconciliation, or
//       chat-route lifecycle logic.
// Design Language:
// - the context signature must match the backing hook signature exactly
// - type convenience must not erase live chat capabilities such as reasoning-level session creation
// - forbidden local patch pattern: leaving provider types narrower than the real hook implementation
// Document Provenance:
// - Source: /Users/almurat/KiKo/kiko-web/src/hooks/useConversations.ts
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: aligning `createConversation` context typing with the backing hook implementation
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md

import React, { createContext, useContext } from 'react';
import type { Conversation, Message } from '../hooks/useConversations';

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    isLoading: boolean;
    createConversation: (title?: string, model?: string, reasoningLevel?: string) => Promise<string | null>;
    updateConversation: (id: string, updates: Message[] | Partial<Conversation>) => void;
    updateConversationTitle: (id: string, title: string) => Promise<void>;
    loadConversation: (id: string | null) => Promise<any>;
    getActiveConversation: () => Conversation | undefined;
    deleteConversation: (id: string) => Promise<void>;
    clearAllConversations: () => void;
    conversationsRef: React.MutableRefObject<Conversation[]>;
    registerPendingLocalUserMessage: (conversationId: string, message: Pick<Message, 'id' | 'content' | 'clientCreatedAt' | 'timestamp'>) => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const ConversationProvider: React.FC<{
    value: ConversationContextType;
    children: React.ReactNode;
}> = ({ value, children }) => {
    return (
        <ConversationContext.Provider value={value}>
            {children}
        </ConversationContext.Provider>
    );
};

export const useConversationContext = () => {
    const context = useContext(ConversationContext);
    if (context === undefined) {
        throw new Error('useConversationContext must be used within a ConversationProvider');
    }
    return context;
};
