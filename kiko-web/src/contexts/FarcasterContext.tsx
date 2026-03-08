import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { resolveCoreApiBase } from '../utils/coreApiBase';

type FollowStatus = 'following' | 'not_following' | 'unknown';

interface FarcasterContextValue {
    fid: number | null;
    username: string | null;
    profileUrl: string | null;
    followsKiko: boolean | null;
    followStatus: FollowStatus;
    checkedAt: string | null;
    loading: boolean;
    refresh: (options?: { force?: boolean }) => Promise<void>;
}

interface FarcasterResponse {
    success: boolean;
    data?: {
        fid: number | null;
        username: string | null;
        profileUrl: string | null;
        followsKiko: boolean | null;
        followStatus: FollowStatus;
        checkedAt: string | null;
        kikoHandle?: string | null;
    };
}

const CORE_API_BASE_URL = resolveCoreApiBase();

const FarcasterContext = createContext<FarcasterContextValue | undefined>(undefined);

function getPrivyFarcasterAccount(user: any): { fid: number | null; username: string | null } {
    const farcasterAccount = user?.linkedAccounts?.find(
        (acc: any) => acc.type === 'farcaster' || (acc.type === 'wallet' && acc.chainType === 'farcaster')
    );
    return {
        fid: (farcasterAccount as any)?.fid || user?.farcaster?.fid || null,
        username: (farcasterAccount as any)?.username || user?.farcaster?.username || null,
    };
}

export const FarcasterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authenticated, ready, getAccessToken } = usePrivy();
    const [state, setState] = useState<Omit<FarcasterContextValue, 'refresh'>>({
        fid: null,
        username: null,
        profileUrl: null,
        followsKiko: null,
        followStatus: 'unknown',
        checkedAt: null,
        loading: false,
    });
    const syncKeyRef = useRef<string | null>(null);
    const resetState = useCallback(() => {
        syncKeyRef.current = null;
        setState({
            fid: null,
            username: null,
            profileUrl: null,
            followsKiko: null,
            followStatus: 'unknown',
            checkedAt: null,
            loading: false,
        });
    }, []);

    const syncProfile = useCallback(async (): Promise<{ fid: number | null; username: string | null }> => {
        if (!ready || !authenticated || !user) {
            resetState();
            return { fid: null, username: null };
        }
        const { fid, username } = getPrivyFarcasterAccount(user);
        if (!fid) {
            resetState();
            return { fid: null, username: null };
        }

        setState((prev) => ({
            ...prev,
            fid,
            username,
            profileUrl: username ? `https://warpcast.com/${String(username).replace(/^@/, '')}` : null,
        }));

        const syncKey = `${user.id}:${fid}:${username || ''}`;
        if (syncKeyRef.current === syncKey) return { fid, username };

        const authToken = await getAccessToken().catch(() => null);
        if (!authToken) return { fid, username };

        const response = await fetch(`${CORE_API_BASE_URL}/api/users/farcaster`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ fid, username }),
        }).catch(() => null);

        if (response?.ok) {
            syncKeyRef.current = syncKey;
        }
        return { fid, username };
    }, [authenticated, getAccessToken, ready, resetState, user]);

    const refresh = useCallback(async (options?: { force?: boolean }) => {
        if (!ready) return;
        if (!authenticated || !user) {
            resetState();
            return;
        }

        const privyAccount = await syncProfile().catch(() => getPrivyFarcasterAccount(user));
        if (!privyAccount.fid) {
            setState((prev) => ({
                ...prev,
                fid: null,
                username: null,
                profileUrl: null,
                followsKiko: null,
                followStatus: 'unknown',
                checkedAt: null,
                loading: false,
            }));
            return;
        }

        const authToken = await getAccessToken().catch(() => null);
        if (!authToken) return;

        setState((prev) => ({ ...prev, loading: true }));
        const url = new URL(`${CORE_API_BASE_URL}/api/users/farcaster/context`);
        if (options?.force) {
            url.searchParams.set('refresh', '1');
        }

        try {
            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });
            const payload = await response.json() as FarcasterResponse;
            const next = payload?.data;

            setState({
                fid: next?.fid ?? privyAccount.fid,
                username: next?.username ?? privyAccount.username,
                profileUrl: next?.profileUrl ?? (privyAccount.username ? `https://warpcast.com/${String(privyAccount.username).replace(/^@/, '')}` : null),
                followsKiko: next?.followsKiko ?? null,
                followStatus: next?.followStatus ?? 'unknown',
                checkedAt: next?.checkedAt ?? null,
                loading: false,
            });
        } catch {
            setState({
                fid: privyAccount.fid,
                username: privyAccount.username,
                profileUrl: privyAccount.username ? `https://warpcast.com/${String(privyAccount.username).replace(/^@/, '')}` : null,
                followsKiko: null,
                followStatus: 'unknown',
                checkedAt: null,
                loading: false,
            });
        }
    }, [authenticated, getAccessToken, ready, resetState, syncProfile, user]);

    useEffect(() => {
        syncProfile().catch(() => undefined);
    }, [syncProfile]);

    const value = useMemo<FarcasterContextValue>(() => ({
        ...state,
        refresh,
    }), [refresh, state]);

    return (
        <FarcasterContext.Provider value={value}>
            {children}
        </FarcasterContext.Provider>
    );
};

export function useFarcasterContext(): FarcasterContextValue {
    const context = useContext(FarcasterContext);
    if (!context) {
        throw new Error('useFarcasterContext must be used within a FarcasterProvider');
    }
    return context;
}
