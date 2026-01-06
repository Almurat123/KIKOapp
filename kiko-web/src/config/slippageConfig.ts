/**
 * Dynamic Slippage Configuration
 * Auto-adjusts slippage based on market conditions
 */

export type SlippageMode = 'auto' | 'custom';

export interface SlippageConfig {
    mode: SlippageMode;
    customValue: number; // in percentage (0.5 = 0.5%)
    autoValue?: number; // calculated auto value
}

/**
 * Token risk levels based on market cap, liquidity, age
 */
export type TokenRisk = 'low' | 'medium' | 'high';

/**
 * Slippage calculation parameters
 */
export interface SlippageParams {
    amountUSD: number;
    liquidityUSD: number;
    priceImpact: number;
    tokenRisk: TokenRisk;
    networkCongestion?: number; // 0-1 scale
    volatility?: number; // 0-1 scale
}

/**
 * Slippage tiers based on risk
 */
const SLIPPAGE_TIERS = {
    low: {
        min: 0.1,
        base: 0.5,
        max: 2.0,
    },
    medium: {
        min: 0.5,
        base: 1.0,
        max: 3.0,
    },
    high: {
        min: 1.0,
        base: 2.0,
        max: 5.0,
    },
};

/**
 * Calculate dynamic slippage based on multiple factors
 */
export function calculateDynamicSlippage(params: SlippageParams): number {
    const {
        amountUSD,
        liquidityUSD,
        priceImpact,
        tokenRisk,
        networkCongestion = 0,
        volatility = 0,
    } = params;

    // Get base slippage for token risk level
    const tier = SLIPPAGE_TIERS[tokenRisk];
    let slippage = tier.base;

    // Factor 1: Transaction size vs liquidity
    const sizeRatio = amountUSD / liquidityUSD;
    if (sizeRatio > 0.1) {
        // Large trade (>10% of liquidity)
        slippage += 1.5;
    } else if (sizeRatio > 0.05) {
        // Medium trade (5-10% of liquidity)
        slippage += 0.8;
    } else if (sizeRatio > 0.01) {
        // Small-medium trade (1-5% of liquidity)
        slippage += 0.3;
    }

    // Factor 2: Price impact (already calculated by DEX)
    if (priceImpact > 5) {
        slippage += 2.0;
    } else if (priceImpact > 2) {
        slippage += 1.0;
    } else if (priceImpact > 1) {
        slippage += 0.5;
    }

    // Factor 3: Network congestion (optional)
    slippage += networkCongestion * 0.5;

    // Factor 4: Token volatility (optional)
    slippage += volatility * 1.0;

    // Clamp to tier min/max
    slippage = Math.max(tier.min, Math.min(tier.max, slippage));

    // Round to 1 decimal place
    return Math.round(slippage * 10) / 10;
}

/**
 * Determine token risk level based on characteristics
 */
export function determineTokenRisk(params: {
    marketCap?: number;
    liquidityUSD: number;
    age?: number; // days since creation
    isVerified?: boolean;
}): TokenRisk {
    const { marketCap = 0, liquidityUSD, age = 0, isVerified = false } = params;

    // High risk: Low liquidity, new token, or unverified
    if (liquidityUSD < 10000 || age < 7 || !isVerified) {
        return 'high';
    }

    // Low risk: High market cap and liquidity
    if (marketCap > 100000000 && liquidityUSD > 1000000) {
        return 'low';
    }

    // Medium risk: Everything else
    return 'medium';
}

/**
 * Get slippage recommendation message
 */
export function getSlippageRecommendation(slippage: number, risk: TokenRisk): string {
    if (slippage >= 3) {
        return `High slippage (${slippage}%) recommended for ${risk} risk token`;
    }
    if (slippage >= 1.5) {
        return `Medium slippage (${slippage}%) recommended`;
    }
    return `Low slippage (${slippage}%) - good conditions`;
}

/**
 * Convert slippage percentage to basis points
 */
export function slippageToBps(slippagePercent: number): number {
    return Math.round(slippagePercent * 100);
}

/**
 * Convert basis points to slippage percentage
 */
export function bpsToSlippage(bps: number): number {
    return bps / 100;
}

/**
 * Default slippage config
 */
export const DEFAULT_SLIPPAGE_CONFIG: SlippageConfig = {
    mode: 'auto',
    customValue: 0.5,
};
