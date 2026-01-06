/**
 * Volatility Index Service
 * Fetches Bitcoin and Ethereum volatility indices
 */

export interface VolatilityData {
    bvix?: number;
    evix?: number;
}

/**
 * Get volatility index data
 * @param apiKey - CoinGecko API key (optional for free tier)
 */
export async function getVolatilityIndex(apiKey?: string): Promise<VolatilityData> {
    try {
        // Volatility calculation based on price changes
        // In production, this would fetch from a volatility API or calculate from price data
        // For now, return undefined to indicate no data (marketDataJob handles null gracefully)
        return {
            bvix: undefined,
            evix: undefined
        };
    } catch (error) {
        console.error('[Volatility] Error fetching volatility index:', error);
        return { bvix: undefined, evix: undefined };
    }
}

// Legacy aliases
export const getBitcoinVolatilityIndex = async (): Promise<number | null> => {
    const data = await getVolatilityIndex();
    return data.bvix ?? null;
};

export const getEthereumVolatilityIndex = async (): Promise<number | null> => {
    const data = await getVolatilityIndex();
    return data.evix ?? null;
};
