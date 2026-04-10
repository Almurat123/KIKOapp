import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { ExportWalletButton } from '../components/Wallet/ExportWalletButton';
import { SessionSignerButton } from '../components/Wallet/SessionSignerButton';
import { PolymarketAuthButton } from '../components/Wallet/PolymarketAuthButton';
import { PageContainer } from '../components/Layout/PageContainer';
import styles from './SettingsPage.module.css';
import { useAgentMode } from '../contexts/AgentModeContext';
import { useFarcasterContext } from '../contexts/FarcasterContext';
import { agentAttrs } from '../agent/attrs';

// [Logic]: Extract community follow button logic.
// [Ref]: Migrated from WalletSettingsModal.tsx:L16-L191.
const FollowKikoButton: React.FC = () => {
    const { fid, followsKiko, followStatus, loading, refresh } = useFarcasterContext();
    const [hasClickedFollow, setHasClickedFollow] = React.useState(false);

    React.useEffect(() => {
        refresh({ force: true }).catch(() => undefined);
    }, [refresh]);

    React.useEffect(() => {
        if (!hasClickedFollow) return;
        const handleEvents = () => {
            if (document.visibilityState === 'visible') {
                refresh({ force: true }).catch(() => undefined);
            }
        };
        document.addEventListener('visibilitychange', handleEvents);
        window.addEventListener('focus', handleEvents);

        let attempts = 0;
        const pollInterval = setInterval(() => {
            if (attempts >= 5) { // Cap at 5 attempts (15 seconds total)
                clearInterval(pollInterval);
                return;
            }
            refresh({ force: true }).catch(() => undefined);
            attempts++;
        }, 3000);

        return () => {
            document.removeEventListener('visibilitychange', handleEvents);
            window.removeEventListener('focus', handleEvents);
            clearInterval(pollInterval);
        };
    }, [hasClickedFollow, refresh]);

    const handleFollow = () => { setHasClickedFollow(true); window.open('https://farcaster.xyz/kikoapp', '_blank', 'noopener,noreferrer'); };

    if (loading) return null;
    const isFollowing = followsKiko === true;
    const canCheckFollow = Boolean(fid);
    return (
        <div className={styles.groupItem} {...agentAttrs({ id: 'settings.community.follow_card', role: 'card', page: 'settings' })}>
            <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{isFollowing ? 'Community Status' : 'Join Community'}</span>
                <p className={styles.itemDescription}>
                    {isFollowing ? 'You are following @kikoapp' : canCheckFollow && followStatus === 'unknown' ? 'Follow status unavailable right now' : 'Follow for real-time alerts'}
                </p>
            </div>
            {isFollowing ? (
                <button
                    className={styles.successButton}
                    disabled
                    {...agentAttrs({ id: 'settings.community.follow.status', role: 'button', page: 'settings', key: 'community_follow' })}
                >
                    Following ✅
                </button>
            ) : (
                <button
                    onClick={handleFollow}
                    className={styles.followButton}
                    {...agentAttrs({ id: 'settings.community.follow.open', role: 'button', action: 'open', page: 'settings', key: 'community_follow' })}
                >
                    Follow @kikoapp
                </button>
            )}
        </div>
    );
};

