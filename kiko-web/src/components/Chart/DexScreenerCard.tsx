import React from 'react';
import { ChartEmbedCard } from './ChartEmbedCard';
import { useThemeContext } from '../../contexts/ThemeContext';

interface DexScreenerCardProps {
    chain: string;
    tokenAddress: string;
}

export const DexScreenerCard: React.FC<DexScreenerCardProps> = ({ chain, tokenAddress }) => {
    const { resolvedTheme } = useThemeContext();
    // DexScreener embed URL
    // theme=dark|light, trades=0 (to compact), info=0
    const embedUrl = `https://dexscreener.com/${chain}/${tokenAddress}?embed=1&theme=${resolvedTheme}`;

    return <ChartEmbedCard embedUrl={embedUrl} title="DexScreener" />;
};
