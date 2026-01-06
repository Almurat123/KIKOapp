/**
 * CoinGecko API Service
 * Used for global market data and trending tokens
 */

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

export async function getMarketOverview(apiKey?: string) {
    try {
        const url = `${COINGECKO_BASE_URL}/global${apiKey ? `?x_cg_demo_api_key=${apiKey}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
        const data = await response.json();
        const globalData = data.data;

        return {
            globalMarketCap: globalData.total_market_cap.usd,
            volume24h: globalData.total_volume.usd,
            bitcoinDominance: globalData.market_cap_percentage.btc,
            activeUsers: globalData.active_cryptocurrencies,
            ethGasPrice: undefined // CoinGecko doesn't provide gas price directly in global
        };
    } catch (error) {
        console.error('Error fetching CoinGecko market overview:', error);
        return { globalMarketCap: 0, volume24h: 0, bitcoinDominance: 0, activeUsers: 0, ethGasPrice: undefined };
    }
}

export async function getTrendingTokens(apiKey?: string) {
    try {
        const url = `${COINGECKO_BASE_URL}/search/trending${apiKey ? `?x_cg_demo_api_key=${apiKey}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching CoinGecko trending tokens:', error);
        return { coins: [] };
    }
}

export async function getTopGainers(apiKey?: string, limit: number = 10): Promise<any[]> {
    try {
        const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=${limit}&page=1${apiKey ? `&x_cg_demo_api_key=${apiKey}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching CoinGecko top gainers:', error);
        return [];
    }
}
