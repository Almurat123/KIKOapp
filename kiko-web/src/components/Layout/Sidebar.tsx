
import React, { useState, useEffect } from 'react';
import { MessageSquare, Newspaper, BarChart2, Layers, Plus, PanelLeftClose, ChevronDown, ChevronRight, Pencil, Trash2, Users, RefreshCw, Coins, Network } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import icon from '../../assets/images/icon.png';
import { useThemeContext } from '../../contexts/ThemeContext';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import { getUserInfo } from '../../utils/privyUtils';
import { getUsageSummary } from '../../services/billingApi';
import { agentAttrs } from '../../agent/attrs';
import styles from './Sidebar.module.css';
import type { Conversation } from '../../hooks/useConversations';

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: Sidebar usage-summary reads were firing even when the mobile sidebar
//         was hidden, and passive page-focus listeners kept adding authenticated
//         reads during ordinary navigation. The quota summary now exposes free
//         usage with an optional shared cap plus one shared premium quota, so
//         the sidebar must render that shape instead of assuming Normal/Advanced buckets.
// Goal: limit billing-summary reads to moments when the sidebar is actually
//       visible or when an explicit refresh is requested, while rendering the
//       server-provided quota envelope faithfully.
// Owns: Sidebar-driven usage-summary refresh timing, visibility gating, and
//       footer quota presentation.
// Does Not Own: Billing quota computation, token balance mutations, or auth state.
// Design Language:
// - hidden mobile sidebar state must not trigger authenticated read traffic
// - passive focus/visibility changes should not refetch quota by default
// - free/premium quota rows from the server must not be flattened back into guessed client categories
// - nullable free-model limits render as infinity, not zero
// - forbidden local patch patterns: unconditional usage-summary fetches on every page activation
// Document Provenance:
// - Source: Production console traces showing `/api/billing/usage-summary` 429s while entering the token page
// - Kind: runtime observation
// - Retrieved: 2026-04-10
// - Applied To: gate sidebar quota reads by actual sidebar visibility
// - Verification: partially verified
// - Source: /Users/almurat/KiKo/kiko-api/src/routes/billing.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: rendering server-provided free/premium quota rows
// - Verification: verified in code
// - Source: operator quota-policy correction for optional free-model cap
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: rendering nullable free-model cap in the footer
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-token-page-stray-read-rate-limit.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

interface SidebarProps {
  // activeTab and onTabChange removed - utilizing router
  isOpen: boolean;
  onClose: () => void;
  isDesktopOpen: boolean;
  onDesktopClose: () => void;
  onProfileClick: () => void;
  conversations?: Conversation[];
  activeConversationId?: string | null;
  // onConversationClick removed - utilizing router
  onNewChat?: () => void;
  onConversationRename?: (id: string, newTitle: string) => void;
  onConversationDelete?: (id: string) => void;
  generatingConversationId?: string | null;
}

interface NavItem {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  path: string; // Added path
  subItems?: { id: string; label: string; path: string }[];
}

