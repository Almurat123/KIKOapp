import * as unifiedApiService from '../config/unifiedApiService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export interface FearGreedData {
    value: number;
    classification: string;
}

/**
 * Fetch Crypto Fear & Greed Index from alternative.me
 * [Logic]: External API call with 10s timeout
 */
export async function fetchFearGreedIndex(): Promise<FearGreedData> {
    try {
        const url = 'https://api.alternative.me/fng/';
        const response = await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            timeout: 10000,
            endpointName: 'api.alternative.me'
        });

        if (response && response.data && response.data[0]) {
            const item = response.data[0];
            return {
                value: parseInt(item.value, 10),
                classification: item.value_classification
            };
        }

        throw new Error('Invalid response format from Alternative.me');
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Fear & Greed Index', { error: error.message });
        // Fallback to neutral
        return { value: 50, classification: 'Neutral' };
    }
}
