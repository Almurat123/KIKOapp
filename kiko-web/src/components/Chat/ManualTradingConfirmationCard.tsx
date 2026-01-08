import React, { useState } from 'react';
import { ArrowRight, TrendingUp, DollarSign, BarChart3, AlertCircle, ChevronRight } from 'lucide-react';
import styles from './Chat.module.css';
import clsx from 'clsx';

interface ManualTradingConfirmationCardProps {
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amount: string;
    currentPrice: string;
    volume24h: string;
    liquidity: string;
    marketDepth: string;
    slippage: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ManualTradingConfirmationCard: React.FC<ManualTradingConfirmationCardProps> = ({
    chain,
    tokenIn,
    tokenOut,
    amount,
    currentPrice,
    volume24h,
    liquidity,
    marketDepth,
    slippage,
    onConfirm,
    onCancel,
}) => {
    const [step] = useState<'chain' | 'token' | 'amount' | 'slippage' | 'confirm'>('confirm');

    const steps = [
        { id: 'chain', label: 'Chain', value: chain },
        { id: 'token', label: 'Token', value: `${tokenIn} → ${tokenOut}` },
        { id: 'amount', label: 'Amount', value: amount },
        { id: 'slippage', label: 'Slippage', value: slippage },
    ];

    return (
        <div className={styles.manualTradingCard}>
            <div className={styles.cardHeader}>
                <div className={styles.titleGroup}>
                    <div className={styles.tradingIcon}>
                        <ArrowRight size={18} />
                    </div>
                    <span className={styles.cardTitle}>Manual Trading Confirmation</span>
                </div>
            </div>

            <div className={styles.cardBody}>
                {/* Step Indicator */}
                <div className={styles.stepsIndicator}>
                    {steps.map((s, i) => (
                        <div key={s.id} className={styles.stepIndicatorItem}>
                            <div className={clsx(styles.stepNumber, step === s.id && styles.active)}>
                                {i + 1}
                            </div>
                            <span className={styles.stepLabel}>{s.label}</span>
                            {i < steps.length - 1 && <ChevronRight size={14} className={styles.stepArrow} />}
                        </div>
                    ))}
                </div>

                {/* Market Data */}
                <div className={styles.marketDataGrid}>
                    <div className={styles.marketDataItem}>
                        <div className={styles.marketDataIcon}>
                            <TrendingUp size={16} />
                        </div>
                        <div>
                            <div className={styles.marketDataLabel}>Current Price</div>
                            <div className={styles.marketDataValue}>{currentPrice}</div>
                        </div>
                    </div>
                    <div className={styles.marketDataItem}>
                        <div className={styles.marketDataIcon}>
                            <BarChart3 size={16} />
                        </div>
                        <div>
                            <div className={styles.marketDataLabel}>24h Volume</div>
                            <div className={styles.marketDataValue}>{volume24h}</div>
                        </div>
                    </div>
                    <div className={styles.marketDataItem}>
                        <div className={styles.marketDataIcon}>
                            <DollarSign size={16} />
                        </div>
                        <div>
                            <div className={styles.marketDataLabel}>Liquidity</div>
                            <div className={styles.marketDataValue}>{liquidity}</div>
                        </div>
                    </div>
                    <div className={styles.marketDataItem}>
                        <div className={styles.marketDataIcon}>
                            <AlertCircle size={16} />
                        </div>
                        <div>
                            <div className={styles.marketDataLabel}>Market Depth</div>
                            <div className={styles.marketDataValue}>{marketDepth}</div>
                        </div>
                    </div>
                </div>

                {/* Trading Details */}
                <div className={styles.tradingDetails}>
                    <div className={styles.detailRow}>
                        <span>Chain</span>
                        <span className={styles.detailValue}>{chain}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span>Swap</span>
                        <span className={styles.detailValue}>{tokenIn} → {tokenOut}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span>Amount</span>
                        <span className={styles.detailValue}>{amount}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span>Slippage Tolerance</span>
                        <span className={styles.detailValue}>{slippage}</span>
                    </div>
                </div>
            </div>

            <div className={styles.cardFooter}>
                <button className={styles.secondaryBtn} onClick={onCancel}>
                    Cancel
                </button>
                <button className={styles.primaryBtn} onClick={onConfirm}>
                    Confirm Trade
                </button>
            </div>
        </div>
    );
};

