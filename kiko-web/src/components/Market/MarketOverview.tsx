import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, PieChart, ArrowRight, Zap, Droplets } from 'lucide-react';
import clsx from 'clsx';

export const MarketOverview: React.FC = () => {
    return (
        <div className={styles.overviewContainer}>
            {/* Global Market Data Row */}
            <div className={styles.statsRow}>
                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <DollarSign size={18} className={styles.icon} />
                        <span>Global Market Cap</span>
                    </div>
                    <div className={styles.metricValue}>$2.45T</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+2.4%</span>
                        <span className={styles.metricLabel}>24h</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Dominance: BTC 52% • ETH 17%
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Activity size={18} className={styles.icon} />
                        <span>24h Volume</span>
                    </div>
                    <div className={styles.metricValue}>$86.2B</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+15.2%</span>
                        <span className={styles.metricLabel}>24h</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Vol/Cap: 3.5%
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Zap size={18} className={styles.icon} />
                        <span>L1/L2 Flows</span>
                    </div>
                    <div className={styles.metricValue}>+$125M</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>Net Inflow</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        L2 Leading: Arbitrum (+$45M)
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Droplets size={18} className={styles.icon} />
                        <span>Stablecoin Flows</span>
                    </div>
                    <div className={styles.metricValue}>+$500M</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>Minting</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        USDT Supply: +0.5% 7d
                    </div>
                </div>
            </div>

            {/* Sentiment & Trends Row */}
            <div className={styles.chartRow}>
                <div className={styles.sentimentCard}>
                    <div className={styles.sectionTitle}>
                        <PieChart size={18} className={styles.icon} />
                        <span>Market Sentiment</span>
                    </div>
                    <div className={styles.sentimentGauge}>
                        <div className={styles.gaugeArc}>
                            <div className={styles.gaugeFill} style={{ transform: 'rotate(130deg)' }}></div>
                        </div>
                        <div className={styles.gaugeNeedle} style={{ transform: 'rotate(45deg)' }}></div>
                        <div className={styles.sentimentScore}>72</div>
                        <div className={styles.sentimentLabel}>Greed</div>
                    </div>
                    <div className={styles.sentimentTrend}>
                        <div className={styles.trendItem}>
                            <span>Yesterday</span>
                            <span className={styles.trendValue}>65</span>
                        </div>
                        <div className={styles.trendItem}>
                            <span>Last Week</span>
                            <span className={styles.trendValue}>50</span>
                        </div>
                    </div>
                </div>

                <div className={styles.trendCard}>
                    <div className={styles.sectionTitle}>
                        <BarChart3 size={18} className={styles.icon} />
                        <span>Stablecoin Supply Trend (7d)</span>
                    </div>
                    <div className={styles.chartPlaceholder}>
                        {/* SVG Bar Chart */}
                        <svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="none">
                            {[40, 60, 45, 70, 55, 80, 65, 90, 75, 100].map((h, i) => (
                                <rect
                                    key={i}
                                    x={i * 20 + 2}
                                    y={100 - h}
                                    width="16"
                                    height={h}
                                    fill="var(--accent-primary)"
                                    opacity="0.8"
                                    rx="2"
                                />
                            ))}
                        </svg>
                    </div>
                    <div className={styles.chartLabels}>
                        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                </div>
            </div>

            {/* Gainers & Losers Row */}
            <div className={styles.listRow}>
                <div className={styles.listCard}>
                    <div className={styles.sectionTitle}>
                        <TrendingUp size={18} className={styles.icon} />
                        <span>Top Gainers (24h)</span>
                    </div>
                    <div className={styles.tokenList}>
                        {[
                            { name: 'PEPE', price: '$0.000008', change: '+15.4%' },
                            { name: 'RNDR', price: '$10.24', change: '+12.1%' },
                            { name: 'FET', price: '$2.45', change: '+8.5%' },
                            { name: 'NEAR', price: '$7.80', change: '+6.2%' },
                        ].map((token, i) => (
                            <div key={i} className={styles.tokenRow}>
                                <span className={styles.tokenName}>{token.name}</span>
                                <span className={styles.tokenPrice}>{token.price}</span>
                                <span className={styles.positive}>{token.change}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.listCard}>
                    <div className={styles.sectionTitle}>
                        <TrendingDown size={18} className={styles.icon} />
                        <span>Top Losers (24h)</span>
                    </div>
                    <div className={styles.tokenList}>
                        {[
                            { name: 'WIF', price: '$2.85', change: '-8.4%' },
                            { name: 'BONK', price: '$0.000024', change: '-6.1%' },
                            { name: 'SOL', price: '$145.20', change: '-4.5%' },
                            { name: 'JUP', price: '$1.12', change: '-3.2%' },
                        ].map((token, i) => (
                            <div key={i} className={styles.tokenRow}>
                                <span className={styles.tokenName}>{token.name}</span>
                                <span className={styles.tokenPrice}>{token.price}</span>
                                <span className={styles.negative}>{token.change}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stablecoin Analysis Link */}
            <div className={clsx(styles.metricCard, styles.fullWidth)}>
                <div className={styles.sectionTitle}>
                    <ArrowRight size={18} className={styles.icon} />
                    <span>View Detailed Stablecoin Analysis</span>
                </div>
                <div className={styles.metricSubtext}>
                    Analyze cross-chain flows and supply changes for USDT, USDC, DAI.
                </div>
            </div>
        </div>
    );
};
