/**
 * Test Mode Context
 * 
 * Provides a mock authentication context for testing purposes.
 * When VITE_TEST_MODE=true, this bypasses Privy authentication entirely.
 * 
 * Usage:
 * 1. Set VITE_TEST_MODE=true in kiko-web/.env
 * 2. Set TEST_MODE=true in kiko-api/.env (for backend bypass)
 * 3. Restart both servers
 */

import React, { createContext, useContext, type ReactNode } from 'react';

// Test mode flag - check environment variable
export const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

// Mock user data for test mode
const TEST_USER = {
    id: 'test-user-123',
    createdAt: new Date(),
    linkedAccounts: [
        {
            type: 'wallet' as const,
            address: '0x1234567890abcdef1234567890abcdef12345678',
            chainType: 'ethereum' as const,
            walletClientType: 'privy' as const,
            connectorType: 'embedded' as const,
            chainId: 'eip155:1',
            verified: true,
        },
    ],
    wallet: {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainType: 'ethereum' as const,
        walletClientType: 'privy' as const,
        connectorType: 'embedded' as const,
        chainId: 'eip155:1',
    },
};

// Mock Privy context values
interface MockPrivyContextValue {
    authenticated: boolean;
    ready: boolean;
    user: typeof TEST_USER | null;
    login: () => void;
    logout: () => Promise<void>;
    getAccessToken: () => Promise<string | null>;
    connectWallet: () => void;
}

const mockPrivyValue: MockPrivyContextValue = {
    authenticated: true,
    ready: true,
    user: TEST_USER,
    login: () => console.log('[TestMode] Mock login called'),
    logout: async () => console.log('[TestMode] Mock logout called'),
    getAccessToken: async () => {
        // Return a mock JWT token for test mode
        // This token will be accepted by backend when TEST_MODE=true
        return 'test-mode-token';
    },
    connectWallet: () => console.log('[TestMode] Mock connectWallet called'),
};

// Create context
const TestModeContext = createContext<MockPrivyContextValue | null>(null);

// Provider component
export const TestModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    if (!isTestMode) {
        // If not in test mode, just render children without mock context
        return <>{children}</>;
    }

    console.warn('🧪 [TestMode] Running in TEST MODE - authentication is bypassed!');
    console.warn('🧪 [TestMode] Using mock user:', TEST_USER.id);

    return (
        <TestModeContext.Provider value={mockPrivyValue}>
            {children}
        </TestModeContext.Provider>
    );
};

// Hook to use test mode context
export const useTestMode = () => {
    const context = useContext(TestModeContext);
    return {
        isTestMode,
        mockPrivyValue: context,
    };
};

// Hook that can replace usePrivy in test mode
export const usePrivyOrTestMode = (): MockPrivyContextValue => {
    const context = useContext(TestModeContext);

    if (isTestMode && context) {
        return context;
    }

    // This should never be called if not in test mode and wrapped properly
    throw new Error('usePrivyOrTestMode must be used within TestModeProvider when in test mode');
};

export { TEST_USER };
