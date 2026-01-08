import React, { useState } from 'react';
import styles from './ChartCard.module.css';

interface ChartEmbedCardProps {
    embedUrl: string;
    title: string;
}

/**
 * 公共的图表嵌入卡片组件，用于消除 DexScreenerCard 和 GeckoTerminalCard 的重复代码
 */
export const ChartEmbedCard: React.FC<ChartEmbedCardProps> = ({ embedUrl, title }) => {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <div className={styles.cardContainer}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full" />
                </div>
            )}
            <iframe
                src={embedUrl}
                title={title}
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




