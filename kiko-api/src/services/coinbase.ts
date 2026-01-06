/**
 * Coinbase API Service
 * Documentation: https://docs.cloud.coinbase.com/sign-in-with-coinbase/docs/api-prices
 */

const COINBASE_API_BASE_URL = 'https://api.coinbase.com/v2';

/**
 * Get spot price for a cryptocurrency pair from Coinbase
 * @param symbol - Token symbol (e.g., 'BTC', 'ETH', 'SOL')
 * @param currency - Quote currency (default: 'USD')
 */
export async function getCoinbaseSpotPrice(
    symbol: string,
    currency: string = 'USD'
): Promise<{ symbol: string; price: number; currency: string } | null> {
    try {
        const pair = `${symbol.toUpperCase()}-${currency.toUpperCase()}`;
        const url = `${COINBASE_API_BASE_URL}/prices/${pair}/spot`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`[Coinbase] API error for ${pair}: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json() as {
            data: {
                amount: string;
                base: string;
                currency: string;
            };
        };

        return {
            symbol: data.data.base,
            price: parseFloat(data.data.amount),
            currency: data.data.currency
        };
    } catch (error) {
        console.error(`[Coinbase] Error fetching price for ${symbol}:`, error);
        return null;
    }
}

/**
 * Search for a token price by symbol
 * Tries USD first, then other common currencies if needed
 */
export async function searchCoinbasePrice(tokenSymbol: string): Promise<{
    symbol: string;
    price: number;
    currency: string;
} | null> {
    const normalizedSymbol = tokenSymbol.toUpperCase();
    const currencies = ['USD', 'USDT', 'USDC'];

    for (const currency of currencies) {
        const result = await getCoinbaseSpotPrice(normalizedSymbol, currency);

        if (result) {
            return result;
        }
    }

    console.warn(`[Coinbase] Could not find price for ${tokenSymbol}`);
    return null;
}

/**
 * Get historical spot price for a specific date
 * @param symbol - Token symbol (e.g., 'BTC', 'ETH')
 * @param date - Date in YYYY-MM-DD format
 * @param currency - Quote currency (default: 'USD')
 */
export async function getHistoricalPrice(
    symbol: string,
    date: string,
    currency: string = 'USD'
): Promise<{ symbol: string; price: number; currency: string; date: string } | null> {
    try {
        const pair = `${symbol.toUpperCase()}-${currency.toUpperCase()}`;
        const url = `${COINBASE_API_BASE_URL}/prices/${pair}/spot?date=${date}`;

        console.log(`[Coinbase] Fetching historical price: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`[Coinbase] Historical price error for ${pair} on ${date}: ${response.status}`);
            return null;
        }

        const data = await response.json() as {
            data: {
                amount: string;
                base: string;
                currency: string;
            };
        };

        return {
            symbol: data.data.base,
            price: parseFloat(data.data.amount),
            currency: data.data.currency,
            date: date
        };
    } catch (error) {
        console.error(`[Coinbase] Error fetching historical price for ${symbol} on ${date}:`, error);
        return null;
    }
}
