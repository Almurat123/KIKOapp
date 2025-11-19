import React from 'react';
import { Zap, Fuel, Wallet, Layers } from 'lucide-react';
import styles from '../../pages/MarketDataPage.module.css';
import clsx from 'clsx';

export const MarketChains: React.FC = () => {
    return (
        <div className={styles.grid}>
            {/* Chain Metrics */}
            <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Avg TPS</span>
                    <Zap size={16} color="var(--text-muted)" />
                </div>
                <div className={styles.metricValue}>124.5</div>
                <div className={clsx(styles.metricChange, styles.positive)}>+5%</div>
            </div>
            <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Avg Gas</span>
                    <Fuel size={16} color="var(--text-muted)" />
                </div>
                <div className={styles.metricValue}>15 Gwei</div>
                <div className={clsx(styles.metricChange, styles.negative)}>-12%</div>
            </div>
            <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Active Wallets</span>
                    <Wallet size={16} color="var(--text-muted)" />
                </div>
                <div className={styles.metricValue}>2.4M</div>
                <div className={clsx(styles.metricChange, styles.positive)}>+8%</div>
            </div>
            <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                    <span className={styles.metricTitle}>Total TVL</span>
                    <Layers size={16} color="var(--text-muted)" />
                </div>
                <div className={styles.metricValue}>$45.2B</div>
                <div className={clsx(styles.metricChange, styles.positive)}>+2%</div>
            </div>

            {/* Comparison Chart */}
            <div className={styles.chartSection}>
                <div className={styles.sectionTitle}>Chain Comparison (TVL vs Volume)</div>
                <div className={styles.comparisonChart}>
                    {['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Base'].map((chain, i) => (
                        <div key={i} className={styles.comparisonRow}>
                            <span className={styles.chainLabel}>{chain}</span>
                            <div className={styles.barGroup}>
                                <div className={styles.barPrimary} style={{ width: `${Math.random() * 80 + 20}%` }} />
                                <div className={styles.barSecondary} style={{ width: `${Math.random() * 60 + 10}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chains Table */}
            <div className={styles.tableSection}>
                <div className={styles.sectionTitle}>Chain Rankings</div>
                <table className={styles.dataTable}>
                    <thead>
                        <tr>
                            <th>Chain</th>
                            <th>TPS</th>
                            <th>Gas</th>
                            <th>Active</th>
                            <th>TVL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'Ethereum', tps: 14, gas: '15 Gwei', active: '450k', tvl: '$28B' },
                            { name: 'Arbitrum', tps: 25, gas: '0.1 Gwei', active: '120k', tvl: '$8B' },
                            { name: 'Optimism', tps: 18, gas: '0.1 Gwei', active: '85k', tvl: '$4B' },
                            { name: 'Polygon', tps: 45, gas: '25 Gwei', active: '200k', tvl: '$1B' },
                            { name: 'Base', tps: 30, gas: '0.05 Gwei', active: '150k', tvl: '$3B' },
                        ].map((chain, i) => (
                            <tr key={i}>
                                <td className={styles.chainNameCell}>
                                    <div className={styles.chainIcon} /> {chain.name}
                                </td>
                                <td>{chain.tps}</td>
                                <td>{chain.gas}</td>
                                <td>{chain.active}</td>
                                <td>{chain.tvl}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
