
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

const SidebarContext = createContext<SidebarContextType | null>(null);

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
    const { user, authenticated, ready } = usePrivy();
    const { secureLogin, isWarningOpen, closeWarning, confirmLogin } = useSecureLogin();

    // Router hooks
    const location = useLocation();
    const navigate = useNavigate();

    const isChatActive = location.pathname === '/' || location.pathname.startsWith('/chat');
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
                />

                <main className={styles.main}>
                    {/* Mobile Floating Buttons (no header container) */}
                    <div className={styles.mobileFloatingLeft}>
                        {(onBack || onBackHandler) || (isChatActive && (activeConversationId || chatStarted) && onNewChat) ? (
                            <button
                                className={styles.mobileBackBtn}
                                onClick={onBack || onBackHandler || onNewChat}
                                title="Go back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        ) : (
                            <button
                                className={styles.mobileMenuBtn}
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
                                onClick={() => setIsDesktopSidebarOpen(true)}
                                title="Open sidebar"
                            >
                                <PanelLeftOpen size={20} />
                            </button>
                        )}
                        {/* Desktop Back Button - show when there's an active conversation OR chat has started */}
                        {isChatActive && (activeConversationId || chatStarted) && onNewChat && (
                            <button
                                className={styles.desktopBackBtn}
                                onClick={onNewChat}
                                title="Back to welcome"
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

                    <div className={styles.content} data-scroll-container="app">
                        {children}
                    </div>
                </main>


            </div>
        </SidebarContext.Provider>
    );
};
