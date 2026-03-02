import React, { useMemo } from 'react';
import ThemeContext from '../contexts/ThemeContext';
import { AgentModeContext } from '../contexts/AgentModeContext';
import { ChainContext, SUPPORTED_CHAINS } from '../contexts/ChainContext';
import { ConversationProvider } from '../contexts/ConversationContext';
import { SidebarContext } from '../components/Layout/Layout';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface MockProvidersProps {
    children: React.ReactNode;
    chatStarted?: boolean;
    messages?: any[];
    activeConversationId?: string | null;
}

export const MockProviders: React.FC<MockProvidersProps> = ({
    children,
    chatStarted = false,
    messages = [],
    activeConversationId = null,
}) => {
    // 1. Theme Mock
    const themeValue = useMemo(() => ({
        theme: 'dark' as const,
        resolvedTheme: 'dark' as const,
        setTheme: () => { },
        toggleTheme: () => { },
        isDark: true,
    }), []);

    // 1b. Local QueryClient to avoid shared state between render threads
    const queryClient = useMemo(() => new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    }), []);

    // 2. Agent Mode Mock
    const agentModeValue = useMemo(() => ({
        agentModeEnabled: false,
        agentModeSource: 'default' as const,
        setAgentModeEnabled: () => { },
        isQueryOverride: false,
    }), []);

    // 3. Chain Mock
    const chainValue = useMemo(() => ({
        currentChain: SUPPORTED_CHAINS[0], // Base
        switchChain: async () => { },
        supportedChains: SUPPORTED_CHAINS,
    }), []);

    // 4. Sidebar Mock
    const sidebarValue = useMemo(() => ({
        onOpenSidebar: () => { },
        isSidebarOpen: true,
        onOpenProfile: () => { },
        setChatStarted: () => { },
        chatStarted,
        refreshUsageSummary: () => { },
        onBackHandler: null,
        setOnBackHandler: () => { },
    }), [chatStarted]);

    // 5. Conversation Mock
    const conversationValue = useMemo(() => ({
        conversations: activeConversationId ? [{
            id: activeConversationId,
            messages,
            title: 'Demo Chat',
            createdAt: 1710000000000,
            updatedAt: 1710000000000,
        }] : [],
        activeConversationId,
        isLoading: false,
        createConversation: async () => activeConversationId || '',
        updateConversation: () => { },
        updateConversationTitle: async () => { },
        loadConversation: async () => null,
        getActiveConversation: () => activeConversationId ? {
            id: activeConversationId,
            messages,
            title: 'Demo Chat',
            createdAt: 1710000000000,
            updatedAt: 1710000000000,
        } : undefined,
        deleteConversation: async () => { },
        clearAllConversations: () => { },
        conversationsRef: { current: [] as any[] },
        registerPendingLocalUserMessage: () => { },
    }), [activeConversationId, messages]);

    return (
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <ThemeContext.Provider value={themeValue}>
                    <AgentModeContext.Provider value={agentModeValue}>
                        <ChainContext.Provider value={chainValue}>
                            <SidebarContext.Provider value={sidebarValue}>
                                <ConversationProvider value={conversationValue}>
                                    {children}
                                </ConversationProvider>
                            </SidebarContext.Provider>
                        </ChainContext.Provider>
                    </AgentModeContext.Provider>
                </ThemeContext.Provider>
            </MemoryRouter>
        </QueryClientProvider>
    );
};
