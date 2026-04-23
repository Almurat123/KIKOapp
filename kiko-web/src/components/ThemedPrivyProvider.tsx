import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { arbitrum, base, baseSepolia, bsc, mainnet, optimism, polygon } from 'viem/chains';
import { useMiniAppContext } from '../contexts/MiniAppContext';
import { useTheme } from '../hooks/useTheme';
import { MiniAppPrivyBootstrap } from './MiniAppPrivyBootstrap';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_ID;

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: active
// Why: Farcaster Mini Apps need the official SIWF-based auto-login flow and cannot rely
//      on Privy modal login or automatic embedded wallet creation.
// Debug Goal: Use Mini App auth for session bootstrap, disable unsupported external wallet
//             connectors in Mini App hosts, and manually provision embedded wallets after auth.
// Search Tags: privy farcaster mini app auto login walletconnect embedded wallet
// Invariants:
// - Mini App auth must prefer `loginToMiniApp` over browser social flows.
// - WalletConnect and other external wallet connectors stay disabled inside Mini Apps.
// - Embedded wallets in Mini Apps are provisioned manually after auth, not via `createOnLogin`.
// - Base Sepolia remains supported while testnet router deployments are used.
// Failure Modes:
// - Re-enabling browser social login in Mini Apps brings back auth.privy.io iframe/browser flow bugs.
// - Re-enabling WalletConnect causes Farcaster CSP failures against explorer-api.walletconnect.com.
// - Re-enabling createOnLogin in Mini Apps causes unsupported embedded-wallet bootstrap races.
// Privy Provider with theme support
export const ThemedPrivyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const { isMiniApp, loading: miniAppLoading } = useMiniAppContext();
  const isMiniAppContext = !miniAppLoading && isMiniApp;

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
        loginMethods: isMiniAppContext
          ? ['farcaster']
          : ['email', 'farcaster', 'google', 'twitter'],
        externalWallets: isMiniAppContext
          ? {
              disableAllExternalWallets: true,
              walletConnect: {
                enabled: false,
              },
            }
          : undefined,
        embeddedWallets: {
          ethereum: {
            createOnLogin: isMiniAppContext ? 'off' : 'all-users',
          },
          solana: {
            createOnLogin: isMiniAppContext ? 'off' : 'all-users',
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
      <MiniAppPrivyBootstrap />
      {children}
    </PrivyProvider>
  );
};
