import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { arbitrum, base, baseSepolia, bsc, mainnet, optimism, polygon } from 'viem/chains';
import { useTheme } from '../hooks/useTheme';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_ID;

// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: mixed
// Why: Mini App auth stays social-login first with Privy embedded wallets, and credits top-up now needs those wallets to switch to Base/Base Sepolia for router deposits.
// Debug Goal: Keep embedded EVM/Solana wallet creation available without exposing external wallet connection options, while allowing credit top-up chain switching.
// Search Tags: privy embedded wallet base sepolia credit top up switchChain
// Invariants:
// - Login methods stay social-only unless product scope explicitly adds external wallet linking.
// - Base Sepolia remains supported while testnet router deployments are used.
// Failure Modes:
// - Removing Base Sepolia makes router testnet top-up fail before the wallet confirmation.
// - Adding external wallet lists can reintroduce WalletConnect CSP failures in Mini App contexts.
// Privy Provider with theme support
export const ThemedPrivyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();

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
        loginMethods: ['email', 'farcaster', 'google', 'twitter'],
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
