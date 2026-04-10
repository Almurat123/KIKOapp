import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

type MiniAppSdkContext = Awaited<typeof sdk.context>;

export type MiniAppSafeAreaInsets = {
    top: number;
    bottom: number;
    left: number;
    right: number;
};

export interface MiniAppContextValue {
    isMiniApp: boolean;
    isReady: boolean;
    loading: boolean;
    context: MiniAppSdkContext | null;
    safeAreaInsets: MiniAppSafeAreaInsets;
}

const DEFAULT_SAFE_AREA: MiniAppSafeAreaInsets = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
};

const MiniAppContext = createContext<MiniAppContextValue | undefined>(undefined);

function normalizeSafeAreaInsets(insets?: Partial<MiniAppSafeAreaInsets> | null): MiniAppSafeAreaInsets {
    return {
        top: insets?.top ?? 0,
        bottom: insets?.bottom ?? 0,
        left: insets?.left ?? 0,
        right: insets?.right ?? 0,
    };
}

function applySafeAreaInsets(insets: MiniAppSafeAreaInsets): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--kiko-safe-top', `${insets.top}px`);
    root.style.setProperty('--kiko-safe-bottom', `${insets.bottom}px`);
    root.style.setProperty('--kiko-safe-left', `${insets.left}px`);
    root.style.setProperty('--kiko-safe-right', `${insets.right}px`);
    root.dataset.miniapp = 'true';
}

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Rowan
// Reason: Farcaster Mini App launches need a dedicated bootstrap layer so the
//         client can detect the host, apply safe-area overrides, and mark the
//         app as ready without leaking that logic into page components.
// Goal: preserve a single, predictable Mini App bootstrap path that works in
//       both normal browsers and Farcaster clients.
// Owns: Mini App environment detection, safe-area variable application, and the
//       one-time `sdk.actions.ready()` handshake.
// Does Not Own: Privy authentication, wallet ownership, share-card metadata, or
//               route-specific UI decisions.
// Design Language:
// - Keep Mini App host detection isolated from page rendering logic.
// - Apply safe-area values at the document root so existing layout CSS can
//   consume them without per-page conditionals.
// - Do not move auth or backend sync concerns into this bootstrap layer.
// Document Provenance:
// - Source: Farcaster Mini Apps loading guide
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: call `sdk.actions.ready()` after the app shell mounts
// - Verification: verified in docs
// - Source: Farcaster Mini Apps context guide
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: read `sdk.context` and use `client.safeAreaInsets`
// - Verification: verified in docs
// - Source: Installed `@farcaster/miniapp-sdk` package source
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: confirm `sdk.isInMiniApp()` and `sdk.context` promise shape
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/farcaster-miniapp-shell.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-miniapp-support.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-miniapp-support.md

export const MiniAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isMiniApp, setIsMiniApp] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [context, setContext] = useState<MiniAppContextValue['context']>(null);
    const readyRequestedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            try {
                const inMiniApp = await sdk.isInMiniApp();
                if (cancelled) return;

                if (!inMiniApp) {
                    setIsMiniApp(false);
                    setIsReady(false);
                    setLoading(false);
                    return;
                }

                setIsMiniApp(true);

                const miniAppContext = await sdk.context.catch(() => null);
                if (cancelled) return;

                const nextContext = miniAppContext ?? null;
                setContext(nextContext);
                applySafeAreaInsets(normalizeSafeAreaInsets(nextContext?.client?.safeAreaInsets));

                if (!readyRequestedRef.current) {
                    readyRequestedRef.current = true;
                    await sdk.actions.ready();
                }

                if (!cancelled) {
                    setIsReady(true);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setIsMiniApp(false);
                    setIsReady(false);
                    setContext(null);
                    setLoading(false);
                }
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, []);

    const value = useMemo<MiniAppContextValue>(() => ({
        isMiniApp,
        isReady,
        loading,
        context,
        safeAreaInsets: normalizeSafeAreaInsets(context?.client?.safeAreaInsets ?? DEFAULT_SAFE_AREA),
    }), [context, isMiniApp, isReady, loading]);

    return (
        <MiniAppContext.Provider value={value}>
            {children}
        </MiniAppContext.Provider>
    );
};

export function useMiniAppContext(): MiniAppContextValue {
    const contextValue = useContext(MiniAppContext);
    if (!contextValue) {
        throw new Error('useMiniAppContext must be used within a MiniAppProvider');
    }
    return contextValue;
}
