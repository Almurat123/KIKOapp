/**
 * Ormi Labs 0xAPI Service
 * Documentation: https://docs.ormilabs.com/data-api/overview
 */

const API_BASE_URL = 'https://api.data.ormilabs.com/v2';

// API Key from environment variables
const getApiKey = () => import.meta.env.VITE_ORMI_API_KEY;

// Mapping of Chain ID to Ormi Chain Slug (per docs)
const CHAIN_SLUGS: Record<number, string> = {
    1: 'ethereum',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism', // May not be supported, check docs
    8453: 'base',
    43114: 'avalanche',
    // Note: Solana is NOT supported by Ormi 0xAPI according to docs
};

export interface OrmiTokenHolder {
    address: string;
    balance: string;
    share: number;
}

export interface OrmiTokenTransfer {
    transaction_hash: string;
    from_address: string;
    to_address: string;
    value: string;
    block_number: number;
    block_timestamp: string;
}

/**
 * Generic fetch function for Ormi API
 */
async function fetchOrmi<T>(chainId: number, endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.warn('[OrmiAPI] No API Key found. Add VITE_ORMI_API_KEY to .env');
        return null;
    }

    const chainSlug = CHAIN_SLUGS[chainId];
    if (!chainSlug) {
        console.warn(`[OrmiAPI] Unsupported chain ID: ${chainId}`);
        return null;
    }

    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/${chainSlug}${endpoint}${queryString ? `?${queryString}` : ''}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn(`[OrmiAPI] Error ${response.status}: ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data; // Adjust based on actual response structure (data or data.data usually)
    } catch (error) {
        console.error('[OrmiAPI] Request failed:', error);
        return null;
    }
}

/**
 * Get Top Token Holders
 * Returns holders array and total_holders count
 */
export async function getOrmiTokenHolders(chainId: number, tokenAddress: string, limit = 50): Promise<{ holders: OrmiTokenHolder[], totalHolders: number }> {
    interface OrmiHoldersResponse {
        holders: Array<{ address: string; balance: number; balance_raw: string; percentage: number }>;
        total_holders: number;
        token?: { name: string; symbol: string; decimals: number };
    }

    const data = await fetchOrmi<OrmiHoldersResponse>(chainId, `/tokens/${tokenAddress}/holders`, { limit: limit.toString() });

    if (!data) {
        return { holders: [], totalHolders: 0 };
    }

    return {
        holders: data.holders?.map(h => ({
            address: h.address,
            balance: h.balance_raw,
            share: h.percentage
        })) || [],
        totalHolders: data.total_holders || 0
    };
}

/**
 * Get Recent Token Transfers
 */
export async function getOrmiTokenTransfers(chainId: number, tokenAddress: string, limit = 50): Promise<OrmiTokenTransfer[]> {
    const data = await fetchOrmi<{ data: OrmiTokenTransfer[] }>(chainId, `/tokens/${tokenAddress}/transfers`, { limit: limit.toString() });
    return data?.data || [];
}

/**
 * Get Token Metadata (if not available elsewhere)
 */
export async function getOrmiTokenMetadata(chainId: number, tokenAddress: string): Promise<any> {
    const data = await fetchOrmi<any>(chainId, `/tokens/${tokenAddress}`);
    return data;
}

export default {
    getHolders: getOrmiTokenHolders,
    getTransfers: getOrmiTokenTransfers,
    getMetadata: getOrmiTokenMetadata
};
