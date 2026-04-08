import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { resolveCoreApiBase } from '../utils/coreApiBase';

interface XContextValue {
  xUserId: string | null;
  username: string | null;
  profileUrl: string | null;
  linkedAt: string | null;
  dmOptInAt: string | null;
  notificationsMuted: boolean;
  linkUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

interface XContextResponse {
  success: boolean;
  data?: {
    xUserId: string | null;
    username: string | null;
    profileUrl: string | null;
    linkedAt: string | null;
    dmOptInAt: string | null;
    notificationsMuted: boolean;
    linkUrl: string;
  };
}

const CORE_API_BASE_URL = resolveCoreApiBase();
const XContext = createContext<XContextValue | undefined>(undefined);

function getPrivyXAccount(user: any): { xUserId: string | null; username: string | null } {
  const account = user?.linkedAccounts?.find((acc: any) => acc.type === 'twitter' || acc.type === 'x');
  return {
    xUserId: (account as any)?.subject || (account as any)?.userId || user?.twitter?.subject || user?.twitter?.userId || null,
    username: (account as any)?.username || user?.twitter?.username || null,
  };
}

export const XProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const [state, setState] = useState<Omit<XContextValue, 'refresh'>>({
    xUserId: null,
    username: null,
    profileUrl: null,
    linkedAt: null,
    dmOptInAt: null,
    notificationsMuted: false,
    linkUrl: null,
    loading: false,
  });
  const syncKeyRef = useRef<string | null>(null);

  const resetState = useCallback(() => {
    syncKeyRef.current = null;
    setState({
      xUserId: null,
      username: null,
      profileUrl: null,
      linkedAt: null,
      dmOptInAt: null,
      notificationsMuted: false,
      linkUrl: null,
      loading: false,
    });
  }, []);

  const syncProfile = useCallback(async () => {
    if (!ready || !authenticated || !user) {
      resetState();
      return { xUserId: null, username: null };
    }
    const { xUserId, username } = getPrivyXAccount(user);
    if (!xUserId) {
      resetState();
      return { xUserId: null, username: null };
    }

    setState((prev) => ({
      ...prev,
      xUserId,
      username,
      profileUrl: username ? `https://x.com/${String(username).replace(/^@/, '')}` : null,
    }));

    const syncKey = `${user.id}:${xUserId}:${username || ''}`;
    if (syncKeyRef.current === syncKey) return { xUserId, username };

    const authToken = await getAccessToken().catch(() => null);
    if (!authToken) return { xUserId, username };

    const response = await fetch(`${CORE_API_BASE_URL}/api/users/x/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        xUserId,
        username,
        dmOptIn: true,
      }),
    }).catch(() => null);

    if (response?.ok) {
      syncKeyRef.current = syncKey;
    }

    return { xUserId, username };
  }, [authenticated, getAccessToken, ready, resetState, user]);

  const refresh = useCallback(async () => {
    if (!ready || !authenticated || !user) {
      resetState();
      return;
    }

    const authToken = await getAccessToken().catch(() => null);
    const local = await syncProfile().catch(() => getPrivyXAccount(user));
    if (!local.xUserId || !authToken) {
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`${CORE_API_BASE_URL}/api/users/x/context`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const payload = await response.json() as XContextResponse;
      const next = payload?.data;
      setState({
        xUserId: next?.xUserId ?? local.xUserId,
        username: next?.username ?? local.username,
        profileUrl: next?.profileUrl ?? (local.username ? `https://x.com/${String(local.username).replace(/^@/, '')}` : null),
        linkedAt: next?.linkedAt ?? null,
        dmOptInAt: next?.dmOptInAt ?? null,
        notificationsMuted: next?.notificationsMuted ?? false,
        linkUrl: next?.linkUrl ?? null,
        loading: false,
      });
    } catch {
      setState({
        xUserId: local.xUserId,
        username: local.username,
        profileUrl: local.username ? `https://x.com/${String(local.username).replace(/^@/, '')}` : null,
        linkedAt: null,
        dmOptInAt: null,
        notificationsMuted: false,
        linkUrl: null,
        loading: false,
      });
    }
  }, [authenticated, getAccessToken, ready, resetState, syncProfile, user]);

  useEffect(() => {
    syncProfile().catch(() => undefined);
  }, [syncProfile]);

  const value = useMemo<XContextValue>(() => ({
    ...state,
    refresh,
  }), [refresh, state]);

  return <XContext.Provider value={value}>{children}</XContext.Provider>;
};

export function useXContext(): XContextValue {
  const context = useContext(XContext);
  if (!context) {
    throw new Error('useXContext must be used within an XProvider');
  }
  return context;
}
