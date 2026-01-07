import React, { useState } from 'react';
import { DexScreenerCard } from './DexScreenerCard';
import { GeckoTerminalCard } from './GeckoTerminalCard';
import styles from './UnifiedChartCard.module.css';

interface UnifiedChartCardProps {
    chain?: string;
    tokenAddress?: string;
    initialTab?: 'dex' | 'gecko';
}

export const UnifiedChartCard: React.FC<UnifiedChartCardProps> = ({
    chain = 'ethereum',
    tokenAddress = '',
    initialTab = 'dex'
}) => {
    const [activeTab, setActiveTab] = useState<'dex' | 'gecko'>(initialTab);

    return (
        <div className={styles.unifiedContainer}>
            <div className={styles.header}>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'dex' ? styles.active : ''}`}
                        onClick={() => setActiveTab('dex')}
                    >
                        DexScreener
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'gecko' ? styles.active : ''}`}
                        onClick={() => setActiveTab('gecko')}
                    >
                        GeckoTerminal
                    </button>
                </div>
            </div>
            <div className={styles.content}>
                {activeTab === 'dex' ? (
                    <DexScreenerCard chain={chain} tokenAddress={tokenAddress} />
                ) : (
                    <GeckoTerminalCard chain={chain} address={tokenAddress} />
                )}
            </div>
        </div>
    );
};
