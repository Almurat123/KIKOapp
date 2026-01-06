import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';
import { Activity, Zap, TrendingUp, ArrowRight, DollarSign, Wallet, Globe } from 'lucide-react';
import clsx from 'clsx';

export const MarketActivity: React.FC = () => {
    return (
        <div className={styles.overviewContainer}>
            {/* Activity Stream & Trending Row */}
            <div className={styles.mainChartRow}>
                {/* Whale Transactions Stream */}
                <div className={styles.activityStream} style={{ height: '100%' }}>
                    <div className={styles.sectionTitle}>
                        <Activity size={18} className={styles.icon} />
                        <span>Whale Transactions (Live)</span>
                    </div>
                    <div className={styles.streamList}>
                        {[
                            { type: 'Buy', token: 'ETH', amount: '$12.5M', from: '0x7a...2b', to: 'Binance', time: '2m ago' },
                            { type: 'Sell', token: 'PEPE', amount: '$4.2M', from: '0x3c...9d', to: 'Uniswap', time: '5m ago' },
                            { type: 'Transfer', token: 'USDT', amount: '$50M', from: 'Tether Treasury', to: '0x1f...4a', time: '12m ago' },
                            { type: 'Buy', token: 'SOL', amount: '$8.5M', from: 'Coinbase', to: '0x9e...1c', time: '15m ago' },
                            { type: 'Mint', token: 'DAI', amount: '$25M', from: 'MakerDAO', to: '0x5b...3f', time: '22m ago' },
                        ].map((tx, i) => (
                            <div key={i} className={styles.streamItem}>
                                <div className={styles.streamIcon}>
                                    {tx.type === 'Buy' ? <TrendingUp size={16} className={styles.positive} /> :
                                        tx.type === 'Sell' ? <TrendingUp size={16} className={styles.negative} style={{ transform: 'scaleY(-1)' }} /> :
                                            <ArrowRight size={16} className={styles.neutral} />}
                                </div>
                                <div className={styles.streamDetails}>
                                    <div className={styles.streamHeader}>
                                        <span className={styles.streamType}>{tx.type} {tx.token}</span>
                                        <span className={styles.streamAmount}>{tx.amount}</span>
                                    </div>
                                    <div className={styles.streamSub}>
                                        <span>{tx.from} -&gt; {tx.to}</span>
                                        <span>{tx.time}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trending & Smart Wallets Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', height: '100%' }}>
                    <div className={styles.metricCard} style={{ flex: 1 }}>
                        <div className={styles.sectionTitle}>
                            <Zap size={18} className={styles.icon} />
                            <span>Trending on Social</span>
                        </div>
                        <div className={styles.tokenList}>
                            {[
                                { name: 'PEPE', mentions: '12.5k', sentiment: 'Bullish' },
                                { name: 'SOL', mentions: '8.2k', sentiment: 'Bullish' },
                                { name: 'WIF', mentions: '5.4k', sentiment: 'Mixed' },
                            ].map((token, i) => (
                                <div key={i} className={styles.tokenRow}>
                                    <span className={styles.tokenName}>{token.name}</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span className={styles.metricValue} style={{ fontSize: 14 }}>{token.mentions}</span>
                                        <span className={clsx(styles.metricLabel,
                                            token.sentiment === 'Bullish' ? styles.positive : styles.neutral
                                        )}>{token.sentiment}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.metricCard} style={{ flex: 1 }}>
                        <div className={styles.sectionTitle}>
                            <Wallet size={18} className={styles.icon} />
                            <span>Smart Wallet Buys (24h)</span>
                        </div>
                        <div className={styles.tokenList}>
                            {[
                                { name: 'RNDR', vol: '$2.5M', count: '15 Wallets' },
                                { name: 'FET', vol: '$1.8M', count: '12 Wallets' },
                                { name: 'LDO', vol: '$1.2M', count: '8 Wallets' },
                            ].map((token, i) => (
                                <div key={i} className={styles.tokenRow}>
                                    <span className={styles.tokenName}>{token.name}</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span className={styles.positive}>{token.vol}</span>
                                        <span className={styles.metricLabel}>{token.count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* On-chain Stats Row */}
            <div className={styles.statsRow}>
                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Globe size={18} className={styles.icon} />
                        <span>Contract Deploys</span>
                    </div>
                    <div className={styles.metricValue}>1,250</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+15%</span>
                        <span className={styles.metricLabel}>24h</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Base Leading: 450
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <DollarSign size={18} className={styles.icon} />
                        <span>DEX Volume</span>
                    </div>
                    <div className={styles.metricValue}>$4.5B</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+8.2%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Uniswap: 65% Share
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Activity size={18} className={styles.icon} />
                        <span>Gas Used</span>
                    </div>
                    <div className={styles.metricValue}>450 ETH</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.negative} style={{ transform: 'scaleY(-1)' }} />
                        <span className={styles.negative}>-12%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Low Congestion
                    </div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.sectionTitle}>
                        <Wallet size={18} className={styles.icon} />
                        <span>New Wallets</span>
                    </div>
                    <div className={styles.metricValue}>25.4k</div>
                    <div className={styles.metricChange}>
                        <TrendingUp size={14} className={styles.positive} />
                        <span className={styles.positive}>+5.4%</span>
                    </div>
                    <div className={styles.metricSubtext}>
                        Solana: +12k
                    </div>
                </div>
            </div>
        </div>
    );
};
