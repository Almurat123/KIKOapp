import React from 'react';
import { Settings, Clock, DollarSign, AlertCircle, ArrowRight } from 'lucide-react';
import styles from './Chat.module.css';

interface StrategyCardProps {
    type: string;
    token: string;
    triggerCondition: string;
    executionAmount: string;
    limits: {
        maxUsdPerDay: string;
        maxTradesPerDay: number;
        cooldown: string;
    };
}

export const StrategyCard: React.FC<StrategyCardProps> = ({
    type,
    token,
    triggerCondition,
    executionAmount,
    limits
}) => {
    return (
        <div className={styles.strategyCard}>
            <div className={styles.cardHeader}>
                <div className={styles.strategyIcon}>
                    <Settings size={18} />
                </div>
                <div className={styles.strategyTitleGroup}>
                    <span className={styles.strategyType}>{type}</span>
                    <span className={styles.strategyToken}>{token}</span>
                </div>
            </div>

            <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                    <span className={styles.label}>Trigger</span>
                    <span className={styles.value}>{triggerCondition}</span>
                </div>
                <div className={styles.infoRow}>
                    <span className={styles.label}>Amount</span>
                    <span className={styles.value}>{executionAmount}</span>
                </div>

                <div className={styles.divider} />

                <div className={styles.limitsGrid}>
                    <div className={styles.limitItem}>
                        <DollarSign size={12} className={styles.limitIcon} />
                        <span>Max {limits.maxUsdPerDay}/day</span>
                    </div>
                    <div className={styles.limitItem}>
                        <Clock size={12} className={styles.limitIcon} />
                        <span>{limits.cooldown} cooldown</span>
                    </div>
                    <div className={styles.limitItem}>
                        <AlertCircle size={12} className={styles.limitIcon} />
                        <span>Max {limits.maxTradesPerDay} trades</span>
                    </div>
                </div>
            </div>

            <div className={styles.cardFooter}>
                <button className={styles.secondaryBtn}>Edit</button>
                <button className={styles.primaryBtn}>
                    Start Strategy <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};
