// CRITICAL: Import fetch interceptor FIRST to ensure all API calls have App Key
import './utils/fetchInterceptor';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ChainProvider } from './contexts/ChainContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ThemedPrivyProvider } from './components/ThemedPrivyProvider';
import { AuthTokenBridge } from './components/AuthTokenBridge';
import { PrivyConfigError } from './components/PrivyConfigError';
import { ErrorBoundary } from './components/ErrorBoundary';
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

// Check if Privy App ID is configured
if (!privyAppId || privyAppId === 'your-privy-app-id') {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <PrivyConfigError />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </React.StrictMode>
  );
}
