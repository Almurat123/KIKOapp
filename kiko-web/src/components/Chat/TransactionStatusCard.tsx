import React from 'react';
import {
    CheckCircle2,
    ShieldCheck,
    ChevronRight,
    CircleDashed,
    ArrowUpRight,
    Sparkles,
    Layers,
    XCircle
} from 'lucide-react';
import clsx from 'clsx';
import { formatUnits } from 'viem';
import styles from './TransactionStatusCard.module.css';

export type TransactionStatus = 'building' | 'approving' | 'sending' | 'pending' | 'retrying' | 'success' | 'failed' | 'cancelled';

export interface TransactionStatusCardProps {
    /** 交易状态 */
    status: TransactionStatus;
    /** 交易哈希 */
    txHash?: string;
    /** 输入Token符号 */
    tokenInSymbol?: string;
    tokenInLogoURI?: string;
    /** 输出Token符号 */
    tokenOutSymbol?: string;
    tokenOutLogoURI?: string;
    /** 输入金额 */
    amountIn?: string;
    /** 输出金额（预估） */
    amountOut?: string;
    /** 输入金额原始最小单位 */
    amountInRaw?: string;
    /** 输出金额原始最小单位 */
    amountOutRaw?: string;
    /** 输入 token decimals */
    tokenInDecimals?: number;
    /** 输出 token decimals */
    tokenOutDecimals?: number;
    /** 链ID用于构建浏览器链接 */
    chainId?: number;
    /** 错误信息 */
    errorMessage?: string;
    /** 消息内容 (用于显示重试原因等) */
    message?: string;
    /** 是否正在加载数据 */
    isLoading?: boolean;
}

// 交易步骤定义
const TRANSACTION_STEPS = [
    { status: 'building', label: "Preparing Transaction", sub: "Constructing payload...", icon: Layers },
    { status: 'approving', label: "Waiting for Approval", sub: "Checking token allowance...", icon: ShieldCheck },
    { status: 'sending', label: "Sending Transaction", sub: "Broadcasting to network...", icon: ArrowUpRight },
    { status: 'pending', label: "Confirming Transaction", sub: "Waiting for confirmation...", icon: CircleDashed },
    { status: 'retrying', label: "Retrying Transaction", sub: "Adjusting slippage...", icon: Sparkles }
];

// 根据status获取步骤索引
const getStepIndex = (status: TransactionStatus): number => {
    switch (status) {
        case 'building': return 0;
        case 'approving': return 1;
        case 'sending': return 2;
        case 'pending': return 3;
        case 'retrying': return 4;
        default: return 0;
    }
};

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

const trimDisplayAmount = (value: string, maxFractionDigits = 6): string => {
    const [whole, fraction = ''] = value.split('.');
    if (!fraction) return whole;
    const trimmedFraction = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
};

const formatTokenAmount = (displayAmount?: string, rawAmount?: string, decimals?: number): string => {
    if (rawAmount && Number.isInteger(decimals) && (decimals as number) >= 0) {
        try {
            return trimDisplayAmount(formatUnits(BigInt(rawAmount), decimals as number));
        } catch {
            // Fall through to displayAmount/rawAmount
        }
    }
    if (displayAmount) {
        return trimDisplayAmount(displayAmount);
    }
    return rawAmount || '0.00';
};

const normalizeTokenIconKey = (symbol: string): string => {
    const upper = formatTokenSymbol(symbol).replace(/[^A-Z0-9]/g, '');
    const aliases: Record<string, string> = {
        WSOL: 'SOL',
        WBNB: 'BNB',
        WMATIC: 'MATIC',
        USDCE: 'USDC',
        USDBC: 'USDC',
    };
    return aliases[upper] || upper;
};

const getTokenIconUrl = (symbol: string): string | null => {
    const iconMap: Record<string, string> = {
        ETH: '/assets/tokens/eth.png',
        WETH: '/assets/tokens/eth.png',
        SOL: '/assets/tokens/sol.png',
        BNB: '/assets/tokens/bsc.png',
        MATIC: '/assets/tokens/polygon.png',
        POL: '/assets/tokens/polygon.png',
        USDC: '/assets/tokens/usdc.png',
        USDT: '/assets/tokens/usdt.png',
        BASE: '/assets/tokens/base.png',
        ARB: '/assets/tokens/arbitrum.png',
        OP: '/assets/tokens/optimism.png',
    };
    return iconMap[normalizeTokenIconKey(symbol)] || null;
};

