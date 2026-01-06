import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useExportWallet } from '@privy-io/react-auth/solana';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import styles from '../../pages/WalletPage.module.css';
import cardStyles from './ExportWalletButton.module.css';

interface ExportWalletButtonProps {
    chainType: 'ethereum' | 'solana';
    asMenuItem?: boolean;
    asCard?: boolean;
    asButton?: boolean;
    onMenuItemClick?: () => void;
    onExportComplete?: () => void;
}

/**
 * ExportWalletButton - 允许用户导出其 Privy 嵌入式钱包的私钥
 * 
 * 安全警告：导出私钥存在安全风险，应谨慎使用
 */
export const ExportWalletButton: React.FC<ExportWalletButtonProps> = ({
    chainType,
    asMenuItem = false,
    asCard = false,
    asButton = false,
    onMenuItemClick,
    onExportComplete
}) => {
    const { ready, authenticated, user, exportWallet: exportEvmWallet } = usePrivy();
    const { exportWallet: exportSolanaWallet } = useExportWallet();
    const [showWarning, setShowWarning] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    // Check if user is authenticated
    const isAuthenticated = ready && authenticated;

    // Check if user has an embedded wallet of the specified chain type
    const hasEmbeddedWallet = user?.linkedAccounts?.find(
        (account): account is WalletWithMetadata =>
            account.type === 'wallet' &&
            account.walletClientType === 'privy' &&
            account.chainType === chainType
    );

    const handleExport = async () => {
        if (confirmText !== 'Confirm') return;

        setShowWarning(false);
        setConfirmText('');

        // Notify parent IMMEDIATELY - don't wait for Privy modal
        // This is because Privy's exportWallet() doesn't provide a reliable completion callback
        if (onExportComplete) {
            onExportComplete();
        }

        try {
            if (chainType === 'ethereum') {
                await exportEvmWallet();
            } else {
                await exportSolanaWallet();
            }
        } catch (error) {
            console.error('Failed to export wallet:', error);
        }
    };

    // When used as a standalone button (asButton), trust the parent component's wallet check
    // Otherwise, verify authentication and wallet existence
    if (!asButton && (!isAuthenticated || !hasEmbeddedWallet)) {
        return null;
    }

    const warningModalStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    };

    const warningContentStyle: React.CSSProperties = {
        background: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center',
        border: '1px solid var(--border-color)',
        boxShadow: 'none',
        color: 'var(--text-primary)',
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px',
        margin: '16px 0',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
    };

    const handleClick = () => {
        setShowWarning(true);
        if (asMenuItem && onMenuItemClick) {
            onMenuItemClick();
        }
    };

    const buttonText = `Export Recovery Phrase ${chainType === 'ethereum' ? 'EVM' : 'SOL'}`;

    return (
        <>
            <button
                className={
                    asButton
                        ? cardStyles.recoveryButton
                        : asCard
                            ? cardStyles.recoveryCardBtn
                            : asMenuItem
                                ? styles.settingsMenuItem
                                : styles.recoveryBtn
                }
                onClick={handleClick}
                title={`Export ${chainType === 'ethereum' ? 'EVM' : 'Solana'} Recovery Phrase`}
            >
                {asButton ? (
                    buttonText
                ) : asCard ? (
                    <div className={cardStyles.cardContent}>
                        <div className={cardStyles.cardHeader}>
                            <span className={cardStyles.cardTitle}>Recovery Phrase</span>
                            <span className={cardStyles.cardChain}>{chainType === 'ethereum' ? 'EVM' : 'SOL'}</span>
                        </div>
                        <p className={cardStyles.cardDescription}>
                            Export your {chainType === 'ethereum' ? 'EVM' : 'Solana'} wallet recovery phrase
                        </p>
                    </div>
                ) : asMenuItem ? (
                    <>
                        Recovery Phrase
                        <span className={styles.chainLabel}>
                            {chainType === 'ethereum' ? 'EVM' : 'SOL'}
                        </span>
                    </>
                ) : (
                    chainType === 'ethereum' ? 'EVM' : 'SOL'
                )}
            </button>

            {showWarning && (
                <div style={warningModalStyle} onClick={() => setShowWarning(false)}>
                    <div style={warningContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h3 style={{ color: 'var(--text-primary)', margin: '0 0 12px 0', fontSize: '18px' }}>
                            Security Warning
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5, fontSize: '14px' }}>
                            Exporting your private key allows anyone with access to control your wallet and funds.
                            Ensure you are in a safe environment.
                        </p>

                        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                                Type "Confirm" to continue:
                            </label>
                            <input
                                type="text"
                                style={inputStyle}
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="Confirm"
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    flex: 1,
                                }}
                                onClick={() => setShowWarning(false)}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: confirmText === 'Confirm' ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                                    color: confirmText === 'Confirm' ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                                    cursor: confirmText === 'Confirm' ? 'pointer' : 'not-allowed',
                                    fontWeight: 500,
                                    flex: 1,
                                }}
                                onClick={handleExport}
                                disabled={confirmText !== 'Confirm'}
                            >
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExportWalletButton;
