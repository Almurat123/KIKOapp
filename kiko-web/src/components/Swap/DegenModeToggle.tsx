/**
 * Degen Mode Toggle Component
 * Enables ultra-fast trading mode with warnings
 */

import { useState } from 'react';
import styles from './DegenModeToggle.module.css';

interface DegenModeToggleProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
}

export function DegenModeToggle({ enabled, onToggle }: DegenModeToggleProps) {
    const [showWarning, setShowWarning] = useState(false);

    const handleToggle = () => {
        if (!enabled) {
            // Show warning before enabling
            setShowWarning(true);
        } else {
            // Disable immediately
            onToggle(false);
        }
    };

    const confirmEnable = () => {
        onToggle(true);
        setShowWarning(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.toggle}>
                <div className={styles.header}>
                    <div className={styles.icon}>⚡</div>
                    <div className={styles.info}>
                        <div className={styles.title}>Degen Mode</div>
                        <div className={styles.subtitle}>
                            {enabled ? 'Ultra-fast trading enabled' : 'Fast trading mode'}
                        </div>
                    </div>
                    <label className={styles.switch}>
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={handleToggle}
                        />
                        <span className={styles.slider}></span>
                    </label>
                </div>

                {enabled && (
                    <div className={styles.features}>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}>🚀</span>
                            <span>Quote refresh: 0.5s</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}>🔄</span>
                            <span>Auto-retry on failure</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}>⚡</span>
                            <span>Instant re-quote</span>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.featureIcon}>📊</span>
                            <span>Aggressive slippage (3%)</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Warning Modal */}
            {showWarning && (
                <div className={styles.modalOverlay} onClick={() => setShowWarning(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <span className={styles.warningIcon}>⚠️</span>
                            <h3>Enable Degen Mode?</h3>
                        </div>

                        <div className={styles.modalContent}>
                            <p className={styles.warningText}>
                                Degen Mode prioritizes speed over safety. This mode:
                            </p>

                            <ul className={styles.warningList}>
                                <li>Uses higher slippage (3% default)</li>
                                <li>Auto-retries failed transactions</li>
                                <li>May execute at worse prices</li>
                                <li>Refreshes quotes every 0.5s</li>
                            </ul>

                            <p className={styles.recommendation}>
                                <strong>Recommended for:</strong> Experienced traders who need maximum speed
                            </p>

                            <p className={styles.notRecommended}>
                                <strong>Not recommended for:</strong> Large trades or beginners
                            </p>
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelButton}
                                onClick={() => setShowWarning(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={confirmEnable}
                            >
                                Enable Degen Mode
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
