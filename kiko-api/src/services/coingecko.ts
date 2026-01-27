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

export async function getTopGainers(apiKey?: string, limit: number = 10): Promise<any[]> {
    try {
        const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=${limit}&page=1${apiKey ? `&x_cg_demo_api_key=${apiKey}` : ''}`;
        return await unifiedApiService.fetchJson<any[]>({
            url,
            method: 'GET',
            timeout: 10000,
            endpointName: 'api.coingecko.com'
        });
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching CoinGecko top gainers', { error: error.message });
        return [];
    }
}
