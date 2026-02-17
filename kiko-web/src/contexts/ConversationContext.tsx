import React, { createContext, useContext } from 'react';
import type { Conversation, Message } from '../hooks/useConversations';

interface ConversationContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    isLoading: boolean;
    createConversation: (title?: string, model?: string) => Promise<string | null>;
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
