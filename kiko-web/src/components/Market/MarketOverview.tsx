import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from 'lucide-react';
import styles from '../../pages/MarketDataPage.module.css';
import clsx from 'clsx';

export const MarketOverview: React.FC = () => {
    return (
        <div className={styles.grid}>
            {/* Key Metrics Row */}
            <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Total Market Cap</span>
                    <Activity size={16} color="var(--text-muted)" />
                </div>
                <div className={styles.metricValue}>$2.45T</div>
                <div className={clsx(styles.metricChange, styles.positive)}>
                    <TrendingUp size={14} /> +2.4%
                </div>
            </div>

            <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>24h Volume</span>
                    <BarChart3 size={16} color="var(--text-muted)" />
                </div>
                <div className={styles.metricValue}>$86.2B</div>
                <div className={clsx(styles.metricChange, styles.positive)}>
                    <TrendingUp size={14} /> +15.8%
                </div>
            </div>

            <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Stablecoin Flows</span>
                    <DollarSign size={16} color="var(--text-muted)" />
                </div>
                <div className={styles.metricValue}>+$1.2B</div>
                <div className={clsx(styles.metricChange, styles.positive)}>
                    <TrendingUp size={14} /> +0.8%
                </div>
            </div>

            {/* Sentiment & Trends */}
            <div className={styles.sentimentCard}>
                <div className={styles.sectionTitle}>Market Sentiment</div>
                <div className={styles.sentimentGauge}>
                    <div className={styles.gaugeArc}>
                        <div className={styles.gaugeFill} style={{ transform: 'rotate(130deg)' }} />
                    </div>
                    <div className={styles.sentimentValue}>
                        <span className={styles.score}>72</span>
                        <span className={styles.label}>Greed</span>
                    </div>
                </div>
            </div>

            <div className={styles.trendCard}>
                <div className={styles.sectionTitle}>Stablecoin Supply Trend</div>
                <div className={styles.chartPlaceholder}>
                    {/* CSS Bar Chart Mock */}
                    <div className={styles.barChart}>
                        {[40, 45, 30, 50, 60, 75, 80, 70, 85, 90, 95, 100].map((h, i) => (
                            <div key={i} className={styles.bar} style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Heatmap & Gainers Row */}
            <div className={styles.heatmapSection}>
                <div className={styles.sectionTitle}>Sector Heatmap</div>
                <div className={styles.heatmapGrid}>
                    <div className={clsx(styles.heatmapItem, styles.large)} style={{ background: 'var(--accent-success)' }}>
                        <span className={styles.tokenSymbol}>ETH</span>
                        <span className={styles.tokenChange}>+5.2%</span>
                    </div>
                    <div className={styles.heatmapItem} style={{ background: 'rgba(59, 165, 93, 0.8)' }}>
                        <span className={styles.tokenSymbol}>SOL</span>
                        <span className={styles.tokenChange}>+3.1%</span>
                    </div>
                    <div className={styles.heatmapItem} style={{ background: 'rgba(228, 84, 84, 0.7)' }}>
                        <span className={styles.tokenSymbol}>BTC</span>
                        <span className={styles.tokenChange}>-0.8%</span>
                    </div>
                    <div className={styles.heatmapItem} style={{ background: 'rgba(59, 165, 93, 0.6)' }}>
                        <span className={styles.tokenSymbol}>UNI</span>
                        <span className={styles.tokenChange}>+2.4%</span>
                    </div>
                    <div className={styles.heatmapItem} style={{ background: 'rgba(228, 84, 84, 0.5)' }}>
                        <span className={styles.tokenSymbol}>XRP</span>
                        <span className={styles.tokenChange}>-1.2%</span>
                    </div>
                </div>
            </div>

            <div className={styles.listSection}>
                <div className={styles.sectionTitle}>Top Gainers</div>
                <div className={styles.tokenList}>
                    {[
                        { symbol: 'PEPE', name: 'Pepe', price: '$0.000008', change: '+12.5%' },
                        { symbol: 'ARB', name: 'Arbitrum', price: '$1.85', change: '+8.2%' },
                        { symbol: 'OP', name: 'Optimism', price: '$3.42', change: '+6.4%' },
                        { symbol: 'LDO', name: 'Lido DAO', price: '$2.95', change: '+5.8%' },
                        { symbol: 'RNDR', name: 'Render', price: '$10.20', change: '+5.1%' },
                    ].map((token, i) => (
                        <div key={i} className={styles.tokenRow}>
                            <div className={styles.tokenInfo}>
                                <div className={styles.tokenIcon}>{token.symbol[0]}</div>
                                <div className={styles.tokenNameGroup}>
                                    <span className={styles.name}>{token.symbol}</span>
                                    <span className={styles.price}>{token.price}</span>
                                </div>
                            </div>
                            <div className={clsx(styles.changeTag, styles.positive)}>
                                {token.change}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
