import { Tool } from '../../../tooling/registry.js';
import * as coinbase from '../../../services/coinbase.js';
import { fetchJson } from '../../../config/unifiedApiService.js';

export const GetTokenPriceTool: Tool = {
    definition: {
        name: 'get_token_price',
        description: 'Get real-time price for mainstream cryptocurrencies (BTC, ETH, SOL, USDC, etc.). Uses Coinbase with CoinGecko fallback.',
        parameters: {
            type: 'object',
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Token symbol (e.g., BTC, ETH) or contract address (0x..., Solana mint). Case insensitive.',
                }
            },
            required: ['symbol']
        }
    },
    handler: async (args) => {
        try {
            // Support both 'symbol' (Node.js native) and 'symbol_or_address' (Python/Grok)
            const symbol = args.symbol || args.symbol_or_address;

            if (!symbol) {
                return { error: 'Missing required argument: symbol or symbol_or_address' };
            }
            const isAddress = (symbol.startsWith('0x') && symbol.length === 42) || (symbol.length > 40 && !symbol.startsWith('0x'));

            console.log(`[GetTokenPrice] Fetching price for ${symbol} (isAddress: ${isAddress})...`);

            if (isAddress) {
                const { findTokenOnAnyChain } = await import('../../../services/ai/tokenDetector.js');
                const tokenInfo = await findTokenOnAnyChain(symbol);
                if (tokenInfo && tokenInfo.price) {
                    return {
                        symbol: tokenInfo.symbol,
                        name: tokenInfo.name,
                        address: tokenInfo.address,
                        chain: tokenInfo.chainName,
                        price: `$${tokenInfo.price < 0.01 ? tokenInfo.price.toFixed(8) : tokenInfo.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
                        priceRaw: tokenInfo.price,
                        marketCap: tokenInfo.marketCap ? `$${tokenInfo.marketCap.toLocaleString()}` : undefined,
                        source: 'On-Chain (DexScreener/Gecko)',
                        timestamp: new Date().toISOString()
                    };
                }
                return { error: `Could not find price for address ${symbol}` };
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
