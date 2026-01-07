import React, { useEffect, useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { ShieldCheck, Check, Loader2 } from 'lucide-react';
import { ExportWalletButton } from './ExportWalletButton';
import { walletExportApi } from '../../services/api';
import styles from './MandatoryExportModal.module.css';

interface WalletState {
    wallet: WalletWithMetadata;
    isExported: boolean;
    isLoading: boolean;
}

export const MandatoryExportModal: React.FC = () => {
    const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
    const [showModal, setShowModal] = useState(false);
    const [walletStates, setWalletStates] = useState<WalletState[]>([]);
    const [isChecking, setIsChecking] = useState(true);

    // Check which wallets need to be exported
    const checkExportStatus = useCallback(async () => {
        if (!ready || !authenticated || !user) {
            setShowModal(false);
            setIsChecking(false);
            return;
        }

        // Get all embedded wallets
        const embeddedWallets = user.linkedAccounts.filter(
            (account): account is WalletWithMetadata =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy'
        );

        if (embeddedWallets.length === 0) {
            setShowModal(false);
            setIsChecking(false);
            return;
        }

        // Check database for export records
        let exportedAddresses: string[] = [];
        try {
            const token = await getAccessToken();
            if (token) {
                const exports = await walletExportApi.getExportedWallets();
                exportedAddresses = exports.map(e => e.walletAddress.toLowerCase());
            }
        } catch (err) {
            if (import.meta.env.DEV) {
                console.warn('[MandatoryExport] Failed to fetch exports, assuming none:', err);
            }
        }

        // Build wallet states
        const states: WalletState[] = embeddedWallets.map(wallet => ({
            wallet,
            isExported: exportedAddresses.includes(wallet.address.toLowerCase()),
            isLoading: false
        }));

        setWalletStates(states);

        // Show modal if any wallet is not exported
        const hasUnexported = states.some(s => !s.isExported);
        setShowModal(hasUnexported);
        setIsChecking(false);
    }, [ready, authenticated, user, getAccessToken]);

    useEffect(() => {
        checkExportStatus();
    }, [checkExportStatus]);

    // Called when user completes the export flow (after ExportWalletButton's confirmation)
    const handleExportComplete = async (wallet: WalletWithMetadata) => {
        if (import.meta.env.DEV) {
            console.log('[MandatoryExport] Export complete for:', wallet.address);
        }

        // Mark as loading
        setWalletStates(prev => prev.map(ws =>
            ws.wallet.address === wallet.address
                ? { ...ws, isLoading: true }
                : ws
        ));

        try {
            // Record in database
            await walletExportApi.recordExport(wallet.address, wallet.chainType || 'ethereum');
            if (import.meta.env.DEV) {
                console.log('[MandatoryExport] Recorded to database');
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[MandatoryExport] Failed to record to DB:', error);
            }
            // Continue anyway - don't block user forever
        }

        // Mark as exported
        setWalletStates(prev => {
            const newStates = prev.map(ws =>
                ws.wallet.address === wallet.address
                    ? { ...ws, isExported: true, isLoading: false }
                    : ws
            );

            // Close modal if all are exported
            const allExported = newStates.every(s => s.isExported);
            if (allExported) {
                setShowModal(false);
            }

            return newStates;
        });
    };

    // Don't render anything while checking or if modal shouldn't show
    if (isChecking || !showModal) return null;

    const unexportedCount = walletStates.filter(s => !s.isExported).length;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.iconWrapper}>
                    <ShieldCheck size={32} strokeWidth={2.5} className={styles.icon} />
                </div>

                <div className={styles.content}>
                    <h2 className={styles.title}>Secure Your Wallet</h2>
                    <p className={styles.description}>
                        Please export and save your recovery phrase for each wallet below.
                    </p>
                </div>

                <div className={styles.actionArea}>
                    {walletStates.map(({ wallet, isExported, isLoading }) => (
                        <div key={wallet.address} className={styles.walletRow}>
                            {isLoading ? (
                                <div className={styles.loadingState}>
                                    <Loader2 size={18} className={styles.spinner} />
                                    Saving...
                                </div>
                            ) : isExported ? (
                                <div className={styles.confirmedBadge}>
                                    <Check size={16} />
                                    {wallet.chainType === 'ethereum' ? 'EVM' : 'SOL'} Exported
                                </div>
                            ) : (
                                <div className={styles.exportWrapper}>
                                    <ExportWalletButton
                                        chainType={wallet.chainType as 'ethereum' | 'solana'}
                                        asButton={true}
                                        onExportComplete={() => handleExportComplete(wallet)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {unexportedCount > 0 && (
                    <div className={styles.footer}>
                        <button className={styles.logoutButton} onClick={logout}>
                            Log out
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
