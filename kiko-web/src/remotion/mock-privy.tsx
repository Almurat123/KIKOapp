import React from 'react';

export const usePrivy = () => {
    return {
        authenticated: true,
        user: {
            id: 'did:privy:remotion-mock',
            wallet: { address: '0x1234567890123456789012345678901234567890' },
            linkedAccounts: [
                {
                    type: 'wallet',
                    address: '0x1234567890123456789012345678901234567890',
                    chainType: 'ethereum',
                    walletClientType: 'privy',
                }
            ]
        },
        ready: true,
        login: () => { },
        logout: () => { },
        getAccessToken: async () => 'mock-token',
    };
};

export const useWallets = () => {
    return {
        wallets: [
            {
                address: '0x1234567890123456789012345678901234567890',
                walletClientType: 'privy',
                chainId: 'eip155:8453',
            }
        ],
    };
};

// Mock the Provider as well in case it's used
export const PrivyProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};
