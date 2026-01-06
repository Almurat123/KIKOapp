/**
 * Liquidity Stress Index Service
 * Measures market liquidity stress levels
 */

export interface LiquidityStressData {
    stressIndex?: number;
    status?: string;
    description?: string;
}

/**
 * Get liquidity stress data
 */
export async function getLiquidityStress(): Promise<LiquidityStressData> {
    try {
        // In production, this would calculate stress from order book depth, bid-ask spreads, etc.
        // For now, return undefined values (marketDataJob handles null gracefully)
        return {
            stressIndex: undefined,
            status: undefined,
            description: ''
        };
    } catch (error) {
        console.error('[LiquidityStress] Error fetching stress index:', error);
        return { stressIndex: undefined, status: undefined, description: '' };
    }
}

// Legacy alias
export const getLiquidityStressIndex = getLiquidityStress;
