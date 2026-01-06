/**
 * Dune Analytics Service
 * Fetches chain metrics from Dune Analytics
 */

export interface ChainMetric {
    volume24h?: number;
    txns24h?: number;
    activeWallets?: number;
    gasPrice?: string;
    contracts24h?: number;
    contracts7d?: number;
}

/**
 * Get chain metrics from Dune Analytics
 * @param apiKey - Dune API key
 * @param queryIds - Array of Dune query IDs to execute
 * @returns Map of chain name to metrics
 */
export async function getChainMetricsFromDune(
    apiKey?: string,
    queryIds?: (string | number)[]
): Promise<Map<string, ChainMetric>> {
    // If no API key or no queries, return empty map
    if (!apiKey || !queryIds || queryIds.length === 0) {
        return new Map();
    }

    try {
        // In production, this would call Dune API
        // For now, return empty map (Dune integration is optional)
        console.log('[Dune] Skipping Dune API call (not configured or disabled)');
        return new Map();
    } catch (error) {
        console.error('[Dune] Error fetching chain metrics:', error);
        return new Map();
    }
}

/**
 * Execute a Dune query and get results
 */
export async function getDuneQueryResults(queryId: string): Promise<any> {
    return null;
}
