import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as unifiedApiService from '../config/unifiedApiService.js';


const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

export async function getMarketOverview(apiKey?: string) {
    try {
        const url = `${COINGECKO_BASE_URL}/global${apiKey ? `?x_cg_demo_api_key=${apiKey}` : ''}`;
        const data = await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            timeout: 10000,
            endpointName: 'api.coingecko.com'
        });
        const globalData = data.data;

        return {
            globalMarketCap: globalData.total_market_cap.usd,
            volume24h: globalData.total_volume.usd,
            bitcoinDominance: globalData.market_cap_percentage.btc,
            activeUsers: globalData.active_cryptocurrencies,
            mcapChange24h: globalData.market_cap_change_percentage_24h_usd,
            ethGasPrice: undefined // CoinGecko doesn't provide gas price directly in global
        };
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching CoinGecko market overview', { error: error.message });
        return { globalMarketCap: 0, volume24h: 0, bitcoinDominance: 0, activeUsers: 0, ethGasPrice: undefined };
    }
}

export async function getTrendingTokens(apiKey?: string) {
    try {
        const url = `${COINGECKO_BASE_URL}/search/trending${apiKey ? `?x_cg_demo_api_key=${apiKey}` : ''}`;
        return await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            timeout: 10000,
            endpointName: 'api.coingecko.com'
        });
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching CoinGecko trending tokens', { error: error.message });
        return { coins: [] };
    }
}

// List of stablecoin symbols to filter out
const STABLECOIN_SYMBOLS = new Set([
    'usdt', 'usdc', 'dai', 'busd', 'tusd', 'frax', 'lusd', 'usdp', 'gusd',
    'usdd', 'fdusd', 'pyusd', 'eurc', 'eurs', 'susd', 'mim', 'alusd', 'crvusd',
    'gho', 'usdj', 'tribe', 'fei', 'ust', 'ustc', 'husd', 'cusd', 'dola',
    'ousd', 'flexusd', 'usdn', 'xsgd', 'bidr', 'idrt', 'jpy', 'eur', 'gbp',
    'usdx', 'musd', 'vai', 'eurt', 'usdk', 'xusd', 'esd', 'bac', 'dusd'
]);

export async function getTopGainers(apiKey?: string, limit: number = 10): Promise<any[]> {
    try {
        // Fetch more coins to filter stablecoins and still have enough gainers
        const fetchLimit = Math.max(limit * 5, 50);
        const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=${fetchLimit}&page=1&sparkline=true${apiKey ? `&x_cg_demo_api_key=${apiKey}` : ''}`;
        const coins = await unifiedApiService.fetchJson<any[]>({
            url,
            method: 'GET',
            timeout: 10000,
            endpointName: 'api.coingecko.com'
        });

        // Filter out stablecoins
        const filteredCoins = coins.filter((coin: any) => {
            const symbol = (coin.symbol || '').toLowerCase();
            const name = (coin.name || '').toLowerCase();

            // Skip if symbol is a known stablecoin
            if (STABLECOIN_SYMBOLS.has(symbol)) return false;

            // Skip if name contains "USD" or common stablecoin patterns
            if (name.includes('tether') || name.includes('usd coin') ||
                name.includes('stablecoin') || name.includes('dollar')) return false;

            // Skip coins with very low price change (likely stablecoins)
            const priceChange = Math.abs(coin.price_change_percentage_24h || 0);
            if (priceChange < 0.5) return false;

            return true;
        });

        logger.info(LogCode.API_RATE_LIMIT, `Top gainers: fetched ${coins.length}, filtered to ${filteredCoins.length} (removed stablecoins)`);

        return filteredCoins.slice(0, limit);
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching CoinGecko top gainers', { error: error.message });
        return [];
    }
}
