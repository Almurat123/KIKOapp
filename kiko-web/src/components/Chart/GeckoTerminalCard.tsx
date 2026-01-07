import React from 'react';
import { ChartEmbedCard } from './ChartEmbedCard';

interface GeckoTerminalCardProps {
    chain: string;
    address: string; // Pool or Token address. Ideally Pool, but trying Token for ease.
}

export const GeckoTerminalCard: React.FC<GeckoTerminalCardProps> = ({ chain, address }) => {
    // GeckoTerminal embed URL
    const embedUrl = `https://www.geckoterminal.com/${chain}/tokens/${address}?embed=1&info=1&swaps=1`;

    return <ChartEmbedCard embedUrl={embedUrl} title="GeckoTerminal" />;
};
