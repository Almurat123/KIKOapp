import React from 'react';
import styles from './Chat.module.css';

interface TokenCapsuleProps {
    address: string;
    symbol: string;
    chainId?: number;
}

export const TokenCapsule: React.FC<TokenCapsuleProps> = ({ address, symbol, chainId }) => {
    // Determine the Geckoterminal URL based on address and chainId
    // Default to Base (8453) if not provided, or search if chain is unknown
    const getGeckoUrl = () => {
        if (!address) return '#';

        // Map common chainIds to Gecko Terminal chain identifiers
        const chainMap: Record<number, string> = {
            1: 'eth',
            8453: 'base',
            900: 'solana', // Internal SOL identifier
            137: 'polygon',
            56: 'bsc',
            42161: 'arbitrum',
            10: 'optimism'
        };

        const chainPath = chainId ? chainMap[chainId] : 'base';

        if (chainPath === 'solana') {
            return `https://www.geckoterminal.com/solana/pools/${address}`;
        }

        return `https://www.geckoterminal.com/${chainPath || 'base'}/pools/${address}`;
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(getGeckoUrl(), '_blank', 'noopener,noreferrer');
    };

    return (
        <span
            className={styles.tokenCapsule}
            onClick={handleClick}
            title={`View ${symbol} on GeckoTerminal`}
        >
            {symbol}
        </span>
    );
};
