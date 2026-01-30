/**
 * Deribit API Service
 * Provides Bitcoin and Ethereum Volatility Index (DVOL) data
 * API Docs: https://docs.deribit.com/
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2';

export interface DvolData {
    bvix: number;  // Bitcoin Volatility Index
    evix: number;  // Ethereum Volatility Index
    timestamp: number;
}

/**
 * Get Bitcoin Volatility Index (DVOL)
 * Uses Deribit's public API - no authentication required
 */
export async function getBtcDvol(): Promise<number | null> {
    try {
        const url = `${DERIBIT_API_URL}/public/get_volatility_index_data?currency=BTC&start_timestamp=${Date.now() - 60000}&end_timestamp=${Date.now()}&resolution=1`;
        const response = await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            timeout: 10000,
            endpointName: 'deribit.com'
        });

        if (response?.result?.data && response.result.data.length > 0) {
            // DVOL data format: [timestamp, open, high, low, close]
            const latestData = response.result.data[response.result.data.length - 1];
            return latestData[4]; // close value
        }
        return null;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching BTC DVOL from Deribit', { error: error.message });
        return null;
    }
}

/**
 * Get Ethereum Volatility Index (DVOL)
 */
export async function getEthDvol(): Promise<number | null> {
    try {
        const url = `${DERIBIT_API_URL}/public/get_volatility_index_data?currency=ETH&start_timestamp=${Date.now() - 60000}&end_timestamp=${Date.now()}&resolution=1`;
        const response = await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            timeout: 10000,
            endpointName: 'deribit.com'
        });

        if (response?.result?.data && response.result.data.length > 0) {
            const latestData = response.result.data[response.result.data.length - 1];
            return latestData[4]; // close value
        }
        return null;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching ETH DVOL from Deribit', { error: error.message });
        return null;
    }
}

/**
 * Get both BTC and ETH volatility indices
 */
export async function getVolatilityIndices(): Promise<DvolData | null> {
    try {
        const [bvix, evix] = await Promise.all([
            getBtcDvol(),
            getEthDvol()
        ]);

        if (bvix === null && evix === null) {
            return null;
        }

        return {
            bvix: bvix || 0,
            evix: evix || 0,
            timestamp: Date.now()
        };
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching volatility indices', { error: error.message });
        return null;
    }
}
