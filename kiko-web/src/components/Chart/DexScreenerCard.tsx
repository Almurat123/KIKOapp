import React from 'react';
import { ChartEmbedCard } from './ChartEmbedCard';

interface DexScreenerCardProps {
    chain: string;
    tokenAddress: string;
}

export const DexScreenerCard: React.FC<DexScreenerCardProps> = ({ chain, tokenAddress }) => {
    // DexScreener embed URL
    // theme=dark, trades=0 (to compact), info=0
    const embedUrl = `https://dexscreener.com/${chain}/${tokenAddress}?embed=1&theme=dark`;

    return <ChartEmbedCard embedUrl={embedUrl} title="DexScreener" />;
};