type UsageSummaryModelRow = {
  model: string;
  used: number;
  limit: number | null;
  category: 'free' | 'premium' | 'other';
  limitSource: 'free_unlimited' | 'free_shared' | 'premium_shared' | 'none';
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isDesktopOpen,
  onDesktopClose,
  onProfileClick,
  conversations = [],
  activeConversationId,
  onNewChat,
  onConversationRename,
  onConversationDelete,
  generatingConversationId,
}) => {
  const { resolvedTheme } = useThemeContext();
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['chat']));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showAllConversations, setShowAllConversations] = useState(false);
  const [usageSummary, setUsageSummary] = useState<{
    dateUtc: string;
    total: { used: number; limit: number | null };
    free: { used: number; limit: number | null };
    premium: { used: number; limit: number };
    models?: UsageSummaryModelRow[];
    usesPremiumSharedLimit: boolean;
  } | null>(null);
  const isSidebarVisible = isMobile ? isOpen : isDesktopOpen;

  const fetchUsageSummary = React.useCallback(async () => {
    if (!isSidebarVisible) {
      return;
    }
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
  }, [authenticated, ready, getAccessToken, isSidebarVisible]);

  useEffect(() => {
    if (!isSidebarVisible) return;
    fetchUsageSummary();
  }, [fetchUsageSummary, isSidebarVisible]);

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
    path: '/',
    subItems: visibleConversations.map(conv => ({
      id: conv.id,
      label: conv.title,
      path: `/chat/${conv.id}`
    })),
  };

  const navItems: NavItem[] = [
    chatItem,
    {
      id: 'social',
      icon: Users,
      label: 'Social',
      path: '/social'
    },
    {
      id: 'market-tokens',
      icon: Coins,
      label: 'Tokens',
      path: '/tokens'
    },
    {
      id: 'trade',
      icon: RefreshCw,
      label: 'Trade',
      path: '/trade'
    },
    {
      id: 'news',
      icon: Newspaper,
      label: 'News',
      path: '/news'
    },
    {
      id: 'market-overview',
      icon: BarChart2,
      label: 'Overview',
      path: '/market'
    },
    {
      id: 'market-chains',
      icon: Network,
      label: 'Chains',
      path: '/chains'
    },
    {
      id: 'defi',
      icon: Layers,
      label: 'SuperDefi',
      path: '/defi'
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

  // Check if a path is active (handling sub-paths for some)
  const isPathActive = (path: string, exact = false) => {
    if (path === '/' && location.pathname !== '/' && !location.pathname.startsWith('/chat')) return false;
    if (path === '/' && (location.pathname === '/' || location.pathname.startsWith('/chat'))) return true;

    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
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
              navigate('/');
              if (isMobile) onClose();
            }}
            style={{ cursor: 'pointer' }}
          >
            <img src={icon} alt="KIKO" className={styles.logoImage} />
            <span className={styles.logoText}>KIKO</span>
            <ThemeToggle />
          </div>

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
            {...agentAttrs({ id: 'sidebar.action.new_chat', role: 'button', action: 'navigate', page: 'sidebar' })}
            onClick={() => {
              if (onNewChat) onNewChat();
              navigate('/');
              if (isMobile) onClose();
            }}
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            // Determine if item is active based on path
            // For chat, it's active if on / or /chat/...
            const isActive = isPathActive(item.path);

            return (
              <div key={item.id} className={styles.navGroup}>
                {/* If item has subitems (like Chat), click toggles expand or navigates to main path */}
                {!item.subItems ? (
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => clsx(styles.navItem, isActive && styles.active)}
                    {...agentAttrs({
                      id: `sidebar.nav.${item.id}`,
                      role: 'nav',
                      action: 'navigate',
                      page: 'sidebar',
                    })}
                    onClick={() => {
                      if (isMobile) onClose();
                    }}
                  >
                    <item.icon size={18} />
                    <span className={styles.navLabel}>{item.label}</span>
                  </NavLink>
                ) : (
                  <button
                    className={clsx(styles.navItem, isActive && styles.active)}
                    {...agentAttrs({
                      id: `sidebar.nav.${item.id}`,
                      role: 'nav',
                      action: 'open',
                      page: 'sidebar',
                    })}
                    onClick={() => {
                      // For Chat, clicking the header should probably just toggle or go to new chat?
                      // Current behavior seems to be toggle expand if subItems exist
                      toggleExpand(item.id);
                    }}
                  >
                    <item.icon size={18} />
                    <span className={styles.navLabel}>{item.label}</span>
                    <span className={styles.chevron}>
                      {expandedItems.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>
                )}

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
                            // NavLink handles active, but we need custom styling wrapper
                            location.pathname === sub.path && styles.active
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
                              <NavLink
                                to={sub.path}
                                className={({ isActive }) => clsx(styles.subItem, isActive && styles.activeText)}
                                {...agentAttrs({
                                  id: `sidebar.chat.item.${sub.id}`,
                                  role: 'nav',
                                  action: 'navigate',
                                  page: 'sidebar',
                                  key: 'conversation_id',
                                })}
                                onClick={() => {
                                  if (isMobile) onClose();
                                }}
                              >
                                <span className={styles.subItemLabel}>{sub.label}</span>
                                {(() => {
                                  const conv = conversations.find(c => c.id === sub.id);
                                  const hasStreamingMessage = !!conv?.messages?.some(
                                    message => message.role === 'assistant' && message.status === 'streaming'
                                  );
                                  const isActive = !!conv?.activeTask || hasStreamingMessage;
                                  return isActive ? <div className={styles.loadingSpinner} /> : null;
                                })()}
                              </NavLink>
                              {isChatItem && (isMobile || isHovered || isEditing) && (
                                <div className={styles.subItemActions}>
                                  <button
                                    className={styles.actionBtn}
                                    {...agentAttrs({
                                      id: `sidebar.chat.rename.${sub.id}`,
                                      role: 'button',
                                      action: 'open',
                                      page: 'sidebar',
                                    })}
                                    onClick={(e) => {
                                      e.preventDefault();
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
                                    {...agentAttrs({
                                      id: `sidebar.chat.delete.${sub.id}`,
                                      role: 'button',
                                      action: 'confirm',
                                      page: 'sidebar',
                                    })}
                                    onClick={(e) => {
                                      e.preventDefault();
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
            );
          })}
        </nav>

        <div className={styles.footer}>
          <div className={styles.usageSummary}>
            <div className={styles.usageRow}>
              <span className={styles.usageLabel}>Free</span>
              <span className={styles.usageValue}>
                {usageSummary ? `${usageSummary.free.used}/${usageSummary.free.limit ?? '∞'}` : '--'}
              </span>
            </div>
            <div className={styles.usageRow}>
              <span className={styles.usageLabel}>Premium</span>
              <span className={styles.usageValue}>
                {usageSummary ? `${usageSummary.premium.used}/${usageSummary.premium.limit}` : '--'}
              </span>
            </div>
          </div>
          <button
            className={styles.userProfile}
            {...agentAttrs({ id: 'sidebar.user.profile', role: 'button', action: 'navigate', page: 'sidebar' })}
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
