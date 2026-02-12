import React, { useMemo } from 'react';

interface GeckoTerminalChartProps {
    chain: string;
    address: string;
    poolAddress?: string;
    height?: number | string;
}

// Mapping from internal chain names to GeckoTerminal network slugs
const NETWORK_MAP: Record<string, string> = {
    'ethereum': 'eth',
    'eth': 'eth',
    'solana': 'solana',
    'sol': 'solana',
    'bsc': 'bsc',
    'binance': 'bsc',
    'bnb': 'bsc',
    'arbitrum': 'arbitrum',
    'arb': 'arbitrum',
    'polygon': 'polygon',
    'matic': 'polygon',
    'optimism': 'optimism',
    'op': 'optimism',
    'base': 'base',
    'avalanche': 'avax',
    'avax': 'avax',
    // Add more mappings as needed
};

export const GeckoTerminalChart: React.FC<GeckoTerminalChartProps> = ({
    chain,
    address,
    poolAddress: initialPoolAddress,
    height = 500
}) => {
    const [resolvedPoolAddress, setResolvedPoolAddress] = React.useState<string | undefined>(initialPoolAddress);
    const [loading, setLoading] = React.useState(!initialPoolAddress);

    React.useEffect(() => {
        if (!initialPoolAddress && address && chain) {
            const resolvePool = async () => {
                try {
                    setLoading(true);
                    const { tokenApi } = await import('../../services/api');
                    const normalizedChain = NETWORK_MAP[chain.toLowerCase()] || chain.toLowerCase();
                    const details = await tokenApi.getDetails(normalizedChain, address);
                    if (details?.poolAddress) {
                        setResolvedPoolAddress(details.poolAddress);
                    }
                } catch (error) {
                    console.error('[GeckoTerminalChart] Error resolving pool:', error);
                } finally {
                    setLoading(false);
                }
            };
            resolvePool();
        } else {
            setResolvedPoolAddress(initialPoolAddress);
            setLoading(false);
        }
    }, [chain, address, initialPoolAddress]);

    const embedUrl = useMemo(() => {
        if (!resolvedPoolAddress) return '';
        const network = NETWORK_MAP[chain.toLowerCase()] || chain.toLowerCase();
        return `https://www.geckoterminal.com/${network}/pools/${resolvedPoolAddress}?embed=1&info=0&swaps=0`;
    }, [chain, resolvedPoolAddress]);

    return (
        <div style={{ width: '100%', height: height, overflow: 'hidden', borderRadius: '8px', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
                <div style={{ color: '#666', fontSize: '14px' }}>Loading chart...</div>
            ) : embedUrl ? (
                <iframe
                    height="100%"
                    width="100%"
                    id="geckoterminal-embed"
                    title="GeckoTerminal Embed"
                    src={embedUrl}
                    frameBorder="0"
                    allow="clipboard-write"
                    allowFullScreen
                    style={{ border: 'none', background: 'transparent' }}
                />
            ) : (
                <div style={{ color: '#666', fontSize: '14px' }}>Chart not available for this pool</div>
            )}
        </div>
    );
};
