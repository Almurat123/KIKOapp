import React, { useState, useEffect } from 'react';
import { ExternalLink, X, Check } from 'lucide-react';
import styles from './FarcasterFollowModal.module.css';
import { resolveCoreApiBase } from '../../utils/coreApiBase';
import { useFarcasterContext } from '../../contexts/FarcasterContext';

interface FarcasterProfile {
    fid: number;
    username: string;
    displayName: string;
    pfp: string;
    bio: string;
    followers: number;
    verifications: string[];
}

const DEFAULT_PROFILE: FarcasterProfile = {
    fid: 0,
    username: 'kikoapp',
    displayName: 'KIKO',
    pfp: '/KIKOlight.png',
    bio: 'Follow to get real-time trade alerts and deep-dive insights directly in your notifications.',
    followers: 0,
    verifications: []
};

interface FarcasterFollowModalProps {
    onDismiss: (neverShowAgain: boolean) => void;
}

export const FarcasterFollowModal: React.FC<FarcasterFollowModalProps> = ({ onDismiss }) => {
    const API_BASE_URL = resolveCoreApiBase();
    const { fid, followsKiko, refresh } = useFarcasterContext();
    const [profile, setProfile] = useState<FarcasterProfile>(DEFAULT_PROFILE);
    const [isVisible, setIsVisible] = useState(false);
    const [neverShowAgain, setNeverShowAgain] = useState(false);
    const [hasOpenedFollow, setHasOpenedFollow] = useState(false);

    useEffect(() => {
        // Show the modal immediately with default profile
        setTimeout(() => setIsVisible(true), 100);

        // Try to upgrade profile from API in the background (best-effort, silent failure)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        fetch(`${API_BASE_URL}/api/social/profile/kikoapp`, { signal: controller.signal })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.success && data.data) {
                    setProfile(data.data);
                }
            })
            .catch(() => { /* silently use default profile */ })
            .finally(() => clearTimeout(timeout));
    }, []);

    useEffect(() => {
        if (followsKiko === true) {
            onDismiss(true);
        }
    }, [followsKiko, onDismiss]);

    useEffect(() => {
        if (!hasOpenedFollow || !fid) return;

        const recheck = () => {
            if (document.visibilityState === 'visible') {
                refresh({ force: true }).catch(() => undefined);
            }
        };

        document.addEventListener('visibilitychange', recheck);
        window.addEventListener('focus', recheck);
        return () => {
            document.removeEventListener('visibilitychange', recheck);
            window.removeEventListener('focus', recheck);
        };
    }, [fid, hasOpenedFollow, refresh]);

    const handleFollowClick = () => {
        setHasOpenedFollow(true);
        window.open('https://farcaster.xyz/kikoapp', '_blank', 'noopener,noreferrer');
    };

    return (
        <div className={`${styles.modalOverlay} ${isVisible ? styles.active : ''}`}>
            <div className={styles.modalContent}>
                <div className={styles.glassCard}>
                    <button className={styles.dismissButton} onClick={() => onDismiss(neverShowAgain)} title="Dismiss">
                        <X size={20} />
                    </button>

                    <div className={styles.modalHeader}>
                        <div className={styles.avatarWrapper}>
                            <img
                                src="/KIKOlight.png"
                                alt="KIKO"
                                className={styles.avatar}
                            />
                        </div>
                        <div className={styles.titleGroup}>
                            <h3 className={styles.name}>{profile.displayName}</h3>
                            <span className={styles.handle}>@{profile.username}</span>
                        </div>
                    </div>

                    <div className={styles.modalBody}>
                        <p className={styles.bio} style={{ textAlign: 'center', lineHeight: '1.6', fontSize: '14px' }}>
                            🌟 <strong>Highly recommended for all users!</strong><br />
                            <br />
                            Follow KIKO on Farcaster to get first-hand access to:<br />
                            🔔 Real-time trade alerts and notifications<br />
                            ⚡️ Instant alpha trading opportunities<br />
                            🚀 Direct feedback and every feature update
                        </p>
                    </div>

                    <button className={styles.followButton} onClick={handleFollowClick}>
                        <span>Follow on Farcaster</span>
                        <ExternalLink size={18} />
                    </button>

                    <div className={styles.neverShowAgainContainer} onClick={() => setNeverShowAgain(!neverShowAgain)}>
                        <div className={`${styles.checkbox} ${neverShowAgain ? styles.checked : ''}`}>
                            {neverShowAgain && <Check size={12} color="white" strokeWidth={3} />}
                        </div>
                        <span className={styles.checkboxLabel}>Do not show this again</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
