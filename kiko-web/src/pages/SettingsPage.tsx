import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ExportWalletButton } from '../components/Wallet/ExportWalletButton';
import { SessionSignerButton } from '../components/Wallet/SessionSignerButton';
import { PolymarketAuthButton } from '../components/Wallet/PolymarketAuthButton';
import { PageContainer } from '../components/Layout/PageContainer';
import styles from './SettingsPage.module.css';
import { resolveCoreApiBase } from '../utils/coreApiBase';

const CORE_API_BASE_URL = resolveCoreApiBase();

// [Logic]: Extract community follow button logic.
// [Ref]: Migrated from WalletSettingsModal.tsx:L16-L191.
const FollowKikoButton: React.FC = () => {
    const { user, getAccessToken } = usePrivy();
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [hasClickedFollow, setHasClickedFollow] = React.useState(false);

    React.useEffect(() => {
        const syncFarcasterProfile = async () => {
            if (!user) return;
            const farcasterAccount = user.linkedAccounts?.find(
                (acc: any) => acc.type === 'farcaster' || (acc.type === 'wallet' && acc.chainType === 'farcaster')
            );
            const fid = (farcasterAccount as any)?.fid || (user as any).farcaster?.fid;
            const username = (farcasterAccount as any)?.username || (user as any).farcaster?.username;

            if (fid) {
                try {
                    const storageKey = `kiko-farcaster-synced-v2-${fid}`;
                    if (localStorage.getItem(storageKey)) return;
                    const authToken = await getAccessToken();
                    const response = await fetch(`${CORE_API_BASE_URL}/api/users/farcaster`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                        body: JSON.stringify({ fid, username })
                    });
                    if (response.ok) { localStorage.setItem(storageKey, 'true'); }
                } catch (error) { console.warn('[SettingsPage] Sync failed', error); }
            }
        };
        syncFarcasterProfile();
    }, [user, getAccessToken]);

    const checkFollowStatus = React.useCallback(async () => {
        if (!user) { setLoading(false); return; }
        const farcasterAccount = user.linkedAccounts?.find(
            (acc: any) => acc.type === 'farcaster' || (acc.type === 'wallet' && acc.chainType === 'farcaster')
        );
        const fid = (farcasterAccount as any)?.fid || (user as any).farcaster?.fid;
        if (!fid) { setIsFollowing(false); setLoading(false); return; }
        if (localStorage.getItem('kiko-farcaster-follow-dismissed') === 'true') { setIsFollowing(true); setLoading(false); return; }

        try {
            const response = await fetch(`${CORE_API_BASE_URL}/api/social/is-following/${fid}`);
            const data = await response.json();
            if (data.success && data.data.isFollowing) {
                setIsFollowing(true);
                localStorage.setItem('kiko-farcaster-follow-dismissed', 'true');
            } else { setIsFollowing(false); }
        } catch (e) { console.warn('[SettingsPage] Follow check failed', e); }
        setLoading(false);
    }, [user]);

    React.useEffect(() => { checkFollowStatus(); }, [checkFollowStatus]);

    React.useEffect(() => {
        if (!hasClickedFollow) return;
        const handleEvents = () => { if (document.visibilityState === 'visible') checkFollowStatus(); };
        document.addEventListener('visibilitychange', handleEvents);
        window.addEventListener('focus', handleEvents);
        const pollInterval = setInterval(checkFollowStatus, 3000);
        setTimeout(() => clearInterval(pollInterval), 30000);
        return () => {
            document.removeEventListener('visibilitychange', handleEvents);
            window.removeEventListener('focus', handleEvents);
            clearInterval(pollInterval);
        };
    }, [hasClickedFollow, checkFollowStatus]);

    const handleFollow = () => { setHasClickedFollow(true); window.open('https://warpcast.com/kikoapp', '_blank', 'noopener,noreferrer'); };

    if (loading) return null;
    return (
        <div className={styles.groupItem}>
            <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{isFollowing ? 'Community Status' : 'Join Community'}</span>
                <p className={styles.itemDescription}>{isFollowing ? 'You are following @kikoapp' : 'Follow for real-time alerts'}</p>
            </div>
            {isFollowing ? <button className={styles.successButton} disabled>Following ✅</button> :
                <button onClick={handleFollow} className={styles.followButton}>Follow @kikoapp</button>}
        </div>
    );
};

interface SettingsPageProps {
    onDisconnect?: () => void;
}

// [Logic]: Primary settings page component, converted from Modal.
// [Ref]: Replaced WalletSettingsModal.tsx with standalone page implementation.
export default function SettingsPage({ onDisconnect }: SettingsPageProps) {
    const { logout } = usePrivy();
    const handleLogout = onDisconnect || logout;
    return (
        <PageContainer title="Settings">
            <div className={styles.settingsPage}>
                <div className={styles.content}>
                    <div className={styles.group}>
                        <h3 className={styles.groupTitle}>Community</h3>
                        <div className={styles.groupList}>
                            <FollowKikoButton />
                        </div>
                    </div>

                    <div className={styles.group}>
                        <h3 className={styles.groupTitle}>Security & Privacy</h3>
                        <div className={styles.groupList}>
                            <div className={styles.groupItem}>
                                <SessionSignerButton chainType="ethereum" />
                            </div>
                            <div className={styles.groupItem}>
                                <SessionSignerButton chainType="solana" />
                            </div>
                            <div className={styles.groupItem}>
                                <PolymarketAuthButton />
                            </div>
                            <div className={styles.groupItem}>
                                <div className={styles.itemHeader}>
                                    <span className={styles.itemTitle}>Backup Recovery Phrase</span>
                                    <p className={styles.itemDescription}>Export your private key to secure your wallet.</p>
                                </div>
                                <div className={styles.recoveryButtons}>
                                    <ExportWalletButton chainType="ethereum" asButton />
                                    <ExportWalletButton chainType="solana" asButton />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.dangerZone}>
                        <button onClick={handleLogout} className={styles.disconnectButton}>Logout</button>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
