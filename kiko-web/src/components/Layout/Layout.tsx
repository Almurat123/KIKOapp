import React, { useState } from 'react';
import { Menu, PanelLeftOpen } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { UserProfileModal } from '../User/UserProfileModal';
import styles from './Layout.module.css';
import type { Conversation } from '../../hooks/useConversations';

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
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile
    const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false); // Desktop
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    return (
        <div className={styles.layout}>
            <Sidebar
                activeTab={activeTab}
                onTabChange={onTabChange}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                isDesktopOpen={isDesktopSidebarOpen}
                onDesktopClose={() => setIsDesktopSidebarOpen(false)}
                onProfileClick={() => setIsProfileModalOpen(true)}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onConversationClick={onConversationClick}
                onNewChat={onNewChat}
                onConversationRename={onConversationRename}
                onConversationDelete={onConversationDelete}
            />

            <UserProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />

            <main className={styles.main}>
                {/* Mobile Header */}
                <div className={styles.mobileHeader}>
                    <button
                        className={styles.hamburger}
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu size={24} />
                    </button>
                    <span className={styles.mobileTitle}>KIKO</span>
                </div>

                {/* Desktop Trigger Button */}
                {!isDesktopSidebarOpen && (
                    <button
                        className={styles.desktopTrigger}
                        onClick={() => setIsDesktopSidebarOpen(true)}
                        title="Open sidebar"
                    >
                        <PanelLeftOpen size={20} />
                    </button>
                )}

                <div className={styles.content}>
                    {children}
                </div>
            </main>
        </div>
    );
};
