import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import styles from './Chat.module.css';

interface TokenCardProps {
    symbol: string;
    name: string;
    price: string;
    change24h: number;
    riskScore: number;
}

export const TokenCard: React.FC<TokenCardProps> = ({ symbol, name, price, change24h, riskScore }) => {
    const isPositive = change24h >= 0;

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
                    <div className={styles.price}>${price}</div>
                    <div className={isPositive ? styles.changePos : styles.changeNeg}>
                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(change24h)}%
                    </div>
                </div>
            </div>

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
