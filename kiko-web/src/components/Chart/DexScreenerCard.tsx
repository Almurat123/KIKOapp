import React, { useState } from 'react';
import styles from './ChartCard.module.css';

interface DexScreenerCardProps {
    chain: string;
    tokenAddress: string;
}

export const DexScreenerCard: React.FC<DexScreenerCardProps> = ({ chain, tokenAddress }) => {
    const [isLoading, setIsLoading] = useState(true);
    // DexScreener embed URL
    // theme=dark, trades=0 (to compact), info=0
    const embedUrl = `https://dexscreener.com/${chain}/${tokenAddress}?embed=1&theme=dark`;

    return (
        <div className={styles.cardContainer}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
                </div>
            )}
            <iframe
                src={embedUrl}
                title="DexScreener"
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
