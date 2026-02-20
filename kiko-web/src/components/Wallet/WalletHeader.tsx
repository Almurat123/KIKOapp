import React from 'react';
import { Settings, Send, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';
import { ChainSwitcher } from '../Chain/ChainSwitcher';
import { Skeleton } from '../Skeleton';
import { agentAttrs } from '../../agent/attrs';

interface WalletHeaderProps {
    user: any;
    loading: boolean;
    totalValue: string;
    onSettingsClick: () => void;
    onSendClick: () => void;
    onReceiveClick: () => void;
    onSwapClick: () => void;
    styles: any;
}

// [Logic]: Extract header UI to reduce main page complexity.
// [Ref]: Migrated from WalletPage.tsx:L828-L909.
export const WalletHeader: React.FC<WalletHeaderProps> = ({
    loading, totalValue, onSettingsClick, onSendClick, onReceiveClick, onSwapClick, styles
}) => {

    return (
        <>
            <div className={styles.headerSection}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIdentity}>
                        <div className={styles.headerUserText}>
                            <div className={styles.portfolioLabel}>Total Balance</div>
                            {loading ? <Skeleton variant="text" width={150} height={32} /> : <div className={styles.portfolioValue}>{totalValue}</div>}
                        </div>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <ChainSwitcher />
                    <button
                        className={styles.settingsButton}
                        {...agentAttrs({ id: 'wallet.header.settings', role: 'button', action: 'navigate', page: 'wallet' })}
                        onClick={onSettingsClick}
                    >
                        <Settings size={16} />
                    </button>
                </div>
            </div>
            <div className={styles.actionsRow}>
                <button
                    className={`${styles.actionButton} ${styles.actionBtnSecondary}`}
                    {...agentAttrs({ id: 'wallet.header.send', role: 'button', action: 'open', page: 'wallet' })}
                    onClick={onSendClick}
                >
                    <Send size={18} /> Send
                </button>
                <button
                    className={`${styles.actionButton} ${styles.actionBtnSecondary}`}
                    {...agentAttrs({ id: 'wallet.header.receive', role: 'button', action: 'open', page: 'wallet' })}
                    onClick={onReceiveClick}
                >
                    <ArrowDownLeft size={18} /> Receive
                </button>
                <button
                    className={`${styles.actionButton} ${styles.actionBtnPrimary}`}
                    {...agentAttrs({ id: 'wallet.header.swap', role: 'button', action: 'open', page: 'wallet' })}
                    onClick={onSwapClick}
                >
                    <ArrowRightLeft size={18} /> Swap
                </button>
            </div>
        </>
    );
};
