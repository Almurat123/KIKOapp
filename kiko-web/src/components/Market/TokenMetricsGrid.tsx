import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TokenMetric {
    label: string;
    value: string;
    change?: string;
    isPositive?: boolean;
}

interface TokenMetricsGridProps {
    tokenSymbol?: string;
    metrics?: TokenMetric[];
}

export const TokenMetricsGrid: React.FC<TokenMetricsGridProps> = ({
    tokenSymbol = 'ETH',
    metrics
}) => {
    // Mock data - In production, this would come from API
    const defaultMetrics: TokenMetric[] = [
        { label: 'Market Cap', value: '$452.8B', change: '+2.4%', isPositive: true },
        { label: 'Fully Diluted Valuation', value: '$452.8B', change: '+2.4%', isPositive: true },
        { label: '24h Trading Volume', value: '$18.5B', change: '-5.2%', isPositive: false },
        { label: 'Circulating Supply', value: '120.2M ETH', change: '+0.1%', isPositive: true },
        { label: 'Total Supply', value: '120.2M ETH' },
        { label: 'Max Supply', value: 'Unlimited' },
        { label: 'Total Treasury Holding', value: '$2.4B' },
        { label: 'Holding', value: '450K Addresses' },
    ];

    const displayMetrics = metrics || defaultMetrics;

    return (
        <div className={styles.statsRow} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {displayMetrics.map((metric, i) => (
                <div key={i} className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <span>{metric.label}</span>
                    </div>
                    <div className={styles.metricValue} style={{ fontSize: '1.5rem' }}>
                        {metric.value}
                    </div>
                    {metric.change && (
                        <div className={styles.metricChange}>
                            {metric.isPositive ? (
                                <TrendingUp size={14} className={styles.positive} />
                            ) : (
                                <TrendingDown size={14} className={styles.negative} />
                            )}
                            <span className={metric.isPositive ? styles.positive : styles.negative}>
                                {metric.change}
                            </span>
                            <span className={styles.metricLabel}>24h</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
