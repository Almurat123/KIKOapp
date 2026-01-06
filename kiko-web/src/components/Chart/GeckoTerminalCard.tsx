import React, { useState } from 'react';
import styles from './ChartCard.module.css';

interface GeckoTerminalCardProps {
    chain: string;
    address: string; // Pool or Token address. Ideally Pool, but trying Token for ease.
}

export const GeckoTerminalCard: React.FC<GeckoTerminalCardProps> = ({ chain, address }) => {
    const [isLoading, setIsLoading] = useState(true);
    // GeckoTerminal embed URL
    const embedUrl = `https://www.geckoterminal.com/${chain}/tokens/${address}?embed=1&info=1&swaps=1`;

    return (
        <div className={styles.cardContainer}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
                </div>
            )}
            <iframe
                src={embedUrl}
                title="GeckoTerminal"
                className={styles.iframe}
                frameBorder="0"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
            />
        </div>
    );
};
