/**
 * TransactionStatusCard - 交易状态卡片
 * 显示交易执行的实时状态，支持叠加在其他卡片下方
 * 支持深/浅主题模式
 */

import React, { useState, useEffect } from 'react';
import {
    CheckCircle2,
    ShieldCheck,
    ChevronRight,
    CircleDashed,
    ArrowUpRight,
    Sparkles,
    Layers,
    XCircle,
    ExternalLink
} from 'lucide-react';
import clsx from 'clsx';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './TransactionStatusCard.module.css';

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export interface TransactionStatusCardProps {
    /** 交易状态 */
    status: TransactionStatus;
    /** 交易哈希 */
    txHash?: string;
    /** 输入Token符号 */
    tokenInSymbol?: string;
    /** 输出Token符号 */
    tokenOutSymbol?: string;
    /** 输入金额 */
    amountIn?: string;
    /** 输出金额（预估） */
    amountOut?: string;
    /** 链ID用于构建浏览器链接 */
    chainId?: number;
    /** 错误信息 */
    errorMessage?: string;
    /** 是否正在加载数据 */
    isLoading?: boolean;
}

// 交易步骤定义
const TRANSACTION_STEPS = [
    { label: "Preparing Transaction", sub: "Constructing payload...", icon: Layers },
    { label: "Sending Transaction", sub: "Broadcasting to nodes...", icon: ArrowUpRight },
    { label: "Checking Status", sub: "Waiting for confirmation...", icon: ShieldCheck }
];

// 获取区块浏览器链接
const getExplorerUrl = (chainId: number, txHash: string): string => {
    const explorers: Record<number, string> = {
        1: 'https://etherscan.io/tx/',
        8453: 'https://basescan.org/tx/',
        56: 'https://bscscan.com/tx/',
        137: 'https://polygonscan.com/tx/',
        42161: 'https://arbiscan.io/tx/',
        10: 'https://optimistic.etherscan.io/tx/',
        43114: 'https://snowtrace.io/tx/',
        900: 'https://solscan.io/tx/', // Solana
    };
    return (explorers[chainId] || 'https://etherscan.io/tx/') + txHash;
};

