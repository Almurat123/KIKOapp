import React, { useState } from 'react';
import { DexScreenerCard } from './DexScreenerCard';
import { GeckoTerminalCard } from './GeckoTerminalCard';
import styles from './UnifiedChartCard.module.css';

interface UnifiedChartCardProps {
    // Current preferred props
    chain?: string;
    tokenAddress?: string;

    // Legacy support
    address?: string;
    chainId?: number | string;

    initialTab?: 'dex' | 'gecko';
}

export const UnifiedChartCard: React.FC<UnifiedChartCardProps> = ({
    chain: propChain,
    tokenAddress: propTokenAddress,
    address,
    chainId,
    initialTab = 'dex'
}) => {
    const [activeTab, setActiveTab] = useState<'dex' | 'gecko'>(initialTab);

    // Normalize props
    const tokenAddr = propTokenAddress || address || '';

    // Convert numeric chainId to slug if needed
    const getChainSlug = (cid: number | string | undefined): string => {
        if (!cid) return propChain || 'ethereum';
        const id = typeof cid === 'string' ? parseInt(cid, 10) : cid;
        const map: Record<number, string> = {
            1: 'ethereum',
            8453: 'base',
            56: 'bsc',
            137: 'polygon',
            42161: 'arbitrum',
            10: 'optimism',
            43114: 'avalanche',
            900: 'solana',
            101: 'solana'
        };
        return map[id] || propChain || 'ethereum';
    };

    const chainSlug = getChainSlug(chainId);

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
                    <DexScreenerCard chain={chainSlug} tokenAddress={tokenAddr} />
                ) : (
                    <GeckoTerminalCard chain={chainSlug} address={tokenAddr} />
                )}
            </div>
        </div>
    );
};
