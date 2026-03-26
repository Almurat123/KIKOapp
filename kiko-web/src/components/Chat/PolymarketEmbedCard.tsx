import React from 'react';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './PolymarketEmbedCard.module.css';

interface PolymarketEmbedCardProps {
    marketSlug: string;
}

export const PolymarketEmbedCard: React.FC<PolymarketEmbedCardProps> = ({ marketSlug }) => {
    const { resolvedTheme } = useThemeContext();
    const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
    const embedHeight = 320;
    
    // The marketSlug can be the full hash or the human-readable slug
    const embedUrl = `https://embed.polymarket.com/market?market=${marketSlug}&theme=${theme}&liveactivity=true&border=true&height=${embedHeight}`;

    return (
        <div className={styles.container} style={{ ['--polymarket-embed-height' as any]: `${embedHeight}px` }}>
            <iframe
                src={embedUrl}
                title={`Polymarket Market: ${marketSlug}`}
                className={styles.iframe}
                frameBorder="0"
                loading="eager"
            />
        </div>
    );
};

export default PolymarketEmbedCard;
