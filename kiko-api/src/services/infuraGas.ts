/**
 * Infura Gas API Service
 * https://docs.metamask.io/services/reference/gas-api/
 */

import { env } from '../config/env.js';

// Chain ID mapping for Infura Gas API
const CHAIN_ID_MAP: Record<string, string> = {
    eth: '1',
    ethereum: '1',
    mainnet: '1',

    polygon: '137',
    matic: '137',

    bsc: '56',
    bnb: '56',

    arbitrum: '42161',
    arb: '42161',

    optimism: '10',
    op: '10',

    base: '8453',

    avalanche: '43114',
    avax: '43114',

    linea: '59144',

    sepolia: '11155111',
};

export interface InfuraGasFee {
    suggestedMaxPriorityFeePerGas: string;
    suggestedMaxFeePerGas: string;
    minWaitTimeEstimate: number;
    maxWaitTimeEstimate: number;
}

export interface InfuraGasResponse {
    low: InfuraGasFee;
    medium: InfuraGasFee;
    high: InfuraGasFee;
    estimatedBaseFee: string;
    networkCongestion: number;
    latestPriorityFeeRange: string[];
    historicalPriorityFeeRange: string[];
    historicalBaseFeeRange: string[];
    priorityFeeTrend: 'up' | 'down';
    baseFeeTrend: 'up' | 'down';
}

/**
 * Get gas fees from Infura Gas API
 */
export async function getInfuraGasFees(chain: string = 'eth'): Promise<InfuraGasResponse | null> {
    try {
        let apiKey = env.apiKeys.infuraGas || '';
        const apiSecret = env.apiKeys.infuraGasSecret;

        // Robustly handle cases where user pasted full URL instead of just Key
        if (apiKey.includes('http')) {
            const parts = apiKey.split('/');
            apiKey = parts[parts.length - 1]; // Take last part
        }

        // Check if user has configured Infura Key
        if (!apiKey) {
            console.warn('[InfuraGas] No API key configured');
            return null;
        }

        const chainId = CHAIN_ID_MAP[chain.toLowerCase()];
        if (!chainId) {
            console.warn(`[InfuraGas] Chain ${chain} not supported`);
            return null;
        }

        const url = `https://gas.api.infura.io/networks/${chainId}/suggestedGasFees`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Auth: Basic Auth (Key:Secret) or just Key
        const cleanKey = apiKey.trim();
        const cleanSecret = apiSecret ? apiSecret.trim() : '';

        if (cleanKey && cleanSecret) {
            const auth = Buffer.from(`${cleanKey}:${cleanSecret}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        } else {
            // For Gas API, if no secret, use Key as username and empty password
            const auth = Buffer.from(`${cleanKey}:`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }

        const response = await fetch(url, { method: 'GET', headers });

        if (!response.ok) {
            console.error(`[InfuraGas] API error for ${chain}: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(`[InfuraGas] Response: ${text}`);
            return null;
        }

        const data = await response.json();
        return data as InfuraGasResponse;

    } catch (error: any) {
        console.error(`[InfuraGas] Error fetching gas fees:`, error.message);
        return null;
    }
}

/**
 * Check if Infura Gas API is configured
 */
export function isInfuraConfigured(): boolean {
    return !!env.apiKeys.infuraGas;
}
