/**
 * useAuth Hook
 * 
 * A unified authentication hook that works in both normal and test modes.
 * - In normal mode: uses Privy's usePrivy hook
 * - In test mode: returns mock authentication values (but still calls Privy hooks to satisfy React rules)
 * 
 * Usage: Replace `usePrivy()` with `useAuth()` in components that need to work in test mode.
 */

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { isTestMode } from '../contexts/TestModeContext';

// Mock user for test mode - must match backend's test-user-123
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

// Mock wallets for test mode
const TEST_WALLETS: any[] = [
    {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        walletClientType: 'privy',
        chainType: 'ethereum',
    }
];

export function useAuth() {
    // Always call usePrivy to satisfy React hooks rules
    const privyResult = usePrivy();

    // In test mode, return mock values instead
    if (isTestMode) {
        return {
            ...privyResult, // Keep structure consistent
            authenticated: true,
            ready: true,
            user: TEST_USER as any,
            login: () => console.log('[TestMode] Mock login called'),
            logout: async () => { console.log('[TestMode] Mock logout called'); },
            getAccessToken: async () => 'test-mode-token',
            connectWallet: () => console.log('[TestMode] Mock connectWallet called'),
        };
    }

    // In normal mode, use real Privy values
    return privyResult;
}

export function useAuthWallets() {
    // Always call useWallets to satisfy React hooks rules
    const walletsResult = useWallets();

    // In test mode, return mock wallets
    if (isTestMode) {
        return { wallets: TEST_WALLETS };
    }

    // In normal mode, use real wallets
    return walletsResult;
}
