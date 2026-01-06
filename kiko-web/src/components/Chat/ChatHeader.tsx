import React from 'react';
import { Menu, Plus, User } from 'lucide-react';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
    hasStarted?: boolean;
    onOpenSidebar?: () => void;
    onProfileClick?: () => void;
    conversationTitle?: string;
    onNewChat?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    hasStarted,
    onOpenSidebar,
    onProfileClick,
    conversationTitle,
    onNewChat
}) => {
    // Only show header when chat has started
    if (!hasStarted) return null;

    return (
        <div className={styles.header}>
            <button onClick={onOpenSidebar}><Menu size={20} /></button>
            <span>{conversationTitle || 'Chat'}</span>
            <div className={styles.headerRight}>
                <button onClick={onNewChat}><Plus size={20} /></button>
                {onProfileClick && (
                    <button onClick={onProfileClick}><User size={20} /></button>
                )}
            </div>
        </div>
    );
};
