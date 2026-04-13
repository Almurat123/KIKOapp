import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { resolveCoreApiBase } from '../utils/coreApiBase';
import { useMiniAppContext } from './MiniAppContext';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Rowan
// Reason: Farcaster identity now needs to work in two launch modes: Privy
//         logged-in users and Mini App sessions that only expose client context.
// Goal: preserve one social identity surface that can fall back to the Mini App
//       user context when Privy has not established a session yet, while also
//       exposing when identity resolution is complete so onboarding does not
//       act on a transient null FID.
// Owns: Farcaster identity lookup, profile sync, follow-status hydration, and
//       the client-side readiness boundary for Farcaster-dependent onboarding.
// Does Not Own: Privy session issuance, Mini App host detection, or wallet
//               transaction authorization.
// Design Language:
// - Prefer Privy-backed identity when it exists.
// - Fall back to Mini App context for read-only identity in Farcaster clients.
// - Keep backend sync gated behind an actual access token.
// - Expose a resolved identity state so consumers do not treat "not loaded yet"
//   as "no Farcaster account".
// Document Provenance:
// - Source: Farcaster Mini Apps context guide
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: use `sdk.context.user` as a read-only identity fallback
// - Verification: verified in docs
// - Source: Installed `@farcaster/miniapp-sdk` package source
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: confirm Mini App context is a promise and can be consumed by a provider
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/farcaster-miniapp-shell.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-miniapp-support.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-miniapp-support.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-farcaster-follow-gate-and-unique-fid.md

type FollowStatus = 'following' | 'not_following' | 'unknown';

interface FarcasterContextValue {
    fid: number | null;
    username: string | null;
    profileUrl: string | null;
    followsKiko: boolean | null;
    followStatus: FollowStatus;
    checkedAt: string | null;
    loading: boolean;
    resolved: boolean;
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

function getMiniAppFarcasterAccount(context: ReturnType<typeof useMiniAppContext>['context']): { fid: number | null; username: string | null } {
    return {
        fid: context?.user?.fid ?? null,
        username: context?.user?.username ?? null,
    };
}

export const FarcasterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authenticated, ready, getAccessToken } = usePrivy();
    const miniAppContext = useMiniAppContext();
    const [state, setState] = useState<Omit<FarcasterContextValue, 'refresh'>>({
        fid: null,
        username: null,
        profileUrl: null,
        followsKiko: null,
        followStatus: 'unknown',
        checkedAt: null,
        loading: false,
        resolved: false,
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
            resolved: false,
        });
    }, []);

    const resolveReadOnlyMiniAppState = useCallback((): { fid: number | null; username: string | null } => {
        const miniAppAccount = getMiniAppFarcasterAccount(miniAppContext.context);
        if (!miniAppAccount.fid) {
            setState((prev) => ({
                ...prev,
                fid: null,
                username: null,
                profileUrl: null,
                followsKiko: null,
                followStatus: 'unknown',
                checkedAt: null,
                loading: false,
                resolved: true,
            }));
            return { fid: null, username: null };
        }

        setState((prev) => ({
            ...prev,
            fid: miniAppAccount.fid,
            username: miniAppAccount.username,
            profileUrl: miniAppAccount.username ? `https://warpcast.com/${String(miniAppAccount.username).replace(/^@/, '')}` : null,
            followsKiko: null,
            followStatus: 'unknown',
            checkedAt: null,
            loading: false,
            resolved: true,
        }));

        return miniAppAccount;
    }, [miniAppContext.context]);

    const syncProfile = useCallback(async (): Promise<{ fid: number | null; username: string | null }> => {
        if (!ready) {
            resetState();
            return { fid: null, username: null };
        }

        if (!authenticated || !user) {
            return resolveReadOnlyMiniAppState();
        }

        const { fid, username } = getPrivyFarcasterAccount(user);
        if (!fid) {
            return resolveReadOnlyMiniAppState();
        }

        setState((prev) => ({
            ...prev,
            fid,
            username,
            profileUrl: username ? `https://warpcast.com/${String(username).replace(/^@/, '')}` : null,
            resolved: true,
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
            resolveReadOnlyMiniAppState();
            return;
        }

        const privyAccount = await syncProfile().catch(() => getPrivyFarcasterAccount(user));
        if (!privyAccount.fid) {
            resolveReadOnlyMiniAppState();
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
                resolved: true,
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
                resolved: true,
            });
        }
    }, [authenticated, getAccessToken, ready, resolveReadOnlyMiniAppState, resetState, syncProfile, user]);

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
