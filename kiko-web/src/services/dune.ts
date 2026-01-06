/**
 * Dune Analytics Service
 * Provides chain fund flow data for Market analytics
 */

export interface ChainFundFlow {
    chain: string;
    inflow: number;
    outflow: number;
    netFlow: number;
}

/**
 * Format currency values for display
 */
export function formatCurrency(value: number): string {
    if (Math.abs(value) >= 1e9) {
        return `$${(value / 1e9).toFixed(2)}B`;
    } else if (Math.abs(value) >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1e3) {
        return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
}

/**
 * Fetch chain fund flows from Dune Analytics
 * @param apiKey - Dune API key
 */
export async function getChainFundFlows(apiKey?: string): Promise<ChainFundFlow[]> {
    // If no API key, return mock data for development
    if (!apiKey) {
        return getMockChainFundFlows();
    }

    try {
        // Dune API query for chain fund flows
        // Query ID should be configured based on your Dune dashboard
        const QUERY_ID = '3847592'; // Example query ID
        const response = await fetch(
            `https://api.dune.com/api/v1/query/${QUERY_ID}/results`,
            {
                headers: {
                    'X-Dune-API-Key': apiKey,
                },
            }
        );

        if (!response.ok) {
            console.error('Dune API error:', response.status);
            return getMockChainFundFlows();
        }

        const data = await response.json();

        if (!data.result?.rows) {
            return getMockChainFundFlows();
        }

        return data.result.rows.map((row: any) => ({
            chain: row.chain || row.blockchain || 'Unknown',
            inflow: parseFloat(row.inflow || row.net_inflow || '0'),
            outflow: parseFloat(row.outflow || row.net_outflow || '0'),
            netFlow: parseFloat(row.net_flow || row.net || '0'),
        }));
    } catch (error) {
        console.error('Failed to fetch Dune data:', error);
        return getMockChainFundFlows();
    }
}

/**
 * Mock data for development/fallback
 */
function getMockChainFundFlows(): ChainFundFlow[] {
    return [
        { chain: 'ETH', inflow: 2400000000, outflow: 1800000000, netFlow: 600000000 },
        { chain: 'BSC', inflow: 890000000, outflow: 1200000000, netFlow: -310000000 },
        { chain: 'ARB', inflow: 1500000000, outflow: 980000000, netFlow: 520000000 },
        { chain: 'BASE', inflow: 780000000, outflow: 450000000, netFlow: 330000000 },
        { chain: 'OP', inflow: 420000000, outflow: 380000000, netFlow: 40000000 },
        { chain: 'SOL', inflow: 1100000000, outflow: 950000000, netFlow: 150000000 },
        { chain: 'AVAX', inflow: 320000000, outflow: 410000000, netFlow: -90000000 },
        { chain: 'MATIC', inflow: 280000000, outflow: 350000000, netFlow: -70000000 },
    ];
}
