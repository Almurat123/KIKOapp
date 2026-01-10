import React from 'react';
import { ChartEmbedCard } from './ChartEmbedCard';
import { useThemeContext } from '../../contexts/ThemeContext';

interface GeckoTerminalCardProps {
    chain: string;
    address: string; // Pool or Token address. Ideally Pool, but trying Token for ease.
}

export const GeckoTerminalCard: React.FC<GeckoTerminalCardProps> = ({ chain, address }) => {
    const { resolvedTheme } = useThemeContext();
    // GeckoTerminal embed URL
    // GeckoTerminal uses scheme=dark or scheme=light
    const embedUrl = `https://www.geckoterminal.com/${chain}/tokens/${address}?embed=1&info=1&swaps=1&scheme=${resolvedTheme}`;

    return <ChartEmbedCard embedUrl={embedUrl} title="GeckoTerminal" />;
};
