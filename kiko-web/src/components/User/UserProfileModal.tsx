import React from 'react';
import { X, Wallet, TrendingUp, Activity } from 'lucide-react';
import styles from './UserProfileModal.module.css';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>User Profile</h3>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.userHeader}>
                        <div className={styles.avatar} />
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>AlMurat</span>
                            <span className={styles.userWallet}>0x1234...abcd</span>
                        </div>
                    </div>

                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}><Wallet size={20} /></div>
                            <div className={styles.statInfo}>
                                <span className={styles.statLabel}>Total Balance</span>
                                <span className={styles.statValue}>$12,450.00</span>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}><TrendingUp size={20} /></div>
                            <div className={styles.statInfo}>
                                <span className={styles.statLabel}>PnL (30d)</span>
                                <span className={styles.statValue} style={{ color: 'var(--accent-success)' }}>+15.4%</span>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon}><Activity size={20} /></div>
                            <div className={styles.statInfo}>
                                <span className={styles.statLabel}>Open Orders</span>
                                <span className={styles.statValue}>3</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h4>Recent Activity</h4>
                        <div className={styles.activityList}>
                            <div className={styles.activityItem}>
                                <span>Swapped ETH for USDC</span>
                                <span className={styles.time}>2h ago</span>
                            </div>
                            <div className={styles.activityItem}>
                                <span>Provided Liquidity to UNI-V3</span>
                                <span className={styles.time}>1d ago</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
