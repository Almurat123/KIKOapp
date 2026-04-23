import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { arbitrum, base, baseSepolia, bsc, mainnet, optimism, polygon } from 'viem/chains';
import { useMiniAppContext } from '../contexts/MiniAppContext';
import { useTheme } from '../hooks/useTheme';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_ID;

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: mixed
// Why: Mini App hosts should use browser social login instead of the Farcaster-specific embedding path, while keeping embedded wallets available for downstream actions like credit top-up.
// Debug Goal: Keep the login modal browser-native in Mini App contexts and preserve wallet creation for trade/top-up flows.
// Search Tags: privy browser login mini app farcaster embedded wallet
// Invariants:
// - Mini App login methods stay browser-social-only unless product scope explicitly adds Farcaster login back.
// - Base Sepolia remains supported while testnet router deployments are used.
// Failure Modes:
// - Removing Base Sepolia makes router testnet top-up fail before the wallet confirmation.
// - Adding external wallet lists can reintroduce WalletConnect CSP failures in Mini App contexts.
// Privy Provider with theme support
export const ThemedPrivyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const { isMiniApp, loading: miniAppLoading } = useMiniAppContext();
  const useBrowserOnlyLoginMethods = miniAppLoading || isMiniApp;

  // Determine Privy theme and logo based on resolved theme
  const privyTheme = resolvedTheme === 'dark' ? '#222224' : '#FFFFFF';
  const privyLogo = resolvedTheme === 'dark'
    ? 'https://auth.privy.io/logos/privy-logo-dark.png'
    : 'https://auth.privy.io/logos/privy-logo.png';

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      config={{
        appearance: {
          accentColor: '#6A6FF5',
          theme: privyTheme,
          showWalletLoginFirst: false,
          logo: privyLogo,
        },
        supportedChains: [base, baseSepolia, mainnet, bsc, arbitrum, optimism, polygon],
        defaultChain: base,
        loginMethods: useBrowserOnlyLoginMethods
          ? ['email', 'google', 'twitter']
          : ['email', 'farcaster', 'google', 'twitter'],
        // Removed fundingMethodConfig temporarily to test if sandbox is causing the crash
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
          solana: {
            createOnLogin: 'all-users',
          },
          showWalletUIs: true,
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: {},
              rpcSubscriptions: {},
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }}
    >
      {children}
    </PrivyProvider>
  );
};
