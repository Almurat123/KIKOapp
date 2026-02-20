import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useExportWallet } from '@privy-io/react-auth/solana';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import clsx from 'clsx';
import styles from '../../pages/WalletPage.module.css';
import cardStyles from './ExportWalletButton.module.css';
import { agentAttrs } from '../../agent/attrs';

interface ExportWalletButtonProps {
    chainType: 'ethereum' | 'solana';
    asMenuItem?: boolean;
    asCard?: boolean;
    asButton?: boolean;
    agentId?: string;
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
    agentId,
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
            if (import.meta.env.DEV) {
                console.error('Failed to export wallet:', error);
            }
        }
    };

    // When used as a standalone button (asButton), trust the parent component's wallet check
    // Otherwise, verify authentication and wallet existence
    if (!asButton && (!isAuthenticated || !hasEmbeddedWallet)) {
        return null;
    }


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
                {...(agentId ? agentAttrs({ id: agentId, role: 'button', action: 'open', page: 'settings', key: 'export_recovery_phrase' }) : {})}
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
                <div className={cardStyles.warningModalOverlay} onClick={() => setShowWarning(false)}>
                    <div className={cardStyles.warningModal} onClick={(e) => e.stopPropagation()}>
                        <div className={cardStyles.warningIcon}>⚠️</div>
                        <h3 className={cardStyles.warningTitle}>
                            Security Warning
                        </h3>
                        <p className={cardStyles.warningMessage}>
                            Exporting your private key allows anyone with access to control your wallet and funds.
                            Ensure you are in a safe environment.
                        </p>

                        <div className={cardStyles.warningInputContainer}>
                            <label className={cardStyles.warningInputLabel}>
                                Type "Confirm" to continue:
                            </label>
                            <input
                                type="text"
                                className={cardStyles.warningInput}
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="Confirm"
                                autoFocus
                                {...(agentId ? agentAttrs({ id: `${agentId}.confirm_input`, role: 'input', action: 'input', page: 'settings', key: 'confirm_text' }) : {})}
                            />
                        </div>

                        <div className={cardStyles.warningActions}>
                            <button
                                className={clsx(cardStyles.warningButton, cardStyles.warningButtonCancel)}
                                onClick={() => setShowWarning(false)}
                                {...(agentId ? agentAttrs({ id: `${agentId}.cancel`, role: 'button', action: 'close', page: 'settings' }) : {})}
                            >
                                Cancel
                            </button>
                            <button
                                className={clsx(
                                    cardStyles.warningButton,
                                    confirmText === 'Confirm' ? cardStyles.warningButtonExportEnabled : cardStyles.warningButtonExport
                                )}
                                onClick={handleExport}
                                disabled={confirmText !== 'Confirm'}
                                {...(agentId ? agentAttrs({ id: `${agentId}.confirm_export`, role: 'button', action: 'confirm', page: 'settings' }) : {})}
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
