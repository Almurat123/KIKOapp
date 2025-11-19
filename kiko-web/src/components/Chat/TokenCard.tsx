import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Activity } from 'lucide-react';
import styles from './Chat.module.css';

interface TokenCardProps {
    symbol: string;
    name: string;
    price: number | string;
    change24h: number;
    riskScore: number;
    liquidity?: string;
    volume24h?: string;
    recentTransactions?: Array<{
        type: 'buy' | 'sell';
        amount: string;
        price: string;
        time: string;
    }>;
}

export const TokenCard: React.FC<TokenCardProps> = ({ 
    symbol, 
    name, 
    price, 
    change24h, 
    riskScore,
    liquidity,
    volume24h,
    recentTransactions = []
}) => {
    const isPositive = change24h >= 0;
    const priceStr = typeof price === 'number' ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price;

    return (
        <div className={styles.tokenCard}>
            <div className={styles.cardHeader}>
                <div className={styles.tokenInfo}>
                    <div className={styles.tokenIcon}>{symbol[0]}</div>
                    <div>
                        <div className={styles.tokenSymbol}>{symbol}</div>
                        <div className={styles.tokenName}>{name}</div>
                    </div>
                </div>
                <div className={styles.priceInfo}>
                    <div className={styles.price}>${priceStr}</div>
                    <div className={isPositive ? styles.changePos : styles.changeNeg}>
                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(change24h)}%
                    </div>
                </div>
            </div>

            {/* Market Data */}
            {(liquidity || volume24h) && (
                <div className={styles.marketDataRow}>
                    {liquidity && (
                        <div className={styles.marketDataItem}>
                            <DollarSign size={12} />
                            <span>Liquidity: {liquidity}</span>
                        </div>
                    )}
                    {volume24h && (
                        <div className={styles.marketDataItem}>
                            <Activity size={12} />
                            <span>24h Vol: {volume24h}</span>
                        </div>
                    )}
                </div>
            )}

            <div className={styles.chartPlaceholder}>
                {/* Mock Sparkline */}
                <svg viewBox="0 0 100 30" className={styles.sparkline}>
                    <path
                        d="M0,15 Q20,5 40,20 T80,10 T100,25"
                        fill="none"
                        stroke={isPositive ? "var(--accent-success)" : "var(--accent-danger)"}
                        strokeWidth="2"
                    />
                </svg>
            </div>

            {/* Recent Transactions */}
            {recentTransactions.length > 0 && (
                <div className={styles.recentTransactions}>
                    <div className={styles.transactionsHeader}>Recent Transactions</div>
                    <div className={styles.transactionsList}>
                        {recentTransactions.slice(0, 3).map((tx, i) => (
                            <div key={i} className={styles.transactionItem}>
                                <span className={styles.transactionType}>{tx.type.toUpperCase()}</span>
                                <span className={styles.transactionAmount}>{tx.amount}</span>
                                <span className={styles.transactionPrice}>@ ${tx.price}</span>
                                <span className={styles.transactionTime}>{tx.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.cardFooter}>
                <div className={styles.riskBadge}>
                    <AlertTriangle size={14} />
                    <span>Risk Score: {riskScore}/10</span>
                </div>
                <button className={styles.actionBtn}>Trade</button>
            </div>
        </div>
    );
};
