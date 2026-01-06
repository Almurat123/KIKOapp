import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { mainnet, base, arbitrum, bsc, optimism, polygon } from 'viem/chains';
import App from './App';
import { ChainProvider } from './contexts/ChainContext';
import { useTheme } from './hooks/useTheme';
import { usePrivy } from '@privy-io/react-auth';
import { setAuthTokenProvider } from './utils/authToken';
import './styles/global.css';
import './styles/theme.css';
import './styles/design-tokens.css';

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [mainnet, base, arbitrum, bsc, optimism, polygon],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [bsc.id]: http('https://bsc-dataseed.binance.org/'),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
});

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;

// Privy Provider with theme support
const ThemedPrivyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();

  // Determine Privy theme and logo based on resolved theme
  const privyTheme = resolvedTheme === 'dark' ? '#222224' : '#FFFFFF';
  const privyLogo = resolvedTheme === 'dark'
    ? 'https://auth.privy.io/logos/privy-logo-dark.png'
    : 'https://auth.privy.io/logos/privy-logo.png';

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          accentColor: '#6A6FF5',
          theme: privyTheme,
          showWalletLoginFirst: false,
          logo: privyLogo,
          walletChainType: 'ethereum-and-solana',
          walletList: [
            'metamask',
            'coinbase_wallet',
            'rainbow',
            'wallet_connect',
            'phantom',
          ],
        },
        loginMethods: ['email', 'wallet', 'farcaster', 'google'],
        fundingMethodConfig: {
          moonpay: {
            useSandbox: true,
          },
        },
        embeddedWallets: {
          ethereum: {
            // Automatically create Ethereum embedded wallet on login
            createOnLogin: 'all-users',
          },
          solana: {
            // Automatically create Solana embedded wallet on login
            createOnLogin: 'all-users',
          },
          // Allow users to recover/export their wallets
          showWalletUIs: true,
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
        // Keep external wallets for users who prefer their own wallets
        externalWallets: {
          ethereum: {
            connectors: [
              'metamask',
              'coinbase_wallet',
              'wallet_connect',
              'rainbow',
            ],
          },
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        } as any,
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: {},
              rpcSubscriptions: {},
            },
          },
        } as any,
      }}
    >
      {children}
    </PrivyProvider>
  );
};

// Bridge Privy access token into API layer
const AuthTokenBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, authenticated } = usePrivy();

  React.useEffect(() => {
    setAuthTokenProvider(async () => {
      if (!authenticated) return null;
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    });
  }, [authenticated, getAccessToken]);

  return <>{children}</>;
};

// Privy Configuration Error Component
const PrivyConfigError: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f5f5f5',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '600px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ margin: '0 0 16px 0', color: '#333', fontSize: '24px' }}>
          ⚠️ Privy App ID Not Configured
        </h1>
        <p style={{ margin: '0 0 24px 0', color: '#666', lineHeight: 1.6 }}>
          Please set your Privy App ID to use wallet connection features.
        </p>
        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#333', fontSize: '16px' }}>
            Setup Steps:
          </h3>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#666', lineHeight: 1.8 }}>
            <li>
              Create a <code style={{
                background: '#e9ecef',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}>.env</code> file in the project root directory
            </li>
            <li>
              Add the following content:<br />
              <code style={{
                background: '#e9ecef',
                padding: '8px 12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                display: 'block',
                marginTop: '8px',
              }}>
                VITE_PRIVY_APP_ID=your-actual-privy-app-id
              </code>
            </li>
            <li>
              Get your App ID from the{' '}
              <a
                href="https://dashboard.privy.io"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#6A6FF5', textDecoration: 'none' }}
              >
                Privy Dashboard
              </a>
            </li>
            <li>Restart the development server</li>
          </ol>
        </div>
        <p style={{ margin: 0, color: '#999', fontSize: '14px' }}>
          If you don't have a Privy account yet, visit{' '}
          <a
            href="https://privy.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#6A6FF5', textDecoration: 'none' }}
          >
            privy.io
          </a>{' '}
          to sign up and create an application.
        </p>
      </div>
    </div>
  );
};

// Check if Privy App ID is configured
if (!privyAppId || privyAppId === 'your-privy-app-id') {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <PrivyConfigError />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemedPrivyProvider>
        <AuthTokenBridge>
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
              <ChainProvider>
                <App />
              </ChainProvider>
            </WagmiProvider>
          </QueryClientProvider>
        </AuthTokenBridge>
      </ThemedPrivyProvider>
    </React.StrictMode>
  );
}
