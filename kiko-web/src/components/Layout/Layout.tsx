import React, { useState, createContext, useContext, useCallback } from 'react';
import { PanelLeftOpen, ArrowLeft } from 'lucide-react';
import { usePrivy, useWallets, useLinkAccount } from '@privy-io/react-auth';
import { Sidebar } from './Sidebar';
import { useThemeContext } from '../../contexts/ThemeContext';

import { clearWalletData } from '../../utils/privyUtils';
import styles from './Layout.module.css';
import type { Conversation } from '../../hooks/useConversations';
import { PreLoginWarningModal } from '../Privy/PreLoginWarningModal';
import { useSecureLogin } from '../../hooks/useSecureLogin';

interface SidebarContextType {
    onOpenSidebar: () => void;
    isSidebarOpen: boolean;
    onOpenProfile: () => void;
    setChatStarted: (started: boolean) => void;
    chatStarted: boolean;
    setGeneratingConversationId: (id: string | null) => void;
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
    activeTab: string;
    onTabChange: (tab: string) => void;
    conversations?: Conversation[];
    activeConversationId?: string | null;
    onConversationClick?: (id: string) => void;
    onNewChat?: () => void;
    onConversationRename?: (id: string, newTitle: string) => void;
    onConversationDelete?: (id: string) => void;
    generatingConversationId?: string | null;
    setGeneratingConversationId?: (id: string | null) => void;
    onBack?: () => void; // Generic back button handler (for TokenDetailPage, etc.)
}

export const Layout: React.FC<LayoutProps> = ({
    children,
    activeTab,
    onTabChange,
    conversations,
    activeConversationId,
    onConversationClick,
    onNewChat,
    onConversationRename,
    onConversationDelete,
    generatingConversationId,
    setGeneratingConversationId,
    onBack,
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile
    const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); // Desktop - default open
    const [chatStarted, setChatStarted] = useState(false); // Track if chat has started
    const [onBackHandler, setOnBackHandler] = useState<(() => void) | null>(null); // Generic back handler from child
    const { resolvedTheme } = useThemeContext();
    const { user, authenticated, ready } = usePrivy();
    const { secureLogin, isWarningOpen, closeWarning, confirmLogin } = useSecureLogin();
    const { wallets } = useWallets();
    const { linkWallet } = useLinkAccount();

    // Handle profile click - check authentication and wallet connection status
    const handleProfileClick = useCallback(() => {
        if (!ready) return; // Wait for Privy to be ready

        try {
            if (!authenticated) {
                // User is not logged in, show login modal
                secureLogin();
            } else {
                // User is logged in, check if they have a wallet connected
                const hasWallet = wallets.length > 0 && wallets.some(wallet => wallet?.address);

                if (hasWallet) {
                    // User has wallet connected, navigate to wallet page
                    onTabChange('wallet');
                } else {
                    // User is logged in but no wallet connected
                    // Clear any stale wallet data first to ensure clean state
                    clearWalletData();
                    // Trigger wallet connection
                    if (linkWallet) {
                        // Small delay to ensure data is cleared
                        setTimeout(() => {
                            linkWallet();
                        }, 100);
                    }
                }
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Error in handleProfileClick:', error);
            }
        }
    }, [ready, authenticated, secureLogin, wallets, onTabChange, linkWallet]);

    // Get user initials for avatar
    const emailAddress = user?.email && typeof user.email === 'object' && 'address' in user.email
        ? (user.email as { address: string }).address
        : (typeof user?.email === 'string' ? user.email : null);
    const userName = (emailAddress ? emailAddress.split('@')[0] : null) || user?.farcaster?.username || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    // Memoize the context value to prevent unnecessary re-renders in consumers
    const sidebarContextValue = React.useMemo(() => ({
        onOpenSidebar: () => setIsDesktopSidebarOpen(true),
        isSidebarOpen: isDesktopSidebarOpen,
        onOpenProfile: handleProfileClick,
        setChatStarted,
        chatStarted,
        setGeneratingConversationId: setGeneratingConversationId || (() => { }),
        onBackHandler,
        setOnBackHandler,
    }), [isDesktopSidebarOpen, handleProfileClick, chatStarted, setGeneratingConversationId, onBackHandler]);

    return (
        <SidebarContext.Provider value={sidebarContextValue}>
            <PreLoginWarningModal
                isOpen={isWarningOpen}
                onConfirm={confirmLogin}
                onCancel={closeWarning}
            />
            <div className={`${styles.layout} ${styles[resolvedTheme]}`}>
                <Sidebar
                    activeTab={activeTab}
                    onTabChange={onTabChange}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                    isDesktopOpen={isDesktopSidebarOpen}
                    onDesktopClose={() => setIsDesktopSidebarOpen(false)}
                    onProfileClick={handleProfileClick}
                    conversations={conversations}
                    activeConversationId={activeConversationId}
                    onConversationClick={onConversationClick}
                    onNewChat={onNewChat}
                    onConversationRename={onConversationRename}
                    onConversationDelete={onConversationDelete}
                    generatingConversationId={generatingConversationId}
                />

                <main className={styles.main}>
                    {/* Mobile Floating Buttons (no header container) */}
                    <div className={styles.mobileFloatingLeft}>
                        {(onBack || onBackHandler) || (activeTab === 'chat' && (activeConversationId || chatStarted) && onNewChat) ? (
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

                    <div className={styles.mobileFloatingRight}>
                        <button
                            className={styles.mobileProfileBtn}
                            onClick={handleProfileClick}
                            title={userName}
                        >
                            <span className={styles.profileInitials}>{userInitials}</span>
                        </button>
                    </div>

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
                        {activeTab === 'chat' && (activeConversationId || chatStarted) && onNewChat && (
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
                    <div className={styles.desktopProfileContainer}>
                        <button
                            className={styles.desktopProfileBtn}
                            onClick={handleProfileClick}
                            title={authenticated ? "Wallet Profile" : "Connect Wallet"}
                        >
                            <span className={styles.desktopProfileAvatar}>
                                {userInitials}
                            </span>
                        </button>
                    </div>

                    <div className={styles.content}>
                        {children}
                    </div>
                </main>


            </div>
        </SidebarContext.Provider>
    );
};

