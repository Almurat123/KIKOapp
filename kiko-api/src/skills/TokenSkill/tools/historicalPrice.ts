import { Tool } from '../../../tools/registry.js';
import * as coinbase from '../../../services/coinbase.js';

export const GetHistoricalPriceTool: Tool = {
    definition: {
        name: 'get_historical_price',
        description: 'Get historical price for a cryptocurrency on a specific date. Use this to analyze price trends, compare prices over time, or answer "what was the price on [date]" questions. Supports dates from 2010 onwards.',
        parameters: {
            type: 'object',
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Token symbol (e.g., BTC, ETH, SOL). Case insensitive.',
                },
                date: {
                    type: 'string',
                    description: 'Date in YYYY-MM-DD format (e.g., 2024-01-01, 2023-12-25)',
                }
            },
            required: ['symbol', 'date']
        }
    },
    handler: async (args) => {
        try {
            const { symbol, date } = args;
            console.log(`[GetHistoricalPrice] Fetching ${symbol} price for ${date}...`);

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return {
                    error: `Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-01)`
                };
            }

            const result = await coinbase.getHistoricalPrice(symbol, date);

            if (!result) {
                return {
                    error: `Could not find historical price for ${symbol} on ${date}. The token may not have been listed on that date, or the date is too far in the past.`
                };
            }

            return {
                symbol: result.symbol,
                date: result.date,
                price: `$${result.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
                priceRaw: result.price,
                currency: result.currency,
                source: 'Coinbase',
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            console.error('[GetHistoricalPrice] Error:', error);
            return { error: 'Failed to fetch historical price from Coinbase' };
        }
    }
};
