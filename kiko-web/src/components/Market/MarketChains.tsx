import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';
import { Activity, Layers, TrendingUp, Globe } from 'lucide-react';
import { ChainFundFlowChart } from './ChainFundFlowChart';
import { ChainStats } from './ChainStats';

export const MarketChains: React.FC = () => {
    return (
        <div className={styles.overviewContainer}>
            {/* Multi-chain Stats Row */}
            <div className={styles.statsRow}>


                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Activity size={18} className={styles.icon} />
                        <span>Active Wallets</span>
                    </div>
                    <div className={styles.metricValue}>2.4M</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+5.4%</span>
                        <span className={styles.metricLabel}>24h</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Base: +15% New Users
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Layers size={18} className={styles.icon} />
                        <span>Total TVL</span>
                    </div>
                    <div className={styles.metricValue}>$65.4B</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+1.2%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Arbitrum: $18.2B (28%)
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Globe size={18} className={styles.icon} />
                        <span>Bridge Volume (24h)</span>
                    </div>
                    <div className={styles.metricValue}>$450M</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+8.5%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Top Route: ETH -&gt; Base
                    </div>
                </div>
            </div>

            {/* Chain Comparison & Growth Row */}
            <div className={styles.mainChartRow}>
                <div className={styles.chartSection} style={{ height: '100%' }}>
                    <div className={styles.sectionTitle}>
                        <span>Chain Fund Inflows & Outflows</span>
                    </div>
                    <ChainFundFlowChart />
                </div>

                <div className={styles.metricCard} style={{ height: '100%' }}>
                    <div className={styles.sectionTitle}>
                        <TrendingUp size={18} className={styles.icon} />
                        <span>Fastest Growing (TVL)</span>
                    </div>
                    <div className={styles.tokenList}>
                        {[
                            { name: 'Base', value: '+15.2%', sub: '$4.2B TVL' },
                            { name: 'Ton', value: '+12.5%', sub: '$850M TVL' },
                            { name: 'Sui', value: '+8.4%', sub: '$620M TVL' },
                        ].map((chain, i) => (
                            <div key={i} className={styles.tokenRow}>
                                <span className={styles.tokenName}>{chain.name}</span>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <span className={styles.positive}>{chain.value}</span>
                                    <span className={styles.metricLabel}>{chain.sub}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chains Table */}
            <div className={styles.tableSection}>
                <div className={styles.sectionTitle}>
                    <Layers size={18} className={styles.icon} />
                    <span>Chain Ecosystems</span>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Chain</th>
                            <th>TVL</th>
                            <th>24h Vol</th>
                            <th>Active Wallets</th>
                            <th>Avg Gas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { name: 'Ethereum', tvl: '$45.2B', vol: '$1.2B', active: '450k', gas: '15 Gwei' },
                            { name: 'Arbitrum', tvl: '$18.2B', vol: '$850M', active: '320k', gas: '0.1 Gwei' },
                            { name: 'Base', tvl: '$4.2B', vol: '$420M', active: '280k', gas: '0.05 Gwei' },
                            { name: 'Optimism', tvl: '$3.8B', vol: '$250M', active: '150k', gas: '0.1 Gwei' },
                            { name: 'Solana', tvl: '$4.5B', vol: '$1.5B', active: '850k', gas: '0.001 SOL' },
                        ].map((chain, i) => (
                            <tr key={i}>
                                <td className={styles.tokenName}>{chain.name}</td>
                                <td>{chain.tvl}</td>
                                <td>{chain.vol}</td>
                                <td>{chain.active}</td>
                                <td>{chain.gas}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ChainStats />
        </div>
    );
};