// 格式化哈希值显示
const formatTxHash = (hash: string): string => {
    if (!hash || hash.length < 10) return hash || '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

// 格式化Token名称（处理各种格式）
const formatTokenSymbol = (symbol?: string): string => {
    if (!symbol) return 'TOKEN';
    // 移除链后缀（如 USDC-SOL）
    const cleaned = symbol.split('-')[0];
    // 转大写
    return cleaned.toUpperCase();
};

export const TransactionStatusCard: React.FC<TransactionStatusCardProps> = ({
    status,
    txHash,
    tokenInSymbol,
    tokenOutSymbol,
    amountIn,
    amountOut,
    chainId = 1,
    errorMessage,
    isLoading = false,
}) => {
    const { resolvedTheme } = useThemeContext();
    const [currentStep, setCurrentStep] = useState(0);

    // 当status为pending时，循环显示步骤
    useEffect(() => {
        if (status === 'pending') {
            const stepTimer = setInterval(() => {
                setCurrentStep(s => (s + 1) % TRANSACTION_STEPS.length);
            }, 3000);
            return () => clearInterval(stepTimer);
        }
    }, [status]);

    // 重置步骤当状态改变
    useEffect(() => {
        if (status !== 'pending') {
            setCurrentStep(0);
        }
    }, [status]);

    const explorerUrl = txHash ? getExplorerUrl(chainId, txHash) : '';
    const formattedHash = txHash ? formatTxHash(txHash) : '';
    const tokenIn = formatTokenSymbol(tokenInSymbol);
    const tokenOut = formatTokenSymbol(tokenOutSymbol);

    const renderStatusIcon = () => {
        switch (status) {
            case 'pending':
                const StepIcon = TRANSACTION_STEPS[currentStep].icon;
                return (
                    <div className={styles.iconPending}>
                        <StepIcon className={styles.stepIcon} />
                    </div>
                );
            case 'success':
                return (
                    <div className={styles.iconSuccess}>
                        <CheckCircle2 className={styles.successCheckIcon} />
                    </div>
                );
            case 'failed':
                return (
                    <div className={styles.iconFailed}>
                        <XCircle className={styles.failedIcon} />
                    </div>
                );
            case 'cancelled':
                return (
                    <div className={styles.iconCancelled}>
                        <XCircle className={styles.cancelledIcon} />
                    </div>
                );
        }
    };

    const renderStatusText = () => {
        switch (status) {
            case 'pending':
                return (
                    <div className={styles.statusTextGroup}>
                        <p className={styles.statusLabel}>{TRANSACTION_STEPS[currentStep].label}</p>
                        <p className={styles.statusSub}>{TRANSACTION_STEPS[currentStep].sub}</p>
                    </div>
                );
            case 'success':
                return (
                    <div className={styles.statusTextGroup}>
                        <p className={clsx(styles.statusLabel, styles.successLabel)}>Transaction Successful</p>
                        <p className={clsx(styles.statusSub, styles.successSub)}>On-chain confirmation complete.</p>
                    </div>
                );
            case 'failed':
                return (
                    <div className={styles.statusTextGroup}>
                        <p className={clsx(styles.statusLabel, styles.failedLabel)}>Transaction Failed</p>
                        <p className={clsx(styles.statusSub, styles.failedSub)}>
                            {errorMessage || 'Transaction could not be completed.'}
                        </p>
                    </div>
                );
            case 'cancelled':
                return (
                    <div className={styles.statusTextGroup}>
                        <p className={clsx(styles.statusLabel, styles.cancelledLabel)}>Transaction Cancelled</p>
                        <p className={clsx(styles.statusSub, styles.cancelledSub)}>User cancelled the transaction.</p>
                    </div>
                );
        }
    };

    const renderStatusIndicator = () => {
        switch (status) {
            case 'pending':
                return <CircleDashed className={styles.spinningIcon} />;
            case 'success':
                return <Sparkles className={styles.sparkleIcon} />;
            case 'failed':
            case 'cancelled':
                return null;
        }
    };

    return (
        <div className={clsx(styles.card, styles[resolvedTheme])}>
            {/* 背景光晕效果 */}
            <div className={clsx(styles.glow, styles.glowTop)} />
            <div className={clsx(styles.glow, styles.glowBottom)} />

            {/* 交易金额区域 */}
            <div className={styles.amountSection}>
                {/* 输入金额 */}
                <div className={styles.amountBlock}>
                    <p className={styles.amountLabel}>Swap Amount</p>
                    {isLoading ? (
                        <div className={styles.skeletonAmount} />
                    ) : (
                        <p className={styles.amountValue}>
                            {amountIn || '0.00'} <span className={styles.tokenSymbol}>{tokenIn}</span>
                        </p>
                    )}
                </div>

                {/* 分隔线 */}
                <div className={styles.divider} />

                {/* 输出金额 */}
                <div className={styles.amountBlock}>
                    <p className={styles.amountLabel}>Estimated Receive</p>
                    {isLoading ? (
                        <div className={styles.skeletonAmount} />
                    ) : (
                        <p className={clsx(styles.amountValue, styles.amountValueOut)}>
                            {amountOut || '0.00'} <span className={styles.tokenSymbol}>{tokenOut}</span>
                        </p>
                    )}
                </div>
            </div>

            {/* 动态状态组件 */}
            <div className={styles.statusSection}>
                <div className={styles.statusRow}>
                    <div className={styles.statusLeft}>
                        {renderStatusIcon()}
                        {renderStatusText()}
                    </div>
                    {renderStatusIndicator()}
                </div>
            </div>

            {/* 底部哈希值区域 */}
            <div className={styles.hashSection}>
                {txHash ? (
                    <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.hashLink}
                    >
                        <span>View on Explorer</span>
                        <ExternalLink className={styles.externalIcon} />
                    </a>
                ) : (
                    <div className={styles.hashPlaceholder}>
                        <span>View Hash</span>
                        <ChevronRight className={styles.chevronIcon} />
                    </div>
                )}

                {isLoading || status === 'pending' ? (
                    <div className={styles.skeletonHash} />
                ) : txHash ? (
                    <span className={styles.hashValue}>{formattedHash}</span>
                ) : null}
            </div>
        </div>
    );
};

export default TransactionStatusCard;
