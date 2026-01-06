import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';

export const ChainStats: React.FC = () => {
    // Mock data for demonstration; replace with real data as needed
    const stats = [
        { label: 'TVL', value: '$65.4B', change: '+1.2%', sub: 'All Chains' },
        { label: '24h Volume', value: '$450M', change: '+8.5%', sub: 'All Chains' },
        { label: 'Active Wallets', value: '2.4M', change: '+5.4%', sub: 'All Chains' },
        { label: 'Avg Gas', value: '15 Gwei', change: '+0.8%', sub: 'All Chains' },
    ];

    return (
        <div className={styles.statsRow} style={{ marginTop: '1rem' }}>
            {stats.map((s, i) => (
                <div key={i} className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <span>{s.label}</span>
                    </div>
                    <div className={styles.metricValue}>{s.value}</div>
                    <div className={styles.metricChange}>
                        <span className={styles.positive}>{s.change}</span>
                        <span className={styles.metricLabel}>{s.sub}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
