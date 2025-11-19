import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import styles from '../../pages/MarketDataPage.module.css';
import clsx from 'clsx';

export const MarketRisk: React.FC = () => {
    return (
        <div className={styles.grid}>
            {/* Risk Radar */}
            <div className={styles.riskRadarCard}>
                <div className={styles.sectionTitle}>Risk Radar</div>
                <div className={styles.radarPlaceholder}>
                    {/* CSS Radial Mock */}
                    <div className={styles.radarCircle}>
                        <div className={styles.radarAxis} />
                        <div className={styles.radarAxis} style={{ transform: 'rotate(60deg)' }} />
                        <div className={styles.radarAxis} style={{ transform: 'rotate(120deg)' }} />
                        <div className={styles.radarShape} />
                    </div>
                    <div className={styles.radarLabels}>
                        <span>Liquidity</span>
                        <span>Vol</span>
                        <span>Price</span>
                    </div>
                </div>
            </div>

            {/* Risk Detections */}
            <div className={styles.detectionsCard}>
                <div className={styles.sectionTitle}>Risk Detections</div>
                <div className={styles.detectionList}>
                    {[
                        { name: 'Price Data Availability', status: 'pass' },
                        { name: 'Liquidity Sufficiency', status: 'pass' },
                        { name: 'Volume Sufficiency', status: 'pass' },
                        { name: 'Tax / Fees', status: 'pass' },
                        { name: 'Contract Locked', status: 'pass' },
                        { name: 'Price Deviation > 50%', status: 'fail', msg: 'Trading Prohibited' },
                    ].map((check, i) => (
                        <div key={i} className={styles.detectionItem}>
                            <div className={styles.detectionInfo}>
                                {check.status === 'pass' ? (
                                    <CheckCircle2 size={16} color="var(--accent-success)" />
                                ) : (
                                    <ShieldAlert size={16} color="var(--accent-danger)" />
                                )}
                                <span>{check.name}</span>
                            </div>
                            {check.msg && (
                                <span className={styles.detectionMsg}>{check.msg}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
