import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { setAuthTokenProvider } from '../utils/authToken';

// CONTEXT MEMORY
// Updated: 2026-04-09
// Author: Codex
// Reason: Temporary X/Privy debug tracing was removed after the auth flow was
//         stabilized; this bridge should stay focused on supplying tokens to
//         the API layer without adding browser-side diagnostics.
// Goal: Keep one stable owner for wiring Privy access tokens into shared API
//       requests while avoiding auth-specific console noise in normal use.
// Owns: Browser-side access-token provider registration for API callers.
// Does Not Own: Privy SDK internals, route-level auth side effects, backend
//               verification, or browser debug instrumentation.
// Design Language:
// - Keep the bridge silent in normal operation.
// - Preserve the shared token-provider contract for the API layer.
// - Treat getAccessToken() failures as auth-state outcomes, not console events.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md

// Bridge Privy access token into API layer
export const AuthTokenBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken } = usePrivy();

  React.useEffect(() => {
    setAuthTokenProvider(async () => {
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    });
  }, [getAccessToken]);

  return <>{children}</>;
};
