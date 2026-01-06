import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';
import { Search, Filter, TrendingUp, TrendingDown, BarChart3, AlertTriangle, DollarSign, Droplets, Activity } from 'lucide-react';
import clsx from 'clsx';

export const MarketTokens: React.FC = () => {
    return (
        <div className={styles.overviewContainer}>
            {/* Search & Filter Bar */}
            <div className={styles.searchBar}>
                <Search size={20} className={styles.searchIcon} />
                <input
                    type="text"
                    placeholder="Search by Token Name, Symbol, or Contract Address..."
                    className={styles.searchInput}
                />
                <button className={styles.filterBtn}>
                    <Filter size={18} />
                    Filters
                </button>
            </div>

            {/* Market Data Row */}
            <div className={styles.statsRow}>
                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <DollarSign size={18} className={styles.icon} />
                        <span>Price Info</span>
                    </div>
                    <div className={styles.metricValue}>$3,450.20</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+2.4%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        ETH / USD
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Droplets size={18} className={styles.icon} />
                        <span>Liquidity</span>
                    </div>
                    <div className={styles.metricValue}>$450M</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+1.2%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Deep Liquidity
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Activity size={18} className={styles.icon} />
                        <span>24h Volume</span>
                    </div>
                    <div className={styles.metricValue}>$1.2B</div>
                    <div className={styles.metricChange}>
                        <TrendingDown size={14} className={styles.negative} />
                        <span className={styles.negative}>-5.4%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Vol/Liq: 2.6
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <AlertTriangle size={18} className={styles.icon} />
                        <span>Risk Score</span>
                    </div>
                    <div className={styles.metricValue}>Low</div>
                    <div className={styles.metricChange}>
                        <span className={styles.metricLabel}>Score: 15/100</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Audit: Passed
                    </div>
                </div>
            </div>

            {/* Chart & Trending Row */}
            <div className={styles.mainChartRow}>
                <div className={styles.chartSection} style={{ height: '100%' }}>
                    <div className={styles.sectionTitle}>
                        <BarChart3 size={18} className={styles.icon} />
                        <span>Price Chart (ETH/USD)</span>
                    </div>
                    <div className={styles.klineChart} style={{ height: '100%', minHeight: '250px' }}>
                        {/* SVG K-Line Chart */}
                        <svg width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="none">
                            {/* Grid Lines */}
                            <line x1="0" y1="37.5" x2="400" y2="37.5" stroke="var(--text-secondary)" strokeOpacity="0.1" strokeDasharray="4 4" />
                            <line x1="0" y1="75" x2="400" y2="75" stroke="var(--text-secondary)" strokeOpacity="0.1" strokeDasharray="4 4" />
                            <line x1="0" y1="112.5" x2="400" y2="112.5" stroke="var(--text-secondary)" strokeOpacity="0.1" strokeDasharray="4 4" />

                            {[
                                { o: 40, c: 60, h: 70, l: 30 },
                                { o: 60, c: 50, h: 65, l: 45 },
                                { o: 50, c: 80, h: 85, l: 40 },
                                { o: 80, c: 70, h: 85, l: 60 },
                                { o: 70, c: 90, h: 95, l: 65 },
                                { o: 90, c: 85, h: 92, l: 80 },
                                { o: 85, c: 100, h: 105, l: 80 },
                                { o: 100, c: 95, h: 102, l: 90 },
                            ].map((k, i) => {
                                const x = i * 50 + 25;
                                const isBullish = k.c >= k.o;
                                const color = isBullish ? 'var(--accent-success)' : 'var(--accent-danger)';
                                return (
                                    <g key={i}>
                                        {/* Wick */}
                                        <line
                                            x1={x}
                                            y1={150 - k.h}
                                            x2={x}
                                            y2={150 - k.l}
                                            stroke={color}
                                            strokeWidth="1"
                                        />
                                        {/* Body */}
                                        <rect
                                            x={x - 10}
                                            y={150 - Math.max(k.o, k.c)}
                                            width="20"
                                            height={Math.abs(k.c - k.o)}
                                            fill={color}
                                            rx="1"
                                        />
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>

                <div className={styles.metricCard} style={{ height: '100%' }}>
                    <div className={styles.sectionTitle}>
                        <TrendingUp size={18} className={styles.icon} />
                        <span>Trending Now</span>
                    </div>
                    <div className={styles.tokenList}>
                        {[
                            { name: 'PEPE', price: '$0.000008', change: '+15.4%' },
                            { name: 'WIF', price: '$2.85', change: '+12.1%' },
                            { name: 'BONK', price: '$0.000024', change: '+8.5%' },
                            { name: 'FLOKI', price: '$0.00018', change: '+6.2%' },
                        ].map((token, i) => (
                            <div key={i} className={styles.tokenRow}>
                                <span className={styles.tokenName}>{token.name}</span>
                                <span className={styles.tokenPrice}>{token.price}</span>
                                <span className={styles.positive}>{token.change}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tokens Table */}
            <div className={styles.tableSection}>
                <div className={styles.sectionTitle}>
                    <Activity size={18} className={styles.icon} />
                    <span>Top Tokens by Market Cap</span>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Token</th>
                            <th>Price</th>
                            <th>24h Change</th>
                            <th>24h Volume</th>
                            <th>Liquidity</th>
                            <th>Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'Ethereum', symbol: 'ETH', price: '$3,450.20', change: '+2.4%', vol: '$15.2B', liq: '$450M', risk: 'Low' },
                            { name: 'Bitcoin', symbol: 'BTC', price: '$65,240.50', change: '+1.8%', vol: '$28.5B', liq: '$850M', risk: 'Low' },
                            { name: 'Solana', symbol: 'SOL', price: '$145.20', change: '+5.4%', vol: '$4.2B', liq: '$120M', risk: 'Med' },
                            { name: 'Pepe', symbol: 'PEPE', price: '$0.000008', change: '+15.4%', vol: '$850M', liq: '$45M', risk: 'High' },
                            { name: 'Arbitrum', symbol: 'ARB', price: '$1.12', change: '-1.2%', vol: '$250M', liq: '$85M', risk: 'Low' },
                        ].map((token, i) => (
                            <tr key={i}>
                                <td className={styles.tokenName}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span>{token.name}</span>
                                        <span className={styles.metricLabel}>{token.symbol}</span>
                                    </div>
                                </td>
                                <td>{token.price}</td>
                                <td className={token.change.startsWith('+') ? styles.positive : styles.negative}>{token.change}</td>
                                <td>{token.vol}</td>
                                <td>{token.liq}</td>
                                <td>
                                    <span className={clsx(
                                        styles.riskBadge,
                                        token.risk === 'Low' ? styles.riskLow :
                                            token.risk === 'Med' ? styles.riskMed : styles.riskHigh
                                    )}>
                                        {token.risk}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
