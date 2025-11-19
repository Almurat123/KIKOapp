
import React, { useState } from 'react';
import { MessageSquare, Newspaper, BarChart2, Layers, Plus, X, PanelLeftClose, ChevronDown, ChevronRight, FlaskConical, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import styles from './Sidebar.module.css';
import type { Conversation } from '../../hooks/useConversations';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isDesktopOpen: boolean;
  onDesktopClose: () => void;
  onProfileClick: () => void;
  conversations?: Conversation[];
  activeConversationId?: string | null;
  onConversationClick?: (id: string) => void;
  onNewChat?: () => void;
  onConversationRename?: (id: string, newTitle: string) => void;
  onConversationDelete?: (id: string) => void;
}

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  subItems?: { id: string; label: string }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onClose,
  isDesktopOpen,
  onDesktopClose,
  onProfileClick,
  conversations = [],
  activeConversationId,
  onConversationClick,
  onNewChat,
  onConversationRename,
  onConversationDelete,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['chat', 'market']));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Dynamic chat item with real conversations
  const chatItem: NavItem = {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat',
    subItems: conversations.map(conv => ({
      id: conv.id,
      label: conv.title,
    })),
  };

  const navItems: NavItem[] = [
    chatItem,
    {
      id: 'news',
      icon: Newspaper,
      label: 'News',
      subItems: [
        { id: 'news-latest', label: 'Latest' },
        { id: 'news-macro', label: 'Macro' },
        { id: 'news-onchain', label: 'On-chain' },
      ]
    },
    {
      id: 'market',
      icon: BarChart2,
      label: 'MarketData',
      subItems: [
        { id: 'market-overview', label: 'Overview' },
        { id: 'market-chains', label: 'Chains' },
        { id: 'market-tokens', label: 'Tokens' },
        { id: 'market-activity', label: 'Activity' },
        { id: 'market-risk', label: 'Risk' },
      ]
    },
    {
      id: 'defi',
      icon: Layers,
      label: 'SuperDefi',
      subItems: [
        { id: 'defi-uniswap', label: 'Uniswap' },
        { id: 'defi-aave', label: 'Aave' },
      ]
    },
    {
      id: 'test',
      icon: FlaskConical,
      label: 'Test Cards',
    },
  ];

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={clsx(styles.overlay, isOpen && styles.overlayVisible)}
        onClick={onClose}
      />

      <aside className={clsx(
        styles.sidebar,
        isOpen && styles.sidebarOpen,
        !isDesktopOpen && styles.sidebarHidden
      )}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon} />
            <span className={styles.logoText}>KIKO</span>
          </div>

          {/* Mobile Close */}
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>

          {/* Desktop Collapse */}
          <button className={styles.collapseBtn} onClick={onDesktopClose} title="Close sidebar">
            <PanelLeftClose size={20} />
          </button>
        </div>

        <div className={styles.actionArea}>
          <button 
            className={styles.newChatBtn} 
            onClick={() => {
              if (onNewChat) onNewChat();
              onTabChange('chat');
            }}
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <div key={item.id} className={styles.navGroup}>
              <button
                className={clsx(styles.navItem, activeTab.startsWith(item.id) && styles.active)}
                onClick={() => {
                  onTabChange(item.id);
                  toggleExpand(item.id);
                }}
              >
                <item.icon size={18} />
                <span className={styles.navLabel}>{item.label}</span>
                {item.subItems && (
                  <span className={styles.chevron}>
                    {expandedItems.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                )}
              </button>

              {/* Sub Items */}
              {item.subItems && expandedItems.has(item.id) && (
                <div className={styles.subItems}>
                  {item.subItems.map((sub) => {
                    const isChatItem = item.id === 'chat';
                    const isEditing = editingId === sub.id;
                    const isHovered = hoveredId === sub.id;
                    
                    return (
                      <div
                        key={sub.id}
                        className={clsx(
                          styles.subItemWrapper,
                          isChatItem && sub.id === activeConversationId && styles.active
                        )}
                        onMouseEnter={() => isChatItem && setHoveredId(sub.id)}
                        onMouseLeave={() => isChatItem && setHoveredId(null)}
                      >
                        {isEditing ? (
                          <input
                            className={styles.editInput}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => {
                              if (editValue.trim() && onConversationRename) {
                                onConversationRename(sub.id, editValue.trim());
                              }
                              setEditingId(null);
                              setEditValue('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (editValue.trim() && onConversationRename) {
                                  onConversationRename(sub.id, editValue.trim());
                                }
                                setEditingId(null);
                                setEditValue('');
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditValue('');
                              }
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <button
                              className={styles.subItem}
                              onClick={() => {
                                if (isChatItem && onConversationClick) {
                                  onConversationClick(sub.id);
                                }
                                onTabChange(item.id);
                                if (window.innerWidth < 768) onClose();
                              }}
                            >
                              {sub.label}
                            </button>
                            {isChatItem && (isHovered || isEditing) && (
                              <div className={styles.subItemActions}>
                                <button
                                  className={styles.actionBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const conv = conversations.find(c => c.id === sub.id);
                                    if (conv) {
                                      setEditingId(sub.id);
                                      setEditValue(conv.title);
                                    }
                                  }}
                                  title="Rename"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className={styles.actionBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onConversationDelete) {
                                      onConversationDelete(sub.id);
                                    }
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <button className={styles.userProfile} onClick={onProfileClick}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>Al Murat</span>
              <span className={styles.userWallet}>0x12...34</span>
            </div>
            <div className={styles.avatar} />
          </button>
        </div>
      </aside>
    </>
  );
};
