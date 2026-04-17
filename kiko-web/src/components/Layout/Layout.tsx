
import React, { useState, createContext, useContext, useCallback } from 'react';
import { PanelLeftOpen, ArrowLeft } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useThemeContext } from '../../contexts/ThemeContext';
import { getUserInfo } from '../../utils/privyUtils';
import styles from './Layout.module.css';
import type { Conversation } from '../../hooks/useConversations';
import { PreLoginWarningModal } from '../Privy/PreLoginWarningModal';
import { useSecureLogin } from '../../hooks/useSecureLogin';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for profile click
import { agentAttrs } from '../../agent/attrs';
import { useAgentMode } from '../../contexts/AgentModeContext';
import { useOnboardingFlow } from '../../hooks/useOnboardingFlow';
import { FarcasterFollowModal } from '../Chat/FarcasterFollowModal';

// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: this layout now decides whether the sidebar may auto-refresh the
//         quota summary. Token and other browse pages should not inherit chat
//         usage refresh traffic just because the sidebar is visible.
// Goal: keep chat quota reads scoped to chat surfaces while still letting the
//       sidebar render on every route.
// Owns: route-scoped sidebar policy and the prop that enables quota refreshes.
// Does Not Own: quota computation, billing persistence, or sidebar rendering logic.
// Design Language:
// - chat quota summaries belong to chat surfaces, not global navigation
// - non-chat routes must not auto-trigger authenticated usage-summary reads
// - explicit refresh actions may still be user-owned
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-token-page-stray-read-rate-limit.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: route-scoped gating of sidebar usage-summary refreshes
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-token-page-read-burst-isolation.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

interface SidebarContextType {
    onOpenSidebar: () => void;
    isSidebarOpen: boolean;
    onOpenProfile: () => void;
    setChatStarted: (started: boolean) => void;
    chatStarted: boolean;
    refreshUsageSummary: () => void;
    onBackHandler: (() => void) | null;
    setOnBackHandler: (handler: (() => void) | null) => void;
}

export const SidebarContext = createContext<SidebarContextType | null>(null);

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    return context;
};

interface LayoutProps {
    children: React.ReactNode;
    // activeTab and onTabChange removed - internal location used
    conversations?: Conversation[];
    activeConversationId?: string | null;
    // onConversationClick removed - handled by Sidebar NavLink
    onNewChat?: () => void;
    onConversationRename?: (id: string, newTitle: string) => void;
    onConversationDelete?: (id: string) => void;
    generatingConversationId?: string | null;
    onBack?: () => void; // Generic back button handler (for TokenDetailPage, etc.)
}

