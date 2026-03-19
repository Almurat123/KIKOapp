import { Tool } from '../../../tooling/registry.js';
import * as coinbase from '../../../services/coinbase.js';
import { fetchJson } from '../../../config/unifiedApiService.js';

export const GetTokenPriceTool: Tool = {
    definition: {
        name: 'get_token_price',
        description: 'Get real-time price for mainstream cryptocurrencies by symbol only (BTC, ETH, SOL, USDC, etc.). Uses Coinbase with CoinGecko fallback. Do not use for contract addresses.',
        parameters: {
            type: 'object',
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Mainstream token symbol only (e.g., BTC, ETH, SOL). Case insensitive. Contract addresses are not supported.',
                },
                symbol_or_address: {
                    type: 'string',
                    description: 'Alias of symbol for Python/Grok callers. Use a mainstream symbol only; contract addresses are rejected.',
                },
                chain: {
                    type: 'string',
                    description: 'Optional blockchain network for symbol lookups where available (eth, base, bsc, solana, arbitrum, polygon, optimism, avalanche).',
                    enum: ['eth', 'solana', 'base', 'bsc', 'arbitrum', 'polygon', 'optimism', 'avalanche']
                },
                chain_id: {
                    type: 'number',
                    description: 'Optional numeric chain ID for symbol lookups where available, e.g. 1, 8453, 56, 900.',
                },
            },
            required: []
        }
    },
    handler: async (args, context) => {
        try {
            // Support both 'symbol' (Node.js native) and 'symbol_or_address' (Python/Grok)
            const symbol = args.symbol || args.symbol_or_address;

            if (!symbol) {
                return { error: 'Missing required argument: symbol or symbol_or_address' };
            }
            const isAddress = (symbol.startsWith('0x') && symbol.length === 42) || (symbol.length > 40 && !symbol.startsWith('0x'));

            console.log(`[GetTokenPrice] Fetching price for ${symbol} (isAddress: ${isAddress})...`);

            if (isAddress) {
                return {
                    error: 'get_token_price is for mainstream symbol lookups only. For contract-address tokens, use get_token_info or wallet/swap tooling instead.',
                };
            }

            // 1. Try Coinbase (Symbols only)
            try {
                const result = await coinbase.searchCoinbasePrice(symbol);
                if (result) {
                    return {
                        symbol: result.symbol,
                        price: `$${result.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
                        priceRaw: result.price,
                        source: 'Coinbase',
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (e) {
                console.warn('[GetTokenPrice] Coinbase failed:', e);
            }

            // 2. Fallback: CoinGecko
            try {
                console.log('[GetTokenPrice] Fallback to CoinGecko...');
                const coinList = await fetchJson({
                    url: `https://api.coingecko.com/api/v3/search?query=${symbol}`
                }) as any;

                if (coinList.coins && coinList.coins.length > 0) {
                    const coinId = coinList.coins[0].id; // Top result
                    const priceData = await fetchJson({
                        url: `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
                    }) as any;

                    if (priceData[coinId]?.usd) {
                        return {
                            symbol: symbol.toUpperCase(),
                            price: `$${priceData[coinId].usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
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
                error: `Could not find price for ${symbol} on Coinbase or CoinGecko.`
            };
        } catch (error: any) {
            console.error('[GetTokenPrice] Error:', error);
            return { error: 'Failed to fetch token price' };
        }
    }
};
