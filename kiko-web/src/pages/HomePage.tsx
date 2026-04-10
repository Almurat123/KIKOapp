import React, { Suspense, useEffect, useState } from 'react';
import { useSidebar } from '../components/Layout/Layout';
import { WelcomeScreen } from '../components/Chat/WelcomeScreen';

const LazyChatInterface = React.lazy(() => import('../components/Chat/ChatInterface').then((m) => ({ default: m.ChatInterface })));

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Rowan
// Reason: The production homepage was booting the full chat runtime before the
//         user had even started a conversation, which delayed first paint and
//         triggered mobile route-timeout failures.
// Goal: keep "/" limited to a lightweight welcome shell and hand off the first
//       committed prompt to the chat runtime only after explicit user intent.
// Owns: default-route welcome-shell rendering and first-prompt handoff into the
//       lazily booted chat runtime.
// Does Not Own: conversation persistence, streaming chat runtime, or welcome UI
//       presentation details.
// Design Language:
// - the home shell must be usable before the full chat runtime loads
// - the first committed prompt must survive the shell-to-runtime handoff
// - forbidden local patch patterns: importing ChatInterface directly into the home route
// Document Provenance:
// - Source: Mobile homepage timeout screenshot and console trace
// - Kind: runtime observation
// - Retrieved: 2026-04-10
// - Applied To: defer full chat runtime until the first prompt is committed
// - Verification: verified in runtime
// - Source: Vite production build output
// - Kind: build evidence
// - Retrieved: 2026-04-10
// - Applied To: confirm the eager home-chat route still left the main bundle too large
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-homepage-welcome-shell-split.md

const HomeBootFallback: React.FC = () => {
    return (
        <div
            style={{
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '24px 20px 32px',
            }}
        >
            <div
                style={{
                    alignSelf: 'center',
                    borderRadius: '999px',
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                }}
            >
                Preparing chat...
            </div>
        </div>
    );
};

export const HomePage: React.FC = () => {
    const sidebar = useSidebar();
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const [shouldBootChat, setShouldBootChat] = useState(false);

    useEffect(() => {
        if (!shouldBootChat) {
            sidebar?.setChatStarted(false);
        }
    }, [sidebar, shouldBootChat]);

    const handleStartChat = (text: string) => {
        const normalized = text.trim();
        if (!normalized) return;
        setPendingPrompt(normalized);
        setShouldBootChat(true);
    };

    if (!shouldBootChat) {
        return <WelcomeScreen onSuggestionClick={handleStartChat} />;
    }

    return (
        <Suspense fallback={<HomeBootFallback />}>
            <LazyChatInterface
                pendingAIPrompt={pendingPrompt}
                onAIPromptSet={() => setPendingPrompt(null)}
                autoSubmitPendingPrompt={true}
            />
        </Suspense>
    );
};
