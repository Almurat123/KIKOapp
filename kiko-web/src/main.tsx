// CRITICAL: Import fetch interceptor FIRST to ensure all API calls have App Key
import './utils/fetchInterceptor';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ChainProvider } from './contexts/ChainContext';
import { useTheme } from './hooks/useTheme';
import { usePrivy } from '@privy-io/react-auth';
import { setAuthTokenProvider } from './utils/authToken';
import { ThemeProvider } from './contexts/ThemeContext'; // Added ThemeProvider
import { logger } from './utils/logger';
import './index.css';
// import './styles/global.css'; // Removed to fix Beige theme conflict
import './styles/theme.css';
import './styles/design-tokens.css';

// Global error logging and console sanitization
if (typeof window !== 'undefined') {
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

  // iOS Safari Debug: Always allow console.error in production to catch errors
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  if (!isDev) {
    // Production: Suppress verbose logs but keep errors visible
    const noop = () => { };

    console.log = noop;
    console.info = noop;
    console.debug = noop;
    // Keep warn and error active for iOS Safari debugging
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }

  // Global error handlers with iOS Safari fallback
  window.onerror = function (message, source, lineno, colno, error) {
    // Log to console for iOS Safari debugging
    originalConsoleError('[Global Error]', { message, source, lineno, colno, error });
    logger.error('[Global Error]', { message, source, lineno, colno, error });
    return false;
  };
  window.onunhandledrejection = function (event) {
    originalConsoleError('[Unhandled Rejection]', event.reason);
    logger.error('[Unhandled Rejection]', event.reason);
  };

  // iOS Safari BigInt support check
  try {
    const testBigInt = BigInt(1);
    if (typeof testBigInt !== 'bigint') {
      throw new Error('BigInt not supported');
    }
  } catch (e) {
    originalConsoleError('[iOS Safari] BigInt not supported:', e);
    alert('Your browser does not support BigInt. Please update to the latest iOS version or use a different browser.');
  }
}

const queryClient = new QueryClient();

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
          walletList: [],
        },
        loginMethods: ['email', 'farcaster', 'google', 'twitter'],
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
          Please set your Privy App ID to use embedded wallet features.
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
      <ThemeProvider>
        <ThemedPrivyProvider>
          <AuthTokenBridge>
            <QueryClientProvider client={queryClient}>
              <ChainProvider>
                <App />
              </ChainProvider>
            </QueryClientProvider>
          </AuthTokenBridge>
        </ThemedPrivyProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