interface SettingsPageProps {
    onDisconnect?: () => void | Promise<void>;
}

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Rowan
// Reason: Wallet settings owns the last-mile logout affordance and previously exposed a dead-feeling button with no visible pending state.
// Goal: preserve immediate user feedback during logout so repeated clicks and "did it work?" ambiguity do not regress.
// Owns: local pending UI, logout button copy, click dedupe, and settings-page level interaction feedback.
// Does Not Own: auth session invalidation semantics, redirect policy after logout, or Privy provider behavior.
// Design Language:
// - destructive actions must acknowledge the first click immediately with visible state change
// - settings-page buttons may disable during async work to prevent duplicate mutations
// - forbidden local patch patterns: binding async auth mutations directly to buttons with no pending UI
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-wallet-settings-logout-feedback.md
// [Logic]: Primary settings page component, converted from Modal.
// [Ref]: Replaced WalletSettingsModal.tsx with standalone page implementation.
export default function SettingsPage({ onDisconnect }: SettingsPageProps) {
    const { logout } = usePrivy();
    const { agentModeEnabled, setAgentModeEnabled, agentModeSource, isQueryOverride } = useAgentMode();
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);
    const handleLogout = onDisconnect || logout;

    const handleLogoutClick = React.useCallback(async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await Promise.resolve(handleLogout());
        } catch (error) {
            console.error('[SettingsPage] Logout failed', error);
            setIsLoggingOut(false);
        }
    }, [handleLogout, isLoggingOut]);

    return (
        <PageContainer title="Settings" {...agentAttrs({ id: 'settings.page', role: 'card', page: 'settings' })}>
            <div className={styles.settingsPage} {...agentAttrs({ id: 'settings.layout', role: 'card', page: 'settings' })}>
                <div className={styles.content} {...agentAttrs({ id: 'settings.content', role: 'list', page: 'settings' })}>
                    <div className={styles.group} {...agentAttrs({ id: 'settings.group.community', role: 'card', page: 'settings' })}>
                        <h3 className={styles.groupTitle}>Community</h3>
                        <div className={styles.groupList}>
                            <FollowKikoButton />
                        </div>
                    </div>

                    <div className={styles.group} {...agentAttrs({ id: 'settings.group.automation', role: 'card', page: 'settings' })}>
                        <h3 className={styles.groupTitle}>Automation</h3>
                        <div className={styles.groupList}>
                            <div className={styles.groupItem} {...agentAttrs({ id: 'settings.automation.agent_mode.card', role: 'card', page: 'settings' })}>
                                <div className={styles.itemHeader}>
                                    <span className={styles.itemTitle}>For Agent Mode</span>
                                    <p className={styles.itemDescription}>
                                        Expose machine-readable anchors and live coordinate mapping for automation agents.
                                    </p>
                                    <p className={styles.itemDescription}>
                                        Current source: {agentModeSource}{isQueryOverride ? ' (URL override active)' : ''}
                                    </p>
                                </div>
                                <button
                                    className={agentModeEnabled ? styles.successButton : styles.followButton}
                                    {...agentAttrs({ id: 'settings.agent_mode.toggle', role: 'toggle', action: 'toggle', page: 'settings', key: 'agent_mode' })}
                                    onClick={() => {
                                        if (isQueryOverride) return;
                                        setAgentModeEnabled(!agentModeEnabled);
                                    }}
                                    disabled={isQueryOverride}
                                >
                                    {agentModeEnabled ? 'Agent Mode: ON' : 'Agent Mode: OFF'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.group} {...agentAttrs({ id: 'settings.group.security', role: 'card', page: 'settings' })}>
                        <h3 className={styles.groupTitle}>Security & Privacy</h3>
                        <div className={styles.groupList}>
                            <div className={styles.groupItem} {...agentAttrs({ id: 'settings.security.session_signer.ethereum.card', role: 'card', page: 'settings' })}>
                                <SessionSignerButton chainType="ethereum" agentId="settings.security.session_signer.ethereum.toggle" />
                            </div>
                            <div className={styles.groupItem} {...agentAttrs({ id: 'settings.security.session_signer.solana.card', role: 'card', page: 'settings' })}>
                                <SessionSignerButton chainType="solana" agentId="settings.security.session_signer.solana.toggle" />
                            </div>
                            <div className={styles.groupItem} {...agentAttrs({ id: 'settings.security.polymarket.card', role: 'card', page: 'settings' })}>
                                <PolymarketAuthButton agentId="settings.security.polymarket.enable" />
                            </div>
                            <div className={styles.groupItem} {...agentAttrs({ id: 'settings.security.export_wallet.card', role: 'card', page: 'settings' })}>
                                <div className={styles.itemHeader}>
                                    <span className={styles.itemTitle}>Backup Recovery Phrase</span>
                                    <p className={styles.itemDescription}>Export your private key to secure your wallet.</p>
                                </div>
                                <div className={styles.recoveryButtons}>
                                    <ExportWalletButton chainType="ethereum" asButton agentId="settings.security.export_wallet.ethereum" />
                                    <ExportWalletButton chainType="solana" asButton agentId="settings.security.export_wallet.solana" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.dangerZone} {...agentAttrs({ id: 'settings.group.danger', role: 'card', page: 'settings' })}>
                        <button
                            onClick={handleLogoutClick}
                            className={`${styles.disconnectButton} ${isLoggingOut ? styles.disconnectButtonLoading : ''}`}
                            disabled={isLoggingOut}
                            aria-busy={isLoggingOut}
                            {...agentAttrs({ id: 'settings.logout', role: 'button', action: 'confirm', page: 'settings' })}
                        >
                            {isLoggingOut ? (
                                <>
                                    <Loader2 size={18} className={styles.spinner} />
                                    Logging out...
                                </>
                            ) : 'Logout'}
                        </button>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
