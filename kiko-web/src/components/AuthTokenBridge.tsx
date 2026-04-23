import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { setAuthTokenProvider } from '../utils/authToken';
import { usePrivyEmbeddedWallets } from '../hooks/usePrivyEmbeddedWallets';

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

const API_BASE =
  import.meta.env.VITE_API_URL
  || (import.meta.env.MODE === 'production' ? window.location.origin : 'http://localhost:3001');
const recentWalletBindingSyncs = new Map<string, number>();
const WALLET_BINDING_SYNC_DEDUPE_MS = 5_000;

// Bridge Privy access token into API layer
export const AuthTokenBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authenticated, ready, user, getAccessToken } = usePrivy();
  const { evmWallet, solanaWallet } = usePrivyEmbeddedWallets();

  React.useEffect(() => {
    setAuthTokenProvider(async () => {
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    });
  }, [getAccessToken]);

  React.useEffect(() => {
    if (!ready || !authenticated) return;

    const userId = String(user?.id || '').trim();
    if (!userId) return;

    const syncKey = `${userId}:${evmWallet?.address || ''}:${solanaWallet?.address || ''}`;
    const lastSyncedAt = recentWalletBindingSyncs.get(syncKey) || 0;
    if ((Date.now() - lastSyncedAt) < WALLET_BINDING_SYNC_DEDUPE_MS) {
      return;
    }

    recentWalletBindingSyncs.set(syncKey, Date.now());
    let cancelled = false;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;

        await fetch(`${API_BASE}/api/users/wallet-bindings/sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Best-effort bootstrap only.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, ready, user?.id, evmWallet?.address, solanaWallet?.address, getAccessToken]);

  return <>{children}</>;
};
