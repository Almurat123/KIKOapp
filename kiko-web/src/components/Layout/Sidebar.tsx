
import React, { useState, useEffect } from 'react';
import { MessageSquare, Newspaper, BarChart2, Layers, Plus, PanelLeftClose, ChevronDown, ChevronRight, Pencil, Trash2, Users, RefreshCw, Coins, Network } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import clsx from 'clsx';
import kikoLogo from '../../assets/images/kiko-logo.png';
import { useThemeContext } from '../../contexts/ThemeContext';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import { getUserInfo } from '../../utils/privyUtils';
import { getUsageSummary } from '../../services/billingApi';
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
  generatingConversationId?: string | null;
}

interface NavItem {
  id: string;
  icon: React.ComponentType<any>;
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
  generatingConversationId,
}) => {
  const { resolvedTheme } = useThemeContext();
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['chat']));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [usageSummary, setUsageSummary] = useState<{
    dateUtc: string;
    total: { used: number; limit: number };
    normal: { used: number };
    advanced: { used: number };
    tokenBalance: number;
  } | null>(null);

  const fetchUsageSummary = React.useCallback(async () => {
    if (!authenticated || !ready) {
      setUsageSummary(null);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        setUsageSummary(null);
        return;
      }
      const summary = await getUsageSummary(token);
      setUsageSummary(summary);
    } catch {
      setUsageSummary(null);
    }
  }, [authenticated, ready, getAccessToken]);

  useEffect(() => {
    fetchUsageSummary();
  }, [fetchUsageSummary]);

  useEffect(() => {
    const handler = () => {
      fetchUsageSummary();
    };
    window.addEventListener('kiko-usage-refresh', handler as EventListener);
    return () => window.removeEventListener('kiko-usage-refresh', handler as EventListener);
  }, [fetchUsageSummary]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const walletAddress = (() => {
    const linked = user?.linkedAccounts || [];
    const embeddedEvm = linked.find(
      (acc): acc is WalletWithMetadata =>
        acc.type === 'wallet' && acc.walletClientType === 'privy' && acc.chainType === 'ethereum'
    );
    if (embeddedEvm) return embeddedEvm.address;
    const embeddedSol = linked.find(
      (acc): acc is WalletWithMetadata =>
        acc.type === 'wallet' && acc.walletClientType === 'privy' && acc.chainType === 'solana'
    );
    return embeddedSol?.address || '';
  })();
  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-2)}`
    : 'No embedded wallet';

  // Get user info and avatar
  const { name: userName, initials: userInitials, avatarUrl } = getUserInfo(user);

  const filteredConversations = conversations;
  const conversationLimit = 5;
  const hasMoreConversations = filteredConversations.length > conversationLimit;
  let visibleConversations = filteredConversations;
  if (!showAllConversations && hasMoreConversations) {
    visibleConversations = filteredConversations.slice(0, conversationLimit);
    const pinnedId = generatingConversationId || activeConversationId;
    if (pinnedId && !visibleConversations.some(conv => conv.id === pinnedId)) {
      const pinned = filteredConversations.find(conv => conv.id === pinnedId);
      if (pinned) {
        visibleConversations = [...visibleConversations.slice(0, conversationLimit - 1), pinned];
      }
    }
  }

  const chatItem: NavItem = {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat',
    subItems: visibleConversations.map(conv => ({
      id: conv.id,
      label: conv.title,
    })),
  };

  const navItems: NavItem[] = [
    chatItem,
    {
      id: 'social',
      icon: Users,
      label: 'Social',
    },
    {
      id: 'market-tokens',
      icon: Coins,
      label: 'Tokens',
    },
    {
      id: 'trade',
      icon: RefreshCw,
      label: 'Trade',
    },
    {
      id: 'news',
      icon: Newspaper,
      label: 'News',
    },
    {
      id: 'market-overview',
      icon: BarChart2,
      label: 'Overview',
    },
    {
      id: 'market-chains',
      icon: Network,
      label: 'Chains',
    },
    {
      id: 'defi',
      icon: Layers,
      label: 'SuperDefi',
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
      <div
        className={clsx(styles.overlay, isOpen && styles.overlayVisible)}
        onClick={onClose}
      />

      <aside className={clsx(
        styles.sidebar,
        isOpen && styles.sidebarOpen,
        !isDesktopOpen && styles.sidebarHidden,
        styles[resolvedTheme]
      )}>

        <div className={styles.header}>
          <div
            className={styles.logo}
            onClick={() => {
              if (onNewChat) onNewChat();
              onTabChange('chat');
              if (isMobile) onClose();
            }}
            style={{ cursor: 'pointer' }}
          >
            <img src={kikoLogo} alt="KIKO" className={styles.logoImage} />
            <span className={styles.logoText}>KIKO</span>
            <ThemeToggle />
          </div>

          {/* Corrected: Using Sidebar icon for both mobile and desktop (as per user screen) */}
          <button
            className={styles.collapseBtn}
            onClick={isMobile ? onClose : onDesktopClose}
            title={isMobile ? "Close" : "Collapse"}
          >
            <PanelLeftClose size={20} />
          </button>
        </div>

        <div className={styles.actionArea}>
          <button
            className={styles.newChatBtn}
            onClick={() => {
              if (onNewChat) onNewChat();
              onTabChange('chat');
              if (isMobile) onClose();
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
                  if (!item.subItems) {
                    onTabChange(item.id);
                    if (isMobile) onClose();
                  } else {
                    toggleExpand(item.id);
                  }
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
                                } else {
                                  onTabChange(sub.id);
                                }
                                if (isMobile) onClose();
                              }}
                            >
                              <span className={styles.subItemLabel}>{sub.label}</span>
                              {generatingConversationId === sub.id && (
                                <div className={styles.loadingSpinner} />
                              )}
                            </button>
                            {isChatItem && (isMobile || isHovered || isEditing) && (
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
                  {item.id === 'chat' && hasMoreConversations && (
                    <button
                      className={styles.showMoreButton}
                      onClick={() => setShowAllConversations(prev => !prev)}
                    >
                      {showAllConversations ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.usageSummary}>
            <div className={styles.usageRow}>
              <span className={styles.usageLabel}>Daily</span>
              <span className={styles.usageValue}>
                {usageSummary ? `${usageSummary.total.used}/${usageSummary.total.limit}` : '--'}
              </span>
            </div>
            <div className={styles.usageRow}>
              <span className={styles.usageLabel}>Normal</span>
              <span className={styles.usageValue}>
                {usageSummary ? `${usageSummary.normal.used}` : '--'}
              </span>
            </div>
            <div className={styles.usageRow}>
              <span className={styles.usageLabel}>Advanced</span>
              <span className={styles.usageValue}>
                {usageSummary ? `${usageSummary.advanced.used}` : '--'}
              </span>
            </div>
            <div className={styles.usageRow}>
              <span className={styles.usageLabel}>Token</span>
              <span className={styles.usageValue}>
                {usageSummary ? usageSummary.tokenBalance.toFixed(4) : '--'}
              </span>
            </div>
          </div>
          <button
            className={styles.userProfile}
            onClick={() => {
              onProfileClick();
              if (isMobile) onClose();
            }}
          >
            <div className={styles.userInfo}>
              <span
                className={clsx(
                  styles.userName,
                  userName?.toLowerCase() === 'shoumoore' && styles.userNameShoumoore
                )}
              >
                {userName}
              </span>
              <span className={styles.userWallet}>{displayAddress}</span>
            </div>
            <div className={styles.avatar}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarInitials}>{userInitials}</span>
              )}
            </div>
          </button>
        </div>
      </aside>
    </>
  );
};
