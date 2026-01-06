/**
 * MEV Protection Badge Component
 * Displays MEV protection status and information
 */

import { useState } from 'react';
import styles from './MEVProtectionBadge.module.css';

interface MEVProtectionInfo {
    available: boolean;
    enabled: boolean;
    provider: string | null;
    rebatePercentage: number;
    estimatedSavings: number;
    features: string[];
}

interface MEVProtectionBadgeProps {
    mevProtection: MEVProtectionInfo;
    onToggle: (enabled: boolean) => void;
}

export function MEVProtectionBadge({ mevProtection, onToggle }: MEVProtectionBadgeProps) {
    const [showDetails, setShowDetails] = useState(false);

    if (!mevProtection.available) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.badge}>
                <div className={styles.header}>
                    <div className={styles.icon}>🛡️</div>
                    <div className={styles.info}>
                        <div className={styles.title}>MEV Protection</div>
                        <div className={styles.provider}>{mevProtection.provider}</div>
                    </div>
                    <label className={styles.toggle}>
                        <input
                            type="checkbox"
                            checked={mevProtection.enabled}
                            onChange={(e) => onToggle(e.target.checked)}
                        />
                        <span className={styles.slider}></span>
                    </label>
                </div>

                {mevProtection.enabled && (
                    <div className={styles.benefits}>
                        {mevProtection.rebatePercentage > 0 && (
                            <div className={styles.benefit}>
                                <span className={styles.benefitIcon}>💰</span>
                                <span>Up to {mevProtection.rebatePercentage}% rebate</span>
                            </div>
                        )}
                        {mevProtection.estimatedSavings > 0 && (
                            <div className={styles.benefit}>
                                <span className={styles.benefitIcon}>💵</span>
                                <span>Est. savings: ${mevProtection.estimatedSavings.toFixed(2)}</span>
                            </div>
                        )}
                        <button
                            className={styles.detailsButton}
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails ? 'Hide' : 'Show'} details
                        </button>
                    </div>
                )}

                {showDetails && mevProtection.enabled && (
                    <div className={styles.details}>
                        <div className={styles.detailsTitle}>Protection Features:</div>
                        <ul className={styles.featureList}>
                            {mevProtection.features.map((feature, index) => (
                                <li key={index}>
                                    <span className={styles.checkmark}>✓</span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <div className={styles.note}>
                            Transactions are sent through a private mempool to prevent front-running and sandwich attacks.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
