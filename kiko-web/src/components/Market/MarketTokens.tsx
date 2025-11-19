import React from 'react';
import { Search, Filter, TrendingUp } from 'lucide-react';
import styles from '../../pages/MarketDataPage.module.css';
import clsx from 'clsx';

export const MarketTokens: React.FC = () => {
    return (
        <div className={styles.grid}>
            {/* Search & Filter */}
            <div className={styles.searchBar}>
                <Search size={18} className={styles.searchIcon} />
                <input type="text" placeholder="Search tokens..." className={styles.searchInput} />
                <button className={styles.filterBtn}>
                    <Filter size={16} /> Filter
                </button>
            </div>

            {/* Price Summary & K-Line */}
            <div className={styles.priceSummaryCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>ETH Price</span>
                </div>
                <div className={styles.metricValue}>$3,450.25</div>
                <div className={clsx(styles.metricChange, styles.positive)}>+5.2%</div>
                <div className={styles.miniChart}>
                    {/* Mock Line */}
                    <svg viewBox="0 0 100 20" className={styles.sparkline}>
                        <path d="M0,10 L10,12 L20,8 L30,15 L40,10 L50,18 L60,12 L70,16 L80,5 L90,12 L100,8" fill="none" stroke="var(--accent-success)" strokeWidth="2" />
                    </svg>
                </div>
            </div>

            <div className={styles.klineCard}>
                <div className={styles.sectionTitle}>ETH/USD (1H)</div>
                <div className={styles.chartPlaceholder}>
                    <div className={styles.mockCandles}>
                        {[...Array(20)].map((_, i) => {
                            const height = Math.random() * 60 + 20;
                            const isGreen = Math.random() > 0.5;
                            return (
                                <div
                                    key={i}
                                    className={clsx(styles.candle, isGreen ? styles.greenCandle : styles.redCandle)}
                                    style={{ height: `${height}%` }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tokens Table */}
            <div className={styles.tableSection}>
                <div className={styles.sectionTitle}>All Tokens</div>
                <table className={styles.dataTable}>
                    <thead>
                        <tr>
                            <th>Token</th>
                            <th>Price</th>
                            <th>24h %</th>
                            <th>Volume</th>
                            <th>Liquidity</th>
                            <th>Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'Ethereum', symbol: 'ETH', price: '$3,450', change: '+5.2%', vol: '$12B', liq: '$400M', risk: 85 },
                            { name: 'Pepe', symbol: 'PEPE', price: '$0.000008', change: '+12.5%', vol: '$800M', liq: '$50M', risk: 45 },
                            { name: 'Arbitrum', symbol: 'ARB', price: '$1.85', change: '+8.2%', vol: '$200M', liq: '$80M', risk: 70 },
                            { name: 'Optimism', symbol: 'OP', price: '$3.42', change: '+6.4%', vol: '$150M', liq: '$60M', risk: 72 },
                            { name: 'Render', symbol: 'RNDR', price: '$10.20', change: '+5.1%', vol: '$300M', liq: '$40M', risk: 65 },
                        ].map((t, i) => (
                            <tr key={i}>
                                <td className={styles.tokenNameCell}>
                                    <div className={styles.tokenIcon}>{t.symbol[0]}</div>
                                    <div>
                                        <div className={styles.cellName}>{t.name}</div>
                                        <div className={styles.cellSymbol}>{t.symbol}</div>
                                    </div>
                                </td>
                                <td>{t.price}</td>
                                <td className={styles.positive}>{t.change}</td>
                                <td>{t.vol}</td>
                                <td>{t.liq}</td>
                                <td>
                                    <div className={styles.riskScore} style={{
                                        background: t.risk > 80 ? 'var(--accent-success)' : t.risk > 50 ? 'var(--accent-warning)' : 'var(--accent-danger)'
                                    }}>
                                        {t.risk}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
