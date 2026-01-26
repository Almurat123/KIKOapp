/**
 * Price Validation Service
 * Compares swap quotes against external price sources
 * Blocks trades with >50% price deviation
 */

export interface PriceSource {
    name: string;
    price: number;
    timestamp: number;
    url?: string;
}

export interface PriceValidationResult {
    isValid: boolean;
    deviation: number; // percentage
    swapPrice: number;
    externalPrices: PriceSource[];
    averageExternalPrice: number;
    recommendation: 'safe' | 'warning' | 'blocked';
}

/**
 * Deviation thresholds
 */
const DEVIATION_THRESHOLDS = {
    SAFE: 10, // < 10% deviation
    WARNING: 20, // 10-20% deviation
    DANGEROUS: 50, // 20-50% deviation
    BLOCKED: 50, // > 50% deviation (block trade)
};

import { tokenApi } from './api';

function calculateDeviation(priceA: number, priceB: number): number {
    if (priceB === 0) return 0;
    return Math.abs((priceA - priceB) / priceB) * 100;
}

/**
 * Fetch reference price from centralized API (Unified Source)
 */
async function fetchReferencePrice(
    tokenAddress: string,
    chainId: number
): Promise<PriceSource | null> {
    try {
        const network = getMappingNetwork(chainId);
        const details = await tokenApi.getDetails(network, tokenAddress);

        if (details && details.price) {
            return {
                name: 'Market Price (Centralized)',
                price: details.price,
                timestamp: Date.now(),
                url: undefined
            };
        }
        return null;
    } catch (error) {
        console.error('[PriceValidation] API error:', error);
        return null;
    }
}

function getMappingNetwork(chainId: number): string {
    const map: Record<number, string> = {
        1: 'eth',
        56: 'bsc',
        137: 'polygon',
        8453: 'base',
        42161: 'arbitrum',
        900: 'solana'
    };
    return map[chainId] || 'eth';
}

/**
 * Validate swap price against external sources
 */
export async function validateSwapPrice(
    tokenAddress: string,
    chainId: number,
    swapPrice: number
): Promise<PriceValidationResult> {
    // Fetch reference price from backend (which aggregates sources)
    const referencePrice = await fetchReferencePrice(tokenAddress, chainId);

    const externalPrices: PriceSource[] = referencePrice ? [referencePrice] : [];

    // If no external prices available, allow trade (can't validate)
    if (externalPrices.length === 0) {
        return {
            isValid: true,
            deviation: 0,
            swapPrice,
            externalPrices: [],
            averageExternalPrice: 0,
            recommendation: 'safe',
        };
    }

    // Calculate average external price
    const averageExternalPrice =
        externalPrices.reduce((sum, p) => sum + p.price, 0) / externalPrices.length;

    // Calculate deviation
    const deviation = calculateDeviation(swapPrice, averageExternalPrice);

    // Determine recommendation
    let recommendation: 'safe' | 'warning' | 'blocked' = 'safe';
    let isValid = true;

    if (deviation > DEVIATION_THRESHOLDS.BLOCKED) {
        recommendation = 'blocked';
        isValid = false;
    } else if (deviation > DEVIATION_THRESHOLDS.WARNING) {
        recommendation = 'warning';
    }

    return {
        isValid,
        deviation,
        swapPrice,
        externalPrices,
        averageExternalPrice,
        recommendation,
    };
}

/**
 * Get deviation message for UI
 */
export function getDeviationMessage(result: PriceValidationResult): string {
    const { deviation, recommendation } = result;

    if (recommendation === 'blocked') {
        return `⛔ Price deviation too high (${deviation.toFixed(1)}%). Trade blocked for your safety.`;
    }

    if (recommendation === 'warning') {
        return `⚠️ High price deviation (${deviation.toFixed(1)}%). Please review carefully.`;
    }

    return `✅ Price validated (${deviation.toFixed(1)}% deviation)`;
}
