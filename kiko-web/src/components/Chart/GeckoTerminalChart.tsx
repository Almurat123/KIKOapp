import React, { useMemo } from 'react';

// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: the token-detail route already owns token hydration. The chart
//         embed should not re-query the token-details endpoint just to recover
//         a pool address, because that duplicated read was part of the token
//         page burst.
// Goal: render the GeckoTerminal iframe only from parent-supplied data and
//       keep the chart component passive.
// Owns: iframe URL assembly and placeholder rendering for missing pool data.
// Does Not Own: token hydration, detail-route fetching, or backend lookup policy.
// Design Language:
// - child embed surfaces must stay passive
// - parent routes own data hydration and optional enrichment
// - do not call `/api/tokens/:network/:address` from the chart component
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-token-page-read-burst-isolation.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: removing child-side pool resolution from the chart component
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-token-page-read-burst-isolation.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

interface GeckoTerminalChartProps {
    chain: string;
    poolAddress?: string;
    height?: number | string;
    loading?: boolean;
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
    poolAddress: initialPoolAddress,
    height = 500,
    loading = false,
}) => {
    const resolvedPoolAddress = initialPoolAddress;

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
