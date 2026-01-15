import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Dialog } from '../Dialog/Dialog';
import { ExportWalletButton } from './ExportWalletButton';
import { SessionSignerButton } from './SessionSignerButton';
import { PolymarketAuthButton } from './PolymarketAuthButton';
import styles from './WalletSettingsModal.module.css';

interface WalletSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisconnect: () => void;
}

// Inline component for Kiko Follow Button
const FollowKikoButton: React.FC = () => {
  const { user } = usePrivy();
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [hasClickedFollow, setHasClickedFollow] = React.useState(false);

  const checkFollowStatus = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Get Farcaster FID if available
    const farcasterAccount = user.linkedAccounts?.find(
      (acc: any) => acc.type === 'farcaster' || (acc.type === 'wallet' && acc.chainType === 'farcaster')
    );
    const fid = (farcasterAccount as any)?.fid || (user as any).farcaster?.fid;

    // If user has no Farcaster, always show "Follow" button (can't verify)
    if (!fid) {
      setIsFollowing(false);
      setLoading(false);
      return;
    }

    // User HAS Farcaster - check localStorage first for quick return
    if (localStorage.getItem('kiko-farcaster-follow-dismissed') === 'true') {
      setIsFollowing(true);
      setLoading(false);
      return;
    }

    // Check API for actual follow status
    try {
      const response = await fetch(`/api/social/is-following/${fid}`);
      const data = await response.json();
      if (data.success && data.data.isFollowing) {
        setIsFollowing(true);
        localStorage.setItem('kiko-farcaster-follow-dismissed', 'true');
      }
    } catch (error) {
      console.warn('[WalletSettings] Follow check failed', error);
    }
    setLoading(false);
  }, [user]);

  // Initial check on mount
  React.useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  // Re-check when user returns to tab (after clicking follow)
  React.useEffect(() => {
    if (!hasClickedFollow) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkFollowStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasClickedFollow, checkFollowStatus]);

  const handleFollow = () => {
    setHasClickedFollow(true);
    window.open('https://warpcast.com/kikoapp', '_blank', 'noopener,noreferrer');
  };

  if (loading) return null;

  if (isFollowing) {
    return (
      <div className={styles.groupItem}>
        <div className={styles.itemHeader}>
          <span className={styles.itemTitle}>Community Status</span>
          <p className={styles.itemDescription}>You are following @kikoapp</p>
        </div>
        <button className={styles.successButton} disabled>
          Following ✅
        </button>
      </div>
    );
  }

  return (
    <div className={styles.groupItem}>
      <div className={styles.itemHeader}>
        <span className={styles.itemTitle}>Join Community</span>
        <p className={styles.itemDescription}>Follow for real-time alerts</p>
      </div>
      <button onClick={handleFollow} className={styles.followButton}>
        Follow @kikoapp
      </button>
    </div>
  );
};

export const WalletSettingsModal: React.FC<WalletSettingsModalProps> = ({
  isOpen,
  onClose,
  onDisconnect,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Wallet Settings"
      size="lg"
      className={styles.modal}
    >
      <div className={styles.content}>

        {/* Community Group - New Section */}
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Community</h3>
          <div className={styles.groupList}>
            <FollowKikoButton />
          </div>
        </div>

        {/* Security Group */}
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Security & Privacy</h3>
          <div className={styles.groupList}>
            {/* Auto Trading Items - Both EVM and Solana */}
            <div className={styles.groupItem}>
              <SessionSignerButton chainType="ethereum" />
            </div>
            <div className={styles.groupItem}>
              <SessionSignerButton chainType="solana" />
            </div>

            {/* Polymarket Trading */}
            <div className={styles.groupItem}>
              <PolymarketAuthButton />
            </div>

            {/* Recovery Phrase Items */}
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

        {/* Danger Zone */}
        <div className={styles.dangerZone}>
          <button
            onClick={onDisconnect}
            className={styles.disconnectButton}
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    </Dialog>
  );
};

