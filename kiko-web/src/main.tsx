import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ChainProvider } from './contexts/ChainContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AgentModeProvider } from './contexts/AgentModeContext';
import { FarcasterProvider } from './contexts/FarcasterContext';
import { XProvider } from './contexts/XContext';
import { ThemedPrivyProvider } from './components/ThemedPrivyProvider';
import { AuthTokenBridge } from './components/AuthTokenBridge';
import { PrivyConfigError } from './components/PrivyConfigError';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logger } from './utils/logger';
import './index.css';
// import './styles/global.css'; // Removed to fix Beige theme conflict
import './styles/theme.css';
import './styles/design-tokens.css';

// CONTEXT MEMORY
// Updated: 2026-04-09
// Author: Codex
// Reason: Temporary auth-debug boot paths were removed after the X/Privy flow
//         was stabilized; the root should return to a single, predictable boot
//         mode instead of carrying special-case debugging behavior.
// Goal: Preserve stable provider composition and normal StrictMode semantics
//       without browser-wide auth instrumentation.
// Owns: Frontend root boot mode and top-level provider composition.
// Does Not Own: Privy SDK session behavior, route-level auth UX, backend auth
//               verification, or ad hoc browser debug tooling.
// Design Language:
// - Keep one root render mode across local and production environments.
// - Do not install browser-wide auth debugging from the app entrypoint.
// - Keep provider composition stable and easy to reason about.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md

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
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_ID;
const RootMode = React.StrictMode;

// Check if Privy App credentials are configured
if (
  !privyAppId ||
  privyAppId === 'your-privy-app-id' ||
  !privyClientId ||
  privyClientId === 'your-privy-client-id'
) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <RootMode>
      <ErrorBoundary>
        <PrivyConfigError />
      </ErrorBoundary>
    </RootMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <RootMode>
      <ErrorBoundary>
        <ThemeProvider>
          <AgentModeProvider>
            <ThemedPrivyProvider>
              <AuthTokenBridge>
                <XProvider>
                  <FarcasterProvider>
                    <QueryClientProvider client={queryClient}>
                      <ChainProvider>
                        <App />
                      </ChainProvider>
                    </QueryClientProvider>
                  </FarcasterProvider>
                </XProvider>
              </AuthTokenBridge>
            </ThemedPrivyProvider>
          </AgentModeProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </RootMode>
  );
}
