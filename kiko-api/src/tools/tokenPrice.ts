import { Tool } from './registry.js';
import * as binance from '../services/binance.js';

export const GetTokenPriceTool: Tool = {
    definition: {
        name: 'get_token_price',
        description: 'Get real-time price for mainstream cryptocurrencies (BTC, ETH, SOL, BNB, etc.). Uses Binance with CoinGecko fallback.',
        parameters: {
            type: 'object',
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Token symbol (e.g., BTC, ETH, SOL, BNB, DOGE). Case insensitive.',
                }
            },
            required: ['symbol']
        }
    },
    handler: async (args) => {
        try {
            const { symbol } = args;
            console.log(`[GetTokenPrice] Fetching price for ${symbol}...`);

            // 1. Try Binance
            try {
                const result = await binance.searchTokenPrice(symbol);
                if (result) {
                    return {
                        symbol: result.symbol,
                        price: `$${result.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
                        priceRaw: result.price,
                        source: 'Binance Spot',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn('[GetTokenPrice] Binance failed:', e);
            }

            // 2. Fallback: CoinGecko Simple Price (Mock/Fetch)
            // Ideally we use a service wrapper, but for now we fallback to a simple fetch if possible, 
            // or just use DexScreener if we can guess the address. 
            // Since we only have symbol, standard CoinGecko search is needed.

            // For now, let's try a simple fetch to CoinGecko public API
            try {
                console.log('[GetTokenPrice] Fallback to CoinGecko...');
                const coinListRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${symbol}`);
                const coinList = await coinListRes.json() as any;

                if (coinList.coins && coinList.coins.length > 0) {
                    const coinId = coinList.coins[0].id; // Top result
                    const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
                    const priceData = await priceRes.json() as any;

                    if (priceData[coinId]?.usd) {
                        return {
                            symbol: symbol.toUpperCase(),
                            price: `$${priceData[coinId].usd}`,
                            priceRaw: priceData[coinId].usd,
                            source: 'CoinGecko',
                            timestamp: new Date().toISOString()
                        };
                    }
                }
            } catch (cgError) {
                console.warn('[GetTokenPrice] CoinGecko failed:', cgError);
            }

            return {
                error: `Could not find price for ${symbol} on Binance or CoinGecko.`
            };
        } catch (error: any) {
            console.error('[GetTokenPrice] Error:', error);
            return { error: 'Failed to fetch token price' };
        }
    }
};
