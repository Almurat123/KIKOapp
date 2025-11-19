import React from 'react';
import { ArrowRight, Wallet, Flame } from 'lucide-react';
import styles from '../../pages/MarketDataPage.module.css';

export const MarketActivity: React.FC = () => {
    return (
        <div className={styles.grid}>
            {/* Whale Stream */}
            <div className={styles.activityStream}>
                <div className={styles.sectionTitle}>Whale Transactions</div>
                <div className={styles.streamList}>
                    {[
                        { token: 'ETH', amount: '500', usd: '$1.7M', from: 'Binance', to: '0x12...4a', time: '2m ago' },
                        { token: 'USDC', amount: '5,000,000', usd: '$5M', from: '0x88...9b', to: 'Coinbase', time: '5m ago' },
                        { token: 'PEPE', amount: '1T', usd: '$800k', from: '0xab...cd', to: '0xef...12', time: '8m ago' },
                        { token: 'WBTC', amount: '25', usd: '$1.5M', from: '0x33...44', to: 'Aave', time: '12m ago' },
                    ].map((tx, i) => (
                        <div key={i} className={styles.streamItem}>
                            <div className={styles.txIcon}>
                                <Wallet size={16} />
                            </div>
                            <div className={styles.txDetails}>
                                <div className={styles.txHeader}>
                                    <span className={styles.txAmount}>{tx.amount} {tx.token}</span>
                                    <span className={styles.txUsd}>({tx.usd})</span>
                                </div>
                                <div className={styles.txPath}>
                                    {tx.from} <ArrowRight size={12} /> {tx.to}
                                </div>
                            </div>
                            <div className={styles.txTime}>{tx.time}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Trending */}
            <div className={styles.trendingSection}>
                <div className={styles.sectionTitle}>Trending Tokens</div>
                <div className={styles.trendingGrid}>
                    {[
                        { name: 'Pepe', score: 98 },
                        { name: 'Arbitrum', score: 85 },
                        { name: 'Celestia', score: 82 },
                        { name: 'Blur', score: 78 },
                    ].map((t, i) => (
                        <div key={i} className={styles.trendingCard}>
                            <div className={styles.trendingHeader}>
                                <Flame size={16} color="var(--accent-primary)" />
                                <span>{t.name}</span>
                            </div>
                            <div className={styles.trendingScore}>Score: {t.score}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