export const TransactionStatusCard: React.FC<TransactionStatusCardProps> = ({
    status,
    txHash,
    tokenInSymbol,
    tokenInLogoURI,
    tokenOutSymbol,
    tokenOutLogoURI,
    amountIn,
    amountOut,
    amountInRaw,
    amountOutRaw,
    tokenInDecimals,
    tokenOutDecimals,
    chainId = 1,
    errorMessage,
    message, // Added missing prop
    isLoading = false,
}) => {
    // 根据实际状态获取当前步骤
    const currentStep = getStepIndex(status);

    const explorerUrl = txHash ? getExplorerUrl(chainId, txHash) : '';
    const formattedHash = txHash ? formatTxHash(txHash) : '';
    const tokenIn = formatTokenSymbol(tokenInSymbol);
    const tokenOut = formatTokenSymbol(tokenOutSymbol);
    const tokenInIcon = tokenInLogoURI || getTokenIconUrl(tokenIn);
    const tokenOutIcon = tokenOutLogoURI || getTokenIconUrl(tokenOut);
    const formattedAmountIn = formatTokenAmount(amountIn, amountInRaw, tokenInDecimals);
    const formattedAmountOut = formatTokenAmount(amountOut, amountOutRaw, tokenOutDecimals);

    return (
        <div className={styles.card}>
            {/* Ambient Background Glows */}
            <div className={clsx(styles.glow, styles.glowTop)} />
            <div className={clsx(styles.glow, styles.glowBottom)} />

            {/* Swap Amount Section */}
            <div className={styles.amountSection}>
                <div className={styles.amountBlock}>
                    <p className={styles.amountLabel}>Swap Amount</p>
                    <div className={styles.amountRow}>
                        <p className={styles.amountValue} title={formattedAmountIn}>
                            <span className={styles.amountNumber}>{formattedAmountIn}</span>
                        </p>
                        <span className={styles.tokenPill}>
                            {tokenInIcon ? (
                                <img src={tokenInIcon} alt={tokenIn} className={styles.tokenPillIcon} />
                            ) : (
                                <span className={styles.tokenPillFallback}>{tokenIn.slice(0, 1)}</span>
                            )}
                            <span className={styles.tokenSymbol}>{tokenIn}</span>
                        </span>
                    </div>
                </div>

                <div className={styles.divider} />

                <div className={styles.amountBlock}>
                    <p className={styles.amountLabel}>Receive</p>
                    {isLoading ? (
                        <div className={styles.skeletonRect} />
                    ) : (
                        <div className={styles.amountRow}>
                            <p className={clsx(styles.amountValue, styles.amountValueEst)} title={formattedAmountOut}>
                                <span className={styles.amountNumber}>{formattedAmountOut}</span>
                            </p>
                            <span className={styles.tokenPill}>
                                {tokenOutIcon ? (
                                    <img src={tokenOutIcon} alt={tokenOut} className={styles.tokenPillIcon} />
                                ) : (
                                    <span className={styles.tokenPillFallback}>{tokenOut.slice(0, 1)}</span>
                                )}
                                <span className={styles.tokenSymbol}>{tokenOut}</span>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Dynamic Status Section */}
            <div className={styles.statusSection}>
                <div className={styles.statusRow}>
                    <div className={styles.statusContent}>
                        {/* Status Icon */}
                        <div className={clsx(styles.statusIconWrapper, styles[status] || styles.pending)}>
                            {['building', 'approving', 'sending', 'pending', 'retrying'].includes(status) && (
                                status === 'approving' ? <ShieldCheck className={clsx(styles.statusIconSvg, styles.pendingIconSvg)} /> :
                                    status === 'retrying' ? <Sparkles className={clsx(styles.statusIconSvg, styles.pendingIconSvg)} /> :
                                        <Layers className={clsx(styles.statusIconSvg, styles.pendingIconSvg)} />
                            )}
                            {status === 'success' && <CheckCircle2 className={styles.statusIconSvg} />}
                            {(status === 'failed' || status === 'cancelled') && <XCircle className={styles.statusIconSvg} />}
                        </div>

                        {/* Status Text */}
                        <div className={styles.statusTextGroup}>
                            {['building', 'approving', 'sending', 'pending', 'retrying'].includes(status) ? (
                                <>
                                    <p className={clsx(styles.statusLabelText, styles.statusLabelPending)}>
                                        {TRANSACTION_STEPS[currentStep].label}
                                    </p>
                                    <p className={clsx(styles.statusSubText, styles.statusSubPending)}>
                                        {message || TRANSACTION_STEPS[currentStep].sub}
                                    </p>
                                </>
                            ) : status === 'success' ? (
                                <>
                                    <p className={clsx(styles.statusLabelText, styles.statusLabelSuccess)}>Success</p>
                                    <p className={clsx(styles.statusSubText, styles.statusSubSuccess)}>{message || 'On-chain confirmation complete.'}</p>
                                </>
                            ) : (
                                <>
                                    <p className={clsx(styles.statusLabelText, styles.statusLabelFailed)}>
                                        {status === 'cancelled' ? 'Transaction Cancelled' : 'Transaction Failed'}
                                    </p>
                                    <p className={clsx(styles.statusSubText, styles.statusSubFailed)}>
                                        {errorMessage || (status === 'cancelled' ? 'User cancelled the transaction.' : 'Transaction could not be completed.')}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Side Animation */}
                    {['building', 'approving', 'sending', 'pending', 'retrying'].includes(status) && <CircleDashed className={styles.spinLoader} />}
                    {status === 'success' && <Sparkles className={styles.sparkleAnim} />}
                </div>
            </div>

            {/* Footer Hash */}
            <div className={styles.footer}>
                <a
                    href={txHash ? explorerUrl : '#'}
                    target={txHash ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={styles.viewHashBtn}
                    onClick={(e) => !txHash && e.preventDefault()}
                >
                    <span>{txHash ? 'View Hash' : 'Processing'}</span>
                    <ChevronRight className={styles.chevronIcon} />
                </a>

                {isLoading || (status === 'pending' && !txHash) ? (
                    <div className={styles.skeletonHash} />
                ) : txHash ? (
                    <span className={styles.hashValue}>{formattedHash}</span>
                ) : null}
            </div>
        </div>
    );
};

export default TransactionStatusCard;
