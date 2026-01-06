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

/**
 * Fetch price from DEX Screener
 */
async function fetchDexScreenerPrice(
    tokenAddress: string,
    chainId: number
): Promise<PriceSource | null> {
    try {
        // Map chainId to DEX Screener chain name
        const chainMap: Record<number, string> = {
            1: 'ethereum',
            56: 'bsc',
            137: 'polygon',
            8453: 'base',
            42161: 'arbitrum',
        };

        const chain = chainMap[chainId];
        if (!chain) return null;

        const response = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
        );

        if (!response.ok) return null;

        const data = await response.json();

        // Get the first pair with matching chain
        const pair = data.pairs?.find((p: any) => p.chainId === chain);
        if (!pair) return null;

        return {
            name: 'DEX Screener',
            price: parseFloat(pair.priceUsd || '0'),
            timestamp: Date.now(),
            url: `https://dexscreener.com/${chain}/${tokenAddress}`,
        };
    } catch (error) {
        console.error('[PriceValidation] DEX Screener error:', error);
        return null;
    }
}

/**
 * Fetch price from GeckoTerminal
 */
async function fetchGeckoTerminalPrice(
    tokenAddress: string,
    chainId: number
): Promise<PriceSource | null> {
    try {
        // Map chainId to GeckoTerminal network
        const networkMap: Record<number, string> = {
            1: 'eth',
            56: 'bsc',
            137: 'polygon_pos',
            8453: 'base',
            42161: 'arbitrum',
        };

        const network = networkMap[chainId];
        if (!network) return null;

        const response = await fetch(
            `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${tokenAddress}`
        );

        if (!response.ok) return null;

        const data = await response.json();
        const price = data.data?.attributes?.price_usd;

        if (!price) return null;

        return {
            name: 'GeckoTerminal',
            price: parseFloat(price),
            timestamp: Date.now(),
            url: `https://www.geckoterminal.com/${network}/tokens/${tokenAddress}`,
        };
    } catch (error) {
        console.error('[PriceValidation] GeckoTerminal error:', error);
        return null;
    }
}

/**
 * Calculate price deviation percentage
 */
function calculateDeviation(price1: number, price2: number): number {
    if (price2 === 0) return 0;
    return Math.abs((price1 - price2) / price2) * 100;
}

/**
 * Validate swap price against external sources
 */
export async function validateSwapPrice(
    tokenAddress: string,
    chainId: number,
    swapPrice: number
): Promise<PriceValidationResult> {
    // Fetch prices from multiple sources
    const [dexScreenerPrice, geckoTerminalPrice] = await Promise.all([
        fetchDexScreenerPrice(tokenAddress, chainId),
        fetchGeckoTerminalPrice(tokenAddress, chainId),
    ]);

    const externalPrices: PriceSource[] = [
        dexScreenerPrice,
        geckoTerminalPrice,
    ].filter((p): p is PriceSource => p !== null);

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
