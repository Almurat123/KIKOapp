import React, { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import styles from './FarcasterFollowModal.module.css';
import { logger } from '../../utils/logger';

interface FarcasterProfile {
    fid: number;
    username: string;
    displayName: string;
    pfp: string;
    bio: string;
    followers: number;
    verifications: string[];
}

interface FarcasterFollowModalProps {
    onDismiss: () => void;
}

export const FarcasterFollowModal: React.FC<FarcasterFollowModalProps> = ({ onDismiss }) => {
    const [profile, setProfile] = useState<FarcasterProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch('/api/social/profile/kikoapp');
                const data = await response.json();
                if (data.success) {
                    setProfile(data.data);
                }
            } catch (error) {
                logger.error('[FarcasterFollowModal] Failed to fetch profile:', error);
            } finally {
                setLoading(false);
                // Small delay for entrance animation
                setTimeout(() => setIsVisible(true), 100);
            }
        };

        fetchProfile();
    }, []);

    const handleFollowClick = () => {
        logger.debug('[FarcasterFollowModal] User clicked follow link');
        window.open('https://farcaster.xyz/kikoapp', '_blank', 'noopener,noreferrer');
    };

    if (loading) return null;
    if (!profile) return null;

    return (
        <div className={`${styles.modalOverlay} ${isVisible ? styles.active : ''}`}>
            <div className={styles.modalContent}>
                <div className={styles.glassCard}>
                    <button className={styles.dismissButton} onClick={onDismiss} title="Dismiss">
                        <X size={20} />
                    </button>

                    <div className={styles.modalHeader}>
                        <div className={styles.avatarWrapper}>
                            <img
                                src={profile.pfp}
                                alt={profile.displayName}
                                className={styles.avatar}
                            />
                            <div className={styles.avatarGlow}></div>
                        </div>
                        <div className={styles.titleGroup}>
                            <h3 className={styles.name}>{profile.displayName}</h3>
                            <span className={styles.handle}>@{profile.username}</span>
                        </div>
                    </div>

                    <div className={styles.modalBody}>
                        <p className={styles.bio}>
                            Follow to get real-time trade alerts and deep-dive insights directly in your notifications.
                        </p>

                    </div>

                    <button className={styles.followButton} onClick={handleFollowClick}>
                        <span>Follow on Farcaster</span>
                        <ExternalLink size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