export const Layout: React.FC<LayoutProps> = ({
    children,
    conversations,
    activeConversationId,
    onNewChat,
    onConversationRename,
    onConversationDelete,
    generatingConversationId,
    onBack,
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile
    const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); // Desktop - default open
    const [chatStarted, setChatStarted] = useState(false); // Track if chat has started
    const [onBackHandler, setOnBackHandler] = useState<(() => void) | null>(null); // Generic back handler from child
    const { resolvedTheme } = useThemeContext();
    const { agentModeEnabled, agentModeSource } = useAgentMode();
    const { user, authenticated, ready } = usePrivy();
    const { secureLogin, isWarningOpen, closeWarning, confirmLogin } = useSecureLogin();
    const { currentStep, dismissCurrentStep } = useOnboardingFlow();

    // Router hooks
    const location = useLocation();
    const navigate = useNavigate();

    const isChatActive = location.pathname === '/' || location.pathname.startsWith('/chat/');
    const usageSummaryEnabled = isChatActive;
    const handleBackToWelcome = useCallback(() => {
        setChatStarted(false);
        setOnBackHandler(null);
        onNewChat?.();
    }, [onNewChat]);

    const mobileBackAction = isChatActive && onNewChat
        ? handleBackToWelcome
        : (onBack || onBackHandler || onNewChat);
    // We assume explicit activeTab prop is no longer needed for internal logic beyond this check

    // Handle profile click - check authentication status
    const handleProfileClick = useCallback(() => {
        if (!ready) return; // Wait for Privy to be ready

        try {
            if (!authenticated) {
                // User is not logged in, show login modal
                secureLogin();
            } else {
                // Embedded wallets are created on login; just open wallet page
                navigate('/wallet');
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Error in handleProfileClick:', error);
            }
        }
    }, [ready, authenticated, secureLogin, navigate]);

    // Get user info and avatar
    const { name: userName, initials: userInitials, avatarUrl } = getUserInfo(user);

    // Memoize the context value to prevent unnecessary re-renders in consumers
    const sidebarContextValue = React.useMemo(() => ({
        onOpenSidebar: () => setIsDesktopSidebarOpen(true),
        isSidebarOpen: isDesktopSidebarOpen,
        onOpenProfile: handleProfileClick,
        setChatStarted,
        chatStarted,
        refreshUsageSummary: () => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('kiko-usage-refresh'));
            }
        },
        onBackHandler,
        setOnBackHandler,
    }), [isDesktopSidebarOpen, handleProfileClick, chatStarted, onBackHandler]);

    return (
        <SidebarContext.Provider value={sidebarContextValue}>
            <PreLoginWarningModal
                isOpen={isWarningOpen}
                onConfirm={confirmLogin}
                onCancel={closeWarning}
            />
            {currentStep === 'farcaster' && location.pathname === '/' && (
                <FarcasterFollowModal onDismiss={(neverShowAgain) => dismissCurrentStep('farcaster', neverShowAgain)} />
            )}
            <div className={`${styles.layout} ${styles[resolvedTheme]}`}>
                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    isDesktopOpen={isDesktopSidebarOpen}
                    onDesktopClose={() => setIsDesktopSidebarOpen(false)}
                    onProfileClick={handleProfileClick}
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onNewChat={onNewChat}
                    onConversationRename={onConversationRename}
                    onConversationDelete={onConversationDelete}
                    generatingConversationId={generatingConversationId}
                    usageSummaryEnabled={usageSummaryEnabled}
                />

                <main className={styles.main}>
                    {/* Mobile Floating Buttons (no header container) */}
                    <div className={styles.mobileFloatingLeft}>
                        {(onBack || onBackHandler) || (isChatActive && (activeConversationId || chatStarted) && onNewChat) ? (
                            <button
                                className={styles.mobileBackBtn}
                                {...agentAttrs({ id: 'layout.mobile.back', role: 'button', action: 'navigate', page: 'layout' })}
                                onClick={mobileBackAction}
                                title="Go back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        ) : (
                            <button
                                className={styles.mobileMenuBtn}
                                {...agentAttrs({ id: 'layout.mobile.menu', role: 'button', action: 'open', page: 'layout' })}
                                onClick={() => setIsSidebarOpen(true)}
                                title="Open menu"
                            >
                                <PanelLeftOpen size={20} />
                            </button>
                        )}
                    </div>

                    {location.pathname !== '/wallet' && location.pathname !== '/settings' && location.pathname !== '/wallet/settings' && (
                        <div className={styles.mobileFloatingRight}>
                            <button
                                className={styles.mobileProfileBtn}
                                {...agentAttrs({ id: 'layout.mobile.profile', role: 'button', action: 'navigate', page: 'layout' })}
                                onClick={handleProfileClick}
                                title={userName}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={userName} className={styles.profileAvatarImg} />
                                ) : (
                                    <span className={styles.profileInitials}>{userInitials}</span>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Desktop Header - Sidebar trigger + Back button */}
                    <div className={`${styles.desktopHeader} ${!isDesktopSidebarOpen ? styles.desktopHeaderCollapsed : ''}`}>
                        {!isDesktopSidebarOpen && (
                            <button
                                className={styles.desktopTrigger}
                                {...agentAttrs({ id: 'layout.desktop.sidebar_open', role: 'button', action: 'open', page: 'layout' })}
                                onClick={() => setIsDesktopSidebarOpen(true)}
                                title="Open sidebar"
                            >
                                <PanelLeftOpen size={20} />
                            </button>
                        )}
                        {/* Desktop Back Button - show when there's an active back handler OR chat is active with a started conversation */}
                        {((onBack || onBackHandler) || (isChatActive && (activeConversationId || chatStarted) && onNewChat)) && (
                            <button
                                className={styles.desktopBackBtn}
                                {...agentAttrs({ id: 'layout.desktop.back', role: 'button', action: 'navigate', page: 'layout' })}
                                onClick={mobileBackAction}
                                title="Go back"
                            >
                                <ArrowLeft size={20} strokeWidth={2} />
                            </button>
                        )}
                    </div>

                    {/* Desktop Top Right Profile */}
                    {location.pathname !== '/wallet' && location.pathname !== '/settings' && location.pathname !== '/wallet/settings' && (
                        <div className={styles.desktopProfileContainer}>
                            <button
                                className={styles.desktopProfileBtn}
                                {...agentAttrs({ id: 'layout.desktop.profile', role: 'button', action: 'navigate', page: 'layout' })}
                                onClick={handleProfileClick}
                                title={authenticated ? "Wallet Profile" : "Login"}
                            >
                                <span className={styles.desktopProfileAvatar}>
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={userName} className={styles.desktopProfileAvatarImg} />
                                    ) : (
                                        userInitials
                                    )}
                                </span>
                            </button>
                        </div>
                    )}

                    {agentModeEnabled && (
                        <div
                            className={styles.agentModeBadge}
                            {...agentAttrs({ id: 'layout.agent_mode.badge', role: 'card', page: 'layout' })}
                            title={`For Agent mode is enabled (${agentModeSource})`}
                        >
                            AGENT MODE ON
                        </div>
                    )}

                    <div className={styles.content} data-scroll-container="app">
                        {children}
                    </div>
                </main>


            </div>
        </SidebarContext.Provider>
    );
};
